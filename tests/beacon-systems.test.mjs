import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch} from '../server/engine/index.mjs';
import * as systems from '../server/engine/systems/index.mjs';
import {validateHatchNetwork} from '../server/engine/systems/model.mjs';
import {BEACON_DOORS,BEACON_VENTS,BEACON_REPAIRS,DEFAULT_BEACON_RULES} from '../shared/beacon.mjs';
import * as geometry from '../shared/world.mjs';

// Actual shared geometry and legacy match construction; positions/rules are explicit seeded unit fixtures.
// Injected context isolates systems permissions/lifecycle. It is not the future Core projection/HTTP integration.
function fixture(overrides={}){
 const state=createMatch({id:'beacon_systems_fixture',seed:'beacon-systems',world:true,now:100000});state.schemaVersion=3;state.beaconVersion=1;state.beaconRules={...DEFAULT_BEACON_RULES,...overrides};
 for(const p of state.players)p.cooldowns.sabotageAt=100000;systems.initializeSystems(state,100000);
 const records=[],events=[];
 const ctx={geometry,record(_s,type,at,data){records.push({type,at,...structuredClone(data)});},publicEvent(_s,type,at,data){events.push({type,at,...structuredClone(data)});},
  sees(s,p,target){const radius=s.systems.lights.active?(p.role==='saboteur'?s.beaconRules.saboteurVisionRadius:s.beaconRules.lightsVisionRadius):s.beaconRules.visionRadius;return geometry.distance(p.position,target)<=radius&&geometry.canSeeWorldPoint(p.position,target);},
  nearby(s,p,target,range=geometry.WORLD.interactionRadius){return geometry.distance(p.position,target)<=range&&ctx.sees(s,p,target);},
  stop(_s,p,at){Object.assign(p.motion,{manual:false,path:[],destination:null,at,leaseUntil:Math.min(p.motion.leaseUntil,at)});}
 };
 return {state,ctx,records,events,sab:state.players.find(p=>p.role==='saboteur'),crew:state.players.filter(p=>p.role==='crew')};
}
const place=(p,site)=>{p.position={...site.position};p.roomId=site.roomId;};
const apply=(f,p,a,now=100000)=>{assert.equal(systems.validateSystemAction(f.state,p,a,now,f.ctx),null);assert.equal(systems.applySystemAction(f.state,p,a,now,f.ctx),true);assert.equal(systems.validateSystemsState(f.state),true);};
const json=value=>JSON.parse(JSON.stringify(value));

test('systems initialization is bounded, serializable, roster generic and never overwrites a restored match',()=>{
 const f=fixture();assert.equal(systems.validateSystemsState(json(f.state)),true);assert.equal(systems.systemsDeadline(f.state),Infinity);const before=json(f.state);assert.throws(()=>systems.initializeSystems(f.state,100000),/existing/);assert.deepEqual(json(f.state),before);
 const g=fixture();delete g.state.systems;g.state.players[0].id='keeper-eight';g.state.players.push({...structuredClone(g.state.players[1]),id:'keeper-nine'});systems.initializeSystems(g.state,100000);assert.equal(systems.validateSystemsState(g.state),true);assert.equal(Object.keys(g.state.systems.cooldowns).length,7);
});

test('all five sabotage types accept legal saboteur input and reject crew, malformed, wrong-phase, dead and foreign actors without side effects',()=>{
 for(const kind of ['lights','communications','door','power','flood']){
  const f=fixture(),a={type:'systemSabotage',kind,targetId:kind==='door'?BEACON_DOORS[0].id:'beacon'};
  for(const [p,input]of [[f.crew[0],a],[f.sab,{...a,private:'no'}],[f.sab,{...a,targetId:'foreign'}],[{...f.sab},a],[f.sab,{...a,id:'bad id'}]]){const before=json(f.state);assert(systems.validateSystemAction(f.state,p,input,100000,f.ctx));assert.equal(systems.applySystemAction(f.state,p,input,100000,f.ctx),false);assert.deepEqual(json(f.state),before);}
  f.state.phase='discussion';assert.equal(systems.validateSystemAction(f.state,f.sab,a,100000,f.ctx).code,'WRONG_PHASE');f.state.phase='roam';f.sab.alive=false;assert.equal(systems.validateSystemAction(f.state,f.sab,a,100000,f.ctx).code,'PLAYER_DEAD');f.sab.alive=true;apply(f,f.sab,a);
  assert(f.events.every(event=>!('playerId'in event)&&!('visibleTo'in event)));assert.equal(f.records[0].playerId,f.sab.id);
 }
 for(const systemId of ['__proto__','constructor','unknown']){const f=fixture();assert(systems.validateSystemAction(f.state,f.crew[0],{type:'systemRepair',systemId,siteId:'x'},100000,f.ctx));}
});

test('lights changes visibility permission state, repairs physically, and expires at the original timestamp after JSON restore',()=>{
 const f=fixture();const site=BEACON_REPAIRS.lights[0];place(f.crew[0],site);const target={x:site.position.x+160,y:site.position.y};assert(f.ctx.sees(f.state,f.crew[0],target));apply(f,f.sab,{type:'systemSabotage',kind:'lights',targetId:'beacon'});assert(!f.ctx.sees(f.state,f.crew[0],target));assert.equal(systems.systemsDeadline(f.state),145000);
 apply(f,f.crew[0],{type:'systemRepair',systemId:'lights',siteId:site.id});assert(f.ctx.sees(f.state,f.crew[0],target));
 const g=fixture();apply(g,g.sab,{type:'systemSabotage',kind:'lights',targetId:'beacon'});const restored=json(g.state);assert.equal(systems.advanceSystems(restored,144999,g.ctx),false);assert.equal(systems.advanceSystems(restored,200000,g.ctx),true);assert.equal(restored.systems.lights.active,false);assert.equal(g.events.at(-1).at,145000);assert.equal(systems.advanceSystems(restored,200001,g.ctx),false);
});

test('communications blocks device status until one local crew repair or original expiry, with no other actor device access exposed',()=>{
 const f=fixture();apply(f,f.sab,{type:'systemSabotage',kind:'communications',targetId:'beacon'});assert.equal(systems.getSystemsView(f.state,null).communications.devicesBlocked,true);
 const repair={type:'systemRepair',systemId:'communications',siteId:'radio'};assert(systems.validateSystemAction(f.state,f.crew[0],repair,100000,f.ctx));place(f.crew[0],BEACON_REPAIRS.communications[0]);apply(f,f.crew[0],repair);assert.equal(systems.getSystemsView(f.state,f.crew[0].id).communications.devicesBlocked,false);
 const g=fixture();apply(g,g.sab,{type:'systemSabotage',kind:'communications',targetId:'beacon'});systems.advanceSystems(g.state,135000,g.ctx);assert.equal(g.state.systems.communications.active,false);assert.equal(g.events.at(-1).at,135000);
});

test('doors enforce a finite concurrency cap, physical local reopening and automatic expiry',()=>{
 const f=fixture({auxiliaryCooldownMs:1});for(let i=0;i<2;i++)apply(f,f.sab,{type:'systemSabotage',kind:'door',targetId:BEACON_DOORS[i].id},100000+i);
 assert.equal(systems.validateSystemAction(f.state,f.sab,{type:'systemSabotage',kind:'door',targetId:BEACON_DOORS[2].id},100002,f.ctx).code,'SYSTEM_LIMIT');
 const d=BEACON_DOORS[0],p=f.crew[0];p.position={x:d.x-20,y:d.y+d.height/2};p.roomId='archive';const a={type:'systemRepair',systemId:'door',siteId:d.id};apply(f,p,a,100002);assert.equal(f.state.systems.doors[0].closed,false);assert.equal(f.state.systems.doors[1].closed,true);assert.equal(systems.systemsDeadline(f.state),112001);systems.advanceSystems(f.state,200000,f.ctx);assert(f.state.systems.doors.every(d=>!d.closed));assert.equal(f.events.at(-1).at,112001);
});

test('power and flood require two distinct crew at distinct immutable sites; exact critical deadline rejects the repair',()=>{
 for(const kind of ['power','flood']){
  const f=fixture(),sites=BEACON_REPAIRS[kind];apply(f,f.sab,{type:'systemSabotage',kind,targetId:'beacon'});assert.equal(f.state.sabotage.kind,kind);assert.equal(f.state.sabotage.roomId,sites[0].roomId);assert.equal(systems.systemsDeadline(f.state),Infinity);
  assert.equal(systems.validateSystemAction(f.state,f.sab,{type:'systemSabotage',kind:kind==='power'?'flood':'power',targetId:'beacon'},100000,f.ctx).code,'CRITICAL_ACTIVE');
  const repair=i=>({type:'systemRepair',systemId:kind,siteId:sites[i].id});place(f.sab,sites[0]);assert(systems.validateSystemAction(f.state,f.sab,repair(0),100000,f.ctx));place(f.crew[0],sites[0]);apply(f,f.crew[0],repair(0),100001);place(f.crew[0],sites[1]);assert(systems.validateSystemAction(f.state,f.crew[0],repair(1),100002,f.ctx));place(f.crew[1],sites[1]);
  assert.equal(systems.validateSystemAction(f.state,f.crew[1],repair(1),175000,f.ctx).code,'CRITICAL_EXPIRED');apply(f,f.crew[1],repair(1),174999);assert.equal(f.state.sabotage.active,false);assert.equal(f.state.sabotage.repairsCompleted,2);assert.equal(new Set(f.state.sabotage.repairers).size,2);
  const view=systems.getSystemsView(f.state,null);assert(!JSON.stringify(view).includes('repairedBy'));assert(!JSON.stringify(view).includes('repairers'));
 }
});

test('legacy sabotage and repair aliases select power and only a permitted nearby critical site',()=>{
 const f=fixture();apply(f,f.sab,{type:'sabotage'});assert.equal(f.state.sabotage.kind,'power');place(f.crew[0],BEACON_REPAIRS.power[0]);apply(f,f.crew[0],{type:'repair'});assert.equal(f.state.sabotage.repairsCompleted,1);assert(systems.validateSystemAction(f.state,f.crew[0],{type:'repair'},100000,f.ctx));
});

test('hatch network rejects dangling, duplicate, nonreciprocal, self, unwalkable and unsafe fixture topology',()=>{
 assert.equal(validateHatchNetwork(BEACON_VENTS),true);
 for(const change of [n=>n.push(n[0]),n=>{n[0].links=['missing'];},n=>{n[0].links=[n[0].id];},n=>{n[0].links=[];},n=>{n[0].links=[n[1].id,n[1].id];},n=>{n[0].position={x:0,y:0};},n=>{n[0].roomId='foreign';},n=>{n[0].private=true;}]){const network=json(BEACON_VENTS);change(network);assert.throws(()=>validateHatchNetwork(network));}
 const network=json(BEACON_VENTS);network[1].links=network[1].links.filter(id=>id!==network[0].id);assert.throws(()=>validateHatchNetwork(network));
});

test('hatch entry/arrival/cooldown survive restart and expose only locally witnessed entry or exit, never global route attribution',()=>{
 const f=fixture(),entry=BEACON_VENTS[0],exit=BEACON_VENTS[2];place(f.sab,entry);place(f.crew[0],entry);place(f.crew[1],exit);const origin={...f.sab.position},a={type:'vent',entryId:entry.id,exitId:exit.id};apply(f,f.sab,a);
 assert.deepEqual(f.sab.position,origin);assert.equal(f.records[0].type,'vent_enter');assert(f.records[0].visibleTo.includes(f.crew[0].id));assert(!f.records[0].visibleTo.includes(f.crew[1].id));assert(!('exitId'in f.records[0]));assert.equal(f.events.length,0);assert(systems.getSystemsView(f.state,f.sab.id).selfTransit);assert.equal(systems.getSystemsView(f.state,f.crew[0].id).selfTransit,null);assert.equal(systems.getSystemsView(f.state,null).selfTransit,null);
 const restored=json(f.state);assert.equal(systems.validateSystemsState(restored),true);assert.equal(systems.advanceSystems(restored,101599,f.ctx),false);assert.equal(systems.advanceSystems(restored,101600,f.ctx),true);const p=restored.players.find(p=>p.id===f.sab.id);assert.deepEqual(p.position,exit.position);assert.equal(p.roomId,exit.roomId);assert.equal(f.records.at(-1).type,'vent_exit');assert(f.records.at(-1).visibleTo.includes(f.crew[1].id));assert(!f.records.at(-1).visibleTo.includes(f.crew[0].id));assert(!('entryId'in f.records.at(-1)));assert.equal(systems.validateSystemsState(restored),true);
 const back={type:'vent',entryId:exit.id,exitId:entry.id};assert.equal(systems.validateSystemAction(restored,p,back,101601,f.ctx).code,'COOLDOWN');assert.equal(systems.validateSystemAction(restored,p,back,116600,f.ctx),null);
});

test('hatches deny crew, distant, invisible, invalid route, repeated/in-transit and inactive-phase attempts',()=>{
 const f=fixture(),entry=BEACON_VENTS[0],exit=BEACON_VENTS[1],a={type:'vent',entryId:entry.id,exitId:exit.id};place(f.crew[0],entry);assert(systems.validateSystemAction(f.state,f.crew[0],a,100000,f.ctx));assert(systems.validateSystemAction(f.state,f.sab,a,100000,f.ctx));place(f.sab,entry);assert(systems.validateSystemAction(f.state,f.sab,{...a,exitId:entry.id},100000,f.ctx));assert(systems.validateSystemAction(f.state,f.sab,{...a,entryId:'foreign'},100000,f.ctx));assert(systems.validateSystemAction(f.state,f.sab,a,100000,{...f.ctx,sees:()=>false}));apply(f,f.sab,a);assert.equal(systems.validateSystemAction(f.state,f.sab,a,100001,f.ctx).code,'IN_TRANSIT');
});

test('council cancels transit in place without refund, reopens doors, and terminal phase clears auxiliary clocks',()=>{
 const f=fixture({auxiliaryCooldownMs:1});apply(f,f.sab,{type:'systemSabotage',kind:'lights',targetId:'beacon'});apply(f,f.sab,{type:'systemSabotage',kind:'door',targetId:BEACON_DOORS[0].id},100001);place(f.sab,BEACON_VENTS[0]);const origin={...f.sab.position};apply(f,f.sab,{type:'vent',entryId:BEACON_VENTS[0].id,exitId:BEACON_VENTS[1].id},100002);const cooldown=f.state.systems.cooldowns[f.sab.id].ventAt;
 assert.equal(systems.onSystemsPhaseChange(f.state,'discussion',100003,f.ctx),true);f.state.phase='discussion';assert.deepEqual(f.sab.position,origin);assert.equal(Object.keys(f.state.systems.transit).length,0);assert.equal(f.state.systems.cooldowns[f.sab.id].ventAt,cooldown);assert(f.state.systems.lights.active);assert(f.state.systems.doors.every(d=>!d.closed));assert.deepEqual(f.records.at(-1).visibleTo,[f.sab.id]);assert.equal(systems.validateSystemsState(f.state),true);
 systems.onSystemsPhaseChange(f.state,'ended',100004,f.ctx);f.state.phase='ended';assert.equal(systems.systemsDeadline(f.state),Infinity);assert.equal(f.state.systems.lights.active,false);assert.equal(systems.onSystemsPhaseChange(f.state,'ended',100005,f.ctx),false);
});

test('hints are side-effect-free exact permitted actions, projections are defensive and private state is never global',()=>{
 const f=fixture();place(f.sab,BEACON_VENTS[0]);const before=json(f.state),hints=systems.systemActionHints(f.state,f.sab,100000,f.ctx);assert(hints.some(h=>h.type==='vent'));for(const h of hints)assert.equal(systems.validateSystemAction(f.state,f.sab,{type:h.type,...h.fields},100000,f.ctx),null);assert.deepEqual(json(f.state),before);assert.equal(f.events.length,0);assert.equal(f.records.length,0);assert(!systems.systemActionHints(f.state,f.crew[0],100000,f.ctx).some(h=>h.type==='vent'||h.type==='systemSabotage'));
 const view=systems.getSystemsView(f.state,f.sab.id);view.cooldowns.ventAt=999;view.doors[0].closed=true;assert.deepEqual(json(f.state),before);assert.equal(systems.getSystemsView(f.state,null).cooldowns,null);
});

test('strict restored-state validation rejects malformed timers, cooldowns, private extra fields, sites and transit without mutating',()=>{
 const f=fixture();apply(f,f.sab,{type:'systemSabotage',kind:'power',targetId:'beacon'});
 for(const change of [s=>{s.systems.private=true;},s=>{s.systems.lights.active='yes';},s=>{s.systems.cooldowns[f.sab.id].ventAt=Infinity;},s=>{s.systems.cooldowns[f.sab.id].private=true;},s=>{s.systems.doors.pop();},s=>{s.systems.doors[0].deadlineAt=100001;},s=>{s.sabotage.kind='unknown';},s=>{s.sabotage.sites[0].position.x++;},s=>{s.sabotage.sites[0].progress=2;},s=>{s.sabotage.repairers=[f.sab.id];},s=>{s.systems.transit.foreign={};}]){const bad=structuredClone(f.state);change(bad);const before=structuredClone(bad);assert.throws(()=>systems.validateSystemsState(bad));assert.deepEqual(bad,before);}
 const g=fixture();place(g.sab,BEACON_VENTS[0]);apply(g,g.sab,{type:'vent',entryId:BEACON_VENTS[0].id,exitId:BEACON_VENTS[1].id});for(const change of [s=>{s.systems.transit[g.sab.id].exitId='foreign';},s=>{s.systems.transit[g.sab.id].deadlineAt++;},s=>{s.systems.transit[g.sab.id].origin.x++;},s=>{s.phase='discussion';},s=>{s.players.find(p=>p.id===g.sab.id).motion.manual=true;}]){const bad=json(g.state);change(bad);assert.throws(()=>systems.validateSystemsState(bad));}
});