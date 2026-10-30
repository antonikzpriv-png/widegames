import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import {checkpointReplay} from '../server/engine/replay-history.mjs';
import {createReplayModel} from '../public/world/replay-model.mjs';
import {WORLD,WORLD_STATIONS,distance} from '../shared/world.mjs';
import {taskInput,taskProgress} from '../server/engine/tasks.mjs';
import {validateReplayHistory,replaySequenceOf} from '../shared/replay.mjs';

function fixture(){
 let state=engine.createMatch({id:'replay-main-integration',seed:'ghost-fixture',mode:'spectator',world:true,now:1000,features:{deathPolicy:'ghost-tasks',abilities:true},config:{initialKillCooldownMs:1,killCooldownMs:1,taskCooldownMs:1,meetingCooldownMs:1,discussionMs:100,votingMs:100,roamDeadlineMs:600000,maxMatchMs:1800000}}),serial=0;
 const sab=state.players.find(p=>p.role==='saboteur').id,ward=state.players.find(p=>p.ability?.type==='ward').id;
 const act=(actor,type,fields={},at=state.updatedAt+1)=>{const r=engine.applyAction(state,actor,{id:'new-main:'+ ++serial,type,...fields},at);assert(r.accepted,JSON.stringify(r.error));state=r.state;return ['protect','decoy'].includes(type)?state.replay.findLast(e=>e.type==='effect_started'):state.replay.at(-1);};
 const tick=at=>{state=engine.tick(state,at).state;};
 const nav=(actor,to)=>{const e=act(actor,'navigate',to),p=state.players.find(p=>p.id===actor);let total=0,prior=p.position;for(const q of p.motion.path){total+=distance(prior,q);prior=q;}tick(state.updatedAt+Math.ceil(total/WORLD.speed*1000)+1);return e;};
 const finish=()=>{nav(ward,{x:800,y:300});act(ward,'meeting');tick(state.deadlineAt);act(ward,'vote',{targetId:sab});tick(state.deadlineAt);assert.equal(state.phase,'ended');};
 return {get state(){return state;},sab,ward,act,tick,nav,finish,model(){return createReplayModel({matchId:state.id,replay:engine.getReplay(state),metadata:engine.getReplayMetadata(state)},{matchId:state.id});}};
}

test('new main effects retain their own IDs plus an authoritative replay sequence and reconstruct block/expiry boundaries',()=>{
 const f=fixture(),target=f.state.players.find(p=>p.role==='crew'&&p.id!==f.ward).id;
 f.nav(f.ward,f.state.players.find(p=>p.id===target).position);f.nav(f.sab,f.state.players.find(p=>p.id===target).position);
 const protectedEvent=f.act(f.ward,'protect',{targetId:target});assert.match(protectedEvent.id,/^fx-/);assert.equal(protectedEvent.sequence,f.state.replaySequence-1);
 const active=protectedEvent.at;
 const blocked=f.act(f.sab,'eliminate',{targetId:target});assert.equal(blocked.type,'attack_blocked');assert(f.state.players.find(p=>p.id===target).alive);assert.equal(f.state.bodies.length,0);
 const echo=f.act(f.sab,'decoy',f.state.players.find(p=>p.id===f.sab).position);f.tick(echo.expiresAt);f.finish();
 const m=f.model();assert.equal(m.at(active).effects[0].kind,'ward');assert.equal(m.at(blocked.at).effects.length,0);assert.equal(m.at(blocked.at).bodies.length,0);assert(m.at(blocked.at).players.find(p=>p.id===target).alive);
 assert.equal(m.at(echo.at).effects[0].id,echo.id);assert.equal(m.at(echo.expiresAt).effects.length,0);
 assert(m.events.every((e,i)=>!i||e.at>=m.events[i-1].at));assert(m.events.every(e=>Number.isSafeInteger(e.sequence)));assert.equal(new Set(m.events.map(e=>e.sequence)).size,m.events.length);
});

test('ghost movement is replayed separately from the stationary corpse and private fallen chat stays absent',()=>{
 const f=fixture(),victim=f.state.players.find(p=>p.role==='crew'&&p.id!==f.ward).id;
 f.nav(f.sab,f.state.players.find(p=>p.id===victim).position);f.act(f.sab,'eliminate',{targetId:victim});const corpse=structuredClone(f.state.bodies[0]);
 f.act(victim,'ghostSay',{text:'private-fallen-sentinel'});const task=f.state.players.find(p=>p.id===victim).tasks[0];f.nav(victim,WORLD_STATIONS[task.roomId]);
 while(true){const t=f.state.players.find(p=>p.id===victim).tasks.find(t=>t.id===task.id),p=taskProgress(t);if(p.index>=p.total)break;if(p.readyAt>f.state.updatedAt)f.tick(p.readyAt);f.act(victim,'taskStep',{taskId:t.id,step:p.index,input:taskInput(t)});}
 f.act(victim,'task',{taskId:task.id});const after=f.state.updatedAt;
 const living=engine.getPlayerView(f.state,f.ward,f.state.updatedAt),publicView=engine.getPlayerView(f.state,null,f.state.updatedAt);for(const v of [living,publicView]){assert.equal(v.players.find(p=>p.id===victim).position,null);assert.equal(v.ghostChat,undefined);}
 f.finish();const m=f.model(),s=m.at(after);assert(s.players.find(p=>p.id===victim).ghost);assert.equal(s.players.find(p=>p.id===victim).alive,false);assert.deepEqual(s.bodies[0].position,corpse.position);assert.notDeepEqual(s.players.find(p=>p.id===victim).position,corpse.position);
 assert(s.players.find(p=>p.id===victim).tasks.find(t=>t.id===task.id).completed);assert.equal(s.players.find(p=>p.id===victim).tasks.find(t=>t.id===task.id).progress.index,taskProgress(f.state.players.find(p=>p.id===victim).tasks.find(t=>t.id===task.id)).total);
 assert(!m.perspective(s,f.ward).visible.includes(victim));assert(m.perspective(s,victim).visible.includes(victim));assert(!JSON.stringify(engine.getReplay(f.state)).includes('private-fallen-sentinel'));assert(!JSON.stringify(engine.getReplayMetadata(f.state)).includes('private-fallen-sentinel'));
});

test('truncated anchor retains active abilities, progress and ghost preset without copying private chat',()=>{
 const f=fixture();f.act(f.sab,'decoy',f.state.players.find(p=>p.id===f.sab).position);
 // Force an authoritative checkpoint at a completed transaction boundary.
 delete f.state.replayHistory;checkpointReplay(f.state);const anchor=structuredClone(f.state.replayHistory.checkpoints[0]);
 assert.equal(anchor.features.deathPolicy,'ghost-tasks');assert.equal(anchor.effects.length,1);assert(anchor.players.some(p=>p.ability?.type==='ward'));assert(!Object.hasOwn(anchor,'ghostChat'));
 const at=anchor.at;f.tick(f.state.effects[0].expiresAt);f.finish();const metadata=engine.getReplayMetadata(f.state);assert(metadata.coverage.partial);const m=f.model();assert.equal(m.at(at).effects[0].kind,'echo');assert.equal(m.at(metadata.coverage.through).effects.length,0);validateReplayHistory(f.state.replayHistory);
 for(const mutate of [a=>a.effects[0].providerKey='private',a=>a.players.find(p=>p.ability).ability.memories={},a=>a.features.ghostChat='private']){const h={version:1,map:'lantern-wake-v1',checkpoints:[structuredClone(anchor)]};mutate(h.checkpoints[0]);assert.throws(()=>validateReplayHistory(h),/metadata/);}
});

test('effect-ID prefixes cannot cause truncation metadata to select the evicted initial anchor',()=>{
 const f=fixture();f.act(f.sab,'decoy',f.state.players.find(p=>p.id===f.sab).position);const e=structuredClone(f.state.replay.findLast(e=>e.type==='effect_started'));
 const s=structuredClone(f.state);s.replay=[{...e,sequence:12001}];s.replaySequence=12001;checkpointReplay(s);assert.equal(s.replayHistory.checkpoints.at(-1).sequence,12001);
 assert.equal(replaySequenceOf(s.replay[0]),12001);delete s.replay[0].sequence;assert.equal(replaySequenceOf(s.replay[0]),null);assert.equal(replaySequenceOf({id:'r11'}),11);
});
