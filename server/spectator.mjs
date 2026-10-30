import {isGhost} from '../shared/features.mjs';
import {getWorld} from '../shared/world.mjs';
import {taskProgress} from './engine/tasks.mjs';

const point=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y)?{x:value.x,y:value.y}:null;
const actions=Object.freeze({navigate:'Set a walking destination',move:'Set a room route',taskStep:'Completed a station step',task:'Completed a task',eliminate:'Eliminated a keeper',report:'Reported a body',say:'Made a public claim',vote:'Cast a ballot',sabotage:'Started sabotage',repair:'Contributed to repair',meeting:'Called council',wait:'Waited',protect:'Activated a ward',decoy:'Created a signal echo'});
const cooldownKeys=['moveAt','taskAt','killAt','sabotageAt','meetingAt'];
const goals=Object.freeze({task:'Work on an assigned task',task_route:'Visit assigned tasks in order',repair:'Contribute to critical repair',follow:'Follow a keeper',avoid:'Keep distance from a keeper',isolate:'Find an isolated target',sabotage:'Look for a sabotage opportunity',report:'Approach a recorded body to report it',fake_work:'Appear to work at a station',alibi:'Position near a station for an alibi',investigate:'Investigate a previous sighting',position:'Move to a station'});

/** Summarize a structural selected goal, never free-form model text. Even a
 * time-valid saved intention may await replanning, so it is explicitly historical
 * controller state rather than a claim about present thoughts or knowledge.
 */
function selectedPlan(state,player,context,now){
 if(context?.activeMatchId!==state.id||state.phase!=='roam'||!player.alive)return null;
 const match=context.matches?.[`match:${state.id}`];
 if(match?.mode!=='live')return null;
 const memory=match.memories?.[`actor:${player.id}`],plan=memory?.intention;
 if(!plan||plan.type!=='intend'||!Object.hasOwn(goals,plan.goal)||!Number.isFinite(plan.startedAt)||!Number.isFinite(plan.expiresAt)||
  plan.startedAt<state.startedAt||plan.startedAt>now||plan.expiresAt<=now||plan.expiresAt>plan.startedAt+30000||memory.planProgress?.failures>=3)return null;
 const result={goal:plan.goal,label:goals[plan.goal],source:'recorded-controller-state',recordedAt:plan.startedAt,expiresAt:plan.expiresAt,status:'last-selected',notice:'Last selected plan; may no longer be current. This is not private thoughts.'};
 if(['task','repair','fake_work','alibi','position','investigate'].includes(plan.goal)){
  if(!getWorld(state.mapId).WORLD_ROOMS.some(room=>room.id===plan.roomId))return null;result.roomId=plan.roomId;
 }
 if(plan.goal==='task'){
  if(player.role!=='crew'||!player.tasks.some(task=>task.id===plan.taskId&&task.roomId===plan.roomId&&!task.completed))return null;
  result.taskId=plan.taskId;
 }
 if(plan.goal==='task_route'){
  if(player.role!=='crew'||!Array.isArray(plan.taskIds)||plan.taskIds.length<1||plan.taskIds.length>3||
   !plan.taskIds.every(id=>player.tasks.some(task=>task.id===id))||!plan.taskIds.some(id=>player.tasks.some(task=>task.id===id&&!task.completed)))return null;
  result.taskIds=plan.taskIds.slice();
 }
 if(['follow','avoid','isolate'].includes(plan.goal)){
  if(plan.targetId===player.id||!state.players.some(target=>target.id===plan.targetId&&target.alive)||plan.goal==='isolate'&&player.role!=='saboteur')return null;
  result.targetId=plan.targetId;
 }
 if(plan.goal==='sabotage'&&(player.role!=='saboteur'||state.sabotage?.active))return null;
 if(plan.goal==='repair'&&(player.role!=='crew'||!state.sabotage?.active||state.sabotage.deadlineAt!==plan.deadlineAt||memory.worldRepairDeadline===plan.deadlineAt))return null;
 if(plan.goal==='report'){
  if(!state.bodies.some(body=>body.id===plan.bodyId&&!body.reported))return null;result.bodyId=plan.bodyId;
 }
 if(plan.goal==='investigate'&&state.players.some(target=>target.id===plan.observedPlayerId))result.observedPlayerId=plan.observedPlayerId;
 return result;
}

/** An explicit observer product, separate from the engine's player/AI views.
 * This projects authoritative gameplay fields plus an optional structural selected
 * plan. Callers must first authenticate a seatless identity and obtain its
 * explicit inspection consent for the current watch. It never copies memories,
 * prompts, reasoning, errors or fallen chat; mixed-human watches are ineligible.
 */
export function spectatorInspection(state,{mode,seatId,now=Date.now(),context}={}){
 if(mode!=='spectator'||seatId!==null||!state||state.mode!=='spectator'||state.worldVersion!==1||!Array.isArray(state.players)||state.players.some(player=>player.human))return null;
 const recent=new Map(),claims=new Map();
 // Bounded single pass, rather than scanning the complete replay per agent/view.
 for(const event of (state.replay??[]).slice(-256).reverse()){
  const action=event?.action;
  if(event?.type!=='action'||!Object.hasOwn(actions,action?.type)||!Number.isFinite(event.at))continue;
  const rows=recent.get(event.playerId)??[];
  if(rows.length<6){rows.push({at:event.at,type:action.type,label:actions[action.type]});recent.set(event.playerId,rows);}
  if(action.type==='say'&&typeof action.text==='string'){
   const messages=claims.get(event.playerId)??[];
   if(messages.length<3){messages.push({at:event.at,text:action.text.slice(0,280)});claims.set(event.playerId,messages);}
  }
 }
 return {mode:'all-ai-observer',matchId:state.id,updatedAt:state.updatedAt,agents:state.players.slice(0,24).map(player=>{
  const ghost=isGhost(state,player),motion=player.motion;
  const moving=state.phase==='roam'&&(player.alive||ghost)&&!!(motion?.path?.length||(motion?.manual&&now<motion.leaseUntil));
  const destination=moving?point(motion?.destination):null;
  let label=state.phase==='ended'?'Match completed':state.phase==='paused'?'Match paused':!player.alive&&!ghost?'Eliminated':state.phase==='discussion'?'In council discussion':state.phase==='voting'?'In council voting':moving?(destination?'Walking to a recorded destination':'Moving with recorded steering'):'Stationary; no active movement';
  if(ghost)label=`Fallen keeper · ${label}`;
  const cooldowns={};for(const key of cooldownKeys)if(Number.isFinite(player.cooldowns?.[key]))cooldowns[key]=player.cooldowns[key];
  const plan=selectedPlan(state,player,context,now);
  return {id:player.id,role:player.role,alive:player.alive,ghost,roomId:player.roomId,position:point(player.position),moving,destination,
   meetingsRemaining:player.meetingsRemaining,cooldowns,
   ...(plan?{plan}:{}),
   ...(player.ability&&['ward','echo'].includes(player.ability.type)?{ability:{type:player.ability.type,readyAt:player.ability.readyAt}}:{}),
   tasks:(player.tasks??[]).slice(0,32).map(task=>{const progress=taskProgress(task);return {id:task.id,label:task.label,roomId:task.roomId,completed:task.completed,progress:{kind:progress.kind,index:progress.index,total:progress.total,readyAt:progress.readyAt}};}),
   activity:{label,source:'recorded-state'},recentActions:recent.get(player.id)??[],claims:claims.get(player.id)??[]};
 })};
}
