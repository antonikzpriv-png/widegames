import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const source=process.env.TACTICAL_SYSTEMS_SOURCE_ROOT?pathToFileURL(path.resolve(process.env.TACTICAL_SYSTEMS_SOURCE_ROOT)+path.sep):new URL('../',import.meta.url);
const [engine,{MAP_CATALOG,getMap}]=await Promise.all(['server/engine/index.mjs','shared/maps/index.mjs'].map(file=>import(new URL(file,source))));
// Actual integrated engine report/council/closure lifecycle; only initial near-door positions are seeded.
for(const selection of MAP_CATALOG)test('reported corpse on '+selection.id+' no longer jams a later real tactical closure',()=>{
 const map=getMap(selection.id),door=map.fixtures.doors[0],start=100000;
 let state=engine.createMatch({id:'corpse-door-review',tactical:true,map:{id:map.id,version:map.version},now:start,seed:'corpse-review',config:{initialKillCooldownMs:1,killCooldownMs:1,discussionMs:20,votingMs:20,meetingCooldownMs:1,roamDeadlineMs:1000000,maxMatchMs:2000000},beaconRules:{doorDurationMs:25000}});assert.equal(state.schemaVersion,4);
 const sab=state.players.find(p=>p.role==='saboteur'),crew=state.players.filter(p=>p.role==='crew'),victim=crew[0],reporter=crew[1],pad=map.geometry.WORLD.bodyRadius+4;
 victim.position={x:door.x+door.width/2,y:door.y+door.height/2};sab.position=door.width<door.height?{x:door.x-pad,y:victim.position.y}:{x:victim.position.x,y:door.y-pad};reporter.position=door.width<door.height?{x:door.x+door.width+pad,y:victim.position.y}:{x:victim.position.x,y:door.y+door.height+pad};
 for(const p of [sab,victim,reporter])p.roomId=map.geometry.worldRoomAt(p.position)??p.roomId;
 let serial=0;function action(actor,type,fields,at){const result=engine.applyAction(state,actor,{id:'corpse-'+ ++serial,type,...fields},at);assert(result.accepted,JSON.stringify(result.error));state=result.state;return result;}
 action(sab.id,'eliminate',{targetId:victim.id},start+1);assert.equal(state.players.find(p=>p.id===victim.id).alive,false);assert.equal(state.bodies[0].reported,false);const deadPosition=structuredClone(state.players.find(p=>p.id===victim.id).position);
 action(sab.id,'systemSabotage',{kind:'door',targetId:door.id},start+2);state=engine.tick(state,start+1002).state;assert.equal(state.systems.doors.find(d=>d.id===door.id).status,'jammed','an actual unreported body must keep the threshold open');
 action(reporter.id,'report',{bodyId:state.bodies[0].id},start+1003);assert.equal(state.phase,'discussion');assert.equal(state.bodies[0].reported,true);state=engine.tick(state,start+1043).state;assert.equal(state.phase,'roam');assert.deepEqual(state.players.find(p=>p.id===victim.id).position,deadPosition,'root deliberately retains dead saved positions');assert.equal(engine.getPlayerView(state,reporter.id,start+1043).players.find(p=>p.id===victim.id).position,null);
 state=JSON.parse(JSON.stringify(state));action(sab.id,'systemSabotage',{kind:'door',targetId:door.id},start+20002);state=engine.tick(state,start+21002).state;
 assert.equal(state.systems.doors.find(d=>d.id===door.id).status,'closed','reported corpse is no longer a physical threshold occupant');assert.equal(state.systems.doors.find(d=>d.id===door.id).deadlineAt,start+46002,'persisted25s door duration is respected');assert.deepEqual(state.players.find(p=>p.id===victim.id).position,deadPosition);
 const legacy=engine.createMatch({id:'legacy-door-default',world:true,systems:true,now:start,seed:'legacy'});assert.equal(legacy.schemaVersion,3);assert.equal(legacy.beaconRules.doorDurationMs,12000);
});
