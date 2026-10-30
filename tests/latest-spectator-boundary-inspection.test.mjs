import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import * as engine from '../server/engine/index.mjs';
import {spectatorInspection} from '../server/spectator.mjs';
import {createGameServer} from '../server/transport.mjs';
import {fileURLToPath} from 'node:url';
const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url));
import {install} from '../server/ai/strategic.mjs';
import {mapFor} from '../shared/maps/index.mjs';
import {stationProgress} from '../shared/station-challenges.mjs';
import {createRooms} from '../server/rooms.mjs';

async function fixture(t,{instrument=false,native=false}={}){
 await mkdir(temporary,{recursive:true});const directory=await mkdtemp(join(temporary,'lw-observer-'));let now=100000;
 const observed=[],decisions=[];
 const instrumented={...engine,getPlayerView(state,actor,at){if(actor)observed.push(actor);return engine.getPlayerView(state,actor,at);}};
 const aiController={describe:()=>({mode:'demo',calls:0}),async decide({view,signal}){decisions.push(view);if(instrument)await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));return null;}};
 const service=await createGameServer({dataDir:directory,publicOrigin:'http://spectator.test',worldMode:true,...(native?{systemsMode:true,tacticalMode:true,stationTasksMode:true,mapId:'beacon'}:{}),tickMs:instrument?20:60000,now:()=>now,ai:{provider:'demo',decisionIntervalMs:60000}},{engine:instrumented,aiController});
 t.after(async()=>{await service.close();await rm(directory,{recursive:true,force:true});});service.server.listen(0,'127.0.0.1');await once(service.server,'listening');
 const origin='http://127.0.0.1:'+service.server.address().port;
 async function request(path,{cookie,body}={}){const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:'http://spectator.test',...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 return {service,origin,request,observed,decisions,advance(ms){now+=ms;}};
}


const ownerOptions={mode:'spectator',seatId:null,identity:{host:true,seatId:null},now:1001};
function worldFixture(map,seed=3){return engine.createMatch({id:'inspection-fixture',mode:'spectator',world:true,now:1000,seed,...(typeof map==='string'?{mapId:map}:Object.hasOwn(map,'mapId')?{mapId:map.mapId,mapRevision:map.revision}:{tactical:true,stationTasks:true,map})});}

test('inspection resolves exact Beacon1 plus all five current maps, summarizes six station and eleven step kinds without puzzle payloads',()=>{
 const stationKinds=new Set(),stepKinds=new Set();
 for(const map of [{id:'beacon',version:1},{id:'beacon',version:2},{id:'stormbreak-annex',version:1},{mapId:'storm-foundry',revision:2},{mapId:'tidal-observatory',revision:2},{mapId:'beacon',revision:2}])for(const seed of [3,7,11]){
  const state=worldFixture(map,seed),before=structuredClone(state),out=spectatorInspection(state,ownerOptions);
  if(Object.hasOwn(map,'mapId')){assert.equal(state.mapRevision,map.revision);assert.equal(state.mapId??'beacon',map.mapId);}else assert.deepEqual(state.map,map);
  assert.equal(out.agents.length,state.players.length);
  for(const player of state.players){
   const agent=out.agents.find(a=>a.id===player.id);assert.deepEqual(agent.position,player.position);
   assert.equal(agent.tasks.length,player.tasks.length);
   for(const task of player.tasks){
    const summary=agent.tasks.find(t=>t.id===task.id);assert.deepEqual(Object.keys(summary.progress).sort(),['index','kind','readyAt','total']);
    if(task.challenge){const expected=stationProgress(task.challenge);stationKinds.add(task.challenge.kind);assert.deepEqual(summary.progress,{kind:task.challenge.kind,index:expected.progress,total:expected.total,readyAt:0});}
    else{const expectedKind=task.kind??({bridge:'wires',lantern:'tuning',archive:'sequence',galley:'pressure',workshop:'repair',engine:'pressure'})[task.roomId];stepKinds.add(expectedKind);assert.equal(summary.progress.kind,expectedKind);assert(summary.progress.total>0);}
    assert.equal(summary.challenge,undefined);assert.equal(summary.progress.target,undefined);assert.equal(summary.progress.values,undefined);
   }
  }
  assert.deepEqual(state,before);assert.equal(engine.getPlayerView(state,null,1001).inspection,undefined);
 }
 assert.equal(stationKinds.size,6);assert.equal(stepKinds.size,11);
});

test('structural tactical plans use exact map sites, devices and linked passages; no arbitrary context or future actions are copied',()=>{
 for(const map of [{id:'beacon',version:2},{id:'stormbreak-annex',version:1}]){
  const state=worldFixture(map),geometry=mapFor(state),crew=state.players.find(p=>p.role==='crew'),sab=state.players.find(p=>p.role==='saboteur'),memory={};
  Object.defineProperty(memory,'prompt',{get(){throw Error('Private prompt read');}});
  Object.defineProperty(memory,'privateReasoning',{get(){throw Error('Private reasoning read');}});
  const context={activeMatchId:state.id,matches:{['match:'+state.id]:{mode:'live',memories:{['actor:'+crew.id]:memory,['actor:'+sab.id]:memory}}}};
  const inspect=id=>spectatorInspection(state,{...ownerOptions,context}).agents.find(p=>p.id===id);
  const device=geometry.fixtures.devices[0];memory.intention={type:'intend',goal:'device',deviceId:device.id,roomId:device.roomId,startedAt:1000,expiresAt:2000,rationale:'NEVER-EXPORT'};
  assert.equal(inspect(crew.id).plan.deviceId,device.id);assert.equal(inspect(sab.id).plan,undefined);
  memory.intention.deviceId='foreign-device';assert.equal(inspect(crew.id).plan,undefined);
  const entry=geometry.fixtures.vents[0],exit=entry.links[0];memory.intention={type:'intend',goal:'passage',entryId:entry.id,exitId:exit,startedAt:1000,expiresAt:2000};
  assert.equal(inspect(sab.id).plan.exitId,exit);assert.equal(inspect(crew.id).plan,undefined);
  memory.intention.exitId=entry.id;assert.equal(inspect(sab.id).plan,undefined);
  const site=geometry.fixtures.repairs.lights[0];state.systems.lights={...state.systems.lights,active:true,deadlineAt:2000};
  memory.intention={type:'intend',goal:'repair',systemId:'lights',siteId:site.id,roomId:site.roomId,deadlineAt:2000,startedAt:1000,expiresAt:2000};
  assert.equal(inspect(crew.id).plan.siteId,site.id);memory.intention.siteId='foreign-site';assert.equal(inspect(crew.id).plan,undefined);memory.intention.systemId='__proto__';assert.equal(inspect(crew.id).plan,undefined);
  state.replay.push({type:'action',at:1001,playerId:crew.id,action:{type:'taskInteract',value:'NEVER-EXPORT',interactionId:'NEVER-EXPORT'}},{type:'action',at:1001,playerId:crew.id,action:{type:'ghostSay',text:'NEVER-EXPORT'}});
  const out=inspect(crew.id);assert.equal(out.recentActions[0].type,'taskInteract');assert(!JSON.stringify(out).includes('NEVER-EXPORT'));
 }
});

test('room envelope durable failure never publishes engine state or private reservation changes; immutable operations retain old histories',async()=>{
 for(const options of [{},{world:true},{world:true,systems:true},{tactical:true,map:{id:'beacon',version:2}},{tactical:true,stationTasks:true,map:{id:'stormbreak-annex',version:1}}]){
  const state=engine.createMatch({id:'copy-check',now:1000,seed:3,...options}),before=structuredClone(state);
  const action=engine.applyAction(state,'p1',{id:'copy:wait',type:'wait'},1001);assert.deepEqual(state,before);
  const tick=engine.tick(state,1001);assert.deepEqual(state,before);
  for(const result of [action,tick]){if(result.state!==state){result.state.replay.push({type:'synthetic-mutability-control'});assert.deepEqual(state,before);}}
 }
 let failSave=false;
 const store={save:async()=>{if(failSave)throw Error('Synthetic durable failure');},load:async()=>[]};
 const service=createRooms({store,engine,ai:{describe:()=>({mode:'demo'})},now:()=>1000});
 const {room}=await service.create('human');const original=structuredClone(room.data),reference=room.data;
 failSave=true;const state=engine.createMatch({id:original.id,mode:'human',now:1000,seed:3});
 await assert.rejects(service.commit(room,{...room.data,state,startId:'copy:start'}),/Synthetic durable failure/);
 assert.equal(room.data,reference);assert.deepEqual(room.data,original);assert.equal(room.aiGeneration,0);
 const privateNext={...room.data,aiContext:{activeMatchId:'synthetic',matches:{}}};
 await assert.rejects(service.commit(room,privateNext),/Synthetic durable failure/);assert.deepEqual(room.data,original);
});


test('native five-map HTTP inspection is owner-only through durable commits; public catalog and normal engine projections stay redacted',async t=>{
 const f=await fixture(t,{native:true});
 for(const mapId of ['beacon','stormbreak-annex','storm-foundry','tidal-observatory','beacon-illustrated']){
  const created=await f.request('/api/rooms',{body:{mode:'spectator',mapId}});assert.equal(created.status,201);
  assert.equal(created.body.availableMaps.length,5);for(const item of created.body.availableMaps)assert.deepEqual(Object.keys(item).sort(),['description','id','name','theme','version']);
  const route='/api/rooms/'+created.body.roomId,started=await f.request(route+'/start',{cookie:created.cookie,body:{id:'owner:start'}});assert.equal(started.status,200);
  assert.equal(started.body.game.inspection,undefined,'owner roles remain private before explicit consent');const enabled=await f.request(route+'/inspection',{cookie:created.cookie,body:{enabled:true,generation:started.body.generation}});assert.equal(enabled.status,200);const state=f.service.rooms.get(created.body.roomId).data.state;assert.equal(enabled.body.game.inspection.agents.length,state.players.length);
  assert.equal(state.schemaVersion,['beacon','stormbreak-annex'].includes(mapId)?5:2);
  const publicIdentity=await f.request(route+'/join',{body:{}});assert.equal(publicIdentity.status,200);assert.equal(publicIdentity.body.isHost,false);assert.equal(publicIdentity.body.game.inspection,undefined);assert.equal((await f.request(route+'/inspection',{cookie:publicIdentity.cookie,body:{enabled:true,generation:started.body.generation}})).status,403,'joined identities cannot elevate to owner inspection');
  assert.equal(publicIdentity.body.game.ghostChat,undefined);assert(publicIdentity.body.game.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'tasks')));
  for(const player of state.players)assert.equal(engine.getPlayerView(state,player.id,100001).inspection,undefined);
  assert.equal((await f.request(route+'/start',{cookie:publicIdentity.cookie,body:{id:'guest:start'}})).status,403);
  assert.equal((await f.request(route+'/start',{cookie:created.cookie,body:{id:'owner:start',mapId}})).status,200);
  assert.equal((await f.request(route+'/start',{cookie:created.cookie,body:{id:'owner:start',mapId:mapId==='beacon'?'storm-foundry':'beacon'}})).status,409);
 }
});
