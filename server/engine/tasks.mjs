import {createHash} from 'node:crypto';
import {CAPTCHA_KINDS,captchaChallenge} from '../../shared/captcha.mjs';
import {TASK_CATALOG,TASK_ORDER,TASK_TIMERS,taskDisplay} from '../../shared/task-catalog.mjs';

export const TASK_KINDS=Object.freeze(['wires','tuning','sequence','pressure','repair',...CAPTCHA_KINDS]);
export const HISTORICAL_TASK_KINDS=TASK_KINDS;
export const ALL_TASK_KINDS=TASK_ORDER;
export const DIAGNOSTIC_MS=1500;
const stationKinds={bridge:'wires',lantern:'tuning',archive:'sequence',galley:'pressure',workshop:'repair',engine:'pressure'};
const lengths={wires:3,tuning:1,sequence:4,pressure:2,repair:4,glyphs:3,count:2,order:4,rotate:3,oddity:2,code:1};

/** Old tasks remain station-derived; expanded-map tasks declare a validated kind. */
const originalKinds=['wires','tuning','sequence','pressure','repair'];
export const validTaskKind=task=>!!task&&typeof task==='object'&&(!Object.hasOwn(task,'edition')||task.edition===3)&&(!Object.hasOwn(task,'edition')||Object.hasOwn(task,'kind'))&&(Object.hasOwn(task,'kind')&&task.kind!=='relay'?(task.edition===3?ALL_TASK_KINDS:HISTORICAL_TASK_KINDS).includes(task.kind):Object.hasOwn(task,'taskKind')?originalKinds.includes(task.taskKind):Object.hasOwn(stationKinds,task.roomId));

/** Version 1 remains deterministic for existing saves without optional metadata. */
export function challenge(task) {
 const bytes=createHash('sha256').update(task.id).digest();
 const explicit=Object.hasOwn(task,'kind')&&task.kind!=='relay',kind=explicit?task.kind:originalKinds.includes(task.taskKind)?task.taskKind:stationKinds[task.roomId];
 return {
  v:task.edition===3?3:explicit?2:1,kind,target:30+bytes[0]%51,
  sequence:Array.from({length:4},(_,i)=>1+bytes[i]%4),
  pressure:[2,3,4,6,7,8][bytes[1]%6],total:task.edition===3?TASK_CATALOG[kind]?.total:lengths[kind],index:0,readyAt:0
 };
}
export const taskProgress=task=>task.progress??challenge(task);

/** Shared with local bots; accepts only a task from that actor's permitted view. */
export function taskInput(task) {
 const progress=taskProgress(task),display=captchaChallenge(progress);
 if(progress.v===3)return modernInput(progress);
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
function modernInput(c){
 const d=taskDisplay(c);
 switch(c.kind){
  case 'wires':return `${c.index}:${d.wireOrder.indexOf(c.index)}`;
  case 'sequence':return c.sequence.slice(0,c.index+1).join(',');
  case 'course':return String(d.course[c.index].id);
  case 'steering':return `${d.axes[c.index].id}:${d.axes[c.index].target}`;
  case 'shields':return d.cells.flatMap((red,i)=>red?[i]:[]).join(',');
  case 'power':return c.index===0?`${d.channel}:100`:'accept';
  case 'transfer':return ['connect','transfer','verify'][c.index];
  case 'sample':return ['start','incubate',String(d.oddVial)][c.index];
  case 'filter':return `remove:${c.index}`;
  case 'pairs':return d.tiles.flatMap((tile,i)=>d.tiles.filter(t=>t===tile).length===2?[i]:[]).join(',');
  case 'arithmetic':return String(d.operator==='+'?d.left+d.right:d.left-d.right);
  case 'compare':return String(d.gauges.indexOf(Math.max(...d.gauges)));
  case 'pattern':return d.pattern[2];
  case 'frequency':return String(d.waves.findIndex(w=>JSON.stringify(w)===JSON.stringify(d.signal)));
  case 'sorting':return d.item.material;
  case 'path':return String(d.route[c.index]);
  default:return taskInput({progress:{...c,v:2}});
 }
}
/** Local bots and UI wait hints use this clock; only stepError authorizes progress. */
export function taskWaitUntil(task){const c=taskProgress(task);return (c.kind==='repair'&&c.index===3||c.v===3&&['transfer','sample'].includes(c.kind)&&c.index===1)?c.readyAt:0;}
export function stepError(task,action,now) {
 const progress=taskProgress(task);
 if(progress.index>=progress.total)return {code:'TASK_READY',message:'All steps are confirmed. Send the completed task.'};
 if(action.step!==progress.index)return {code:'STALE_STEP',message:'Task progress changed. Reopen the station.'};
 if(action.input!==taskInput(task))return {code:'WRONG_INPUT',message:'Equipment input is incorrect. Check the station instructions.'};
 if(now<taskWaitUntil(task))return {code:'TOO_EARLY',message:progress.kind==='sample'?'Samples are still incubating. Wait for the server timer.':progress.kind==='transfer'?'Data transfer is still running. Wait for the server timer.':'Diagnostic is still running. Wait for the server timer.'};
 return null;
}
export function advanceTask(task,now,layout) {
 task.progress=taskProgress(task);
 task.progress.index++;
 if(task.progress.kind==='repair'&&task.progress.index===3)task.progress.readyAt=now+DIAGNOSTIC_MS;
 if(task.progress.v===3&&['transfer','sample'].includes(task.progress.kind)&&task.progress.index===1)task.progress.readyAt=now+TASK_TIMERS[task.progress.kind];
 if(task.progress.v===3&&task.progress.kind==='power'&&task.progress.index===1&&layout){
  const destinations=layout.filter(room=>room.id!==task.roomId);
  if(!destinations.length)throw new Error('Power routing requires a distinct map station');
  const selected=createHash('sha256').update(`${task.id}:accept-power`).digest().readUInt32BE(0)%destinations.length,destination=destinations[selected];
  task.roomId=destination.id;task.label=`${TASK_CATALOG.power.title} · ${destination.name}`;
 }
}
export function interruptTasks(state) {
 for(const player of state.players)for(const task of player.tasks) {
  if(task.progress?.kind==='repair'&&task.progress.index===3) {
   task.progress.index=2;
   task.progress.readyAt=0;
  }
  if(task.progress?.v===3&&task.progress.kind==='transfer'&&task.progress.index===1){task.progress.index=0;task.progress.readyAt=0;}
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
 const timed=progress.v===3&&['transfer','sample'].includes(progress.kind)&&progress.index>=1;
 if(!diagnostic&&!timed)return progress.readyAt===0;
 const duration=diagnostic?DIAGNOSTIC_MS:TASK_TIMERS[progress.kind];
 if(progress.readyAt<duration)return false;
 if(clock) {
  if(progress.readyAt<clock.startedAt+duration||progress.readyAt>clock.updatedAt+duration)return false;
  if((diagnostic&&progress.index===4||timed&&progress.index>=2)&&progress.readyAt>clock.updatedAt)return false;
 }
 return true;
}
