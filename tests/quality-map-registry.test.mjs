import test from 'node:test';
import assert from 'node:assert/strict';
import {getMap,MAP_CATALOG,mapFor} from '../shared/maps/index.mjs';
import * as legacy from '../shared/world.mjs';
import {STATION_TASK_KINDS} from '../shared/station-contract.mjs';
test('permanent exact identities and legacy absence differ from newest string selection',()=>{
 const old=getMap();assert.equal(old.version,1);assert.equal(getMap({id:'beacon',version:1}),old);assert.equal(mapFor({}),old);assert.equal(old.geometry.isWalkable,legacy.isWalkable);
 assert.equal(getMap('beacon').version,2);assert.equal(getMap({id:'beacon',version:2}),getMap('beacon'));assert.deepEqual(MAP_CATALOG.map(m=>[m.id,m.version]),[['beacon',2],['stormbreak-annex',1],['storm-foundry',2],['tidal-observatory',2],['beacon-illustrated',2]]);
 for(const ref of [null,{},[],{id:'beacon'},{id:'beacon',version:3},{id:'beacon',version:2,extra:true},{id:'beacon',version:'2'},'toString'])assert.throws(()=>getMap(ref),/Unsupported/);
});
test('Beacon 2 publishes fourteen distinct stations, rich collider-aligned art and six task kinds',()=>{
 const m=getMap('beacon'),g=m.geometry;assert.equal(g.WORLD.width,3200);assert.equal(g.WORLD.height,2400);assert.equal(m.roomLayout.length,14);
 for(const id of ['bridge','archive','lantern','workshop','galley','engine'])assert.ok(m.roomLayout.some(r=>r.id===id));
 assert.deepEqual([...new Set(Object.values(m.taskKinds))].sort(),[...STATION_TASK_KINDS].sort());assert.ok(Object.isFrozen(m.art.rooms));
 for(const r of m.roomLayout){assert.ok(m.art.rooms[r.id].props.length>=6);assert.ok(g.isWalkable(g.WORLD_STATIONS[r.id]),r.id);for(const p of m.art.rooms[r.id].props)if(p.solid)assert.deepEqual(g.WORLD_OBSTACLES.find(o=>o.id===p.id),Object.fromEntries(['id','x','y','width','height'].map(k=>[k,p[k]])));}
 assert.throws(()=>{m.geometry.WORLD.width=1;},TypeError);assert.throws(()=>{m.roomLayout[0].neighbors.push('bogus');},TypeError);
});
