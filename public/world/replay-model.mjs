import {validMappedReplayEffect} from '../../shared/replay-v2.mjs';
import {CHARACTERS} from '../../shared/contracts.mjs';
import {PERSONAS} from '../../shared/lobby.mjs';
import {getMap,mapIdentity} from '../../shared/maps/index.mjs';
import {validateStationChallenge,stationComplete} from '../../shared/station-challenges.mjs';
import {REPLAY_LIMITS,validateReplayMetadata,replaySequenceOf,validReplayTaskProgress,validReplayEffect} from '../../shared/replay.mjs';
import {replayEvents} from '../presentation.mjs';
const copy=structuredClone;

const seq=replaySequenceOf;
/** HTML range controls serialize doubles with fewer digits than JSON. Restore a
 * nearest recorded boundary only within that floating-point serialization error;
 * event-index seeking always uses the original number directly. */
export function restoreReplayTime(value,events){
 let nearest=value,gap=Infinity;
 for(const event of events){const d=Math.abs(event.at-value);if(d<gap){gap=d;nearest=event.at;}}
 return gap<=Number.EPSILON*Math.max(1,Math.abs(value))*32?nearest:value;
}
function base(roster){return {phase:'unknown',players:roster.map(p=>({id:p.id,name:p.name,color:p.color,...(p.badge?{badge:p.badge}:{}),position:null,alive:true,role:null,roomId:null,tasks:[],route:null,positionAt:null})),features:null,effects:[],bodies:[],sabotage:null,meeting:null,activity:[],observations:[],claims:[],outcome:null};}
export function createReplayModel(response,{matchId,roomId,players,map:mapReference,mapId,mapRevision}={}){
 if(mapRevision!==undefined&&![1,2].includes(mapRevision))throw new Error('Invalid expected map revision.');
 if(response?.roomId!==undefined&&roomId!==undefined&&response.roomId!==roomId)throw new Error('Replay belongs to another room.');
 if(response?.matchId!==undefined&&matchId!==undefined&&response.matchId!==matchId)throw new Error('Replay belongs to another match.');
 const requestedMatch=matchId??response?.matchId??response?.metadata?.matchId;
 const metadata=response?.metadata?copy(validateReplayMetadata(response.metadata,requestedMatch)):null;
 const legacy=(id,revision=1)=>({mapId:id==='lantern-wake-v1'?'beacon':id??'beacon',revision});
 const recordedMap=metadata?.version===2?metadata.map:metadata?.version===1?legacy(metadata.map,metadata.mapRevision??1):undefined;
 const started=replayEvents(response).find(e=>e.type==='started'),startedMap=started?.map??(started?.mapId!==undefined||started?.mapRevision!==undefined?legacy(started.mapId,started.mapRevision??1):undefined);
 const callerMap=mapId!==undefined||mapRevision!==undefined?legacy(mapId,mapRevision??1):undefined,responseMap=response?.mapId!==undefined||response?.mapRevision!==undefined?legacy(response.mapId,response.mapRevision??1):undefined;
 const map=getMap(recordedMap??mapReference??callerMap??response?.map??responseMap??startedMap),{WORLD,isWalkable,moveWorldPoint,distance,canSeeWorldPoint}=map.geometry;
 const canonicalId=map.legacyMapId??map.id,isLegacy=map.legacyRevision!==undefined||map.id==='beacon'&&map.version===1&&metadata?.version!==2,selectedRevision=isLegacy?(map.legacyRevision??1):undefined;
 for(const ref of [mapReference,response?.map,startedMap])if(ref!==undefined&&mapIdentity(ref)!==mapIdentity(map))throw new Error('Replay belongs to another map or revision.');
 for(const id of [mapId,response?.mapId])if(id!==undefined&&id!==canonicalId&&id!==map.id)throw new Error('Replay belongs to another map.');
 for(const revision of [mapRevision,response?.mapRevision])if(revision!==undefined&&(![1,2].includes(revision)||revision!==selectedRevision))throw new Error('Replay belongs to another map revision.');

 const settings=copy(metadata?.anchor?.settings??{speed:WORLD.speed,vision:WORLD.visibilityRadius});
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&isWalkable(p);
function route(start,path,speed,at){
 if(!point(start)||!Array.isArray(path)||path.length>REPLAY_LIMITS.route||!Number.isFinite(speed)||speed<=0||speed>settings.speed)return null;
 let prior=start;
 for(const p of path){if(!point(p))return null;const d=distance(prior,p);if(d&&distance(moveWorldPoint(prior,(p.x-prior.x)/d,(p.y-prior.y)/d,d),p)>.01)return null;prior=p;}
 return {start:copy(start),path:copy(path),speed,at};
}
function project(r,at){
 let p=r.start,budget=Math.max(0,at-r.at)*r.speed/1000;
 for(const next of r.path){const d=distance(p,next);if(budget<d)return {x:p.x+(next.x-p.x)*budget/d,y:p.y+(next.y-p.y)*budget/d};budget-=d;p=next;}
 return copy(p);
}
 const events=copy(replayEvents(response));
 if(events.length>REPLAY_LIMITS.events||events.some(e=>!e||!Number.isFinite(e.at)||e.at<0||typeof e.type!=='string'))throw new Error('Invalid replay events.');
 // Stable numeric sort: preserve the server's causal order for identical times.
 events.sort((a,b)=>a.at-b.at);
 const anchor=metadata?.anchor;
 const hasStart=started?.worldVersion===1&&Array.isArray(started.positions);
 // Recorded anchors/full start samples own actor identity. Supplied final
 // profiles may decorate that roster but never invent unrecorded positions.
 const validRows=(rows,min=4)=>Array.isArray(rows)&&rows.length>=min&&rows.length<=15&&new Set(rows.map(p=>p?.id)).size===rows.length&&rows.every(p=>typeof p?.id==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(p.id)&&!['constructor','prototype','__proto__'].includes(p.id));
 const profiles=players??response?.players;
 if(profiles!==undefined&&(!validRows(profiles,0)||profiles.some(p=>p.name!==undefined&&(typeof p.name!=='string'||!p.name.trim()||p.name.length>64||/[\x00-\x1f\x7f]/.test(p.name))||p.color!==undefined&&(typeof p.color!=='string'||!/^#[a-fA-F0-9]{6}$/.test(p.color))||p.badge!==undefined&&(typeof p.badge!=='string'||!/^(?:[1-9]|1[0-5])$/.test(p.badge)))))throw new Error('Invalid replay profiles.');
 const rows=anchor?.players??(validRows(started?.positions)?started.positions:validRows(started?.roles)?started.roles:profiles??started?.roles??CHARACTERS);
 if(!validRows(rows,anchor?4:0))throw new Error('Invalid replay roster.');
 if(anchor)for(const recorded of [started?.positions,started?.roles])if(validRows(recorded)&&(recorded.length!==rows.length||recorded.some(p=>!rows.some(q=>q.id===p.id))))throw new Error('Replay roster does not match recorded metadata.');
 const roster=rows.map(({id})=>{const profile=profiles?.find(p=>p.id===id)??PERSONAS.find(p=>p.id===id)??{id,name:id};return {id,name:profile.name||id,color:profile.color,...(profile.badge?{badge:profile.badge}:{})};});
 const initial=base(roster);if(anchor?.settings)initial.settings=copy(settings);
 if(anchor){
  if(anchor.bodies.some(b=>!point(b.position)))throw new Error('Invalid replay metadata geometry');
  initial.phase=anchor.phase;initial.bodies=copy(anchor.bodies);initial.sabotage=copy(anchor.sabotage);initial.meeting=copy(anchor.meeting);
  initial.outcome=copy(anchor.outcome??null);
  initial.features=copy(anchor.features??null);initial.effects=copy(anchor.effects??[]);
  if(anchor.phase==='ended'&&!initial.outcome){
   // Older version-1 terminal anchors omitted outcome. Use a retained recorded
   // outcome when available, never the unrecorded final browser view.
   const ended=events.find(e=>e.type==='ended'&&e.at<=anchor.at&&(seq(e)===null||seq(e)<=anchor.sequence));
   if(ended)initial.outcome={winner:ended.winner,reason:ended.reason,at:ended.at};
  }
  for(const p of anchor.players){if(!point(p.position)||p.route.some(q=>!point(q)))throw new Error('Invalid replay metadata geometry');const target=initial.players.find(q=>q.id===p.id);if(!target)throw new Error('Replay roster does not match recorded metadata.');Object.assign(target,copy(p),{route:route(p.position,p.route,settings.speed,anchor.at),positionAt:anchor.at});}
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
  function interrupt(p){for(const t of p?.tasks||[]){if(t.progress?.kind==='repair'&&t.progress.index===3){t.progress.index=2;t.progress.readyAt=0;}if(t.progress?.v===3&&t.progress.kind==='transfer'&&t.progress.index===1){t.progress.index=0;t.progress.readyAt=0;}}}
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
    if(p&&e.type==='direction'&&(e.dx||e.dy))interrupt(p);
    if(p&&(e.type==='direction'||e.reason!=='sample'))p.route=null;
    if(p&&e.reason==='death'){p.alive=false;interrupt(p);}
    if(p&&!p.alive&&e.reason!=='death'&&(e.type==='direction'||['sample','arrived'].includes(e.reason)))p.recordedFallenMotion=true;
   }
   if(e.type==='witness'){
    const victim=get(e.targetId);if(victim){victim.alive=false;victim.route=null;locate(victim,e.position,e.at);interrupt(victim);}
    if(!s.bodies.some(b=>b.playerId===e.targetId)&&point(e.position))s.bodies.push({id:'body-'+e.targetId,playerId:e.targetId,position:copy(e.position),at:e.at,reported:false});
    s.observations.push(copy(e));
   }
   if(e.type==='action'){
    locate(p,e.position,e.at);
    if(p&&['navigate','move'].includes(a.type)){interrupt(p);p.route=route(e.position,e.route,e.speed,e.at);if(a.roomId)p.roomId=a.roomId;if(!p.alive)p.recordedFallenMotion=true;}
    if(p&&['task','taskStep'].includes(a.type)&&validReplayTaskProgress(e.taskProgress)){const t=p.tasks.find(t=>t.id===a.taskId);if(t)t.progress=copy(e.taskProgress);}
    if(p&&a.type==='taskInteract'&&e.stationChallenge!==undefined){
     validateStationChallenge(e.stationChallenge);
     const task=p.tasks.find(t=>t.id===a.taskId);
     if(typeof e.completed!=='boolean'||e.completed!==stationComplete(e.stationChallenge)||task&&(task.kind!=='station'||JSON.stringify([task.challenge?.version,task.challenge?.kind,task.challenge?.puzzle])!==JSON.stringify([e.stationChallenge.version,e.stationChallenge.kind,e.stationChallenge.puzzle])))throw new Error('Invalid recorded station challenge evidence.');
     // A partial history may lack the original task assignment. Keep its dated
     // log evidence, without inventing a room, assignment or earlier progress.
     if(task){task.challenge=copy(e.stationChallenge);task.completed=e.completed;}
    }
    if(p&&a.type==='task'){const t=p.tasks.find(t=>t.id===a.taskId);if(t&&t.kind!=='station')t.completed=true;}
    if(a.type==='eliminate'){const victim=get(a.targetId);if(victim){victim.alive=false;victim.route=null;}}
    if(a.type==='sabotage')s.sabotage={active:true,roomId:map.fixtures?.repairs?.power?.[0]?.roomId||'engine',repairsCompleted:0,repairsRequired:2};
    if(a.type==='repair'&&s.sabotage){s.sabotage.repairsCompleted++;if(s.sabotage.repairsCompleted>=2)s.sabotage.active=false;}
    if(a.type==='say')s.claims.push(copy(e));
    if(a.type==='vote'&&s.meeting)s.meeting.votes.push({playerId:e.playerId,targetId:a.targetId});
   }
   if(e.type==='task_progress'&&typeof e.completed==='boolean'){const task=p?.tasks.find(t=>t.id===e.taskId);if(task)task.completed=e.completed;}
   if(e.type==='effect_started'){
    const effect={id:e.effectId??e.id,kind:e.kind,playerId:e.playerId,createdAt:e.createdAt,expiresAt:e.expiresAt,...(e.kind==='ward'?{targetId:e.targetId}:{position:copy(e.position)})};
    if(metadata?.version===2?validMappedReplayEffect(effect,metadata.map,roster.map(p=>p.id)):validReplayEffect(effect,metadata?.version===1?metadata.map:map.taskProtocol==='taskStep'?(canonicalId==='beacon'?'lantern-wake-v1':canonicalId):undefined,selectedRevision??1)){s.effects=s.effects.filter(f=>f.id!==effect.id);s.effects.push(effect);}
   }
   if(e.type==='effect_ended')s.effects=s.effects.filter(f=>f.id!==e.effectId);
   if(e.type==='task_routed'){const task=p?.tasks.find(t=>t.id===e.taskId);if(task&&map.roomLayout.some(r=>r.id===e.roomId)){task.roomId=e.roomId;if(typeof e.label==='string'&&e.label.length<=200)task.label=e.label;}}
   if(e.type==='tasks_reassigned'){interrupt(p);for(const assignment of e.assignments||[]){const task=p?.tasks.find(t=>t.id===assignment.taskId),owner=get(assignment.playerId);if(task&&owner){p.tasks=p.tasks.filter(t=>t!==task);owner.tasks.push(task);}}}
   if(e.type==='meeting'){s.phase='discussion';s.meeting={id:e.meetingId??e.id,votes:[],tallied:false,reason:e.reason};for(const q of s.players){q.route=null;interrupt(q);}if(e.reason==='report')for(const b of s.bodies)b.reported=true;}
   if(e.type==='voting')s.phase='voting';
   if(e.type==='vote_result'){s.phase='roam';s.meeting={...s.meeting,votes:copy(e.votes||[]),tallied:true,ejectedId:e.ejectedId};}
   if(e.type==='ejected'&&p){p.alive=false;p.route=null;}
   if(e.type==='ended'){s.phase='ended';s.outcome={winner:e.winner,reason:e.reason,at:e.at};for(const q of s.players)q.route=null;}
   if(e.type==='paused')s.phase='paused';
   if(!['motion','direction','started'].includes(e.type)&&a.type!=='wait')s.activity.push(copy(e));
  }
  for(const p of s.players){p.ghost=!p.alive&&(s.features?.deathPolicy==='ghost-tasks'||!!p.recordedFallenMotion);if((p.alive||p.ghost)&&p.route)p.position=project(p.route,time);}
  s.activity=s.activity.slice(-12);s.replayTaskRooms=s.activity.filter(e=>['task','taskStep','taskInteract'].includes(e.action?.type)&&time-e.at<=3000).map(e=>s.players.flatMap(p=>p.tasks).find(t=>t.id===e.action.taskId)?.roomId).filter(Boolean);s.time=time;s.events=s.bodies.filter(b=>!b.reported).map(b=>({...b,type:'body',bodyId:b.id}));
  s.self=null;s.map={id:map.id,version:map.version};if(map.taskProtocol==='taskStep'&&canonicalId!=='beacon')s.mapId=canonicalId;if(selectedRevision===2)s.mapRevision=2;s.worldVersion=1;s.matchId=requestedMatch??'legacy';s.roles=Object.fromEntries(roles);return s;
 }
 function perspective(s,id){
  const self=s.players.find(p=>p.id===id),visible=self&&point(self.position)?s.players.filter(p=>point(p.position)&&(p.id===id||(!p.ghost||!self.alive)&&distance(self.position,p.position)<=settings.vision&&canSeeWorldPoint(self.position,p.position,settings.vision))):[];
  return {label:'Reconstructed visibility at recorded positions; not proof of attention or model input.',visible:visible.map(p=>p.id),bodies:s.bodies.filter(b=>self&&point(self.position)&&point(b.position)&&distance(self.position,b.position)<=settings.vision&&canSeeWorldPoint(self.position,b.position,settings.vision)).map(b=>b.id),observations:s.observations.filter(e=>Array.isArray(e.visibleTo)&&e.visibleTo.includes(id)),ownRole:self?.role??null};
 }
 function claims(s,id){return s.claims.filter(e=>!id||e.playerId===id).slice(-12).map(claim=>({claim,evidence:events.filter(e=>e.at<=s.time&&Math.abs(e.at-claim.at)<=10000&&(e.type==='witness'||e.type==='action'&&e.action?.type!=='say'&&e.action?.type!=='wait')).slice(-6),label:'Context comparison only. A public claim is not verified by nearby events; absence of evidence is not contradiction.'}));}
 return {events,coverage,at,perspective,claims,metadata,mapId:canonicalId,...(selectedRevision===2?{mapRevision:2}:{}),mapName:map.name};
}

/** Clock owns no network or input callbacks. Seek resets wall-clock accumulation. */
export function createReplayClock({from,through,onFrame,now=()=>performance.now(),request=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id)}){
 let time=from,speed=1,playing=false,disposed=false,handle=null,last=null;
 function pause(){playing=false;if(handle!==null)cancel(handle);handle=null;last=null;}
 function frame(stamp){handle=null;if(!playing||disposed)return;if(last!==null)time=Math.min(through,time+Math.max(0,stamp-last)*speed);last=stamp;onFrame(time);if(time>=through)pause();else handle=request(frame);}
 return {get time(){return time;},get playing(){return playing;},get speed(){return speed;},play(){if(disposed||playing||time>=through)return;playing=true;last=now();handle=request(frame);},pause,seek(value){if(disposed)return;time=Math.min(through,Math.max(from,Number.isFinite(value)?value:from));last=now();onFrame(time);},setSpeed(value){if(![.25,.5,1,2,4].includes(value))throw new Error('Unsupported playback speed');speed=value;last=now();},dispose(){pause();disposed=true;}};
}
