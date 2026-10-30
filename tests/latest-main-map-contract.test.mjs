import test from 'node:test';
import assert from 'node:assert/strict';
import {getMap,mapFor,MAP_CATALOG,TACTICAL_MAP_CATALOG} from '../shared/maps/index.mjs';
import {getWorld} from '../shared/world.mjs';
test('latest main maps preserve exact geometry and independently scoped task protocol',()=>{
 assert.equal(MAP_CATALOG.length,4);assert.deepEqual(TACTICAL_MAP_CATALOG.map(m=>m.id),['beacon','stormbreak-annex']);
 for(const id of ['storm-foundry','tidal-observatory']){
  const map=getMap(id);assert.equal(map,getMap({id,version:1}));assert.equal(mapFor({mapId:id}),map);assert.equal(map.tactical,false);assert.equal(map.taskProtocol,'taskStep');assert.equal(map.tasksPerCrew,12);
  const old=getWorld(id);assert.equal(map.geometry.WORLD,old.WORLD);assert.equal(map.geometry.WORLD_STATIONS,old.WORLD_STATIONS);assert.equal(map.geometry.worldSpawn,old.worldSpawn);assert.deepEqual(map.roomLayout,old.ROOM_LAYOUT);assert(Object.isFrozen(map));assert(Object.isFrozen(map.geometry));assert.deepEqual(map.fixtures.doors,[]);
 }
});
test('legacy absence, exact beacon versions and incompatible identity pairs stay explicit',()=>{
 assert.equal(mapFor({}),getMap({id:'beacon',version:1}));assert.equal(mapFor({map:{id:'beacon',version:2},mapId:'beacon'}),getMap('beacon'));
 assert.throws(()=>mapFor({map:{id:'beacon',version:2},mapId:'storm-foundry'}),/Conflicting/);
 for(const mapId of [null,12,{},'unknown'])assert.throws(()=>mapFor({mapId}));
});
