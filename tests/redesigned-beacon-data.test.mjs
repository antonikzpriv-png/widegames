import test from 'node:test';
import assert from 'node:assert/strict';
import map from '../shared/maps/beacon-v2.mjs';
import {getWorld} from '../shared/world.mjs';

const pointIn=(p,r)=>{
 if(p.x<r.x||p.y<r.y||p.x>r.x+r.width||p.y>r.y+r.height)return false;
 if(!r.outline)return true;
 let inside=false;
 for(let i=0,j=r.outline.length-1;i<r.outline.length;j=i++){
  const a=r.outline[j],b=r.outline[i],cross=(p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x);
  if(Math.abs(cross)<1e-7&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y))return true;
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
};
const walkable=p=>{
 const r=14,d=r/Math.SQRT2;
 if(![[0,0],[r,0],[-r,0],[0,r],[0,-r],[d,d],[-d,d],[d,-d],[-d,-d]].every(([x,y])=>map.floors.some(f=>pointIn({x:p.x+x,y:p.y+y},f))))return false;
 return !map.obstacles.some(o=>Math.hypot(p.x-Math.max(o.x,Math.min(p.x,o.x+o.width)),p.y-Math.max(o.y,Math.min(p.y,o.y+o.height)))<r);
};
test('redesigned beacon retains its canonical task rooms with authored asymmetric silhouettes',()=>{
 assert.equal(map.id,'beacon');assert.equal(map.revision,2);assert(Object.isFrozen(map));assert(Object.isFrozen(map.rooms[0].outline[0]));
 assert.deepEqual(map.rooms.map(r=>r.id).sort(),['archive','bridge','engine','galley','lantern','workshop']);
 assert.equal(map.tasksPerCrew,3);assert.equal(map.spawns.length,6);
 assert.equal(new Set(map.rooms.map(r=>`${r.width}x${r.height}`)).size,6,'Room footprints vary rather than repeating a grid');
 for(const r of map.rooms){assert(r.outline.length>=6);assert(pointIn(r.center,r));for(const id of r.neighbors)assert(map.rooms.find(other=>other.id===id)?.neighbors.includes(r.id),`${r.id}/${id} graph is reciprocal`);}
 assert(map.obstacles.length>=40);assert(new Set(map.obstacles.map(p=>p.kind)).size>=15);assert(map.decor.length>=80);
 assert.equal(new Set(map.obstacles.map(o=>o.id)).size,map.obstacles.length);
 for(const o of map.obstacles)for(const [x,y]of [[o.x,o.y],[o.x+o.width,o.y],[o.x,o.y+o.height],[o.x+o.width,o.y+o.height]])assert(map.rooms.some(r=>pointIn({x,y},r)),`${o.id} stays within the room silhouette`);
});
test('redesigned beacon has real collision-safe loops, stations, bell and safe muster positions',()=>{
 for(const p of map.spawns)assert(walkable(p),'Muster point clear');
 const cell=10,columns=map.width/cell,queue=[map.spawns[0]],visited=new Set([`${queue[0].x},${queue[0].y}`]),cache=new Map();
 const safe=p=>{const id=`${p.x},${p.y}`;if(!cache.has(id))cache.set(id,walkable(p));return cache.get(id);};
 for(let head=0;head<queue.length;head++){
  const p=queue[head];
  for(const [dx,dy]of [[0,-cell],[-cell,0],[cell,0],[0,cell]]){
   const n={x:p.x+dx,y:p.y+dy},id=`${n.x},${n.y}`;if(n.x<0||n.y<0||n.x>map.width||n.y>map.height||visited.has(id)||!safe(n)||!safe({x:(n.x+p.x)/2,y:(n.y+p.y)/2}))continue;
   visited.add(id);queue.push(n);
  }
 }
 assert(visited.size>2000,'Substantial connected interior, not just connecting graph names');
 for(const [id,p]of Object.entries({...map.stations,bell:map.bell})){assert(walkable(p),`${id} interaction point clear`);assert(queue.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<=8),`${id} reachable through collision geometry`);}
 for(const r of map.rooms)assert(queue.some(p=>pointIn(p,r)),r.id);
 // Cut-off corners really are exterior space and not just painted rectangles.
 assert(!walkable({x:580,y:80}));assert(!walkable({x:1160,y:750}));
 assert(!walkable({x:1275,y:932}),'Alternator is solid');
 assert(columns>100);
});
test('redesigned beacon authoritative 28-unit navigation reaches every room center and interaction',()=>{
 const world=getWorld('beacon',2),start=world.worldSpawn('p1');
 for(const [id,p]of [...world.WORLD_ROOMS.map(room=>['center:'+room.id,room.center]),...Object.entries(world.WORLD_STATIONS),['bell',world.WORLD_BELL]]){
  assert(world.isWalkable(p),id+' is an unobstructed legal standing point');
  const route=world.findWorldPath(start,p);assert(route,id+' joins the actual server navigation grid');
  let from=start;
  for(const to of route){const steps=Math.max(1,Math.ceil(world.distance(from,to)/7));for(let i=0;i<=steps;i++)assert(world.isWalkable({x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps}),id+' route keeps body clearance');from=to;}
 }
});
