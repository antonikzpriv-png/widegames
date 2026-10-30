import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../server/engine/index.mjs';
import {getMap} from '../shared/maps/index.mjs';

const fresh=(map,schema=5)=>e.createMatch({id:'copy-deadlines-'+map.id+'-'+schema,seed:3,now:1000,world:true,systems:true,...(schema>=4?{tactical:true,map,stationTasks:schema===5}:{}),mode:'spectator'});
function act(state,id,type,fields={},now=state.updatedAt){const r=e.applyAction(state,id,{id:'fixture:'+now+':'+type,type,...fields},now);assert(r.accepted,JSON.stringify(r.error));return r.state;}
function travel(state,id,target){state=act(state,id,'navigate',{x:target.x,y:target.y});let last=state.players.find(p=>p.id===id).position,length=0;const g=getMap(state.map).geometry;for(const p of state.players.find(p=>p.id===id).motion.path){length+=g.distance(last,p);last=p;}return e.tick(state,state.updatedAt+Math.ceil(length/g.WORLD.speed*1000)+1).state;}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}
function unchanged(state,run){const before=structuredClone(state);freeze(state);const result=run(state);assert.deepEqual(state,before);return result;}

for(const map of [{id:'beacon',version:2},{id:'stormbreak-annex',version:1}])test('tactical idle clones must settle auxiliary, door, transit and device boundaries: '+map.id,()=>{
 let state=fresh(map),sab=state.players.find(p=>p.role==='saboteur').id;
 state=act(state,sab,'systemSabotage',{kind:'lights',targetId:'beacon'});const deadline=state.systems.lights.deadlineAt;
 assert.equal(unchanged(state,s=>e.tick(s,deadline-1)).state.systems.lights.active,true);
 assert.equal(unchanged(state,s=>e.tick(s,deadline)).state.systems.lights.active,false);
 state=fresh(map);sab=state.players.find(p=>p.role==='saboteur').id;const door=getMap(map).fixtures.doors.find(d=>!state.players.some(p=>getMap(map).geometry.distance(p.position,d.position)<100))??getMap(map).fixtures.doors[0];
 state=act(state,sab,'systemSabotage',{kind:'door',targetId:door.id});const pending=state.systems.doors.find(d=>d.id===door.id);assert.equal(pending.status,'pending');
 const closed=unchanged(state,s=>e.tick(s,pending.closeAt)).state;assert(['closed','jammed'].includes(closed.systems.doors.find(d=>d.id===door.id).status));
 assert.equal(unchanged(closed,s=>e.tick(s,pending.deadlineAt)).state.systems.doors.find(d=>d.id===door.id).status,'open');
 state=fresh(map);sab=state.players.find(p=>p.role==='saboteur').id;const entry=getMap(map).fixtures.vents[0];state=travel(state,sab,entry.position);state=act(state,sab,'vent',{entryId:entry.id,exitId:entry.links[0]});const transit=state.systems.transit[sab];assert(transit);
 const arrived=unchanged(state,s=>e.tick(s,transit.deadlineAt)).state;assert(!arrived.systems.transit[sab]);assert.deepEqual(arrived.players.find(p=>p.id===sab).position,getMap(map).fixtures.vents.find(v=>v.id===entry.links[0]).position);
 state=fresh(map);const crew=state.players.find(p=>p.role==='crew').id,device=getMap(map).fixtures.devices[0];state=travel(state,crew,device.position);state=act(state,crew,'investigate',{deviceId:device.id});const session=state.investigation.sessions[crew];assert(session);
 const sampled=unchanged(state,s=>e.tick(s,session.deadlineAt)).state;assert(sampled.investigation.observations[crew].length>0);assert(!sampled.investigation.sessions[crew]||sampled.investigation.sessions[crew].status!=='reading');
});

for(const schema of [3,4,5])test('schema'+schema+' results isolate knowledge, receipts, checkpoints, notes and nested unknown records',()=>{
 let state=fresh({id:'beacon',version:schema===3?1:2},schema);const p=state.players[0];state=act(state,p.id,'ability',{abilityId:'field-note',targetId:p.id});state=e.applyInput(state,p.id,{seq:1,dx:1,dy:0},1000).state;
 // Labelled forward-compatible plain-data mutation fixture, not generated telemetry.
 state.replay.push({id:'fixture-extension',at:1000.125,type:'future',data:{values:[{safe:true}]}});const before=structuredClone(state);
 for(const call of [s=>e.tick(s,1100),s=>e.applyAction(s,p.id,{id:'new-wait',type:'wait'},1100),s=>e.applyInput(s,p.id,{seq:2,dx:-1,dy:0},1100)]){
  const result=unchanged(state,call);assert.notEqual(result.state,state);result.state.replay.find(e=>e.id==='fixture-extension').data.values[0].safe=false;result.state.requests[p.id].push({fixture:true});result.state.replayHistory.checkpoints[0].players[0].tasks.push({fixture:true});result.state.abilities[p.id].notes[0].position.x=-100;result.state.players[0].knowledge.roster[0].at=-100;result.state.spatial.spectator.knowledge.events.push({fixture:true});result.state.investigation.observations[p.id]=[{fixture:true}];assert.deepEqual(state,before);
 }
});
