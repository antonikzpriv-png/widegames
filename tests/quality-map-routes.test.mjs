/** Native geometry/engine fixtures only. No browser, provider or user-data access. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {getMap} from '../shared/maps/index.mjs';
import {spatialGeometry} from '../server/engine/world/geometry.mjs';
import {createMatch,applyAction,tick,getPlayerView} from '../server/engine/index.mjs';
import {validateHatchNetwork} from '../server/engine/systems/model.mjs';
const m=getMap({id:'beacon',version:2}),g=m.geometry,stations=Object.values(g.WORLD_STATIONS);
const length=(start,route)=>{assert.ok(route,'Expected reachable target');let n=0,p=start;for(const q of route){n+=g.distance(p,q);p=q;}return n;};
const physical=spatialGeometry(g);
const validateRoute=(start,route,state={})=>{assert.ok(route);assert.ok(route.length<=4096);assert.ok(physical.routeClear(start,route,state),'Every accepted segment must clear actual colliders');};
test('all 196 station pairs are physically reachable; graph loops and clear room entrances are real',t=>{
 const times=[],start=performance.now();
 for(const a of stations)for(const b of stations){const route=g.findWorldPath(a,b);validateRoute(a,route);assert.deepEqual(route.at(-1)??{x:a.x,y:a.y},{x:b.x,y:b.y});times.push(length(a,route)/180);}
 assert.equal(m.roomLayout.reduce((n,r)=>n+r.neighbors.length,0)/2,20);
 for(const r of m.roomLayout)for(const id of r.neighbors){const other=m.roomLayout.find(q=>q.id===id);assert.ok(other.neighbors.includes(r.id));const a=g.WORLD_ROOMS.find(q=>q.id===r.id).center,b=g.WORLD_ROOMS.find(q=>q.id===id).center;assert.ok(physical.routeClear(a,[b],{}),'Central entrances must remain clear: '+r.id+'/'+id);}
 t.diagnostic(JSON.stringify({fixture:'196 ordered station routes; empty corridors; no interaction delay',speed:180,minNonzeroSeconds:Math.min(...times.filter(n=>n>0)),maxSeconds:Math.max(...times),routeMatrixMs:performance.now()-start,gridNodesUpper:Math.ceil(3200/28)*Math.ceil(2400/28)}));
});
test('every station, bell, hatch, camera, device and repair site has body clearance and a spawn route',()=>{
 assert.equal(validateHatchNetwork(m.fixtures.vents,g),true);
 const points=[...Array.from({length:12},(_,i)=>g.worldSpawn('p'+(i+1))),...stations,g.WORLD_BELL,g.WORLD_VIEWPOINT,...m.fixtures.vents.map(v=>v.position),...m.fixtures.devices.map(v=>v.position),...m.fixtures.cameras.map(v=>v.position),...Object.values(m.fixtures.repairs).flat().map(v=>v.position)];
 for(const p of points){assert.ok(g.isWalkable(p),JSON.stringify(p));const route=g.findWorldPath(g.worldSpawn('p1'),p);validateRoute(g.worldSpawn('p1'),route);}
 for(const [kind,sites]of Object.entries(m.fixtures.repairs)){assert.equal(sites.length,['power','flood'].includes(kind)?2:1);assert.equal(new Set(sites.map(s=>s.roomId)).size,sites.length);for(const s of sites)assert.equal(g.worldRoomAt(s.position),s.roomId);}
 for(const d of m.fixtures.doors){const horizontal=d.width>d.height,a=horizontal?{x:d.x+d.width/2,y:d.y-30}:{x:d.x-30,y:d.y+d.height/2},b=horizontal?{x:a.x,y:d.y+d.height+30}:{x:d.x+d.width+30,y:a.y};assert.ok(physical.routeClear(a,[b],{}),d.id);assert.equal(physical.routeClear(a,[b],{systems:{doors:[{id:d.id,closed:true}]}}),false,d.id);}
});
// Choose the farthest station by Manhattan center distance, then test the actual collision-aware alternate route.
// This is a bounded worst-origin control, not an assertion of shortest route optimality.
test('all ten door pairs keep critical repair routes usable comfortably within 75 seconds',t=>{
 const start=performance.now(),results=[];
 for(let i=0;i<m.fixtures.doors.length;i++)for(let j=i+1;j<m.fixtures.doors.length;j++){
  const closed=[m.fixtures.doors[i].id,m.fixtures.doors[j].id],state={systems:{doors:closed.map(id=>({id,closed:true}))}};
  const reached=new Set(['bridge']),queue=['bridge'];
  for(const id of queue){const room=m.roomLayout.find(r=>r.id===id),from=g.WORLD_ROOMS.find(r=>r.id===id).center;for(const next of room.neighbors)if(!reached.has(next)&&physical.routeClear(from,[g.WORLD_ROOMS.find(r=>r.id===next).center],state)){reached.add(next);queue.push(next);}}
  assert.equal(reached.size,14,'Every room retains an actual clear center-line route with '+closed.join('+'));
  for(const site of [...m.fixtures.repairs.power,...m.fixtures.repairs.flood]){
   const origin=stations.reduce((a,b)=>Math.abs(a.x-site.position.x)+Math.abs(a.y-site.position.y)>Math.abs(b.x-site.position.x)+Math.abs(b.y-site.position.y)?a:b),route=physical.path(origin,site.position,state);
   validateRoute(origin,route,state);const seconds=length(origin,route)/180;assert.ok(seconds<55,JSON.stringify({closed,site:site.id,seconds}));results.push(seconds);
  }
 }
 t.diagnostic(JSON.stringify({fixture:'40 far-origin actual routes, ten simultaneous door pairs, no waiting for reopening',maxSeconds:Math.max(...results),criticalDeadlineSeconds:75,checksMs:performance.now()-start}));
});
test('camera samples honor explicit local cones and contain no remote position or role',()=>{
 let s=createMatch({id:'quality-camera-fixture',tactical:true,map:{id:'beacon',version:2},seed:7,now:100000});
 const reader=s.players.find(p=>p.role==='crew'),[front,behind]=s.players.filter(p=>p.id!==reader.id),device=m.fixtures.devices.find(d=>d.kind==='cameras');
 // Explicit seeded local visibility fixture. Only sampling and safe projection use real engine actions.
 Object.assign(reader,{position:{...device.position},roomId:device.roomId});Object.assign(front,{position:{x:1200,y:1440},roomId:'workshop'});Object.assign(behind,{position:{x:1430,y:1440},roomId:'workshop'});
 const result=applyAction(s,reader.id,{id:'quality-camera',type:'investigate',deviceId:device.id},100001);assert.equal(result.accepted,true,JSON.stringify(result.error));s=tick(result.state,102001).state;
 const view=getPlayerView(s,reader.id,102001),samples=view.investigation.observations;assert.equal(samples.length,1);const frame=samples[0].data.frames.find(f=>f.cameraId==='beacon2-workshop-camera');assert.deepEqual(frame.players.map(p=>p.id),[front.id]);assert.equal(frame.players.some(p=>p.id===behind.id),false);assert.deepEqual(frame.field,{origin:{x:1380,y:1440},radius:300,facingRad:Math.PI,fovRad:Math.PI/2});
 for(const f of samples[0].data.frames)for(const p of f.players)assert.deepEqual(Object.keys(p).sort(),['id','position']);assert.deepEqual(getPlayerView(s,behind.id,102001).investigation.observations,[]);assert.deepEqual(getPlayerView(s,null,102001).investigation.observations,[]);
});
