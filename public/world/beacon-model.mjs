import {getMap} from '../../shared/maps/index.mjs';
import {mapKey,roomName as mapRoomName} from './map-model.mjs';
import {BEACON_ACTION_FIELDS} from '../../shared/beacon.mjs';
const TYPES=new Set(['systemSabotage','systemRepair','vent','investigate','deviceCancel','ability']);
export const finitePoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
export function knowledge(game,player){
 if(game?.beaconVersion===1)return ['alive','dead'].includes(player?.status)?player.status:'unknown';
 return player?.alive===false?'dead':'alive';
}
const BASE_FIELDS=Object.freeze({task:['taskId'],report:['bodyId'],eliminate:['targetId'],meeting:[]});
export function actionDescriptors(game){
 if(game?.beaconVersion!==1)return [];
 return (game.interactions||[]).filter(h=>{
  const fields=Object.hasOwn(BASE_FIELDS,h?.type)?BASE_FIELDS[h.type]:(TYPES.has(h?.type)?BEACON_ACTION_FIELDS[h.type]:null);
  return fields&&typeof h.id==='string'&&h.fields&&typeof h.fields==='object'&&!Array.isArray(h.fields)&&Object.keys(h.fields).length===fields.length&&fields.every(key=>Object.hasOwn(h.fields,key)&&typeof h.fields[key]==='string')&&(h.type!=='ability'||h.fields.abilityId==='field-note'&&!!game.self&&h.fields.targetId===game.self.id);
 });
}
// Base tasks must still go through equipment puzzles, never generic panel buttons.
export function descriptors(game){return actionDescriptors(game).filter(h=>TYPES.has(h.type));}
export function hasActionDescriptor(game,type,fields){return actionDescriptors(game).some(h=>h.enabled===true&&h.type===type&&Object.keys(h.fields).length===Object.keys(fields).length&&Object.keys(fields).every(key=>h.fields[key]===fields[key]));}
export function descriptorKey(h){return JSON.stringify([h.id,h.type,Object.entries(h.fields).sort(([a],[b])=>a.localeCompare(b))]);}
export function viewKey(room){const g=room?.game,s=g?.self;return JSON.stringify([room?.roomId,g?.matchId,mapKey(g?.map??room?.map),g?.phase,s?.id,s?.alive,s?.roomId,s?.position,g?.systems?.selfTransit||s?.transit||null,g?.investigation?.session||null,g?.sabotage?.kind,g?.sabotage?.deadlineAt,g?.sabotage?.active,g?.sabotage?.repairsCompleted,g?.systems?.lights,g?.systems?.communications,g?.systems?.doors,g?.systems?.cooldowns,actionDescriptors(g).map(h=>[descriptorKey(h),h.enabled]),g?.vision?.radius,s?.tasks?.map(t=>[t.id,t.completed,t.progress]),g?.abilities?.notes]);}
export function criticalSites(game,map=getMap(game?.map)){
 if(game?.beaconVersion!==1||!game.sabotage?.active)return [];
 const kind=game.sabotage.kind,sites=game.systems?.critical?.sites||game.sabotage.sites;
 const supplied=Array.isArray(sites)?sites:Object.entries(sites||{}).map(([id,value])=>({id,...value}));
 return supplied.map(site=>{const fixture=map.fixtures.repairs[kind]?.find(f=>f.id===site.id);return {id:site.id,roomId:site.roomId||fixture?.roomId,position:site.position||fixture?.position,label:site.label||fixture?.label,progress:site.progress,completed:site.progress===1||site.completed===true};});
}
export function criticalText(game,map=getMap(game?.map)){
 const s=game?.sabotage;if(!s?.active)return '';
 const sites=criticalSites(game,map);
 return `${s.kind==='flood'?'FLOOD WARNING':'BEACON POWER FAILURE'}: ${s.repairsCompleted||0}/${s.repairsRequired||0} repairs${sites.length?' - '+sites.map(site=>`${site.label||site.id}${site.roomId?' ('+site.roomId+')':''}: ${site.completed?'complete':'required'}`).join('; '):''}. Each site needs a distinct living crew keeper. Countdown continues through council.`;
}
const seconds=(deadline,now)=>Number.isFinite(deadline)&&Number.isFinite(now)?Math.max(0,Math.ceil((deadline-now)/1000)):null;
export function systemSummary(game,now=game?.serverNow){
 const s=game?.systems;if(!s)return 'System status unavailable.';
 const state=value=>value?.active===true?`disrupted${seconds(value.deadlineAt,now)!==null?' ('+seconds(value.deadlineAt,now)+'s remaining)':''}`:value?.active===false?'normal':'unknown';
 const doors=(s.doors||[]).map(d=>`${d.id}: ${d.status==='pending'?'closing'+(seconds(d.closeAt,now)!==null?' ('+seconds(d.closeAt,now)+'s warning)':''):d.status==='jammed'?'jammed, open':d.closed===true?'closed'+(seconds(d.deadlineAt,now)!==null?' ('+seconds(d.deadlineAt,now)+'s remaining)':''):d.closed===false?'open':'unknown'}`).join('; ');
 return `Lights: ${state(s.lights)}. Communications: ${state(s.communications)}.${doors?' Doors: '+doors+'.':''}`;
}
export function cooldownText(game,now){
 if(game?.self?.role!=='saboteur')return '';
 const c=game.systems?.cooldowns;if(!c)return '';
 return [['auxiliaryAt',game.tacticalVersion===1?'Faction auxiliary sabotage':'Auxiliary sabotage'],['criticalAt',game.tacticalVersion===1?'Faction critical sabotage':'Critical sabotage'],['ventAt','Hatch travel']].filter(([key])=>seconds(c[key],now)>0).map(([key,label])=>`${label}: ${seconds(c[key],now)}s cooldown`).join('. ');
}
export function interactionLabel(h,game,map){
 // Array.map supplies (value,index,array). Only actual map descriptors may
 // override geometry; preserve direct one-argument callback use as well.
 const isMap=value=>!!value?.geometry&&!!value?.fixtures&&Array.isArray(value?.roomLayout);
 map=isMap(map)?map:isMap(game)?game:getMap(game&&typeof game==='object'&&!Array.isArray(game)?game.map:undefined);
 if(map.id!=='beacon'&&h.type==='vent'&&/^Hatch to /.test(h.label||'')){const hatch=map.fixtures.vents.find(v=>v.id===h.fields.exitId);if(hatch)return `Hatch to ${mapRoomName(map,hatch.roomId)}`;}
 if(h.type==='systemSabotage'&&h.fields.kind==='door'){const door=map.fixtures.doors.find(d=>d.id===h.fields.targetId);return `${h.label||'Disrupt door'}: ${h.fields.targetId}${door?' ('+door.roomId+')':''}`;}
 if(h.type==='systemRepair'&&h.fields.systemId==='door')return `${h.label||'Reopen door'}: ${h.fields.siteId}`;
 return h.label||h.type;
}
export function sessionText(investigation,now,map=getMap()){
 const session=investigation?.session;if(!session)return `Devices: ${investigation?.status||'status unavailable'}.`;
 const name=map.fixtures.devices.find(d=>d.id===session.deviceId)?.label||session.deviceId||'terminal',cooldown=seconds(session.cooldownAt,now),suffix=cooldown>0?` Equipment cooldown: ${cooldown}s.`:'';
 if(session.status==='reading')return `Reading ${name}${seconds(session.deadlineAt,now)!==null?' - '+seconds(session.deadlineAt,now)+'s remaining':''}. Stay still at the device. Movement, council or communications loss can cancel the read.`;
 if(session.status==='elapsed')return `Read complete: ${name}. See your timestamped observations.${suffix}`;
 const reasons={cancelled:'cancelled by you',dead:'keeper fell',phase:'watch phase changed',communications:'communications lost',transit:'hatch transit',position:'position unavailable',movement:'keeper moved',out_of_range:'console no longer in range',stale:'sampling deadline missed',map:'map changed'};
 return `Read ${session.status==='stale'?'stale':'failed'}: ${name}${session.reason?' - '+(reasons[session.reason]||'unavailable'):''}. No new sample.${suffix}`;
}
export function observationText(observation,players=[],map=getMap(observation.map)){
 const who=id=>players.find(p=>p.id===id)?.name||'Unidentified keeper';
 const kind=observation.kind||observation.type,data=observation.data||observation;
 const sampled=new Date(observation.at),time=Number.isFinite(observation.at)&&Number.isFinite(sampled.getTime())?`Sample at ${sampled.toISOString()}`:'Sample time unavailable';
 if(kind==='vitals'&&Array.isArray(data.players))return `${time}. Vitals: ${data.players.map(p=>`${who(p.id||p.playerId)}: ${['alive','dead'].includes(p.status)?p.status:typeof p.alive==='boolean'?(p.alive?'alive':'dead'):'unknown'}`).join('; ')}. Historical sample, not live status or eyewitness evidence.`;
 if(kind==='occupancy'&&Array.isArray(data.rooms))return `${time}. Occupancy: ${data.rooms.map(r=>`${r.roomId}: ${Number.isFinite(r.count)?r.count:'unknown'}`).join('; ')}. Counts only; identities unavailable. Historical sample.`;
 if(kind==='cameras'&&Array.isArray(data.frames))return `${time}. Cameras: ${data.frames.map(c=>{const camera=map.fixtures.cameras.find(f=>f.id===c.cameraId);return `${camera?.roomId||c.cameraId}: ${(c.players||[]).map(p=>who(p.id)).join(', ')||'no observed keepers'}${c.limited?' (limited sample)':''}`;}).join('; ')}. Historical camera sample, not eyewitness evidence.`;
 return `${time}. ${kind||'Device'} observation received; details unavailable in this client.`;
}

function sampledAt(at){const date=new Date(at);return Number.isFinite(at)&&Number.isFinite(date.getTime())?date.toISOString():'time unavailable';}
const recordedPosition=p=>finitePoint(p)?`x ${p.x.toFixed(1)}, y ${p.y.toFixed(1)}`:'position unavailable';
export function fieldNotes(game){
 if(game?.beaconVersion!==1||!game.self)return [];
 return (game.abilities?.notes||[]).filter(n=>n&&Number.isFinite(n.at)&&finitePoint(n.position)).map(n=>({id:n.id,at:n.at,roomId:n.roomId,position:{x:n.position.x,y:n.position.y}}));
}
export function fieldNoteText(note){return `Field note at ${sampledAt(note.at)}: ${note.roomId||'room unavailable'} (${recordedPosition(note.position)}). Your recorded location at that time.`;}
export function hatchTraces(game){
 if(game?.beaconVersion!==1)return [];
 return (game.events||[]).filter(e=>e&&['vent_enter','vent_exit'].includes(e.type)&&Number.isFinite(e.at)&&finitePoint(e.position)&&typeof e.playerId==='string').map(e=>({id:e.id,type:e.type,at:e.at,playerId:e.playerId,roomId:e.roomId,position:{x:e.position.x,y:e.position.y},...(e.type==='vent_enter'?{entryId:e.entryId}:{exitId:e.exitId})}));
}
export function hatchTraceText(event,players=[]){
 const name=players.find(p=>p.id===event.playerId)?.name||'Unidentified keeper',entering=event.type==='vent_enter',hatch=entering?event.entryId:event.exitId;
 return `At ${sampledAt(event.at)}, ${name} ${entering?'entered':'exited'} ${hatch||'a hatch'} in ${event.roomId||'an unrecorded room'} (${recordedPosition(event.position)}). Historical local observation; the other endpoint is not shown.`;
}
