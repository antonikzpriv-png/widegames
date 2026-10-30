import test from 'node:test';
import assert from 'node:assert/strict';
import {getMap,getLegacyMap,mapFor,mapIdentity,MAP_CATALOG,TACTICAL_MAP_CATALOG,PUBLIC_MAP_CATALOG} from '../shared/maps/index.mjs';
import {getWorld} from '../shared/world.mjs';
test('two Beacon v2 namespaces never reinterpret each other',()=>{
 const tactical=getMap({id:'beacon',version:2}),illustrated=getLegacyMap('beacon',2);
 assert.equal(tactical.geometry.WORLD.width,3200);assert.equal(tactical.roomLayout.length,14);assert.equal(illustrated.geometry.WORLD.width,1600);assert.equal(illustrated.roomLayout.length,6);assert.notEqual(mapIdentity(tactical),mapIdentity(illustrated));assert.equal(getMap('beacon-illustrated'),illustrated);assert.equal(getMap({mapId:'beacon',revision:2}),illustrated);assert.equal(mapFor({mapRevision:2}),illustrated);assert.equal(mapFor({map:{id:'beacon-illustrated',version:2},mapId:'beacon',mapRevision:2}),illustrated);
 assert.throws(()=>mapFor({map:{id:'beacon',version:2},mapId:'beacon',mapRevision:2}),/Conflicting/);
});
test('every authored legacy revision is immutable and resolves its original shape functions',()=>{
 for(const id of ['beacon','storm-foundry','tidal-observatory'])for(const revision of [1,2]){
  const map=getLegacyMap(id,revision),native=getWorld(id,revision);assert.equal(map.geometry.WORLD,native.WORLD);assert.equal(map.geometry.isWalkable,native.isWalkable);assert.equal(map.geometry.findWorldPath,native.findWorldPath);assert.equal(mapFor({mapId:id,...(revision===2?{mapRevision:2}:{})}),map);assert(Object.isFrozen(map));assert(Object.isFrozen(map.geometry));
 }
 for(const id of ['storm-foundry','tidal-observatory']){assert.equal(getMap(id),getLegacyMap(id,2));assert.equal(getMap({id,version:1}),getLegacyMap(id,1));}
});
test('catalog keeps five real selections and public metadata excludes implementation fields',()=>{
 assert.deepEqual(MAP_CATALOG.map(m=>[m.id,m.version]),[['beacon',2],['stormbreak-annex',1],['storm-foundry',2],['tidal-observatory',2],['beacon-illustrated',2]]);assert.equal(TACTICAL_MAP_CATALOG.length,2);for(const m of PUBLIC_MAP_CATALOG)assert.deepEqual(Object.keys(m).sort(),['description','id','name','theme','version']);
});
test('unknown legacy revisions and namespace aliases fail closed',()=>{
 for(const revision of [0,3,null,'2',2.5])assert.throws(()=>getLegacyMap('beacon',revision));assert.throws(()=>getLegacyMap('stormbreak-annex',2));assert.throws(()=>getMap({mapId:'beacon',revision:2,extra:true}));
});
