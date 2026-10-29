import {BEACON_ACTION_FIELDS} from '../../../shared/beacon.mjs';
import {SYSTEM_LIMITS,kinds,criticalKinds,fixturesFor,tactical,cooldownFor,own,object,time,exact,rulesFor,validateRoster,validateSystemsState} from './model.mjs';
import {openTacticalDoor,doorBusy,thresholdOccupied} from './tactical-doors.mjs';
export {SYSTEM_LIMITS,validateSystemsState};
export const SYSTEM_ACTIONS=Object.freeze(['sabotage','repair','systemSabotage','systemRepair','vent']);
const clone=value=>structuredClone(value),inactive=()=>({active:false,startedAt:null,deadlineAt:null});
const fail=(code,message)=>({code,message});
const duration=(rules,kind)=>rules[kind==='lights'?'lightsDurationMs':kind==='communications'?'communicationsDurationMs':'doorDurationMs'];
const currentDoor=(state,id)=>state.systems.doors.find(d=>d.id===id);
const readyContext=ctx=>ctx&&['record','publicEvent','nearby','sees','stop'].every(key=>typeof ctx[key]==='function');
export function initializeSystems(state,now){
 validateRoster(state);rulesFor(state);const {map}=fixturesFor(state);if(state.schemaVersion===4&&!tactical(state))throw new Error('Invalid tactical systems identity');if(!time(now)||Object.hasOwn(state,'systems')||state.sabotage!==null)throw new Error('Cannot initialize systems on an existing or invalid match');
 const cooldowns=Object.fromEntries(state.players.map(p=>{const criticalAt=p.cooldowns?.sabotageAt??now;if(!time(criticalAt))throw new Error('Invalid initial sabotage cooldown');return [p.id,{criticalAt,auxiliaryAt:now,ventAt:now}];}));
 const v2=tactical(state);
 state.systems={version:v2?2:1,lights:inactive(),communications:inactive(),doors:map.fixtures.doors.map(d=>v2?openTacticalDoor(d.id):({id:d.id,closed:false,startedAt:null,deadlineAt:null})),transit:{},cooldowns:v2?Object.fromEntries(state.players.map(p=>[p.id,{ventAt:now}])):cooldowns,...(v2?{factionCooldowns:{saboteur:{criticalAt:Math.max(now,...state.players.filter(p=>p.role==='saboteur').map(p=>cooldowns[p.id].criticalAt)),auxiliaryAt:now}}}:{})};
 validateSystemsState(state);
}
export function systemsDeadline(state){
 const s=state.systems;return Math.min(...[s.lights,s.communications].filter(e=>e.active).map(e=>e.deadlineAt),...s.doors.filter(d=>s.version===2?doorBusy(d):d.closed).map(d=>d.closeAt??d.deadlineAt),...Object.values(s.transit).map(t=>t.deadlineAt));
}
function emit(state,systemId,active,at,ctx,extra={}){ctx.publicEvent(state,'system',at,{systemId,active,...extra});}
function clearEffect(state,kind,at,ctx,reason){state.systems[kind]=inactive();emit(state,kind,false,at,ctx,{reason});}
function openDoor(state,door,at,ctx,reason){if(tactical(state))Object.assign(door,openTacticalDoor(door.id));else{door.closed=false;door.startedAt=null;door.deadlineAt=null;}emit(state,'door',false,at,ctx,{doorId:door.id,reason});}
function witnesses(state,actor,location,ctx){return state.players.filter(p=>p.id===actor.id||(p.alive&&!own(state.systems.transit,p.id)&&ctx.sees(state,p,actor.position)&&ctx.sees(state,p,location))).map(p=>p.id);}
function cancelTransit(state,p,at,ctx,reason){const t=own(state.systems.transit,p.id);if(!t)return false;delete state.systems.transit[p.id];ctx.stop(state,p,at,'vent-cancelled');ctx.record(state,'vent_cancelled',at,{playerId:p.id,entryId:t.entryId,reason,visibleTo:[p.id]});return true;}
export function advanceSystems(state,at,ctx){
 if(!time(at)||!readyContext(ctx))throw new Error('Invalid systems clock/context');const s=state.systems,{doors,vents,geometry}=fixturesFor(state),jobs=[];
 for(const kind of ['lights','communications'])if(s[kind].active&&s[kind].deadlineAt<=at)jobs.push({at:s[kind].deadlineAt,kind});
 for(const d of s.doors){
  if(tactical(state)&&d.status==='pending'&&d.closeAt<=at)jobs.push({at:d.closeAt,kind:'door-close',id:d.id});
  if((tactical(state)?doorBusy(d):d.closed)&&d.deadlineAt<=at)jobs.push({at:d.deadlineAt,kind:'door',id:d.id});
 }
 for(const [id,t]of Object.entries(s.transit))if(t.deadlineAt<=at||state.phase!=='roam'||!state.players.find(p=>p.id===id)?.alive)jobs.push({at:Math.min(at,t.deadlineAt),kind:'vent',id});
 jobs.sort((a,b)=>a.at-b.at||a.kind.localeCompare(b.kind)||String(a.id??'').localeCompare(String(b.id??'')));
 for(const job of jobs){
  if(job.kind==='door-close'){
   const d=currentDoor(state,job.id);if(d.status!=='pending')continue;
   const occupied=thresholdOccupied(state,doors.get(d.id),geometry.WORLD.bodyRadius);d.status=occupied?'jammed':'closed';d.closed=!occupied;d.closeAt=null;
   emit(state,'door',d.closed,job.at,ctx,{doorId:d.id,status:d.status,deadlineAt:d.deadlineAt,reason:occupied?'obstructed':'warning-ended'});
  }else if(job.kind==='door')openDoor(state,currentDoor(state,job.id),job.at,ctx,'expired');
  else if(job.kind!=='vent')clearEffect(state,job.kind,job.at,ctx,'expired');
  else{
   const p=state.players.find(p=>p.id===job.id),t=own(s.transit,job.id);
   if(state.phase!=='roam'||!p?.alive||state.sabotage?.active&&state.sabotage.deadlineAt<=job.at){if(p)cancelTransit(state,p,job.at,ctx,'unavailable');continue;}
   const exit=vents.get(t.exitId);delete s.transit[p.id];p.position=clone(exit.position);p.roomId=exit.roomId;ctx.stop(state,p,job.at,'vent-exit');ctx.record(state,'vent_exit',job.at,{playerId:p.id,exitId:exit.id,roomId:exit.roomId,position:clone(exit.position),visibleTo:witnesses(state,p,exit.position,ctx)});
  }
 }
 return jobs.length>0;
}
export function onSystemsPhaseChange(state,phase,at,ctx){
 if(phase==='roam')return false;if(!time(at)||!readyContext(ctx))throw new Error('Invalid systems phase context');let changed=false;
 for(const p of state.players)changed=cancelTransit(state,p,at,ctx,'phase')||changed;
 for(const d of state.systems.doors)if(tactical(state)?doorBusy(d):d.closed){openDoor(state,d,at,ctx,'phase');changed=true;}
 if(['ended','paused'].includes(phase))for(const kind of ['lights','communications'])if(state.systems[kind].active){clearEffect(state,kind,at,ctx,'phase');changed=true;}
 return changed;
}
function normalized(state,p,a,now,ctx){
 if(a.type==='sabotage')return {type:'systemSabotage',kind:'power',targetId:'beacon'};
 if(a.type==='repair'){
  const critical=state.sabotage;const site=critical?.sites.find(site=>site.progress===0&&local(state,p,site.position,ctx));
  return {type:'systemRepair',systemId:critical?.kind??'power',siteId:site?.id??''};
 }
 return a;
}
function local(state,p,position,ctx){return ctx.sees(state,p,position)&&ctx.nearby(state,p,position,ctx.geometry?.WORLD?.interactionRadius??92);}
// Both faces lie outside the closed door collider, so physical reopening never requires seeing through it.
function doorPanels(d,ctx){const pad=(ctx.geometry?.WORLD?.bodyRadius??14)+4;return d.width<d.height?[{x:d.x-pad,y:d.y+d.height/2},{x:d.x+d.width+pad,y:d.y+d.height/2}]:[{x:d.x+d.width/2,y:d.y-pad},{x:d.x+d.width/2,y:d.y+d.height+pad}];}
function doorPanel(state,p,d,ctx){return doorPanels(d,ctx).find(point=>local(state,p,point,ctx));}
export function validateSystemAction(state,p,action,now,ctx){
 if(!object(action)||!Object.hasOwn(action,'type')||!Object.hasOwn(Object.getOwnPropertyDescriptor(action,'type'),'value')||!SYSTEM_ACTIONS.includes(action.type))return fail('INVALID_ACTION','Invalid system action.');
 const fields=BEACON_ACTION_FIELDS[action.type]??[],keys=['type',...fields,...(Object.hasOwn(action,'id')?['id']:[])];
 if(!exact(action,keys)||fields.some(key=>typeof action[key]!=='string'||action[key].length>100)||(Object.hasOwn(action,'id')&&(typeof action.id!=='string'||!/^[A-Za-z0-9:_-]{1,100}$/.test(action.id))))return fail('INVALID_ACTION','Invalid system fields.');
 if(!readyContext(ctx)||!state.systems||!p||!state.players.includes(p)||!own(state.systems.cooldowns,p.id))return fail('UNAVAILABLE','System controls are unavailable.');
 if(!time(now)||now<(state.updatedAt??0))return fail('INVALID_TIME','Invalid server time.');
 if(['ended','paused'].includes(state.phase))return fail('MATCH_INACTIVE','This match is not active.');
 if(!p.alive)return fail('PLAYER_DEAD','Eliminated keepers cannot use systems.');
 if(state.phase!=='roam')return fail('WRONG_PHASE','System controls require roaming.');
 if(state.sabotage?.active&&now>=state.sabotage.deadlineAt)return fail('CRITICAL_EXPIRED','The critical deadline has elapsed.');
 if(own(state.systems.transit,p.id))return fail('IN_TRANSIT','Finish hatch travel before acting.');
 let r;try{r=rulesFor(state);}catch{return fail('UNAVAILABLE','Invalid system rules.');}
 if(!time(now+Math.max(r.criticalDurationMs,r.criticalCooldownMs,r.auxiliaryCooldownMs,r.lightsDurationMs,r.communicationsDurationMs,r.doorDurationMs,r.ventTravelMs+r.ventCooldownMs,r.doorGraceMs+r.doorDurationMs)))return fail('INVALID_TIME','System deadline exceeds clock bounds.');
 const {doors,vents,repairs}=fixturesFor(state),a=normalized(state,p,action,now,ctx),cooldown=cooldownFor(state,p.id);
 if(a.type==='systemSabotage'){
  if(!kinds.includes(a.kind)||(a.kind==='door'?!doors.has(a.targetId):a.targetId!=='beacon'))return fail('INVALID_TARGET','Choose a known system target.');
  if(p.role!=='saboteur')return fail('UNAVAILABLE','Sabotage is unavailable.');
  if(criticalKinds.includes(a.kind)){
   if(state.sabotage?.active)return fail('CRITICAL_ACTIVE','Only one critical failure may run.');
   if(now<cooldown.criticalAt)return fail('COOLDOWN','Critical sabotage is cooling down.');
  }else{
   if(now<cooldown.auxiliaryAt)return fail('COOLDOWN','Auxiliary sabotage is cooling down.');
   if(a.kind==='door'){
    if(tactical(state)?doorBusy(currentDoor(state,a.targetId)):currentDoor(state,a.targetId).closed)return fail('ALREADY_ACTIVE','This door is already closed.');
    if(state.systems.doors.filter(d=>tactical(state)?doorBusy(d):d.closed).length>=r.maxClosedDoors)return fail('SYSTEM_LIMIT','The closed door limit is reached.');
   }else if(state.systems[a.kind].active)return fail('ALREADY_ACTIVE','This system is already disrupted.');
  }
 }else if(a.type==='systemRepair'){
  if(a.systemId==='door'){
   const d=doors.get(a.siteId);if(!d||!(tactical(state)?doorBusy(currentDoor(state,a.siteId)):currentDoor(state,a.siteId).closed)||now>=currentDoor(state,a.siteId).deadlineAt||!doorPanel(state,p,d,ctx))return fail('UNAVAILABLE','Approach a closed door to reopen it.');
  }else{
   if(p.role!=='crew')return fail('UNAVAILABLE','Only crew can repair equipment.');
   if(criticalKinds.includes(a.systemId)){
    const critical=state.sabotage,site=critical?.sites.find(site=>site.id===a.siteId);
    if(!critical?.active||critical.kind!==a.systemId||!site||site.progress||critical.repairers.includes(p.id)||!local(state,p,site.position,ctx))return fail('UNAVAILABLE','No critical contribution is available here.');
   }else{
    const site=own(repairs,a.systemId)?.find(site=>site.id===a.siteId);
    if(!['lights','communications'].includes(a.systemId)||!state.systems[a.systemId]?.active||now>=state.systems[a.systemId].deadlineAt||!site||!local(state,p,site.position,ctx))return fail('UNAVAILABLE','No equipment repair is available here.');
   }
  }
 }else if(a.type==='vent'){
  const entry=vents.get(a.entryId),exit=vents.get(a.exitId);
  if(p.role!=='saboteur'||!entry||!exit||!entry.links.includes(exit.id)||!local(state,p,entry.position,ctx))return fail('UNAVAILABLE','No permitted hatch route here.');
  if(now<cooldown.ventAt)return fail('COOLDOWN','Hatch travel is cooling down.');
 }
 return null;
}
export function applySystemAction(state,p,action,now,ctx){
 if(validateSystemAction(state,p,action,now,ctx))return false;const {vents,repairs}=fixturesFor(state),a=normalized(state,p,action,now,ctx),r=rulesFor(state),personal=own(state.systems.cooldowns,p.id),c=tactical(state)?state.systems.factionCooldowns.saboteur:personal;
 if(a.type==='systemSabotage'){
  if(criticalKinds.includes(a.kind)){
   const sites=repairs[a.kind].map(site=>({...clone(site),progress:0,repairedBy:null,repairedAt:null}));
   state.sabotage={active:true,kind:a.kind,roomId:sites[0].roomId,startedAt:now,deadlineAt:now+r.criticalDurationMs,repairsCompleted:0,repairsRequired:sites.length,repairers:[],sites};c.criticalAt=now+r.criticalCooldownMs;if(tactical(state)){for(const actor of state.players)if(actor.role==='saboteur'&&actor.cooldowns)actor.cooldowns.sabotageAt=c.criticalAt;}else if(p.cooldowns)p.cooldowns.sabotageAt=c.criticalAt;emit(state,a.kind,true,now,ctx,{deadlineAt:state.sabotage.deadlineAt});
  }else{
   c.auxiliaryAt=now+r.auxiliaryCooldownMs;
   if(a.kind==='door'){
    const d=currentDoor(state,a.targetId);Object.assign(d,{closed:!tactical(state),startedAt:now,deadlineAt:now+r.doorGraceMs+r.doorDurationMs,...(tactical(state)?{status:'pending',closeAt:now+r.doorGraceMs}:{})});emit(state,'door',d.closed,now,ctx,{doorId:a.targetId,deadlineAt:d.deadlineAt,...(tactical(state)?{status:d.status,closeAt:d.closeAt}:{})});
   }
   else{state.systems[a.kind]={active:true,startedAt:now,deadlineAt:now+duration(r,a.kind)};emit(state,a.kind,true,now,ctx,{deadlineAt:state.systems[a.kind].deadlineAt});}
  }
  ctx.record(state,'system_sabotage',now,{playerId:p.id,kind:a.kind,targetId:a.targetId});
 }else if(a.type==='systemRepair'){
  if(a.systemId==='door')openDoor(state,currentDoor(state,a.siteId),now,ctx,'physical');
  else if(criticalKinds.includes(a.systemId)){
   const critical=state.sabotage,site=critical.sites.find(s=>s.id===a.siteId);site.progress=1;site.repairedBy=p.id;site.repairedAt=now;critical.repairers.push(p.id);critical.repairsCompleted++;critical.active=critical.repairsCompleted<critical.repairsRequired;emit(state,a.systemId,critical.active,now,ctx,{repairsCompleted:critical.repairsCompleted,repairsRequired:critical.repairsRequired});
  }else clearEffect(state,a.systemId,now,ctx,'repair');
  ctx.record(state,'system_repair',now,{playerId:p.id,systemId:a.systemId,siteId:a.siteId});
 }else{
  const entry=vents.get(a.entryId),visibleTo=witnesses(state,p,entry.position,ctx);ctx.stop(state,p,now,'vent-entry');
  Object.defineProperty(state.systems.transit,p.id,{value:{entryId:a.entryId,exitId:a.exitId,startedAt:now,deadlineAt:now+r.ventTravelMs,origin:clone(p.position),originRoomId:p.roomId},enumerable:true,writable:true,configurable:true});personal.ventAt=now+r.ventTravelMs+r.ventCooldownMs;
  ctx.record(state,'vent_enter',now,{playerId:p.id,entryId:a.entryId,roomId:entry.roomId,position:clone(entry.position),visibleTo});
 }
 return true;
}
export function systemActionHints(state,p,now,ctx){
 if(!p||!readyContext(ctx)||!state.players.includes(p))return [];const {map,doors,vents,repairs}=fixturesFor(state),result=[];
 const add=(a,label,location)=>{if(validateSystemAction(state,p,a,now,ctx)===null){const {type,...fields}=a;result.push({id:`${type}:${Object.values(fields).join(':')}`,type,fields,label,enabled:true,...(location?{position:clone(location.position),roomId:location.roomId}:{})});}};
 for(const kind of kinds)for(const targetId of kind==='door'?[...doors.keys()]:['beacon'])add({type:'systemSabotage',kind,targetId},`Disrupt ${kind}`);
 for(const [systemId,sites]of Object.entries(repairs))for(const site of sites)add({type:'systemRepair',systemId,siteId:site.id},site.label,site);
 for(const d of map.fixtures.doors){const panel=doorPanel(state,p,d,ctx);if(panel)add({type:'systemRepair',systemId:'door',siteId:d.id},'Reopen door',{position:panel,roomId:d.roomId});}
 for(const entry of map.fixtures.vents)for(const exitId of entry.links)add({type:'vent',entryId:entry.id,exitId},`Hatch to ${vents.get(exitId).roomId}`,entry);
 return result;
}
export function getSystemsView(state,viewerId){
 const s=state.systems,c=state.sabotage,actor=state.players.find(p=>p.id===viewerId),transit=actor&&own(s.transit,actor.id);
 return {version:s.version,lights:{active:s.lights.active,deadlineAt:s.lights.deadlineAt},communications:{active:s.communications.active,deadlineAt:s.communications.deadlineAt,devicesBlocked:s.communications.active},doors:s.doors.map(d=>({id:d.id,closed:d.closed,deadlineAt:d.deadlineAt,...(tactical(state)?{status:d.status,closeAt:d.closeAt}:{})})),critical:c?{active:c.active,kind:c.kind,roomId:c.roomId,deadlineAt:c.deadlineAt,repairsCompleted:c.repairsCompleted,repairsRequired:c.repairsRequired,sites:c.sites.map(site=>({id:site.id,roomId:site.roomId,position:clone(site.position),label:site.label,progress:site.progress}))}:null,selfTransit:transit?{entryId:transit.entryId,exitId:transit.exitId,startedAt:transit.startedAt,deadlineAt:transit.deadlineAt}:null,cooldowns:actor?clone(tactical(state)&&actor.role==='saboteur'?cooldownFor(state,actor.id):own(s.cooldowns,actor.id)):null};
}
