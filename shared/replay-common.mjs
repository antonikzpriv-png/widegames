/** Acyclic pure bounds and strict historical/modern task validation. */
import {CAPTCHA_KINDS} from './captcha.mjs';
import {TASK_LENGTHS,TASK_ORDER} from './task-catalog.mjs';
import {validateStationChallenge,stationComplete} from './station-challenges.mjs';
export const REPLAY_LIMITS=Object.freeze({events:12000,bytes:2*1024*1024,checkpoints:14,interval:1024,route:128});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(o,a)=>object(o)&&Object.keys(o).every(k=>a.includes(k));
const time=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const bounded=(a,n)=>Array.isArray(a)&&a.length<=n;
const originalKinds=['wires','tuning','sequence','pressure','repair'];
const oldKinds=[...originalKinds,...CAPTCHA_KINDS];
const allKinds=[...new Set([...oldKinds,...TASK_ORDER])];
const totals={wires:3,tuning:1,sequence:4,pressure:2,repair:4,glyphs:3,count:2,order:4,rotate:3,oddity:2,code:1};
export function validReplayTaskProgress(p){
 return keys(p,['v','kind','target','sequence','pressure','total','index','readyAt'])&&((p.v===1&&originalKinds.includes(p.kind))||(p.v===2&&oldKinds.includes(p.kind))||(p.v===3&&TASK_ORDER.includes(p.kind)))&&Number.isInteger(p.target)&&p.target>=30&&p.target<=80&&bounded(p.sequence,4)&&p.sequence.length===4&&p.sequence.every(n=>Number.isInteger(n)&&n>=1&&n<=4)&&[2,3,4,6,7,8].includes(p.pressure)&&p.total===(p.v===3?TASK_LENGTHS[p.kind]:totals[p.kind])&&Number.isInteger(p.index)&&p.index>=0&&p.index<=p.total&&time(p.readyAt);
}
/** Strict task shape shared by mapped and historical map replay readers. */
export function validReplayTaskDefinition(t,{id,room,allowStation=true}){
 if(!keys(t,['id','roomId','label','completed','progress','kind','edition','challenge','taskKind'])||!id(t.id)||!room(t.roomId)||typeof t.label!=='string'||t.label.length>200||typeof t.completed!=='boolean'||t.taskKind!==undefined&&(typeof t.taskKind!=='string'||!t.taskKind.length||t.taskKind.length>32))return false;
 if(t.kind==='station'){
  if(!allowStation||t.progress!==undefined||t.edition!==undefined)return false;
  try{validateStationChallenge(t.challenge);return t.completed===stationComplete(t.challenge);}catch{return false;}
 }
 if(t.challenge!==undefined||t.kind!==undefined&&t.kind!=='relay'&&!allKinds.includes(t.kind)||t.edition!==undefined&&t.edition!==3)return false;
 if(t.edition===3&&!TASK_ORDER.includes(t.kind))return false;
 if(t.progress===undefined)return true;
 return validReplayTaskProgress(t.progress)&&(t.edition===3?t.progress.v===3&&t.progress.kind===t.kind:t.kind!==undefined&&t.kind!=='relay'?t.progress.v===2&&t.progress.kind===t.kind:t.progress.v===1);
}
