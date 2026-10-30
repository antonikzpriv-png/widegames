import {applyStationInput,projectStationChallenge,stationProgress,validateStationChallenge} from '../../../shared/station-challenges.mjs';
/** Trusted packaged task definitions; both human and robot submit validated inputs. */
export function createTaskRegistry(definitions=[]){
 const kinds=new Map();for(const d of definitions){if(!d||typeof d.id!=='string'||kinds.has(d.id)||typeof d.validate!=='function'||typeof d.apply!=='function')throw new TypeError('Invalid task registration');kinds.set(d.id,Object.freeze({...d}));}
 return Object.freeze({
  validate(state,p,a,now,ctx){const t=p.tasks.find(t=>t.id===a.taskId);if(p.role!=='crew'||!t||t.completed||!ctx.nearby(state,p,ctx.geometry.WORLD_STATIONS[t.roomId],ctx.geometry.WORLD.interactionRadius))return{code:'INVALID_TASK',message:'No available task here.'};if(now<p.cooldowns.taskAt)return{code:'COOLDOWN',message:'Task equipment is cooling down.'};const d=kinds.get(t.kind??'relay');return d?d.validate(t,a,state,p,now,ctx):{code:'TASK_UNSUPPORTED',message:'This task definition is unavailable.'};},
  apply(state,p,a,now,ctx){const t=p.tasks.find(t=>t.id===a.taskId),d=kinds.get(t.kind??'relay');d.apply(t,a,state,p,now,ctx);if(t.completed)p.cooldowns.taskAt=now+state.rules.taskCooldownMs;ctx.record(state,t.kind==='station'&&a.type==='task'?'task_opened':'task_progress',now,{playerId:p.id,taskId:t.id,completed:t.completed,visibleTo:[p.id]});},
  progress(task){return task.kind==='station'?{kind:'station',challenge:projectStationChallenge(task.challenge),...stationProgress(task.challenge)}:{kind:task.kind??'relay',completed:!!task.completed,progress:task.completed?1:0,total:1};},
  kinds:Object.freeze([...kinds.keys()])
 });
}
export const relayTask=Object.freeze({id:'relay',validate(task,a){return a.type==='task'||(a.interactionId==='confirm'&&a.value==='complete')?null:{code:'INVALID_TASK_INPUT',message:'Unrecognized relay interaction.'};},apply(task){task.completed=true;}});
export const stationTask=Object.freeze({id:'station',validate(task,a,state){if(state.schemaVersion!==5||state.stationTasksVersion!==1)return{code:'TASK_UNSUPPORTED',message:'Station puzzle version is unavailable.'};try{validateStationChallenge(task.challenge);}catch{return{code:'TASK_UNAVAILABLE',message:'Station puzzle data is unavailable.'};}if(a.type==='task')return null;return applyStationInput(task.challenge,{interactionId:a.interactionId,value:a.value}).error??null;},apply(task,a){if(a.type==='task')return;const result=applyStationInput(task.challenge,{interactionId:a.interactionId,value:a.value});if(!result.accepted)throw new Error('Unvalidated station interaction');task.challenge=result.challenge;task.completed=result.completed;}});
export const taskService=createTaskRegistry([relayTask,stationTask]);
