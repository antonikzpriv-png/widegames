import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.TACTICAL_INVESTIGATION_ROOT?pathToFileURL(resolve(process.env.TACTICAL_INVESTIGATION_ROOT)+'/'):new URL('../',import.meta.url);
const investigation=await import(new URL('server/engine/investigation/index.mjs',root));
const {getMap,TACTICAL_MAP_CATALOG}=await import(new URL('shared/maps/index.mjs',root));
const {createSpatialWorld}=await import(new URL('server/engine/world/index.mjs',root));
const {DEFAULT_BEACON_RULES}=await import(new URL('shared/beacon.mjs',root));
const copy=value=>structuredClone(value),frozen=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))frozen(child);}return value;};

// Author module fixture, not a played match. All positions derive from the
// selected immutable packaged map; ctx delegates dynamic LOS to the real Core.
function fixture(mapId='beacon',kind='cameras',legacy=false){
 const map=getMap({id:mapId,version:1}),device=map.fixtures.devices.find(d=>d.kind===kind),world=createSpatialWorld(map.geometry);
 assert(device);const first=map.fixtures.cameras[0];
 const players=Array.from({length:12},(_,i)=>({id:'keeper-'+i,role:i===11?'saboteur':'crew',alive:true,roomId:device.roomId,position:copy(i===0?device.position:first.position),motion:{manual:false,path:[],destination:null,leaseUntil:0}}));
 const state={id:'tactical-module-fixture',schemaVersion:legacy?3:4,...(legacy?{}:{tacticalVersion:1,map:{id:map.id,version:map.version}}),worldVersion:1,beaconVersion:1,phase:'roam',updatedAt:0,players,beaconRules:{...DEFAULT_BEACON_RULES,deviceReadMs:100,deviceCooldownMs:50},systems:{lights:{active:false},communications:{active:false},doors:[],transit:{}},replay:[]};
 const ctx={geometry:map.geometry,record(s,type,at,fields){s.replay.push({type,at,...copy(fields)});},publicEvent(){throw new Error('No public investigation telemetry');},stop(){},sees(s,p,target){return world.sees(p.position,target,s,s.players.includes(p)?p.id:null);},nearby(s,p,target,range=map.geometry.WORLD.interactionRadius){return world.nearby(p.position,target,range,s,p.id);}};
 investigation.initializeInvestigation(state,0);const owner=players[0];
 return {state,map,device,ctx,owner,start(){assert.equal(investigation.applyInvestigationAction(state,owner,{type:'investigate',deviceId:device.id},state.updatedAt,ctx),true);},advance(at){const changed=investigation.advanceInvestigation(state,at,ctx);state.updatedAt=at;assert.equal(investigation.validateInvestigationState(state),true);return changed;},view(id=owner.id,at=state.updatedAt){return investigation.getInvestigationView(state,id,at,ctx);}};
}

for(const {id:mapId} of TACTICAL_MAP_CATALOG){
 test(mapId+': schema4 samples are map scoped, dated, typed, capped and owner only',()=>{
  const f=fixture(mapId);f.state.players[10].alive=false;f.state.systems.transit['keeper-11']={deadlineAt:500};f.start();assert.deepEqual(f.view().session.map,f.state.map);assert.equal(f.advance(99),false);assert.deepEqual(f.view().observations,[]);f.advance(100);
  const sample=f.view().observations[0];assert.equal(sample.at,100);assert.deepEqual(sample.map,f.state.map);assert.deepEqual(sample.provenance,{type:'device',ownerId:f.owner.id});assert.equal(sample.kind,'cameras');assert.equal(sample.deviceId,f.device.id);assert.equal(sample.id,'obs:'+f.owner.id+':'+f.device.id+':100');
  const frame=sample.data.frames.find(frame=>frame.cameraId===f.map.fixtures.cameras[0].id);assert(frame.limited);assert.equal(frame.players.length,6);assert.deepEqual(frame.field.origin,f.map.fixtures.cameras[0].position);assert(frame.field.radius<=f.state.beaconRules.visionRadius);assert(frame.players.every(p=>!['keeper-10','keeper-11'].includes(p.id)));assert(frame.players.every(p=>Object.keys(p).sort().join(',')==='id,position'));
  for(const id of [null,'keeper-1','unknown']){const v=f.view(id);assert.equal(v.session,null);assert.deepEqual(v.observations,[]);}
  assert(f.state.replay.every(e=>e.type!=='witness'&&JSON.stringify(e.visibleTo)==='["keeper-0"]'&&JSON.stringify(e.map)===JSON.stringify(f.state.map)));
 });
 test(mapId+': old camera fields remain historical through movement lights/comms/death; exported copies are defensive',()=>{
  const f=fixture(mapId);f.start();f.advance(100);const saved=copy(f.view().observations);f.state.systems.lights.active=true;f.state.systems.communications.active=true;f.state.players[1].position=copy(f.map.geometry.WORLD_VIEWPOINT);assert.deepEqual(f.view().observations,saved);assert.equal(f.view().status,'unavailable');assert(f.view().devices.every(d=>!d.available&&/Communications/.test(d.reason)));f.owner.alive=false;assert(f.view().devices.every(d=>!d.available));const exported=f.view();exported.observations[0].data.frames[0].field.origin.x=-1;assert.deepEqual(f.view().observations,saved);assert.equal(investigation.validateInvestigationState(JSON.parse(JSON.stringify(f.state))),true);
 });
 test(mapId+': occupancy enumerates every actual room anonymously, excludes corridors dead and transit',()=>{
  const f=fixture(mapId,'occupancy'),rooms=f.map.roomLayout;if(mapId==='stormbreak-annex')assert.equal(rooms.length,8);assert(rooms.length<=f.state.players.length);f.state.players.forEach((p,i)=>{const room=rooms[i%rooms.length],rect=f.map.geometry.WORLD_ROOMS.find(r=>r.id===room.id);p.position=copy(rect.center??{x:rect.x+rect.width/2,y:rect.y+rect.height/2});p.roomId='intentionally-stale';});f.owner.position=copy(f.device.position);f.state.players[10].alive=false;f.state.systems.transit['keeper-11']={deadlineAt:500};
  const corridor=f.map.geometry.WORLD_FLOORS.flatMap(r=>[{x:r.x+r.width/2,y:r.y+r.height/2}]).find(p=>f.map.geometry.isWalkable(p)&&!f.map.geometry.worldRoomAt(p));assert(corridor,'Packaged map has a real corridor point');f.state.players[9].position=corridor;
  // ctx.geometry is not an authority for assigning arbitrary room identities.
  f.ctx.geometry={worldRoomAt(){throw new Error('Use selected canonical map geometry');}};f.start();f.advance(100);const rows=f.view().observations[0].data.rooms;assert.deepEqual(rows.map(r=>r.roomId),rooms.map(r=>r.id));assert(rows.every(r=>Object.keys(r).sort().join(',')==='count,roomId'));assert.equal(rows.reduce((n,r)=>n+r.count,0),9);assert(!JSON.stringify(rows).includes('keeper-'));
 });
 test(mapId+': vitals never reads roles/routes/positions of other actors or promotes attacker evidence',()=>{
  const f=fixture(mapId,'vitals');for(const p of f.state.players.slice(1))for(const field of ['role','position','motion','tasks'])Object.defineProperty(p,field,{get(){throw new Error('Vitals attempted '+field);},configurable:true});f.state.players[3].alive=false;f.start();f.advance(100);const sample=f.view().observations[0];assert.equal(sample.data.players.length,12);assert.equal(sample.data.players[3].status,'dead');assert(sample.data.players.every(p=>Object.keys(p).sort().join(',')==='id,status'));assert.equal(f.state.replay.some(e=>e.type==='witness'),false);
 });
 test(mapId+': tactical restore rejects wrong source/map/owner/time/field and missing provenance',()=>{
  const f=fixture(mapId);f.start();f.advance(100);for(const corrupt of [s=>s.investigation.observations['keeper-0'][0].map.version++,s=>s.investigation.observations['keeper-0'][0].map.id='missing',s=>delete s.investigation.observations['keeper-0'][0].provenance,s=>s.investigation.observations['keeper-0'][0].provenance.ownerId='keeper-1',s=>s.investigation.observations['keeper-0'][0].provenance.type='say',s=>s.investigation.observations['keeper-0'][0].provenance.attackerId='keeper-1',s=>s.investigation.observations['keeper-0'][0].at=101,s=>s.investigation.observations['keeper-0'][0].data.frames[0].field.radius=10001,s=>s.investigation.observations['keeper-0'][0].data.frames[0].field.origin.x++,s=>s.investigation.observations['keeper-0'][0].data.frames[0].players[0].role='saboteur',s=>s.investigation.observations['keeper-0'][0].data.frames[0].players[0].position=copy(f.map.geometry.WORLD_VIEWPOINT),s=>s.investigation.sessions['keeper-0'].map.version++]){const bad=copy(f.state);corrupt(bad);assert.throws(()=>investigation.validateInvestigationState(bad));}
  const valid=JSON.parse(JSON.stringify(f.state));assert.equal(investigation.validateInvestigationState(valid),true);assert.equal(investigation.initializeInvestigation(valid,100),false);
 });
 test(mapId+': active restored read completes once at its original deadline, late calls never backdate telemetry',()=>{
  const f=fixture(mapId);f.start();f.advance(40);const restored=JSON.parse(JSON.stringify(f.state));assert.equal(investigation.validateInvestigationState(restored),true);assert.equal(investigation.investigationDeadline(restored),100);assert.equal(investigation.advanceInvestigation(restored,100,f.ctx),true);restored.updatedAt=100;assert.equal(investigation.validateInvestigationState(restored),true);assert.equal(investigation.advanceInvestigation(restored,100,f.ctx),false);assert.equal(restored.investigation.observations['keeper-0'].length,1);
  const late=fixture(mapId);late.start();late.advance(101);assert.equal(late.view().session.reason,'stale');assert.deepEqual(late.view().observations,[]);
 });
 test(mapId+': historical lights field retains sampled radius and contacts after lights restoration',()=>{
  const f=fixture(mapId);f.state.systems.lights.active=true;f.start();f.advance(100);const observation=copy(f.view().observations[0]);assert(observation.data.frames.every(frame=>frame.field.radius<=f.state.beaconRules.lightsVisionRadius));f.state.systems.lights.active=false;assert.deepEqual(f.view().observations[0],observation);assert.equal(investigation.validateInvestigationState(f.state),true);
 });
 test(mapId+': per-actor 64-sample bound evicts only the oldest dated observation across restart',()=>{
  const f=fixture(mapId,'vitals');for(let i=0;i<66;i++){f.state.updatedAt=i*150;f.start();f.advance(i*150+100);}const observations=f.view().observations;assert.equal(observations.length,64);assert.equal(observations[0].at,400);assert.equal(observations.at(-1).at,9850);assert(observations.every(o=>o.map.id===mapId&&o.provenance.ownerId===f.owner.id));const restored=JSON.parse(JSON.stringify(f.state));assert.equal(investigation.validateInvestigationState(restored),true);assert.deepEqual(investigation.getInvestigationView(restored,f.owner.id,restored.updatedAt,f.ctx).observations,observations);assert.deepEqual(f.view('keeper-1').observations,[]);
 });
 for(const [reason,mutate] of [
  ['movement',f=>f.owner.position.x++],['movement',f=>{f.owner.motion.manual=true;f.owner.motion.leaseUntil=1000;}],['movement',f=>{f.owner.motion.path=[copy(f.owner.position)];f.owner.motion.destination=copy(f.owner.position);}],['dead',f=>f.owner.alive=false],['phase',f=>f.state.phase='voting'],['transit',f=>f.state.systems.transit[f.owner.id]={deadlineAt:500}],['communications',f=>f.state.systems.communications.active=true],['out_of_range',f=>f.ctx.sees=()=>false],
 ])test(mapId+': access revalidation before deadline/view/actions: '+reason+' '+mutate.toString(),()=>{
  const f=fixture(mapId);f.start();mutate(f);const before=copy(f.state);const view=f.view();assert.equal(view.session.status,'stale');assert.equal(view.session.reason,reason);assert.deepEqual(view.observations,[]);assert(investigation.validateInvestigationAction(f.state,f.owner,{type:'investigate',deviceId:f.device.id},0,f.ctx));assert.deepEqual(f.state,before,'Validation and view must not mutate authoritative state');f.advance(100);assert.equal(f.view().session.status,'failed');assert.equal(f.view().session.reason,reason);assert.deepEqual(f.view().observations,[]);
 });
}

test('legacy schema3 record/session/frame fields are unchanged; tactical map identity is required and unknown versions fail',()=>{
 const f=fixture('beacon','cameras',true);f.start();f.advance(100);const sample=f.view().observations[0];assert.deepEqual(Object.keys(sample).sort(),['at','data','deviceId','id','kind']);assert.equal(sample.data.frames[0].field,undefined);assert.equal(f.view().session.map,undefined);assert.equal(investigation.validateInvestigationState(JSON.parse(JSON.stringify(f.state))),true);
 for(const map of [undefined,{id:'beacon',version:999},{id:'missing',version:1},{id:'beacon',version:1,extra:true},'beacon']){const s=copy(f.state);s.schemaVersion=4;s.tacticalVersion=1;s.map=map;assert.throws(()=>investigation.validateInvestigationState(s));}
});

test('map-derived hints and safe views are pure defensive projections with no foreign fixtures',()=>{
 const f=fixture();const before=copy(f.state);frozen(f.state);const hints=investigation.investigationActionHints(f.state,f.owner,0,f.ctx),v=f.view();assert.deepEqual(hints.filter(h=>h.type==='investigate').map(h=>h.fields.deviceId),f.map.fixtures.devices.map(d=>d.id));assert.deepEqual(v.devices.map(d=>d.id),f.map.fixtures.devices.map(d=>d.id));v.devices[0].position.x=-1;assert.deepEqual(f.state,before);
});

for(let left=0;left<TACTICAL_MAP_CATALOG.length;left++)for(let right=left+1;right<TACTICAL_MAP_CATALOG.length;right++)test('concurrent '+TACTICAL_MAP_CATALOG[left].id+' / '+TACTICAL_MAP_CATALOG[right].id+' reads keep map, source, rooms and history isolated',()=>{
 const a=fixture(TACTICAL_MAP_CATALOG[left].id,'occupancy'),b=fixture(TACTICAL_MAP_CATALOG[right].id,'occupancy');a.start();b.start();a.advance(50);b.advance(100);assert.deepEqual(a.view().observations,[]);a.advance(100);
 for(const f of [a,b]){const v=f.view(),sample=v.observations[0];assert.deepEqual(sample.map,f.state.map);assert.deepEqual(sample.data.rooms.map(r=>r.roomId),f.map.roomLayout.map(r=>r.id));assert.deepEqual(v.devices.map(d=>d.id),f.map.fixtures.devices.map(d=>d.id));}
 const wrong=copy(b.state);wrong.investigation.observations[b.owner.id]=copy(a.view().observations);assert.throws(()=>investigation.validateInvestigationState(wrong));assert.throws(()=>investigation.getInvestigationView(wrong,b.owner.id,100,b.ctx));
 assert.equal(investigation.validateInvestigationAction(b.state,b.owner,{type:'investigate',deviceId:a.device.id},100,b.ctx).code,'INVALID_DEVICE');assert.deepEqual(a.map,getMap(a.state.map));assert.deepEqual(b.map,getMap(b.state.map));
});
