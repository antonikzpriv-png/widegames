import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplayModel,createReplayClock,restoreReplayTime} from '../public/world/replay-model.mjs';
import {recordedAiText} from '../public/world/replay-viewer.mjs';
import {WORLD,isWalkable,distance} from '../shared/world.mjs';
import {spatialFixture} from './spatial-replay-fixture.mjs';
const fixture=spatialFixture();
const model=()=>createReplayModel(fixture.envelope,{roomId:fixture.state.id,matchId:fixture.state.id});

test('spatial start/end and repeated seeks agree with authoritative positions, bodies, roles, tasks and ballots',()=>{
 const m=model(),start=m.at(m.coverage.from),end=m.at(m.coverage.through);
 assert.equal(m.coverage.partial,false);
 for(const p of fixture.initial.players)assert.deepEqual(start.players.find(q=>q.id===p.id).position,p.position);
 for(const p of fixture.state.players){const got=end.players.find(q=>q.id===p.id);assert.deepEqual(got.position,p.position);assert.equal(got.alive,p.alive);assert.deepEqual(got.tasks,p.tasks);}
 assert.equal(end.phase,'ended');assert.equal(end.sabotage.active,false);assert.equal(end.sabotage.repairsCompleted,2);assert.equal(end.bodies.length,1);assert(end.bodies[0].reported);assert.deepEqual(end.meeting.votes,fixture.state.meeting.votes);
 for(const at of [m.coverage.from,fixture.replay[5].at,m.coverage.through,m.coverage.from])assert.deepEqual(m.at(at),m.at(at));
 end.players[0].position.x=-1;assert.notEqual(m.at(m.coverage.through).players[0].position.x,-1);
});

test('recorded waypoint playback stays walkable and never interpolates a direct line through walls',()=>{
 const m=model(),e=m.events.find(e=>e.action?.type==='navigate'&&e.route.length>1);
 assert(e);assert.equal(e.speed,WORLD.speed);
 let total=0,prior=e.position;for(const p of e.route){total+=distance(prior,p);prior=p;}
 const until=e.at+total/e.speed*1000;
 for(let at=e.at;at<until;at+=117.125)assert(isWalkable(m.at(at).players.find(p=>p.id===e.playerId).position));
});

test('fractional timestamps and causal equal-time seeks remain exact and stable',()=>{
 const pos={x:800,y:272},events=[{id:'r1',type:'started',at:0,worldVersion:1,positions:[{id:'p1',position:pos}]},{id:'r3',type:'motion',at:100.69444444444444,playerId:'p1',position:{x:818.125,y:272},reason:'arrived'},{id:'r2',type:'action',at:100,playerId:'p1',action:{type:'say',text:'claim'}},{id:'r4',type:'future_ability',at:100.69444444444444,data:{kept:true}}];
 const m=createReplayModel({replay:events});assert.deepEqual(m.events.map(e=>e.id),['r1','r2','r3','r4']);assert.equal(m.events[2].at,100.69444444444444);assert.deepEqual(m.events[3].data,{kept:true});
 assert.deepEqual(m.at(m.events[2].at,1).players[0].position,pos);assert.equal(m.at(m.events[2].at,2).players[0].position.x,818.125);
});

test('range-control number serialization restores original fractional boundaries without rounding records',()=>{
 const original=8879.777777777777,serialized=8879.77777777778,events=[{at:original},{at:original+.0001}];
 assert.equal(restoreReplayTime(serialized,events),original);assert.equal(restoreReplayTime(original+.01,events),original+.01);assert.equal(events[0].at,original);
});

test('legacy and truncated histories never use final-state positions as invented initial state',()=>{
 const legacy=createReplayModel({replay:[{id:'r50',type:'motion',at:500,playerId:'p2',position:{x:818,y:272},reason:'sample'}]},{players:fixture.state.players});
 assert(legacy.coverage.partial);assert.equal(legacy.at(500).players[0].position,null);assert.deepEqual(legacy.at(500).players[1].position,{x:818,y:272});
 const full=createReplayModel({replay:fixture.replay});assert.equal(full.coverage.partial,false);assert.deepEqual(full.at(1000).players[0].position,fixture.initial.players[0].position);
 const samples=createReplayModel({replay:[{id:'r1',type:'direction',at:0,playerId:'p1',dx:1,dy:0,position:{x:800,y:272}},{id:'r2',type:'motion',at:1000,playerId:'p1',position:{x:900,y:272},reason:'sample'}]});assert.equal(samples.at(500).players[0].position.x,800);
});

test('malformed map/history metadata and mismatched room/match are rejected',()=>{
 for(const change of [m=>m.version=9,m=>m.map='other-map',m=>m.coverage.from=-1,m=>m.anchor.players[0].position.x=Infinity,m=>m.anchor.players[0].position.apiKey='never-reflect',m=>m.anchor.players[0].apiKey='never-reflect',m=>m.anchor.players.push(m.anchor.players[0])]){const e=structuredClone(fixture.envelope);change(e.metadata);assert.throws(()=>createReplayModel(e,{matchId:fixture.state.id}),/metadata/);}
 assert.throws(()=>createReplayModel(fixture.envelope,{roomId:'other'}),/another room/);assert.throws(()=>createReplayModel(fixture.envelope,{matchId:'other'}),/another match/);
});

test('captured witness knowledge, reconstructed visibility and public claims remain distinct',()=>{
 const m=model(),s=m.at(m.coverage.through),w=m.events.find(e=>e.type==='witness');
 assert(w.visibleTo.includes('p2'));assert.equal(m.perspective(s,'p2').observations[0].id,w.id);
 const excluded=s.players.find(p=>!w.visibleTo.includes(p.id));assert(excluded);assert.equal(m.perspective(s,excluded.id).observations.length,0);
 const claim=m.claims(s,'p6')[0];assert.equal(claim.claim.action.text,'I stayed in the Archive. Nobody saw me.');assert(claim.evidence.some(e=>e.type==='witness'));assert.match(claim.label,/not verified/);assert.equal(Object.hasOwn(claim,'true'),false);
 assert.match(m.perspective(s,'p2').label,/not proof/);
});

test('playback clock handles start/end, speed bounds, rewind, pause and disposal without network callbacks',()=>{
 let now=0,nextId=0;const queue=new Map(),frames=[];
 const c=createReplayClock({from:100,through:1100,onFrame:t=>frames.push(t),now:()=>now,request:fn=>{queue.set(++nextId,fn);return nextId;},cancel:id=>queue.delete(id)});
 const step=at=>{now=at;const [id,fn]=queue.entries().next().value;queue.delete(id);fn(at);};
 c.play();step(100);assert.equal(c.time,200);c.setSpeed(2);step(200);assert.equal(c.time,400);c.seek(100.25);assert.equal(c.time,100.25);c.pause();assert.equal(queue.size,0);
 assert.throws(()=>c.setSpeed(100),/speed/);assert.throws(()=>c.setSpeed(NaN),/speed/);
 c.seek(1050);c.play();step(300);assert.equal(c.time,1100);assert.equal(c.playing,false);c.seek(100);c.play();c.dispose();assert.equal(queue.size,0);const count=frames.length;c.seek(900);c.play();assert.equal(frames.length,count);
});

test('recorded AI labels distinguish mode/fallback and reservation ceilings from invoices',()=>{
 assert.match(recordedAiText({mode:'live',calls:2,tokens:100,costUsd:.01}),/HYBRID/);assert.match(recordedAiText({mode:'strategic'}),/STRATEGIC/);assert.match(recordedAiText({mode:'demo',limitReason:'provider_unavailable'}),/Fallback/);assert.match(recordedAiText({mode:'demo',costUsd:1}),/not provider invoices/);assert.match(recordedAiText(),/not recorded/);
});
