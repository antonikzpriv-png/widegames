import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createGameServer} from '../server/transport.mjs';
import {createRoom,issueIdentity} from '../server/rooms.mjs';
import {createRoomStore,validateRoomSnapshot} from '../server/store.mjs';
import {createDailyBudget} from '../server/budget.mjs';
const core=await import(process.env.WORLD_TRANSPORT_ENGINE_MODULE||'../server/engine/index.mjs');
const geometry=await import(process.env.WORLD_ENGINE_GEOMETRY_MODULE||'../shared/world.mjs');
const {WORLD,WORLD_STATIONS,distance}=geometry;
const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url)),origin='http://world-core-http.test';
let fixtureSeed;
for(let i=0;i<100;i++){const seed=`world-transport-core-${i}`,state=core.createMatch({id:'world_seed_probe',seed,now:0,world:true});if(state.players[0].role==='crew'&&state.players[0].tasks.some(task=>task.roomId==='bridge')){fixtureSeed=seed;break;}}
assert(fixtureSeed,'real proximity fixture needs a human crew task on Bridge');
const aiController={describe:()=>({mode:'demo',provider:'world-transport-idle-fixture',calls:0,tokens:0,costUsd:0}),decide:async()=>null};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){const end=Date.now()+5000;while(Date.now()<end){if(check())return;await delay(10);}throw new Error(`Timed out: ${label}`);}
async function directory(t,label){await mkdir(temporary,{recursive:true});const value=await mkdtemp(path.join(temporary,`world-transport-core-${label}-`));return value;}
async function service(t,options={}){
 const dataDir=await directory(t,'http');let now=100000,game,base;
 const config={publicOrigin:origin,dataDir,tickMs:10,now:()=>now,worldMode:true,maxActiveRooms:12,roomTtlMs:3600000,ai:{provider:'demo',decisionIntervalMs:100},...options};
 const engine={...core,createMatch:args=>core.createMatch({...args,seed:fixtureSeed})};
 const launch=async()=>{game=await createGameServer(config,{engine,aiController,worldGeometry:geometry});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base=`http://127.0.0.1:${game.server.address().port}`;};await launch();
 t.after(async()=>{await game.close();assert(path.resolve(dataDir).startsWith(path.resolve(temporary)+path.sep));await rm(dataDir,{recursive:true,force:true});});
 async function request(route,data,cookie){const res=await fetch(base+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 const host=await request('/api/rooms',{mode:'human'});assert.equal(host.status,201);const id=host.body.roomId,route=`/api/rooms/${id}`;assert.equal((await request(route+'/start',{id:'start'},host.cookie)).status,200);
 return {id,route,host,config,dataDir,request,get game(){return game;},get base(){return base;},get now(){return now;},advance(ms){now+=ms;},async restart(changes={}){await game.close();Object.assign(config,changes);await launch();}};
}
const p1=f=>f.game.rooms.get(f.id).data.state.players.find(player=>player.id==='p1');
const snapshot=()=>{const room=createRoom('human',100000);issueIdentity(room,true);room.startId='start';room.state=core.createMatch({id:room.id,mode:'human',now:100000,seed:'world-store-shape',world:true});return room;};

test('actual Core: held HTTP input advances at server speed, duplicate does not refresh lease, then expires',async t=>{
 const f=await service(t),start={...p1(f).position};assert.equal(f.game.rooms.get(f.id).data.state.schemaVersion,2);
 const concurrent=await Promise.all([f.request(f.route+'/input',{seq:1,dx:1,dy:0},f.host.cookie),f.request(f.route+'/input',{seq:1,dx:1,dy:0},f.host.cookie)]);assert(concurrent.every(result=>result.status===200));assert.equal(f.game.rooms.get(f.id).data.state.version,2);let result=concurrent[0];assert.equal(result.body.game.worldVersion,1);assert.equal(result.body.game.self.inputSeq,1);const lease=p1(f).motion.leaseUntil;
 f.advance(200);await until(()=>p1(f).motion.at===f.now,'server tick settles input');assert(Math.abs(distance(start,p1(f).position)-36)<1e-6);
 result=await f.request(f.route+'/input',{seq:1,dx:1,dy:0},f.host.cookie);assert.equal(result.status,200);assert.equal(p1(f).motion.leaseUntil,lease);
 f.advance(1000);await until(()=>!p1(f).motion.manual,'input lease expires without browser');const stopped={...p1(f).position};assert(Math.abs(distance(start,stopped)-108)<1e-6);
 f.advance(2000);await delay(40);assert.deepEqual(p1(f).position,stopped);assert.equal((await f.request(f.route+'/input',{seq:1,dx:-1,dy:0},f.host.cookie)).status,409);
});

test('actual Core: checkpoint restart retains sequence, direction, lease and private context without provider spend',async t=>{
 const f=await service(t);assert.equal((await f.request(f.route+'/input',{seq:7,dx:-1,dy:1},f.host.cookie)).status,200);const before=structuredClone(p1(f).motion);
 await f.game.close();const privateContext={worldBudgetPrivate:'persist-before-restart',reservedCalls:1};const backing=await createRoomStore(f.dataDir,{worldGeometry:geometry});try{const [room]=await backing.load();room.aiContext=privateContext;await backing.save(room);}finally{await backing.close();}const daily=await createDailyBudget({directory:f.dataDir,maxCostUsd:5,now:()=>f.now});await daily.reserve({id:f.id+':existing-reservation',amount:.0123});const ledgerBefore=await readFile(path.join(f.dataDir,'ai-daily-budget.json'),'utf8');
 await f.restart();assert.deepEqual(p1(f).motion,before);assert.equal((await f.request(f.route+'/input',{seq:6,dx:0,dy:0},f.host.cookie)).status,409);assert.equal((await f.request(f.route+'/input',{seq:7,dx:-1,dy:1},f.host.cookie)).status,200);assert.equal(p1(f).motion.leaseUntil,before.leaseUntil);
 assert.equal((await f.request(f.route+'/input',{seq:8,dx:0,dy:0},f.host.cookie)).status,200);assert.equal(p1(f).motion.seq,8);assert.equal(p1(f).motion.manual,false);
 assert.deepEqual(f.game.rooms.get(f.id).data.aiContext,privateContext);await f.game.close();assert.equal(await readFile(path.join(f.dataDir,'ai-daily-budget.json'),'utf8'),ledgerBefore);
});

test('actual Core: navigate, remote visibility, proximity and real human/spectator WebSocket views',async t=>{
 const f=await service(t),target=WORLD_STATIONS.archive;
 const observer=await f.request(f.route+'/join',{},undefined);
 const human=new WebSocket(f.base.replace('http:','ws:')+f.route+'/socket',{headers:{Origin:origin,Cookie:f.host.cookie}}),spectator=new WebSocket(f.base.replace('http:','ws:')+f.route+'/socket',{headers:{Origin:origin,Cookie:observer.cookie}});t.after(()=>{human.terminate();spectator.terminate();});await Promise.all([once(human,'message'),once(spectator,'message')]);
 const humanUpdates=[],spectatorUpdates=[];human.on('message',raw=>humanUpdates.push(JSON.parse(raw.toString()).room));spectator.on('message',raw=>spectatorUpdates.push(JSON.parse(raw.toString()).room));
 const bridgeTask=p1(f).tasks.find(task=>task.roomId==='bridge');assert(bridgeTask);assert.equal(p1(f).roomId,'bridge');assert(distance(p1(f).position,WORLD_STATIONS.bridge)>WORLD.interactionRadius);assert.equal((await f.request(f.route+'/action',{id:'too-far-task-same-room',type:'task',taskId:bridgeTask.id},f.host.cookie)).status,409);
 assert.equal((await f.request(f.route+'/action',{id:'go-bridge-station',type:'navigate',x:WORLD_STATIONS.bridge.x,y:WORLD_STATIONS.bridge.y},f.host.cookie)).status,200);f.advance(3000);await until(()=>distance(p1(f).position,WORLD_STATIONS.bridge)<1e-6,'reach own Bridge station');for(let step=0;step<3;step++)assert.equal((await f.request(f.route+'/action',{id:'wire-'+step,type:'taskStep',taskId:bridgeTask.id,step,input:`${step}:${step}`},f.host.cookie)).status,200);assert.equal((await f.request(f.route+'/action',{id:'near-task',type:'task',taskId:bridgeTask.id},f.host.cookie)).status,200);
 assert.equal((await f.request(f.route+'/action',{id:'go-archive',type:'navigate',x:target.x,y:target.y},f.host.cookie)).status,200);f.advance(20000);
 await until(()=>distance(p1(f).position,target)<1e-6,'authoritative navigation arrival');await until(()=>humanUpdates.some(room=>room.game.self?.roomId==='archive')&&spectatorUpdates.some(room=>room.game.players.find(player=>player.id==='p1')?.roomId==='archive'),'permitted WebSocket broadcasts');
 const own=(await f.request(f.route,undefined,f.host.cookie)).body,remote=own.game.players.find(player=>player.id==='p2');assert.equal(remote.position,null);assert.equal(remote.roomId,null);
 for(const player of own.game.players){assert(!Object.hasOwn(player,'role'));assert(!Object.hasOwn(player,'motion'));assert(!Object.hasOwn(player,'destination'));assert(!Object.hasOwn(player,'inputSeq'));}
 const publicView=(await f.request(f.route,undefined,observer.cookie)).body;assert.equal(publicView.game.self,null);assert(publicView.game.players.every(player=>player.position&& !Object.hasOwn(player,'role')));
 const safe=JSON.stringify([own,publicView,...humanUpdates,...spectatorUpdates]);for(const field of ['aiContext','leaseUntil','recordedAt','identities'])assert(!safe.includes(field));
 assert.equal((await f.request(f.route+'/action',{id:'far-bell',type:'meeting'},f.host.cookie)).status,409);
});

test('actual Core: new input is denied in discussion while deadline changes are persisted',async t=>{
 const f=await service(t,{rules:{meetingCooldownMs:1,discussionMs:1000,votingMs:1000}});f.advance(2);
 assert.equal((await f.request(f.route+'/action',{id:'council',type:'meeting'},f.host.cookie)).status,200);
 const denied=await f.request(f.route+'/input',{seq:1,dx:1,dy:0},f.host.cookie);assert.equal(denied.status,409);assert.equal(denied.body.error.code,'WRONG_PHASE');assert.equal(p1(f).motion.manual,false);
 f.advance(1001);const boundary=await f.request(f.route+'/input',{seq:2,dx:1,dy:0},f.host.cookie);assert.equal(boundary.status,409);assert.equal(f.game.rooms.get(f.id).data.state.phase,'voting');await f.restart();assert.equal(f.game.rooms.get(f.id).data.state.phase,'voting');
});

test('legacy checkpoint stays schema1 after world production policy changes, backup and dry validation never migrate it',async t=>{
 const f=await service(t,{worldMode:undefined});assert.equal(f.game.rooms.get(f.id).data.state.schemaVersion,1);await f.game.close();
 const store=await createRoomStore(f.dataDir,{worldGeometry:geometry});let saved;try{[saved]=await store.load();const original=await readFile(path.join(f.dataDir,`room-${f.id}.json`),'utf8'),backup=await store.backup(f.id);assert.equal(backup.schemaVersion,1);assert.equal(await readFile(backup.file,'utf8'),original);
 const candidate=structuredClone(saved);candidate.state=core.createMatch({id:f.id,mode:'human',now:100000,seed:'candidate-shape-only',world:true});await validateRoomSnapshot(candidate,{worldGeometry:geometry});assert.equal(await readFile(path.join(f.dataDir,`room-${f.id}.json`),'utf8'),original);
 }finally{await store.close();}
 await f.restart({worldMode:true});assert.equal(f.game.rooms.get(f.id).data.state.schemaVersion,1);const view=await f.request(f.route,undefined,f.host.cookie);assert(!Object.hasOwn(view.body.game,'worldVersion'));const input=await f.request(f.route+'/input',{seq:1,dx:1,dy:0},f.host.cookie);assert.equal(input.status,409);assert.equal(input.body.error.code,'WORLD_REQUIRED');
});

test('world snapshot validator rejects damaged schema/motion/coordinates and quarantines only invalid files',async t=>{
 const dataDir=await directory(t,'quarantine'),store=await createRoomStore(dataDir,{worldGeometry:geometry});t.after(async()=>{await store.close();assert(path.resolve(dataDir).startsWith(path.resolve(temporary)+path.sep));await rm(dataDir,{recursive:true,force:true});});const good=snapshot();await store.save(good);
 for(const mutate of [s=>{s.schemaVersion=3;},s=>{s.worldVersion=2;},s=>{s.schemaVersion=1;},s=>{s.players[0].motion.seq=-1;},s=>{s.players[0].motion.dx=2;},s=>{s.players[0].position.x=Infinity;},s=>{s.players[0].position={x:0,y:0};},s=>{s.players[0].motion.path=Array.from({length:4097},()=>({x:728,y:272}));},s=>{s.players[0].motion.leaseUntil+=WORLD.inputLeaseMs+1;},s=>{s.players[0].motion.manual=true;},s=>{s.players[1].id='p1';},s=>{s.bodies.push({id:'body-p2',playerId:'p2',roomId:'bridge',reported:false,at:100000});}]){const bad=structuredClone(good);mutate(bad.state);await assert.rejects(validateRoomSnapshot(bad,{worldGeometry:geometry}));}
 const bad=structuredClone(good);bad.state.players[0].motion.seq=-1;await writeFile(path.join(dataDir,`room-${bad.id}.json`),JSON.stringify(bad));assert.deepEqual(await store.load(),[]);assert((await readdir(dataDir)).some(file=>file.includes('.quarantine-')));
});

test('missing geometry is a setup error and preserves a valid world checkpoint',async t=>{
 const dataDir=await directory(t,'missing-geometry'),good=snapshot(),file=path.join(dataDir,`room-${good.id}.json`);await writeFile(file,JSON.stringify(good));const original=await readFile(file,'utf8');const store=await createRoomStore(dataDir,{worldGeometry:{}});try{await assert.rejects(store.load(),/World geometry is unavailable/);assert.equal(await readFile(file,'utf8'),original);assert(!(await readdir(dataDir)).some(name=>name.includes('quarantine')));}finally{await store.close();assert(path.resolve(dataDir).startsWith(path.resolve(temporary)+path.sep));await rm(dataDir,{recursive:true,force:true});}
});

test('actual Core denial receipt: discussion retry stays denied after restart and roaming, fresh sequence moves without spend',async t=>{
 const f=await service(t,{rules:{meetingCooldownMs:1,discussionMs:1000,votingMs:1000}});
 assert.equal(p1(f).motion.error,null);
 assert.equal((await f.request(f.route+'/input',{seq:1,dx:1,dy:0},f.host.cookie)).status,200);
 assert.equal(p1(f).motion.error,null);
 await f.game.close();
 const privateContext={privateDenialFixture:'preexisting-reservation',reservedCalls:1};
 const backing=await createRoomStore(f.dataDir,{worldGeometry:geometry});try{const [room]=await backing.load();room.aiContext=privateContext;await backing.save(room);}finally{await backing.close();}
 const daily=await createDailyBudget({directory:f.dataDir,maxCostUsd:5,now:()=>f.now});await daily.reserve({id:f.id+':denial-existing-reservation',amount:.0123});
 const ledgerBefore=await readFile(path.join(f.dataDir,'ai-daily-budget.json'),'utf8');await f.restart();
 f.advance(2);assert.equal((await f.request(f.route+'/action',{id:'denial-receipt-council',type:'meeting'},f.host.cookie)).status,200);
 const input={seq:2,dx:-1,dy:1},denied=await f.request(f.route+'/input',input,f.host.cookie);
 assert.equal(denied.status,409);assert.equal(denied.body.error.code,'WRONG_PHASE');assert.deepEqual(p1(f).motion.error,denied.body.error);assert.equal(p1(f).motion.seq,2);
 const saved=JSON.parse(await readFile(path.join(f.dataDir,'room-'+f.id+'.json'),'utf8'));assert.deepEqual(saved.state.players[0].motion.error,denied.body.error);await validateRoomSnapshot(saved,{worldGeometry:geometry});
 await f.restart();assert.deepEqual(p1(f).motion.error,denied.body.error);
 const version=f.game.rooms.get(f.id).data.state.version,retry=await f.request(f.route+'/input',input,f.host.cookie);assert.deepEqual(retry, {status:409,body:denied.body,cookie:undefined});assert.equal(f.game.rooms.get(f.id).data.state.version,version);
 const observer=await f.request(f.route+'/join',{});
 const socket=new WebSocket(f.base.replace('http:','ws:')+f.route+'/socket',{headers:{Origin:origin,Cookie:observer.cookie}});t.after(()=>socket.terminate());
 const [raw]=await once(socket,'message'),socketView=JSON.parse(raw.toString());socket.terminate();
 for(const view of [(await f.request(f.route,undefined,f.host.cookie)).body,(await f.request(f.route,undefined,observer.cookie)).body,socketView.room]){
  assert(!JSON.stringify(view).includes('WRONG_PHASE'));assert(!JSON.stringify(view).includes('privateDenialFixture'));
  for(const player of view.game.players){assert(!Object.hasOwn(player,'motion'));assert(!Object.hasOwn(player,'error'));if(player.id!=='p1')assert(!Object.hasOwn(player,'inputSeq'));}
  if(view.seatId===null)assert.equal(view.game.self,null);else assert(!Object.hasOwn(view.game.self,'error'));
 }
 f.advance(2001);await until(()=>f.game.rooms.get(f.id).data.state.phase==='roam','council with no votes resumes roaming');
 const position={...p1(f).position},resumedVersion=f.game.rooms.get(f.id).data.state.version;
 assert.deepEqual((await f.request(f.route+'/input',input,f.host.cookie)).body,denied.body);assert.equal(f.game.rooms.get(f.id).data.state.version,resumedVersion);assert.equal(p1(f).motion.manual,false);
 assert.equal((await f.request(f.route+'/input',{...input,dx:1},f.host.cookie)).body.error.code,'INPUT_CONFLICT');
 assert.equal((await f.request(f.route+'/input',{seq:3,dx:1,dy:0},f.host.cookie)).status,200);assert.equal(p1(f).motion.error,null);f.advance(200);await until(()=>p1(f).motion.at===f.now,'fresh sequence moves after retained denial');assert(distance(position,p1(f).position)>0);
 assert.deepEqual(f.game.rooms.get(f.id).data.aiContext,privateContext);await f.game.close();assert.equal(await readFile(path.join(f.dataDir,'ai-daily-budget.json'),'utf8'),ledgerBefore);
});

test('motion error snapshot shape: initial, old missing and restored denial valid; malformed errors rejected and quarantined',async t=>{
 const dataDir=await directory(t,'motion-error'),store=await createRoomStore(dataDir,{worldGeometry:geometry});t.after(async()=>{await store.close();assert(path.resolve(dataDir).startsWith(path.resolve(temporary)+path.sep));await rm(dataDir,{recursive:true,force:true});});
 const good=snapshot();assert.equal(good.state.players[0].motion.error,null);await store.save(good);
 const old=structuredClone(good);for(const p of old.state.players)delete p.motion.error;await validateRoomSnapshot(old,{worldGeometry:geometry});await store.save(old);assert(!Object.hasOwn((await store.load())[0].state.players[0].motion,'error'));
 const denied=structuredClone(good);Object.assign(denied.state.players[0].motion,{seq:1,dx:1,error:{code:'WRONG_PHASE',message:'Movement requires roaming.'}});await store.save(denied);assert.deepEqual((await store.load())[0],denied);
 const backup=await store.backup(denied.id);assert.deepEqual(JSON.parse(await readFile(backup.file,'utf8')),denied);
 const badErrors=[false,0,'WRONG_PHASE',[],{}, {code:'WRONG_PHASE'},{message:'Movement requires roaming.'},{code:1,message:'denied'},{code:'wrong_phase',message:'denied'},{code:'A'.repeat(65),message:'denied'},{code:'WRONG_PHASE',message:''},{code:'WRONG_PHASE',message:9},{code:'WRONG_PHASE',message:'x'.repeat(241)},{code:'WRONG_PHASE',message:'denied',private:'not permitted'}];
 for(const error of badErrors){const bad=structuredClone(denied);bad.state.players[0].motion.error=error;await assert.rejects(validateRoomSnapshot(bad,{worldGeometry:geometry}),/Invalid world motion error/,JSON.stringify(error));}
 const invalid=structuredClone(denied);invalid.state.players[0].motion.error={code:'WRONG_PHASE',message:'denied',private:'not permitted'};
 const file=path.join(dataDir,'room-'+invalid.id+'.json');await writeFile(file,JSON.stringify(invalid));assert.deepEqual(await store.load(),[]);assert((await readdir(dataDir)).some(name=>name.includes('.quarantine-')));assert.deepEqual(JSON.parse(await readFile(backup.file,'utf8')),denied);
});
