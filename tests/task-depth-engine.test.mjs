import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import {TASK_CATALOG,TASK_ORDER,TASK_LENGTHS,taskDisplay} from '../shared/task-catalog.mjs';
import {challenge,taskProgress,taskInput,taskWaitUntil,validProgress,interruptTasks} from '../server/engine/tasks.mjs';
import {LOBBY_DEFAULTS,rosterFor} from '../shared/lobby.mjs';
import {WORLD_STATIONS,findWorldPath,distance,WORLD} from '../shared/world.mjs';

function fixture(kind){
 let now=10000,state=engine.createMatch({id:'task-depth-'+kind,world:true,now,seed:'depth-'+kind});
 const actor=state.players.find(p=>p.role==='crew'),task=actor.tasks[0];
 Object.assign(task,{kind,edition:3,roomId:'bridge',completed:false});delete task.progress;
 actor.position={...WORLD_STATIONS.bridge};actor.roomId='bridge';
 let sequence=0;
 const act=(input,step=taskProgress(state.players.find(p=>p.id===actor.id).tasks.find(t=>t.id===task.id)).index)=>{
  const action=input===undefined?{type:'task',taskId:task.id}:{type:'taskStep',taskId:task.id,step,input};
  const result=engine.applyAction(state,actor.id,{id:'input-'+sequence++,...action},now);state=result.state;return result;
 };
 return {get state(){return state;},get task(){return state.players.find(p=>p.id===actor.id).tasks.find(t=>t.id===task.id);},actor:actor.id,other:state.players.find(p=>p.id!==actor.id).id,act,travel(roomId){const station=WORLD_STATIONS[roomId],player=state.players.find(p=>p.id===actor.id),path=findWorldPath(player.position,station);assert(path);let length=0,previous=player.position;for(const point of path){length+=distance(previous,point);previous=point;}const result=engine.applyAction(state,actor.id,{id:'travel-'+sequence++,type:'navigate',...station},now);assert(result.accepted);state=result.state;now+=Math.ceil(length/WORLD.speed*1000)+10;state=engine.tick(state,now).state;},advance(ms){now+=ms;},get now(){return now;}};
}
for(const kind of TASK_ORDER)test(`detailed equipment: ${kind} validates every semantic step and real completion`,()=>{
 const f=fixture(kind);assert.equal(taskProgress(f.task).v,3);assert.equal(taskProgress(f.task).total,TASK_LENGTHS[kind]);
 const denied=f.act(undefined);assert.equal(denied.accepted,false);assert.equal(denied.error.code,'TASK_INCOMPLETE');
 const privateView=engine.getPlayerView(f.state,f.actor,f.now);assert.equal(privateView.self.tasks[0].edition,3);
 assert(!JSON.stringify(engine.getPlayerView(f.state,null,f.now)).includes(f.task.id),'public view must contain no private task');
 while(taskProgress(f.task).index<taskProgress(f.task).total){
  const before=structuredClone(taskProgress(f.task)),answer=taskInput(f.task);
  assert.equal(typeof answer,'string');assert(answer.length<=40);
  const wrong=f.act('wrong-input');assert.equal(wrong.accepted,false);assert.equal(wrong.error.code,'WRONG_INPUT');assert.deepEqual(taskProgress(f.task),before);
  const wait=taskWaitUntil(f.task);if(wait>f.now){const early=f.act(answer);assert.equal(early.accepted,false);assert.equal(early.error.code,'TOO_EARLY');assert.deepEqual(taskProgress(f.task),before);f.advance(wait-f.now);}
  const result=f.act(answer);assert.equal(result.accepted,true,JSON.stringify(result.error));
  assert.equal(taskProgress(f.task).index,before.index+1);assert(validProgress(taskProgress(f.task),f.task,f.state));
  if(f.state.players.find(p=>p.id===f.actor).roomId!==f.task.roomId)f.travel(f.task.roomId);
 }
 assert.equal(f.task.completed,false,'semantic inputs alone do not grant completion');assert.equal(f.act(undefined).accepted,true);assert.equal(f.task.completed,true);assert(validProgress(taskProgress(f.task),f.task,f.state));
});

test('modern task catalogue has complete equipment/CAPTCHA partitions and stable varied displays',()=>{
 assert.equal(TASK_ORDER.length,25);assert.equal(new Set(TASK_ORDER).size,25);
 assert.equal(Object.values(TASK_CATALOG).filter(t=>t.category==='equipment').length,12);
 assert.equal(Object.values(TASK_CATALOG).filter(t=>t.category==='captcha').length,13);
 for(const kind of TASK_ORDER){const task={id:'t-determinism-'+kind,kind,edition:3,roomId:'bridge'},c=challenge(task);assert.deepEqual(taskDisplay(c),taskDisplay(structuredClone(c)));assert.equal(c.total,TASK_CATALOG[kind].total);assert(c.total<=4);}
 const sockets=new Set(Array.from({length:30},(_,i)=>JSON.stringify(taskDisplay(challenge({id:'t'+i,kind:'wires',edition:3})).wireOrder)));assert(sockets.size>12,'wire socket permutations vary between task identities');
});

test('historical station v1 and explicit v2 challenges preserve exact versions and three-wire semantics',()=>{
 for(const task of [{id:'old-wire',roomId:'bridge'},{id:'old-explicit',roomId:'transit',kind:'wires'}]){
  const c=challenge(task);assert.equal(c.total,3);assert.equal(c.v,task.kind?2:1);assert.equal(taskInput({...task,progress:{...c,index:1}}),'1:1');assert(validProgress(c,task));
  const changed=structuredClone(c);changed.v=3;assert(!validProgress(changed,task));
 }
 for(const mutate of [t=>t.edition=2,t=>t.kind='unknown',t=>delete t.kind]){const t={id:'future',roomId:'bridge',kind:'wires',edition:3};mutate(t);assert(!validProgress(challenge(t),t));}
});

test('diagnostic/data-link interruptions restart only their waiting work; culture incubation persists',()=>{
 for(const kind of ['repair','transfer','sample']){
  const task={id:'timer-'+kind,roomId:'bridge',kind,edition:3};task.progress=challenge(task);
  const waitIndex=kind==='repair'?3:1;
  while(task.progress.index<waitIndex){task.progress.index++;if(task.progress.index===waitIndex)task.progress.readyAt=15000;}
  const before=structuredClone(task.progress);interruptTasks({players:[{tasks:[task]}]});
  if(kind==='sample')assert.deepEqual(task.progress,before);
  else{assert.equal(task.progress.index,kind==='repair'?2:0);assert.equal(task.progress.readyAt,0);}
 }
});

test('new configurable match assignments respect equipment/mixed/CAPTCHA pools and legacy taskEdition pin',()=>{
 for(const taskMix of ['equipment','mixed','captcha']){
  const settings={...LOBBY_DEFAULTS,capacity:15,saboteurs:3,tasksPerCrew:8,taskMix};
  const state=engine.createMatch({id:'assign-'+taskMix,world:true,now:10000,seed:'catalog',settings,roster:rosterFor(15)});
  const tasks=state.players.flatMap(p=>p.tasks);assert.equal(tasks.length,96);assert(tasks.every(t=>t.edition===3));
  if(taskMix!=='mixed')assert(tasks.every(t=>TASK_CATALOG[t.kind].category===taskMix));
  else assert.equal(new Set(tasks.map(t=>t.kind)).size,25);
  const old=engine.createMatch({id:'pinned-'+taskMix,world:true,now:10000,seed:'catalog',settings,roster:rosterFor(15),taskEdition:1});assert(old.players.flatMap(p=>p.tasks).every(t=>!Object.hasOwn(t,'edition')));
 }
});
