import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorld} from '../shared/world.mjs';
import {createMatch,applyAction,tick} from '../server/engine/index.mjs';

const point=p=>({x:p.x,y:p.y});
const maps=['beacon','storm-foundry','tidal-observatory'];

test('illustrated obstacle tangency remains traversable after fractional movement accumulation',()=>{
 const world=getWorld('storm-foundry',2),start={x:2492,y:1092},target={x:2184,y:1092};
 assert(world.isWalkable(start));assert(world.isWalkable(target));
 // The real filtration→cargo route passes 14 units to the right of signal-spare-coax.
 // Repeated 308/52 substeps formerly accumulated x=2183.999999999989 and blocked.
 const arrived=world.moveWorldPoint(start,-1,0,308);
 assert(world.distance(arrived,target)<1e-7,JSON.stringify({arrived,target}));
 assert(world.isWalkable(arrived),'The executed tangent endpoint stays usable by the next waypoint');
 assert(!world.isWalkable({x:2184-1e-4,y:1092}),'A genuine obstacle penetration still rejects');
});

for(const mapId of maps)test(`illustrated ${mapId}: every directed station route executes through movement and authoritative navigation`,{timeout:120000},t=>{
 const world=getWorld(mapId,2),stations=Object.entries(world.WORLD_STATIONS),now=1000;
 const base=createMatch({id:'executed-'+mapId,world:true,mapId,mapRevision:2,mode:'spectator',now,seed:'executed-station-routes',config:{roamDeadlineMs:86400000,maxMatchMs:86400000}});
 let routes=0,waypoints=0;
 for(const [fromId,from]of stations)for(const [toId,target]of stations){
  const label=`${mapId}: ${fromId}→${toId}`,path=world.findWorldPath(from,target);
  assert(path,label+' must have a route');let position=point(from),length=0;
  for(const waypoint of path){
   const gap=world.distance(position,waypoint);length+=gap;waypoints++;
   if(gap>0)position=world.moveWorldPoint(position,(waypoint.x-position.x)/gap,(waypoint.y-position.y)/gap,gap);
   assert(world.isWalkable(position),label+' must remain walkable after each executed waypoint');
   assert(world.distance(position,waypoint)<1e-5,label+' must physically arrive at '+JSON.stringify({waypoint,position}));
  }
  assert(world.distance(position,target)<1e-5,label+' direct movement reaches the final station');
  const state=structuredClone(base),actor=state.players[0];actor.position=point(from);actor.roomId=fromId;
  const proposed=applyAction(state,actor.id,{id:'route-'+fromId+'-'+toId,type:'navigate',x:target.x,y:target.y},now);
  assert(proposed.accepted,label+' is accepted by the real action validator: '+JSON.stringify(proposed.error));
  const final=tick(proposed.state,now+Math.ceil(length/world.WORLD.speed*1000)+1000).state;
  const keeper=final.players[0];
  assert.equal(final.phase,'roam',label+' remains in the movement phase');
  assert(world.distance(keeper.position,target)<1e-5,label+' authoritative controller must reach destination: '+JSON.stringify(keeper.position));
  assert.equal(keeper.motion.path.length,0,label+' consumes every route waypoint');
  assert.equal(keeper.motion.destination,null,label+' clears its destination on arrival');
  assert(!final.replay.some(e=>e.type==='motion'&&e.playerId===keeper.id&&e.reason==='blocked'),label+' never records a blocked route');
  routes++;
 }
 assert.equal(routes,stations.length**2);t.diagnostic(`${routes} directed routes and ${waypoints} waypoints executed, including each self-route`);
});
