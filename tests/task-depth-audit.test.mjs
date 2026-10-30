import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as engine from '../server/engine/index.mjs';
import {TASK_ORDER} from '../shared/task-catalog.mjs';
import {taskProgress,taskWaitUntil,challenge,validProgress} from '../server/engine/tasks.mjs';
import {getWorld} from '../shared/world.mjs';
import {LOBBY_DEFAULTS,rosterFor} from '../shared/lobby.mjs';
import {createRoom,issueIdentity} from '../server/rooms.mjs';
import {createRoomStore,validateRoomSnapshot} from '../server/store.mjs';
import {publicAnswer} from './task-depth-oracle.mjs';

function fixture(kind,capacity=6){
 const room=createRoom('human',1000,true);issueIdentity(room,true);room.settings={...LOBBY_DEFAULTS,capacity,saboteurs:capacity===15?3:1,tasksPerCrew:1};room.roster=rosterFor(capacity);room.startId='task-depth';
 let seed=0,state;do{state=engine.createMatch({id:room.id,mode:'human',world:true,settings:room.settings,roster:room.roster,now:1000,seed:seed++});}while(state.players[0].role!=='crew');
 const actor=state.players[0],task=actor.tasks[0];Object.assign(task,{kind,edition:3,roomId:'bridge'});delete task.progress;actor.position={...getWorld().WORLD_STATIONS.bridge};actor.roomId='bridge';room.state=state;return {room,id:task.id};
}
let receipt=0;
function action(state,type,fields,now=state.updatedAt,actor='p1'){return engine.applyAction(state,actor,{id:'depth-'+(++receipt),type,...fields},now);}
const ownTask=(state,id)=>engine.getPlayerView(state,'p1',state.updatedAt).self.tasks.find(t=>t.id===id);

for(const kind of TASK_ORDER)test(`independent task authority ${kind}: wrong/future/duplicate inputs, privacy and real completion`,async()=>{
 const f=fixture(kind);let state=f.room.state,task=ownTask(state,f.id),now=1000;
 const direct=action(state,'task',{taskId:task.id});assert.equal(direct.accepted,false);assert.equal(direct.error.code,'TASK_INCOMPLETE');state=direct.state;
 while(task.progress.index<task.progress.total){
  if(kind==='power'&&task.progress.index===1&&state.players[0].roomId!==task.roomId){const remote=action(state,'taskStep',{taskId:task.id,step:1,input:publicAnswer(task.progress)},now);assert.equal(remote.accepted,false);assert.equal(ownTask(remote.state,task.id).progress.index,1);state=remote.state;const w=getWorld(state.mapId),target=w.WORLD_STATIONS[task.roomId],start=state.players[0].position,route=w.findWorldPath(start,target);assert(route);let length=0,prior=start;for(const point of route){length+=w.distance(prior,point);prior=point;}const moved=action(state,'navigate',{x:target.x,y:target.y},now);assert(moved.accepted);now+=Math.ceil(length/state.lobbySettings.speed*1000)+50;state=engine.tick(moved.state,now).state;assert.equal(state.players[0].roomId,task.roomId);task=ownTask(state,task.id);}
  const before=structuredClone(task.progress),step=before.index;
  for(const bad of [{step,input:'unverified-solved'},{step:step+1,input:publicAnswer(before)}]){
   const result=action(state,'taskStep',{taskId:task.id,...bad},now);assert.equal(result.accepted,false);assert.deepEqual(ownTask(result.state,task.id).progress,before);state=result.state;
  }
  const wait=taskWaitUntil(task);if(wait>now){const early=action(state,'taskStep',{taskId:task.id,step,input:publicAnswer(before)},wait-1);assert.equal(early.accepted,false);assert.equal(early.error.code,'TOO_EARLY');assert.deepEqual(ownTask(early.state,task.id).progress,before);state=early.state;now=wait;}
  const input={id:'depth-confirm-'+(++receipt),type:'taskStep',taskId:task.id,step,input:publicAnswer(before)};
  const result=engine.applyAction(state,'p1',input,now);assert.equal(result.accepted,true,kind+': '+JSON.stringify(result.error));state=result.state;
  const duplicate=engine.applyAction(state,'p1',input,now);assert.equal(duplicate.duplicate,true);assert.equal(ownTask(duplicate.state,task.id).progress.index,step+1);state=JSON.parse(JSON.stringify(duplicate.state));task=ownTask(state,task.id);
  f.room.state=state;f.room.updatedAt=now;await validateRoomSnapshot(f.room);
  const spectator=engine.getPlayerView(state,null,now),other=engine.getPlayerView(state,state.players.find(p=>p.id!=='p1'&&p.role==='crew').id,now);assert(!JSON.stringify(spectator).includes(task.id));assert(!JSON.stringify(other).includes(task.id));assert.equal(engine.getReplay(state),null);
 }
 const done=action(state,'task',{taskId:task.id},now);assert(done.accepted,JSON.stringify(done.error));assert.equal(ownTask(done.state,task.id).completed,true);assert.equal(done.state.players.flatMap(p=>p.tasks).filter(t=>t.completed).length,1);
});

for(const capacity of [4,6,15])test(`task depth ${capacity}: timed stage survives strict private disk reload`,async()=>{
 const f=fixture('sample',capacity),directory=await mkdtemp(path.join(os.tmpdir(),'task-depth-save-'));let store;
 try{
  const initial=ownTask(f.room.state,f.id),result=action(f.room.state,'taskStep',{taskId:f.id,step:0,input:publicAnswer(initial.progress)},1000);assert(result.accepted);f.room.state=result.state;
  store=await createRoomStore(directory);await store.save(f.room);const bytes=await readFile(path.join(directory,'room-'+f.room.id+'.json'),'utf8');await store.close();store=await createRoomStore(directory);const [restored]=await store.load();assert(restored);assert.equal(restored.state.players.length,capacity);assert.deepEqual(ownTask(restored.state,f.id).progress,ownTask(f.room.state,f.id).progress);assert.equal(await readFile(path.join(directory,'room-'+f.room.id+'.json'),'utf8'),bytes);assert(!(await readdir(directory)).some(n=>n.includes('quarantine')));
  const task=ownTask(restored.state,f.id),tooEarly=action(restored.state,'taskStep',{taskId:f.id,step:1,input:publicAnswer(task.progress)},3999);assert.equal(tooEarly.accepted,false);assert.equal(tooEarly.error.code,'TOO_EARLY');const ready=action(tooEarly.state,'taskStep',{taskId:f.id,step:1,input:publicAnswer(task.progress)},4000);assert(ready.accepted);
 }finally{await store?.close();await rm(directory,{recursive:true,force:true});}
});

test('task depth movement interrupts network transfer, while sample incubation continues',()=>{
 for(const [kind,expected]of [['transfer',0],['sample',1]]){
  const f=fixture(kind),task=ownTask(f.room.state,f.id),start=action(f.room.state,'taskStep',{taskId:f.id,step:0,input:publicAnswer(task.progress)});assert(start.accepted);const move=engine.applyInput(start.state,'p1',{seq:1,dx:-1,dy:0},1100);assert(move.accepted);assert.equal(ownTask(move.state,f.id).progress.index,expected);assert.equal(ownTask(move.state,f.id).progress.readyAt,kind==='transfer'?0:4000);
 }
});

test('task depth rejects fabricated progress versions, totals, timing and challenge identity',()=>{
 for(const kind of TASK_ORDER){const task={id:'task-depth-invalid-'+kind,roomId:'bridge',kind,edition:3,completed:false},c=challenge(task);assert(validProgress(c,task,{startedAt:1000,updatedAt:1000}));for(const corrupt of [{...c,v:2},{...c,total:c.total+1},{...c,index:c.total+1},{...c,target:c.target+1},{...c,readyAt:123456},{...c,forged:true}])assert.equal(validProgress(corrupt,task,{startedAt:1000,updatedAt:1000}),false,kind+': '+JSON.stringify(corrupt));}
});
