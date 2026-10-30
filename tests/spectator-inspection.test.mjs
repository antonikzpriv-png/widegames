import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import * as engine from '../server/engine/index.mjs';
import {spectatorInspection} from '../server/spectator.mjs';
import {createGameServer} from '../server/transport.mjs';
import {fileURLToPath} from 'node:url';
const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url));
import {install} from '../server/ai/strategic.mjs';
import {mapFor} from '../shared/maps/index.mjs';
import {stationProgress} from '../shared/station-challenges.mjs';
import {createRooms} from '../server/rooms.mjs';

test('observer inspection projects gameplay, accepted actions and claims; excludes private fields and arbitrary new events',()=>{
 const state=engine.createMatch({id:'observer',mode:'spectator',world:true,now:1000,seed:3,features:{deathPolicy:'ghost-tasks',abilities:true}});
 const actor=state.players[0];actor.privateReasoning='secret-reasoning';actor.tasks[0]={...actor.tasks[0],rawContext:'secret-context'};
 state.ghostChat=[{text:'secret-fallen-chat'}];state.apiKey='secret-key';
 state.replay.push({type:'action',at:1000.5,playerId:actor.id,action:{type:'say',text:'I was at the Bridge.',privateReasoning:'secret-reasoning'}},
  {type:'action',at:1000.5,playerId:actor.id,action:{type:'ghostSay',text:'secret-fallen-chat'}},
  {type:'future-event',at:1001,playerId:actor.id,rawContext:'secret-context'});
 const result=spectatorInspection(state,{mode:'spectator',seatId:null,identity:{host:true,seatId:null},now:1001});
 assert.equal(result.mode,'all-ai-observer');assert.equal(result.matchId,'observer');assert.equal(result.agents.length,6);
 const inspected=result.agents[0];assert.equal(inspected.role,actor.role);assert.deepEqual(inspected.position,actor.position);
 assert.equal(inspected.activity.source,'recorded-state');assert.deepEqual(inspected.recentActions,[{at:1000.5,type:'say',label:'Made a public claim'}]);
 assert.deepEqual(inspected.claims,[{at:1000.5,text:'I was at the Bridge.'}]);
 for(const secret of ['secret-reasoning','secret-context','secret-fallen-chat','secret-key','rawContext','ghostChat','apiKey'])assert(!JSON.stringify(result).includes(secret));
 assert.deepEqual(Object.keys(inspected.tasks[0].progress).sort(),['index','kind','readyAt','total']);
 assert(!engine.getPlayerView(state,null,1001).inspection,'inspection never enters the engine/AI view');
});

test('inspection is all-AI observer-only and defensively copies nested gameplay fields',()=>{
 const state=engine.createMatch({id:'copies',mode:'spectator',world:true,now:1000,seed:3});
 for(const options of [{mode:'human',seatId:null,identity:{host:true,seatId:null}},{mode:'spectator',seatId:'p1'},{mode:'spectator'},{mode:'spectator',seatId:null,identity:{host:false,seatId:null}},{}])assert.equal(spectatorInspection(state,options),null);
 assert.equal(spectatorInspection({...state,mode:'human'},{mode:'spectator',seatId:null,identity:{host:true,seatId:null}}),null);
 assert.equal(spectatorInspection({...state,worldVersion:undefined},{mode:'spectator',seatId:null,identity:{host:true,seatId:null}}),null);
 const first=spectatorInspection(state,{mode:'spectator',seatId:null,identity:{host:true,seatId:null}}),original=structuredClone(state);
 first.agents[0].position.x=-1;first.agents[0].cooldowns.taskAt=-1;first.agents[0].tasks[0].completed=true;first.agents[0].recentActions.push({at:-1});
 assert.deepEqual(state,original);assert.notDeepEqual(spectatorInspection(state,{mode:'spectator',seatId:null,identity:{host:true,seatId:null}}),first);
});

test('inspection activity describes authoritative moving/phase state without claiming to read thoughts',()=>{
 let state=engine.createMatch({id:'activity',mode:'spectator',world:true,now:1000,seed:3});
 state=engine.applyInput(state,'p1',{seq:1,dx:1,dy:0},1000).state;
 const inspect=at=>spectatorInspection(state,{mode:'spectator',seatId:null,identity:{host:true,seatId:null},now:at}).agents[0];
 assert.equal(inspect(1001).moving,true);assert.match(inspect(1001).activity.label,/recorded steering/);
 assert.equal(inspect(1601).moving,false);state.phase='discussion';assert.match(inspect(1601).activity.label,/council discussion/);
 state.phase='paused';assert.equal(inspect(1601).activity.label,'Match paused');state.phase='ended';assert.equal(inspect(1601).activity.label,'Match completed');
});

function plannedFixture(){
 const state=engine.createMatch({id:'plan-observer',mode:'spectator',world:true,now:1000,seed:3}),player=state.players.find(p=>p.role==='crew'),task=player.tasks[0],memory={privateReasoning:'never-publish-thoughts',prompt:'never-publish-context'};
 install(memory,{type:'intend',goal:'task',taskId:task.id,roomId:task.roomId,rationale:'never-publish-rationale'},engine.getPlayerView(state,player.id,1000));
 const context={activeMatchId:state.id,apiKey:'never-publish-key',matches:{[`match:${state.id}`]:{mode:'live',memories:{[`actor:${player.id}`]:memory}}}};
 return {state,player,task,memory,context,inspect:()=>spectatorInspection(state,{mode:'spectator',seatId:null,identity:{host:true,seatId:null},now:1001,context}).agents.find(p=>p.id===player.id)};
}

test('observer selected plan is an allowlisted recorded summary with explicit uncertainty, never free-form reasoning',()=>{
 const f=plannedFixture(),before=structuredClone(f.context),plan=f.inspect().plan;
 assert.equal(plan.goal,'task');assert.equal(plan.taskId,f.task.id);assert.equal(plan.source,'recorded-controller-state');assert.equal(plan.recordedAt,1000);assert.equal(plan.status,'last-selected');
 assert.match(plan.notice,/may no longer be current/);assert.match(plan.notice,/not private thoughts/);
 assert.deepEqual(Object.keys(plan).sort(),['expiresAt','goal','label','notice','recordedAt','roomId','source','status','taskId']);
 for(const secret of ['never-publish','rationale','memories','prompt','apiKey'])assert(!JSON.stringify(f.inspect()).includes(secret));
 plan.roomId='modified';assert.deepEqual(f.context,before);
 f.memory.intention={...f.memory.intention,goal:'task_route',taskIds:f.player.tasks.map(t=>t.id).slice(0,3)};
 const ids=f.inspect().plan.taskIds;ids[0]='changed';assert.notEqual(f.memory.intention.taskIds[0],'changed');
});

test('selected plans disappear across stale match/phase/death/completion/fallback and malformed or expired metadata',()=>{
 const invalidators=[
  f=>{f.context.activeMatchId='another-match';},f=>{f.context.matches[`match:${f.state.id}`].mode='demo';},
  f=>{f.state.phase='discussion';},f=>{f.state.phase='ended';},f=>{f.player.alive=false;},f=>{f.task.completed=true;},
  f=>{f.memory.intention.goal='unknown';},f=>{f.memory.intention.type='private-thought';},f=>{f.memory.intention.startedAt=1002;},
  f=>{f.memory.intention.startedAt=999;},f=>{f.memory.intention.expiresAt=1001;},f=>{f.memory.intention.expiresAt=31001;},
  f=>{f.memory.intention.taskId='unowned-task';},f=>{f.memory.intention.roomId='unknown-room';},f=>{f.memory.planProgress.failures=3;},
  f=>{f.memory.intention.goal='task_route';f.memory.intention.taskIds=['unowned-task'];},
  f=>{f.memory.intention.goal='follow';f.memory.intention.targetId='unknown-agent';},
  f=>{f.memory.intention.goal='report';f.memory.intention.bodyId='unknown-body';}
 ];
 for(const invalidate of invalidators){const f=plannedFixture();invalidate(f);assert.equal(f.inspect().plan,undefined,String(invalidate));}
});

test('expanded-map inspection preserves CAPTCHA step progress and validates selected goals against that match map',()=>{
 for(const mapId of ['storm-foundry','tidal-observatory']){
  const state=engine.createMatch({id:`observer-${mapId}`,mode:'spectator',world:true,mapId,now:1000,seed:3}),player=state.players.find(p=>p.role==='crew'),task=player.tasks[0],memory={};
  install(memory,{type:'intend',goal:'task',taskId:task.id,roomId:task.roomId},engine.getPlayerView(state,player.id,1000));
  const context={activeMatchId:state.id,matches:{[`match:${state.id}`]:{mode:'live',memories:{[`actor:${player.id}`]:memory}}}},inspect=()=>spectatorInspection(state,{mode:'spectator',seatId:null,identity:{host:true,seatId:null},context,now:1001}).agents.find(p=>p.id===player.id);
  assert.equal(inspect().plan.roomId,task.roomId,`${mapId} room is accepted`);
  memory.intention={...memory.intention,goal:'position',roomId:mapId==='storm-foundry'?'foundry':'charts'};
  assert.equal(inspect().plan.roomId,memory.intention.roomId,'new room outside the original six is accepted');
  for(const agent of spectatorInspection(state,{mode:'spectator',seatId:null,identity:{host:true,seatId:null},context,now:1001}).agents)for(const item of agent.tasks){
   assert.deepEqual(Object.keys(item.progress).sort(),['index','kind','readyAt','total']);
   for(const key of ['target','sequence','pressure','code','input','challenge'])assert(!Object.hasOwn(item.progress,key));
  }
  memory.intention.roomId=mapId==='storm-foundry'?'charts':'foundry';assert.equal(inspect().plan,undefined,'another map room cannot masquerade as a valid station');
 }
});

async function fixture(t,{instrument=false,native=false}={}){
 await mkdir(temporary,{recursive:true});const directory=await mkdtemp(join(temporary,'lw-observer-'));let now=100000;
 const observed=[],decisions=[];
 const instrumented={...engine,getPlayerView(state,actor,at){if(actor)observed.push(actor);return engine.getPlayerView(state,actor,at);}};
 const aiController={describe:()=>({mode:'demo',calls:0}),async decide({view,signal}){decisions.push(view);if(instrument)await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return null;}};
 const service=await createGameServer({dataDir:directory,publicOrigin:'http://spectator.test',worldMode:true,...(native?{systemsMode:true,tacticalMode:true,stationTasksMode:true,mapId:'beacon'}:{}),tickMs:instrument?20:60000,now:()=>now,ai:{provider:'demo',decisionIntervalMs:60000}},{engine:instrumented,aiController});
 t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true});});service.server.listen(0,'127.0.0.1');await once(service.server,'listening');
 const origin='http://127.0.0.1:'+service.server.address().port;
 async function request(path,{cookie,body}={}){const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:'http://spectator.test',...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 return {service,origin,request,observed,decisions,advance(ms){now+=ms;}};
}

test('HTTP/WS observer inspection is room-authorized, absent for human room viewers, and never unlocks live or paused replay',async t=>{
 const f=await fixture(t),watch=await f.request('/api/rooms',{body:{mode:'spectator'}}),human=await f.request('/api/rooms',{body:{mode:'human'}}),path='/api/rooms/'+watch.body.roomId,humanPath='/api/rooms/'+human.body.roomId;
 assert.equal(watch.body.game,null);await f.request(path+'/start',{cookie:watch.cookie,body:{id:'begin-watch'}});await f.request(humanPath+'/start',{cookie:human.cookie,body:{id:'begin-play'}});
 assert.equal((await f.request(path)).status,401);assert.equal((await f.request(path,{cookie:human.cookie})).status,401);
 assert.equal((await f.request(path+'/join',{body:{host:true}})).status,400);
 const viewer=await f.request(path+'/join',{body:{}}),watchView=await f.request(path,{cookie:viewer.cookie});
 assert.equal(watchView.body.game.inspection,undefined);const owner=await f.request(path,{cookie:watch.cookie});assert.equal(owner.body.game.inspection.agents.length,6);assert(owner.body.game.inspection.agents.every(p=>['crew','saboteur'].includes(p.role)));
 assert(watchView.body.game.players.every(p=>!Object.hasOwn(p,'role')));assert.equal(watchView.body.game.self,null);
 assert.equal(watchView.body.game.ghostChat,undefined);assert(watchView.body.game.players.every(p=>!Object.hasOwn(p,'tasks')));
 assert.equal((await f.request(path+'?host=true&inspection=true',{cookie:viewer.cookie})).status,400);
 assert.equal((await f.request(path+'/input',{cookie:viewer.cookie,body:{seq:1,dx:1,dy:0}})).status,403);
 assert.equal((await f.request(path+'/action',{cookie:viewer.cookie,body:{id:'cannot-act',type:'wait'}})).status,403);
 const guest=await f.request(humanPath+'/join',{body:{}});for(const cookie of [guest.cookie,human.cookie])assert(!Object.hasOwn((await f.request(humanPath,{cookie})).body.game,'inspection'));
 const ws=new WebSocket(f.origin.replace('http:','ws:')+path+'/socket',{headers:{Origin:'http://spectator.test',Cookie:viewer.cookie}});t.after(()=>ws.terminate());
 const [raw]=await once(ws,'message');assert.equal(JSON.parse(raw).room.game.inspection,undefined);
 const ownerWs=new WebSocket(f.origin.replace('http:','ws:')+path+'/socket',{headers:{Origin:'http://spectator.test',Cookie:watch.cookie}});t.after(()=>ownerWs.terminate());
 const [ownerRaw]=await once(ownerWs,'message');assert.equal(JSON.parse(ownerRaw).room.game.inspection.matchId,watch.body.roomId);
 for(const badCookie of [undefined,human.cookie]){
  const denied=new WebSocket(f.origin.replace('http:','ws:')+path+'/socket',{headers:{Origin:'http://spectator.test',...(badCookie?{Cookie:badCookie}:{})}});
  denied.on('error',()=>{});const [,response]=await once(denied,'unexpected-response');assert.equal(response.statusCode,401);response.resume();denied.terminate();
 }
 assert.equal((await f.request(path+'/replay',{cookie:viewer.cookie})).status,409);
 const entry=f.service.rooms.get(watch.body.roomId);entry.data.state={...entry.data.state,phase:'paused'};
 assert.equal((await f.request(path+'/replay',{cookie:viewer.cookie})).status,409);
 assert.equal((await f.request(path+'/replay?matchId='+human.body.roomId,{cookie:viewer.cookie})).status,404);
});

test('AI scheduler constructs a redacted view only for the selected actor, not every eligible keeper',async t=>{
 const f=await fixture(t,{instrument:true}),watch=await f.request('/api/rooms',{body:{mode:'spectator'}}),path='/api/rooms/'+watch.body.roomId;
 await f.request(path+'/start',{cookie:watch.cookie,body:{id:'start-instrument'}});
 const deadline=Date.now()+2000;while(!f.decisions.length&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(f.decisions.length,1);assert.deepEqual([...new Set(f.observed)],['p1']);assert.equal(f.decisions[0].self.id,'p1');
 assert(!Object.hasOwn(f.decisions[0],'inspection'));assert(f.decisions[0].players.every(p=>!Object.hasOwn(p,'role')));
});
