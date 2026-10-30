import {getMap} from '../../shared/maps/index.mjs';
import {validProgress} from './tasks.mjs';
import {validateStationChallenge,stationComplete} from '../../shared/station-challenges.mjs';
import {REPLAY_VERSION,REPLAY_MAP,REPLAY_LIMITS,validateReplayHistory,validateReplayMetadata,replaySequenceOf} from '../../shared/replay.mjs';
const copy=structuredClone;
/** Snapshot only reconstructible gameplay, never requests, AI context or credentials. */
function snapshot(state){
 return {at:state.phase==='ended'?state.outcome.at:state.updatedAt,sequence:state.replaySequence,phase:state.phase,
  outcome:state.outcome?{winner:state.outcome.winner,reason:state.outcome.reason,at:state.outcome.at}:null,
  features:state.features?{version:1,deathPolicy:state.features.deathPolicy,abilities:state.features.abilities}:null,
  effects:(state.effects||[]).map(e=>({id:e.id,kind:e.kind,playerId:e.playerId,createdAt:e.createdAt,expiresAt:e.expiresAt,...(e.kind==='ward'?{targetId:e.targetId}:{position:copy(e.position)})})),
  players:state.players.map(p=>({id:p.id,role:p.role,alive:p.alive,roomId:p.roomId,position:copy(p.position),...(p.ability?{ability:{type:p.ability.type,readyAt:p.ability.readyAt}}:{}),tasks:p.tasks.map(t=>({id:t.id,label:t.label,roomId:t.roomId,completed:t.completed,...(t.progress?{progress:copy(t.progress)}:{}),...(t.kind?{kind:t.kind}:{}),...(t.challenge?{challenge:copy(t.challenge)}:{}),...(t.taskKind?{taskKind:t.taskKind}:{})})),route:p.motion.path.length<=REPLAY_LIMITS.route?copy(p.motion.path):[]})),
  bodies:state.bodies.map(b=>({id:b.id,playerId:b.playerId,roomId:b.roomId,position:copy(b.position),at:b.at,reported:b.reported})),
  sabotage:state.sabotage?{active:state.sabotage.active,roomId:state.sabotage.roomId,deadlineAt:state.sabotage.deadlineAt,repairsCompleted:state.sabotage.repairsCompleted,repairsRequired:state.sabotage.repairsRequired}:null,
  meeting:state.meeting?{id:state.meeting.id,votes:copy(state.meeting.votes),eligibleVoters:copy(state.meeting.eligibleVoters),tallied:state.meeting.tallied}:null};
}
export function checkpointReplay(state){
 if(![2,3,4,5].includes(state.schemaVersion)||state.worldVersion!==1)return;
 const selected=state.schemaVersion===2?null:getMap(state.map),map=selected?{id:selected.id,version:selected.version}:state.mapId??REPLAY_MAP;
 const h=state.replayHistory??={version:selected?2:REPLAY_VERSION,map,checkpoints:[]};
 const last=h.checkpoints.at(-1),first=replaySequenceOf(state.replay.find(e=>replaySequenceOf(e)!==null))||0;
 if(last&&state.replaySequence-last.sequence<REPLAY_LIMITS.interval&&h.checkpoints.some(a=>a.sequence>=first-1))return;
 // Only capture at completed engine transaction boundaries, after all actors settle.
 const a=snapshot(state);if(last?.sequence===a.sequence)return;
 h.checkpoints.push(a);if(h.checkpoints.length>REPLAY_LIMITS.checkpoints)h.checkpoints.shift();
}
export function replayMetadata(state){
 if(state.phase!=='ended')return null;if(![1,2,3,4,5].includes(state.schemaVersion))throw new Error('Unsupported replay schema');
 let anchor=null;
 const first=replaySequenceOf(state.replay.find(e=>replaySequenceOf(e)!==null))||0;
 if(state.replayHistory){validateReplayHistoryState(state.replayHistory,state);anchor=state.replayHistory.checkpoints.find(a=>a.sequence>=first-1)??null;}
 const selected=[3,4,5].includes(state.schemaVersion)?getMap(state.map):null;const metadata={version:selected?2:REPLAY_VERSION,map:selected?{id:selected.id,version:selected.version}:state.mapId??REPLAY_MAP,matchId:state.id,anchor,
  coverage:{startedAt:state.startedAt,from:anchor?.at??Math.min(...state.replay.map(e=>e.at),state.outcome?.at??state.updatedAt),through:state.outcome?.at??state.updatedAt,partial:!anchor||anchor.at!==state.startedAt||first>1}};return copy(selected?metadata:validateReplayMetadata(metadata,state.id));
}

/** Store integration hook: version1 stays exact; version2 is exact-map aware. */
export function validateReplayHistoryState(h,state){
 if(h?.version===1){if(state.schemaVersion!==2)throw new Error('Mixed mapped/legacy replay history');if(h.map!==(state.mapId??REPLAY_MAP))throw new Error('Replay map does not match world2 state');const result=validateReplayHistory(h);
  const ids=new Set(state.players.map(p=>p.id));for(const a of h.checkpoints)for(const p of a.players){if(!ids.has(p.id)||p.role!==state.players.find(q=>q.id===p.id)?.role)throw new Error('Replay roster mismatch');for(const t of p.tasks){if(t.progress&&!validProgress(t.progress,t,{startedAt:state.startedAt,updatedAt:a.at}))throw new Error('Invalid replay task progress');}}
  if(h.checkpoints.some(a=>a.at<state.startedAt||a.at>state.updatedAt||a.sequence>state.replaySequence))throw new Error('Replay checkpoint exceeds match history');return result;}
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),keys=(v,allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k)),time=v=>Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER,check=v=>{if(!v)throw new Error('Invalid mapped replay history');};
 check(keys(h,['version','map','checkpoints'])&&h.version===2&&[3,4,5].includes(state.schemaVersion));const map=getMap(h.map),expected=getMap(state.map);check(map===expected&&Object.keys(h.map).length===2);
 const ids=new Set(state.players.map(p=>p.id)),rooms=new Set(map.roomLayout.map(r=>r.id)),point=p=>keys(p,['x','y'])&&map.geometry.isWalkable(p);
 check(ids.size>=4&&ids.size<=12&&Array.isArray(h.checkpoints)&&h.checkpoints.length>0&&h.checkpoints.length<=REPLAY_LIMITS.checkpoints);let at=-1,sequence=-1;
 for(const a of h.checkpoints){
  check(keys(a,['at','sequence','phase','players','bodies','sabotage','meeting','outcome','features','effects'])&&time(a.at)&&a.at>=state.startedAt&&a.at>=at&&a.at<=state.updatedAt&&Number.isSafeInteger(a.sequence)&&a.sequence>sequence&&a.sequence<=state.replaySequence&&['roam','discussion','voting','ended','paused'].includes(a.phase));at=a.at;sequence=a.sequence;
  check(Array.isArray(a.players)&&a.players.length===ids.size&&new Set(a.players.map(p=>p.id)).size===ids.size);
  let count=0;for(const p of a.players){check(keys(p,['id','role','alive','roomId','position','tasks','route','ability'])&&ids.has(p.id)&&['crew','saboteur'].includes(p.role)&&p.role===state.players.find(q=>q.id===p.id)?.role&&typeof p.alive==='boolean'&&rooms.has(p.roomId)&&point(p.position)&&Array.isArray(p.route)&&p.route.length<=REPLAY_LIMITS.route&&p.route.every(point)&&Array.isArray(p.tasks)&&p.tasks.length<=240);count+=p.tasks.length;
   if(p.ability!==undefined)check(a.features?.abilities===true&&keys(p.ability,['type','readyAt'])&&['ward','echo'].includes(p.ability.type)&&p.role===(p.ability.type==='ward'?'crew':'saboteur')&&time(p.ability.readyAt)&&p.ability.readyAt>=state.startedAt&&p.ability.readyAt<=a.at+35000);
   for(const t of p.tasks){check(keys(t,['id','label','roomId','completed','progress','kind','challenge','taskKind'])&&typeof t.id==='string'&&/^t[a-f0-9]{20}$/.test(t.id)&&typeof t.label==='string'&&t.label.length<=200&&rooms.has(t.roomId)&&typeof t.completed==='boolean');if(t.challenge!==undefined){check(t.kind==='station'&&t.progress===undefined);validateStationChallenge(t.challenge);check(t.completed===stationComplete(t.challenge));}else if(t.progress!==undefined)check(validProgress(t.progress,t,{startedAt:state.startedAt,updatedAt:a.at}));}
  }check(count<=240);
  check(Array.isArray(a.bodies)&&a.bodies.length<=ids.size&&a.bodies.every(b=>keys(b,['id','playerId','roomId','position','at','reported'])&&b.id==='body-'+b.playerId&&ids.has(b.playerId)&&rooms.has(b.roomId)&&point(b.position)&&time(b.at)&&b.at<=a.at&&typeof b.reported==='boolean'));
  if(a.features!==null)check(keys(a.features,['version','deathPolicy','abilities'])&&a.features.version===1&&['transfer','ghost-tasks'].includes(a.features.deathPolicy)&&typeof a.features.abilities==='boolean');
  check(Array.isArray(a.effects)&&a.effects.length<=2&&a.effects.every(e=>keys(e,['id','kind','playerId','createdAt','expiresAt','targetId','position'])&&/^fx-[a-f0-9]{32}$/.test(e.id)&&ids.has(e.playerId)&&['ward','echo'].includes(e.kind)&&time(e.createdAt)&&e.createdAt<=a.at&&time(e.expiresAt)&&e.expiresAt>a.at&&(e.kind==='ward'?ids.has(e.targetId):point(e.position))));
  check(a.phase==='ended'?a.outcome!==null:a.outcome===null);
  if(a.outcome!==null)check(keys(a.outcome,['winner','reason','at'])&&a.phase==='ended'&&['crew','saboteur'].includes(a.outcome.winner)&&typeof a.outcome.reason==='string'&&time(a.outcome.at)&&a.outcome.at===a.at);
  if(a.sabotage!==null)check(keys(a.sabotage,['active','roomId','deadlineAt','repairsCompleted','repairsRequired'])&&rooms.has(a.sabotage.roomId)&&typeof a.sabotage.active==='boolean'&&time(a.sabotage.deadlineAt));
  if(a.meeting!==null)check(keys(a.meeting,['id','votes','eligibleVoters','tallied'])&&Array.isArray(a.meeting.eligibleVoters)&&a.meeting.eligibleVoters.length<=ids.size&&a.meeting.eligibleVoters.every(id=>ids.has(id))&&Array.isArray(a.meeting.votes)&&a.meeting.votes.length<=ids.size&&a.meeting.votes.every(v=>keys(v,['playerId','targetId'])&&ids.has(v.playerId)&&(v.targetId==='skip'||ids.has(v.targetId)))&&typeof a.meeting.tallied==='boolean');
  check(Buffer.byteLength(JSON.stringify(a))<=256*1024);
 }
 return h;
}
