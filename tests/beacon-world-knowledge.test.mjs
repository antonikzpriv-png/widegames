import test from 'node:test';import assert from 'node:assert/strict';import * as geometry from '../shared/world.mjs';import {createSpatialWorld} from '../server/engine/world/index.mjs';import {DEFAULT_BEACON_RULES} from '../shared/beacon.mjs';
const world=createSpatialWorld(geometry),clone=s=>JSON.parse(JSON.stringify(s));
// Isolated module fixtures: positions/deaths/replay records represent engine-cloned
// authoritative state. No provider, fabricated match outcome or client state input.
function fixture(){const s={schemaVersion:3,worldVersion:1,beaconVersion:1,phase:'roam',beaconRules:{...DEFAULT_BEACON_RULES},players:['p1','p2','p3','p4','p5','p6'].map((id,i)=>({id,name:id,color:'red',role:i===5?'saboteur':'crew',alive:true})),systems:{doors:[],lights:{active:false},transit:{}},bodies:[],replay:[],replaySequence:0};world.initialize(s,0);for(const p of s.players){p.position={x:1430,y:960};p.roomId='engine';}s.players[0].position={x:620,y:300};s.players[0].roomId='bridge';return s;}
const record=(s,type,at,data)=>s.replay.push({id:'r'+ ++s.replaySequence,type,at,...data});
const observe=(s,now)=>world.observe(s,now,record);
const row=(s,viewer,target)=>world.projectWorld(s,viewer,10000).players.find(p=>p.id===target);
function death(s,id,at){const p=s.players.find(p=>p.id===id);p.alive=false;s.bodies.push({id:'body-'+id,playerId:id,position:{...p.position},roomId:p.roomId,at,reported:false});}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}

test('unseen death stays unknown, and last seen living stays alive until real local discovery',()=>{
 const s=fixture();observe(s,0);assert.equal(row(s,'p1','p2').status,'unknown');death(s,'p2',10);observe(s,20);assert.deepEqual({status:row(s,'p1','p2').status,alive:row(s,'p1','p2').alive,position:row(s,'p1','p2').position},{status:'unknown',alive:null,position:null});assert.equal(world.projectWorld(s,'p1',20).localEvents.some(e=>e.type==='body'),false);
 const last=fixture();last.players[1].position={x:660,y:300};last.players[1].roomId='bridge';observe(last,0);assert.equal(row(last,'p1','p2').status,'alive');last.players[1].position={x:1430,y:960};last.players[1].roomId='engine';death(last,'p2',10);observe(last,20);assert.equal(row(last,'p1','p2').status,'alive');assert.equal(row(last,'p1','p2').alive,true);assert.equal(row(last,'p1','p2').position,null);
 last.players[0].position={x:1370,y:960};last.players[0].roomId='engine';observe(last,500);assert.equal(row(last,'p1','p2').status,'dead');const body=world.projectWorld(last,'p1',500).localEvents.find(e=>e.type==='body');assert.equal(body.at,10);assert.equal(body.observedAt,500);assert.equal(body.playerId,'p2');assert.equal(Object.hasOwn(body,'role'),false);assert.equal(Object.hasOwn(body,'killerId'),false);assert.deepEqual(body.position,{x:1430,y:960});
});

test('fixed Bridge spectator does not follow player/vent routes or learn remote unseen death before end',()=>{
 const s=fixture();observe(s,0);const origin=world.projectWorld(s,null,0).vision.origin;assert.deepEqual(origin,{x:800,y:285});death(s,'p2',10);s.players[0].position={x:1430,y:960};s.players[0].roomId='engine';s.systems.transit.p6={entryId:'archive-hatch',exitId:'lantern-hatch',deadlineAt:2000};observe(s,20);
 const view=world.projectWorld(s,null,20);assert.deepEqual(view.vision.origin,origin);assert.equal(view.players.find(p=>p.id==='p2').alive,null);assert.equal(view.players.find(p=>p.id==='p6').position,null);assert.equal(view.players.some(p=>Object.hasOwn(p,'role')||Object.hasOwn(p,'transit')||Object.hasOwn(p,'motion')),false);assert.equal(view.localEvents.some(e=>e.playerId==='p2'||e.type==='vent'),false);
 s.phase='ended';const ended=world.projectWorld(s,null,30);assert.equal(ended.players.find(p=>p.id==='p2').status,'dead');assert.ok(ended.players.every(p=>p.position&&['crew','saboteur'].includes(p.role)));assert.equal(ended.vision.mode,'reveal');
});

test('solid props, closed doors and darkness block body knowledge instead of leaking close deaths',()=>{
 const prop=fixture();prop.players[0].position={x:800,y:280};prop.players[1].position={x:800,y:130};prop.players[1].roomId='bridge';death(prop,'p2',0);observe(prop,10);assert.equal(row(prop,'p1','p2').status,'unknown');assert.equal(row(prop,null,'p2').status,'unknown');
 const door=fixture();door.players[0].position={x:560,y:490};door.players[1].position={x:500,y:490};door.players[1].roomId='archive';door.systems.doors=[{id:'west-upper',closed:true}];death(door,'p2',0);observe(door,10);assert.equal(row(door,'p1','p2').status,'unknown');door.systems.doors[0].closed=false;observe(door,20);assert.equal(row(door,'p1','p2').status,'dead');
 const lights=fixture();lights.players[0].position={x:150,y:450};lights.players[1].position={x:350,y:450};lights.players[1].roomId='archive';lights.players[5].position={x:150,y:450};lights.systems.lights.active=true;death(lights,'p2',0);observe(lights,10);assert.equal(row(lights,'p1','p2').status,'unknown');assert.equal(row(lights,'p6','p2').status,'dead');lights.systems.lights.active=false;observe(lights,20);assert.equal(row(lights,'p1','p2').status,'dead');
});

test('only authorized witness retains attribution, persisted cursors prevent replay after bounded event eviction',()=>{
 const s=fixture();s.beaconRules.observationLimit=1;death(s,'p2',10);record(s,'witness',10,{playerId:'p6',targetId:'p2',roomId:'engine',position:{x:1430,y:960},visibleTo:['p1']});observe(s,20);
 const witness=world.projectWorld(s,'p1',20).localEvents[0];assert.equal(witness.type,'witness');assert.equal(witness.playerId,'p6');assert.equal(witness.targetId,'p2');assert.equal(Object.hasOwn(witness,'visibleTo'),false);assert.equal(row(s,null,'p2').status,'unknown');assert.equal(row(s,'p1','p2').status,'dead');assert.equal(world.projectWorld(s,'p3',20).localEvents.some(e=>e.type==='witness'),false);
 const restored=clone(s),before=restored.players[0].knowledge.sequence;observe(restored,30);assert.equal(restored.players[0].knowledge.sequence,before);restored.phase='discussion';restored.meeting={id:'m1'};observe(restored,40);assert.equal(restored.players[0].knowledge.events[0].type,'muster');restored.phase='roam';observe(restored,50);assert.equal(restored.players[0].knowledge.events[0].type,'muster');assert.equal(restored.players[0].knowledge.events.length,1);assert.ok(restored.replay.filter(e=>e.type==='observation'&&e.observation.type==='witness').every(e=>JSON.stringify(e.visibleTo)==='["p1"]'));
});

test('meeting muster discloses dead roster without remote positions, and is recorded once per council',()=>{
 const s=fixture();s.players[2].position={x:660,y:300};s.players[2].roomId='bridge';death(s,'p2',0);observe(s,10);assert.equal(row(s,'p1','p2').status,'unknown');s.phase='discussion';s.meeting={id:'m1'};observe(s,20);
 for(const id of ['p1','p3',null]){assert.equal(row(s,id,'p2').status,'dead');assert.equal(row(s,id,'p2').position,null);assert.equal(world.projectWorld(s,id,20).players.some(p=>Object.hasOwn(p,'role')),false);}
 const count=s.replay.filter(e=>e.type==='observation'&&e.observation.type==='muster').length;s.phase='voting';observe(s,30);assert.equal(s.replay.filter(e=>e.type==='observation'&&e.observation.type==='muster').length,count);s.phase='roam';observe(s,40);assert.equal(row(s,'p1','p2').status,'dead');
});

test('owner-only normalized vitals changes no other knowledge, has no position/role and cannot resurrect known death',()=>{
 const s=fixture();s.players[2].position={x:660,y:300};s.players[2].roomId='bridge';death(s,'p2',10);observe(s,20);assert.equal(world.adoptVitals(s,'p1',{at:15,players:[{id:'p2',alive:false}]},30,record),true);
 assert.equal(row(s,'p1','p2').status,'dead');assert.equal(row(s,'p3','p2').status,'unknown','owner sample must not disclose to another remote keeper');assert.equal(row(s,null,'p2').status,'unknown');assert.equal(row(s,'p1','p2').position,null);
 observe(s,40);assert.equal(row(s,'p3','p2').status,'unknown');
 assert.equal(world.adoptVitals(s,'p1',{at:50,players:[{id:'p2',alive:true}]},60,record),false);assert.equal(row(s,'p1','p2').status,'dead');
 for(const sample of [{at:500,players:[{id:'p2',alive:false}]},{at:50,players:[{id:'p1',alive:false}]},{at:50,players:[{id:'absent',alive:false}]},{at:50,players:[{id:'p2',alive:false,role:'crew'}]}])assert.equal(world.adoptVitals(s,'p1',sample,60,record),false);
 const vitals=world.projectWorld(s,'p1',60).localEvents.find(e=>e.type==='vitals');assert.deepEqual(Object.keys(vitals.players[0]).sort(),['alive','id']);assert.ok(s.replay.filter(e=>e.observation?.type==='vitals').every(e=>JSON.stringify(e.visibleTo)==='["p1"]'));
});

test('projection copies are defensive, do not mutate frozen state and reject unknown viewers',()=>{
 const s=fixture();s.players[1].position={x:660,y:300};s.players[1].roomId='bridge';death(s,'p2',0);observe(s,10);const before=clone(s),view=world.projectWorld(freeze(s),'p1',20);view.players.find(p=>p.id==='p2').position.x=-1;view.localEvents[0].position.x=-1;view.vision.origin.x=-1;assert.deepEqual(s,before);assert.deepEqual(world.projectWorld(s,'p1',20).players.find(p=>p.id==='p2').position,{x:660,y:300});assert.throws(()=>world.projectWorld(s,'foreign',20),/Unknown spatial viewer/);
});

test('bounded serialized knowledge validates; malformed motion/knowledge fail closed without mutation',()=>{
 const s=fixture();observe(s,0);assert.equal(world.validateSpatialState(s),true);assert.equal(world.validateSpatialState(clone(s)),true);const p=s.players[0];const before=clone(p);for(const request of [{seq:1,dx:.2,dy:0},{seq:0,dx:0,dy:0},{seq:1,dx:1,dy:0,speed:999}])assert.throws(()=>world.input(p,request,1),/Invalid spatial input/);assert.deepEqual(p,before);
 world.input(p,{seq:1,dx:1,dy:0},1);const moved=clone(p);assert.equal(world.input(p,{seq:1,dx:-1,dy:0},1),false);assert.deepEqual(p,moved);
 for(const mutate of [x=>x.players[0].motion.dx=.5,x=>x.players[0].knowledge.roster.pop(),x=>x.players[0].knowledge.events=Array.from({length:65},()=>({type:'witness',at:0})),x=>x.spatial.spectator.position.x=1430]){const bad=clone(s);mutate(bad);assert.throws(()=>world.validateSpatialState(bad),/Invalid spatial/);}
});


test('actual investigation-native vitals sample is adopted only by its encoded owner and remains unchanged',()=>{
 const s=fixture();s.players[2].position={x:660,y:300};s.players[2].roomId='bridge';death(s,'p2',10);observe(s,20);
 const sample={id:'obs:p1:vitals:25',deviceId:'vitals',kind:'vitals',at:25,data:{players:s.players.map(p=>({id:p.id,status:p.alive?'alive':'dead'}))}},before=clone(sample);
 s.investigation={version:1,sessions:{},cooldowns:{},observations:{p1:[sample]}};observe(s,30);
 assert.equal(row(s,'p1','p2').status,'dead');assert.equal(row(s,'p3','p2').status,'unknown');assert.equal(row(s,null,'p2').status,'unknown');assert.deepEqual(sample,before);assert.equal(world.validateSpatialState(s),true);
 const fresh=fixture();fresh.players[2].position={x:660,y:300};fresh.players[2].roomId='bridge';death(fresh,'p2',10);fresh.investigation={observations:{p3:[sample]}};observe(fresh,30);assert.equal(row(fresh,'p3','p2').status,'unknown','cross-owner sample ID must not be adopted');
});

test('100 muster observations remain bounded and serialization preserves knowledge without idle writes',()=>{
 const s=fixture();for(let council=1;council<=100;council++){s.phase='discussion';s.meeting={id:'meeting-'+council};observe(s,council*100);s.phase='roam';observe(s,council*100+1);}
 for(const p of s.players)assert.equal(p.knowledge.events.length,64);assert.equal(s.spatial.spectator.knowledge.events.length,64);const saved=clone(s);assert.equal(world.validateSpatialState(saved),true);assert.deepEqual(world.projectWorld(saved,'p1',10001),world.projectWorld(s,'p1',10001));const before=clone(saved);assert.equal(observe(saved,10002),false);assert.deepEqual(saved,before);
});
