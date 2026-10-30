import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import{pathToFileURL}from'node:url';
const root=process.env.LATEST_MAIN_STORAGE_ROOT?pathToFileURL(path.resolve(process.env.LATEST_MAIN_STORAGE_ROOT)+path.sep):new URL('../',import.meta.url);
const [{loadConfig},{createRoom,issueIdentity,selectRoomMap,createRooms},{validateRoom},{getMap,MAP_CATALOG}]=await Promise.all(['server/config.mjs','server/rooms.mjs','server/store.mjs','shared/maps/index.mjs'].map(f=>import(new URL(f,root))));
const ids=['beacon','stormbreak-annex','storm-foundry','tidal-observatory'];
function lobby(mapId){const data=createRoom('human',1000,undefined,{tactical:true,stationTasks:true,mapId});issueIdentity(data,true);return data;}
test('both environment map names resolve the four-map catalog without changing origin or AI caps',()=>{
 assert.deepEqual(MAP_CATALOG.map(m=>m.id),ids);
 for(const mapId of ids)for(const setting of ['GAME_MAP','LANTERN_MAP']){const c=loadConfig({[setting]:mapId,PORT:'3029',PUBLIC_ORIGIN:'https://beacon.example:443/'});assert.equal(c.mapId,mapId);assert.equal(c.publicOrigin,'https://beacon.example');assert.deepEqual([c.ai.provider,c.ai.strategy,c.ai.maxCalls,c.ai.maxTokens,c.ai.maxCostUsd,c.ai.maxDailyCostUsd],['demo','hybrid',48,120000,.5,5]);}
 assert.equal(loadConfig({GAME_MAP:'beacon',LANTERN_MAP:'beacon'}).mapId,'beacon');assert.throws(()=>loadConfig({GAME_MAP:'storm-foundry',LANTERN_MAP:'beacon'}),/same map/);for(const mapId of ['unknown',null,{},2])assert.throws(()=>loadConfig({GAME_MAP:mapId,LANTERN_MAP:'unknown'}));assert.throws(()=>loadConfig({PUBLIC_ORIGIN:'https://user:audit-secret-sentinel@beacon.example'}),error=>!error.message.includes('audit-secret-sentinel'));
});
test('map lobby profiles retain exact references and never invent tactical or station fixtures',()=>{
 for(const id of ids){const room=lobby(id);assert.equal(validateRoom(room),room);assert.deepEqual(room.map,{id,version:id==='beacon'?2:1});if(ids.indexOf(id)<2){assert.equal(room.schema,4);assert.equal(room.stationTasksVersion,1);assert.equal(room.preset.id,'tactical');}else{assert.equal(room.schema,2);assert.equal(room.mapId,id);assert.equal(room.stationTasksVersion,undefined);assert.equal(room.preset,undefined);}}
 const old=createRoom('human',1000);issueIdentity(old,true);assert.equal(old.schema,1);assert.equal(old.map,undefined);assert.equal(validateRoom(old),old);
 const exact=createRoom('human',1000,undefined,{tactical:true,stationTasks:false,mapId:{id:'beacon',version:1}});issueIdentity(exact,true);assert.deepEqual(exact.map,{id:'beacon',version:1});assert.equal(validateRoom(exact),exact);
});
test('host map reprofiling retains identity, AI reservations and serialized settings; invalid persisted aliases fail closed',()=>{
 const room=lobby('beacon'),identity=structuredClone(room.identities),id=room.id;room.aiContext={activeMatchId:'fixture',matches:{'match:fixture':{mode:'live',calls:1,tokens:500,costUsd:.01,reservations:[{id:'existing',amountUsd:.01}],memories:{}}}};const ledger=JSON.stringify(room.aiContext);
 room.settings={revision:1,requests:[{id:'retained',fingerprint:JSON.stringify(['beacon',0]),accepted:true,revision:1}]};const settings=structuredClone(room.settings);
 for(const mapId of [...ids.slice(2),...ids.slice(0,2)]){selectRoomMap(room,mapId);assert.equal(room.id,id);assert.deepEqual(room.identities,identity);assert.equal(JSON.stringify(room.aiContext),ledger);assert.deepEqual(room.settings,settings);assert.equal(validateRoom(room),room);}
 const conflicting=structuredClone(room);conflicting.mapId='storm-foundry';assert.throws(()=>validateRoom(conflicting),/Inconsistent/);
 const future=structuredClone(room);future.map.version=999;assert.throws(()=>validateRoom(future),e=>e.code==='MAP_UNAVAILABLE');
 const custom=lobby('beacon');custom.lobby.roster[0].id='custom_keeper';custom.lobby.humanPlayerIds=['custom_keeper'];const before=structuredClone(custom);assert.throws(()=>selectRoomMap(custom,'storm-foundry'),e=>e.code==='MAP_ROSTER_UNSUPPORTED');assert.deepEqual(custom,before);
});
