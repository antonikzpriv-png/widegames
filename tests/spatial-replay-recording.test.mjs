import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import * as engine from '../server/engine/index.mjs';
import {checkpointReplay} from '../server/engine/replay-history.mjs';
import {validateReplayHistory,validateReplayMetadata,REPLAY_LIMITS} from '../shared/replay.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';
import {createRoomStore} from '../server/store.mjs';
import {createRoom,issueIdentity} from '../server/rooms.mjs';
import {spatialFixture} from './spatial-replay-fixture.mjs';

test('new authoritative anchors and replay metadata are bounded defensive copies and remain ended-only',()=>{
 const f=spatialFixture();assert.equal(engine.getReplayMetadata(f.initial),null);assert.equal(engine.getReplayMetadata({...f.state,phase:'paused'}),null);assert.equal(engine.getReplay({...f.state,phase:'paused'}),null);
 validateReplayHistory(f.state.replayHistory);validateReplayMetadata(f.metadata,f.state.id);
 const before=structuredClone(f.state),m=engine.getReplayMetadata(f.state);m.anchor.players[0].position.x=-100;m.anchor.players[0].tasks.length=0;m.coverage.from=-1;assert.deepEqual(f.state,before);
 const view=engine.getPlayerView(f.initial,null,1000);for(const key of ['replayHistory','replay','roles','requests'])assert(!Object.hasOwn(view,key));assert(view.players.every(p=>!Object.hasOwn(p,'role')));
});

test('event-cap eviction without started still has a valid authoritative reconstruction anchor',()=>{
 const f=spatialFixture(),s=structuredClone(f.state);
 // Model a checkpointed long recording: retain a real terminal state, then a bounded tail.
 s.phase='roam';s.outcome=null;s.updatedAt=f.now+1;s.replaySequence=13000;
 s.replay=Array.from({length:12000},(_,i)=>({id:'r'+(1001+i),type:'future_ability_sample',at:s.updatedAt}));
 checkpointReplay(s);assert(s.replayHistory.checkpoints.at(-1).sequence===13000);
 s.phase='ended';s.outcome={winner:'crew',reason:'ejection',at:s.updatedAt};
 const metadata=engine.getReplayMetadata(s);assert(metadata.coverage.partial);assert(metadata.anchor.sequence>=1000);
 const m=createReplayModel({roomId:s.id,matchId:s.id,replay:engine.getReplay(s),metadata},{matchId:s.id});
 for(const p of s.players)assert.deepEqual(m.at(m.coverage.from).players.find(q=>q.id===p.id).position,p.position);
 assert.equal(m.events.some(e=>e.type==='started'),false);
});

test('checkpoint retention is bounded and malformed or secret-bearing metadata fails closed',()=>{
 const f=spatialFixture(),s=structuredClone(f.initial);
 for(let n=1;n<=40;n++){s.updatedAt=1000+n;s.replaySequence=1024*n+1;checkpointReplay(s);}
 assert.equal(s.replayHistory.checkpoints.length,REPLAY_LIMITS.checkpoints);validateReplayHistory(s.replayHistory);
 for(const mutate of [h=>h.version=2,h=>h.checkpoints[0].sequence=-1,h=>h.checkpoints[0].players[0].memories={},h=>h.checkpoints[0].sabotage={apiKey:'secret'},h=>h.checkpoints[0].players[0].route=Array(129).fill({x:800,y:272})]){const h=structuredClone(s.replayHistory);mutate(h);assert.throws(()=>validateReplayHistory(h),/metadata/);}
});

test('byte retention limits large action histories and the room persists below 8 MiB',async t=>{
 const directory=await mkdtemp('/workspace/widegames/_artifacts/spatial-store-');let store;t.after(async()=>{await store?.close();await rm(directory,{recursive:true,force:true});});
 const room=createRoom('human',1000);issueIdentity(room,true);const f=spatialFixture(room.id);room.state=f.state;room.startId='spatial-store';room.updatedAt=f.now;
 const live=structuredClone(f.initial);live.replay=Array.from({length:12000},(_,i)=>({id:'r'+(i+1),type:'unknown_extension',at:1000,payload:'x'.repeat(350)}));live.replaySequence=12000;delete live.replayBytes;
 const result=engine.applyAction(live,'p1',{id:'bounded',type:'wait'},1001);assert(result.accepted);assert(result.state.replay.length<12000);assert(result.state.replayBytes<=REPLAY_LIMITS.bytes);validateReplayHistory(result.state.replayHistory);
 store=await createRoomStore(directory);await store.save(room);const [restored]=await store.load();assert.deepEqual(engine.getReplayMetadata(restored.state),f.metadata);assert((await stat(directory+'/room-'+room.id+'.json')).size<8*1024*1024);
 const malformed=structuredClone(room);malformed.state.replayBytes=0;await assert.rejects(store.save(malformed),/accounting/);
 malformed.state.replayBytes=room.state.replayBytes;malformed.state.replayHistory.checkpoints[0].sequence=room.state.replaySequence+1;await assert.rejects(store.save(malformed),/history/);
});
