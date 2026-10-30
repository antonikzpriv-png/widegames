import test from 'node:test';import assert from 'node:assert/strict';
import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
const source=process.env.TACTICAL_SYSTEMS_SOURCE_ROOT?pathToFileURL(path.resolve(process.env.TACTICAL_SYSTEMS_SOURCE_ROOT)+path.sep):new URL('../',import.meta.url);
const [engine,systems,storage,rooms,{getMap,TACTICAL_MAP_CATALOG}]=await Promise.all(['server/engine/index.mjs','server/engine/systems/index.mjs','server/store.mjs','server/rooms.mjs','shared/maps/index.mjs'].map(file=>import(new URL(file,source))));
const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url));
const sabotage=(state,at=1001)=>{const actor=state.players.find(p=>p.role==='saboteur');const result=engine.applyAction(state,actor.id,{id:'critical-start',type:'systemSabotage',kind:'power',targetId:'beacon'},at);assert(result.accepted,JSON.stringify(result.error));return result.state;};
function assertView(state,status,active,at=state.updatedAt){
 const before=JSON.stringify(state);for(const id of [null,state.players[0].id,state.players.find(p=>p.role==='crew').id]){
  const view=engine.getPlayerView(state,id,at),critical=view.systems.critical;assert.deepEqual(view.sabotage,critical);assert.equal(critical.active,active);assert.equal(critical.status,status);assert.equal(critical.deadlineAt,state.sabotage.deadlineAt);assert.equal(critical.repairsCompleted,state.sabotage.repairsCompleted);assert.equal(critical.repairsRequired,state.sabotage.repairsRequired);assert.deepEqual(critical.sites.map(s=>s.progress),state.sabotage.sites.map(s=>s.progress));for(const key of ['repairers','repairedBy','repairedAt'])assert(!JSON.stringify(critical).includes('"'+key+'"'));critical.sites[0].position.x=-1;
 }assert.equal(JSON.stringify(state),before,'projection and caller mutations cannot rewrite raw state');
}
async function persisted(t,room,state,status){
 await mkdir(temporary,{recursive:true});const directory=await mkdtemp(path.join(temporary,'tactical-critical-view-'));let store;
 t.after(async()=>{await store?.close();assert(path.resolve(directory).startsWith(path.resolve(temporary)+path.sep));await rm(directory,{recursive:true,force:true});});
 room.startId='critical-view-start';room.state=state;room.updatedAt=state.updatedAt;const raw=JSON.stringify(state),replay=structuredClone(state.replay),publicReplay=engine.getReplay(state),snapshots=engine.getReplaySnapshots(state),requests=structuredClone(state.requests),cooldowns=structuredClone(state.systems.factionCooldowns);
 store=await storage.createRoomStore(directory);await store.save(room);const file=path.join(directory,'room-'+room.id+'.json'),bytes=await readFile(file,'utf8');assertView(state,status,false,state.sabotage.deadlineAt+1000000);assert.equal(await readFile(file,'utf8'),bytes);assert.equal(JSON.stringify(state),raw);assert.deepEqual(state.replay,replay);assert.deepEqual(state.requests,requests);assert.deepEqual(state.systems.factionCooldowns,cooldowns);
 await store.close();store=await storage.createRoomStore(directory);const loaded=await store.load();assert.equal(loaded.length,1);assert.equal(JSON.stringify(loaded[0].state),raw);assert.equal(await readFile(file,'utf8'),bytes);assertView(loaded[0].state,status,false);assert.deepEqual(engine.getReplay(loaded[0].state),publicReplay);assert.deepEqual(engine.getReplaySnapshots(loaded[0].state),snapshots);
}

test('exact reported probe ends critical with inactive failed tactical projection while retaining unrepaired raw state',()=>{
 let state=engine.createMatch({id:'probe',tactical:true,seed:3,now:1000,config:{sabotageCooldownMs:1,criticalDurationMs:10}});state=sabotage(state);state=engine.tick(state,1011).state;assert.equal(state.phase,'ended');assert.equal(state.outcome.reason,'critical');assert.equal(state.sabotage.active,true);assert.equal(state.sabotage.repairsCompleted,0);assertView(state,'failed',false);
});

for(const map of TACTICAL_MAP_CATALOG){
 for(const outcome of ['critical','tasks','paused'])test(map.id+' real '+outcome+' resolution projects inactive without rewriting persisted critical/replay',async t=>{
  const room=rooms.createRoom('human',1000,{}, {tactical:true,mapId:map.id});rooms.issueIdentity(room,true);
  let state=engine.createMatch({id:room.id,tactical:true,map:{id:map.id,version:map.version},seed:3,now:1000,config:{sabotageCooldownMs:1,criticalDurationMs:outcome==='critical'?10:100000,maxMatchMs:outcome==='paused'?5:200000,taskCooldownMs:1}});state=sabotage(state);const historical=structuredClone(state.sabotage);
  if(outcome==='tasks'){
   // Seed all but one task complete and local station contact; the last legal engine task earns victory.
   const actor=state.players.find(p=>p.role==='crew'),last=actor.tasks[0];for(const p of state.players)for(const task of p.tasks)task.completed=task!==last;actor.position={...getMap(state.map).geometry.WORLD_STATIONS[last.roomId]};actor.roomId=last.roomId;
   const result=engine.applyAction(state,actor.id,{id:'actual-final-task',type:'task',taskId:last.id},1002);assert(result.accepted,JSON.stringify(result.error));state=result.state;assert.equal(state.phase,'ended');assert.equal(state.outcome.winner,'crew');assert.equal(state.outcome.reason,'tasks');
  }else state=engine.tick(state,outcome==='critical'?1011:1005).state;
  assert.equal(state.phase,outcome==='paused'?'paused':'ended');assert.deepEqual(state.sabotage,historical,'resolution preserves historical unfinished critical evidence');assert.equal(state.sabotage.active,true);assert.equal(state.sabotage.repairsCompleted,0);assert.equal(systems.validateSystemsState(state),true);
  const status=outcome==='critical'?'failed':outcome==='tasks'?'ended':'paused';assertView(state,status,false);await persisted(t,room,state,status);
 });
 test(map.id+' active and genuinely repaired tactical critical status retains meaning across pause',()=>{
  let state=engine.createMatch({id:'repair-status',tactical:true,map:{id:map.id,version:map.version},seed:3,now:1000,config:{sabotageCooldownMs:1,criticalDurationMs:100000,maxMatchMs:20}});state=sabotage(state);assertView(state,'active',true);
  const crew=state.players.filter(p=>p.role==='crew');for(const [i,site]of getMap(state.map).fixtures.repairs.power.entries()){
   const actor=state.players.find(p=>p.id===crew[i].id);actor.position={...site.position};actor.roomId=site.roomId;const result=engine.applyAction(state,actor.id,{id:'actual-repair-'+i,type:'systemRepair',systemId:'power',siteId:site.id},1002+i);assert(result.accepted,JSON.stringify(result.error));state=result.state;
  }assert.equal(state.sabotage.active,false);assert.equal(state.sabotage.repairsCompleted,2);assertView(state,'repaired',false);state=engine.tick(state,1020).state;assert.equal(state.phase,'paused');assertView(state,'repaired',false);
 });
}

for(const phase of ['ended','paused'])test('legacy schema3/'+phase+' keeps original active projection and no tactical status field',()=>{
 let state=engine.createMatch({id:'legacy-critical-status',world:true,systems:true,seed:3,now:1000,config:{sabotageCooldownMs:1,criticalDurationMs:phase==='ended'?10:100000,maxMatchMs:phase==='paused'?5:200000}});state=sabotage(state);state=engine.tick(state,phase==='ended'?1011:1005).state;assert.equal(state.schemaVersion,3);assert.equal(state.systems.version,1);assert.equal(state.phase,phase);const before=JSON.stringify(state),critical=engine.getPlayerView(state,null).systems.critical;assert.equal(critical.active,true);assert.equal(Object.hasOwn(critical,'status'),false);assert.equal(JSON.stringify(state),before);
});
