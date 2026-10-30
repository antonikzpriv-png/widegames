import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {getMap} from '../shared/maps/index.mjs';
import {createMatch,applyAction,tick,getPlayerView} from '../server/engine/index.mjs';
import {createRoom,issueIdentity} from '../server/rooms.mjs';
import {createRoomStore,validateRoomSnapshot} from '../server/store.mjs';
const references=[{id:'beacon',version:1},{id:'beacon',version:2},{id:'stormbreak-annex',version:1}];
const ids=['toString','valueOf','hasOwnProperty','keeper_West','keeper-East','watch_A','watch_B','watch_C','crew9','crew10','crew11','crew12'];
const roster=n=>ids.slice(0,n).map((id,i)=>({id,name:'Fixture '+(i+1),color:'#aabbcc',persona:'Offline map-spawn fixture'}));
test('original Beacon 1 and Annex 1 geometry/fixtures retain their foundation fingerprints',()=>{
 const hashes=['fb08964433e4b0fc051f86368237c2da6b72f51ed840b67a276b5ceab38ea42d','bc6020f590af65ae2e26d9c126bb385bb930448db23bdf936b1af6b97163a041'];
 for(const [i,ref]of [references[0],references[2]].entries()){
  const m=getMap(ref),g=m.geometry,record={layout:m.roomLayout,fixtures:m.fixtures,geometry:Object.fromEntries(['WORLD','WORLD_ROOMS','WORLD_FLOORS','WORLD_OBSTACLES','WORLD_STATIONS','WORLD_BELL','WORLD_VIEWPOINT','WORLD_SPAWN_ROOM'].map(k=>[k,g[k]]))};
  assert.equal(createHash('sha256').update(JSON.stringify(record)).digest('hex'),hashes[i]);assert.ok(Object.isFrozen(m.fixtures.doors));assert.ok(Object.isFrozen(g.WORLD_ROOMS));
 }
});
test('four, eight and twelve arbitrary-ID keepers spawn without collision on all exact map versions',()=>{
 for(const map of references)for(const n of [4,8,12]){
  const s=createMatch({id:'quality-roster-'+map.id+map.version+n,tactical:true,map,now:100000,seed:9,roster:roster(n),saboteurCount:n===12?3:1}),g=getMap(map).geometry;
  assert.deepEqual(s.players.map(p=>p.id),ids.slice(0,n));
  for(const p of s.players){assert.ok(g.isWalkable(p.position),p.id);assert.equal(g.worldRoomAt(p.position),g.WORLD_SPAWN_ROOM);for(const q of s.players)if(p!==q)assert.ok(g.distance(p.position,q.position)>=g.WORLD.bodyRadius*2,p.id+'/'+q.id);}
 }
});
test('simultaneous versioned matches, accepted receipts, seats, private budget and checkpoints survive backup/restart',async t=>{
 const parent=new URL('../_artifacts/test-temp/',import.meta.url);await mkdir(parent,{recursive:true});const dir=await mkdtemp(new URL('quality-map-',parent));
 let store=await createRoomStore(dir);t.after(()=>store.close());const before=new Map(),rooms=[];
 for(const map of references){
  const room=createRoom('human',100000,{roster:roster(12),saboteurCount:3},{tactical:true,mapId:map});issueIdentity(room,true);room.startId='quality-map-start';room.aiContext={calls:2,tokens:30,costUsd:0.0123,privateMarker:'fixture-never-public'};
  room.state=createMatch({id:room.id,tactical:true,map,now:100000,seed:11,roster:room.lobby.roster,saboteurCount:3,humanPlayerIds:room.lobby.humanPlayerIds});
  const actor=room.state.players[0],target=getMap(map).geometry.WORLD_STATIONS[getMap(map).geometry.WORLD_SPAWN_ROOM],request={id:'quality-map-exact-id',type:'navigate',x:target.x,y:target.y};
  const result=applyAction(room.state,actor.id,request,100001);assert.equal(result.accepted,true,JSON.stringify(result.error));room.state=tick(result.state,102001).state;room.updatedAt=102001;
  await validateRoomSnapshot(room);await store.save(room);const backup=await store.backup(room.id),bytes=await readFile(dir+'/room-'+room.id+'.json','utf8');assert.equal(await readFile(backup.file,'utf8'),bytes);before.set(room.id,bytes);rooms.push({room,request});
 }
 await store.close();store=await createRoomStore(dir);const restored=await store.load();assert.equal(restored.length,3);
 for(const {room,request}of rooms){const saved=restored.find(r=>r.id===room.id);assert.deepEqual(saved,room);assert.equal(await readFile(dir+'/room-'+room.id+'.json','utf8'),before.get(room.id));assert.deepEqual(saved.map,room.map);assert.equal(saved.identities[0].seatId,'toString');assert.equal(saved.aiContext.costUsd,0.0123);const view=getPlayerView(saved.state,'toString',102001);assert.equal(view.rooms.length,getMap(room.map).roomLayout.length);assert.deepEqual(view.map,room.map);assert.equal(JSON.stringify(view).includes('fixture-never-public'),false);const retry=applyAction(saved.state,'toString',request,102001);assert.equal(retry.accepted,true);assert.equal(retry.duplicate,true);assert.deepEqual(retry.state,saved.state);}
 // Querying latest Beacon cannot move a restored old map, mutate geometry or select another match's runtime.
 assert.equal(getMap('beacon').version,2);for(const {room}of rooms)assert.deepEqual(room.map,restored.find(r=>r.id===room.id).map);
});
