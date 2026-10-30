/** Versioned, bounded postgame recording contract. Never a live player view. */
export const REPLAY_VERSION=1;
export const REPLAY_MAP='lantern-wake-v1';
export const REPLAY_LIMITS=Object.freeze({events:12000,bytes:2*1024*1024,checkpoints:14,interval:1024,route:128});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const time=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const id=s=>typeof s==='string'&&/^[A-Za-z0-9:_-]{1,100}$/.test(s);
const player=s=>/^p[1-6]$/.test(s);
const room=s=>['bridge','archive','lantern','workshop','galley','engine'].includes(s);
const point=p=>object(p)&&Object.keys(p).every(k=>k==='x'||k==='y')&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1600&&p.y>=0&&p.y<=1200;
const bounded=(a,n)=>Array.isArray(a)&&a.length<=n;
const reject=()=>{throw new Error('Invalid replay metadata');};
const keys=(o,allowed)=>object(o)&&Object.keys(o).every(k=>allowed.includes(k));
export function validateReplayAnchor(a){
 if(!keys(a,['at','sequence','phase','players','bodies','sabotage','meeting','outcome'])||!time(a.at)||!Number.isSafeInteger(a.sequence)||a.sequence<0||!['roam','discussion','voting','ended','paused'].includes(a.phase)||!bounded(a.players,6)||a.players.length!==6||new Set(a.players.map(p=>p?.id)).size!==6)reject();
 // Optional for existing version-1 recordings; new terminal checkpoints retain it.
 if(Object.hasOwn(a,'outcome')){
  const o=a.outcome;
  if(a.phase==='ended'){
   if(!keys(o,['winner','reason','at'])||!['crew','saboteur'].includes(o.winner)||typeof o.reason!=='string'||!/^[A-Za-z0-9_:-]{1,100}$/.test(o.reason)||!time(o.at)||o.at>a.at)reject();
  }else if(o!==null)reject();
 }
 let tasks=0;
 for(const p of a.players){
  if(!keys(p,['id','role','alive','roomId','position','tasks','route'])||!player(p.id)||!['crew','saboteur'].includes(p.role)||typeof p.alive!=='boolean'||!room(p.roomId)||!point(p.position)||!bounded(p.tasks,100)||!bounded(p.route,REPLAY_LIMITS.route)||p.route.some(q=>!point(q)))reject();
  tasks+=p.tasks.length;
  for(const t of p.tasks)if(!keys(t,['id','roomId','label','completed'])||!id(t.id)||!room(t.roomId)||typeof t.label!=='string'||t.label.length>160||typeof t.completed!=='boolean')reject();
 }
 if(tasks>100||a.players.filter(p=>p.role==='saboteur').length!==1||!bounded(a.bodies,6))reject();
 for(const b of a.bodies)if(!keys(b,['id','playerId','roomId','position','at','reported'])||!id(b.id)||!player(b.playerId)||!room(b.roomId)||!point(b.position)||!time(b.at)||b.at>a.at||typeof b.reported!=='boolean')reject();
 if(a.sabotage!==null&&(!keys(a.sabotage,['active','roomId','deadlineAt','repairsCompleted','repairsRequired'])||!room(a.sabotage.roomId)||typeof a.sabotage.active!=='boolean'||!time(a.sabotage.deadlineAt)||!Number.isInteger(a.sabotage.repairsCompleted)||a.sabotage.repairsCompleted<0||a.sabotage.repairsCompleted>6||a.sabotage.repairsRequired!==2))reject();
 if(a.meeting!==null){const m=a.meeting;if(!keys(m,['id','votes','eligibleVoters','tallied'])||!id(m.id)||!bounded(m.votes,6)||!bounded(m.eligibleVoters,6)||m.eligibleVoters.some(p=>!player(p))||m.votes.some(v=>!keys(v,['playerId','targetId'])||!player(v.playerId)||!(v.targetId==='skip'||player(v.targetId)))||typeof m.tallied!=='boolean')reject();}
 if(JSON.stringify(a).length>65536)reject();
 return a;
}
export function validateReplayHistory(h){
 if(!keys(h,['version','map','checkpoints'])||h.version!==REPLAY_VERSION||h.map!==REPLAY_MAP||!bounded(h.checkpoints,REPLAY_LIMITS.checkpoints)||!h.checkpoints.length)reject();
 let seq=-1,at=-1;for(const a of h.checkpoints){validateReplayAnchor(a);if(a.sequence<=seq||a.at<at)reject();seq=a.sequence;at=a.at;}
 return h;
}
export function validateReplayMetadata(m,matchId){
 if(!keys(m,['version','map','matchId','coverage','anchor'])||m.version!==REPLAY_VERSION||m.map!==REPLAY_MAP||m.matchId!==matchId||!id(m.matchId)||!keys(m.coverage,['startedAt','from','through','partial']))reject();
 const c=m.coverage;if(![c.startedAt,c.from,c.through].every(time)||c.from<c.startedAt||c.through<c.from||typeof c.partial!=='boolean')reject();
 if(m.anchor!==null){validateReplayAnchor(m.anchor);if(m.anchor.at!==c.from)reject();}
 return m;
}
