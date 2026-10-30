import {BEACON_VENTS,BEACON_REPAIRS,DEFAULT_BEACON_RULES} from '../../../shared/beacon.mjs';
import {DEFAULT_RULES} from '../../../shared/contracts.mjs';
import * as geometry from '../../../shared/world.mjs';
import {getMap} from '../../../shared/maps/index.mjs';
import {TACTICAL_PRESET,isTactical} from '../../../shared/tactical.mjs';
import {validateDoorState} from './tactical-doors.mjs';
export const SYSTEM_LIMITS=Object.freeze({players:128,maxClosedDoors:2,auxiliaryCooldownMs:20000});
export const kinds=Object.freeze(['lights','communications','door','power','flood']);
export const criticalKinds=Object.freeze(['power','flood']);
export function fixturesFor(state){const map=getMap(state.map);return {map,geometry:map.geometry,doors:new Map(map.fixtures.doors.map(d=>[d.id,d])),vents:new Map(map.fixtures.vents.map(v=>[v.id,v])),repairs:map.fixtures.repairs};}
export const tactical=isTactical;
export function cooldownFor(state,actor){const personal=own(state.systems.cooldowns,actor);return tactical(state)?{...state.systems.factionCooldowns.saboteur,...personal}:personal;}
export const own=(value,key)=>Object.hasOwn(value,key)?value[key]:undefined;
export const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
export const time=value=>Number.isSafeInteger(value)&&value>=0;
export const point=value=>exact(value,['x','y'])&&Number.isFinite(value.x)&&Number.isFinite(value.y);
export const id=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)&&!['constructor','prototype'].includes(value);
export function exact(value,keys){return object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));}
export function rulesFor(state){
 const r={...DEFAULT_BEACON_RULES,...state.beaconRules};
 r.auxiliaryCooldownMs=state.beaconRules?.auxiliaryCooldownMs??SYSTEM_LIMITS.auxiliaryCooldownMs;
 r.maxClosedDoors=tactical(state)?TACTICAL_PRESET.doorLimit:state.beaconRules?.maxClosedDoors??SYSTEM_LIMITS.maxClosedDoors;
 r.doorGraceMs=tactical(state)?TACTICAL_PRESET.doorGraceMs:0;
 r.criticalDurationMs=state.rules?.criticalDurationMs??DEFAULT_RULES.criticalDurationMs;
 r.criticalCooldownMs=state.rules?.sabotageCooldownMs??DEFAULT_RULES.sabotageCooldownMs;
 for(const key of ['lightsDurationMs','communicationsDurationMs','doorDurationMs','ventTravelMs','ventCooldownMs','auxiliaryCooldownMs','criticalDurationMs','criticalCooldownMs'])if(!Number.isSafeInteger(r[key])||r[key]<1||r[key]>86400000)throw new Error('Invalid systems rule');
 if(!Number.isSafeInteger(r.maxClosedDoors)||r.maxClosedDoors<1||r.maxClosedDoors>fixturesFor(state).doors.size)throw new Error('Invalid door limit');
 return r;
}
export function validateRoster(state){
 if(!Array.isArray(state.players)||state.players.length<1||state.players.length>SYSTEM_LIMITS.players)throw new Error('Invalid systems roster');
 const ids=new Set();for(const p of state.players){if(!object(p)||!id(p.id)||ids.has(p.id)||!['crew','saboteur'].includes(p.role)||typeof p.alive!=='boolean')throw new Error('Invalid systems actor');ids.add(p.id);}return ids;
}
// Only immutable descriptors are shared; mutable clocks and lookup maps are per match/call.
export function validateHatchNetwork(network,geo=geometry){
 if(!Array.isArray(network)||!network.length||network.length>32||typeof geo.isWalkable!=='function'||typeof geo.worldRoomAt!=='function')throw new Error('Invalid hatch network');
 const map=new Map(network.map(v=>[v?.id,v]));if(map.size!==network.length)throw new Error('Duplicate hatch');
 for(const v of network)if(!exact(v,['id','roomId','position','links'])||!id(v.id)||!geo.WORLD_ROOMS.some(room=>room.id===v.roomId)||!point(v.position)||!geo.isWalkable(v.position)||geo.worldRoomAt(v.position)!==v.roomId||!Array.isArray(v.links)||!v.links.length||v.links.length>network.length-1||new Set(v.links).size!==v.links.length||v.links.some(target=>target===v.id||!map.has(target)||!Array.isArray(map.get(target).links)||!map.get(target).links.includes(v.id)))throw new Error('Invalid hatch network');
 return true;
}
validateHatchNetwork(BEACON_VENTS);
for(const [kind,sites]of Object.entries(BEACON_REPAIRS))if(!sites.length||sites.length>2||new Set(sites.map(s=>s.id)).size!==sites.length||sites.some(s=>!id(s.id)||!point(s.position)||!geometry.isWalkable(s.position)))throw new Error('Invalid repair fixtures');
export function validateSystemsState(state){
 const ids=validateRoster(state),r=rulesFor(state),s=state.systems,{map,geometry:geo,doors,vents,repairs}=fixturesFor(state),v2=tactical(state);
 if([4,5].includes(state.schemaVersion)&&!v2||v2&&(!exact(state.map,['id','version'])||!exact(state.preset,['id','version'])||state.preset.id!==TACTICAL_PRESET.id||state.preset.version!==TACTICAL_PRESET.version))throw new Error('Invalid tactical systems identity');
 if(!exact(s,['version','lights','communications','doors','transit','cooldowns',...(v2?['factionCooldowns']:[])])||s.version!==(v2?2:1))throw new Error('Invalid systems state');
 // This validator consumes finalized checkpoints, never in-progress chronological mutations.
 const checkpoint=state.updatedAt,begin=state.startedAt===undefined?0:state.startedAt;
 if(v2&&(!time(checkpoint)||!time(begin)||checkpoint<begin))throw new Error('Invalid systems checkpoint');
 const history=at=>{if(v2&&(!time(at)||at<begin||at>checkpoint))throw new Error('Systems history exceeds checkpoint');};
 const reservation=(at,horizon)=>{if(v2&&(at<begin||at-checkpoint>horizon))throw new Error('Systems reservation exceeds checkpoint horizon');};

 validateHatchNetwork(map.fixtures.vents,geo);
 const effect=(v,duration)=>{
  if(!exact(v,['active','startedAt','deadlineAt'])||typeof v.active!=='boolean'||(v.active?(!time(v.startedAt)||!time(v.deadlineAt)||v.deadlineAt-v.startedAt!==duration):(v.startedAt!==null||v.deadlineAt!==null)))throw new Error('Invalid timed system');
 };
 effect(s.lights,r.lightsDurationMs);effect(s.communications,r.communicationsDurationMs);
 if(v2)for(const kind of ['lights','communications'])if(s[kind].active)history(s[kind].startedAt);
 if(!Array.isArray(s.doors)||s.doors.length!==doors.size||new Set(s.doors.map(d=>d?.id)).size!==doors.size)throw new Error('Invalid systems doors');
 for(const d of s.doors){if(v2){validateDoorState(d,doors,r,state.phase);if(d.status!=='open')history(d.startedAt);}else{if(!exact(d,['id','closed','startedAt','deadlineAt'])||!doors.has(d.id)||typeof d.closed!=='boolean')throw new Error('Invalid systems door');effect({active:d.closed,startedAt:d.startedAt,deadlineAt:d.deadlineAt},r.doorDurationMs);}}
 if(s.doors.filter(d=>v2?d.status!=='open':d.closed).length>r.maxClosedDoors)throw new Error('Too many closed doors');
 if(!object(s.cooldowns)||Reflect.ownKeys(s.cooldowns).length!==ids.size||!object(s.transit)||Reflect.ownKeys(s.transit).length>ids.size)throw new Error('Invalid systems maps');
 for(const actor of Reflect.ownKeys(s.cooldowns)){const c=own(s.cooldowns,actor);if(!ids.has(actor)||!exact(c,v2?['ventAt']:['criticalAt','auxiliaryAt','ventAt'])||!Object.values(c).every(time))throw new Error('Invalid systems cooldown');if(v2)reservation(c.ventAt,r.ventTravelMs+r.ventCooldownMs);}
 if(v2&&(!exact(s.factionCooldowns,['saboteur'])||!exact(s.factionCooldowns.saboteur,['criticalAt','auxiliaryAt'])||!Object.values(s.factionCooldowns.saboteur).every(time)))throw new Error('Invalid faction cooldown');
 if(v2&&['ended','paused'].includes(state.phase)&&(s.lights.active||s.communications.active))throw new Error('Active terminal systems');
 if(v2){
  reservation(s.factionCooldowns.saboteur.criticalAt,r.criticalCooldownMs);reservation(s.factionCooldowns.saboteur.auxiliaryAt,r.auxiliaryCooldownMs);
  const started=[s.lights,s.communications].filter(effect=>effect.active).map(effect=>effect.startedAt);
  started.push(...s.doors.filter(door=>door.status!=='open').map(door=>door.startedAt));
  if(started.some(at=>s.factionCooldowns.saboteur.auxiliaryAt<at+r.auxiliaryCooldownMs))throw new Error('Lost faction auxiliary reservation');
 }
 for(const actor of Reflect.ownKeys(s.transit)){
  const t=own(s.transit,actor),p=state.players.find(p=>p.id===actor),entry=vents.get(t?.entryId),exit=vents.get(t?.exitId);
  if(!ids.has(actor)||!p.alive||p.role!=='saboteur'||state.phase!=='roam'||!exact(t,['entryId','exitId','startedAt','deadlineAt','origin','originRoomId'])||!entry||!exit||!entry.links.includes(exit.id)||!time(t.startedAt)||!time(t.deadlineAt)||t.deadlineAt-t.startedAt!==r.ventTravelMs||!point(t.origin)||!geo.isWalkable(t.origin)||t.originRoomId!==p.roomId||!point(p.position)||p.position.x!==t.origin.x||p.position.y!==t.origin.y||own(s.cooldowns,actor).ventAt<t.deadlineAt+r.ventCooldownMs)throw new Error('Invalid hatch transit');
  if(v2){history(t.startedAt);if(geo.distance(t.origin,entry.position)>geo.WORLD.interactionRadius||own(s.cooldowns,actor).ventAt!==t.deadlineAt+r.ventCooldownMs)throw new Error('Inconsistent hatch origin or reservation');}
  if(p.motion&&(p.motion.manual||p.motion.path?.length||p.motion.destination!==null))throw new Error('Moving actor in hatch');
 }
 if(state.sabotage!==null){
  const c=state.sabotage,fixtures=own(repairs,c?.kind);
  if(!exact(c,['active','kind','roomId','startedAt','deadlineAt','repairsCompleted','repairsRequired','repairers','sites'])||!criticalKinds.includes(c.kind)||typeof c.active!=='boolean'||!time(c.startedAt)||!time(c.deadlineAt)||c.deadlineAt-c.startedAt!==r.criticalDurationMs||c.roomId!==fixtures[0].roomId||c.repairsRequired!==fixtures.length||!Number.isSafeInteger(c.repairsCompleted)||c.repairsCompleted<0||c.repairsCompleted>fixtures.length||!Array.isArray(c.repairers)||c.repairers.length!==c.repairsCompleted||new Set(c.repairers).size!==c.repairers.length||!Array.isArray(c.sites)||c.sites.length!==fixtures.length||new Set(c.sites.map(s=>s?.id)).size!==fixtures.length||c.active!==(c.repairsCompleted<c.repairsRequired))throw new Error('Invalid critical system');
  if(v2)history(c.startedAt);
  for(const site of c.sites){const f=fixtures.find(f=>f.id===site.id);if(!f||!exact(site,['id','roomId','position','label','progress','repairedBy','repairedAt'])||site.roomId!==f.roomId||site.label!==f.label||!point(site.position)||site.position.x!==f.position.x||site.position.y!==f.position.y||![0,1].includes(site.progress)||(site.progress===0?(site.repairedBy!==null||site.repairedAt!==null):(!c.repairers.includes(site.repairedBy)||!time(site.repairedAt)||site.repairedAt<c.startedAt||site.repairedAt>=c.deadlineAt)))throw new Error('Invalid critical repair site');if(v2&&site.progress===1)history(site.repairedAt);}
  if(v2&&s.factionCooldowns.saboteur.criticalAt!==c.startedAt+r.criticalCooldownMs)throw new Error('Lost faction critical reservation');
  const finished=c.sites.filter(site=>site.progress===1);if(finished.length!==c.repairsCompleted||new Set(finished.map(site=>site.repairedBy)).size!==finished.length||c.repairers.some(actor=>!ids.has(actor)||state.players.find(p=>p.id===actor).role!=='crew'||!finished.some(site=>site.repairedBy===actor)))throw new Error('Invalid critical repairers');
 }
 return true;
}