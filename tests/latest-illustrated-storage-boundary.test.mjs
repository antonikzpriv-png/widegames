import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {WebSocket} from 'ws';
const checkout=fileURLToPath(new URL('../',import.meta.url));
const root=process.env.ILLUSTRATED_STORAGE_ROOT?pathToFileURL(path.resolve(process.env.ILLUSTRATED_STORAGE_ROOT)+path.sep):new URL('../',import.meta.url);
const [engine,{loadConfig},{createRoom,issueIdentity,selectRoomMap},{createRoomStore,validateRoomSnapshot},{createGameServer},{mapFor,mapIdentity,getLegacyMap,getMap},{spectatorInspection},{createDailyBudget}]=await Promise.all(['server/engine/index.mjs','server/config.mjs','server/rooms.mjs','server/store.mjs','server/transport.mjs','shared/maps/index.mjs','server/spectator.mjs','server/budget.mjs'].map(f=>import(new URL(f,root))));
const temp=path.join(checkout,'_artifacts/test-temp'),incoming='668a867e069c7fb3aafbc69bbf9e6c42d1607eb7';
const origin='http://illustrated-storage.test',idle={describe:()=>({mode:'demo',provider:'demo',calls:0,tokens:0,costUsd:0}),decide:async()=>null};
const managed=new Map();
async function directory(t){await mkdir(temp,{recursive:true});const d=await mkdtemp(path.join(temp,'illustrated-storage-'));t.after(async()=>{const rel=path.relative(temp,d);assert(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));for(const game of managed.get(d)??[])await game.close();await rm(d,{recursive:true,force:true});});return d;}
const ledger=id=>({activeMatchId:id,matches:{['match:'+id]:{mode:'live',calls:1,tokens:500,costUsd:.01,reservations:[{id:'old:reservation',amountUsd:.01}],memories:{'actor:p1':{privateMarker:'PRIVATE-AI-SENTINEL'}}}}});
let rawPromise;
async function rawMain(){return rawPromise??=(async()=>{
 // Raw blobs, no Git archive CRLF conversion; fixture source is pinned, never a moving main worktree.
 const dir=path.join(checkout,'_artifacts/illustrated-storage/raw-main668');
 const records=execFileSync('git',['ls-tree','-rz',incoming,'--','server','shared'],{cwd:checkout}).toString().split('\0').filter(Boolean).map(x=>{const [meta,file]=x.split('\t');return {oid:meta.split(' ')[2],file};});
 const bytes=execFileSync('git',['cat-file','--batch'],{cwd:checkout,input:records.map(r=>r.oid+'\n').join(''),maxBuffer:32*1024*1024});let offset=0;
 for(const {file,oid} of records){const end=bytes.indexOf(10,offset),header=bytes.subarray(offset,end).toString().split(' ');assert.equal(header[0],oid);const size=Number(header[2]);assert(Number.isSafeInteger(size));const target=path.join(dir,file);assert(!path.relative(dir,target).startsWith('..'));await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes.subarray(end+1,end+1+size));offset=end+size+2;}
 const rawRoot=pathToFileURL(dir+path.sep);return {engine:await import(new URL('server/engine/index.mjs',rawRoot)),rooms:await import(new URL('server/rooms.mjs',rawRoot)),store:await import(new URL('server/store.mjs',rawRoot))};
})();}
async function originalRoom(mapId,revision=2,mode='human'){
 const raw=await rawMain(),room=raw.rooms.createRoom(mode,1000),issued=raw.rooms.issueIdentity(room,true);
 if(mapId!=='beacon')room.mapId=mapId;if(revision===2)room.mapRevision=2;
 room.startId='original:start';room.state=raw.engine.createMatch({id:room.id,mode,world:true,mapId,mapRevision:revision,now:1000,seed:'raw-saved-revision',features:{deathPolicy:'ghost-tasks',abilities:true}});
 const denied=raw.engine.applyAction(room.state,'p1',{id:'retained:denial',type:'taskStep',taskId:'no-such-task',step:0,input:'x'},1001);assert.equal(denied.accepted,false);room.state=denied.state;room.updatedAt=room.state.updatedAt;room.aiContext=ledger(room.id);
 return {room,issued,raw};
}
async function server(t,config,dependencies={}){
 const d=config.dataDir??await directory(t),game=await createGameServer({dataDir:d,publicOrigin:origin,worldMode:true,tickMs:600000,now:()=>100000,ai:{provider:'demo'},...config},{aiController:idle,...dependencies});managed.set(d,[...(managed.get(d)??[]),game]);t.after(()=>game.close());game.server.listen(0,'127.0.0.1');await once(game.server,'listening');const base='http://127.0.0.1:'+game.server.address().port;
 const request=async(route,{body,cookie}={})=>{const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};return {game,base,request,d};
}

test('default tactical Beacon and explicit illustrated selection keep independent namespaces and public five-field catalog',()=>{
 const config=loadConfig({});assert.equal(config.tacticalMode,true);assert.equal(config.mapId,'beacon');assert.equal(config.mapRevision,2);assert.equal(config.ai.maxDailyCostUsd,5);
 const native=createRoom('spectator',1000,{}, {tactical:true,stationTasks:true,mapId:config.mapId});issueIdentity(native,true);assert.deepEqual(native.map,{id:'beacon',version:2});assert.equal(native.mapRevision,undefined);assert.equal(mapFor(native).roomLayout.length,14);assert.equal(mapFor(native).geometry.WORLD.width,3200);
 const ids=native.identities,prior=ledger('lobby');native.aiContext=prior;selectRoomMap(native,'beacon-illustrated');assert.deepEqual(native.map,{id:'beacon-illustrated',version:2});assert.equal(native.mapId,'beacon');assert.equal(native.mapRevision,2);assert.equal(native.schema,2);assert.equal(native.stationTasksVersion,undefined);assert.equal(mapFor(native).roomLayout.length,6);assert.equal(mapFor(native).geometry.WORLD.width,1600);assert.equal(native.identities,ids);assert.equal(native.aiContext,prior);
 assert.notEqual(mapIdentity(getMap({id:'beacon',version:2})),mapIdentity(mapFor(native)));
 const trusted=createRoom('human',1000,undefined,{mapRevision:2});assert.equal(trusted.mapId,'beacon');assert.equal(trusted.mapRevision,2);
 const old=createRoom('human',1000);assert.equal(old.map,undefined);assert.equal(old.mapRevision,undefined);
 assert.equal(loadConfig({GAME_MAP:'beacon-illustrated'}).mapId,'beacon-illustrated');assert.throws(()=>loadConfig({GAME_MAP:'beacon',LANTERN_MAP:'beacon-illustrated'}),/same map/);
});

test('trusted revisions are validated before storage; HTTP cannot set a private revision or host flag',async t=>{
 let touched=0;const store={load:async()=>{touched++;return [];},close:async()=>{},save:async()=>{}};
 for(const mapRevision of [null,0,3,'2',true,{}])await assert.rejects(createGameServer({mapRevision},{store}),/revision/);
 await assert.rejects(createGameServer({worldMode:false,mapRevision:2},{store}),/world mode/);assert.equal(touched,0);
 const f=await server(t,{mapRevision:2});for(const body of [{mode:'human',mapRevision:1},{mode:'spectator',host:true}])assert.equal((await f.request('/api/rooms',{body})).status,400);
 const lobby=await f.request('/api/rooms',{body:{mode:'human'}});assert.equal(lobby.status,201);assert.equal(lobby.body.mapRevision,2);assert.equal((await f.request('/api/rooms/'+lobby.body.roomId+'/start',{cookie:lobby.cookie,body:{id:'bad:revision',mapRevision:1}})).status,400);
});

test('raw main668 schemas1/world2 saves of both revisions restore byte-for-byte with backups, accepted denials and prior spending',async t=>{
 for(const mapId of ['beacon','storm-foundry','tidal-observatory'])for(const revision of [1,2]){
  const dir=await directory(t),{room,raw}=await originalRoom(mapId,revision),writer=await raw.store.createRoomStore(dir);try{await writer.save(room);}finally{await writer.close();}
  const file=path.join(dir,'room-'+room.id+'.json'),before=await readFile(file),reader=await createRoomStore(dir,{worldGeometry:{invalid:'must not bootstrap selected revisions'}});
  try{
   // Implicit original Beacon1 deliberately needs its ordinary fallback; use real geometry for that one.
   if(mapId==='beacon'&&revision===1){await reader.close();const standard=await createRoomStore(dir);try{const restored=(await standard.load())[0];assert.deepEqual(restored,room);const backup=await standard.backup(room.id);assert.deepEqual(await readFile(backup.file),before);}finally{await standard.close();}}
   else{const restored=(await reader.load())[0];assert(restored);assert.deepEqual(restored,room);const backup=await reader.backup(room.id);assert.deepEqual(await readFile(backup.file),before);assert.equal(mapIdentity(mapFor(restored.state)),mapIdentity(getLegacyMap(mapId,revision)));}
   assert.deepEqual(await readFile(file),before);
   const retry=engine.applyAction(room.state,'p1',{id:'retained:denial',type:'wait'},room.updatedAt);assert.equal(retry.accepted,false);assert.deepEqual(room.aiContext,ledger(room.id));
  }finally{await reader.close();}
 }
});

test('modern exact aliases bind canonical legacy revisions, reject cross-namespace/protocol mixes and preserve future data',async t=>{
 for(const mapId of ['beacon','storm-foundry','tidal-observatory']){
  const {room}=await originalRoom(mapId),modern=createRoom('human',1000,undefined,{mapId:mapId==='beacon'?'beacon-illustrated':mapId});issueIdentity(modern,true);modern.id=room.id;modern.startId=room.startId;modern.state=room.state;modern.updatedAt=room.updatedAt;modern.aiContext=room.aiContext;await validateRoomSnapshot(modern);
  for(const mutate of [r=>r.mapRevision=1,r=>r.state.mapRevision=1,r=>r.state.replayHistory.mapRevision=1,r=>r.map={id:'beacon',version:2}]){const bad=structuredClone(modern);mutate(bad);await assert.rejects(validateRoomSnapshot(bad));}
  const dir=await directory(t),s=await createRoomStore(dir);let backup;try{await s.save(modern);backup=await s.backup(modern.id);}finally{await s.close();}
  const saved=await readFile(backup.file),file=path.join(dir,'room-'+modern.id+'.json');
  for(const field of ['room','state','history']){const future=structuredClone(modern);(field==='room'?future:field==='state'?future.state:future.state.replayHistory).mapRevision=3;const bytes=JSON.stringify(future);await writeFile(file,bytes);const r=await createRoomStore(dir);try{await assert.rejects(r.load(),e=>e.code==='MAP_UNAVAILABLE'&&/revision.*unavailable/i.test(e.message));assert.equal(await readFile(file,'utf8'),bytes);assert.deepEqual(await readFile(backup.file),saved);assert(!(await readdir(dir)).some(n=>n.includes('quarantine')));}finally{await r.close();}}
 }
});

test('real five-selection native HTTP uses canonical world2 revisions and host-only HTTP/WS inspection',async t=>{
 const d=await directory(t),f=await server(t,{...loadConfig({DATA_DIR:d,PUBLIC_ORIGIN:origin}),dataDir:d,now:()=>100000,tickMs:600000});
 for(const mapId of ['beacon','stormbreak-annex','storm-foundry','tidal-observatory','beacon-illustrated']){
  const lobby=await f.request('/api/rooms',{body:{mode:'spectator',mapId}});assert.equal(lobby.status,201);assert.equal(lobby.body.availableMaps.length,5);for(const item of lobby.body.availableMaps)assert.deepEqual(Object.keys(item).sort(),['description','id','name','theme','version']);
  const route='/api/rooms/'+lobby.body.roomId,started=await f.request(route+'/start',{body:{id:'start:illustrated'},cookie:lobby.cookie});assert.equal(started.status,200,JSON.stringify(started.body));const state=f.game.rooms.get(lobby.body.roomId).data.state;
  assert.equal(started.body.game.inspection.matchId,state.id);assert.equal(state.schemaVersion,['beacon','stormbreak-annex'].includes(mapId)?5:2);
  if(state.schemaVersion===2){assert.equal(state.mapRevision,2);assert.equal(state.mapId??'beacon',mapId==='beacon-illustrated'?'beacon':mapId);assert.equal(started.body.game.tasks.total,mapId==='beacon-illustrated'?15:60);}
  const guest=await f.request(route+'/join',{body:{}});assert.equal(guest.body.game.inspection,undefined);assert.equal(guest.body.game.ghostChat,undefined);assert(guest.body.game.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'tasks')));
  assert.equal((await f.request(route+'/start',{body:{id:'start:illustrated',mapId},cookie:lobby.cookie})).status,200);
  assert.equal((await f.request(route+'/start',{body:{id:'start:illustrated',mapId:mapId==='beacon'?'beacon-illustrated':'beacon'},cookie:lobby.cookie})).status,409);
  const ws=new WebSocket(f.base.replace('http:','ws:')+route+'/socket',{headers:{Origin:origin,Cookie:guest.cookie}});try{const [raw]=await once(ws,'message');assert.equal(JSON.parse(raw).room.game.inspection,undefined);}finally{ws.terminate();}
  const ownerOptions={mode:'spectator',seatId:null,identity:{host:true,seatId:null},now:100000};const inspection=spectatorInspection(state,ownerOptions);assert.equal(inspection.agents.length,6);assert.equal(engine.getPlayerView(state,null,100000).inspection,undefined);
 }
});

test('raw accepted start IDs survive latest defaults and restart, unchanged canonical retry200 cannot roll old physical revisions forward',async t=>{
 const dir=await directory(t),records=[];
 for(const mapId of ['beacon','storm-foundry','tidal-observatory'])for(const revision of [1,2]){const r=await originalRoom(mapId,revision);records.push(r);const w=await r.raw.store.createRoomStore(dir);try{await w.save(r.room);}finally{await w.close();}}
 const budget=await createDailyBudget({directory:dir,maxCostUsd:5,now:()=>100000});await budget.reserve({id:'prior:deployment',amount:.01});const budgetFile=path.join(dir,'ai-daily-budget.json'),budgetBytes=await readFile(budgetFile);
 const f=await server(t,{...loadConfig({DATA_DIR:dir,PUBLIC_ORIGIN:origin}),dataDir:dir,now:()=>100000,tickMs:600000});
 for(const {room,issued} of records){const route='/api/rooms/'+room.id,cookie='lw_'+room.id+'='+issued.token,file=path.join(dir,'room-'+room.id+'.json'),before=await readFile(file),key=mapIdentity(mapFor(room.state));
  for(const body of [{id:room.startId},{id:room.startId,mapId:room.mapId??'beacon'}]){const r=await f.request(route+'/start',{body,cookie});assert.equal(r.status,200);assert.equal(mapIdentity(mapFor(f.game.rooms.get(room.id).data.state)),key);}
  if((room.mapId??'beacon')==='beacon'&&(room.mapRevision??1)===1)assert.equal((await f.request(route+'/start',{body:{id:room.startId,mapId:'beacon-illustrated'},cookie})).status,409);
  assert.equal((await f.request(route+'/start',{body:{id:room.startId,mapId:'stormbreak-annex'},cookie})).status,409);assert.deepEqual(await readFile(file),before);assert.deepEqual(f.game.rooms.get(room.id).data.aiContext,room.aiContext);
 }
 await f.game.close();assert.deepEqual(await readFile(budgetFile),budgetBytes);
 const restored=await server(t,{dataDir:dir,mapRevision:1,now:()=>100000});for(const {room} of records)assert.deepEqual(restored.game.rooms.get(room.id).data,room);
});
