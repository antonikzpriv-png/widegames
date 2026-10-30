import test from 'node:test';
import assert from 'node:assert/strict';
import * as geometry from '../shared/world.mjs';
import {BEACON_VENTS,DEFAULT_BEACON_RULES} from '../shared/beacon.mjs';
import {createSpatialWorld} from '../server/engine/world/index.mjs';
const world=createSpatialWorld(geometry),clone=s=>JSON.parse(JSON.stringify(s));
// Module fixtures stand for engine-cloned state/private records; no model/client input.
function fixture(){const s={schemaVersion:3,worldVersion:1,beaconVersion:1,phase:'roam',updatedAt:0,beaconRules:{...DEFAULT_BEACON_RULES},players:['p1','p2','p3','p4','p5','p6'].map((id,i)=>({id,name:id,color:'#123456',role:i===5?'saboteur':'crew',alive:true})),systems:{doors:[],lights:{active:false},transit:{}},bodies:[],replay:[],replaySequence:0};world.initialize(s,0);return s;}
function record(s,type,at,data){s.replay.push({id:'r'+ ++s.replaySequence,type,at,...data});}
function trace(s,type,at,visibleTo=['p1']){const v=BEACON_VENTS[type==='vent_enter'?0:2];record(s,type,at,{playerId:'p6',roomId:v.roomId,position:{...v.position},[type==='vent_enter'?'entryId':'exitId']:v.id,visibleTo});return s.replay.at(-1);}
function observe(s,at){const changed=world.observe(s,at,record);if(changed)s.updatedAt=at;return changed;}
const events=(s,id)=>world.projectWorld(s,id,s.updatedAt).localEvents.filter(e=>e.type==='vent_enter'||e.type==='vent_exit');

test('explicit vent recipients get dated local hatch traces, never destination/roles/list or spectator traces',()=>{
 const s=fixture();const enter=trace(s,'vent_enter',10,['p1','p6']),exit=trace(s,'vent_exit',20,['p2','p6']);enter.role='saboteur';enter.destination={x:1450,y:550};observe(s,30);
 assert.deepEqual(events(s,'p1').map(e=>e.type),['vent_enter']);assert.deepEqual(events(s,'p2').map(e=>e.type),['vent_exit']);assert.deepEqual(events(s,'p6').map(e=>e.type),['vent_enter','vent_exit']);assert.deepEqual(events(s,'p3'),[]);assert.deepEqual(events(s,null),[]);
 const local=events(s,'p1')[0];assert.equal(local.at,10);assert.equal(local.observedAt,30);assert.equal(local.playerId,'p6');assert.equal(local.entryId,BEACON_VENTS[0].id);assert.deepEqual(local.position,BEACON_VENTS[0].position);
 for(const event of [...events(s,'p1'),...events(s,'p2')]){assert.equal(Object.hasOwn(event,'visibleTo'),false);assert.equal(Object.hasOwn(event,'role'),false);assert.equal(Object.hasOwn(event,'destination'),false);assert.notEqual(Object.hasOwn(event,'entryId'),Object.hasOwn(event,'exitId'));}
 const hidden=trace(s,'vent_enter',40,[]);observe(s,50);assert.equal(events(s,null).length,0);assert.equal(events(s,'p1').length,1);assert.equal(s.replay.find(e=>e.id===hidden.id).visibleTo.length,0);
 const exported=events(s,'p1');exported[0].position.x=-1;assert.deepEqual(events(s,'p1')[0].position,BEACON_VENTS[0].position);assert.equal(world.validateSpatialState(s),true);
});

test('trace dedup survives JSON restart and history eviction; old knowledge without trace cursor upgrades safely',()=>{
 let s=fixture();s.beaconRules.observationLimit=1;for(const p of s.players)delete p.knowledge.traceCursor;delete s.spatial.spectator.knowledge.traceCursor;
 trace(s,'vent_enter',10);trace(s,'vent_exit',20);observe(s,30);assert.equal(events(s,'p1').length,1);assert.equal(events(s,'p1')[0].type,'vent_exit');const sequence=s.players[0].knowledge.sequence;s=clone(s);observe(s,40);assert.equal(s.players[0].knowledge.sequence,sequence);
 s.phase='discussion';s.meeting={id:'trace-eviction'};observe(s,50);s.phase='roam';observe(s,60);assert.equal(events(s,'p1').length,0);assert.equal(s.players[0].knowledge.sequence,sequence+1);assert.equal(world.validateSpatialState(s),true);
});

test('future or malformed trace sources cannot create forged local sightings; histories stay bounded64',()=>{
 const s=fixture();const both=trace(s,'vent_enter',1);both.exitId=BEACON_VENTS[2].id;const wrong=trace(s,'vent_exit',2);wrong.position={x:800,y:285};const absent=trace(s,'vent_enter',3);absent.playerId='absent';observe(s,5);assert.equal(events(s,'p1').length,0);
 trace(s,'vent_enter',10);observe(s,6);assert.equal(events(s,'p1').length,0);observe(s,10);assert.equal(events(s,'p1').length,1);
 for(let at=11;at<=110;at++)trace(s,at%2?'vent_enter':'vent_exit',at);observe(s,111);assert.equal(events(s,'p1').length,64);assert.equal(world.validateSpatialState(clone(s)),true);const count=s.players[0].knowledge.sequence;observe(s,112);assert.equal(s.players[0].knowledge.sequence,count);
});

test('restore rejects future row/event/observed timestamps including fractional overshoot; equal checkpoint is valid',()=>{
 const s=fixture();trace(s,'vent_enter',10);observe(s,20);assert.equal(world.validateSpatialState(clone(s)),true);
 for(const mutate of [x=>x.players[0].knowledge.roster[0].at=21,x=>{x.players[0].knowledge.events[0].at=21;x.players[0].knowledge.events[0].observedAt=21;},x=>x.players[0].knowledge.events[0].observedAt=20.000001,x=>x.spatial.spectator.knowledge.roster[0].at=21]){const bad=clone(s);mutate(bad);assert.throws(()=>world.validateSpatialState(bad),/Invalid spatial/);}
 const equal=clone(s);equal.players[0].knowledge.events[0].at=20;equal.players[0].knowledge.events[0].observedAt=20;assert.equal(world.validateSpatialState(equal),true);
 const during=fixture();trace(during,'vent_enter',10);world.observe(during,20,record);assert.throws(()=>world.validateSpatialState(during),/Invalid spatial/,'Root validates only after closing checkpoint time');during.updatedAt=20;assert.equal(world.validateSpatialState(during),true);
});

test('restore rejects impossible fixed spectator attributes and unauthorized knowledge, while plain old cursor shape remains valid',()=>{
 const s=fixture();observe(s,10);for(const mutate of [x=>x.spatial.followPlayer='p6',x=>x.spatial.spectator.role='saboteur',x=>x.spatial.spectator.position={x:800.00000001,y:285},x=>x.spatial.spectator.position.z=0,x=>x.spatial.spectator.knowledge.roster[0].source='self',x=>x.spatial.spectator.knowledge.traceCursor=1]){const bad=clone(s);mutate(bad);assert.throws(()=>world.validateSpatialState(bad),/Invalid spatial/);}
 const old=clone(s);for(const p of old.players)delete p.knowledge.traceCursor;delete old.spatial.spectator.knowledge.traceCursor;assert.equal(world.validateSpatialState(old),true);
});
