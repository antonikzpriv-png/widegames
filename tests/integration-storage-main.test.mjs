import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createGameServer} from '../server/transport.mjs';
import {loadConfig} from '../server/config.mjs';
import {createRoom,createRooms,issueIdentity} from '../server/rooms.mjs';
import {createRoomStore,validateRoomSnapshot} from '../server/store.mjs';
import {getMap,mapFor} from '../shared/maps/index.mjs';
import {LOBBY_DEFAULTS,rosterFor} from '../shared/lobby.mjs';
import * as engine from '../server/engine/index.mjs';

const quietAi={describe:()=>({mode:'demo'}),decide:async()=>null};
async function fixture(t,configure=()=>{}){
 const dir=await mkdtemp(path.join(tmpdir(),'lw-integrated-storage-'));
 const config={...loadConfig({}),dataDir:dir,publicOrigin:'http://localhost:3000',now:()=>100000,tickMs:1000000};
 configure(config);
 let app;
 async function open(){app=await createGameServer(config,{aiController:quietAi});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return app;}
 await open();t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 return {dir,get app(){return app;},async reload(){await app.close();await open();},async request(route,body,cookie){
  const response=await fetch(`http://127.0.0.1:${app.server.address().port}${route}`,{method:body===undefined?'GET':'POST',headers:{Origin:config.publicOrigin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }};
}
for(const mapId of ['beacon','stormbreak-annex','beacon-illustrated','storm-foundry','tidal-observatory'])for(const capacity of [4,6,15])test(`integrated production ${mapId}/${capacity}: numeric settings, exact map, p15 progress and byte-preserving restart`,async t=>{
 const f=await fixture(t),created=await f.request('/api/rooms',{mode:'human',mapId}),route='/api/rooms/'+created.body.roomId,cookie=created.cookie;
 assert.equal(created.status,201,JSON.stringify(created.body));
 const set=await f.request(route+'/settings',{generation:1,settings:{capacity,saboteurs:capacity===15?3:1,tasksPerCrew:3,speed:225,vision:450}},cookie);
 assert.equal(set.status,200,JSON.stringify(set.body));assert.equal(set.body.settings.capacity,capacity);assert.equal(set.body.seats.length,capacity);
 const started=await f.request(route+'/start',{id:'combined:start',generation:1},cookie);assert.equal(started.status,200,JSON.stringify(started.body));
 const data=f.app.rooms.get(created.body.roomId).data,state=data.state;
 assert.equal(data.schema,5);assert.equal(state.players.length,capacity);assert.equal(state.lobbySettings.speed,225);assert.equal(mapFor(state).id,getMap(mapId).id);
 assert.equal(state.players.filter(p=>p.role==='saboteur').length,capacity===15?3:1);assert(state.players.flatMap(p=>p.tasks).some(task=>task.edition===3));
 if(data.preset){assert.equal(state.schemaVersion,5);assert(state.players.flatMap(p=>p.tasks).some(task=>task.kind==='station'));}else assert.equal(state.schemaVersion,2);
 if(capacity===15){assert(state.players.some(p=>p.id==='p15'));assert(state.players.every(p=>p.position&&Number.isFinite(p.position.x)));}
 const before=await readFile(path.join(f.dir,`room-${data.id}.json`));await f.reload();
 assert.deepEqual(await readFile(path.join(f.dir,`room-${data.id}.json`)),before);assert.deepEqual(f.app.rooms.get(data.id).data.state,state);
 const own=await f.request(route,undefined,cookie);assert.equal(own.status,200);assert.equal(own.body.game.self.id,'p1');
 assert.equal((await f.request(route+'/settings',{generation:1,settings:{speed:180}},cookie)).status,409);
 assert.equal((await readdir(f.dir)).filter(name=>name.includes('quarantine')).length,0);
});

test('integrated tactical WATCH: two authenticated human actors retain role privacy and deny host/visitor inspection',async t=>{
 const f=await fixture(t),made=await f.request('/api/rooms',{mode:'spectator',mapId:'stormbreak-annex'}),route='/api/rooms/'+made.body.roomId;
 const a=await f.request(route+'/join',{intent:'play',name:'First human'}),b=await f.request(route+'/join',{intent:'play',name:'Second human'}),visitor=await f.request(route+'/join',{});
 assert.equal(a.body.seatId,'p1');assert.equal(b.body.seatId,'p2');
 for(const player of [a,b])assert.equal((await f.request(route+'/ready',{generation:1,ready:true},player.cookie)).status,200);
 const started=await f.request(route+'/start',{generation:1,id:'watch:humans'},made.cookie);assert.equal(started.status,200,JSON.stringify(started.body));
 for(const player of [made,a,b,visitor]){
  const view=await f.request(route,undefined,player.cookie);assert.equal(view.status,200);assert.equal(view.body.game.inspection,undefined);assert.equal(view.body.inspectionAvailable,false);
  assert.equal((await f.request(route+'/inspection',{generation:1,enabled:true},player.cookie)).status,403);
 }
 for(const player of [a,b]){
  const result=await f.request(route+'/input',{generation:1,seq:1,dx:0,dy:0},player.cookie);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.game.self.id,player.body.seatId);
 }
 const state=f.app.rooms.get(made.body.roomId).data.state;
 assert.equal(state.players.find(p=>p.id==='p1').motion.seq,1);assert.equal(state.players.find(p=>p.id==='p2').motion.seq,1);
 assert.equal((await f.request(route+'/input',{generation:1,seq:2,dx:0,dy:0},visitor.cookie)).status,403);
});

test('integrated all-AI inspector requires the current unseated host and explicit per-match consent',async t=>{
 const f=await fixture(t),made=await f.request('/api/rooms',{mode:'spectator'}),route='/api/rooms/'+made.body.roomId,visitor=await f.request(route+'/join',{});
 const started=await f.request(route+'/start',{id:'ai:inspection',generation:1},made.cookie);assert.equal(started.status,200,JSON.stringify(started.body));assert.equal(started.body.game.inspection,undefined);assert.equal(started.body.inspectionAvailable,true);
 assert.equal((await f.request(route+'/inspection',{generation:1,enabled:true},visitor.cookie)).status,403);
 const enabled=await f.request(route+'/inspection',{generation:1,enabled:true},made.cookie);assert.equal(enabled.status,200);assert.equal(enabled.body.game.inspection.agents.length,6);
 assert.equal((await f.request(route,undefined,visitor.cookie)).body.game.inspection,undefined);
 const disabled=await f.request(route+'/inspection',{generation:1,enabled:false},made.cookie);assert.equal(disabled.body.game.inspection,undefined);
});

test('integrated optimistic map receipts never replace numeric settings and remain idempotent through restart',async t=>{
 const f=await fixture(t),made=await f.request('/api/rooms',{mode:'human'}),route='/api/rooms/'+made.body.roomId,input={id:'map:choose',mapId:'stormbreak-annex',expectedRevision:0,generation:1};
 assert.equal((await f.request(route+'/settings',{generation:1,settings:{capacity:15,saboteurs:3}},made.cookie)).status,200);
 const result=await f.request(route+'/settings',input,made.cookie);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.settings.capacity,15);assert.equal(result.body.settingsRevision,1);assert.equal(result.body.map.id,'stormbreak-annex');
 await f.reload();const retry=await f.request(route+'/settings',input,made.cookie);assert.equal(retry.status,200);assert.equal(retry.body.settingsRevision,1);assert.equal(retry.body.settings.capacity,15);
 const conflict=await f.request(route+'/settings',{...input,mapId:'beacon'},made.cookie);assert.equal(conflict.status,409);
 assert.equal((await f.request(route+'/start',{id:'after:map',generation:1},made.cookie)).status,200);
});

test('historical configurable schema2 remains readable without a schema or task-edition rewrite',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'lw-historical-configurable-')),store=await createRoomStore(dir);t.after(async()=>{await store.close();await rm(dir,{recursive:true,force:true});});
 const room=createRoom('human',100000,true);issueIdentity(room,true);room.settings={...LOBBY_DEFAULTS,capacity:15,saboteurs:3};room.roster=rosterFor(15);room.startId='old:task-edition';room.state=engine.createMatch({id:room.id,now:100000,world:true,settings:room.settings,roster:room.roster,humanPlayerIds:['p1'],seed:3});
 assert.equal(room.schema,2);assert.equal(room.state.taskEdition,undefined);await validateRoomSnapshot(room);await store.save(room);const file=path.join(dir,`room-${room.id}.json`),bytes=await readFile(file);assert.equal((await store.load()).length,1);assert.deepEqual(await readFile(file),bytes);
});

test('integrated validator rejects a forged configured lobby mirror and completion without server progress',async t=>{
 const f=await fixture(t),made=await f.request('/api/rooms',{mode:'human'}),route='/api/rooms/'+made.body.roomId;
 assert.equal((await f.request(route+'/start',{generation:1,id:'strict:mixed'},made.cookie)).status,200);
 const data=f.app.rooms.get(made.body.roomId).data,forged=structuredClone(data);forged.lobby.humanPlayerIds=[];
 await assert.rejects(validateRoomSnapshot(forged),/lobby mirror/);
 const progress=structuredClone(data),task=progress.state.players.flatMap(p=>p.tasks).find(t=>t.edition===3);task.completed=true;delete task.progress;
 await assert.rejects(validateRoomSnapshot(progress),/progress/);
});

test('named creation retains the actual HTTP profile and the historical configurable schema2 constructor',async t=>{
 const f=await fixture(t),created=await f.request('/api/rooms',{mode:'human',name:'Named keeper'});assert.equal(created.status,201,JSON.stringify(created.body));assert.equal(created.body.seats[0].name,'Named keeper');assert.equal(f.app.rooms.get(created.body.roomId).data.schema,5);
 // The old configurable constructor is still callable by embedders; its schema2 has no main-style lobby mirror.
 const directory=await mkdtemp(path.join(tmpdir(),'lw-named-schema2-')),store=await createRoomStore(directory);
 const service=createRooms({store,engine,ai:quietAi,now:()=>100000,configurable:true,lobbyConfig:true});
 try{const legacy=await service.create('human','Legacy named keeper');assert.equal(legacy.room.data.schema,2);assert.equal(legacy.room.data.lobby,undefined);assert.equal(legacy.room.data.roster[0].name,'Legacy named keeper');await validateRoomSnapshot(legacy.room.data);}finally{await store.close();await rm(directory,{recursive:true,force:true});}
});

test('configured schema5 honors legacy systemsMode with three authenticated humans while explicit walking maps and old schema2 stay unchanged',async t=>{
 const f=await fixture(t,config=>{config.tacticalMode=false;config.stationTasksMode=false;delete config.mapId;delete config.mapRevision;});
 const created=await f.request('/api/rooms',{mode:'human'}),route='/api/rooms/'+created.body.roomId;
 const guests=[];for(const name of ['Systems second','Systems third']){const joined=await f.request(route+'/join',{intent:'play',name});assert.equal(joined.status,200);guests.push(joined);assert.equal((await f.request(route+'/ready',{generation:1,ready:true},joined.cookie)).status,200);}
 const started=await f.request(route+'/start',{generation:1,id:'legacy:systems:start'},created.cookie);assert.equal(started.status,200,JSON.stringify(started.body));
 const original=structuredClone(f.app.rooms.get(created.body.roomId).data);assert.equal(original.schema,5);assert.equal(original.map,undefined);assert.equal(original.state.schemaVersion,3);assert.equal(original.state.beaconVersion,1);assert.equal(original.state.configuration.humanPlayerIds.length,3);assert(original.state.players.flatMap(p=>p.tasks).some(task=>task.edition===3));assert(started.body.game.systems);assert(started.body.game.investigation);
 const bytes=await readFile(path.join(f.dir,`room-${original.id}.json`));await f.reload();assert.deepEqual(f.app.rooms.get(original.id).data,original);assert.deepEqual(await readFile(path.join(f.dir,`room-${original.id}.json`)),bytes);
 for(const [i,human]of [created,...guests].entries()){
  const view=await f.request(route,undefined,human.cookie);assert.equal(view.status,200);assert.equal(view.body.game.self.id,`p${i+1}`);assert(view.body.game.systems);assert.equal(view.body.game.inspection,undefined);assert(view.body.game.players.filter(p=>p.id!==view.body.game.self.id).every(p=>!Object.hasOwn(p,'role')));
  assert.equal((await f.request(route+'/input',{generation:1,seq:1,dx:0,dy:0},human.cookie)).status,200);
 }
 const walking=await f.request('/api/rooms',{mode:'human',mapId:'beacon-illustrated'}),walkStarted=await f.request('/api/rooms/'+walking.body.roomId+'/start',{id:'explicit:walking',generation:1},walking.cookie);assert.equal(walkStarted.status,200,JSON.stringify(walkStarted.body));assert.equal(f.app.rooms.get(walking.body.roomId).data.state.schemaVersion,2);assert.equal(walkStarted.body.game.systems,undefined);
 // A historical configurable schema2 without map metadata already meant ordinary walking; the new server flag cannot reprofile it.
 await f.app.close();const writer=await createRoomStore(f.dir),old=createRoom('human',100000,true),issued=issueIdentity(old,true);try{await writer.save(old);}finally{await writer.close();}await f.reload();
 const oldStarted=await f.request('/api/rooms/'+old.id+'/start',{id:'old:walking',generation:1},`lw_${old.id}=${issued.token}`);assert.equal(oldStarted.status,200,JSON.stringify(oldStarted.body));assert.equal(f.app.rooms.get(old.id).data.state.schemaVersion,2);assert.equal(oldStarted.body.game.systems,undefined);
});
