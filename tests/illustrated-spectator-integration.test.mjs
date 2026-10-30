import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import * as engine from '../server/engine/index.mjs';
import {getWorld} from '../shared/world.mjs';
import {spectatorInspection} from '../server/spectator.mjs';
import {createGameServer} from '../server/transport.mjs';
import {install} from '../server/ai/strategic.mjs';

const maps=['beacon','storm-foundry','tidal-observatory'];
let serial=0;
function walk(state,id,target){const w=getWorld(state.mapId,state.mapRevision??1),player=state.players.find(p=>p.id===id),route=w.findWorldPath(player.position,target);assert(route);let length=0,previous=player.position;for(const point of route){length+=w.distance(previous,point);previous=point;}const result=engine.applyAction(state,id,{id:'inspect-route-'+(++serial),type:'navigate',x:target.x,y:target.y},state.updatedAt);assert(result.accepted,JSON.stringify(result.error));return engine.tick(result.state,state.updatedAt+Math.ceil(length/w.WORLD.speed*1000)+1).state;}

for(const mapId of maps)test(`illustrated ${mapId}: observer projection, ghost movement preflight and copied state retain revision 2`,()=>{
 let state=engine.createMatch({id:'inspect-v2-'+mapId,mode:'spectator',world:true,mapId,mapRevision:2,seed:'inspection-v2',now:1000,features:{deathPolicy:'ghost-tasks',abilities:true},config:{initialKillCooldownMs:1}});
 const world=getWorld(mapId,2),crew=state.players.find(p=>p.role==='crew'),task=crew.tasks[0],memory={privateReasoning:'NEVER_PUBLISH_THOUGHTS'};
 install(memory,{type:'intend',goal:'task',taskId:task.id,roomId:task.roomId},engine.getPlayerView(state,crew.id,1000));
 const context={activeMatchId:state.id,matches:{['match:'+state.id]:{mode:'live',memories:{['actor:'+crew.id]:memory}}}};
 const inspect=spectatorInspection(state,{mode:'spectator',seatId:null,now:1001,context}),agent=inspect.agents.find(p=>p.id===crew.id);
 assert.deepEqual(agent.position,world.worldSpawn(crew.id));assert.equal(agent.plan.roomId,task.roomId);assert.equal(agent.tasks.length,mapId==='beacon'?3:12);assert(!JSON.stringify(inspect).includes('NEVER_PUBLISH'));
 assert.equal(engine.getPlayerView(state,null,1001).inspection,undefined);assert.equal(spectatorInspection(state,{mode:'human',seatId:null}),null);assert.equal(spectatorInspection(state,{mode:'spectator',seatId:crew.id}),null);
 const killer=state.players.find(p=>p.role==='saboteur');state=walk(state,killer.id,crew.position);
 const eliminated=engine.applyAction(state,killer.id,{id:'inspect-elimination',type:'eliminate',targetId:crew.id},state.updatedAt);assert(eliminated.accepted,JSON.stringify(eliminated.error));state=eliminated.state;
 const corpse=structuredClone(state.bodies[0]),ghost=state.players.find(p=>p.id===crew.id),destination=world.WORLD_STATIONS[ghost.tasks[0].roomId];
 const moving=engine.applyAction(state,crew.id,{id:'inspect-ghost-walk',type:'navigate',x:destination.x,y:destination.y},state.updatedAt);assert(moving.accepted,JSON.stringify(moving.error));
 const before=structuredClone(moving.state),tick=engine.tick(moving.state,moving.state.updatedAt+100).state;assert.notEqual(tick,moving.state);assert.equal(tick.mapRevision,2);assert.equal(tick.replayHistory.mapRevision,2);assert.deepEqual(moving.state,before);
 assert.equal(tick.players.find(p=>p.id===crew.id).alive,false);assert.deepEqual(tick.bodies[0],corpse);assert(world.isWalkable(tick.players.find(p=>p.id===crew.id).position));
 const observed=spectatorInspection(tick,{mode:'spectator',seatId:null,now:tick.updatedAt});assert(observed.agents.find(p=>p.id===crew.id).ghost);assert.deepEqual(observed.agents.find(p=>p.id===crew.id).position,tick.players.find(p=>p.id===crew.id).position);
 const living=engine.getPlayerView(tick,killer.id,tick.updatedAt);assert.equal(living.players.find(p=>p.id===crew.id).position,null);assert.equal(living.inspection,undefined);assert.equal(living.ghostChat,undefined);
 const clonedActor=tick.players.find(p=>p.id===crew.id);clonedActor.position.x=-100;assert.deepEqual(moving.state,before,'optimized copies cannot share revised positions/history');
});

test('revision-2 HTTP and WebSocket inspection stays confined to authenticated all-AI observers',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'illustrated-inspect-')),origin='http://v2-inspection.test',idle={describe:()=>({mode:'demo',provider:'demo'}),decide:async()=>null};
 const service=await createGameServer({dataDir:directory,publicOrigin:origin,worldMode:true,mapRevision:2,tickMs:600000,now:()=>1000,ai:{provider:'demo'}},{aiController:idle});
 t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true});});service.server.listen(0,'127.0.0.1');await once(service.server,'listening');const base='http://127.0.0.1:'+service.server.address().port;
 async function request(route,{body,cookie}={}){const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const watch=await request('/api/rooms',{body:{mode:'spectator',mapId:'tidal-observatory'}}),human=await request('/api/rooms',{body:{mode:'human',mapId:'storm-foundry'}}),watchPath='/api/rooms/'+watch.body.roomId,humanPath='/api/rooms/'+human.body.roomId;
 const started=await request(watchPath+'/start',{cookie:watch.cookie,body:{id:'start-watch'}});assert.equal(started.status,200);assert.equal(started.body.mapRevision,2);assert.equal(started.body.game.mapRevision,2);assert.equal(started.body.game.inspection.agents.length,6);assert.equal(started.body.game.self,null);
 for(const player of started.body.game.inspection.agents)assert.deepEqual(player.position,getWorld('tidal-observatory',2).worldSpawn(player.id));
 await request(humanPath+'/start',{cookie:human.cookie,body:{id:'start-human'}});const guest=await request(humanPath+'/join',{body:{}});
 for(const cookie of [human.cookie,guest.cookie]){const view=await request(humanPath,{cookie});assert.equal(view.body.game.mapRevision,2);assert.equal(view.body.game.inspection,undefined);assert(view.body.game.players.every(p=>p.role===undefined));}
 assert.equal((await request(watchPath)).status,401);assert.equal((await request(watchPath,{cookie:human.cookie})).status,401);
 assert.equal((await request(watchPath+'/input',{cookie:watch.cookie,body:{seq:1,dx:1,dy:0}})).status,403);assert.equal((await request(watchPath+'/action',{cookie:watch.cookie,body:{id:'no-action',type:'wait'}})).status,403);
 const socket=new WebSocket(base.replace('http:','ws:')+watchPath+'/socket',{headers:{Origin:origin,Cookie:watch.cookie}});t.after(()=>socket.terminate());const [raw]=await once(socket,'message'),view=JSON.parse(raw).room;
 assert.equal(view.mapRevision,2);assert.equal(view.game.inspection.matchId,watch.body.roomId);assert.equal(view.game.inspection.agents.length,6);assert.equal(view.game.ghostChat,undefined);assert(view.game.players.every(p=>p.role===undefined));
});
