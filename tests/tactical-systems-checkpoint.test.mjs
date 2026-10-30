import test from 'node:test';import assert from 'node:assert/strict';
import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
const source=process.env.TACTICAL_SYSTEMS_SOURCE_ROOT?pathToFileURL(path.resolve(process.env.TACTICAL_SYSTEMS_SOURCE_ROOT)+path.sep):new URL('../',import.meta.url);
const [engine,systems,storage,rooms,{TACTICAL_MAP_CATALOG,getMap}]=await Promise.all(['server/engine/index.mjs','server/engine/systems/index.mjs','server/store.mjs','server/rooms.mjs','shared/maps/index.mjs'].map(file=>import(new URL(file,source))));
const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url)),start=100000;
function fixture(map,legacy=false){
 const room=rooms.createRoom('human',start,{},legacy?{}:{tactical:true,mapId:map.id});rooms.issueIdentity(room,true);room.startId='checkpoint-start';room.state=engine.createMatch({id:room.id,world:true,systems:true,...(legacy?{}:{tactical:true,map:{id:map.id,version:map.version}}),now:start,seed:3,config:{sabotageCooldownMs:1,criticalDurationMs:100000,roamDeadlineMs:1000000,maxMatchMs:2000000}});let serial=0;
 return {room,get state(){return room.state;},act(id,type,fields={},at=room.state.updatedAt){const result=engine.applyAction(room.state,id,{id:'checkpoint-'+ ++serial,type,...fields},at);assert(result.accepted,JSON.stringify(result.error));room.state=result.state;room.updatedAt=result.state.updatedAt;return result;},tick(at){room.state=engine.tick(room.state,at).state;room.updatedAt=room.state.updatedAt;},travel(id,target){this.act(id,'navigate',target);const p=this.state.players.find(p=>p.id===id);let distance=0,last=p.position;for(const next of p.motion.path){distance+=getMap(map.id).geometry.distance(last,next);last=next;}this.tick(this.state.updatedAt+Math.ceil(distance/180*1000)+1);assert.deepEqual(this.state.players.find(p=>p.id===id).position,target);}};
}
const sab=f=>f.state.players.find(p=>p.role==='saboteur').id;
async function rejected(room,mutate,pattern){const bad=structuredClone(room);mutate(bad.state);const before=structuredClone(bad);assert.throws(()=>systems.validateSystemsState(bad.state),pattern);await assert.rejects(storage.validateRoomSnapshot(bad));assert.deepEqual(bad,before);}
async function restart(t,room){
 await mkdir(temporary,{recursive:true});const directory=await mkdtemp(path.join(temporary,'tactical-checkpoint-'));let store;
 t.after(async()=>{await store?.close();assert(path.resolve(directory).startsWith(path.resolve(temporary)+path.sep));await rm(directory,{recursive:true,force:true});});
 const raw=JSON.stringify(room);store=await storage.createRoomStore(directory);await store.save(room);const file=path.join(directory,'room-'+room.id+'.json'),bytes=await readFile(file,'utf8');await store.close();store=await storage.createRoomStore(directory);const loaded=await store.load();assert.equal(loaded.length,1);assert.equal(JSON.stringify(loaded[0]),raw);assert.equal(await readFile(file,'utf8'),bytes);await storage.validateRoomSnapshot(loaded[0]);
}

for(const map of TACTICAL_MAP_CATALOG){
 test(map.id+' valid future due dates/reservations remain legal through active checkpoints and actual restart',async t=>{
  const initial=fixture(map);assert(initial.state.systems.factionCooldowns.saboteur.criticalAt>initial.state.updatedAt);await storage.validateRoomSnapshot(initial.room);
  for(const kind of ['lights','communications','door','power','flood']){
   const f=fixture(map);f.act(sab(f),'systemSabotage',{kind,targetId:kind==='door'?getMap(map.id).fixtures.doors[0].id:'beacon'},start+1);const effect=['power','flood'].includes(kind)?f.state.sabotage:kind==='door'?f.state.systems.doors[0]:f.state.systems[kind];assert(effect.deadlineAt>f.state.updatedAt);if(kind==='door')assert(effect.closeAt>f.state.updatedAt);assert(Object.values(f.state.systems.factionCooldowns.saboteur).some(at=>at>f.state.updatedAt));await storage.validateRoomSnapshot(f.room);await restart(t,f.room);
  }
 });
 test(map.id+' active history cannot predate match start and contribution history cannot exceed the checkpoint',async()=>{
  for(const kind of ['lights','communications','door','power','flood']){
   const f=fixture(map);f.act(sab(f),'systemSabotage',{kind,targetId:kind==='door'?getMap(map.id).fixtures.doors[0].id:'beacon'},start+1);
   await rejected(f.room,s=>{const e=['power','flood'].includes(kind)?s.sabotage:kind==='door'?s.systems.doors[0]:s.systems[kind],delta=e.startedAt-(start-1);e.startedAt-=delta;e.deadlineAt-=delta;if(kind==='door')e.closeAt-=delta;},/history/);
  }
  const f=fixture(map);f.act(sab(f),'systemSabotage',{kind:'power',targetId:'beacon'},start+1);const p=f.state.players.find(p=>p.role==='crew'),site=getMap(map.id).fixtures.repairs.power[0];f.travel(p.id,site.position);f.act(p.id,'systemRepair',{systemId:'power',siteId:site.id});await storage.validateRoomSnapshot(f.room);
  await rejected(f.room,s=>{s.sabotage.sites[0].repairedAt=s.updatedAt+1;},/history/);await rejected(f.room,s=>{s.sabotage.sites[0].repairedAt=start-1;},/repair site/);
 });
 test(map.id+' reservation upper bounds allow legitimate future times but reject unwitnessed extensions',async()=>{
  const f=fixture(map);f.act(sab(f),'systemSabotage',{kind:'lights',targetId:'beacon'},start+1);f.act(sab(f),'systemSabotage',{kind:'power',targetId:'beacon'},start+1);f.act(sab(f),'wait',{},start+1000);await storage.validateRoomSnapshot(f.room);
  await rejected(f.room,s=>{s.systems.factionCooldowns.saboteur.auxiliaryAt=s.updatedAt+s.beaconRules.auxiliaryCooldownMs+1;},/horizon/);
  await rejected(f.room,s=>{s.systems.factionCooldowns.saboteur.criticalAt++;},/critical reservation/);
  await rejected(f.room,s=>{s.systems.cooldowns[s.players[0].id].ventAt=s.updatedAt+s.beaconRules.ventTravelMs+s.beaconRules.ventCooldownMs+1;},/horizon/);
 });
 test(map.id+' active passage history/origin and exact reservation survive arrival restore without future extension',async t=>{
  const f=fixture(map),id=sab(f),entry=getMap(map.id).fixtures.vents[0];f.travel(id,entry.position);f.act(id,'vent',{entryId:entry.id,exitId:entry.links[0]});const t0=f.state.systems.transit[id];assert(t0.deadlineAt>f.state.updatedAt);assert.equal(f.state.systems.cooldowns[id].ventAt,t0.deadlineAt+f.state.beaconRules.ventCooldownMs);await storage.validateRoomSnapshot(f.room);await restart(t,f.room);
  await rejected(f.room,s=>{const t=s.systems.transit[id];t.startedAt++;t.deadlineAt++;s.systems.cooldowns[id].ventAt++;},/history|horizon/);
  await rejected(f.room,s=>{const t=s.systems.transit[id],delta=t.startedAt-(start-1);t.startedAt-=delta;t.deadlineAt-=delta;s.systems.cooldowns[id].ventAt-=delta;},/history/);
  f.act(id,'wait',{},f.state.updatedAt+1);await rejected(f.room,s=>{s.systems.cooldowns[id].ventAt++;},/origin or reservation/);
  await rejected(f.room,s=>{const p=s.players.find(p=>p.id===id),point=getMap(map.id).geometry.WORLD_VIEWPOINT;p.position={...point};s.systems.transit[id].origin={...point};},/origin or reservation/);
  const due=f.state.systems.transit[id].deadlineAt;f.tick(due);assert.equal(f.state.systems.transit[id],undefined);assert(f.state.systems.cooldowns[id].ventAt>f.state.updatedAt);await storage.validateRoomSnapshot(f.room);await restart(t,f.room);
 });
}

test('legacy version1 validator retains historical checkpoint tolerance and legitimate future due times',async t=>{
 const f=fixture(getMap(),true);f.act(sab(f),'systemSabotage',{kind:'lights',targetId:'beacon'},start+1);assert.equal(f.state.systems.version,1);const bad=structuredClone(f.room);bad.state.systems.lights.startedAt+=1000;bad.state.systems.lights.deadlineAt+=1000;bad.state.systems.cooldowns[sab(f)].auxiliaryAt+=1000;assert.equal(systems.validateSystemsState(bad.state),true);await storage.validateRoomSnapshot(bad);await restart(t,f.room);
});
