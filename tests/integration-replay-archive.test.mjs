import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createGameServer} from '../server/transport.mjs';
import {validateRoomSnapshot} from '../server/store.mjs';
import * as engine from '../server/engine/index.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {validateReplayMetadata,replaySequenceOf} from '../shared/replay.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';

// Real engine actions produce a completed recording. Actor placement at the
// authored emergency bell bounds this recording/HTTP/storage test; it is not
// presented as a browser or navigation test.
test('long 15-keeper rematch archives select a checkpoint covering event eviction and survive reload',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'integration-replay-archive-'));let now=100000,service,base;
 const config={dataDir:directory,publicOrigin:'http://archive.test',worldMode:true,systemsMode:true,tacticalMode:true,stationTasksMode:true,mapId:'beacon',mapRevision:2,tickMs:60000,now:()=>now,rules:{meetingCooldownMs:1,discussionMs:1,votingMs:1000,roamDeadlineMs:600000,maxMatchMs:1800000},ai:{provider:'demo'}};
 const idle={describe:()=>({mode:'demo'}),decide:async()=>null};
 async function boot(){service=await createGameServer(config,{aiController:idle,engine:{...engine,createMatch:options=>engine.createMatch({...options,seed:'long-private-archive'})}});await new Promise(r=>service.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+service.server.address().port;}
 await boot();t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true});});
 async function request(route,body,cookie){const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Origin:config.publicOrigin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const host=await request('/api/rooms',{mode:'human'});assert.equal(host.status,201);const route='/api/rooms/'+host.body.roomId,cookie=host.cookie;
 const settings=await request(route+'/settings',{settings:{capacity:15,saboteurs:3,tasksPerCrew:1}},cookie);assert.equal(settings.status,200,JSON.stringify(settings.body));assert.equal((await request(route+'/start',{id:'archive-start'},cookie)).status,200);
 const entry=service.rooms.get(host.body.roomId);let state=entry.data.state;
 function act(playerId,type,fields={}){now++;const result=engine.applyAction(state,playerId,{id:'archive-action-'+now,type,...fields},now);assert(result.accepted,JSON.stringify(result.error));state=result.state;}
 // More than the archive's 2,000-event cap, including periodic real checkpoints.
 for(let i=0;i<2100;i++)act('p'+(i%15+1),'wait');
 for(const saboteur of state.players.filter(p=>p.role==='saboteur')){
  const caller=state.players.find(p=>p.alive&&p.role==='crew'),bell=getMap(state.map).geometry.WORLD_BELL;caller.position={...bell};caller.roomId=getMap(state.map).geometry.worldRoomAt(bell);caller.cooldowns.meetingAt=now;caller.meetingsRemaining=3;
  act(caller.id,'meeting');now=state.deadlineAt;state=engine.tick(state,now).state;assert.equal(state.phase,'voting');
  for(const p of state.players.filter(p=>p.alive))act(p.id,'vote',{targetId:saboteur.id});
  now=state.deadlineAt;state=engine.tick(state,now).state;
 }
 assert.equal(state.phase,'ended');assert.equal(state.outcome.winner,'crew');assert(state.replay.length>2000);assert.equal(engine.getReplayMetadata(state).coverage.partial,false,'full in-memory history fixture is complete');entry.data.state=state;
 const rematch=await request(route+'/rematch',{id:'archive-again',generation:1},cookie);assert.equal(rematch.status,200,JSON.stringify(rematch.body));assert.equal(rematch.body.generation,2);
 const replay=await request(route+'/replay?matchId='+state.id,undefined,cookie);assert.equal(replay.status,200);assert.equal(replay.body.players.length,15);assert(replay.body.players.some(p=>p.id==='p15'&&['crew','saboteur'].includes(p.role)));assert(replay.body.replay.length<=2000);assert.equal(replay.body.metadata.coverage.partial,true,'archive eviction must be disclosed');
 validateReplayMetadata(replay.body.metadata,state.id);const firstSequence=replaySequenceOf(replay.body.replay.find(e=>replaySequenceOf(e)!==null));assert(firstSequence>1);const anchor=replay.body.metadata.anchor;assert(anchor===null||anchor.sequence>=firstSequence-1,'checkpoint must cover every discarded event');
 const model=createReplayModel(replay.body),last=model.at(model.coverage.through);assert.equal(model.coverage.partial,true);assert.equal(last.phase,'ended');assert.equal(last.players.length,15);assert.equal(last.outcome.winner,'crew');assert.deepEqual(last.players.map(p=>[p.id,p.role,p.alive]),state.players.map(p=>[p.id,p.role,p.alive]));
 const invalid=structuredClone(entry.data);assert(invalid.archives[0].metadata.anchor);invalid.archives[0].metadata.anchor.players[14].position={x:-100,y:-100};await assert.rejects(validateRoomSnapshot(invalid));
 const expected=structuredClone(replay.body);await service.close();await boot();const restored=await request(route+'/replay?matchId='+state.id,undefined,cookie);assert.equal(restored.status,200);assert.deepEqual(restored.body,expected);assert(!(await readdir(directory)).some(file=>file.includes('quarantine')));await validateRoomSnapshot(service.rooms.get(host.body.roomId).data);
});
