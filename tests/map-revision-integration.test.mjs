import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {once} from 'node:events';
import * as engine from '../server/engine/index.mjs';
import {getWorld} from '../shared/world.mjs';
import {validateRoomSnapshot,createRoomStore} from '../server/store.mjs';
import {loadConfig} from '../server/config.mjs';
import {createGameServer} from '../server/transport.mjs';
import {validateReplayHistory,validateReplayMetadata} from '../shared/replay.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';
import {taskProgress,taskInput} from '../server/engine/tasks.mjs';

const maps=['beacon','storm-foundry','tidal-observatory'];
const roomFor=state=>({schema:1,id:state.id,mode:state.mode,createdAt:1000,updatedAt:state.updatedAt,identities:[{hash:'a'.repeat(64),host:true,seatId:'p1'}],state,startId:'start',aiContext:{},...(state.mapId?{mapId:state.mapId}:{}),...(state.mapRevision===2?{mapRevision:2}:{})});
let serial=0;
const act=(state,playerId,type,fields={},now=state.updatedAt)=>engine.applyAction(state,playerId,{id:`revision-${++serial}`,type,...fields},now);
function walk(state,playerId,target){
 const w=getWorld(state.mapId,state.mapRevision??1),player=state.players.find(p=>p.id===playerId),route=w.findWorldPath(player.position,target);assert(route,'reachable target');
 let length=0,previous=player.position;for(const q of route){length+=w.distance(previous,q);previous=q;}
 const move=act(state,playerId,'navigate',{x:target.x,y:target.y});assert(move.accepted,JSON.stringify(move.error));
 const settled=engine.tick(move.state,state.updatedAt+Math.ceil(length/w.WORLD.speed*1000)+1).state;
 assert(w.distance(settled.players.find(p=>p.id===playerId).position,target)<.01);
 return settled;
}

test('revision metadata is explicit, bounded and absent on legacy programmatic matches',()=>{
 assert.equal(loadConfig({}).mapRevision,2);
 const old=engine.createMatch({id:'revision_legacy_aaaaaaaaa',now:1000,world:true,seed:'revision'});
 assert.equal(Object.hasOwn(old,'mapRevision'),false);assert.equal(Object.hasOwn(old.replayHistory,'mapRevision'),false);
 assert.equal(Object.hasOwn(engine.getPlayerView(old,'p1',1000),'mapRevision'),false);
 for(const mapRevision of [0,3,'2',null,{},true])assert.throws(()=>engine.createMatch({id:'bad',world:true,mapRevision}),/revision/);
 assert.throws(()=>engine.createMatch({id:'bad',mapRevision:2}),/revision/);
});

for(const mapId of maps){
 test(`revision 2 ${mapId}: isolated geometry, authoritative tasks and durable navigation receipts`,async()=>{
  let state=engine.createMatch({id:('revision_'+mapId.replaceAll('-','_')).padEnd(32,'x'),now:1000,world:true,mapId,mapRevision:2,seed:'revision'});
  const w=getWorld(mapId,2);assert.equal(state.mapRevision,2);assert.equal(w.metadata.revision,2);assert.deepEqual(state.players[0].position,w.worldSpawn('p1'));
  const old=engine.createMatch({id:'old_same_map_aaaaaaaaaaaa',now:1000,world:true,mapId,seed:'revision'});assert.deepEqual(old.players[0].position,getWorld(mapId,1).worldSpawn('p1'));
  const actor=state.players.find(p=>p.role==='crew'),task=actor.tasks[0];state=walk(state,actor.id,w.WORLD_STATIONS[task.roomId]);
  let current=state.players.find(p=>p.id===actor.id).tasks.find(t=>t.id===task.id),lastAction;
  while(taskProgress(current).index<taskProgress(current).total){
   const c=taskProgress(current);if(c.kind==='repair'&&c.index===3&&state.updatedAt<c.readyAt)state=engine.tick(state,c.readyAt).state;
   lastAction={id:`durable-${++serial}`,type:'taskStep',taskId:task.id,step:taskProgress(current).index,input:taskInput(current)};
   const r=engine.applyAction(state,actor.id,lastAction,state.updatedAt);assert(r.accepted,JSON.stringify(r.error));state=JSON.parse(JSON.stringify(r.state));current=state.players.find(p=>p.id===actor.id).tasks.find(t=>t.id===task.id);
  }
  assert(engine.applyAction(state,actor.id,lastAction,state.updatedAt).duplicate);
  const done=act(state,actor.id,'task',{taskId:task.id});assert(done.accepted,JSON.stringify(done.error));state=done.state;
  const view=engine.getPlayerView(state,actor.id,state.updatedAt);assert.equal(view.mapRevision,2);assert.deepEqual(view.rooms,w.ROOM_LAYOUT);assert.equal(view.tasks.total,mapId==='beacon'?15:60);
  await validateRoomSnapshot(roomFor(state));
  const mismatch=roomFor(state);delete mismatch.mapRevision;await assert.rejects(validateRoomSnapshot(mismatch),/revision/);
  const badReplay=structuredClone(roomFor(state));badReplay.state.replayHistory.mapRevision=1;await assert.rejects(validateRoomSnapshot(badReplay),/revision|geometry/);
  const strippedHistory=structuredClone(roomFor(state));delete strippedHistory.state.replayHistory.mapRevision;await assert.rejects(validateRoomSnapshot(strippedHistory),/revision/);
  const directory=await mkdtemp(path.join(os.tmpdir(),'revision2-'));let store;
  try{store=await createRoomStore(directory);await store.save(roomFor(state));await store.close();store=await createRoomStore(directory);const restored=(await store.load())[0];assert(restored);assert.equal(restored.mapRevision,2);assert.deepEqual(restored.state,state);assert(engine.applyAction(restored.state,actor.id,lastAction,state.updatedAt).duplicate);}finally{await store?.close();await rm(directory,{recursive:true,force:true});}
 });
 test(`revision 2 ${mapId}: real ejection recording retains its geometry in playback`,()=>{
  let state=engine.createMatch({id:('replay2_'+mapId.replaceAll('-','_')).padEnd(32,'x'),now:1000,world:true,mapId,mapRevision:2,seed:'revision',config:{meetingCooldownMs:1,discussionMs:2,votingMs:2}});
  const w=getWorld(mapId,2);state=walk(state,'p1',w.WORLD_BELL);
  const meeting=act(state,'p1','meeting');assert(meeting.accepted,JSON.stringify(meeting.error));state=engine.tick(meeting.state,meeting.state.deadlineAt).state;
  const killer=state.players.find(p=>p.role==='saboteur');for(const p of state.players){const r=act(state,p.id,'vote',{targetId:killer.id});assert(r.accepted,JSON.stringify(r.error));state=r.state;}
  state=engine.tick(state,state.deadlineAt).state;assert.equal(state.phase,'ended');assert.equal(state.outcome.reason,'ejection');
  const metadata=engine.getReplayMetadata(state);assert.equal(metadata.mapRevision,2);validateReplayHistory(state.replayHistory);validateReplayMetadata(metadata,state.id);
  const response={matchId:state.id,replay:engine.getReplay(state),metadata},model=createReplayModel(response,{matchId:state.id,mapId,mapRevision:2});
  const first=model.at(state.startedAt);assert.equal(first.mapRevision,2);assert.deepEqual(first.players[0].position,w.worldSpawn('p1'));
  assert.equal(model.at(state.outcome.at).phase,'ended');assert.throws(()=>createReplayModel(response,{matchId:state.id,mapId,mapRevision:1}),/revision/);
  const stripped=structuredClone(response);delete stripped.metadata.mapRevision;assert.throws(()=>createReplayModel(stripped,{matchId:state.id,mapId,mapRevision:2}),/revision/);
  const downgraded=structuredClone(response);downgraded.metadata.mapRevision=1;assert.throws(()=>createReplayModel(downgraded,{matchId:state.id,mapId,mapRevision:2}),/revision/);
  for(const invalid of [null,0,3,'2']){const bad=structuredClone(metadata);bad.mapRevision=invalid;assert.throws(()=>validateReplayMetadata(bad,state.id));}
 });
}

test('legacy recording metadata never inherits the caller geometry revision',()=>{
 const response={matchId:'legacy_recording',replay:[],metadata:{version:1,map:'lantern-wake-v1',matchId:'legacy_recording',coverage:{startedAt:1000,from:1000,through:2000,partial:true},anchor:null}};
 const model=createReplayModel(response,{matchId:response.matchId});assert.equal(model.mapRevision,undefined);assert.equal(model.at(1000).mapRevision,undefined);
 assert.throws(()=>createReplayModel(response,{matchId:response.matchId,mapRevision:2}),/revision/);
 for(const mapRevision of [null,0,3,'2',{}])assert.throws(()=>createReplayModel({matchId:'events_only',replay:[]},{matchId:'events_only',mapRevision}),/revision/);
 const eventsOnly=createReplayModel({matchId:'events_only',replay:[]},{matchId:'events_only',mapRevision:2});assert.equal(eventsOnly.at(1000).mapRevision,2);
});

test('production room selection pins revision 2; clients cannot choose or change revisions',async t=>{
 for(const mapRevision of [null,3,'2'])await assert.rejects(createGameServer({mapRevision}),/revision/);
 await assert.rejects(createGameServer({worldMode:false,mapRevision:2}),/world mode/);
 const directory=await mkdtemp(path.join(os.tmpdir(),'revision-http-')),origin='http://revision.test',idle={describe:()=>({mode:'demo',provider:'demo'}),decide:async()=>null};
 let game=await createGameServer({dataDir:directory,publicOrigin:origin,worldMode:true,mapRevision:2,tickMs:600000,now:()=>1000,ai:{provider:'demo'}},{aiController:idle});
 game.server.listen(0,'127.0.0.1');await once(game.server,'listening');let base='http://127.0.0.1:'+game.server.address().port;t.after(async()=>{await game.close();await rm(directory,{recursive:true,force:true});});
 async function request(route,body,cookie){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 assert.equal((await request('/api/rooms',{mode:'human',mapRevision:1})).status,400);
 const lobby=await request('/api/rooms',{mode:'human'});assert.equal(lobby.status,201);assert.equal(lobby.body.mapRevision,2);
 const route='/api/rooms/'+lobby.body.roomId;
 assert.equal((await request(route+'/start',{id:'invalid',mapRevision:1},lobby.cookie)).status,400);
 const started=await request(route+'/start',{id:'start'},lobby.cookie);assert.equal(started.status,200);assert.equal(started.body.game.mapRevision,2);
 await game.close();game=await createGameServer({dataDir:directory,publicOrigin:origin,worldMode:true,mapRevision:1,tickMs:600000,now:()=>1000,ai:{provider:'demo'}},{aiController:idle});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base='http://127.0.0.1:'+game.server.address().port;
 const restored=await request(route,null,lobby.cookie);assert.equal(restored.body.game.mapRevision,2,'server defaults never migrate an existing match');
 const legacy=await request('/api/rooms',{mode:'human'});assert.equal(legacy.body.mapRevision,undefined);const oldStarted=await request('/api/rooms/'+legacy.body.roomId+'/start',{id:'old-start'},legacy.cookie);assert.equal(oldStarted.body.game.mapRevision,undefined);
});
