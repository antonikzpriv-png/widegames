import {getWorld} from './world.mjs';
import {CAPTCHA_KINDS} from './captcha.mjs';
import {TASK_ORDER} from './task-catalog.mjs';
/** Versioned, bounded postgame recording contract. Never a live player view. */
export const REPLAY_VERSION=1;
export const REPLAY_MAP='lantern-wake-v1';
import {REPLAY_LIMITS,validReplayTaskProgress,validReplayTaskDefinition} from './replay-common.mjs';
export {REPLAY_LIMITS} from './replay-common.mjs';
import {validateMappedReplayHistory,validateMappedReplayMetadata} from './replay-v2.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const time=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER;
const id=s=>typeof s==='string'&&/^[A-Za-z0-9:_-]{1,100}$/.test(s);
const player=s=>typeof s==='string'&&/^p(?:[1-9]|1[0-5])$/.test(s);
const originalKinds=['wires','tuning','sequence','pressure','repair'];
const allKinds=[...new Set([...originalKinds,...CAPTCHA_KINDS,...TASK_ORDER])];
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
export {validReplayTaskProgress} from './replay-common.mjs';
export function validReplayEffect(e,map=REPLAY_MAP,mapRevision=1){
 const {point}=validators(map,mapRevision);
 return keys(e,['id','kind','playerId','createdAt','expiresAt',e?.kind==='ward'?'targetId':'position'])&&id(e.id)&&['ward','echo'].includes(e.kind)&&player(e.playerId)&&time(e.createdAt)&&time(e.expiresAt)&&e.expiresAt>e.createdAt&&(e.kind==='ward'?player(e.targetId):point(e.position));
}
export function validateReplayAnchor(a,map=REPLAY_MAP,mapRevision=1){
 const {room,point}=validators(map,mapRevision);
 if(!keys(a,['at','sequence','phase','players','bodies','sabotage','meeting','outcome','features','effects','settings'])||!time(a.at)||!Number.isSafeInteger(a.sequence)||a.sequence<0||!['roam','discussion','voting','ended','paused'].includes(a.phase)||!bounded(a.players,15)||a.players.length<4||new Set(a.players.map(p=>p?.id)).size!==a.players.length)reject();
 const actorIds=new Set(a.players.map(p=>p.id)),actor=id=>player(id)&&actorIds.has(id);
 if(a.players.some((p,i)=>!actorIds.has(`p${i+1}`)))reject();
 if(Object.hasOwn(a,'settings')&&(!keys(a.settings,['speed','vision'])||Object.keys(a.settings).length!==2||!Number.isSafeInteger(a.settings.speed)||a.settings.speed<90||a.settings.speed>300||!Number.isSafeInteger(a.settings.vision)||a.settings.vision<120||a.settings.vision>600))reject();
 if(a.features!=null&&(!keys(a.features,['version','deathPolicy','abilities'])||a.features.version!==1||!['transfer','ghost-tasks'].includes(a.features.deathPolicy)||typeof a.features.abilities!=='boolean'))reject();
 if(a.effects!==undefined&&(!bounded(a.effects,2)||a.effects.some(e=>!validReplayEffect(e,map,mapRevision)||!actor(e.playerId)||e.kind==='ward'&&!actor(e.targetId)||e.createdAt>a.at||e.expiresAt<=a.at)||a.effects.length&&(!a.features?.abilities||a.phase!=='roam')))reject();
 // Optional for existing version-1 recordings; new terminal checkpoints retain it.
 if(Object.hasOwn(a,'outcome')){
  const o=a.outcome;
  if(a.phase==='ended'){
   if(!keys(o,['winner','reason','at'])||!['crew','saboteur'].includes(o.winner)||typeof o.reason!=='string'||!/^[A-Za-z0-9_:-]{1,100}$/.test(o.reason)||!time(o.at)||o.at>a.at)reject();
  }else if(o!==null)reject();
 }
 let tasks=0;const taskIds=new Set();
 for(const p of a.players){
  if(!keys(p,['id','role','alive','roomId','position','tasks','route','ability'])||!player(p.id)||!['crew','saboteur'].includes(p.role)||typeof p.alive!=='boolean'||!room(p.roomId)||!point(p.position)||!bounded(p.tasks,280)||!bounded(p.route,REPLAY_LIMITS.route)||p.route.some(q=>!point(q)))reject();
  if(p.ability!==undefined&&(!a.features?.abilities||!keys(p.ability,['type','readyAt'])||!['ward','echo'].includes(p.ability.type)||!time(p.ability.readyAt)))reject();
  tasks+=p.tasks.length;
  for(const t of p.tasks){if(!validReplayTaskDefinition(t,{id,room,allowStation:false})||t.taskKind!==undefined&&!originalKinds.includes(t.taskKind)||taskIds.has(t.id))reject();taskIds.add(t.id);}
 }
 const hostile=a.players.filter(p=>p.role==='saboteur').length;if(tasks>280||hostile<1||hostile>3||hostile*2>=a.players.length||!bounded(a.bodies,15)||new Set(a.bodies.map(b=>b?.playerId)).size!==a.bodies.length)reject();
 for(const b of a.bodies)if(!keys(b,['id','playerId','roomId','position','at','reported'])||!id(b.id)||!actor(b.playerId)||!room(b.roomId)||!point(b.position)||!time(b.at)||b.at>a.at||typeof b.reported!=='boolean')reject();
 if(a.sabotage!==null&&(!keys(a.sabotage,['active','roomId','deadlineAt','repairsCompleted','repairsRequired'])||!room(a.sabotage.roomId)||typeof a.sabotage.active!=='boolean'||!time(a.sabotage.deadlineAt)||!Number.isInteger(a.sabotage.repairsCompleted)||a.sabotage.repairsCompleted<0||a.sabotage.repairsCompleted>15||a.sabotage.repairsRequired!==2))reject();
 if(a.meeting!==null){const m=a.meeting;if(!keys(m,['id','votes','eligibleVoters','tallied'])||!id(m.id)||!bounded(m.votes,15)||!bounded(m.eligibleVoters,15)||new Set(m.eligibleVoters).size!==m.eligibleVoters.length||new Set(m.votes.map(v=>v?.playerId)).size!==m.votes.length||m.eligibleVoters.some(p=>!actor(p))||m.votes.some(v=>!keys(v,['playerId','targetId'])||!actor(v.playerId)||!(v.targetId==='skip'||actor(v.targetId)))||typeof m.tallied!=='boolean')reject();}
 if(JSON.stringify(a).length>(Object.hasOwn(a,'settings')?262144:65536))reject();
 return a;
}
export function validateReplayHistory(h){
 if(h?.version===2)return validateMappedReplayHistory(h);
 if(!keys(h,['version','map','mapRevision','checkpoints'])||h.version!==REPLAY_VERSION||typeof h.map!=='string'||!bounded(h.checkpoints,REPLAY_LIMITS.checkpoints)||!h.checkpoints.length)reject();
 if(Object.hasOwn(h,'mapRevision')&&![1,2].includes(h.mapRevision))reject();
 replayGeometry(h.map,h.mapRevision??1);
 let seq=-1,at=-1;for(const a of h.checkpoints){validateReplayAnchor(a,h.map,h.mapRevision??1);if(a.sequence<=seq||a.at<at)reject();seq=a.sequence;at=a.at;}
 return h;
}
export function validateReplayMetadata(m,matchId){
 if(m?.version===2)return validateMappedReplayMetadata(m,matchId);
 if(!keys(m,['version','map','mapRevision','matchId','coverage','anchor'])||m.version!==REPLAY_VERSION||typeof m.map!=='string'||m.matchId!==matchId||!id(m.matchId)||!keys(m.coverage,['startedAt','from','through','partial']))reject();
 if(Object.hasOwn(m,'mapRevision')&&![1,2].includes(m.mapRevision))reject();
 replayGeometry(m.map,m.mapRevision??1);
 const c=m.coverage;if(![c.startedAt,c.from,c.through].every(time)||c.from<c.startedAt||c.through<c.from||typeof c.partial!=='boolean')reject();
 if(m.anchor!==null){validateReplayAnchor(m.anchor,m.map,m.mapRevision??1);if(m.anchor.at!==c.from)reject();}
 return m;
}
