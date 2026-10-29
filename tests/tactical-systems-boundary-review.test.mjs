/** Independent Core/root boundary controls; actual selected source, local HTTP and inert AI only. */
import test from 'node:test';import assert from 'node:assert/strict';
import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {once} from 'node:events';
import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
const source=process.env.TACTICAL_SYSTEMS_SOURCE_ROOT?pathToFileURL(path.resolve(process.env.TACTICAL_SYSTEMS_SOURCE_ROOT)+path.sep):new URL('../',import.meta.url);
const [engine,{createGameServer},{loadConfig},storage,{createDailyBudget},{MAP_CATALOG,getMap},{createSpatialWorld}]=await Promise.all(['server/engine/index.mjs','server/transport.mjs','server/config.mjs','server/store.mjs','server/budget.mjs','shared/maps/index.mjs','server/engine/world/index.mjs'].map(file=>import(new URL(file,source))));
const temp=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url)),origin='http://tactical-boundary-review.test',marker='SYNTHETIC_PRIVATE_TACTICAL_REVIEW';
async function fixture(t,changes={}){
 await mkdir(temp,{recursive:true});const directory=await mkdtemp(path.join(temp,'tactical-systems-review-'));let server,base,now=100000;
 const ledger=await createDailyBudget({directory,maxCostUsd:5,now:()=>now});await ledger.reserve({id:'preexisting-review-reservation',amount:.0123});const budget=await readFile(path.join(directory,'ai-daily-budget.json'),'utf8');
 const config={...loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:origin}),tacticalMode:true,tickMs:100000,now:()=>now,...changes},aiController={describe:()=>({mode:'demo',calls:0,tokens:0,costUsd:0,apiKey:marker,memory:marker}),decide:async()=>null};
 t.after(async()=>{await server?.close();assert(path.resolve(directory).startsWith(path.resolve(temp)+path.sep));await rm(directory,{recursive:true,force:true});});
 async function launch(){server=await createGameServer(config,{aiController});server.server.listen(0,'127.0.0.1');await once(server.server,'listening');base='http://127.0.0.1:'+server.server.address().port;}
 await launch();return {directory,budget,get server(){return server;},async restart(){await server.close();now+=100;await launch();},async request(route,body,cookie,headers={}){const r=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}};
}
async function room(f){const made=await f.request('/api/rooms',{mode:'human'});assert.equal(made.status,201);return {...made,id:made.body.roomId,route:'/api/rooms/'+made.body.roomId};}
function safe(view){
 const text=JSON.stringify(view);assert(!text.includes(marker));for(const key of ['identities','hash','fingerprint','requests','aiContext','factionCooldowns','repairers','repairedBy','visibleTo'])assert(!text.includes('"'+key+'"'),key);
}
function metadata(view){assert.deepEqual(Object.keys(view.map).sort(),['id','version']);assert.deepEqual(Object.keys(view.preset).sort(),['id','version']);for(const item of view.availableMaps)assert.deepEqual(Object.keys(item).sort(),['description','id','name','theme','version']);assert.equal(view.settings,undefined);assert.equal(view.configuration,undefined);assert.equal(view.ai.apiKey,undefined);}

for(const settingFirst of [true,false])test('root serialized settings/start boundary stays immutable when '+(settingFirst?'settings':'start')+' is sent first',async t=>{
 const f=await fixture(t),host=await room(f),target=MAP_CATALOG.find(m=>m.id!==host.body.map.id);assert(target,'integrated second map required');
 const change={id:'race-setting',mapId:target.id,expectedRevision:0},begin={id:'race-start'};
 const first=settingFirst?f.request(host.route+'/settings',change,host.cookie):f.request(host.route+'/start',begin,host.cookie),second=settingFirst?f.request(host.route+'/start',begin,host.cookie):f.request(host.route+'/settings',change,host.cookie),results=await Promise.all([first,second]);
 const setting=results[settingFirst?0:1],started=results[settingFirst?1:0];assert.equal(started.status,200);assert([200,409].includes(setting.status));const state=f.server.rooms.get(host.id).data;
 assert.equal(state.state.schemaVersion,4);assert.deepEqual(state.state.map,state.map);assert.deepEqual(state.state.replaySnapshots[0].map,state.map);assert.deepEqual(state.state.replay.find(e=>e.type==='started').map,state.map);
 assert.equal(state.map.id,setting.status===200?target.id:host.body.map.id);const saved=JSON.stringify(state);assert.equal((await f.request(host.route+'/settings',{id:'late-setting',mapId:host.body.map.id,expectedRevision:state.settings.revision},host.cookie)).body.error.code,'ALREADY_STARTED');assert.equal(JSON.stringify(f.server.rooms.get(host.id).data),saved);metadata(started.body);assert(started.body.game.players.every(p=>!Object.hasOwn(p,'role')));
});

test('root map retries cannot roll back an ABA selection or escape room/seat boundaries after restart',async t=>{
 const f=await fixture(t),a=await room(f),b=await room(f),observer=await f.request(a.route+'/join',{}),target=MAP_CATALOG.find(m=>m.id!==a.body.map.id);
 // Trusted private-memory fixture, persisted by the subsequent ordinary settings commit.
 f.server.rooms.get(a.id).data.aiContext.privateFixture=marker;
 const first={id:'retained-map-id',mapId:target.id,expectedRevision:0};assert.equal((await f.request(a.route+'/settings',first,b.cookie)).status,401);assert.equal((await f.request(a.route+'/settings',first,observer.cookie)).status,403);assert.equal((await f.request(a.route+'/settings',first,a.cookie,{Origin:'https://foreign.test'})).status,403);
 assert.equal((await f.request(a.route+'/settings',{...first,actorId:'p2'},a.cookie)).status,400);assert.equal((await f.request(a.route+'/settings',first,a.cookie)).status,200);
 const denied={id:'retained-denial',mapId:target.id,expectedRevision:0};const rejection=await f.request(a.route+'/settings',denied,a.cookie);assert.equal(rejection.status,409);assert.equal(rejection.body.error.code,'SETTINGS_CONFLICT');
 assert.equal((await f.request(a.route+'/settings',{id:'back-to-original',mapId:a.body.map.id,expectedRevision:1},a.cookie)).status,200);
 // Same request ID in another authenticated room remains independent.
 assert.equal((await f.request(b.route+'/settings',{...first,mapId:b.body.map.id},b.cookie)).status,200);
 await f.restart();assert.equal(f.server.rooms.get(a.id).data.aiContext.privateFixture,marker);const saved=JSON.stringify(f.server.rooms.get(a.id).data.settings),retry=await f.request(a.route+'/settings',first,a.cookie);assert.equal(retry.status,200);assert.equal(retry.body.map.id,a.body.map.id);assert.equal(retry.body.settingsRevision,2);metadata(retry.body);
 assert.deepEqual((await f.request(a.route+'/settings',denied,a.cookie)).body,rejection.body);assert.equal((await f.request(a.route+'/settings',{...first,expectedRevision:2},a.cookie)).body.error.code,'REQUEST_CONFLICT');assert.equal(JSON.stringify(f.server.rooms.get(a.id).data.settings),saved);
 for(const cookie of [a.cookie,observer.cookie]){const view=(await f.request(a.route,undefined,cookie)).body;metadata(view);safe(view);}assert.equal(await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8'),f.budget);
});

test('root private metadata stays excluded and strict store binds map/preset/tasks/snapshot to the selected match',async t=>{
 const f=await fixture(t),host=await room(f),target=MAP_CATALOG.find(m=>m.id!==host.body.map.id);await f.request(host.route+'/settings',{id:'select-annex',mapId:target.id,expectedRevision:0},host.cookie);assert.equal((await f.request(host.route+'/start',{id:'start'},host.cookie)).status,200);
 const valid=structuredClone(f.server.rooms.get(host.id).data);await storage.validateRoomSnapshot(valid);
 for(const mutate of [s=>{s.state.map.id=host.body.map.id;},s=>{s.map.version++;},s=>{s.state.preset.version++;},s=>{s.state.replaySnapshots[0].map.id=host.body.map.id;},s=>{s.map.private=marker;},s=>{s.state.players.find(p=>p.tasks.length).tasks[0].roomId='bridge';},s=>{s.state.players[0].position={x:1200,y:900};}]){const bad=structuredClone(valid);mutate(bad);await assert.rejects(storage.validateRoomSnapshot(bad));}
 for(const cookie of [host.cookie,(await f.request(host.route+'/join',{})).cookie]){const view=(await f.request(host.route,undefined,cookie)).body;metadata(view);assert.equal(view.game.configuration,undefined);assert.equal(view.game.systems.transit,undefined);assert.equal(view.game.systems.factionCooldowns,undefined);assert(view.game.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'knowledge')&&!Object.hasOwn(p,'motion')));assert(!JSON.stringify(view).includes(marker));}
});

test('legacy root constructor has no tactical lobby metadata or settings mutation',async t=>{
 const f=await fixture(t,{tacticalMode:false}),host=await room(f),before=JSON.stringify(f.server.rooms.get(host.id).data);for(const key of ['map','preset','availableMaps','settingsRevision'])assert.equal(host.body[key],undefined);
 assert.equal((await f.request(host.route+'/settings',{id:'not-tactical',mapId:'stormbreak-annex',expectedRevision:0},host.cookie)).body.error.code,'SETTINGS_UNAVAILABLE');assert.equal(JSON.stringify(f.server.rooms.get(host.id).data),before);
});

for(const selection of MAP_CATALOG)test('Core '+selection.id+' long elapsed steering cannot cross a closed threshold and reopening restores direct legality',()=>{
 const map=getMap(selection.id),world=createSpatialWorld(map.geometry);for(const door of map.fixtures.doors){
  const state=engine.createMatch({id:'physics-review',tactical:true,map:{id:map.id,version:map.version},now:100000,seed:'physics'}),p=state.players[0],pad=map.geometry.WORLD.bodyRadius+4;
  const from=door.width<door.height?{x:door.x-pad,y:door.y+door.height/2}:{x:door.x+door.width/2,y:door.y-pad},target=door.width<door.height?{x:door.x+door.width+pad,y:from.y}:{x:from.x,y:door.y+door.height+pad};p.position={...from};const d=state.systems.doors.find(d=>d.id===door.id);d.closed=true;d.status='closed';
  assert.equal(world.sees(from,target,state,p.id),false);world.input(p,{seq:1,dx:door.width<door.height?1:0,dy:door.width<door.height?0:1},100000);world.settle(state,1000000,()=>{});assert(world.walkable(p.position,state));assert(door.width<door.height?p.position.x<=door.x-map.geometry.WORLD.bodyRadius+1e-6:p.position.y<=door.y-map.geometry.WORLD.bodyRadius+1e-6);assert.equal(p.motion.manual,false);assert(map.geometry.distance(from,p.position)<=108+1e-6);
  d.closed=false;d.status='open';assert.equal(world.sees(from,target,state,p.id),true);const route=world.navigation(p,target,1000000,state);assert(route);world.navigate(p,target,route,1000000);world.settle(state,1001000,()=>{});assert.deepEqual(p.position,target);
 }
});
