import {createHash} from 'node:crypto';
export const TASK_KINDS=['wires','tuning','sequence','pressure','repair'];
export function challenge(task){
 const b=createHash('sha256').update(task.id).digest();
 const kind=({bridge:'wires',lantern:'tuning',archive:'sequence',galley:'pressure',workshop:'repair',engine:'pressure'})[task.roomId];
 const target=30+b[0]%51, sequence=[...Array(4)].map((_,i)=>1+b[i]%4);
 return {v:1,kind,target,sequence,pressure:[2,3,4,6,7,8][b[1]%6],total:({wires:3,tuning:1,sequence:4,pressure:2,repair:4})[kind],index:0,readyAt:0};
}
export const taskProgress=t=>t.progress??challenge(t);
export function taskInput(t){const c=taskProgress(t);return c.kind==='wires'?`${c.index}:${c.index}`:c.kind==='tuning'?String(c.target):c.kind==='sequence'?String(c.sequence[c.index]):c.kind==='pressure'?(c.index===0?(c.pressure<5?'right-to-left':'left-to-right'):String(Math.abs(5-c.pressure))):['isolate','replace','start','test'][c.index];}
export function stepError(t,a,now){const c=taskProgress(t);if(c.index>=c.total)return {code:'TASK_READY',message:'All steps are confirmed. Send the completed task.'};if(a.step!==c.index)return {code:'STALE_STEP',message:'Task progress changed. Reopen the station.'};if(a.input!==taskInput(t))return {code:'WRONG_INPUT',message:'Equipment input is incorrect. Check the station instructions.'};if(c.kind==='repair'&&c.index===3&&now<c.readyAt)return {code:'TOO_EARLY',message:'Diagnostic is still running. Wait for the server timer.'};return null;}
export function advanceTask(t,now){t.progress=taskProgress(t);const c=t.progress;c.index++;if(c.kind==='repair'&&c.index===3)c.readyAt=now+1500;}
export function interruptTasks(state){for(const p of state.players)for(const t of p.tasks)if(t.progress?.kind==='repair'&&t.progress.index===3){t.progress.index=2;t.progress.readyAt=0;}}
export function validProgress(c,t){const base=challenge(t);return c&&Object.keys(c).sort().join()===Object.keys(base).sort().join()&&c.v===1&&c.kind===base.kind&&c.target===base.target&&JSON.stringify(c.sequence)===JSON.stringify(base.sequence)&&c.pressure===base.pressure&&c.total===base.total&&Number.isInteger(c.index)&&c.index>=0&&c.index<=c.total&&Number.isSafeInteger(c.readyAt)&&c.readyAt>=0;}
