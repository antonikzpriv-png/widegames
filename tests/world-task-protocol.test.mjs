import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createGameServer} from '../server/transport.mjs';
import * as engine from '../server/engine/index.mjs';
import {WORLD,WORLD_STATIONS,distance,findWorldPath} from '../shared/world.mjs';
import {validProgress,challenge} from '../server/engine/tasks.mjs';

// Only the permitted view supplies answers; do not use the engine's solver.
function answers(progress) {
 switch(progress.kind) {
  case 'wires': return ['0:0','1:1','2:2'];
  case 'tuning': return [String(progress.target)];
  case 'sequence': return progress.sequence.map(String);
  case 'pressure': return [progress.pressure<5?'right-to-left':'left-to-right',String(Math.abs(5-progress.pressure))];
  case 'repair': return ['isolate','replace','start','test'];
  default: throw Error('Unknown station');
 }
}

test('independent protocol oracle: all generated station types accept only the next semantic input',()=>{
 for(const roomId of ['bridge','lantern','archive','galley','workshop']) {
  let state=engine.createMatch({id:'protocol',seed:'independent',world:true,now:1000});
  const owner=state.players.find(p=>p.role==='crew'),task=owner.tasks[0];
  task.roomId=roomId;owner.roomId=roomId;owner.position={...WORLD_STATIONS[roomId]};
  const initial=engine.getPlayerView(state,owner.id,1000).self.tasks[0].progress;
  const inputs=answers(initial);
  for(let step=0;step<inputs.length;step++) {
   const now=1000+step*1500,action={id:`step-${step}`,type:'taskStep',taskId:task.id,step,input:inputs[step]};
   for(const invalid of [{...action,id:`future-${step}`,step:step+1},{...action,id:`wrong-${step}`,input:'solved:true'}]) {
    const result=engine.applyAction(state,owner.id,invalid,now);
    assert.equal(result.accepted,false);
    assert.equal(engine.getPlayerView(result.state,owner.id,now).self.tasks[0].progress.index,step);
   }
   const result=engine.applyAction(state,owner.id,action,now);assert.equal(result.accepted,true,JSON.stringify(result.error));state=result.state;
   assert.equal(engine.getPlayerView(state,owner.id,now).self.tasks[0].progress.index,step+1);
   assert.equal(engine.getReplay(state),null);
   for(const actor of [null,...state.players.filter(p=>p.id!==owner.id).map(p=>p.id)]) {
    const view=engine.getPlayerView(state,actor,now);
    assert(!view.self?.tasks.some(t=>t.id===task.id));
    assert(view.players.every(p=>!('tasks' in p)));
    assert(!view.events.some(e=>e.type==='taskStep'||e.action?.type==='taskStep'));
   }
  }
  const now=1000+inputs.length*1500;
  const done=engine.applyAction(state,owner.id,{id:'finish',type:'task',taskId:task.id},now);
  assert(done.accepted);assert.equal(done.state.players.flatMap(p=>p.tasks).filter(t=>t.completed).length,1);
  assert(done.state.players.find(p=>p.id===owner.id).cooldowns.taskAt>now);
 }
});

test('saved metadata rejects inconsistent diagnostic timers and completion stages',()=>{
 const task={id:'persisted-diagnostic',roomId:'workshop',completed:false};
 const initial=challenge(task);
 for(const invalid of [
  {...initial,index:0,readyAt:1500},
  {...initial,index:2,readyAt:1500},
  {...initial,index:3,readyAt:0},
  {...initial,index:3,readyAt:100000000},
  {...initial,index:4,readyAt:2000},
 ]) assert.equal(validProgress(invalid,task,{startedAt:0,updatedAt:1000}),false,JSON.stringify(invalid));
 assert.equal(validProgress({...initial,index:1}, {...task,completed:true},{startedAt:0,updatedAt:1000}),false);
 assert.equal(validProgress({...initial,index:3,readyAt:2000},task,{startedAt:0,updatedAt:1000}),true);
});

async function httpFixture(t) {
 const dataDir=await mkdtemp(path.join(tmpdir(),'widegames-task-http-'));
 const origin='http://task-protocol.test';let now=100000,game,base;
 let seed;
 for(let i=0;i<100;i++) {
  const probe=engine.createMatch({id:'probe',seed:i,world:true,config:{tasksPerCrew:5}});
  if(probe.players[0].role==='crew'&&probe.players[0].tasks.some(t=>t.roomId==='workshop')){seed=i;break;}
 }
 assert.notEqual(seed,undefined);
 const config={dataDir,publicOrigin:origin,worldMode:true,tickMs:1000000,now:()=>now,rules:{tasksPerCrew:5},ai:{provider:'demo',decisionIntervalMs:1000000}};
 const launch=async()=>{
  game=await createGameServer(config,{engine:{...engine,createMatch:options=>engine.createMatch({...options,taskEdition:1,seed,taskEdition:1})},aiController:{decide:async()=>null,describe:()=>({mode:'demo',calls:0,tokens:0,costUsd:0})}});
  game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base=`http://127.0.0.1:${game.server.address().port}`;
 };
 await launch();t.after(async()=>{await game.close();await rm(dataDir,{recursive:true,force:true});});
 async function request(route,data,cookie) {
  const response=await fetch(base+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 const host=await request('/api/rooms',{mode:'human'}),route=`/api/rooms/${host.body.roomId}`;
 assert.equal((await request(route+'/start',{id:'start'},host.cookie)).status,200);
 const view=async()=> (await request(route,undefined,host.cookie)).body.game;
 const action=(a,cookie=host.cookie)=>request(route+'/action',a,cookie);
 return {request,route,host,view,action,advance(ms){now+=ms;},get now(){return now;},async restart(){await game.close();await launch();}};
}

test('real HTTP: ordered task progress, denied receipts, ownership and diagnostic timer survive service restart',async t=>{
 const f=await httpFixture(t),initial=await f.view(),task=initial.self.tasks.find(t=>t.roomId==='workshop');
 const observer=await f.request(f.route+'/join',{});
 const post=(id,step,input)=>f.action({id,type:'taskStep',taskId:task.id,step,input});
 assert.equal((await f.action({id:'remote',type:'taskStep',taskId:task.id,step:0,input:'isolate'})).status,409);
 const station=WORLD_STATIONS.workshop,path=findWorldPath(initial.self.position,station);
 let length=0,last=initial.self.position;for(const point of path){length+=distance(last,point);last=point;}
 assert.equal((await f.action({id:'navigate',type:'navigate',x:station.x,y:station.y})).status,200);
 f.advance(Math.ceil(length/WORLD.speed*1000)+1);
 assert.equal((await f.action({id:'direct',type:'task',taskId:task.id})).body.error.code,'TASK_INCOMPLETE');
 assert.equal((await f.action({id:'spoof',type:'taskStep',taskId:task.id,step:0,input:'isolate',playerId:'p2'})).body.error.code,'INVALID_ACTION');
 for(const extra of [{solved:true},{now:1e12},{readyAt:0},{progress:{index:4}},{counter:4}]) {
  const response=await f.action({id:'forge-'+Object.keys(extra)[0],type:'taskStep',taskId:task.id,step:0,input:'isolate',...extra});
  assert.equal(response.body.error.code,'INVALID_ACTION');
 }
 assert.equal((await f.view()).self.tasks.find(t=>t.id===task.id).progress.index,0);
 assert.equal((await f.action({id:'observer',type:'taskStep',taskId:task.id,step:0,input:'isolate'},observer.cookie)).status,403);
 const duplicate=await Promise.all([post('isolate',0,'isolate'),post('isolate',0,'isolate')]);assert(duplicate.every(r=>r.status===200));
 assert.equal((await f.view()).self.tasks.find(t=>t.id===task.id).progress.index,1);
 assert.equal((await post('isolate',0,'replace')).body.error.code,'REQUEST_CONFLICT');
 assert.equal((await post('replace',1,'replace')).status,200);
 assert.equal((await post('start-diagnostic',2,'start')).status,200);
 const deadline=(await f.view()).self.tasks.find(t=>t.id===task.id).progress.readyAt;
 f.advance(1499);assert.equal(f.now,deadline-1);
 assert.equal((await post('too-early',3,'test')).body.error.code,'TOO_EARLY');
 await f.restart();assert.equal((await f.view()).self.tasks.find(t=>t.id===task.id).progress.readyAt,deadline);
 f.advance(1);
 assert.equal((await post('too-early',3,'test')).body.error.code,'TOO_EARLY','persisted denial remains idempotent after its timing condition changes');
 assert.equal((await post('verify',3,'test')).status,200);
 const done={id:'finish',type:'task',taskId:task.id};assert.equal((await f.action(done)).status,200);
 await f.restart();assert.equal((await f.action(done)).status,200);
 const final=await f.view();assert.equal(final.tasks.completed,1);assert.equal(final.tasks.total,25);assert.equal(final.self.tasks.find(t=>t.id===task.id).completed,true);
 const publicView=(await f.request(f.route,undefined,observer.cookie)).body.game;
 assert.equal(publicView.self,null);assert(!JSON.stringify(publicView).includes(task.id));assert(publicView.players.every(p=>!p.tasks));
});
