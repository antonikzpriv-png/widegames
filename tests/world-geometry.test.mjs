import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,ROOM_LAYOUT} from '../shared/contracts.mjs';
import {WORLD,WORLD_ROOMS,WORLD_STATIONS,WORLD_BELL,WORLD_OBSTACLES,worldSpawn,worldRoomAt,isWalkable,moveWorldPoint,findWorldPath,canSeeWorldPoint,distance} from '../shared/world.mjs';

test('six original rooms have valid spawns and reachable interaction stations',()=>{
 assert.deepEqual(WORLD_ROOMS.map(r=>r.id).sort(),ROOM_LAYOUT.map(r=>r.id).sort());
 for(const player of CHARACTERS){const p=worldSpawn(player.id);assert(isWalkable(p));assert.equal(worldRoomAt(p),'bridge');}
 assert.equal(new Set(CHARACTERS.map(p=>JSON.stringify(worldSpawn(p.id)))).size,6);
 assert(isWalkable(WORLD_BELL),'AI bell destination must be outside furniture');
 for(const room of WORLD_ROOMS){assert(isWalkable(room.center),room.id);assert(isWalkable(WORLD_STATIONS[room.id]),room.id);assert.equal(worldRoomAt(WORLD_STATIONS[room.id]),room.id);}
});

test('all station pairs have deterministic collision-safe routes',()=>{
 const stations=Object.values(WORLD_STATIONS);
 for(const start of stations)for(const end of [...stations,WORLD_BELL]){
  const path=findWorldPath(start,end);assert.notEqual(path,null,`${start.id} to ${end.id||'bell'}`);assert.deepEqual(path,findWorldPath(start,end));
  let previous=start;
  for(const next of path){const steps=Math.max(1,Math.ceil(distance(previous,next)/4));for(let i=0;i<=steps;i++)assert(isWalkable({x:previous.x+(next.x-previous.x)*i/steps,y:previous.y+(next.y-previous.y)*i/steps}));previous=next;}
  assert(distance(previous,end)<.01);
 }
});

test('normalized diagonal movement preserves speed and safe sliding cannot cross a wall',()=>{
 const start={x:900,y:300},straight=moveWorldPoint(start,-1,0,18),diagonal=moveWorldPoint(start,-1,1,18);
 assert(Math.abs(distance(start,straight)-18)<.001);assert(Math.abs(distance(start,diagonal)-18)<.001);
 let p={x:950,y:320};for(let i=0;i<80;i++){p=moveWorldPoint(p,1,1,18);assert(isWalkable(p));}
 assert(p.x<=1000-WORLD.bodyRadius+.01);assert(p.y<=370-WORLD.bodyRadius+.01);
 const stalled=moveWorldPoint({x:950,y:320},1,0,1e9);assert(isWalkable(stalled));assert(stalled.x<=1000-WORLD.bodyRadius+.01);
});

test('map boundaries and furniture reject destinations and stop physical movement',()=>{
 assert.equal(findWorldPath(worldSpawn('p1'),{x:10,y:10}),null);
 assert.equal(findWorldPath(worldSpawn('p1'),{x:800,y:200}),null);
 for(const r of WORLD_OBSTACLES)assert.equal(isWalkable({x:r.x+r.width/2,y:r.y+r.height/2}),false);
 for(const bad of [{x:NaN,y:0},{x:Infinity,y:0},{x:-1,y:200},null])assert.equal(isWalkable(bad),false);
 const from={x:800,y:272},towardTable=moveWorldPoint(from,0,-1,180);
 assert(isWalkable(towardTable));assert(towardTable.y>=244);
});

test('visibility follows nearby floor geometry and never crosses an external wall',()=>{
 assert(canSeeWorldPoint({x:800,y:300},{x:800,y:470}));
 assert.equal(canSeeWorldPoint({x:700,y:330},{x:650,y:470}),false);
 assert.equal(canSeeWorldPoint(WORLD_STATIONS.archive,WORLD_STATIONS.engine),false);
 assert.equal(canSeeWorldPoint({x:NaN,y:10},worldSpawn('p1')),false);
});

test('geometry helpers preserve inputs and reject unreachable or malformed paths',()=>{
 const start=Object.freeze(worldSpawn('p1')),target=Object.freeze({...WORLD_STATIONS.engine});
 const before=JSON.stringify({start,target});assert(findWorldPath(start,target));moveWorldPoint(start,1,0,12);assert.equal(JSON.stringify({start,target}),before);
 assert.deepEqual(findWorldPath(start,start),[]);assert.equal(findWorldPath(start,{x:1601,y:1201}),null);
});
