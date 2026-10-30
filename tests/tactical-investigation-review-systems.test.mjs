import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.TACTICAL_INVESTIGATION_ROOT?pathToFileURL(resolve(process.env.TACTICAL_INVESTIGATION_ROOT)+'/'):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const systems=await import(new URL('server/engine/systems/index.mjs',root));
const {createSpatialWorld}=await import(new URL('server/engine/world/index.mjs',root));
const {getMap,MAP_CATALOG}=await import(new URL('shared/maps/index.mjs',root));
const copy=value=>structuredClone(value);
function fixture(mapId){
 const map=getMap(mapId),state=engine.createMatch({id:'independent-systems-'+mapId,tactical:true,map:{id:map.id,version:map.version},mode:'spectator',roster:Array.from({length:12},(_,i)=>({id:'review-'+i,name:'Review '+i,color:'#123456'})),saboteurCount:2,seed:'independent-systems',now:0,config:{roamDeadlineMs:600000,maxMatchMs:900000}});assert.equal(state.schemaVersion,4,'Requires actual tactical source, not a legacy skip');assert.equal(state.systems.version,2);
 const world=createSpatialWorld(map.geometry);const ctx={geometry:map.geometry,record(s,type,at,data){s.replay.push({id:'r'+ ++s.replaySequence,type,at,...copy(data)});},publicEvent(){throw new Error('Only action hints use this fixture context');},stop(){},sees(s,p,target){return world.sees(p.position,target,s,p.id);},nearby(s,p,target,range){return world.nearby(p.position,target,range,s,p.id);}};
 return {map,state,world,ctx,sab:state.players.filter(p=>p.role==='saboteur').map(p=>p.id),crew:state.players.filter(p=>p.role==='crew').map(p=>p.id)};
}
function act(state,id,type,fields,at,accepted=true){const result=engine.applyAction(state,id,{id:'review:'+at+':'+type,type,...fields},at);assert.equal(result.accepted,accepted,JSON.stringify(result.error));return result;}

// Independent review of Systems/Core, not approval of authored investigation.
for(const {id:mapId} of MAP_CATALOG){
 test('independent '+mapId+': faction auxiliary reservation survives restart and constrains the other saboteur',()=>{
  const f=fixture(mapId),first=act(f.state,f.sab[0],'systemSabotage',{kind:'lights',targetId:'beacon'},0).state;
  const restored=JSON.parse(JSON.stringify(first));assert.equal(systems.validateSystemsState(restored),true);const denied=act(restored,f.sab[1],'systemSabotage',{kind:'communications',targetId:'beacon'},1,false);assert.equal(denied.error.code,'COOLDOWN');assert.equal(restored.systems.communications.active,false);
  const at=restored.systems.factionCooldowns.saboteur.auxiliaryAt,next=act(restored,f.sab[1],'systemSabotage',{kind:'communications',targetId:'beacon'},at).state;assert.equal(next.systems.communications.active,true);assert.equal(engine.getPlayerView(next,f.sab[0],at).systems.cooldowns.auxiliaryAt,at+next.beaconRules.auxiliaryCooldownMs);assert.deepEqual(Object.keys(engine.getPlayerView(next,f.crew[0],at).systems.cooldowns),['ventAt']);assert.equal(engine.getPlayerView(next,null,at).systems.cooldowns,null);
  const corrupt=copy(next);corrupt.systems.factionCooldowns.saboteur.auxiliaryAt=0;assert.throws(()=>systems.validateSystemsState(corrupt),/Lost faction auxiliary reservation/);
 });
 test('independent '+mapId+': hidden threshold occupancy cannot change warning permissions; jam neither moves nor names keeper',()=>{
  const f=fixture(mapId),door=f.map.fixtures.doors[0],occupant=f.crew[0],actor=f.sab[0],middle={x:door.x+door.width/2,y:door.y+door.height/2};
  // Explicit authoritative counterfactual fixture, not a claimed played route.
  // Only hidden positions differ; stationary motion/knowledge and clock agree.
  const occupied=copy(f.state),empty=copy(f.state),far=f.map.geometry.WORLD_STATIONS[f.map.roomLayout.at(-1).id];
  for(const s of [occupied,empty]){const p=s.players.find(p=>p.id===actor);p.position={x:far.x,y:far.y};p.roomId=f.map.geometry.worldRoomAt(p.position)??p.roomId;}
  const p=occupied.players.find(p=>p.id===occupant);p.position=middle;p.roomId=f.map.geometry.worldRoomAt(middle)??p.roomId;assert.equal(f.world.sees(occupied.players.find(p=>p.id===actor).position,middle,occupied,actor),false);assert.equal(f.world.walkable(middle,occupied),true);
  assert.deepEqual(systems.systemActionHints(occupied,occupied.players.find(p=>p.id===actor),0,f.ctx),systems.systemActionHints(empty,empty.players.find(p=>p.id===actor),0,f.ctx));
  const warningA=act(occupied,actor,'systemSabotage',{kind:'door',targetId:door.id},0).state,warningB=act(empty,actor,'systemSabotage',{kind:'door',targetId:door.id},0).state;for(const s of [warningA,warningB]){const d=s.systems.doors.find(d=>d.id===door.id);assert.equal(d.status,'pending');assert.equal(d.closed,false);assert.equal(d.closeAt,1000);}
  const jam=engine.tick(warningA,1000).state,closed=engine.tick(warningB,1000).state;assert.equal(jam.systems.doors.find(d=>d.id===door.id).status,'jammed');assert.equal(jam.systems.doors.find(d=>d.id===door.id).closed,false);assert.equal(closed.systems.doors.find(d=>d.id===door.id).status,'closed');assert.deepEqual(jam.players.find(p=>p.id===occupant).position,middle);
  for(const s of [jam,closed]){assert.equal(systems.validateSystemsState(s),true);const safe=engine.getPlayerView(s,actor,1000);assert.equal(safe.players.find(p=>p.id===occupant).position,null);for(const event of s.events.filter(e=>e.type==='system'))for(const key of ['playerId','occupantId','position','visibleTo'])assert.equal(Object.hasOwn(event,key),false);assert.equal(safe.systems.transit,undefined);}
  const until=jam.systems.doors.find(d=>d.id===door.id).deadlineAt,done=engine.tick(JSON.parse(JSON.stringify(jam)),until).state;assert.equal(done.systems.doors.find(d=>d.id===door.id).status,'open');assert.deepEqual(done.players.find(p=>p.id===occupant).position,middle);
 });
 test('independent '+mapId+': accepted route crossing a later closed door stops without tunneling; reopening restores navigation',()=>{
  const f=fixture(mapId),door=f.map.fixtures.doors.find(d=>d.width<d.height),y=door.y+door.height/2,start={x:door.x-300,y},target={x:door.x+door.width+90,y},walker=f.crew[0];assert(f.map.geometry.isWalkable(start));assert(f.map.geometry.isWalkable(target));const s=copy(f.state),p=s.players.find(p=>p.id===walker);p.position=start;p.roomId=f.map.geometry.worldRoomAt(start)??p.roomId;
  // Position setup is a labeled Core boundary fixture; all subsequent route,
  // warning, movement/expiry and reopen transitions use actual engine actions.
  const route=act(s,walker,'navigate',target,0).state;assert(route.players.find(p=>p.id===walker).motion.path.length>0);const warned=act(route,f.sab[0],'systemSabotage',{kind:'door',targetId:door.id},0).state,atClose=engine.tick(warned,1000).state;assert.equal(atClose.systems.doors.find(d=>d.id===door.id).status,'closed');const blocked=engine.tick(atClose,3000).state;assert(blocked.players.find(p=>p.id===walker).position.x<=door.x-f.map.geometry.WORLD.bodyRadius+.001);assert.equal(blocked.players.find(p=>p.id===walker).motion.path.length,0);assert.equal(f.world.walkable(blocked.players.find(p=>p.id===walker).position,blocked),true);
  const expiry=blocked.systems.doors.find(d=>d.id===door.id).deadlineAt,open=engine.tick(blocked,expiry).state;assert.equal(open.systems.doors.find(d=>d.id===door.id).status,'open');const resumed=act(open,walker,'navigate',target,expiry).state,arrived=engine.tick(resumed,expiry+10000).state;assert(f.map.geometry.distance(arrived.players.find(p=>p.id===walker).position,target)<.01);
 });
}
