import {REPLAY_VERSION,REPLAY_MAP,REPLAY_LIMITS,validateReplayHistory,validateReplayMetadata,replaySequenceOf} from '../../shared/replay.mjs';
const copy=structuredClone;
/** Snapshot only reconstructible gameplay, never requests, AI context or credentials. */
function snapshot(state){
 return {...(state.lobbySettings?{settings:{speed:state.lobbySettings.speed,vision:state.lobbySettings.vision}}:{}),at:state.phase==='ended'?state.outcome.at:state.updatedAt,sequence:state.replaySequence,phase:state.phase,
  outcome:state.outcome?{winner:state.outcome.winner,reason:state.outcome.reason,at:state.outcome.at}:null,
  features:state.features?{version:1,deathPolicy:state.features.deathPolicy,abilities:state.features.abilities}:null,
  effects:(state.effects||[]).map(e=>({id:e.id,kind:e.kind,playerId:e.playerId,createdAt:e.createdAt,expiresAt:e.expiresAt,...(e.kind==='ward'?{targetId:e.targetId}:{position:copy(e.position)})})),
  players:state.players.map(p=>({id:p.id,role:p.role,alive:p.alive,roomId:p.roomId,position:copy(p.position),...(p.ability?{ability:{type:p.ability.type,readyAt:p.ability.readyAt}}:{}),tasks:p.tasks.map(t=>({id:t.id,label:t.label,roomId:t.roomId,completed:t.completed,...(t.kind!==undefined?{kind:t.kind}:{}),...(t.edition?{edition:t.edition}:{}),...(t.progress?{progress:copy(t.progress)}:{})})),route:p.motion.path.length<=REPLAY_LIMITS.route?copy(p.motion.path):[]})),
  bodies:state.bodies.map(b=>({id:b.id,playerId:b.playerId,roomId:b.roomId,position:copy(b.position),at:b.at,reported:b.reported})),
  sabotage:state.sabotage?{active:state.sabotage.active,roomId:state.sabotage.roomId,deadlineAt:state.sabotage.deadlineAt,repairsCompleted:state.sabotage.repairsCompleted,repairsRequired:state.sabotage.repairsRequired}:null,
  meeting:state.meeting?{id:state.meeting.id,votes:copy(state.meeting.votes),eligibleVoters:copy(state.meeting.eligibleVoters),tallied:state.meeting.tallied}:null};
}
export function checkpointReplay(state){
 if(state.schemaVersion!==2||state.worldVersion!==1)return;
 const h=state.replayHistory??={version:REPLAY_VERSION,map:state.mapId??REPLAY_MAP,checkpoints:[]};
 const last=h.checkpoints.at(-1),first=replaySequenceOf(state.replay.find(e=>replaySequenceOf(e)!==null))||0;
 if(last&&state.replaySequence-last.sequence<REPLAY_LIMITS.interval&&h.checkpoints.some(a=>a.sequence>=first-1))return;
 // Only capture at completed engine transaction boundaries, after all actors settle.
 const a=snapshot(state);if(last?.sequence===a.sequence)return;
 h.checkpoints.push(a);if(h.checkpoints.length>REPLAY_LIMITS.checkpoints)h.checkpoints.shift();
}
export function replayMetadata(state){
 if(state.phase!=='ended')return null;
 let anchor=null;
 const first=replaySequenceOf(state.replay.find(e=>replaySequenceOf(e)!==null))||0;
 if(state.replayHistory){validateReplayHistory(state.replayHistory);anchor=state.replayHistory.checkpoints.find(a=>a.sequence>=first-1)??null;}
 return copy(validateReplayMetadata({version:REPLAY_VERSION,map:state.mapId??REPLAY_MAP,matchId:state.id,anchor,
  coverage:{startedAt:state.startedAt,from:anchor?.at??Math.min(...state.replay.map(e=>e.at),state.outcome?.at??state.updatedAt),through:state.outcome?.at??state.updatedAt,partial:!anchor||anchor.at!==state.startedAt||first>1}},state.id));
}
