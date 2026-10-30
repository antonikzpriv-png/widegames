import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorld} from '../shared/world.mjs';
import {describeSpectatorSelection} from '../public/world/spectator.mjs';

for(const mapId of ['beacon','storm-foundry','tidal-observatory']){
 test(`revision-2 spectator ${mapId} inspects actual redesigned stations, rooms, props and technical details`,()=>{
  const geometry=getWorld(mapId,2),old=getWorld(mapId,1),game={matchId:'v2-inspector-'+mapId,mapId,mapRevision:2,worldVersion:1,self:null,players:[],rooms:geometry.ROOM_LAYOUT,events:[],inspection:{matchId:'v2-inspector-'+mapId,mode:'all-ai-observer',agents:[]}};
  assert.notDeepEqual(geometry.WORLD_STATIONS.engine,old.WORLD_STATIONS.engine,'Fixture must distinguish old and redesigned layouts');
  for(const room of geometry.WORLD_ROOMS){
   const roomName=geometry.ROOM_LAYOUT.find(r=>r.id===room.id).name,station=geometry.WORLD_STATIONS[room.id],description=describeSpectatorSelection(game,{type:'station',id:station.id});
   assert.equal(description.title,roomName+' station');assert.deepEqual(description.facts.find(([key])=>key==='Position'),['Position',`${station.x}, ${station.y}`]);
   const roomDescription=describeSpectatorSelection(game,{type:'room',id:room.id});assert.equal(roomDescription.title,roomName);assert.deepEqual(roomDescription.facts.find(([key])=>key==='Task station'),['Task station',`${station.x}, ${station.y}`]);
  }
  const prop=geometry.WORLD_OBSTACLES.find(p=>!old.WORLD_OBSTACLES.some(q=>p.id===q.id));assert(prop,'Revision-specific machine fixture');
  const propDescription=describeSpectatorSelection(game,{type:'prop',id:prop.id});assert(propDescription);assert.deepEqual(propDescription.facts.find(([key])=>key==='Position'),['Position',`${prop.x}, ${prop.y}`]);assert.deepEqual(propDescription.facts.find(([key])=>key==='Footprint'),['Footprint',`${prop.width} × ${prop.height}`]);
  assert.match(propDescription.description,/Spectator ghosts pass freely/);assert.equal(describeSpectatorSelection({...game,mapRevision:1},{type:'prop',id:prop.id}),null,'New machinery cannot be invented in old recordings');
  const detail=geometry.WORLD_DECOR.find(d=>!old.WORLD_DECOR.some(q=>d.id===q.id));assert(detail);assert(describeSpectatorSelection(game,{type:'decor',id:detail.id}));assert.equal(describeSpectatorSelection({...game,mapRevision:1},{type:'decor',id:detail.id}),null);
  const bell=describeSpectatorSelection(game,{type:'bell',id:'bell'}),room=geometry.ROOM_LAYOUT.find(r=>r.id===geometry.worldRoomAt(geometry.WORLD_BELL));assert.deepEqual(bell.facts.find(([key])=>key==='Location'),['Location',room.name]);
  assert.equal(describeSpectatorSelection({...game,self:{id:'p1'}},{type:'station',id:geometry.WORLD_STATIONS.engine.id}),null,'A player seat cannot inherit observer controls');
  assert.equal(describeSpectatorSelection(game,{type:'prop',id:'missing-machine'}),null);
 });
}
