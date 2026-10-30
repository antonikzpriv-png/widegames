import test from 'node:test';
import assert from 'node:assert/strict';
import tidal from '../shared/maps/tidal-observatory.mjs';
import {getWorld} from '../shared/world.mjs';
const world=getWorld(tidal.id);
const xy=p=>({x:p.x,y:p.y});

test('Tidal Observatory has a frozen, larger detailed public descriptor with fourteen connected rooms',()=>{
 assert(Object.isFrozen(tidal)&&Object.isFrozen(tidal.rooms)&&Object.isFrozen(tidal.rooms[0].neighbors));
 assert.equal(tidal.width,3200);assert.equal(tidal.height,2500);assert(tidal.width*tidal.height>4*1600*1200);
 assert.equal(tidal.rooms.length,14);assert.equal(tidal.obstacles.length,70);assert.equal(tidal.decor.length,46);assert.equal(tidal.tasksPerCrew,12);
 const ids=new Set(tidal.rooms.map(r=>r.id));assert.equal(ids.size,14);
 for(const id of ['bridge','archive','lantern','workshop','galley','engine'])assert(ids.has(id));
 const visited=new Set(['bridge']),queue=['bridge'];
 for(const id of queue){const r=tidal.rooms.find(r=>r.id===id);for(const n of r.neighbors){assert(ids.has(n));assert(tidal.rooms.find(r=>r.id===n).neighbors.includes(id),`${id}/${n} reciprocal edge`);if(!visited.has(n)){visited.add(n);queue.push(n);}}}
 assert.equal(visited.size,14);
 for(const r of tidal.rooms){
  assert(r.name&&r.description&&r.palette.length===2);assert(r.palette.every(c=>/^#[a-f0-9]{6}$/i.test(c)));
  assert(r.x>=0&&r.y>=0&&r.x+r.width<=tidal.width&&r.y+r.height<=tidal.height);
  assert.equal(tidal.floors.find(f=>f.id===r.id),r);
 }
});

test('Tidal Observatory spawns, bell and every station are safe for the normal player collider',()=>{
 const points=Array.from({length:6},(_,i)=>world.worldSpawn('p'+(i+1)));
 assert.equal(new Set(points.map(p=>JSON.stringify(p))).size,6);
 for(const p of points){assert(world.isWalkable(p));assert.equal(world.worldRoomAt(p),'bridge');}
 assert(world.isWalkable(world.WORLD_BELL));assert.equal(world.worldRoomAt(world.WORLD_BELL),'bridge');
 for(const room of tidal.rooms){const p=world.WORLD_STATIONS[room.id];assert(world.isWalkable(p),room.id);assert.equal(world.worldRoomAt(p),room.id);}
});

test('Tidal Observatory geometry reaches every task station and keeps every declared neighbor route walkable',()=>{
 const checkRoute=(start,target,label)=>{
  const route=world.findWorldPath(start,target);assert(route,label);assert(route.length<4096);assert.deepEqual(route.length?route.at(-1):xy(start),xy(target));
  let previous=start;
  for(const point of route){
   assert(world.isWalkable(point),`${label} waypoint`);
   const length=world.distance(previous,point),arrived=world.moveWorldPoint(previous,(point.x-previous.x)/length,(point.y-previous.y)/length,length);
   assert(world.distance(arrived,point)<.001,`${label} segment follows authoritative collision`);previous=point;
  }
 };
 for(const r of tidal.rooms)checkRoute(world.worldSpawn('p1'),world.WORLD_STATIONS[r.id],`Bridge spawn to ${r.id}`);
 for(const r of tidal.rooms)for(const neighbor of r.neighbors)checkRoute(world.WORLD_STATIONS[r.id],world.WORLD_STATIONS[neighbor],`${r.id} to ${neighbor}`);
});

test('Tidal Observatory detailed equipment remains solid and voids block walking and sight',()=>{
 for(const o of tidal.obstacles){assert(!world.isWalkable({x:o.x+o.width/2,y:o.y+o.height/2},0),o.id);assert(o.kind&&o.color);}
 const o=tidal.obstacles[0],start={x:o.x-20,y:o.y+o.height/2};assert(world.isWalkable(start));
 const stopped=world.moveWorldPoint(start,1,0,o.width+200);assert(stopped.x<=o.x-world.WORLD.bodyRadius+.001,'Cannot walk through an equipment collider');
 assert(!world.isWalkable({x:800,y:800}));assert(!world.findWorldPath(world.worldSpawn('p1'),{x:800,y:800}));
 const a={x:660,y:900},b={x:920,y:950};assert(world.isWalkable(a)&&world.isWalkable(b));assert(world.distance(a,b)<world.WORLD.visibilityRadius);assert(!world.canSeeWorldPoint(a,b),'Nearby rooms across a floor void do not reveal one another');
});
