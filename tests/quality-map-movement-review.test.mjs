/** Independent review of Core backend movement. Seeded fixtures; zero provider/browser calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.QUALITY_MAP_MOVEMENT_ROOT?pathToFileURL(path.resolve(process.env.QUALITY_MAP_MOVEMENT_ROOT)+path.sep):new URL('../',import.meta.url);
const [{getMap},{createSpatialWorld},engine,{createRoom,issueIdentity},{createRoomStore,validateRoomSnapshot}]=await Promise.all(['shared/maps/index.mjs','server/engine/world/index.mjs','server/engine/index.mjs','server/rooms.mjs','server/store.mjs'].map(f=>import(new URL(f,root))));
const map2={id:'beacon',version:2},copy=structuredClone,noop=()=>{},point=p=>({x:p.x,y:p.y});
const hasKey=(value,key)=>value!==null&&typeof value==='object'&&(Object.hasOwn(value,key)||Object.values(value).some(v=>hasKey(v,key)));
function fixture(map,start){const descriptor=getMap(map),w=createSpatialWorld(descriptor.geometry),s={schemaVersion:4,phase:'roam',updatedAt:100000,players:Array.from({length:4},(_,i)=>({id:'review_'+i,role:i===3?'saboteur':'crew',alive:true})),systems:{doors:[],transit:{},lights:{active:false}}};w.initialize(s,100000);s.players[0].position=copy(start);return{g:descriptor.geometry,w,s};}
// An analytic body/solid test deliberately does not use the solver's walkable helper.
function clearOfSolids(g,p){for(const r of g.WORLD_OBSTACLES){const dx=p.x-Math.max(r.x,Math.min(p.x,r.x+r.width)),dy=p.y-Math.max(r.y,Math.min(p.y,r.y+r.height));assert.ok(Math.hypot(dx,dy)>=g.WORLD.bodyRadius-1e-7,'Body overlaps '+r.id+': '+JSON.stringify(p));}}
function schedules(f,dx,dy){const results=[];for(const times of [[600],Array.from({length:600},(_,i)=>i+1),[13,99,101,283,499,600]]){const s=copy(f.s),p=s.players[0];f.w.input(p,{seq:1,dx,dy},100000);let previous=point(p.position),at=100000;for(const dt of times){f.w.settle(s,100000+dt,noop);clearOfSolids(f.g,p.position);assert.ok(f.g.distance(previous,p.position)<=180*(100000+dt-at)/1000+.002,'Per-step correction exceeds bounded walking speed');previous=point(p.position);at=100000+dt;}assert.equal(p.motion.manual,false);results.push(point(p.position));}for(const p of results)assert.ok(f.g.distance(p,results[0])<1e-6,JSON.stringify(results));return results[0];}
function match(options={}){const s=engine.createMatch({id:'quality-map-movement',tactical:true,stationTasks:true,map:map2,now:100000,seed:7,...options});assert.equal(s.schemaVersion,5,'Review the current explicit station/world preset');return s;}
function input(s,id,seq,dx,dy,now){const r=engine.applyInput(s,id,{seq,dx,dy},now);assert.equal(r.accepted,true,JSON.stringify(r.error));return r.state;}
function roomFixture(){const room=createRoom('human',100000,undefined,{tactical:true,stationTasks:true,mapId:map2});issueIdentity(room,true);room.startId='review:start';room.aiContext={costUsd:0.0123,privateMarker:'review-fixture'};room.state=engine.createMatch({id:room.id,tactical:true,stationTasks:true,map:map2,now:100000,seed:7});room.state=input(room.state,'p1',1,1,0,100000);room.state=engine.tick(room.state,100100).state;room.updatedAt=100100;return room;}
async function temporaryStore(t){const base=new URL('../_artifacts/test-temp/',import.meta.url);await mkdir(base,{recursive:true});const directory=await mkdtemp(new URL('quality-movement-review-',base));let store=await createRoomStore(directory);t.after(()=>store.close());return{directory,get store(){return store;},async restart(){await store.close();store=await createRoomStore(directory);return store.load();}};}

test('historical exact Beacon1/Annex1 corner controls retain slide progress and sparse/dense agreement',()=>{
 const failures=[];for(const [map,start]of [[{id:'beacon',version:1},{x:422,y:997}],[{id:'stormbreak-annex',version:1},{x:1365,y:146}]]){try{const f=fixture(map,start),end=schedules(f,1,1);assert.ok(end.y>start.y+60,'Original rounded-contact counterexample must actually slide: '+map.id);}catch(error){failures.push(map.id+': '+error.message);}}assert.deepEqual(failures,[],'Both historical invariants must pass; retain every failing map counterexample');
});

test('Beacon2 contact/speed, exact interaction range and direction-only input remain authoritative',()=>{
 const f=fixture(map2,{x:1131,y:280}),end=schedules(f,-1,1);assert.ok(end.y>340,'New Bridge equipment contact must slide, rather than snag');assert.equal(f.g.WORLD_OBSTACLES.length,56);
 let s=match(),actor=s.players.find(p=>p.role==='crew'),sab=s.players.find(p=>p.role==='saboteur'),site=getMap(map2).fixtures.repairs.lights[0];
 // Seed a range boundary; actual movement and repair below use real engine actions.
 actor.position={x:site.position.x+92.01,y:site.position.y};actor.roomId=site.roomId;
 let r=engine.applyAction(s,sab.id,{id:'range:lights',type:'systemSabotage',kind:'lights',targetId:'beacon'},100000);assert.equal(r.accepted,true);s=r.state;
 r=engine.applyAction(s,actor.id,{id:'range:outside',type:'systemRepair',systemId:'lights',siteId:site.id},100000);assert.equal(r.accepted,false);s=r.state;
 const before=copy(s);for(const request of [{seq:1,dx:2,dy:0},{seq:1,dx:1,dy:0,x:site.position.x},{seq:1,dx:1,dy:0,anchor:{position:site.position}},{seq:Number.MAX_SAFE_INTEGER+1,dx:1,dy:0}]){r=engine.applyInput(s,actor.id,request,100000);assert.equal(r.error.code,'INVALID_INPUT');assert.deepEqual(s,before);}
 s=input(s,actor.id,1,-1,0,100000);s=engine.tick(s,100001).state;r=engine.applyAction(s,actor.id,{id:'range:inside',type:'systemRepair',systemId:'lights',siteId:site.id},100001);assert.equal(r.accepted,true,JSON.stringify(r.error));s=input(r.state,actor.id,2,0,0,100001);const stopped=point(s.players.find(p=>p.id===actor.id).position),duplicate=engine.applyInput(s,actor.id,{seq:2,dx:0,dy:0},100001);assert.equal(duplicate.duplicate,true);assert.deepEqual(duplicate.state,s);assert.equal(engine.applyInput(s,actor.id,{seq:1,dx:1,dy:0},100001).error.code,'STALE_INPUT');s=engine.tick(s,101000).state;assert.deepEqual(s.players.find(p=>p.id===actor.id).position,stopped);
});

test('Beacon2 chronological closure/reopen rebases held steering without stale-origin correction or tunneling',()=>{
 let s=match(),actor=s.players.find(p=>p.role==='crew'),sab=s.players.find(p=>p.role==='saboteur'),door=getMap(map2).fixtures.doors[0];actor.position={x:1540,y:360};actor.roomId='bridge';
 let r=engine.applyAction(s,sab.id,{id:'door:close',type:'systemSabotage',kind:'door',targetId:door.id},100000);assert.equal(r.accepted,true);s=input(r.state,actor.id,1,1,0,100900);
 const advance=times=>{let c=copy(s);for(const at of times)c=engine.tick(c,at).state;return c;},sparse=advance([101100]),dense=advance([100950,101000,101001,101050,101100]);
 const p=sparse.players.find(p=>p.id===actor.id);assert.deepEqual(p.position,dense.players.find(p=>p.id===actor.id).position);assert.equal(sparse.systems.doors[0].status,'closed');assert.ok(Math.abs(p.position.x-(door.x-14))<.001);assert.equal(p.motion.anchor.at,101000);assert.equal(p.motion.anchor.doors,door.id);
 r=engine.applyAction(sparse,actor.id,{id:'door:reopen',type:'systemRepair',systemId:'door',siteId:door.id},101100);assert.equal(r.accepted,true,JSON.stringify(r.error));const origin=point(r.state.players.find(p=>p.id===actor.id).position);s=engine.tick(r.state,101200).state;const next=s.players.find(p=>p.id===actor.id);assert.ok(Math.abs(next.position.x-origin.x-18)<.001);assert.equal(next.motion.anchor.at,101100);assert.equal(next.motion.anchor.doors,'');s=input(s,actor.id,2,0,0,101200);assert.equal(s.players.find(p=>p.id===actor.id).motion.anchor,undefined);
});

test('real active-anchor backup/restart preserves trajectories and budgets while all permitted views omit private anchors',async t=>{
 const room=roomFixture(),f=await temporaryStore(t);await validateRoomSnapshot(room);assert.ok(room.state.players[0].motion.anchor);const original=copy(room);await f.store.save(room);const backup=await f.store.backup(room.id),bytes=await readFile(f.directory+'/room-'+room.id+'.json','utf8');assert.equal(await readFile(backup.file,'utf8'),bytes);
 const [restored]=await f.restart();assert.deepEqual(restored,room);assert.equal(restored.aiContext.costUsd,0.0123);assert.equal(await readFile(f.directory+'/room-'+room.id+'.json','utf8'),bytes);
 for(const id of [null,...room.state.players.map(p=>p.id)]){const view=engine.getPlayerView(restored.state,id,100100);assert.equal(hasKey(view,'anchor'),false);assert.equal(JSON.stringify(view).includes('review-fixture'),false);for(const p of view.players)assert.equal(p.motion,undefined);}
 const uninterrupted=engine.tick(original.state,100600).state,restarted=engine.tick(restored.state,100600).state;assert.deepEqual(restarted,uninterrupted);assert.equal(restarted.players[0].motion.anchor,undefined);assert.equal(restarted.players[0].motion.manual,false);
 const noAnchor=copy(room);delete noAnchor.state.players[0].motion.anchor;await validateRoomSnapshot(noAnchor);
 for(const bad of [{position:room.state.players[0].position,at:100101,doors:''},{position:room.state.players[0].position,at:100000,doors:17},{position:room.state.players[0].position,at:100000,doors:'',private:'field'}]){const corrupt=copy(room);corrupt.state.players[0].motion.anchor=bad;await assert.rejects(validateRoomSnapshot(corrupt),/anchor/);}
});

test('restore rejects a physically impossible remote steering anchor instead of teleporting on the next tick',async t=>{
 const room=roomFixture();await validateRoomSnapshot(room);const actor=room.state.players[0],before=point(actor.position);actor.motion.anchor.position={x:1200,y:1440};
 let accepted=false;try{await validateRoomSnapshot(room);accepted=true;}catch{/* The final rejection assertion checks the precise expected failure. */}
 if(accepted){const f=await temporaryStore(t);await f.store.save(room);const restored=await f.restart();assert.equal(restored.length,1,'Accepted corrupt anchor survives actual store restart');const step=engine.tick(restored[0].state,100101).state.players[0].position;t.diagnostic(JSON.stringify({fixture:'corrupt private checkpoint saved and loaded through real store; not client-writable input',before,after:step,distanceIn1ms:Math.hypot(step.x-before.x,step.y-before.y),permittedIn1ms:.18}));}
 await assert.rejects(validateRoomSnapshot(room),/anchor/,'A checkpoint cannot have an anchor farther from its actor than maximum elapsed movement permits');
});

test('bounded twelve-actor Beacon2 contact harness reports actual engine tick median/p95 with 56 solids',t=>{
 const roster=Array.from({length:12},(_,i)=>({id:'review_'+i,name:'Review '+i,color:'#aabbcc'}));let base=match({roster,saboteurCount:3});
 // Deliberate colocated solid-contact load, not normal spawn or a gameplay benchmark/FPS claim.
 for(const p of base.players){p.position={x:1131,y:280};p.roomId='bridge';}for(const p of base.players)base=input(base,p.id,1,-1,1,100000);
 const samples=[];for(let trial=-3;trial<18;trial++){let s=copy(base);for(let i=1;i<=6;i++){const start=performance.now();s=engine.tick(s,100000+i*100).state;const elapsed=performance.now()-start;if(trial>=0)samples.push(elapsed);}for(const p of s.players){clearOfSolids(getMap(map2).geometry,p.position);assert.equal(p.motion.manual,false);}}
 samples.sort((a,b)=>a-b);t.diagnostic(JSON.stringify({fixture:'full engine tick, 12 intentionally colocated contact actors, 56 solids, six 100ms ticks per lease, three warmups, 18 trials',samples:samples.length,medianMs:samples[Math.floor(samples.length/2)],p95Ms:samples[Math.ceil(samples.length*.95)-1],maxMs:samples.at(-1)}));assert.equal(samples.length,108);
});
