/** Legal-action regression fixtures; no death/position/knowledge assignments. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import * as engine from '../server/engine/index.mjs';
import {isGhost,canWorldAct} from '../server/engine/features.mjs';
import {isGhost as canonicalGhost} from '../shared/features.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {worldCandidates,worldRoute} from '../server/ai/world.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {createSpatialWorld} from '../server/engine/world/index.mjs';
import {createRoom,issueIdentity,cookie} from '../server/rooms.mjs';
import {createRoomStore,validateRoomSnapshot} from '../server/store.mjs';
import {createGameServer} from '../server/transport.mjs';
const copy=structuredClone,origin='http://ghost-factions.test',features={deathPolicy:'ghost-tasks',abilities:true};
const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url));
const maps=[{id:'beacon',version:2},{id:'stormbreak-annex',version:1}];
const roster=Array.from({length:8},(_,i)=>({id:'keeper_'+i,name:'Keeper '+i,color:'#aabbcc',persona:'Public fixture keeper'}));
const idle={describe:()=>({mode:'demo',provider:'demo',calls:0,tokens:0,costUsd:0}),decide:async()=>null};
const cache=new Map();
function fixture(reference){
 const key=reference?JSON.stringify(reference):'legacy2';
 if(cache.has(key))return flow(copy(cache.get(key)));
 const options={mode:'human',world:true,seed:'faction-regression',now:1000,features,config:{initialKillCooldownMs:1,killCooldownMs:1,meetingCooldownMs:1,meetingsPerPlayer:4,discussionMs:10,votingMs:10,maxMatchMs:900000},...(reference?{tactical:true,stationTasks:true,map:reference,roster,saboteurCount:2,humanPlayerIds:roster.map(p=>p.id)}:{})};
 const probe=engine.createMatch({id:'faction-probe',...options}),victim=probe.players.find(p=>p.role==='saboteur').id;
 const humans=reference?[victim,...roster.map(p=>p.id).filter(id=>id!==victim)]:undefined;
 const room=createRoom('human',1000,reference?{roster,saboteurCount:2,humanPlayerIds:humans}:undefined,{tactical:!!reference,stationTasks:!!reference,mapId:reference});
 room.features=copy(features);room.startId='faction:fixture:start';room.state=engine.createMatch({id:room.id,...options,...(reference?{humanPlayerIds:humans}:{})});
 const f=flow(room);f.victim=room.state.players.find(p=>p.role==='saboteur').id;
 if(!reference){
  const crew=room.state.players.find(p=>p.role==='crew').id;f.walk(f.victim,f.player(crew).position);f.act(f.victim,'eliminate',{targetId:crew});f.act(crew,'ghostSay',{text:'PRIVATE-CREW-FALLEN-SENTINEL'});
 }
 f.voteOut(f.victim);assert.equal(f.player(f.victim).alive,false);assert.equal(f.state.phase,reference?'roam':'ended');assert.equal(f.state.schemaVersion,reference?5:2);
 const issued=issueIdentity(f.room,true);f.room.updatedAt=f.state.updatedAt;
 // The configured tactical fixture grants all eight IDs human seats. The second
 // issued identity occupies an existing configured living seat, not a new permission.
 const living=f.state.players.find(p=>p.alive&&p.id!==issued.identity.seatId).id;
 const livingIssued=issueIdentity(f.room,false);if(reference)livingIssued.identity.seatId=living;
 const observer=issueIdentity(f.room,false);
 const record={room:f.room,victim:f.victim,living,ownerCookie:cookie(f.room.id,issued.token,false).split(';')[0],livingCookie:cookie(f.room.id,livingIssued.token,false).split(';')[0],spectatorCookie:cookie(f.room.id,observer.token,false).split(';')[0]};
 cache.set(key,copy(record));return flow(copy(record));
}
function flow(record){
 const f=record.room?record:{room:record};let serial=0;
 f.player=id=>f.state.players.find(p=>p.id===id);
 Object.defineProperty(f,'state',{get(){return f.room.state;},set(value){f.room.state=value;f.room.updatedAt=value.updatedAt;},configurable:true});
 f.act=(id,type,fields={},at=f.state.updatedAt)=>{const before=copy(f.state),r=engine.applyAction(f.state,id,{id:'factions:'+f.state.replaySequence+':'+ ++serial,type,...fields},at);assert.deepEqual(f.state,before);assert.equal(r.accepted,true,JSON.stringify({type,error:r.error}));f.state=r.state;return r;};
 f.tick=at=>{const before=copy(f.state),r=engine.tick(f.state,at);assert.deepEqual(f.state,before);f.state=r.state;};
 f.walk=(id,target)=>{f.act(id,'navigate',{x:target.x,y:target.y});let previous=f.player(id).position,length=0;for(const q of f.player(id).motion.path){length+=getMap(f.state.map).geometry.distance(previous,q);previous=q;}f.tick(f.state.updatedAt+Math.ceil(length/180*1000)+1);assert.ok(getMap(f.state.map).geometry.distance(f.player(id).position,target)<.001);};
 f.voteOut=target=>{
  const caller=f.state.players.find(p=>p.alive&&p.role==='crew'&&p.meetingsRemaining>0).id,g=getMap(f.state.map).geometry,w=createSpatialWorld(g),bell=g.WORLD_BELL.position??g.WORLD_BELL;
  f.tick(Math.max(f.state.updatedAt,f.player(caller).cooldowns.meetingAt));
  if(!engine.getPlayerView(f.state,caller,f.state.updatedAt).availableActions.includes('meeting')){
   const targets=[bell,...Array.from({length:16},(_,i)=>({x:bell.x+60*Math.cos(i*Math.PI/8),y:bell.y+60*Math.sin(i*Math.PI/8)}))];
   const point=targets.find(p=>g.isWalkable(p)&&w.navigation(f.player(caller),p,f.state.updatedAt,f.state)&&w.nearby(p,bell,92,f.state,caller));assert.ok(point,'reachable bell fixture');f.walk(caller,point);
  }
  f.act(caller,'meeting',{},Math.max(f.state.updatedAt,f.player(caller).cooldowns.meetingAt));f.tick(f.state.deadlineAt);assert.equal(f.state.phase,'voting');for(const id of [...f.state.meeting.eligibleVoters])f.act(id,'vote',{targetId:target});f.tick(f.state.deadlineAt);
 };
 return f;
}
function hidden(state,id,living){for(const viewer of [living,null]){const v=engine.getPlayerView(state,viewer,state.updatedAt);assert.equal(v.players.find(p=>p.id===id).position,null,'fallen saboteur coordinates must stay private');assert.equal(v.players.find(p=>p.id===id).roomId,null);assert.equal(v.ghostChat,undefined);assert.ok(!JSON.stringify(v).includes('PRIVATE-SAB-FALLEN-SENTINEL'));}}
async function directory(t){await mkdir(temporary,{recursive:true});const dir=await mkdtemp(path.join(temporary,'ghost-factions-'));t.after(async()=>{const relative=path.relative(temporary,dir);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));await rm(dir,{recursive:true,force:true});});return dir;}
async function save(dir,room){const store=await createRoomStore(dir);try{await store.save(room);}finally{await store.close();}}

test('canonical classification preserves every fallen faction only in the explicit preset',()=>{
 for(const deathPolicy of ['transfer','ghost-tasks'])for(const role of ['crew','saboteur'])for(const alive of [true,false]){const state={features:{deathPolicy}},p={role,alive};assert.equal(isGhost(state,p),canonicalGhost(state,p));assert.equal(canWorldAct(state,p),alive||deathPolicy==='ghost-tasks');}
});
test('real legacy2 ejection retains fallen saboteur private-chat readership and postgame coordinate privacy',async t=>{
 const f=fixture();assert.equal(f.state.phase,'ended');assert.equal(f.state.schemaVersion,2);const self=engine.getPlayerView(f.state,f.victim,f.state.updatedAt);assert.equal(self.self.ghost,true);assert.equal(self.self.role,'saboteur');assert.equal(self.ghostChat[0].text,'PRIVATE-CREW-FALLEN-SENTINEL');hidden(f.state,f.victim,f.living);
 const dir=await directory(t);await save(dir,f.room);const store=await createRoomStore(dir);try{const restored=(await store.load())[0];assert.deepEqual(restored.state.ghostChat,f.state.ghostChat);assert.equal(engine.getPlayerView(restored.state,f.victim,restored.state.updatedAt).self.ghost,true);for(const output of [engine.getReplay(restored.state),engine.getReplayMetadata(restored.state)])assert.ok(!JSON.stringify(output).includes('PRIVATE-CREW-FALLEN-SENTINEL'));}finally{await store.close();}
});
for(const reference of [null,...maps])test((reference?.id??'legacy2')+': independent postgame privacy control hides legally ejected saboteur coordinates',()=>{const f=fixture(reference);if(reference)f.voteOut(f.state.players.find(p=>p.alive&&p.role==='saboteur').id);assert.equal(f.state.phase,'ended');hidden(f.state,f.victim,f.living);});
for(const map of maps){
 test(map.id+': actual council ejection permits private ghost movement/chat but no living or crew-task powers',()=>{
  const f=fixture(map);assert.equal(f.state.players.filter(p=>p.alive&&p.role==='saboteur').length,1);assert.equal(engine.getPlayerView(f.state,f.victim,f.state.updatedAt).self.ghost,true);assert.deepEqual(f.player(f.victim).tasks,[]);hidden(f.state,f.victim,f.living);
  const text='PRIVATE-SAB-FALLEN-SENTINEL',chat={id:'faction:chat',type:'ghostSay',text};const spoken=engine.applyAction(f.state,f.victim,chat,f.state.updatedAt);assert.equal(spoken.accepted,true);f.state=JSON.parse(JSON.stringify(spoken.state));assert.equal(engine.applyAction(f.state,f.victim,chat,f.state.updatedAt).duplicate,true);assert.equal(f.state.ghostChat.length,1);
  const geometry=getMap(map).geometry,target=Object.values(geometry.WORLD_STATIONS).find(p=>geometry.distance(p,f.player(f.victim).position)>300);assert.ok(target);assert.ok(worldRoute(engine.getPlayerView(f.state,f.victim,f.state.updatedAt),target));f.walk(f.victim,target);
  const input=engine.applyInput(f.state,f.victim,{seq:1,dx:1,dy:0},f.state.updatedAt);assert.equal(input.accepted,true);f.state=JSON.parse(JSON.stringify(input.state));f.tick(f.state.updatedAt+100);const stopped=engine.applyInput(f.state,f.victim,{seq:2,dx:0,dy:0},f.state.updatedAt);assert.equal(stopped.accepted,true);f.state=stopped.state;assert.equal(engine.applyInput(f.state,f.victim,{seq:1,dx:1,dy:0},f.state.updatedAt).error.code,'STALE_INPUT');hidden(f.state,f.victim,f.living);
  const task=f.state.players.find(p=>p.role==='crew').tasks[0],alive=f.state.players.find(p=>p.alive).id,door=getMap(map).fixtures.doors[0],vent=getMap(map).fixtures.vents[0];
  const forbidden=[{type:'eliminate',targetId:alive},{type:'sabotage'},{type:'repair'},{type:'report',bodyId:'body-'+alive},{type:'meeting'},{type:'say',text:'public'},{type:'vote',targetId:'skip'},{type:'protect',targetId:alive},{type:'decoy',...f.player(f.victim).position},{type:'investigate',deviceId:getMap(map).fixtures.devices[0].id},{type:'deviceCancel'},{type:'systemSabotage',kind:'door',targetId:door.id},{type:'systemRepair',systemId:'door',siteId:door.id},{type:'vent',entryId:vent.id,exitId:vent.links[0]},{type:'ability',abilityId:'field-note',targetId:f.victim},{type:'task',taskId:task.id},{type:'taskStep',taskId:task.id,step:0,input:'0:0'},{type:'taskInteract',taskId:task.id,interactionId:'confirm',value:'complete'}];
  for(const [i,a]of forbidden.entries()){const before=copy(f.state),r=engine.applyAction(f.state,f.victim,{id:'faction:denial:'+i,...a},f.state.updatedAt);assert.equal(r.accepted,false,a.type);assert.deepEqual(f.state,before);assert.deepEqual(r.state.players,before.players);assert.deepEqual(r.state.ghostChat,before.ghostChat);f.state=r.state;}
  assert.deepEqual(engine.getPlayerView(f.state,f.victim,f.state.updatedAt).interactions,[]);assert.ok(engine.getPlayerView(f.state,f.victim,f.state.updatedAt).availableActions.every(a=>['wait','move','navigate','ghostSay'].includes(a)));
  f.voteOut(f.state.players.find(p=>p.alive&&p.role==='saboteur').id);assert.equal(f.state.phase,'ended');hidden(f.state,f.victim,f.living);assert.equal(engine.getPlayerView(f.state,f.victim,f.state.updatedAt).ghostChat[0].text,text);for(const output of [engine.getReplay(f.state),engine.getReplayMetadata(f.state),engine.getReplaySnapshots(f.state)])assert.ok(!JSON.stringify(output).includes(text));assert.equal(engine.applyInput(f.state,f.victim,{seq:3,dx:1,dy:0},f.state.updatedAt).error.code,'MATCH_INACTIVE');
 });
 test(map.id+': authenticated living/spectator HTTP, actual disk restart and ended views never expose fallen saboteur movement/chat',{timeout:20000},async t=>{
  const f=fixture(map),dir=await directory(t);let now=f.state.updatedAt,game,base;const realFetch=globalThis.fetch;
  t.mock.method(globalThis,'fetch',(url,options)=>{assert.ok(String(url).startsWith(base+'/'),'outbound fetch forbidden');return realFetch(url,options);});
  const config={dataDir:dir,publicOrigin:origin,now:()=>now,tickMs:600000,ai:{provider:'demo'}};
  const start=async()=>{game=await createGameServer(config,{aiController:idle});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base='http://127.0.0.1:'+game.server.address().port;};
  const stop=async()=>{await game?.close();game=null;};t.after(stop);await save(dir,f.room);await start();const route='/api/rooms/'+f.room.id;
  const request=async(tail='',body,identity=f.ownerCookie)=>{const response=await fetch(base+route+tail,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:identity,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(3000)});return {status:response.status,body:await response.json()};};
  const own=await request();assert.equal(own.status,200);assert.equal(own.body.game.self.id,f.victim);assert.equal(own.body.game.self.ghost,true);
  const chat={id:'faction:http:chat',type:'ghostSay',text:'PRIVATE-SAB-FALLEN-SENTINEL'};assert.equal((await request('/action',chat)).status,200);assert.equal((await request('/input',{seq:1,dx:1,dy:0})).status,200);now+=100;assert.equal((await request('/input',{seq:2,dx:0,dy:0})).status,200);
  async function privacy(){for(const identity of [f.livingCookie,f.spectatorCookie]){const r=await request('',undefined,identity);assert.equal(r.status,200);assert.equal(r.body.game.players.find(p=>p.id===f.victim).position,null);assert.equal(r.body.game.ghostChat,undefined);assert.ok(!JSON.stringify(r.body).includes(chat.text));}}
  await privacy();await stop();let saved=JSON.parse(await readFile(path.join(dir,'room-'+f.room.id+'.json'),'utf8'));assert.equal(saved.state.ghostChat[0].text,chat.text);assert.equal(saved.state.players.find(p=>p.id===f.victim).motion.seq,2);await validateRoomSnapshot(saved);await start();assert.equal((await request()).body.game.self.ghost,true);assert.equal((await request('/action',chat)).body.game.ghostChat.length,1);await privacy();await stop();
  saved=JSON.parse(await readFile(path.join(dir,'room-'+f.room.id+'.json'),'utf8'));const restored=flow({...f,room:saved});restored.voteOut(restored.state.players.find(p=>p.alive&&p.role==='saboteur').id);assert.equal(restored.state.phase,'ended');await save(dir,restored.room);now=restored.state.updatedAt;await start();await privacy();assert.equal((await request()).body.game.ghostChat[0].text,chat.text);const replay=await request('/replay');assert.equal(replay.status,200);assert.ok(!JSON.stringify(replay.body).includes(chat.text));await stop();
 });
}
test('fallen saboteur hybrid/strategic controllers send truthful local private chat then wait, never reserve or fetch',async t=>{
 const f=fixture(maps[0]);const fetched=t.mock.method(globalThis,'fetch',()=>{throw Error('No provider calls');});let reservations=0;
 for(const strategy of ['hybrid','strategic'])for(const provider of ['demo','anthropic']){
  let state=copy(f.state),context={},ai=createAiController({config:{provider,apiKey:'synthetic-never-sent',strategy,decisionIntervalMs:1}});const player=state.players.find(p=>p.id===f.victim),view=engine.getPlayerView(state,player.id,state.updatedAt),before=copy(view);
  const args={view,player:{id:player.id},context,commitReservation:async()=>{reservations++;throw Error('Ghost reservation forbidden');}};const first=await ai.decide(args);assert.equal(first?.type,'ghostSay');assert.ok(!/finish|remaining jobs|crew/i.test(first.text));assert.deepEqual(view,before);const applied=engine.applyAction(state,player.id,first,state.updatedAt);assert.equal(applied.accepted,true);state=JSON.parse(JSON.stringify(applied.state));context=JSON.parse(JSON.stringify(context));ai=createAiController({config:{provider,apiKey:'synthetic-never-sent',strategy,decisionIntervalMs:1}});const nextView=engine.getPlayerView(state,player.id,state.updatedAt+2100),next=await ai.decide({...args,context,view:nextView});assert.equal(next?.type,'wait');assert.equal(engine.applyAction(state,player.id,next,nextView.serverNow).accepted,true);assert.deepEqual(worldCandidates(nextView,{ghostSpoken:true},'skip'),[{type:'wait'}]);assert.equal(ai.describe(context).calls,0);assert.equal(ai.describe(context).tokens,0);assert.equal(ai.describe(context).costUsd,0);
 }
 assert.equal(reservations,0);assert.equal(fetched.mock.callCount(),0);
});
test('fallen crew still retain owned station work and execute the same safe local controller path',async t=>{
 const f=fixture(maps[0]),sab=f.state.players.find(p=>p.alive&&p.role==='saboteur').id,crew=f.state.players.find(p=>p.alive&&p.role==='crew').id,tasks=copy(f.player(crew).tasks);f.walk(sab,f.player(crew).position);f.act(sab,'eliminate',{targetId:crew},Math.max(f.state.updatedAt,f.player(sab).cooldowns.killAt));assert.equal(f.state.phase,'roam');assert.deepEqual(f.player(crew).tasks,tasks);
 const fetched=t.mock.method(globalThis,'fetch',()=>{throw Error('Fallen crew provider call forbidden');});const ai=createAiController({config:{provider:'anthropic',apiKey:'synthetic-never-sent',strategy:'strategic',decisionIntervalMs:1}}),context={};let reservations=0;
 async function decide(){const view=engine.getPlayerView(f.state,crew,f.state.updatedAt+1),before=copy(view),action=await ai.decide({view,player:{id:crew},context,commitReservation:async()=>{reservations++;throw Error('Fallen crew reservation forbidden');}});assert.deepEqual(view,before);assert.ok(action);const result=engine.applyAction(f.state,crew,action,view.serverNow);assert.equal(result.accepted,true,JSON.stringify(result.error));f.state=result.state;return action;}
 const first=await decide();assert.equal(first.type,'ghostSay');assert.match(first.text,/remaining jobs/);let next=await decide();if(next.type==='navigate'){const actor=f.player(crew);let length=0,previous=actor.position;for(const point of actor.motion.path){length+=getMap(f.state.map).geometry.distance(previous,point);previous=point;}f.tick(f.state.updatedAt+Math.ceil(length/180*1000)+1);next=await decide();}assert.equal(next.type,'taskInteract');assert.ok(f.player(crew).tasks.some(task=>task.challenge.progress.values.length>0));assert.equal(ai.describe(context).calls,0);assert.equal(reservations,0);assert.equal(fetched.mock.callCount(),0);
});
