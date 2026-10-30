import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../server/engine/index.mjs';
import {getLegacyMap,getMap,mapFor,mapIdentity} from '../shared/maps/index.mjs';
import {getWorld} from '../shared/world.mjs';
import {worldGeometry,worldRoute} from '../server/ai/world.mjs';
import {situation,install,execute} from '../server/ai/strategic.mjs';
import {validateReplayHistory,validateReplayMetadata} from '../shared/replay.mjs';
import {validateReplayHistoryState} from '../server/engine/replay-history.mjs';

for(const mapId of ['beacon','storm-foundry','tidal-observatory'])test('illustrated world2 retains authored revision2 and native routes without tactical aliasing: '+mapId,()=>{
 const opts={id:'revision-authority-'+mapId,world:true,mapId,mapRevision:2,seed:7,now:1000},state=e.createMatch(opts),g=getWorld(mapId,2);assert.equal(state.mapRevision,2);assert.equal(state.schemaVersion,2);assert(!state.map);assert.equal(state.mapId??'beacon',mapId);assert.deepEqual(state.players[0].position,g.worldSpawn('p1'));
 const owner=state.players.find(p=>p.role==='crew'),view=e.getPlayerView(state,owner.id,1000);assert.equal(view.mapRevision,2);assert.equal(worldGeometry(view).findWorldPath,g.findWorldPath);assert.deepEqual(view.rooms,g.ROOM_LAYOUT);assert.equal(view.self.tasks.length,mapId==='beacon'?3:12);assert(view.self.tasks.every(t=>t.progress.v===(mapId==='beacon'?1:2)));assert(view.players.every(p=>!Object.hasOwn(p,'role')));
 for(const target of [g.WORLD_BELL,...Object.values(g.WORLD_STATIONS).slice(0,3)])assert.deepEqual(worldRoute(view,target),g.findWorldPath(view.self.position,target));
 assert.equal(state.replayHistory.mapRevision,2);validateReplayHistory(state.replayHistory);validateReplayHistoryState(state.replayHistory,state);
 const changed=structuredClone(state.replayHistory);delete changed.mapRevision;assert.throws(()=>validateReplayHistoryState(changed,state),/revision/);
 const unknown=structuredClone(state.replayHistory);unknown.mapRevision=3;assert.throws(()=>validateReplayHistory(unknown));
 assert(!Object.hasOwn(e.createMatch({...opts,mapRevision:1}),'mapRevision'));
 if(mapId==='beacon'){const missing=e.getPlayerView(e.createMatch({...opts,mapId:undefined}),owner.id,1000);assert.equal(mapFor(missing),getLegacyMap('beacon',2));assert.equal(worldGeometry(missing).WORLD.width,1600);assert.notEqual(mapIdentity(mapFor(missing)),mapIdentity(getMap({id:'beacon',version:2})));}
});

test('revision options fail closed across board/systems/tactical and do not rebind old worlds',()=>{
 for(const mapRevision of [0,3,'2',null,{},true])assert.throws(()=>e.createMatch({id:'bad-revision',world:true,mapRevision}),/revision/);
 for(const flags of [{},{world:true,systems:true},{tactical:true,map:{id:'beacon',version:2}},{tactical:true,stationTasks:true,map:{id:'stormbreak-annex',version:1}}])assert.throws(()=>e.createMatch({id:'wrong-mode',mapRevision:2,...flags}),/revision/);
 const old=e.createMatch({id:'old-world',world:true,seed:7,now:1000});assert(!Object.hasOwn(old,'mapRevision'));assert(!Object.hasOwn(old.replayHistory,'mapRevision'));assert.deepEqual(old.players[0].position,getWorld('beacon',1).worldSpawn('p1'));
 const tactical=e.createMatch({id:'tactical-distinct',tactical:true,stationTasks:true,map:{id:'beacon',version:2},seed:7,now:1000});assert.equal(tactical.schemaVersion,5);assert.equal(tactical.replayHistory.version,2);assert(!Object.hasOwn(tactical.replayHistory,'mapRevision'));assert.equal(getMap(tactical.map).geometry.WORLD.width,3200);
});

test('strategic intentions revoke across legacy revision namespace without moving from old geometry',()=>{
 const state=e.createMatch({id:'strategy-revision',world:true,seed:7,now:1000}),id=state.players.find(p=>p.role==='crew').id,view=e.getPlayerView(state,id,1000),memory={};install(memory,{type:'intend',goal:'position',roomId:'engine'},view);
 const newer=e.getPlayerView(e.createMatch({id:state.id,world:true,mapRevision:2,seed:7,now:1000}),id,1000);assert.notEqual(situation(view,memory),situation(newer,memory));assert.equal(execute(newer,memory),null);
});
