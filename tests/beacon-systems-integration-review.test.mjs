/** Independent coordinator-boundary review. Actual selected runtime, real local HTTP/WS/store; no providers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {WebSocket} from 'ws';
const root=process.env.BEACON_SYSTEMS_REVIEW_ROOT?pathToFileURL(path.resolve(process.env.BEACON_SYSTEMS_REVIEW_ROOT)+path.sep):new URL('../',import.meta.url);
const load=relative=>import(new URL(relative,root));
const [transport,engine,rooms,storage,budget,geometry,beacon,spatialModule]=await Promise.all(['server/transport.mjs','server/engine/index.mjs','server/rooms.mjs','server/store.mjs','server/budget.mjs','shared/world.mjs','shared/beacon.mjs','server/engine/world/index.mjs'].map(load));
const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url)),origin='http://beacon-integration-review.test',marker='SYNTHETIC_PRIVATE_BOUNDARY_MARKER';
const roster=['captain','signal','archivist','medic','pilot','engineer','scout','cook'].map((id,i)=>({id,name:'Review keeper '+i,color:'#89aabb',persona:'Public synthetic keeper '+i}));
const ai={describe:()=>({mode:'demo',calls:0,tokens:0,costUsd:0,apiKey:marker,reasoning:marker}),decide:async()=>null};
async function fixture(t,{config:overrides={},seed}={}){
 await mkdir(temporary,{recursive:true});const directory=await mkdtemp(path.join(temporary,'beacon-systems-integration-review-'));let now=100000,game,base;
 const config={dataDir:directory,publicOrigin:origin,now:()=>now,worldMode:true,systemsMode:true,tickMs:100000,maxActiveRooms:12,roomTtlMs:3600000,ai:{provider:'demo',maxDailyCostUsd:5,decisionIntervalMs:100000},rules:{sabotageCooldownMs:1,criticalDurationMs:200000,initialKillCooldownMs:1000000,roamDeadlineMs:1000000,maxMatchMs:2000000},lobbyConfig:{roster,saboteurCount:2,humanPlayerIds:['signal','captain']},...overrides};
 t.after(async()=>{await game?.close();assert(path.resolve(directory).startsWith(path.resolve(temporary)+path.sep));await rm(directory,{recursive:true,force:true});});
 const control={directory,config,get game(){return game;},get now(){return now;},get base(){return base;},advance(ms){now+=ms;},setNow(value){now=value;}};
 if(seed)control.seed=await seed(control);
 async function launch(){game=await transport.createGameServer(config,{engine,aiController:ai});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base='http://127.0.0.1:'+game.server.address().port;}
 await launch();
 control.request=async(route,data,cookie,extra={})=>{const response=await fetch(base+route,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json'}),...extra},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 control.restart=async(changes={})=>{await game.close();Object.assign(config,changes);await launch();};return control;
}
async function started(f,mode='human'){
 const host=await f.request('/api/rooms',{mode});assert.equal(host.status,201);const route='/api/rooms/'+host.body.roomId;const start=await f.request(route+'/start',{id:'review-start'},host.cookie);assert.equal(start.status,200);return {...host,id:host.body.roomId,route,start:start.body};
}
function safeView(view){
 assert(!JSON.stringify(view).includes(marker));for(const player of view.game?.players??[]){assert(!Object.hasOwn(player,'role'));assert(!Object.hasOwn(player,'motion'));assert(!Object.hasOwn(player,'knowledge'));}
 for(const forbidden of ['aiContext','identities','repairers','repairedBy','originRoomId','visibleTo','apiKey','reasoning'])assert(!JSON.stringify(view).includes('"'+forbidden+'"'),forbidden);
 if(view.game?.systems){assert.equal(view.game.systems.transit,undefined);if(view.seatId===null){assert.equal(view.game.self,null);assert.equal(view.game.systems.selfTransit,null);assert.equal(view.game.systems.cooldowns,null);}}
}
async function seeded(f,{roles=()=>true,critical}={}){
 const room=rooms.createRoom('human',f.now,f.config.lobbyConfig),host=rooms.issueIdentity(room,true),second=rooms.issueIdentity(room);second.identity.seatId='captain';let state;
 for(let i=0;i<200;i++){state=engine.createMatch({id:room.id,mode:'human',world:true,systems:true,roster,humanPlayerIds:['signal','captain'],saboteurCount:2,seed:'boundary-'+i,now:f.now,config:f.config.rules});if(roles(state))break;state=null;}assert(state,'seed predicate must be satisfied');
 if(critical){const actor=state.players.find(p=>p.role==='saboteur');f.advance(1);const result=engine.applyAction(state,actor.id,{id:'fixture-critical',type:'systemSabotage',kind:critical,targetId:'beacon'},f.now);assert(result.accepted);state=result.state;}
 room.startId='seed-start';room.state=state;room.updatedAt=f.now;room.aiContext={privateReview:marker,reservedCalls:1};
 const store=await storage.createRoomStore(f.directory);try{await store.save(room);}finally{await store.close();}
 const ledger=await budget.createDailyBudget({directory:f.directory,maxCostUsd:5,now:()=>f.now});await ledger.reserve({id:room.id+':preexisting',amount:.0123});
 return {id:room.id,route:'/api/rooms/'+room.id,host:rooms.cookieName(room.id)+'='+host.token,second:rooms.cookieName(room.id)+'='+second.token,ledger:await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8')};
}
async function travel(f,seed,cookie,actorId,target,label){
 const state=f.game.rooms.get(seed.id).data.state,p=state.players.find(p=>p.id===actorId),spatial=spatialModule.createSpatialWorld(geometry),path=spatial.navigation(p,target,f.now,state);assert(path,'actual public route must be reachable');let length=0,last=p.position;for(const point of path){length+=geometry.distance(last,point);last=point;}
 assert.equal((await f.request(seed.route+'/action',{id:'go-'+label,type:'navigate',x:target.x,y:target.y},cookie)).status,200);f.advance(Math.ceil(length/geometry.WORLD.speed*1000)+1);assert.equal((await f.request(seed.route+'/action',{id:'arrive-'+label,type:'wait'},cookie)).status,200);assert(geometry.distance(f.game.rooms.get(seed.id).data.state.players.find(p=>p.id===actorId).position,target)<.01);
}

test('coordinator schema3 HTTP binds custom primary identity, rejects cross-room/spectator/actor injection and keeps private views safe',async t=>{
 const f=await fixture(t),a=await started(f),b=await started(f);assert.equal(a.start.seatId,'signal');assert.equal(a.start.game.self.id,'signal');assert.equal(a.start.roster.length,8);assert.equal(f.game.rooms.get(a.id).data.state.schemaVersion,3);assert.equal(f.game.rooms.get(a.id).data.state.players.filter(p=>p.role==='saboteur').length,2);
 const spectator=await f.request(a.route+'/join',{});assert.equal(spectator.body.seatId,null);for(const [suffix,body]of [['',undefined],['/input',{seq:1,dx:1,dy:0}],['/action',{id:'foreign',type:'wait'}]])assert.equal((await f.request(a.route+suffix,body,b.cookie)).status,401);
 for(const suffix of ['/input','/action'])assert.equal((await f.request(a.route+suffix,suffix==='/input'?{seq:1,dx:1,dy:0}:{id:'observer',type:'wait'},spectator.cookie)).status,403);
 assert.equal((await f.request(a.route+'/input',{seq:1,dx:1,dy:0,playerId:'captain'},a.cookie)).status,400);assert.equal((await f.request(a.route+'/action',{id:'actor-extra',type:'wait',playerId:'captain'},a.cookie)).status,409);assert.equal((await f.request(a.route+'/input',{seq:1,dx:0,dy:0},a.cookie)).status,200);
 const state=f.game.rooms.get(a.id).data.state;assert.equal(state.players.find(p=>p.id==='signal').motion.seq,1);assert.equal(state.players.find(p=>p.id==='captain').motion.seq,0);assert.equal((await f.request(a.route+'/input',{seq:2,dx:0,dy:0},a.cookie,{Origin:'http://foreign.test'})).status,403);assert.equal((await f.request(a.route,undefined,a.cookie+'; '+a.cookie)).status,401);
 safeView((await f.request(a.route,undefined,a.cookie)).body);safeView(spectator.body);assert.equal((await f.request(a.route+'/replay',undefined,a.cookie)).status,409);assert.equal((await f.request('/api/rooms',{mode:'human',roster})).status,400);
});

for(const id of ['toString','valueOf','hasOwnProperty'])test('coordinator admitted custom human ID '+id+' is not inherited transit',async t=>{
 const custom=roster.map((p,i)=>i? p:{...p,id}),f=await fixture(t,{config:{lobbyConfig:{roster:custom,saboteurCount:2,humanPlayerIds:[id]}}}),host=await started(f);assert.equal(host.start.game.self.id,id);const moved=await f.request(host.route+'/input',{seq:1,dx:0,dy:0},host.cookie);assert.equal(moved.status,200,'admitted custom actor '+id+' must not be falsely IN_TRANSIT: '+JSON.stringify(moved.body));
});
test('trusted two-human fixture: HTTP actor receipts and private field notes remain seat-bound across restart with unchanged budget',async t=>{
 const f=await fixture(t,{seed:f=>seeded(f)}),s=f.seed,a={id:'same-per-actor-id',type:'ability',abilityId:'field-note',targetId:'signal'},b={...a,targetId:'captain'};
 const results=await Promise.all([f.request(s.route+'/action',a,s.host),f.request(s.route+'/action',b,s.second)]);assert(results.every(r=>r.status===200));assert.equal(results[0].body.game.self.id,'signal');assert.equal(results[1].body.game.self.id,'captain');assert.equal(results[0].body.game.abilities.notes.length,1);assert.equal(results[1].body.game.abilities.notes.length,1);
 const denied={id:'denied-cross-actor',type:'ability',abilityId:'field-note',targetId:'signal'};const denial=await f.request(s.route+'/action',denied,s.second);assert.equal(denial.status,409);assert.equal(denial.body.error.code,'INVALID_TARGET');
 const before=structuredClone(f.game.rooms.get(s.id).data);assert.equal(before.state.requests.signal.filter(r=>r.id===a.id).length,1);assert.equal(before.state.requests.captain.filter(r=>r.id===a.id).length,1);assert.equal(before.state.requests.captain.find(r=>r.id===denied.id).accepted,false);
 await f.restart();assert.deepEqual(f.game.rooms.get(s.id).data.identities,before.identities);const version=f.game.rooms.get(s.id).data.state.version;
 for(const [action,cookie]of [[a,s.host],[b,s.second]]){const retry=await f.request(s.route+'/action',action,cookie);assert.equal(retry.status,200);assert.equal(retry.body.game.abilities.notes.length,1);safeView(retry.body);}
 assert.deepEqual((await f.request(s.route+'/action',denied,s.second)).body,denial.body);assert.equal(f.game.rooms.get(s.id).data.state.version,version);assert.equal((await f.request(s.route+'/action',{...denied,targetId:'captain'},s.second)).body.error.code,'REQUEST_CONFLICT');
 const own=(await f.request(s.route,undefined,s.host)).body,other=(await f.request(s.route,undefined,s.second)).body;assert(own.game.abilities.notes[0].id.includes('signal'));assert(other.game.abilities.notes[0].id.includes('captain'));assert(!JSON.stringify(other).includes(own.game.abilities.notes[0].id));assert.deepEqual(f.game.rooms.get(s.id).data.aiContext,before.aiContext);assert.equal(await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8'),s.ledger);
});

test('coordinator critical projection sanitizes real private contributor state across both human seats, spectator HTTP/WS and restart',async t=>{
 const f=await fixture(t,{seed:f=>seeded(f,{critical:'power',roles:s=>s.players.filter(p=>['signal','captain'].includes(p.id)).every(p=>p.role==='crew')})}),s=f.seed,sites=beacon.BEACON_REPAIRS.power;
 await travel(f,s,s.host,'signal',sites[0].position,'power-east');const repair={id:'private-repair-contribution',type:'systemRepair',systemId:'power',siteId:sites[0].id};assert.equal((await f.request(s.route+'/action',repair,s.host)).status,200);
 const raw=f.game.rooms.get(s.id).data.state.sabotage;assert.equal(raw.sites[0].repairedBy,'signal');assert.deepEqual(raw.repairers,['signal']);assert.equal(raw.repairsCompleted,1);
 const observer=await f.request(s.route+'/join',{});for(const cookie of [s.host,s.second,observer.cookie]){const view=(await f.request(s.route,undefined,cookie)).body;safeView(view);assert.equal(view.game.sabotage.repairsCompleted,1);assert.deepEqual(view.game.sabotage,view.game.systems.critical);assert(view.game.sabotage.sites.every(site=>!Object.hasOwn(site,'repairedBy')&&!Object.hasOwn(site,'repairedAt')));}
 const ws=new WebSocket(f.base.replace('http:','ws:')+s.route+'/socket',{headers:{Origin:origin,Cookie:observer.cookie}});t.after(()=>ws.terminate());const [message]=await once(ws,'message');safeView(JSON.parse(message.toString()).room);ws.terminate();
 await f.restart();assert.equal(f.game.rooms.get(s.id).data.state.sabotage.sites[0].repairedBy,'signal');assert.equal((await f.request(s.route+'/action',repair,s.host)).status,200);assert.equal(f.game.rooms.get(s.id).data.state.sabotage.repairsCompleted,1);
 await travel(f,s,s.second,'captain',sites[1].position,'power-west');assert.equal((await f.request(s.route+'/action',{id:'second-repair',type:'systemRepair',systemId:'power',siteId:sites[1].id},s.second)).status,200);assert.equal(f.game.rooms.get(s.id).data.state.sabotage.active,false);safeView((await f.request(s.route,undefined,observer.cookie)).body);assert.equal(await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8'),s.ledger);
});

test('coordinator HTTP transit stays actor-private; persisted denied input remains denied after arrival/restart and a fresh sequence works',async t=>{
 const f=await fixture(t,{seed:f=>seeded(f,{roles:s=>s.players.find(p=>p.id==='signal').role==='saboteur'&&s.players.find(p=>p.id==='captain').role==='crew'})}),s=f.seed,entry=beacon.BEACON_VENTS[0],exit=beacon.BEACON_VENTS.find(v=>v.id===entry.links[0]);
 await travel(f,s,s.host,'signal',entry.position,'hatch');const observer=await f.request(s.route+'/join',{});assert.equal((await f.request(s.route+'/action',{id:'take-hatch',type:'vent',entryId:entry.id,exitId:exit.id},s.host)).status,200);const state=f.game.rooms.get(s.id).data.state,deadline=state.systems.transit.signal.deadlineAt;assert.equal(state.systems.transit.signal.exitId,exit.id);
 const own=(await f.request(s.route,undefined,s.host)).body;assert.equal(own.game.self.transit.exitId,exit.id);assert.equal(own.game.systems.selfTransit.exitId,exit.id);safeView(own);
 for(const cookie of [s.second,observer.cookie]){const view=(await f.request(s.route,undefined,cookie)).body;safeView(view);assert.equal(view.game.systems.selfTransit,null);assert.equal(view.game.players.find(p=>p.id==='signal').position,null);assert(!JSON.stringify(view).includes('"entryId"'));assert(!JSON.stringify(view).includes('"exitId"'));}
 const deniedInput={seq:9,dx:1,dy:0},denied=await f.request(s.route+'/input',deniedInput,s.host);assert.equal(denied.status,409);assert.equal(denied.body.error.code,'IN_TRANSIT');assert.equal((await f.request(s.route+'/input',{seq:1,dx:0,dy:0},s.second)).status,200);assert.equal((await f.request(s.route+'/action',{id:'while-transit',type:'ability',abilityId:'field-note',targetId:'signal'},s.host)).body.error.code,'IN_TRANSIT');
 await f.restart();f.advance(deadline-f.now);const retry=await f.request(s.route+'/input',deniedInput,s.host);assert.equal(retry.status,409);assert.deepEqual(retry.body,denied.body);assert.equal(f.game.rooms.get(s.id).data.state.systems.transit.signal,undefined);assert.deepEqual(f.game.rooms.get(s.id).data.state.players.find(p=>p.id==='signal').position,exit.position);assert.equal((await f.request(s.route+'/input',{seq:10,dx:0,dy:0},s.host)).status,200);safeView((await f.request(s.route,undefined,observer.cookie)).body);assert.equal(await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8'),s.ledger);
});

test('coordinator restores legacy schema1/2 matches with unchanged identities/receipts when new-room policy enables schema3',async t=>{
 for(const worldMode of [false,true]){
  const f=await fixture(t,{config:{systemsMode:false,worldMode}}),host=await started(f),legacy=f.game.rooms.get(host.id).data;assert.equal(legacy.schema,1);assert.equal(legacy.state.schemaVersion,worldMode?2:1);assert.equal(host.start.seatId,'p1');
  const action={id:'legacy-accepted',type:'wait'};assert.equal((await f.request(host.route+'/action',action,host.cookie)).status,200);if(worldMode)assert.equal((await f.request(host.route+'/input',{seq:7,dx:0,dy:0},host.cookie)).status,200);
  const bytes=await readFile(path.join(f.directory,'room-'+host.id+'.json'),'utf8');await f.restart({systemsMode:true,worldMode:true});assert.equal(await readFile(path.join(f.directory,'room-'+host.id+'.json'),'utf8'),bytes);const restored=(await f.request(host.route,undefined,host.cookie)).body;assert.equal(restored.seatId,'p1');assert.equal(restored.game.beaconVersion,undefined);assert.equal(restored.game.worldVersion,worldMode?1:undefined);assert.equal((await f.request(host.route+'/action',action,host.cookie)).status,200);assert.equal((await f.request(host.route+'/start',{id:'review-start'},host.cookie)).status,200);assert.equal((await f.request(host.route+'/action',{id:'not-legacy',type:'systemSabotage',kind:'lights',targetId:'beacon'},host.cookie)).status,409);
  const fresh=await started(f);assert.equal(fresh.start.game.beaconVersion,1);assert.equal(fresh.start.seatId,'signal');assert.equal(f.game.rooms.get(host.id).data.state.schemaVersion,worldMode?2:1);
 }
});

test('coordinator store rejects mismatched schema3 roster/seat/receipt data; backup and quarantine preserve original private evidence',async t=>{
 const f=await fixture(t,{seed:f=>seeded(f)}),s=f.seed;assert.equal((await f.request(s.route+'/action',{id:'saved-note',type:'ability',abilityId:'field-note',targetId:'signal'},s.host)).status,200);const valid=structuredClone(f.game.rooms.get(s.id).data);await storage.validateRoomSnapshot(valid);
 for(const mutate of [r=>{r.identities[1].seatId='signal';},r=>{r.identities[0].seatId='unconfigured';},r=>{r.lobby.humanPlayerIds=['captain'];},r=>{r.state.players.find(p=>p.id==='signal').human=false;},r=>{r.state.configuration.saboteurCount=1;},r=>{delete r.state.requests.signal;},r=>{r.state.requests.signal[0].accepted='yes';},r=>{r.state.requests.signal.push({...r.state.requests.signal[0]});},r=>{r.state.players[0].id='foreign';}]){const bad=structuredClone(valid);mutate(bad);await assert.rejects(storage.validateRoomSnapshot(bad));}
 await f.game.close();const store=await storage.createRoomStore(f.directory);try{const backup=await store.backup(s.id),original=await readFile(backup.file,'utf8');assert.deepEqual(JSON.parse(original),valid);const bad=structuredClone(valid);bad.identities[1].seatId='signal';await writeFile(path.join(f.directory,'room-'+s.id+'.json'),JSON.stringify(bad));assert.deepEqual(await store.load(),[]);assert((await readdir(f.directory)).some(name=>name.includes('.quarantine-')));assert.equal(await readFile(backup.file,'utf8'),original);assert.equal(await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8'),s.ledger);}finally{await store.close();}
});
