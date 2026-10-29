import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch} from '../server/engine/index.mjs';
import * as systems from '../server/engine/systems/index.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {TACTICAL_PRESET} from '../shared/tactical.mjs';
import {DEFAULT_BEACON_RULES} from '../shared/beacon.mjs';
const start=100000,json=value=>JSON.parse(JSON.stringify(value));
// Seeded module fixture: actual legacy constructor/immutable map, explicit two-saboteur role setup.
// Root schema4 orchestration/HTTP/idempotency is coordinator-owned and not simulated as a passing integration.
function fixture({map,beaconRules={},legacy=false}={}){
 const descriptor=getMap(map),geo=descriptor.geometry,state=createMatch({id:'tactical-systems-fixture',world:true,now:start,seed:'tactical-systems'});
 Object.assign(state,{schemaVersion:legacy?3:4,beaconVersion:1,beaconRules:{...DEFAULT_BEACON_RULES,...beaconRules}});
 if(!legacy)Object.assign(state,{tacticalVersion:1,map:{id:descriptor.id,version:descriptor.version},preset:{id:'tactical',version:1}});
 state.players.forEach((p,i)=>{p.role=i<2?'saboteur':'crew';p.cooldowns.sabotageAt=start;});
 const events=[],records=[],stops=[],ctx={geometry:geo,
  record(_s,type,at,data){records.push({type,at,...structuredClone(data)});},publicEvent(_s,type,at,data){events.push({type,at,...structuredClone(data)});},
  sees(s,p,target){const radius=s.systems.lights.active&&p.role!=='saboteur'?s.beaconRules.lightsVisionRadius:p.role==='saboteur'?s.beaconRules.saboteurVisionRadius:s.beaconRules.visionRadius;return geo.distance(p.position,target)<=radius&&geo.canSeeWorldPoint(p.position,target);},
  nearby(s,p,target,range=geo.WORLD.interactionRadius){return geo.distance(p.position,target)<=range;},
  stop(_s,p,at,reason){stops.push({id:p.id,at,reason});Object.assign(p.motion,{manual:false,path:[],destination:null,at,leaseUntil:Math.min(p.motion.leaseUntil,at)});}
 };systems.initializeSystems(state,start);return {state,ctx,events,records,stops,map:descriptor,sabs:state.players.slice(0,2),crew:state.players.slice(2)};
}
const sabotage=(kind,targetId='beacon')=>({type:'systemSabotage',kind,targetId});
const repair=(kind,siteId)=>({type:'systemRepair',systemId:kind,siteId});
const place=(p,site)=>{p.position={...site.position};p.roomId=site.roomId;};
function apply(f,p,a,at=start){assert.equal(systems.validateSystemAction(f.state,p,a,at,f.ctx),null);assert.equal(systems.applySystemAction(f.state,p,a,at,f.ctx),true);assert.equal(systems.validateSystemsState(json(f.state)),true);}
function restored(f){f.state=json(f.state);f.sabs=f.state.players.filter(p=>p.role==='saboteur');f.crew=f.state.players.filter(p=>p.role==='crew');return f;}
const panel=(f,d)=>({position:d.width<d.height?{x:d.x-f.ctx.geometry.WORLD.bodyRadius-4,y:d.y+d.height/2}:{x:d.x+d.width/2,y:d.y-f.ctx.geometry.WORLD.bodyRadius-4},roomId:d.roomId});

test('tactical version2 has strict shared faction clocks and personal passage clocks; absent map preserves version1',()=>{
 const f=fixture();assert.equal(f.state.systems.version,2);assert.deepEqual(f.state.systems.factionCooldowns,{saboteur:{criticalAt:start,auxiliaryAt:start}});assert.deepEqual(f.state.systems.cooldowns[f.sabs[0].id],{ventAt:start});assert.equal(systems.systemsDeadline(f.state),Infinity);
 const legacy=fixture({legacy:true});assert.equal(legacy.state.map,undefined);assert.equal(legacy.state.systems.version,1);assert.equal(legacy.state.systems.factionCooldowns,undefined);assert.deepEqual(legacy.state.systems.doors[0],{id:'west-upper',closed:false,startedAt:null,deadlineAt:null});
 const before=json(f.state);assert.throws(()=>systems.initializeSystems(f.state,start));assert.deepEqual(json(f.state),before);
 const initial=createMatch({id:'initial-cooldown',world:true,now:start,seed:'initial'});Object.assign(initial,{schemaVersion:4,tacticalVersion:1,map:{id:'beacon',version:1},preset:{id:'tactical',version:1},beaconRules:{...DEFAULT_BEACON_RULES}});systems.initializeSystems(initial,start);assert.equal(initial.systems.factionCooldowns.saboteur.criticalAt,start+initial.rules.sabotageCooldownMs);
});

test('two saboteurs share auxiliary and critical cooldowns without blocking independent personal passages',()=>{
 const f=fixture();apply(f,f.sabs[0],sabotage('lights'));assert.equal(systems.validateSystemAction(f.state,f.sabs[1],sabotage('communications'),start+19999,f.ctx).code,'COOLDOWN');apply(f,f.sabs[1],sabotage('communications'),start+20000);
 apply(f,f.sabs[0],sabotage('power'),start+20000);assert.equal(systems.validateSystemAction(f.state,f.sabs[1],sabotage('flood'),start+20000,f.ctx).code,'CRITICAL_ACTIVE');
 for(const [i,p]of f.sabs.entries()){const entry=f.map.fixtures.vents[i];place(p,entry);apply(f,p,{type:'vent',entryId:entry.id,exitId:entry.links[0]},start+20000);}
 assert.equal(Object.keys(f.state.systems.transit).length,2);assert(f.state.systems.lights.active&&f.state.systems.communications.active&&f.state.sabotage.active);
 for(const [i,site]of f.map.fixtures.repairs.power.entries()){place(f.crew[i],site);apply(f,f.crew[i],repair('power',site.id),start+20001);}
 assert.equal(systems.validateSystemAction(f.state,f.sabs[1],sabotage('flood'),start+20002,f.ctx).code,'IN_TRANSIT');systems.advanceSystems(f.state,start+21600,f.ctx);
 assert.equal(systems.validateSystemAction(f.state,f.sabs[1],sabotage('flood'),start+84999,f.ctx).code,'COOLDOWN');apply(f,f.sabs[1],sabotage('flood'),start+85000);
 assert.equal(f.state.systems.factionCooldowns.saboteur.criticalAt,start+150000);assert(f.sabs.every(p=>p.cooldowns.sabotageAt===start+150000));
});

test('clear door warns for exactly one second, closes without displacement, physically reopens and auto expires at original time',()=>{
 const f=fixture(),door=f.map.fixtures.doors[0];apply(f,f.sabs[0],sabotage('door',door.id));const d=f.state.systems.doors[0];assert.equal(d.status,'pending');assert.equal(d.closed,false);assert.equal(systems.systemsDeadline(f.state),start+TACTICAL_PRESET.doorGraceMs);
 assert.equal(systems.advanceSystems(f.state,start+999,f.ctx),false);const positions=f.state.players.map(p=>json(p.position));assert(systems.advanceSystems(f.state,start+1000,f.ctx));assert.equal(d.status,'closed');assert.equal(d.closed,true);assert.deepEqual(f.state.players.map(p=>p.position),positions);assert.equal(f.stops.length,0);assert.equal(d.deadlineAt,start+13000);assert.equal(systems.systemsDeadline(f.state),start+13000);
 place(f.crew[0],panel(f,door));apply(f,f.crew[0],repair('door',door.id),start+1001);assert.equal(d.status,'open');assert.equal(d.closeAt,null);assert.equal(systems.systemsDeadline(f.state),Infinity);
 const g=fixture();apply(g,g.sabs[0],sabotage('door',door.id));restored(g);systems.advanceSystems(g.state,start+13000,g.ctx);assert.equal(g.state.systems.doors[0].status,'open');assert.deepEqual(g.events.slice(-2).map(e=>[e.at,e.active]),[[start+1000,true],[start+13000,false]]);assert.equal(systems.validateSystemsState(g.state),true);
});

test('occupied or tangent threshold jams open once; hidden occupant does not change permission/hints or reveal identity',()=>{
 for(const offset of [0,-14]){
  const f=fixture(),door=f.map.fixtures.doors[0],occupant=f.crew[0];occupant.position={x:door.x+offset,y:door.y+door.height/2};const before=json(f.state),hints=systems.systemActionHints(f.state,f.sabs[0],start,f.ctx);
  const unoccupied=json(f.state);unoccupied.players.find(p=>p.id===occupant.id).position={x:800,y:285};assert.deepEqual(systems.systemActionHints(unoccupied,unoccupied.players[0],start,f.ctx),hints);assert.deepEqual(json(f.state),before);
  apply(f,f.sabs[0],sabotage('door',door.id));const position=json(occupant.position);systems.advanceSystems(f.state,start+1000,f.ctx);const d=f.state.systems.doors[0];assert.equal(d.status,'jammed');assert.equal(d.closed,false);assert.deepEqual(occupant.position,position);assert.equal(f.stops.length,0);assert.equal(systems.systemsDeadline(f.state),start+13000);
  occupant.position={x:800,y:285};assert.equal(systems.advanceSystems(f.state,start+2000,f.ctx),false);assert.equal(d.status,'jammed');assert(!JSON.stringify(systems.getSystemsView(f.state,null)).includes(occupant.id));assert(f.events.every(e=>!('playerId'in e)&&!('visibleTo'in e)&&!('occupants'in e)));
  restored(f);systems.advanceSystems(f.state,start+13000,f.ctx);assert.equal(f.state.systems.doors[0].status,'open');assert.equal(systems.systemsDeadline(f.state),Infinity);assert.equal(systems.validateSystemsState(f.state),true);
 }
});

test('pending, closed and jammed reservations count toward max two doors; same-time duplicate cannot consume or extend twice',()=>{
 const f=fixture({beaconRules:{auxiliaryCooldownMs:1}}),doors=f.map.fixtures.doors;apply(f,f.sabs[0],sabotage('lights'));apply(f,f.sabs[1],sabotage('communications'),start+1);apply(f,f.sabs[0],sabotage('power'),start+1);
 for(let i=0;i<2;i++)apply(f,f.sabs[i],sabotage('door',doors[i].id),start+2+i);
 const before=json(f.state);assert.equal(systems.applySystemAction(f.state,f.sabs[0],sabotage('door',doors[1].id),start+3,f.ctx),false);assert.deepEqual(json(f.state),before);assert.equal(systems.validateSystemAction(f.state,f.sabs[0],sabotage('door',doors[2].id),start+4,f.ctx).code,'SYSTEM_LIMIT');
 assert(f.state.sabotage.active&&f.state.systems.lights.active&&f.state.systems.communications.active);place(f.crew[0],panel(f,doors[0]));apply(f,f.crew[0],repair('door',doors[0].id),start+4);apply(f,f.sabs[0],sabotage('door',doors[2].id),start+5);assert.equal(f.state.systems.doors.filter(d=>d.status==='pending').length,2);
});

for(const kind of ['power','flood'])test('tactical '+kind+' requires distinct living local crew/site contributions, restart and exact deadline',()=>{
 const f=fixture(),sites=f.map.fixtures.repairs[kind];apply(f,f.sabs[0],sabotage(kind));place(f.crew[0],sites[0]);apply(f,f.crew[0],repair(kind,sites[0].id),start+1);const before=json(f.state);assert.equal(systems.applySystemAction(f.state,f.crew[1],repair(kind,sites[0].id),start+1,f.ctx),false);assert.deepEqual(json(f.state),before);
 restored(f);place(f.crew[0],sites[1]);assert(systems.validateSystemAction(f.state,f.crew[0],repair(kind,sites[1].id),start+2,f.ctx));place(f.crew[1],sites[1]);f.crew[1].alive=false;assert.equal(systems.validateSystemAction(f.state,f.crew[1],repair(kind,sites[1].id),start+2,f.ctx).code,'PLAYER_DEAD');f.crew[1].alive=true;
 assert.equal(systems.validateSystemAction(f.state,f.crew[1],repair(kind,sites[1].id),start+75000,f.ctx).code,'CRITICAL_EXPIRED');apply(f,f.crew[1],repair(kind,sites[1].id),start+74999);assert.equal(f.state.sabotage.active,false);assert.equal(new Set(f.state.sabotage.repairers).size,2);assert(!JSON.stringify(systems.getSystemsView(f.state,null)).includes('repairedBy'));
});

test('meeting at closure boundary cancels warning and passages in place but retains critical/aux clocks; terminal clears effects',()=>{
 const f=fixture({beaconRules:{auxiliaryCooldownMs:1}}),door=f.map.fixtures.doors[0],entry=f.map.fixtures.vents[0];apply(f,f.sabs[0],sabotage('door',door.id));apply(f,f.sabs[1],sabotage('lights'),start+1);apply(f,f.sabs[1],sabotage('power'),start+1);place(f.sabs[0],entry);const origin=json(f.sabs[0].position);apply(f,f.sabs[0],{type:'vent',entryId:entry.id,exitId:entry.links[0]},start+1);const ventAt=f.state.systems.cooldowns[f.sabs[0].id].ventAt,critical=json(f.state.sabotage);
 systems.onSystemsPhaseChange(f.state,'discussion',start+1000,f.ctx);f.state.phase='discussion';assert.equal(f.state.systems.doors[0].status,'open');assert.deepEqual(f.sabs[0].position,origin);assert.deepEqual(f.state.sabotage,critical);assert(f.state.systems.lights.active);assert.equal(f.state.systems.cooldowns[f.sabs[0].id].ventAt,ventAt);assert(!f.records.some(r=>r.type==='vent_exit'));assert.equal(systems.validateSystemsState(f.state),true);
 systems.onSystemsPhaseChange(f.state,'paused',start+1001,f.ctx);f.state.phase='paused';assert.equal(systems.systemsDeadline(f.state),Infinity);assert.equal(f.state.systems.lights.active,false);assert.equal(systems.validateSystemsState(f.state),true);
});

test('tactical passage restore keeps per-actor cooldown, local-only typed witnesses and phase/death cancellation',()=>{
 const f=fixture(),entry=f.map.fixtures.vents[0],exit=f.map.fixtures.vents.find(v=>v.id===entry.links[0]);place(f.sabs[0],entry);place(f.crew[0],entry);place(f.crew[1],exit);apply(f,f.sabs[0],{type:'vent',entryId:entry.id,exitId:exit.id});assert(f.records[0].visibleTo.includes(f.crew[0].id));assert(!f.records[0].visibleTo.includes(f.crew[1].id));assert(!('exitId'in f.records[0]));assert.equal(f.events.length,0);
 assert.equal(systems.getSystemsView(f.state,null).selfTransit,null);assert.equal(systems.getSystemsView(f.state,f.sabs[1].id).selfTransit,null);assert.equal(systems.getSystemsView(f.state,f.sabs[1].id).cooldowns.ventAt,start);restored(f);systems.advanceSystems(f.state,start+1600,f.ctx);assert.deepEqual(f.sabs[0].position,exit.position);assert(f.records.at(-1).visibleTo.includes(f.crew[1].id));assert(!('entryId'in f.records.at(-1)));assert.equal(systems.validateSystemAction(f.state,f.sabs[0],{type:'vent',entryId:exit.id,exitId:entry.id},start+16599,f.ctx).code,'COOLDOWN');
 const g=fixture();place(g.sabs[0],entry);apply(g,g.sabs[0],{type:'vent',entryId:entry.id,exitId:exit.id});const origin=json(g.sabs[0].position);g.sabs[0].alive=false;systems.advanceSystems(g.state,start+1,g.ctx);assert.deepEqual(g.sabs[0].position,origin);assert.deepEqual(g.records.at(-1).visibleTo,[g.sabs[0].id]);assert.equal(systems.validateSystemsState(g.state),true);
});

test('strict v2 snapshot validator rejects mixed versions, malformed doors/faction/personal clocks/map and private extras inertly',()=>{
 const f=fixture();apply(f,f.sabs[0],sabotage('door',f.map.fixtures.doors[0].id));
 for(const change of [s=>{s.systems.version=1;},s=>{s.systems.factionCooldowns.crew={criticalAt:0,auxiliaryAt:0};},s=>{s.systems.factionCooldowns.saboteur.criticalAt=NaN;},s=>{s.systems.cooldowns.p1.auxiliaryAt=0;},s=>{s.systems.doors[0].status='closed';},s=>{s.systems.doors[0].closeAt++;},s=>{s.systems.doors[0].deadlineAt++;},s=>{s.systems.doors[0].occupants=['secret'];},s=>{s.systems.doors.push(s.systems.doors[0]);},s=>{s.map.version=99;},s=>{s.preset.version=2;},s=>{s.tacticalVersion=2;},s=>{s.phase='ended';}]){const bad=structuredClone(f.state);change(bad);const before=structuredClone(bad);assert.throws(()=>systems.validateSystemsState(bad));assert.deepEqual(bad,before);}
 const legacy=fixture({legacy:true});legacy.state.systems.version=2;assert.throws(()=>systems.validateSystemsState(legacy.state));
});
