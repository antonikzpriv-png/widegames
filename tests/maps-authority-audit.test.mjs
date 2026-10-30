import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,tick} from '../server/engine/index.mjs';
import {taskInput} from '../server/engine/tasks.mjs';
import {validateRoomSnapshot} from '../server/store.mjs';
import {getWorld} from '../shared/world.mjs';
const maps=['storm-foundry','tidal-observatory'];
function fixture(mapId){
 const id=('authority_'+mapId.replaceAll('-','_')).padEnd(32,'x');
 const state=createMatch({id,world:true,mapId,seed:'map-authority-audit',now:1000});
 return {schema:1,id,mode:'human',mapId,createdAt:1000,updatedAt:1000,identities:[{hash:'a'.repeat(64),host:true,seatId:'p1'}],state,startId:'start',aiContext:{}};
}

for(const mapId of maps){
 test(`map authority: ${mapId} stores its default larger workload and rejects invalid task rooms/kinds/progress`,async()=>{
  const room=fixture(mapId);await validateRoomSnapshot(room);
  const taskCount=room.state.players.flatMap(p=>p.tasks).length;
  assert.equal(taskCount,getWorld(mapId).metadata.tasksPerCrew*5);assert(taskCount>=60);
  const mutate=[
   task=>{task.roomId='not-on-this-map';},
   task=>{task.kind='unknown-captcha';},
   task=>{delete task.kind;},
   task=>{task.progress={v:2,kind:task.kind,index:999};}
  ];
  for(const change of mutate){const bad=structuredClone(room);change(bad.state.players.find(p=>p.tasks.length).tasks[0]);await assert.rejects(validateRoomSnapshot(bad));}
 });
 test(`map authority: ${mapId} room and match selections stay bound on restore`,async()=>{
  const room=fixture(mapId);await validateRoomSnapshot(room);
  const missing=structuredClone(room);delete missing.mapId;await assert.rejects(validateRoomSnapshot(missing));
  const changed=structuredClone(room);changed.mapId=mapId===maps[0]?maps[1]:maps[0];await assert.rejects(validateRoomSnapshot(changed));
  const invalid=structuredClone(room);invalid.state.mapId='client-supplied-world';await assert.rejects(validateRoomSnapshot(invalid));
 });
 test(`map authority: ${mapId} uses its own authoritative route and task station; actions cannot swap the map`,async()=>{
  let room=fixture(mapId),state=room.state;const world=getWorld(mapId),actor=state.players.find(p=>p.role==='crew'),task=actor.tasks[0],station=world.WORLD_STATIONS[task.roomId];
  const swapped=applyAction(state,actor.id,{id:'swap-map',type:'wait',mapId:'beacon'},1000);assert.equal(swapped.accepted,false);assert.equal(swapped.error.code,'INVALID_ACTION');assert.equal(swapped.state.mapId,mapId);
  const before=applyAction(state,actor.id,{id:'remote-task',type:'taskStep',taskId:task.id,step:0,input:taskInput(task)},1000);
  if(world.distance(actor.position,station)>world.WORLD.interactionRadius)assert.equal(before.accepted,false,'No remote task progress from another room');
  const route=world.findWorldPath(actor.position,station);assert(route);let distance=0,previous=actor.position;for(const p of route){distance+=world.distance(previous,p);previous=p;}
  const walk=applyAction(state,actor.id,{id:'walk-to-task',type:'navigate',x:station.x,y:station.y},1000);assert(walk.accepted);const now=1000+Math.ceil(distance/world.WORLD.speed*1000)+1;state=tick(walk.state,now).state;
  assert(world.distance(state.players.find(p=>p.id===actor.id).position,station)<.01);
  const step=applyAction(state,actor.id,{id:'solve-first-step',type:'taskStep',taskId:task.id,step:0,input:taskInput(task)},now);assert(step.accepted,JSON.stringify(step.error));assert.equal(step.state.mapId,mapId);
  room={...room,state:step.state,updatedAt:now};await validateRoomSnapshot(room);
 });
}

for(const mapId of maps)test(`map authority: ${mapId} genuine witnesses in added rooms remain usable by demo council`,async()=>{
 const {observe,candidates}=await import('../server/ai/demo.mjs');
 const {getPlayerView}=await import('../server/engine/index.mjs');
 let state=createMatch({id:('witness_'+mapId).padEnd(32,'x'),world:true,mapId,mode:'spectator',seed:'map-witness-audit',now:1000,config:{initialKillCooldownMs:1}});
 const added=getWorld(mapId).WORLD_ROOMS.find(r=>!['bridge','archive','lantern','workshop','galley','engine'].includes(r.id)),position=getWorld(mapId).WORLD_STATIONS[added.id];
 const killer=state.players.find(p=>p.role==='saboteur'),crew=state.players.filter(p=>p.role==='crew'),observer=crew[0],victim=crew[1];
 for(const p of [killer,observer,victim]){p.position={x:position.x,y:position.y};p.roomId=added.id;}
 const kill=applyAction(state,killer.id,{id:'witness-kill',type:'eliminate',targetId:victim.id},1001);assert(kill.accepted);state=kill.state;
 const view=getPlayerView(state,observer.id,1001);assert(view.events.some(e=>e.type==='witness'&&e.playerId===killer.id&&e.roomId===added.id));
 const memory={};observe(view,memory);assert.equal(memory.witnesses?.[killer.id]?.roomId,added.id,'A real observed attack must survive dynamic-room memory validation');
 const council={...view,phase:'discussion',availableActions:['say'],meeting:{id:'audit-council',messages:[],votes:[],eligibleVoters:state.players.filter(p=>p.alive).map(p=>p.id)}};
 const proposal=candidates(council,memory).find(a=>a.type==='say');assert(proposal);assert(proposal.text.includes(added.name),proposal.text);assert(proposal.text.includes('I saw'),proposal.text);
});

for(const mapId of maps)test(`map authority: ${mapId} rejects malformed task descriptors and unearned completions`,async()=>{
 for(const mutate of [t=>t.id='invalid',t=>t.completed='yes',t=>t.label={},t=>t.completed=true]){const room=fixture(mapId);mutate(room.state.players.find(p=>p.tasks.length).tasks[0]);await assert.rejects(validateRoomSnapshot(room));}
});
