import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorld} from '../shared/world.mjs';

const maps=['beacon','storm-foundry','tidal-observatory'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function inShape(p,shape){
 if(!shape.outline)return p.x>=shape.x&&p.x<=shape.x+shape.width&&p.y>=shape.y&&p.y<=shape.y+shape.height;
 let inside=false;
 for(let i=0,j=shape.outline.length-1;i<shape.outline.length;j=i++){
  const a=shape.outline[j],b=shape.outline[i],cross=(p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x);
  if(Math.abs(cross)<1e-6&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y))return true;
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
function independentOracle(world){
 const floor=p=>world.WORLD_FLOORS.some(shape=>inShape(p,shape)),radius=world.WORLD.bodyRadius,diagonal=radius/Math.SQRT2;
 const walkable=p=>[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius],[diagonal,diagonal],[-diagonal,diagonal],[diagonal,-diagonal],[-diagonal,-diagonal]].every(([dx,dy])=>floor({x:p.x+dx,y:p.y+dy}))&&!world.WORLD_OBSTACLES.some(r=>distance(p,{x:Math.max(r.x,Math.min(p.x,r.x+r.width)),y:Math.max(r.y,Math.min(p.y,r.y+r.height))})<radius);
 const clear=(a,b)=>{const steps=Math.max(1,Math.ceil(distance(a,b)/7));for(let i=0;i<=steps;i++)if(!walkable({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}))return false;return true;};
 return {walkable,clear};
}

for(const mapId of maps)test(`illustrated ${mapId}: independent polygon/collider flood reaches every room, bell and spawn`,{timeout:60000},()=>{
 const world=getWorld(mapId,2),oracle=independentOracle(world),grid=28,columns=Math.ceil(world.WORLD.width/grid),rows=Math.ceil(world.WORLD.height/grid),cache=new Map();
 assert.equal(world.metadata.revision,2);
 assert(world.WORLD_ROOMS.some(r=>r.outline?.length>4),'Redesign must use real nonrectangular room boundaries');
 const point=id=>({x:id%columns*grid,y:Math.floor(id/columns)*grid});
 const valid=id=>{if(!cache.has(id))cache.set(id,oracle.walkable(point(id)));return cache.get(id);};
 const start=world.worldSpawn('p1'),candidates=[];
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const id=y*columns+x;if(distance(point(id),start)<60&&valid(id)&&oracle.clear(start,point(id)))candidates.push(id);}
 assert(candidates.length,'Spawn joins the physical navigation grid');
 const reached=new Set(candidates),queue=[...candidates];
 for(let head=0;head<queue.length;head++){
  const id=queue[head],x=id%columns,y=Math.floor(id/columns);
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=columns||ny>=rows)continue;
   const next=ny*columns+nx;if(reached.has(next)||!valid(next)||!oracle.clear(point(id),point(next)))continue;
   reached.add(next);queue.push(next);
  }
 }
 const anchors=[...Object.entries(world.WORLD_STATIONS).map(([id,p])=>[id,p]),['bell',world.WORLD_BELL],...Array.from({length:6},(_,i)=>['spawn-'+(i+1),world.worldSpawn('p'+(i+1))])];
 for(const [label,p]of anchors){
  assert(oracle.walkable(p),label+' has body-radius clearance outside machines');
  assert([...reached].some(id=>distance(point(id),p)<60&&oracle.clear(point(id),p)),label+' is reachable in the independent physical flood');
  const path=world.findWorldPath(start,p);assert(path,label+' has an authoritative route');let previous=start;
  for(const waypoint of path){assert(oracle.clear(previous,waypoint),label+' route never clips a polygon wall or machine');previous=waypoint;}
 }
 for(const prop of world.WORLD_OBSTACLES)assert(!world.isWalkable({x:prop.x+prop.width/2,y:prop.y+prop.height/2}),prop.id+' remains solid');
 let cutouts=0;
 for(const room of world.WORLD_ROOMS.filter(r=>r.outline))for(const [dx,dy]of [[8,8],[room.width-8,8],[8,room.height-8],[room.width-8,room.height-8]]){
  const p={x:room.x+dx,y:room.y+dy};if(!world.WORLD_FLOORS.some(shape=>inShape(p,shape))){assert(!world.isWalkable(p),'A clipped room corner cannot become walkable bounding-box floor');cutouts++;}
 }
 assert(cutouts>0,'At least one authored clipped corner changes the real collision footprint');
});

test('revision-1 geometry remains independent from all three redesigned maps',()=>{
 for(const mapId of maps){
  const legacy=getWorld(mapId),oldSpawn=legacy.worldSpawn('p1'),oldStation=structuredClone(legacy.WORLD_STATIONS.bridge),modern=getWorld(mapId,2);
  assert.notEqual(modern,legacy);assert.equal(legacy.metadata.revision??1,1);assert.equal(modern.metadata.revision,2);
  assert.deepEqual(legacy.worldSpawn('p1'),oldSpawn);assert.deepEqual(getWorld(mapId).WORLD_STATIONS.bridge,oldStation);
  assert(legacy.isWalkable(oldSpawn));assert(modern.isWalkable(modern.worldSpawn('p1')));
 }
 for(const revision of [0,3,null,'2',{},NaN])assert.throws(()=>getWorld('beacon',revision));
});
