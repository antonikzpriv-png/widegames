import {getWorld} from './world.mjs';
import {CAPTCHA_KINDS} from './captcha.mjs';
/** Versioned, bounded postgame recording contract. Never a live player view. */
export const REPLAY_VERSION=1;
export const REPLAY_MAP='lantern-wake-v1';
export const REPLAY_LIMITS=Object.freeze({events:12000,bytes:2*1024*1024,checkpoints:14,interval:1024,route:128});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const time=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const id=s=>typeof s==='string'&&/^[A-Za-z0-9:_-]{1,100}$/.test(s);
const player=s=>/^p[1-6]$/.test(s);
const originalKinds=['wires','tuning','sequence','pressure','repair'];
const allKinds=[...originalKinds,...CAPTCHA_KINDS];
const totals={wires:3,tuning:1,sequence:4,pressure:2,repair:4,glyphs:3,count:2,order:4,rotate:3,oddity:2,code:1};
const bounded=(a,n)=>Array.isArray(a)&&a.length<=n;
const reject=()=>{throw new Error('Invalid replay metadata');};
const keys=(o,allowed)=>object(o)&&Object.keys(o).every(k=>allowed.includes(k));
export function replayGeometry(map=REPLAY_MAP,mapRevision=1){
 try{return getWorld(map===REPLAY_MAP?'beacon':map,mapRevision);}catch{reject();}
}
function validators(map,mapRevision=1){const world=replayGeometry(map,mapRevision),room=s=>world.WORLD_ROOMS.some(r=>r.id===s),point=p=>object(p)&&Object.keys(p).every(k=>k==='x'||k==='y')&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=world.WORLD.width&&p.y>=0&&p.y<=world.WORLD.height;return {room,point};}
export function replaySequenceOf(event){
 if(Number.isSafeInteger(event?.sequence)&&event.sequence>0)return event.sequence;
 return typeof event?.id==='string'&&/^r\d+$/.test(event.id)?Number(event.id.slice(1)):null;
}
export function validReplayTaskProgress(p){
 return keys(p,['v','kind','target','sequence','pressure','total','index','readyAt'])&&((p.v===1&&originalKinds.includes(p.kind))||(p.v===2&&allKinds.includes(p.kind)))&&Number.isInteger(p.target)&&p.target>=30&&p.target<=80&&bounded(p.sequence,4)&&p.sequence.length===4&&p.sequence.every(n=>Number.isInteger(n)&&n>=1&&n<=4)&&[2,3,4,6,7,8].includes(p.pressure)&&p.total===totals[p.kind]&&Number.isInteger(p.index)&&p.index>=0&&p.index<=p.total&&time(p.readyAt);
}
export function validReplayEffect(e,map=REPLAY_MAP,mapRevision=1){
 const {point}=validators(map,mapRevision);
 return keys(e,['id','kind','playerId','createdAt','expiresAt',e?.kind==='ward'?'targetId':'position'])&&id(e.id)&&['ward','echo'].includes(e.kind)&&player(e.playerId)&&time(e.createdAt)&&time(e.expiresAt)&&e.expiresAt>e.createdAt&&(e.kind==='ward'?player(e.targetId):point(e.position));
}
export function validateReplayAnchor(a,map=REPLAY_MAP,mapRevision=1){
 const {room,point}=validators(map,mapRevision);
 if(!keys(a,['at','sequence','phase','players','bodies','sabotage','meeting','outcome','features','effects'])||!time(a.at)||!Number.isSafeInteger(a.sequence)||a.sequence<0||!['roam','discussion','voting','ended','paused'].includes(a.phase)||!bounded(a.players,6)||a.players.length!==6||new Set(a.players.map(p=>p?.id)).size!==6)reject();
 if(a.features!=null&&(!keys(a.features,['version','deathPolicy','abilities'])||a.features.version!==1||!['transfer','ghost-tasks'].includes(a.features.deathPolicy)||typeof a.features.abilities!=='boolean'))reject();
 if(a.effects!==undefined&&(!bounded(a.effects,2)||a.effects.some(e=>!validReplayEffect(e,map,mapRevision)||e.createdAt>a.at||e.expiresAt<=a.at)||a.effects.length&&(!a.features?.abilities||a.phase!=='roam')))reject();
 // Optional for existing version-1 recordings; new terminal checkpoints retain it.
 if(Object.hasOwn(a,'outcome')){
  const o=a.outcome;
  if(a.phase==='ended'){
   if(!keys(o,['winner','reason','at'])||!['crew','saboteur'].includes(o.winner)||typeof o.reason!=='string'||!/^[A-Za-z0-9_:-]{1,100}$/.test(o.reason)||!time(o.at)||o.at>a.at)reject();
  }else if(o!==null)reject();
 }
 let tasks=0;
 for(const p of a.players){
  if(!keys(p,['id','role','alive','roomId','position','tasks','route','ability'])||!player(p.id)||!['crew','saboteur'].includes(p.role)||typeof p.alive!=='boolean'||!room(p.roomId)||!point(p.position)||!bounded(p.tasks,100)||!bounded(p.route,REPLAY_LIMITS.route)||p.route.some(q=>!point(q)))reject();
  if(p.ability!==undefined&&(!a.features?.abilities||!keys(p.ability,['type','readyAt'])||!['ward','echo'].includes(p.ability.type)||!time(p.ability.readyAt)))reject();
  tasks+=p.tasks.length;
  for(const t of p.tasks)if(!keys(t,['id','roomId','label','completed','progress','kind'])||!id(t.id)||!room(t.roomId)||typeof t.label!=='string'||t.label.length>200||typeof t.completed!=='boolean'||t.kind!==undefined&&!allKinds.includes(t.kind)||t.progress!==undefined&&(!validReplayTaskProgress(t.progress)||(t.kind!==undefined?(t.progress.v!==2||t.progress.kind!==t.kind):t.progress.v!==1)))reject();
 }
 if(tasks>100||a.players.filter(p=>p.role==='saboteur').length!==1||!bounded(a.bodies,6))reject();
 for(const b of a.bodies)if(!keys(b,['id','playerId','roomId','position','at','reported'])||!id(b.id)||!player(b.playerId)||!room(b.roomId)||!point(b.position)||!time(b.at)||b.at>a.at||typeof b.reported!=='boolean')reject();
 if(a.sabotage!==null&&(!keys(a.sabotage,['active','roomId','deadlineAt','repairsCompleted','repairsRequired'])||!room(a.sabotage.roomId)||typeof a.sabotage.active!=='boolean'||!time(a.sabotage.deadlineAt)||!Number.isInteger(a.sabotage.repairsCompleted)||a.sabotage.repairsCompleted<0||a.sabotage.repairsCompleted>6||a.sabotage.repairsRequired!==2))reject();
 if(a.meeting!==null){const m=a.meeting;if(!keys(m,['id','votes','eligibleVoters','tallied'])||!id(m.id)||!bounded(m.votes,6)||!bounded(m.eligibleVoters,6)||m.eligibleVoters.some(p=>!player(p))||m.votes.some(v=>!keys(v,['playerId','targetId'])||!player(v.playerId)||!(v.targetId==='skip'||player(v.targetId)))||typeof m.tallied!=='boolean')reject();}
 if(JSON.stringify(a).length>65536)reject();
 return a;
}
export function validateReplayHistory(h){
 if(!keys(h,['version','map','mapRevision','checkpoints'])||h.version!==REPLAY_VERSION||typeof h.map!=='string'||!bounded(h.checkpoints,REPLAY_LIMITS.checkpoints)||!h.checkpoints.length)reject();
 if(Object.hasOwn(h,'mapRevision')&&![1,2].includes(h.mapRevision))reject();
 replayGeometry(h.map,h.mapRevision??1);
 let seq=-1,at=-1;for(const a of h.checkpoints){validateReplayAnchor(a,h.map,h.mapRevision??1);if(a.sequence<=seq||a.at<at)reject();seq=a.sequence;at=a.at;}
 return h;
}
export function validateReplayMetadata(m,matchId){
 if(!keys(m,['version','map','mapRevision','matchId','coverage','anchor'])||m.version!==REPLAY_VERSION||typeof m.map!=='string'||m.matchId!==matchId||!id(m.matchId)||!keys(m.coverage,['startedAt','from','through','partial']))reject();
 if(Object.hasOwn(m,'mapRevision')&&![1,2].includes(m.mapRevision))reject();
 replayGeometry(m.map,m.mapRevision??1);
 const c=m.coverage;if(![c.startedAt,c.from,c.through].every(time)||c.from<c.startedAt||c.through<c.from||typeof c.partial!=='boolean')reject();
 if(m.anchor!==null){validateReplayAnchor(m.anchor,m.map,m.mapRevision??1);if(m.anchor.at!==c.from)reject();}
 return m;
}
