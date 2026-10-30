import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CAPTCHA_KINDS,captchaChallenge} from '../shared/captcha.mjs';
import {TASK_KINDS,challenge,taskProgress,taskInput,stepError,advanceTask,validProgress,validTaskKind} from '../server/engine/tasks.mjs';
import {createMatch,applyAction,getPlayerView} from '../server/engine/index.mjs';
import {validateRoomSnapshot} from '../server/store.mjs';
import {WORLD_STATIONS} from '../shared/world.mjs';

const clone=structuredClone;
function answer(progress){
 const display=captchaChallenge(progress);
 switch(progress.kind){
  case 'glyphs':return display.tiles.flatMap((value,index)=>value===display.target?[index]:[]).join(',');
  case 'count':return String(display.tiles.filter(value=>value===display.target).length);
  case 'order':return String([...display.items].sort((a,b)=>a-b)[progress.index]);
  case 'rotate':return {north:'aligned',east:'left',south:'half',west:'right'}[display.direction];
  case 'oddity':return String(display.tiles.findIndex(value=>display.tiles.filter(other=>other===value).length===1));
  case 'code':return display.code;
 }
}

function snapshot(state){return {schema:1,id:state.id,mode:state.mode,createdAt:1000,updatedAt:state.updatedAt,identities:[{hash:'a'.repeat(64),host:true,seatId:'p1'}],state,startId:'start',aiContext:{}};}

test('captcha: legacy task challenges and v1 saves keep their exact deterministic shape',()=>{
 const stations={bridge:'wires',lantern:'tuning',archive:'sequence',galley:'pressure',workshop:'repair',engine:'pressure'},lengths={wires:3,tuning:1,sequence:4,pressure:2,repair:4};
 for(const [roomId,kind]of Object.entries(stations)){
  const task={id:'unchanged-legacy-task',roomId,completed:false},bytes=createHash('sha256').update(task.id).digest();
  const expected={v:1,kind,target:30+bytes[0]%51,sequence:Array.from({length:4},(_,i)=>1+bytes[i]%4),pressure:[2,3,4,6,7,8][bytes[1]%6],total:lengths[kind],index:0,readyAt:0};
  assert.deepEqual(challenge(task),expected);assert(validTaskKind(task));assert(validProgress(expected,task));assert.equal(captchaChallenge(expected),null);
  const saved={...task,progress:clone(expected)};assert.deepEqual(taskProgress(saved),expected);assert.equal(saved.progress.v,1);
 }
 assert.equal(TASK_KINDS.length,11);assert.equal(new Set(TASK_KINDS).size,11);
 assert(!validTaskKind({roomId:'unknown'}));assert(!validTaskKind({roomId:'bridge',kind:'unknown'}));assert(!validTaskKind({roomId:'bridge',kind:null}));
 for(const kind of TASK_KINDS){const task={id:'explicit-legacy-or-new',roomId:'new-map-room',kind,completed:false};assert(validTaskKind(task));assert.equal(challenge(task).v,2);assert(validProgress(challenge(task),task));}
});

for(const kind of CAPTCHA_KINDS)test(`captcha: ${kind} display, answers, stage bounds and immutable challenge metadata`,()=>{
 const observed=new Set();
 for(let i=0;i<40;i++){
  const task={id:`captcha-${kind}-${i}`,kind,roomId:'new-map-room',completed:false};
  const initial=challenge(task);assert.equal(initial.v,2);assert.equal(initial.kind,kind);assert(initial.total>=1&&initial.total<=4);assert(validProgress(initial,task));
  task.progress=initial;
  while(task.progress.index<task.progress.total){
   const progress=task.progress,display=captchaChallenge(progress),before=clone(progress),expected=answer(progress);
   assert.deepEqual(display,captchaChallenge(JSON.parse(JSON.stringify(progress))));observed.add(JSON.stringify(display));
   assert.equal(taskInput(task),expected);assert.equal(typeof expected,'string');assert(expected.length>0&&expected.length<=40);
   assert.equal(stepError(task,{step:progress.index,input:'wrong answer'},1000).code,'WRONG_INPUT');assert.deepEqual(task.progress,before);
   assert.equal(stepError(task,{step:progress.index+1,input:expected},1000).code,'STALE_STEP');assert.deepEqual(task.progress,before);
   assert.equal(stepError(task,{step:progress.index,input:expected},1000),null);
   if(kind==='glyphs'||kind==='count'){assert.equal(display.tiles.length,9);const count=display.tiles.filter(value=>value===display.target).length;assert(count>=1&&count<=8);}
   if(kind==='oddity'){const counts=Object.values(display.tiles.reduce((all,value)=>(all[value]=(all[value]||0)+1,all),{})).sort((a,b)=>a-b);assert.deepEqual(counts,[1,8]);}
   if(kind==='order'){assert.equal(new Set(display.items).size,4);assert(display.items.every(Number.isInteger));assert.deepEqual(display.items,captchaChallenge({...progress,index:0}).items);}
   if(kind==='rotate')assert(['north','east','south','west'].includes(display.direction));
   if(kind==='code')assert.match(display.code,/^[ACFHJKMNPQRTUVWXYZ2346789]{6}$/);
   if(display.tiles){display.tiles[0]='mutated';assert.notDeepEqual(display,captchaChallenge(progress));}assert.deepEqual(task.progress,before);
   advanceTask(task,1000);assert(validProgress(task.progress,task));
  }
  assert.equal(stepError(task,{step:task.progress.index,input:'anything'},1000).code,'TASK_READY');task.completed=true;assert(validProgress(task.progress,task));
  for(const change of [p=>p.v=99,p=>p.target++,p=>p.sequence[0]++,p=>p.pressure++,p=>p.total++,p=>p.index++,p=>p.readyAt=1,p=>p.extra=true]){const invalid=clone(task.progress);change(invalid);assert(!validProgress(invalid,task));}
 }
 assert(kind==='rotate'?observed.size===4:observed.size>10,'task IDs must generate varied deterministic challenges');
});

for(const kind of CAPTCHA_KINDS)test(`captcha: authoritative ${kind} steps, receipts, privacy, restart and actual task victory`,async()=>{
 let state=createMatch({id:('captcha-engine-'+kind).padEnd(24,'x'),mode:'human',world:true,seed:'captcha-engine',now:1000});
 const owner=state.players.find(player=>player.role==='crew'),task=owner.tasks[0];task.kind=kind;task.roomId='bridge';owner.roomId='bridge';owner.position={x:WORLD_STATIONS.bridge.x,y:WORLD_STATIONS.bridge.y};
 for(const player of state.players)for(const other of player.tasks)other.completed=other.id!==task.id;
 const apply=action=>{const result=applyAction(state,owner.id,action,1000);state=result.state;return result;};
 assert.equal(apply({id:'direct-finish',type:'task',taskId:task.id}).error.code,'TASK_INCOMPLETE');
 const denied={id:'wrong-receipt',type:'taskStep',taskId:task.id,step:0,input:'wrong answer'};assert.equal(apply(denied).error.code,'WRONG_INPUT');
 let step=0;
 while(true){
  const own=state.players.find(player=>player.id===owner.id).tasks.find(other=>other.id===task.id),progress=taskProgress(own);
  if(progress.index===progress.total)break;
  const action={id:'step-'+step,type:'taskStep',taskId:task.id,step:progress.index,input:answer(progress)};
  const result=apply(action);assert(result.accepted,JSON.stringify(result.error));assert.equal(taskProgress(state.players.find(player=>player.id===owner.id).tasks.find(other=>other.id===task.id)).index,step+1);
  state=JSON.parse(JSON.stringify(state));await validateRoomSnapshot(snapshot(state));
  assert(apply(action).duplicate);assert.equal(apply({...action,input:'changed'}).error.code,'REQUEST_CONFLICT');
  const receipt=apply(denied);assert(receipt.duplicate);assert.equal(receipt.error.code,'WRONG_INPUT');
  const ownView=getPlayerView(state,owner.id,1000);assert.equal(ownView.self.tasks.find(other=>other.id===task.id).progress.kind,kind);ownView.self.tasks.find(other=>other.id===task.id).progress.target++;
  assert(validProgress(state.players.find(player=>player.id===owner.id).tasks.find(other=>other.id===task.id).progress,own));
  const publicView=getPlayerView(state,null,1000);assert.equal(publicView.self,null);assert(publicView.players.every(player=>!Object.hasOwn(player,'tasks')));step++;
 }
 const finished=apply({id:'finish',type:'task',taskId:task.id});assert(finished.accepted);assert.equal(state.outcome.winner,'crew');assert.equal(state.outcome.reason,'tasks');await validateRoomSnapshot(snapshot(state));
});
