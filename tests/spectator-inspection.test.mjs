import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import * as engine from '../server/engine/index.mjs';
import {spectatorInspection} from '../server/spectator.mjs';
import {createGameServer} from '../server/transport.mjs';
import {install} from '../server/ai/strategic.mjs';

test('observer inspection projects gameplay, accepted actions and claims; excludes private fields and arbitrary new events',()=>{
 const state=engine.createMatch({id:'observer',mode:'spectator',world:true,now:1000,seed:3,features:{deathPolicy:'ghost-tasks',abilities:true}});
 const actor=state.players[0];actor.privateReasoning='secret-reasoning';actor.tasks[0]={...actor.tasks[0],rawContext:'secret-context'};
 state.ghostChat=[{text:'secret-fallen-chat'}];state.apiKey='secret-key';
 state.replay.push({type:'action',at:1000.5,playerId:actor.id,action:{type:'say',text:'I was at the Bridge.',privateReasoning:'secret-reasoning'}},
  {type:'action',at:1000.5,playerId:actor.id,action:{type:'ghostSay',text:'secret-fallen-chat'}},
  {type:'future-event',at:1001,playerId:actor.id,rawContext:'secret-context'});
 const result=spectatorInspection(state,{mode:'spectator',seatId:null,now:1001});
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
 for(const options of [{mode:'human',seatId:null},{mode:'spectator',seatId:'p1'},{mode:'spectator'},{}])assert.equal(spectatorInspection(state,options),null);
 assert.equal(spectatorInspection({...state,mode:'human'},{mode:'spectator',seatId:null}),null);
 assert.equal(spectatorInspection({...state,worldVersion:undefined},{mode:'spectator',seatId:null}),null);
 const mixed=structuredClone(state);mixed.players[1].human=true;assert.equal(spectatorInspection(mixed,{mode:'spectator',seatId:null}),null,'a spectator-hosted room containing a human is not an all-AI observatory');
 const first=spectatorInspection(state,{mode:'spectator',seatId:null}),original=structuredClone(state);
 first.agents[0].position.x=-1;first.agents[0].cooldowns.taskAt=-1;first.agents[0].tasks[0].completed=true;first.agents[0].recentActions.push({at:-1});
 assert.deepEqual(state,original);assert.notDeepEqual(spectatorInspection(state,{mode:'spectator',seatId:null}),first);
});

test('inspection activity describes authoritative moving/phase state without claiming to read thoughts',()=>{
 let state=engine.createMatch({id:'activity',mode:'spectator',world:true,now:1000,seed:3});
 state=engine.applyInput(state,'p1',{seq:1,dx:1,dy:0},1000).state;
 const inspect=at=>spectatorInspection(state,{mode:'spectator',seatId:null,now:at}).agents[0];
 assert.equal(inspect(1001).moving,true);assert.match(inspect(1001).activity.label,/recorded steering/);
 assert.equal(inspect(1601).moving,false);state.phase='discussion';assert.match(inspect(1601).activity.label,/council discussion/);
 state.phase='paused';assert.equal(inspect(1601).activity.label,'Match paused');state.phase='ended';assert.equal(inspect(1601).activity.label,'Match completed');
});

function plannedFixture(){
 const state=engine.createMatch({id:'plan-observer',mode:'spectator',world:true,now:1000,seed:3}),player=state.players.find(p=>p.role==='crew'),task=player.tasks[0],memory={privateReasoning:'never-publish-thoughts',prompt:'never-publish-context'};
 install(memory,{type:'intend',goal:'task',taskId:task.id,roomId:task.roomId,rationale:'never-publish-rationale'},engine.getPlayerView(state,player.id,1000));
 const context={activeMatchId:state.id,apiKey:'never-publish-key',matches:{[`match:${state.id}`]:{mode:'live',memories:{[`actor:${player.id}`]:memory}}}};
 return {state,player,task,memory,context,inspect:()=>spectatorInspection(state,{mode:'spectator',seatId:null,now:1001,context}).agents.find(p=>p.id===player.id)};
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
  const context={activeMatchId:state.id,matches:{[`match:${state.id}`]:{mode:'live',memories:{[`actor:${player.id}`]:memory}}}},inspect=()=>spectatorInspection(state,{mode:'spectator',seatId:null,context,now:1001}).agents.find(p=>p.id===player.id);
  assert.equal(inspect().plan.roomId,task.roomId,`${mapId} room is accepted`);
  memory.intention={...memory.intention,goal:'position',roomId:mapId==='storm-foundry'?'foundry':'charts'};
  assert.equal(inspect().plan.roomId,memory.intention.roomId,'new room outside the original six is accepted');
  for(const agent of spectatorInspection(state,{mode:'spectator',seatId:null,context,now:1001}).agents)for(const item of agent.tasks){
   assert.deepEqual(Object.keys(item.progress).sort(),['index','kind','readyAt','total']);
   for(const key of ['target','sequence','pressure','code','input','challenge'])assert(!Object.hasOwn(item.progress,key));
  }
  memory.intention.roomId=mapId==='storm-foundry'?'charts':'foundry';assert.equal(inspect().plan,undefined,'another map room cannot masquerade as a valid station');
 }
});

async function fixture(t,{instrument=false}={}){
 const directory=await mkdtemp(join(tmpdir(),'lw-observer-'));let now=100000;
 const observed=[],decisions=[];
 const instrumented={...engine,getPlayerView(state,actor,at){if(actor)observed.push(actor);return engine.getPlayerView(state,actor,at);}};
 const aiController={describe:()=>({mode:'demo',calls:0}),async decide({view,signal}){decisions.push(view);if(instrument)await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return null;}};
 const service=await createGameServer({dataDir:directory,publicOrigin:'http://spectator.test',worldMode:true,tickMs:instrument?20:60000,now:()=>now,ai:{provider:'demo',decisionIntervalMs:60000}},{engine:instrumented,aiController});
 t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true});});service.server.listen(0,'127.0.0.1');await once(service.server,'listening');
 const origin='http://127.0.0.1:'+service.server.address().port;
 async function request(path,{cookie,body}={}){const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:'http://spectator.test',...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 return {service,origin,request,observed,decisions,advance(ms){now+=ms;}};
}

function assertRolePrivate(view){
 assert.equal(view.game.self,null);assert(!Object.hasOwn(view.game,'inspection'));assert.equal(view.inspectionEnabled,false);
 for(const player of view.game.players)for(const field of ['role','tasks','cooldowns','destination','plan','ability','teammates'])assert(!Object.hasOwn(player,field),field+' must stay private');
 for(const field of ['inspection','agents','aiContext','requests','replayHistory'])assert(!Object.hasOwn(view,field),field+' must not leak through the room envelope');
}
async function until(check,label){const deadline=Date.now()+2000;while(Date.now()<deadline){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('Timed out: '+label);}
async function socket(f,t,path,cookie){const frames=[],ws=new WebSocket(f.origin.replace('http:','ws:')+path+'/socket',{headers:{Origin:'http://spectator.test',Cookie:cookie}});ws.on('message',raw=>frames.push(JSON.parse(raw).room));t.after(()=>ws.terminate());await until(()=>frames.length,'initial private socket frame');return {ws,frames};}

test('HTTP/WS inspection requires explicit per-identity consent; ordinary watch visitors retain role privacy',async t=>{
 const f=await fixture(t),watch=await f.request('/api/rooms',{body:{mode:'spectator'}}),human=await f.request('/api/rooms',{body:{mode:'human'}}),path='/api/rooms/'+watch.body.roomId,humanPath='/api/rooms/'+human.body.roomId;
 assert.equal(watch.body.game,null);assert.equal((await f.request(path+'/start',{cookie:watch.cookie,body:{id:'begin-watch'}})).status,200);await f.request(humanPath+'/start',{cookie:human.cookie,body:{id:'begin-play'}});
 assert.equal((await f.request(path)).status,401);assert.equal((await f.request(path,{cookie:human.cookie})).status,401);
 const viewer=await f.request(path+'/join',{body:{}}),other=await f.request(path+'/join',{body:{}}),watchView=await f.request(path,{cookie:viewer.cookie});
 assertRolePrivate(watchView.body);assertRolePrivate((await f.request(path,{cookie:watch.cookie})).body);assertRolePrivate(other.body);assert.equal(watchView.body.inspectionAvailable,true);
 const consenting=await socket(f,t,path,viewer.cookie),ordinary=await socket(f,t,path,other.cookie);assertRolePrivate(consenting.frames[0]);assertRolePrivate(ordinary.frames[0]);
 assert.equal((await f.request(path+'/inspection',{body:{enabled:true,generation:1}})).status,401);assert.equal((await f.request(path+'/inspection',{cookie:human.cookie,body:{enabled:true,generation:1}})).status,401);
 for(const body of [{enabled:'true',generation:1},{enabled:true,generation:1,seatId:'p1'}])assert.equal((await f.request(path+'/inspection',{cookie:viewer.cookie,body})).status,400);
 const enabled=await f.request(path+'/inspection',{cookie:viewer.cookie,body:{enabled:true,generation:1}});assert.equal(enabled.status,200);assert.equal(enabled.body.inspectionEnabled,true);assert.equal(enabled.body.game.inspection.agents.length,6);assert(enabled.body.game.inspection.agents.every(p=>['crew','saboteur'].includes(p.role)));assert(enabled.body.game.players.every(p=>!Object.hasOwn(p,'role')));
 await until(()=>consenting.frames.some(frame=>frame.inspectionEnabled),'consented socket projection');await until(()=>ordinary.frames.length>=2,'ordinary socket broadcast');assert.equal(consenting.frames.at(-1).game.inspection.matchId,watch.body.roomId);for(const frame of ordinary.frames)assertRolePrivate(frame);
 assertRolePrivate((await f.request(path,{cookie:other.cookie})).body);assertRolePrivate((await f.request(path,{cookie:watch.cookie})).body);
 assert.equal((await f.request(path+'/input',{cookie:viewer.cookie,body:{seq:1,dx:1,dy:0}})).status,403);assert.equal((await f.request(path+'/action',{cookie:viewer.cookie,body:{id:'cannot-act',type:'wait'}})).status,403);
 const guest=await f.request(humanPath+'/join',{body:{}});for(const cookie of [guest.cookie,human.cookie]){assert(!Object.hasOwn((await f.request(humanPath,{cookie})).body.game,'inspection'));assert.equal((await f.request(humanPath+'/inspection',{cookie,body:{enabled:true,generation:1}})).status,403);}
 const prior=consenting.frames.length,disabled=await f.request(path+'/inspection',{cookie:viewer.cookie,body:{enabled:false,generation:1}});assert.equal(disabled.status,200);assertRolePrivate(disabled.body);await until(()=>consenting.frames.length>prior,'inspection disabled on socket');assertRolePrivate(consenting.frames.at(-1));
 assert.equal((await f.request(path+'/replay',{cookie:viewer.cookie})).status,409);const entry=f.service.rooms.get(watch.body.roomId);entry.data.state={...entry.data.state,phase:'paused'};assert.equal((await f.request(path+'/replay',{cookie:viewer.cookie})).status,409);assert.equal((await f.request(path+'/replay?matchId='+human.body.roomId,{cookie:viewer.cookie})).status,404);
});

test('a spectator-hosted watch with a claimed human seat cannot enable inspection',async t=>{
 const f=await fixture(t),watch=await f.request('/api/rooms',{body:{mode:'spectator'}}),path='/api/rooms/'+watch.body.roomId,player=await f.request(path+'/join',{body:{intent:'play'}});assert.equal(player.status,200);assert.equal(player.body.seatId,'p1');
 await f.request(path+'/ready',{cookie:player.cookie,body:{ready:true,generation:1}});assert.equal((await f.request(path+'/start',{cookie:watch.cookie,body:{id:'mixed-watch'}})).status,200);
 const observer=await f.request(path+'/join',{body:{}});assertRolePrivate(observer.body);assert.equal(observer.body.inspectionAvailable,false);assert.equal((await f.request(path+'/inspection',{cookie:watch.cookie,body:{enabled:true,generation:1}})).status,403);assert.equal((await f.request(path+'/inspection',{cookie:observer.cookie,body:{enabled:true,generation:1}})).status,403);assert.equal((await f.request(path+'/inspection',{cookie:player.cookie,body:{enabled:true,generation:1}})).status,403);
 const entry=f.service.rooms.get(watch.body.roomId);assert.equal(spectatorInspection(entry.data.state,{mode:'spectator',seatId:null}),null);const connection=await socket(f,t,path,observer.cookie);assertRolePrivate(connection.frames[0]);
});

test('rematch clears per-watch inspection consent and rejects old opt-in requests on retained sockets',async t=>{
 const f=await fixture(t),watch=await f.request('/api/rooms',{body:{mode:'spectator'}}),path='/api/rooms/'+watch.body.roomId;await f.request(path+'/start',{cookie:watch.cookie,body:{id:'old-watch'}});assert.equal((await f.request(path+'/inspection',{cookie:watch.cookie,body:{enabled:true,generation:1}})).status,200);const connection=await socket(f,t,path,watch.cookie);assert(connection.frames[0].game.inspection);
 const entry=f.service.rooms.get(watch.body.roomId);entry.data.state={...entry.data.state,phase:'paused',deadlineAt:null};const rematch=await f.request(path+'/rematch',{cookie:watch.cookie,body:{id:'new-watch',generation:1}});assert.equal(rematch.status,200);assert.equal(rematch.body.generation,2);assert.equal(rematch.body.game,null);assert.equal(rematch.body.inspectionEnabled,false);assert(entry.data.identities.every(identity=>identity.inspection===false));
 assert.equal((await f.request(path+'/start',{cookie:watch.cookie,body:{id:'new-start',generation:2}})).status,200);assertRolePrivate((await f.request(path,{cookie:watch.cookie})).body);assert.equal((await f.request(path+'/inspection',{cookie:watch.cookie,body:{enabled:true,generation:1}})).status,409);await until(()=>connection.frames.some(frame=>frame.generation===2&&frame.game),'fresh private generation on retained socket');assertRolePrivate(connection.frames.at(-1));
 assert.equal((await f.request(path+'/inspection',{cookie:watch.cookie,body:{enabled:true,generation:2}})).status,200);
});

test('AI scheduler constructs a redacted view only for the selected actor, not every eligible keeper',async t=>{
 const f=await fixture(t,{instrument:true}),watch=await f.request('/api/rooms',{body:{mode:'spectator'}}),path='/api/rooms/'+watch.body.roomId;
 await f.request(path+'/start',{cookie:watch.cookie,body:{id:'start-instrument'}});
 const deadline=Date.now()+2000;while(!f.decisions.length&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(f.decisions.length,1);assert.deepEqual([...new Set(f.observed)],['p1']);assert.equal(f.decisions[0].self.id,'p1');
 assert(!Object.hasOwn(f.decisions[0],'inspection'));assert(f.decisions[0].players.every(p=>!Object.hasOwn(p,'role')));
});
