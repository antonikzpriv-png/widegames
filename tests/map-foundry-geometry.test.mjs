import test from 'node:test';
import assert from 'node:assert/strict';
import map from '../shared/maps/storm-foundry.mjs';

const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;
const floor=p=>map.floors.some(r=>inside(p,r));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function walkable(p){
 const radius=14,diagonal=radius/Math.SQRT2;
 if(![[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius],[diagonal,diagonal],[-diagonal,diagonal],[diagonal,-diagonal],[-diagonal,-diagonal]].every(([dx,dy])=>floor({x:p.x+dx,y:p.y+dy})))return false;
 return !map.obstacles.some(r=>distance(p,{x:Math.max(r.x,Math.min(p.x,r.x+r.width)),y:Math.max(r.y,Math.min(p.y,r.y+r.height))})<radius);
}
function clear(a,b){const steps=Math.max(1,Math.ceil(distance(a,b)/7));for(let i=0;i<=steps;i++)if(!walkable({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}))return false;return true;}

test('Storm Foundry is a larger detailed immutable twelve-room map',()=>{
 assert.equal(map.id,'storm-foundry');assert.equal(map.rooms.length,12);assert.equal(map.tasksPerCrew,12);
 assert(map.width*map.height>3*1600*1200);assert.equal(map.corridors.length,17);assert.equal(map.obstacles.length,48);
 assert.equal(new Set(map.rooms.map(r=>r.id)).size,12);assert.equal(Object.keys(map.stations).length,12);
 assert(Object.isFrozen(map)&&Object.isFrozen(map.rooms[0])&&Object.isFrozen(map.obstacles[0]));
 for(const room of map.rooms){
  assert(room.name.length>0&&room.description.length>30&&room.palette.length===2);
  assert(room.x>=0&&room.y>=0&&room.x+room.width<=map.width&&room.y+room.height<=map.height);
  assert(inside(map.stations[room.id],room));assert(walkable(map.stations[room.id]),room.id+' station must be safe');
  assert(walkable(room.center),room.id+' standing center must be safe');
  for(const id of room.neighbors){const other=map.rooms.find(r=>r.id===id);assert(other?.neighbors.includes(room.id),'Room graph must be reciprocal');}
 }
 assert.equal(map.spawns.length,6);for(const p of [...map.spawns,map.bell])assert(walkable(p));
 for(const prop of map.obstacles)assert(map.rooms.some(room=>inside({x:prop.x,y:prop.y},room)&&inside({x:prop.x+prop.width,y:prop.y+prop.height},room)),'Props stay inside their room');
});

test('Storm Foundry rooms form multiple physical loops and every station is reachable with body radius/colliders',()=>{
 // An independent full-grid flood verifies connectivity instead of assuming the room graph implies walkable paths.
 const grid=28,columns=Math.ceil(map.width/grid),rows=Math.ceil(map.height/grid),safe=new Map();
 const point=id=>({x:id%columns*grid,y:Math.floor(id/columns)*grid});
 const valid=id=>{if(!safe.has(id))safe.set(id,walkable(point(id)));return safe.get(id);};
 const start=map.spawns[0],candidates=[];
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const id=y*columns+x,p=point(id);if(distance(p,start)<60&&valid(id)&&clear(start,p))candidates.push(id);}
 assert(candidates.length);const reached=new Set(candidates),queue=[...candidates];
 for(let head=0;head<queue.length;head++){
  const id=queue[head],x=id%columns,y=Math.floor(id/columns);
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=columns||ny>=rows)continue;const next=ny*columns+nx;if(reached.has(next)||!valid(next)||!clear(point(id),point(next)))continue;reached.add(next);queue.push(next);}
 }
 for(const [id,station]of Object.entries(map.stations))assert([...reached].some(node=>distance(point(node),station)<60&&clear(point(node),station)),id+' must be physically reachable');
 const edges=map.rooms.reduce((count,r)=>count+r.neighbors.length,0)/2;
 assert.equal(edges,17);assert(edges-map.rooms.length+1>=6,'At least six independent loops prevent a single corridor spine');
 for(const room of map.rooms)assert(!walkable({x:room.x+270,y:room.y+210}),'Central machine collisions remain solid');
});
