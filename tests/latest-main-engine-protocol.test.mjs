import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TASK_KINDS,challenge,taskProgress,taskInput,stepError,advanceTask,validProgress,validTaskKind} from '../server/engine/tasks.mjs';
import {CAPTCHA_KINDS,captchaChallenge} from '../shared/captcha.mjs';
import {createMatch,applyAction,getPlayerView} from '../server/engine/index.mjs';
import {validReplayTaskProgress,validateReplayHistory,validateReplayMetadata} from '../shared/replay.mjs';
import {validateReplayHistoryState} from '../server/engine/replay-history.mjs';
const copy=structuredClone;
test('latest task families preserve exact old vectors, explicit v2 kinds and quality taskKind compatibility',()=>{
 const lengths={wires:3,tuning:1,sequence:4,pressure:2,repair:4};assert.equal(TASK_KINDS.length,11);
 for(const [roomId,kind]of Object.entries({bridge:'wires',lantern:'tuning',archive:'sequence',galley:'pressure',workshop:'repair'})){
  const t={id:'unchanged-task',roomId,completed:false},b=createHash('sha256').update(t.id).digest(),expected={v:1,kind,target:30+b[0]%51,sequence:Array.from({length:4},(_,i)=>1+b[i]%4),pressure:[2,3,4,6,7,8][b[1]%6],total:lengths[kind],index:0,readyAt:0};assert.deepEqual(challenge(t),expected);assert(validProgress(expected,t));assert.equal(captchaChallenge(expected),null);
 }
 const override={id:'old-quality-override',roomId:'bridge',taskKind:'repair'};assert.equal(challenge(override).kind,'repair');assert.equal(challenge(override).v,1);assert(validProgress(challenge(override),override));
 for(const kind of TASK_KINDS){const t={id:'explicit-'+kind,roomId:'expanded-room',kind};assert.equal(challenge(t).v,2);assert(validTaskKind(t));assert(validProgress(challenge(t),t));assert(validReplayTaskProgress(challenge(t)));assert.equal(validTaskKind({...t,kind:'station'}),false);}
});
test('all six CAPTCHA families reject wrong/stale inputs, preserve clue metadata and enforce final confirmation',()=>{
 for(const kind of CAPTCHA_KINDS){const t={id:'captcha-boundary-'+kind,kind,roomId:'bridge',completed:false};let count=0;
  while(taskProgress(t).index<taskProgress(t).total){const p=copy(taskProgress(t)),display=captchaChallenge(p),input=taskInput(t);assert(display);assert(input.length<=40);assert.equal(stepError(t,{step:p.index,input:'wrong'},1000).code,'WRONG_INPUT');assert.equal(stepError(t,{step:p.index+1,input},1000).code,'STALE_STEP');assert.deepEqual(taskProgress(t),p);assert.equal(stepError(t,{step:p.index,input},1000),null);advanceTask(t,1000);assert(validProgress(t.progress,t));count++;}
  assert(count>0);assert.equal(stepError(t,{step:count,input:'unused'},1000).code,'TASK_READY');const bad=copy(t.progress);bad.total++;assert.equal(validReplayTaskProgress(bad),false);assert.equal(validProgress(bad,t),false);
 }
});
test('real quality station map/roster/replay2 remain isolated from explicit step-task v2 metadata',()=>{
 const roster=Array.from({length:12},(_,i)=>({id:'custom_'+i,name:'Keeper '+i,color:'#aabbcc',persona:'Public keeper'}));const s=createMatch({id:'latest-quality-isolation',tactical:true,stationTasks:true,map:{id:'beacon',version:2},roster,saboteurCount:3,humanPlayerIds:[],mode:'spectator',seed:4,now:1000});assert.equal(s.schemaVersion,5);assert.deepEqual(s.map,{id:'beacon',version:2});assert.equal(s.players.length,12);assert.equal(s.players.flatMap(p=>p.tasks).length,36);assert(s.players.flatMap(p=>p.tasks).every(t=>t.kind==='station'&&t.challenge.version===1&&!t.progress));validateReplayHistory(s.replayHistory);validateReplayHistoryState(s.replayHistory,s);
 const owner=s.players.find(p=>p.role==='crew'),task=owner.tasks[0],result=applyAction(s,owner.id,{id:'wrong-protocol',type:'taskStep',taskId:task.id,step:0,input:'0:0'},1000);assert.equal(result.accepted,false);assert.deepEqual(s.players.find(p=>p.id===owner.id).tasks[0].challenge,task.challenge);const view=getPlayerView(s,null,1000);assert.equal(view.self,null);assert(view.players.every(p=>!('tasks'in p)&&!('role'in p)));assert.equal(view.replayHistory,undefined);
});
