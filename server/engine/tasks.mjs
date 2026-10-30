import {createHash} from 'node:crypto';
import {CAPTCHA_KINDS,captchaChallenge} from '../../shared/captcha.mjs';

export const TASK_KINDS=Object.freeze(['wires','tuning','sequence','pressure','repair',...CAPTCHA_KINDS]);
export const DIAGNOSTIC_MS=1500;
const stationKinds={bridge:'wires',lantern:'tuning',archive:'sequence',galley:'pressure',workshop:'repair',engine:'pressure'};
const lengths={wires:3,tuning:1,sequence:4,pressure:2,repair:4,glyphs:3,count:2,order:4,rotate:3,oddity:2,code:1};

/** Old tasks remain station-derived; expanded-map tasks declare a validated kind. */
const originalKinds=['wires','tuning','sequence','pressure','repair'];
export const validTaskKind=task=>!!task&&typeof task==='object'&&(Object.hasOwn(task,'kind')&&task.kind!=='relay'?TASK_KINDS.includes(task.kind):Object.hasOwn(task,'taskKind')?originalKinds.includes(task.taskKind):Object.hasOwn(stationKinds,task.roomId));

/** Version 1 remains deterministic for existing saves without optional metadata. */
export function challenge(task) {
 const bytes=createHash('sha256').update(task.id).digest();
 const explicit=Object.hasOwn(task,'kind')&&task.kind!=='relay',kind=explicit?task.kind:originalKinds.includes(task.taskKind)?task.taskKind:stationKinds[task.roomId];
 return {
  v:explicit?2:1,kind,target:30+bytes[0]%51,
  sequence:Array.from({length:4},(_,i)=>1+bytes[i]%4),
  pressure:[2,3,4,6,7,8][bytes[1]%6],total:lengths[kind],index:0,readyAt:0
 };
}
export const taskProgress=task=>task.progress??challenge(task);

/** Shared with local bots; accepts only a task from that actor's permitted view. */
export function taskInput(task) {
 const progress=taskProgress(task),display=captchaChallenge(progress);
 switch(progress.kind) {
  case 'wires': return `${progress.index}:${progress.index}`;
  case 'tuning': return String(progress.target);
  case 'sequence': return String(progress.sequence[progress.index]);
  case 'pressure': return progress.index===0
   ? (progress.pressure<5?'right-to-left':'left-to-right')
   : String(Math.abs(5-progress.pressure));
  case 'repair': return ['isolate','replace','start','test'][progress.index];
  case 'glyphs': return display.tiles.flatMap((tile,index)=>tile===display.target?[index]:[]).join(',');
  case 'count': return String(display.tiles.filter(tile=>tile===display.target).length);
  case 'order': return String([...display.items].sort((a,b)=>a-b)[progress.index]);
  case 'rotate': return {north:'aligned',east:'left',south:'half',west:'right'}[display.direction];
  case 'oddity': return String(display.tiles.findIndex(tile=>display.tiles.filter(other=>other===tile).length===1));
  case 'code': return display.code;
 }
}
export function stepError(task,action,now) {
 const progress=taskProgress(task);
 if(progress.index>=progress.total)return {code:'TASK_READY',message:'All steps are confirmed. Send the completed task.'};
 if(action.step!==progress.index)return {code:'STALE_STEP',message:'Task progress changed. Reopen the station.'};
 if(action.input!==taskInput(task))return {code:'WRONG_INPUT',message:'Equipment input is incorrect. Check the station instructions.'};
 if(progress.kind==='repair'&&progress.index===3&&now<progress.readyAt)return {code:'TOO_EARLY',message:'Diagnostic is still running. Wait for the server timer.'};
 return null;
}
export function advanceTask(task,now) {
 task.progress=taskProgress(task);
 task.progress.index++;
 if(task.progress.kind==='repair'&&task.progress.index===3)task.progress.readyAt=now+DIAGNOSTIC_MS;
}
export function interruptTasks(state) {
 for(const player of state.players)for(const task of player.tasks) {
  if(task.progress?.kind==='repair'&&task.progress.index===3) {
   task.progress.index=2;
   task.progress.readyAt=0;
  }
 }
}

/** Reject impossible optional state while accepting all original metadata-free saves. */
export function validProgress(progress,task,clock) {
 if(!progress||typeof progress!=='object'||Array.isArray(progress))return false;
 const base=challenge(task);
 if(!validTaskKind(task)||!base.kind||Object.keys(progress).sort().join()!==Object.keys(base).sort().join())return false;
 if(progress.v!==base.v||progress.kind!==base.kind||progress.target!==base.target||
    JSON.stringify(progress.sequence)!==JSON.stringify(base.sequence)||
    progress.pressure!==base.pressure||progress.total!==base.total||
    !Number.isInteger(progress.index)||progress.index<0||progress.index>progress.total||
    !Number.isSafeInteger(progress.readyAt)||progress.readyAt<0)return false;
 if(task.completed&&progress.index!==progress.total)return false;
 const diagnostic=progress.kind==='repair'&&progress.index>=3;
 if(!diagnostic)return progress.readyAt===0;
 if(progress.readyAt<DIAGNOSTIC_MS)return false;
 if(clock) {
  if(progress.readyAt<clock.startedAt+DIAGNOSTIC_MS||progress.readyAt>clock.updatedAt+DIAGNOSTIC_MS)return false;
  if(progress.index===4&&progress.readyAt>clock.updatedAt)return false;
 }
 return true;
}
