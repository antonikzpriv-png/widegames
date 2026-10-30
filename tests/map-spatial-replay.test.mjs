import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorld} from '../shared/world.mjs';
import {REPLAY_MAP,validateReplayAnchor,validateReplayMetadata,validateReplayHistory,validReplayTaskProgress} from '../shared/replay.mjs';
import {checkpointReplay,replayMetadata} from '../server/engine/replay-history.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';
import {createMatch} from '../server/engine/index.mjs';
import {challenge,TASK_KINDS} from '../server/engine/tasks.mjs';

const clone=structuredClone;
function recording(mapId){
 const map=getWorld(mapId),state=createMatch({id:`map-replay-${mapId}`,world:true,mode:'spectator',now:1000,seed:'expanded-spatial-replay'});
 state.mapId=mapId;state.replayHistory=undefined;state.replaySequence=1;
 state.players.forEach((p,i)=>{p.position=map.worldSpawn(p.id);p.roomId='bridge';p.motion.path=[];p.tasks=p.role==='crew'?p.tasks.map((t,j)=>({...t,roomId:map.WORLD_ROOMS[(i+j)%map.WORLD_ROOMS.length].id,kind:TASK_KINDS[(i+j)%TASK_KINDS.length]})):[];});
 const far=map.WORLD_ROOMS.at(-1);state.players[0].position={x:map.WORLD_STATIONS[far.id].x,y:map.WORLD_STATIONS[far.id].y};state.players[0].roomId=far.id;
 state.replay=[{id:'r1',sequence:1,type:'started',at:1000,worldVersion:1,positions:state.players.map(p=>({id:p.id,position:clone(p.position)})),roles:state.players.map(p=>({id:p.id,role:p.role})),tasks:state.players.map(p=>({id:p.id,tasks:clone(p.tasks)}))}];
 checkpointReplay(state);state.phase='ended';state.outcome={winner:'crew',reason:'tasks',at:2000};state.updatedAt=2000;
 return {state,map,metadata:replayMetadata(state)};
}

for(const mapId of ['storm-foundry','tidal-observatory'])test(`spatial replay records expanded ${mapId} bounds, room IDs and explicit task kinds`,()=>{
 const {state,map,metadata}=recording(mapId);assert.equal(metadata.map,mapId);assert.equal(state.replayHistory.map,mapId);validateReplayHistory(state.replayHistory);validateReplayMetadata(metadata,state.id);
 const anchor=metadata.anchor;assert.equal(anchor.players.flatMap(p=>p.tasks).length,15);assert(anchor.players.flatMap(p=>p.tasks).every(t=>TASK_KINDS.includes(t.kind)));
 for(const p of anchor.players)for(const t of p.tasks){t.progress=challenge(t);assert(validReplayTaskProgress(t.progress));}
 validateReplayAnchor(anchor,mapId);
 const model=createReplayModel({matchId:state.id,replay:[],metadata},{matchId:state.id,mapId});
 const frame=model.at(1000);assert.equal(frame.mapId,mapId);assert(frame.players[0].position.x>1600||frame.players[0].position.y>1200);for(const p of state.players)assert.deepEqual(frame.players.find(q=>q.id===p.id).position,p.position);
 const bad=clone(metadata);bad.anchor.players[0].position.x=map.WORLD.width+1;assert.throws(()=>validateReplayMetadata(bad,state.id),/metadata/);
 const wrongRoom=clone(metadata);wrongRoom.anchor.players[0].roomId='imaginary-deck';assert.throws(()=>validateReplayMetadata(wrongRoom,state.id),/metadata/);
 assert.throws(()=>createReplayModel({matchId:state.id,replay:[],metadata},{matchId:state.id,mapId:'beacon'}),/another map/);
});

test('all eleven v2 task progress forms round-trip while legacy progress stays v1-only',()=>{
 for(const kind of TASK_KINDS){const task={id:'t0123456789abcdefabcd',roomId:'bridge',kind};const p=challenge(task);assert(validReplayTaskProgress(p),kind);const invalid=clone(p);invalid.v=1;assert.equal(validReplayTaskProgress(invalid),!['glyphs','count','order','rotate','oddity','code'].includes(kind));const mismatch=clone(p);mismatch.total=9;assert(!validReplayTaskProgress(mismatch));}
 const old=challenge({id:'t0123456789abcdefabcd',roomId:'bridge'});assert(validReplayTaskProgress(old));assert.equal(old.v,1);
});

test('replay projection keeps geometry isolated when old and new map models are interleaved',()=>{
 const first=recording('storm-foundry'),second=recording('tidal-observatory');
 const foundry=createReplayModel({matchId:first.state.id,replay:[],metadata:first.metadata});
 const observatory=createReplayModel({matchId:second.state.id,replay:[],metadata:second.metadata});
 const before=foundry.at(1000);observatory.at(1000);const original=createReplayModel({replay:[{id:'r1',type:'motion',at:0,playerId:'p1',position:{x:800,y:272},reason:'sample'}]});
 assert.deepEqual(foundry.at(1000),before);assert.equal(original.at(0).mapId,undefined);assert.equal(first.metadata.version,1);assert.equal(REPLAY_MAP,'lantern-wake-v1');
});

test('actual expanded engine creation records its selected map and complete larger task pool immediately',()=>{
 for(const mapId of ['storm-foundry','tidal-observatory']){
  const state=createMatch({id:'created-'+mapId,mapId,world:true,mode:'spectator',now:1000,seed:'real-map-creation'});
  assert.equal(state.replayHistory.map,mapId);validateReplayHistory(state.replayHistory);
  const anchor=state.replayHistory.checkpoints[0];assert.equal(anchor.players.flatMap(p=>p.tasks).length,getWorld(mapId).metadata.tasksPerCrew*5);
  assert(anchor.players.flatMap(p=>p.tasks).every(t=>TASK_KINDS.includes(t.kind)));
 }
});
