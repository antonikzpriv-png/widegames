import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import * as engine from '../server/engine/index.mjs';
import {taskInput,taskProgress,challenge} from '../server/engine/tasks.mjs';
import {TASK_CATALOG} from '../shared/task-catalog.mjs';
import {MAPS,getWorld} from '../shared/world.mjs';
import {createRoom,issueIdentity} from '../server/rooms.mjs';
import {createRoomStore,validateRoomSnapshot} from '../server/store.mjs';

for(const {id:mapId} of MAPS)test(`two-station power ${mapId}: divert routes privately, reload retains destination, acceptance requires travel`,async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'lantern-power-route-'));let store=await createRoomStore(directory);
 try{
  let now=10000,room=createRoom('human',now,true);issueIdentity(room,true);room.startId='power-start';room.settings={...room.settings,tasksPerCrew:8,taskMix:'equipment'};if(mapId!=='beacon')room.mapId=mapId;
  let state,task;for(let seed=0;seed<100;seed++){state=engine.createMatch({id:room.id,world:true,mode:'human',settings:room.settings,roster:room.roster,mapId,now,seed,config:{roamDeadlineMs:900000,maxMatchMs:3600000}});if(state.players[0].role==='crew'&&(task=state.players[0].tasks.find(t=>t.kind==='power')))break;}
  assert(task,'real assignment must include human-owned power job');const taskId=task.id,originalRoom=task.roomId,map=getWorld(mapId);let receipt=0;
  const current=()=>state.players[0].tasks.find(t=>t.id===taskId);
  function action(type,fields,id='power-'+receipt++){const result=engine.applyAction(state,'p1',{id,type,...fields},now);state=result.state;return result;}
  function travel(roomId){const station=map.WORLD_STATIONS[roomId],route=map.findWorldPath(state.players[0].position,station);assert(route);let length=0,previous=state.players[0].position;for(const point of route){length+=map.distance(previous,point);previous=point;}const navigation=action('navigate',station);assert(navigation.accepted,JSON.stringify(navigation.error));now+=Math.ceil(length/room.settings.speed*1000)+20;state=engine.tick(state,now).state;assert.equal(state.players[0].roomId,roomId);assert(map.distance(state.players[0].position,station)<1);}
  travel(originalRoom);const divert={taskId,step:0,input:taskInput(current())};
  const forged=action('taskStep',{...divert,roomId:originalRoom});assert.equal(forged.accepted,false);assert.equal(forged.error.code,'INVALID_ACTION');
  const accepted=action('taskStep',divert,'divert-once');assert(accepted.accepted,JSON.stringify(accepted.error));const destination=current().roomId;
  assert.notEqual(destination,originalRoom);assert(map.WORLD_STATIONS[destination]);assert.equal(taskProgress(current()).index,1);assert.equal(current().id,taskId);assert.equal(current().edition,3);assert.equal(current().kind,'power');
  const routeEvent=state.replay.find(e=>e.type==='task_routed'&&e.taskId===taskId);assert.equal(routeEvent.roomId,destination);assert.equal(routeEvent.label,current().label);
  const duplicate=action('taskStep',divert,'divert-once');assert(duplicate.accepted);assert(duplicate.duplicate);assert.equal(current().roomId,destination);assert.equal(state.replay.filter(e=>e.type==='task_routed'&&e.taskId===taskId).length,1);
  const wrongStation=action('taskStep',{taskId,step:1,input:'accept'});assert.equal(wrongStation.accepted,false);assert.equal(wrongStation.error.code,'INVALID_TASK');assert.equal(taskProgress(current()).index,1);
  for(const viewer of [null,'p2']){const safe=JSON.stringify(engine.getPlayerView(state,viewer,now));assert(!safe.includes(taskId));assert(!safe.includes('task_routed'));}
  room.state=state;room.updatedAt=now;await validateRoomSnapshot(room);await store.save(room);await store.close();store=await createRoomStore(directory);[room]=await store.load();assert(room);state=room.state;
  assert.equal(current().roomId,destination);assert.equal(taskProgress(current()).index,1);assert.equal(current().label,routeEvent.label);assert(!(await readdir(directory)).some(name=>name.includes('quarantine')));
  travel(destination);assert.equal(action('task',{taskId}).error.code,'TASK_INCOMPLETE');assert(action('taskStep',{taskId,step:1,input:'accept'}).accepted);assert.equal(taskProgress(current()).index,2);assert(action('task',{taskId}).accepted);assert(current().completed);
  room.state=state;room.updatedAt=now;await store.save(room);await validateRoomSnapshot(room);
 }finally{await store.close();await rm(directory,{recursive:true,force:true});}
});

test('duration metadata describes original short/long workflows without claiming common assignment',()=>{
 assert.equal(TASK_CATALOG.power.durationClass,'long');assert.equal(TASK_CATALOG.steering.durationClass,'short');assert(Object.values(TASK_CATALOG).every(item=>['short','long'].includes(item.durationClass)));assert(Object.values(TASK_CATALOG).every(item=>!Object.hasOwn(item,'taskClass')));
 const historic={id:'old-power-like',roomId:'bridge',kind:'wires'};assert.equal(challenge(historic).v,2);
});
