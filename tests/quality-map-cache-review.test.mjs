/** Independent functional cache audit. No timing/profile thresholds, providers or browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.env.QUALITY_MAP_CACHE_ROOT?pathToFileURL(path.resolve(process.env.QUALITY_MAP_CACHE_ROOT)+path.sep):new URL('../',import.meta.url);
const [{getMap},{spatialGeometry},engine]=await Promise.all(['shared/maps/index.mjs','server/engine/world/geometry.mjs','server/engine/index.mjs'].map(f=>import(new URL(f,root))));
// Compare actual pre-cache code, not a second execution of the candidate with caching toggled.
const baselinePin='a34d9797a2c77b8b59b51d4bc257b5281529c353',specifier="'../../../shared/beacon.mjs'";
const baselineSource=execFileSync('git',['show',baselinePin+':server/engine/world/geometry.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',maxBuffer:1024*1024});
assert.ok(baselineSource.includes(specifier),'Pinned baseline import must resolve against the same immutable public fixtures');
const {spatialGeometry:baselineGeometry}=await import('data:text/javascript;base64,'+Buffer.from(baselineSource.replace(specifier,JSON.stringify(new URL('shared/beacon.mjs',root).href))).toString('base64'));
const map={id:'beacon',version:2},m=getMap(map),point=p=>({x:p.x,y:p.y}),copy=structuredClone;
const state=(ids=[])=>({systems:{doors:ids.map(id=>({id,closed:true})),transit:{}},privateBudget:{costUsd:.0123},privateActor:{id:'canary-seat',anchor:{position:{x:777,y:888}}}});
function legal(g,from,to,s,route){assert.ok(route,'Expected reachable public destination');assert.ok(route.length<=4096);assert.deepEqual(route.at(-1),to);assert.equal(g.routeClear(from,route,s),true);for(const p of route)assert.deepEqual(Object.keys(p).sort(),['x','y']);}

test('actual a34 baseline and fresh/reused cached factories agree through Beacon2 open/closed/open and over-four-signature churn',()=>{
 const reference=baselineGeometry(m.geometry),reused=spatialGeometry(m.geometry),d=m.fixtures.doors.map(d=>d.id),states=[[],[d[0],d[1]],[d[2]],[d[3]],[d[4]],[d[0]],[d[1],d[2]],[d[0],d[1]],[]];
 const queries=[['archive','engine'],['bridge','reservoir']].map(pair=>pair.map(id=>point(m.geometry.WORLD_STATIONS[id])));
 for(const ids of states)for(const [from,to]of queries){const s=state(ids),before=copy(s),expected=reference.path(from,to,s),cold=spatialGeometry(m.geometry).path(from,to,s),warm=reused.path(from,to,s),again=reused.path(from,to,s);legal(reference,from,to,s,expected);assert.deepEqual(cold,expected);assert.deepEqual(warm,expected);assert.deepEqual(again,expected);legal(reused,from,to,s,warm);assert.deepEqual(s,before);}
});

test('warm Beacon2 detour never replaces an accepted polyline; irrelevant closure preserves it and relevant closure invalidates at its exact boundary',()=>{
 const door=m.fixtures.doors[0],unrelated=m.fixtures.doors[1],target={x:1830,y:360};let serial=0;
 function fixture(id){const s=engine.createMatch({id,tactical:true,stationTasks:true,map,seed:7,now:100000,beaconRules:{auxiliaryCooldownMs:1}});assert.equal(s.schemaVersion,5);const actor=s.players.find(p=>p.role==='crew'),sab=s.players.find(p=>p.role==='saboteur');actor.position={x:1360,y:360};actor.roomId='bridge';return{s,actor:actor.id,sab:sab.id};}
 function action(s,actor,type,fields,now,id='cache:'+ ++serial){const r=engine.applyAction(s,actor,{id,type,...fields},now);assert.equal(r.accepted,true,JSON.stringify(r.error));return r.state;}
 // Real isolated warmup match, with a legal seeded approach and actual sabotage/tick/navigation.
 const warm=fixture('cache-warm-match');let w=action(warm.s,warm.sab,'systemSabotage',{kind:'door',targetId:door.id},100000);w=engine.tick(w,101000).state;w=action(w,warm.actor,'navigate',target,101000);assert.ok(w.players.find(p=>p.id===warm.actor).motion.path.length>1);
 const f=fixture('cache-active-match');let s=action(f.s,f.actor,'navigate',target,100000,'cache:accepted');const accepted=copy(s.players.find(p=>p.id===f.actor).motion.path);assert.deepEqual(accepted,[target]);
 s=action(s,f.sab,'systemSabotage',{kind:'door',targetId:unrelated.id},100000);s=action(s,f.sab,'systemSabotage',{kind:'door',targetId:door.id},100001);const receipts=copy(s.requests);
 s=engine.tick(s,101000).state;let actor=s.players.find(p=>p.id===f.actor);assert.equal(s.systems.doors.find(d=>d.id===unrelated.id).closed,true);assert.deepEqual(actor.motion.path,accepted);assert.ok(Math.abs(actor.position.x-1540)<.000001);
 s=engine.tick(s,101001).state;actor=s.players.find(p=>p.id===f.actor);assert.ok(Math.abs(actor.position.x-1540.18)<.000001);assert.deepEqual(actor.motion.path,[]);assert.equal(actor.motion.destination,null);assert.deepEqual(s.requests,receipts);assert.ok(s.replay.some(e=>e.type==='motion'&&e.reason==='route_invalidated'&&e.playerId===f.actor&&e.at===101001));
 const exact=spatialGeometry(m.geometry);assert.equal(exact.routeClear(actor.position,accepted,s),false);const retry=engine.applyAction(s,f.actor,{id:'cache:accepted',type:'navigate',...target},101001);assert.equal(retry.duplicate,true);assert.deepEqual(retry.state,s);
 s=action(s,f.actor,'navigate',target,101201,'cache:new-detour');actor=s.players.find(p=>p.id===f.actor);assert.ok(actor.motion.path.length>1);legal(exact,actor.position,target,s,actor.motion.path);assert.deepEqual(actor.motion.path,baselineGeometry(m.geometry).path(actor.position,target,s));
});

test('cached legality retains no readable prior-query proxies and cannot cross-contaminate an immutable sibling collision scope',()=>{
 const g=spatialGeometry(m.geometry),from=point(m.geometry.WORLD_STATIONS.bridge),to=point(m.geometry.WORLD_STATIONS.navigation),firstState=state([m.fixtures.doors[0].id]),before=copy(firstState);
 const a=Proxy.revocable({...from,privateActor:'canary-start'},{}),b=Proxy.revocable({...to,privateRole:'canary-target'},{}),s=Proxy.revocable(firstState,{}),route=g.path(a.proxy,b.proxy,s.proxy);legal(g,from,to,firstState,route);assert.deepEqual(firstState,before);a.revoke();b.revoke();s.revoke();
 // A later query must not read any actor/target/state object from an earlier query.
 const expected=copy(route);assert.deepEqual(g.path(from,to,state([m.fixtures.doors[0].id])),expected);route[0].x=-999;assert.deepEqual(g.path(from,to,state([m.fixtures.doors[0].id])),expected);
 // Test-only frozen sibling uses the same map dimensions/door IDs, but a fixed solid partitions its entire hull.
 // Its inherited static helper proposes an unsafe route; exact Core validation must reject it and its own grid must stay isolated.
 const divider=Object.freeze({id:'review-divider',x:1570,y:0,width:60,height:2400}),geometry=Object.freeze({...m.geometry,WORLD_OBSTACLES:Object.freeze([...m.geometry.WORLD_OBSTACLES,divider]),isWalkable(p,r=m.geometry.WORLD.bodyRadius){const x=Math.max(divider.x,Math.min(p.x,divider.x+divider.width)),y=Math.max(divider.y,Math.min(p.y,divider.y+divider.height));return m.geometry.isWalkable(p,r)&&Math.hypot(p.x-x,p.y-y)>=r;}}),sibling=spatialGeometry(geometry);
 const original=copy(m.geometry.WORLD_OBSTACLES);assert.ok(g.path(from,to,state()));assert.equal(sibling.path(from,to,state()),null);assert.equal(sibling.path(from,to,state([m.fixtures.doors[0].id])),null);assert.ok(g.path(from,to,state()));assert.deepEqual(m.geometry.WORLD_OBSTACLES,original);assert.throws(()=>{geometry.WORLD_OBSTACLES.push(divider);},TypeError);
});
