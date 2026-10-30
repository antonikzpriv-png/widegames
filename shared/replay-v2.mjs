/** Pure map-aware postgame reader; no server imports or persistence writes. */
import {getMap} from './maps/index.mjs';
import {validateStationChallenge,stationComplete} from './station-challenges.mjs';
import {REPLAY_LIMITS,validReplayTaskProgress} from './replay-common.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),keys=(o,a)=>object(o)&&Object.keys(o).every(k=>a.includes(k));
const time=n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER,id=s=>typeof s==='string'&&/^[A-Za-z0-9:_-]{1,100}$/.test(s),player=s=>typeof s==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(s)&&!['constructor','prototype','__proto__'].includes(s),bounded=(a,n)=>Array.isArray(a)&&a.length<=n;
const check=v=>{if(!v)throw new Error('Invalid map-aware replay metadata');};
export function replayMap(ref){check(keys(ref,['id','version'])&&Object.keys(ref).length===2);return getMap(ref);}
export function validateMappedReplayAnchor(a,ref){
 const map=replayMap(ref),g=map.geometry,room=r=>map.roomLayout.some(x=>x.id===r),point=p=>keys(p,['x','y'])&&Object.keys(p).length===2&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&g.isWalkable(p);
 check(keys(a,['at','sequence','phase','players','bodies','sabotage','meeting','outcome','features','effects'])&&time(a.at)&&Number.isSafeInteger(a.sequence)&&a.sequence>=0&&['roam','discussion','voting','ended','paused'].includes(a.phase)&&bounded(a.players,12)&&a.players.length>=4&&new Set(a.players.map(p=>p?.id)).size===a.players.length);
 const ids=new Set(a.players.map(p=>p.id)),actor=x=>player(x)&&ids.has(x),hostile=a.players.filter(p=>p.role==='saboteur').length;check(hostile>=1&&hostile<=3&&hostile*2<a.players.length);
 if(a.features!=null)check(keys(a.features,['version','deathPolicy','abilities'])&&a.features.version===1&&['transfer','ghost-tasks'].includes(a.features.deathPolicy)&&typeof a.features.abilities==='boolean');
 if(Object.hasOwn(a,'outcome')){const o=a.outcome;if(a.phase==='ended')check(keys(o,['winner','reason','at'])&&['crew','saboteur'].includes(o.winner)&&typeof o.reason==='string'&&/^[A-Za-z0-9_:-]{1,100}$/.test(o.reason)&&time(o.at)&&o.at<=a.at);else check(o===null);}
 const taskIds=new Set();let total=0;
 for(const p of a.players){
  check(keys(p,['id','role','alive','roomId','position','tasks','route','ability'])&&actor(p.id)&&['crew','saboteur'].includes(p.role)&&typeof p.alive==='boolean'&&room(p.roomId)&&point(p.position)&&bounded(p.tasks,240)&&bounded(p.route,REPLAY_LIMITS.route)&&p.route.every(point));
  if(p.ability!==undefined)check(a.features?.abilities&&keys(p.ability,['type','readyAt'])&&['ward','echo'].includes(p.ability.type)&&time(p.ability.readyAt));
  for(const t of p.tasks){total++;check(keys(t,['id','roomId','label','completed','progress','kind','challenge','taskKind'])&&id(t.id)&&!taskIds.has(t.id)&&room(t.roomId)&&typeof t.label==='string'&&t.label.length<=200&&typeof t.completed==='boolean');taskIds.add(t.id);
   if(t.kind==='station'){check(t.progress===undefined);validateStationChallenge(t.challenge);check(t.completed===stationComplete(t.challenge));}
   else check(t.challenge===undefined&&(t.kind===undefined||t.kind==='relay')&&(t.progress===undefined||validReplayTaskProgress(t.progress)));
   if(t.taskKind!==undefined)check(typeof t.taskKind==='string'&&t.taskKind.length<=32);
  }
 }
 check(total<=240&&bounded(a.bodies,12)&&new Set(a.bodies.map(b=>b?.playerId)).size===a.bodies.length);
 for(const b of a.bodies)check(keys(b,['id','playerId','roomId','position','at','reported'])&&b.id==='body-'+b.playerId&&actor(b.playerId)&&room(b.roomId)&&point(b.position)&&time(b.at)&&b.at<=a.at&&typeof b.reported==='boolean');
 if(a.sabotage!==null)check(keys(a.sabotage,['active','roomId','deadlineAt','repairsCompleted','repairsRequired'])&&room(a.sabotage.roomId)&&typeof a.sabotage.active==='boolean'&&time(a.sabotage.deadlineAt)&&Number.isInteger(a.sabotage.repairsCompleted)&&a.sabotage.repairsCompleted>=0&&a.sabotage.repairsCompleted<=12&&a.sabotage.repairsRequired===2);
 if(a.meeting!==null){const m=a.meeting;check(keys(m,['id','votes','eligibleVoters','tallied'])&&id(m.id)&&bounded(m.votes,12)&&bounded(m.eligibleVoters,12)&&new Set(m.eligibleVoters).size===m.eligibleVoters.length&&new Set(m.votes.map(v=>v?.playerId)).size===m.votes.length&&m.eligibleVoters.every(actor)&&m.votes.every(v=>keys(v,['playerId','targetId'])&&actor(v.playerId)&&(v.targetId==='skip'||actor(v.targetId)))&&typeof m.tallied==='boolean');}
 if(a.effects!==undefined){check(bounded(a.effects,2)&&(!a.effects.length||a.features?.abilities&&a.phase==='roam'));for(const e of a.effects)check(keys(e,['id','kind','playerId','createdAt','expiresAt',e?.kind==='ward'?'targetId':'position'])&&id(e.id)&&['ward','echo'].includes(e.kind)&&actor(e.playerId)&&time(e.createdAt)&&time(e.expiresAt)&&e.createdAt<=a.at&&e.expiresAt>a.at&&(e.kind==='ward'?actor(e.targetId):point(e.position)));}
 check(JSON.stringify(a).length<=256*1024);return a;
}
export function validateMappedReplayHistory(h){
 check(keys(h,['version','map','checkpoints'])&&h.version===2&&bounded(h.checkpoints,REPLAY_LIMITS.checkpoints)&&h.checkpoints.length>0);replayMap(h.map);let seq=-1,at=-1;for(const a of h.checkpoints){validateMappedReplayAnchor(a,h.map);check(a.sequence>seq&&a.at>=at);seq=a.sequence;at=a.at;}return h;
}
export function validateMappedReplayMetadata(m,matchId){
 check(keys(m,['version','map','matchId','coverage','anchor'])&&m.version===2&&m.matchId===matchId&&id(m.matchId)&&keys(m.coverage,['startedAt','from','through','partial']));replayMap(m.map);const c=m.coverage;check([c.startedAt,c.from,c.through].every(time)&&c.from>=c.startedAt&&c.through>=c.from&&typeof c.partial==='boolean');if(m.anchor!==null){validateMappedReplayAnchor(m.anchor,m.map);check(m.anchor.at===c.from);}return m;
}
