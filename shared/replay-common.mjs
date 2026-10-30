/** Acyclic pure bounds and unchanged legacy task-progress validation. */
export const REPLAY_LIMITS=Object.freeze({events:12000,bytes:2*1024*1024,checkpoints:14,interval:1024,route:128});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(o,a)=>object(o)&&Object.keys(o).every(k=>a.includes(k));
const time=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const bounded=(a,n)=>Array.isArray(a)&&a.length<=n;
export function validReplayTaskProgress(p){
 return keys(p,['v','kind','target','sequence','pressure','total','index','readyAt'])&&p.v===1&&['wires','tuning','sequence','pressure','repair'].includes(p.kind)&&Number.isInteger(p.target)&&p.target>=30&&p.target<=80&&bounded(p.sequence,4)&&p.sequence.length===4&&p.sequence.every(n=>Number.isInteger(n)&&n>=1&&n<=4)&&[2,3,4,6,7,8].includes(p.pressure)&&[1,2,3,4].includes(p.total)&&Number.isInteger(p.index)&&p.index>=0&&p.index<=p.total&&time(p.readyAt);
}
