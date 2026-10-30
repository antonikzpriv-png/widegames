import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.TACTICAL_INVESTIGATION_ROOT?pathToFileURL(resolve(process.env.TACTICAL_INVESTIGATION_ROOT)+'/'):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const investigation=await import(new URL('server/engine/investigation/index.mjs',root));
const {getMap,TACTICAL_MAP_CATALOG}=await import(new URL('shared/maps/index.mjs',root));
const roster=Array.from({length:12},(_,i)=>({id:'tactical-'+i,name:'Fixture Keeper '+i,color:'#123456',persona:'Labeled offline engine fixture.'}));
// Actual engine navigation/actions and clock. Hidden roles/path lengths are read
// only by this staging harness; no client/AI is given authoritative engine state.
function fixture(mapId){
 const map=getMap(mapId);let state=engine.createMatch({id:'tactical-console-'+mapId,tactical:true,map:{id:map.id,version:map.version},mode:'spectator',roster,now:0,seed:'console-tactical',beaconRules:{deviceReadMs:100,deviceCooldownMs:50},config:{initialKillCooldownMs:1,moveCooldownMs:1,meetingCooldownMs:1,roamDeadlineMs:600000,maxMatchMs:900000}});
 assert.equal(state.schemaVersion,4,'Actual committed tactical orchestrator required; no schema3 skip/fallback');let now=0,seq=0;
 return {map,get state(){return state;},get now(){return now;},get crew(){return state.players.filter(p=>p.role==='crew').map(p=>p.id);},get sab(){return state.players.find(p=>p.role==='saboteur').id;},
  device(kind){return map.fixtures.devices.find(d=>d.kind===kind);},view(id){return engine.getPlayerView(state,id,now);},
  act(id,type,fields={},requestId){const result=engine.applyAction(state,id,{id:requestId??'tactical-console:'+ ++seq,type,...fields},now);assert.equal(result.accepted,true,JSON.stringify({type,error:result.error,map:mapId}));state=result.state;assert.equal(investigation.validateInvestigationState(state),true);return result;},
  tick(at){now=at;state=engine.tick(state,at).state;assert.equal(investigation.validateInvestigationState(state),true);},
  walk(id,target){this.act(id,'navigate',{x:target.x,y:target.y});const actor=state.players.find(p=>p.id===id);let length=0,last=actor.position;for(const p of actor.motion.path){length+=map.geometry.distance(last,p);last=p;}this.tick(now+Math.ceil(length/map.geometry.WORLD.speed*1000)+100);assert(map.geometry.distance(state.players.find(p=>p.id===id).position,target)<.01);},
  input(id,request){const result=engine.applyInput(state,id,request,now);assert.equal(result.accepted,true,JSON.stringify(result.error));state=result.state;assert.equal(investigation.validateInvestigationState(state),true);},
  restore(){state=JSON.parse(JSON.stringify(state));assert.equal(investigation.validateInvestigationState(state),true);}
 };
}

for(const {id:mapId} of TACTICAL_MAP_CATALOG){
 test(mapId+': actual schema4 timed camera read/restart is private, scoped and duplicate-safe',()=>{
  const f=fixture(mapId),owner=f.crew[0],device=f.device('cameras');f.walk(owner,device.position);const started=f.now;f.act(owner,'investigate',{deviceId:device.id},'read-once');f.tick(started+50);f.restore();f.tick(started+1000);
  const v=f.view(owner),sample=v.investigation.observations[0];assert.equal(v.map.id,mapId);assert.equal(v.investigation.observations.length,1);assert.equal(sample.at,started+100);assert.deepEqual(sample.map,v.map);assert.deepEqual(sample.provenance,{type:'device',ownerId:owner});assert(sample.data.frames.every(frame=>frame.field&&frame.players.length<=6));assert.equal(f.act(owner,'investigate',{deviceId:device.id},'read-once').duplicate,true);assert.equal(f.view(owner).investigation.observations.length,1);
  for(const id of [f.crew[1],null]){const other=f.view(id);assert.equal(other.investigation.session,null);assert.deepEqual(other.investigation.observations,[]);}assert.equal(engine.getReplay(f.state),null);const records=f.state.replay.filter(e=>e.type.startsWith('device_'));assert(records.length>=2);assert(records.every(e=>JSON.stringify(e.visibleTo)===JSON.stringify([owner])&&e.map.id===mapId));
 });
 test(mapId+': actual movement interrupts read; next completed occupancy uses all map rooms',()=>{
  const f=fixture(mapId),owner=f.crew[0],device=f.device('occupancy');f.walk(owner,device.position);f.act(owner,'investigate',{deviceId:device.id});f.input(owner,{seq:1,dx:1,dy:0});assert.equal(f.view(owner).investigation.session.reason,'movement');assert.deepEqual(f.view(owner).investigation.observations,[]);f.input(owner,{seq:2,dx:0,dy:0});f.tick(f.now+50);f.act(owner,'investigate',{deviceId:device.id});f.tick(f.now+100);const rows=f.view(owner).investigation.observations[0].data.rooms;assert.deepEqual(rows.map(r=>r.roomId),f.map.roomLayout.map(r=>r.id));if(mapId==='stormbreak-annex')assert.equal(rows.length,8);assert(rows.every(r=>Object.keys(r).sort().join(',')==='count,roomId'));
 });
 test(mapId+': real communications cancellation cannot create a successful empty sample',()=>{
  const f=fixture(mapId),owner=f.crew[0],device=f.device('cameras');f.walk(owner,device.position);f.act(owner,'investigate',{deviceId:device.id});f.act(f.sab,'systemSabotage',{kind:'communications',targetId:'beacon'});const v=f.view(owner);assert.equal(v.investigation.status,'unavailable');assert.equal(v.investigation.session.reason,'communications');assert(v.investigation.devices.every(d=>!d.available&&/Communications/.test(d.reason)));assert.deepEqual(v.investigation.observations,[]);f.tick(f.now+100);assert.deepEqual(f.view(owner).investigation.observations,[]);
 });
 test(mapId+': camera sample of a real attacker later supplies no attack-eyewitness claim',()=>{
  const f=fixture(mapId),[reader,victim]=f.crew,camera=f.map.fixtures.cameras[0];f.walk(victim,camera.position);f.walk(f.sab,camera.position);f.act(f.sab,'eliminate',{targetId:victim});f.walk(reader,f.device('cameras').position);f.act(reader,'investigate',{deviceId:f.device('cameras').id});f.tick(f.now+100);const v=f.view(reader),frame=v.investigation.observations[0].data.frames.find(row=>row.cameraId===camera.id);assert(frame.players.some(p=>p.id===f.sab));assert(!frame.players.some(p=>p.id===victim));assert(!v.events.some(e=>e.type==='witness'));assert.equal(frame.attackerId,undefined);
 });
 test(mapId+': real vitals sample updates only the reader knowledge and never attacker attribution',()=>{
  const f=fixture(mapId),[reader,victim,other]=f.crew,where=f.map.fixtures.cameras[0].position;f.walk(victim,where);f.walk(f.sab,where);const beforeOther=f.view(other).players.find(p=>p.id===victim).status,beforeSpectator=f.view(null).players.find(p=>p.id===victim).status;f.act(f.sab,'eliminate',{targetId:victim});f.walk(reader,f.device('vitals').position);f.act(reader,'investigate',{deviceId:f.device('vitals').id});const at=f.now+100;f.tick(at);f.restore();const own=f.view(reader),sample=own.investigation.observations[0];assert.equal(sample.at,at);assert.equal(sample.kind,'vitals');assert.equal(sample.data.players.find(p=>p.id===victim).status,'dead');assert.equal(own.players.find(p=>p.id===victim).status,'dead');assert.equal(own.players.find(p=>p.id===victim).position,null);assert(!own.events.some(e=>e.type==='witness'));assert.equal(f.view(other).players.find(p=>p.id===victim).status,beforeOther);assert.equal(f.view(null).players.find(p=>p.id===victim).status,beforeSpectator);assert.deepEqual(f.view(other).investigation.observations,[]);assert.deepEqual(f.view(null).investigation.observations,[]);
 });
}
