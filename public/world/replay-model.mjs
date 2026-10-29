import {CHARACTERS} from '../../shared/contracts.mjs';
import {WORLD,isWalkable,moveWorldPoint,distance,canSeeWorldPoint} from '../../shared/world.mjs';
import {REPLAY_LIMITS,validateReplayMetadata} from '../../shared/replay.mjs';
import {replayEvents} from '../presentation.mjs';
const copy=structuredClone;
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&isWalkable(p);
const seq=e=>/^r\d+$/.test(e.id)?Number(e.id.slice(1)):null;
/** HTML range controls serialize doubles with fewer digits than JSON. Restore a
 * nearest recorded boundary only within that floating-point serialization error;
 * event-index seeking always uses the original number directly. */
export function restoreReplayTime(value,events){
 let nearest=value,gap=Infinity;
 for(const event of events){const d=Math.abs(event.at-value);if(d<gap){gap=d;nearest=event.at;}}
 return gap<=Number.EPSILON*Math.max(1,Math.abs(value))*32?nearest:value;
}
function route(start,path,speed,at){
 if(!point(start)||!Array.isArray(path)||path.length>REPLAY_LIMITS.route||!Number.isFinite(speed)||speed<=0||speed>WORLD.speed)return null;
 let prior=start;
 for(const p of path){if(!point(p))return null;const d=distance(prior,p);if(d&&distance(moveWorldPoint(prior,(p.x-prior.x)/d,(p.y-prior.y)/d,d),p)>.01)return null;prior=p;}
 return {start:copy(start),path:copy(path),speed,at};
}
function project(r,at){
 let p=r.start,budget=Math.max(0,at-r.at)*r.speed/1000;
 for(const next of r.path){const d=distance(p,next);if(budget<d)return {x:p.x+(next.x-p.x)*budget/d,y:p.y+(next.y-p.y)*budget/d};budget-=d;p=next;}
 return copy(p);
}
function base(roster){return {phase:'unknown',players:roster.map(p=>({id:p.id,name:p.name,color:p.color,position:null,alive:true,role:null,roomId:null,tasks:[],route:null,positionAt:null})),bodies:[],sabotage:null,meeting:null,activity:[],observations:[],claims:[],outcome:null};}
export function createReplayModel(response,{matchId,roomId,players=CHARACTERS}={}){
 if(response?.roomId!==undefined&&roomId!==undefined&&response.roomId!==roomId)throw new Error('Replay belongs to another room.');
 if(response?.matchId!==undefined&&matchId!==undefined&&response.matchId!==matchId)throw new Error('Replay belongs to another match.');
 const events=copy(replayEvents(response));
 if(events.length>REPLAY_LIMITS.events||events.some(e=>!e||!Number.isFinite(e.at)||e.at<0||typeof e.type!=='string'))throw new Error('Invalid replay events.');
 // Stable numeric sort: preserve the server's causal order for identical times.
 events.sort((a,b)=>a.at-b.at);
 const metadata=response?.metadata?copy(validateReplayMetadata(response.metadata,matchId??response.matchId)):null;
 const anchor=metadata?.anchor;
 const started=events.find(e=>e.type==='started'),hasStart=started?.worldVersion===1&&Array.isArray(started.positions);
 const roster=CHARACTERS.map(c=>{const p=players.find(p=>p.id===c.id);return {id:c.id,name:p?.name||c.name,color:p?.color||c.color};});
 const initial=base(roster);
 if(anchor){
  if(anchor.bodies.some(b=>!point(b.position)))throw new Error('Invalid replay metadata geometry');
  initial.phase=anchor.phase;initial.bodies=copy(anchor.bodies);initial.sabotage=copy(anchor.sabotage);initial.meeting=copy(anchor.meeting);
  for(const p of anchor.players){if(!point(p.position)||p.route.some(q=>!point(q)))throw new Error('Invalid replay metadata geometry');const target=initial.players.find(q=>q.id===p.id);Object.assign(target,copy(p),{route:route(p.position,p.route,WORLD.speed,anchor.at),positionAt:anchor.at});}
 }
 const from=metadata?.coverage.from??events[0]?.at??0,through=metadata?.coverage.through??events.at(-1)?.at??from;
 if(events.some(e=>e.at>through))throw new Error('Replay events exceed recording coverage.');
 const partial=metadata?.coverage.partial??(!hasStart||seq(events[0])!==1);
 const coverage={from,through,partial,description:partial?'Partial history: earlier events or positions are unavailable.':'Full recorded history from the start of this match.'};
 const roles=new Map();for(const p of anchor?.players||started?.roles||[])if(['crew','saboteur'].includes(p.role))roles.set(p.id,p.role);
 for(const e of events)if(e.type==='role_reveal')for(const p of e.players||[])if(['crew','saboteur'].includes(p.role))roles.set(p.id,p.role);
 function at(time,limit=Infinity){
  time=Math.min(through,Math.max(from,Number.isFinite(time)?time:from));const s=copy(initial);
  const get=id=>s.players.find(p=>p.id===id);
  function locate(p,position,t){if(p&&point(position)){p.position=copy(position);p.positionAt=t;}}
  for(let i=0;i<events.length;i++){
   const e=events[i];if(e.at>time||i>limit)break;
   if(anchor&&(seq(e)!==null?seq(e)<=anchor.sequence:e.at<=anchor.at))continue;
   const p=get(e.playerId),a=e.action||{};
   if(e.type==='started'){
    s.phase='roam';for(const pos of e.positions||[])locate(get(pos.id),pos.position,e.at);
    for(const role of e.roles||[]){const q=get(role.id);if(q&&['crew','saboteur'].includes(role.role))q.role=role.role;}
    for(const row of e.tasks||[]){const q=get(row.id);if(q&&Array.isArray(row.tasks))q.tasks=copy(row.tasks.slice(0,100));}
   }
   if(e.type==='motion'||e.type==='direction'){
    locate(p,e.position,e.at);
    if(p&&(e.type==='direction'||e.reason!=='sample'))p.route=null;
    if(p&&e.reason==='death')p.alive=false;
   }
   if(e.type==='witness'){
    const victim=get(e.targetId);if(victim){victim.alive=false;victim.route=null;locate(victim,e.position,e.at);}
    if(!s.bodies.some(b=>b.playerId===e.targetId)&&point(e.position))s.bodies.push({id:'body-'+e.targetId,playerId:e.targetId,position:copy(e.position),at:e.at,reported:false});
    s.observations.push(copy(e));
   }
   if(e.type==='action'){
    locate(p,e.position,e.at);
    if(p&&['navigate','move'].includes(a.type)){p.route=route(e.position,e.route,e.speed,e.at);if(a.roomId)p.roomId=a.roomId;}
    if(p&&a.type==='task'){const t=p.tasks.find(t=>t.id===a.taskId);if(t)t.completed=true;}
    if(a.type==='eliminate'){const victim=get(a.targetId);if(victim){victim.alive=false;victim.route=null;}}
    if(a.type==='sabotage')s.sabotage={active:true,roomId:'engine',repairsCompleted:0,repairsRequired:2};
    if(a.type==='repair'&&s.sabotage){s.sabotage.repairsCompleted++;if(s.sabotage.repairsCompleted>=2)s.sabotage.active=false;}
    if(a.type==='say')s.claims.push(copy(e));
    if(a.type==='vote'&&s.meeting)s.meeting.votes.push({playerId:e.playerId,targetId:a.targetId});
   }
   if(e.type==='tasks_reassigned')for(const assignment of e.assignments||[]){const task=p?.tasks.find(t=>t.id===assignment.taskId),owner=get(assignment.playerId);if(task&&owner){p.tasks=p.tasks.filter(t=>t!==task);owner.tasks.push(task);}}
   if(e.type==='meeting'){s.phase='discussion';s.meeting={id:e.meetingId??e.id,votes:[],tallied:false,reason:e.reason};for(const q of s.players)q.route=null;if(e.reason==='report')for(const b of s.bodies)b.reported=true;}
   if(e.type==='voting')s.phase='voting';
   if(e.type==='vote_result'){s.phase='roam';s.meeting={...s.meeting,votes:copy(e.votes||[]),tallied:true,ejectedId:e.ejectedId};}
   if(e.type==='ejected'&&p){p.alive=false;p.route=null;}
   if(e.type==='ended'){s.phase='ended';s.outcome={winner:e.winner,reason:e.reason};for(const q of s.players)q.route=null;}
   if(e.type==='paused')s.phase='paused';
   if(!['motion','direction','started'].includes(e.type)&&a.type!=='wait')s.activity.push(copy(e));
  }
  for(const p of s.players)if(p.alive&&p.route)p.position=project(p.route,time);
  s.activity=s.activity.slice(-12);s.replayTaskRooms=s.activity.filter(e=>e.action?.type==='task'&&time-e.at<=3000).map(e=>s.players.flatMap(p=>p.tasks).find(t=>t.id===e.action.taskId)?.roomId).filter(Boolean);s.time=time;s.events=s.bodies.filter(b=>!b.reported).map(b=>({...b,type:'body',bodyId:b.id}));
  s.self=null;s.worldVersion=1;s.matchId=matchId??response?.matchId??'legacy';s.roles=Object.fromEntries(roles);return s;
 }
 function perspective(s,id){
  const self=s.players.find(p=>p.id===id),visible=self&&point(self.position)?s.players.filter(p=>point(p.position)&&(p.id===id||distance(self.position,p.position)<=WORLD.visibilityRadius&&canSeeWorldPoint(self.position,p.position))):[];
  return {label:'Reconstructed visibility at recorded positions; not proof of attention or model input.',visible:visible.map(p=>p.id),bodies:s.bodies.filter(b=>self&&point(self.position)&&point(b.position)&&distance(self.position,b.position)<=WORLD.visibilityRadius&&canSeeWorldPoint(self.position,b.position)).map(b=>b.id),observations:s.observations.filter(e=>Array.isArray(e.visibleTo)&&e.visibleTo.includes(id)),ownRole:self?.role??null};
 }
 function claims(s,id){return s.claims.filter(e=>!id||e.playerId===id).slice(-12).map(claim=>({claim,evidence:events.filter(e=>e.at<=s.time&&Math.abs(e.at-claim.at)<=10000&&(e.type==='witness'||e.type==='action'&&e.action?.type!=='say'&&e.action?.type!=='wait')).slice(-6),label:'Context comparison only. A public claim is not verified by nearby events; absence of evidence is not contradiction.'}));}
 return {events,coverage,at,perspective,claims,metadata};
}

/** Clock owns no network or input callbacks. Seek resets wall-clock accumulation. */
export function createReplayClock({from,through,onFrame,now=()=>performance.now(),request=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id)}){
 let time=from,speed=1,playing=false,disposed=false,handle=null,last=null;
 function pause(){playing=false;if(handle!==null)cancel(handle);handle=null;last=null;}
 function frame(stamp){handle=null;if(!playing||disposed)return;if(last!==null)time=Math.min(through,time+Math.max(0,stamp-last)*speed);last=stamp;onFrame(time);if(time>=through)pause();else handle=request(frame);}
 return {get time(){return time;},get playing(){return playing;},get speed(){return speed;},play(){if(disposed||playing||time>=through)return;playing=true;last=now();handle=request(frame);},pause,seek(value){if(disposed)return;time=Math.min(through,Math.max(from,Number.isFinite(value)?value:from));last=now();onFrame(time);},setSpeed(value){if(![.25,.5,1,2,4].includes(value))throw new Error('Unsupported playback speed');speed=value;last=now();},dispose(){pause();disposed=true;}};
}
