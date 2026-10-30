import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../server/engine/index.mjs';
import {getWorld} from '../shared/world.mjs';
import {taskProgress,taskInput} from '../server/engine/tasks.mjs';
import {validateReplayHistory,validateReplayMetadata,validateReplayAnchor} from '../shared/replay.mjs';
import {validateReplayHistoryState} from '../server/engine/replay-history.mjs';

function fixture(mapId,revision=2){return {state:e.createMatch({id:'illustrated-replay-'+mapId+'-'+revision,world:true,mapId,mapRevision:revision,mode:'spectator',seed:7,now:1000}),now:1000,serial:0};}
function tick(f,at){f.now=at;f.state=e.tick(f.state,at).state;}
function act(f,id,action){const full={id:'legal-replay:'+ ++f.serial,...action},r=e.applyAction(f.state,id,full,f.now);assert(r.accepted,JSON.stringify(r.error));f.state=r.state;return full;}
function travel(f,id,target){act(f,id,{type:'navigate',x:target.x,y:target.y});const p=f.state.players.find(p=>p.id===id),g=getWorld(f.state.mapId,f.state.mapRevision??1);let prior=p.position,length=0;for(const q of p.motion.path){length+=g.distance(prior,q);prior=q;}tick(f,f.now+Math.ceil(length/g.WORLD.speed*1000)+1);assert(g.distance(f.state.players.find(p=>p.id===id).position,target)<.01);}

for(const mapId of ['beacon','storm-foundry','tidal-observatory'])test('real illustrated task receipt, JSON restore and scripted legal ejection retain exact private replay: '+mapId,()=>{
 const f=fixture(mapId),g=getWorld(mapId,2),crew=f.state.players.find(p=>p.role==='crew').id,job=f.state.players.find(p=>p.id===crew).tasks[0];
 assert.equal(e.getReplay(f.state),null);assert.equal(e.getReplayMetadata(f.state),null);const before=structuredClone(f.state);travel(f,crew,g.WORLD_STATIONS[job.roomId]);assert.deepEqual(before.players[0].position,g.worldSpawn('p1'));
 let last;for(let i=0;i<5;i++){const t=f.state.players.find(p=>p.id===crew).tasks.find(t=>t.id===job.id),p=taskProgress(t);if(p.index===p.total)break;if(p.kind==='repair'&&p.index===3&&f.now<p.readyAt)tick(f,p.readyAt);last=act(f,crew,{type:'taskStep',taskId:t.id,step:p.index,input:taskInput(t)});f.state=JSON.parse(JSON.stringify(f.state));validateReplayHistoryState(f.state.replayHistory,f.state);}
 assert(last);const duplicate=e.applyAction(f.state,crew,last,f.now);assert(duplicate.accepted&&duplicate.duplicate);assert.deepEqual(duplicate.state,f.state);act(f,crew,{type:'task',taskId:job.id});assert(f.state.players.find(p=>p.id===crew).tasks.find(t=>t.id===job.id).completed);
 const own=e.getPlayerView(f.state,crew,f.now);assert(own.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'tasks')));assert.equal(own.mapRevision,2);
 // Scripted ballots are an explicit lifecycle fixture, not autonomous inference.
 // Default rules remain unchanged: settle the actual30s/20s council deadlines.
 travel(f,crew,g.WORLD_BELL);tick(f,Math.max(f.now,f.state.players.find(p=>p.id===crew).cooldowns.meetingAt));act(f,crew,{type:'meeting'});tick(f,f.state.deadlineAt);const sab=f.state.players.find(p=>p.role==='saboteur').id;for(const p of f.state.players)act(f,p.id,{type:'vote',targetId:sab});tick(f,f.state.deadlineAt);assert.equal(f.state.phase,'ended');assert.equal(f.state.outcome.reason,'ejection');
 const metadata=e.getReplayMetadata(f.state),replay=e.getReplay(f.state);assert.equal(metadata.version,1);assert.equal(metadata.mapRevision,2);assert.equal(metadata.map,mapId==='beacon'?'lantern-wake-v1':mapId);validateReplayMetadata(metadata,f.state.id);validateReplayHistory(f.state.replayHistory);assert(replay.every((event,i)=>!i||event.at>=replay[i-1].at));assert(replay.some(event=>event.type==='action'&&event.action.type==='taskStep'));assert(!JSON.stringify(metadata).includes('ghostChat'));
 const original=structuredClone(f.state);metadata.anchor.players[0].position.x=-100;replay[0].roles[0].role='fixture';assert.deepEqual(f.state,original);
 for(const mapRevision of [null,0,3,'2']){const invalid=e.getReplayMetadata(f.state);invalid.mapRevision=mapRevision;assert.throws(()=>validateReplayMetadata(invalid,f.state.id));}
 const mixed={...e.getReplayMetadata(f.state),version:2,map:{id:'beacon-illustrated',version:2}};assert.throws(()=>validateReplayMetadata(mixed,f.state.id));
});

test('original replay1 canonical/64KiB limits survive optional revision metadata',()=>{
 for(const revision of [1,2]){
  const f=fixture('beacon',revision),anchor=structuredClone(f.state.replayHistory.checkpoints[0]);assert.equal(Object.hasOwn(f.state.replayHistory,'mapRevision'),revision===2);
  for(const p of anchor.players)p.tasks=[];
  anchor.players.find(p=>p.role==='crew').tasks=Array.from({length:100},(_,i)=>({id:'t'+String(i).padStart(99,'0'),roomId:'bridge',label:'x'.repeat(200),completed:false}));
  assert(JSON.stringify(anchor).length<65536);validateReplayAnchor(anchor,'lantern-wake-v1',revision);
  for(const p of anchor.players)p.route=Array.from({length:128},()=>({x:700.1234567890123,y:300.1234567890123}));assert(JSON.stringify(anchor).length>65536);assert.throws(()=>validateReplayAnchor(anchor,'lantern-wake-v1',revision));
  const fewer=structuredClone(f.state.replayHistory.checkpoints[0]);fewer.players.pop();assert.throws(()=>validateReplayAnchor(fewer,'lantern-wake-v1',revision));
 }
});
