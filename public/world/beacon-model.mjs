import {BEACON_ACTION_FIELDS,BEACON_REPAIRS,BEACON_CAMERAS,BEACON_DEVICES,BEACON_DOORS} from '../../shared/beacon.mjs';
const TYPES=new Set(['systemSabotage','systemRepair','vent','investigate','deviceCancel']);
export const finitePoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
export function knowledge(game,player){
 if(game?.beaconVersion===1)return ['alive','dead'].includes(player?.status)?player.status:'unknown';
 return player?.alive===false?'dead':'alive';
}
export function descriptors(game){
 if(game?.beaconVersion!==1)return [];
 return (game.interactions||[]).filter(h=>h&&typeof h.id==='string'&&TYPES.has(h.type)&&h.fields&&typeof h.fields==='object'&&!Array.isArray(h.fields)&&Object.keys(h.fields).length===BEACON_ACTION_FIELDS[h.type].length&&BEACON_ACTION_FIELDS[h.type].every(key=>typeof h.fields[key]==='string'));
}
export function descriptorKey(h){return JSON.stringify([h.id,h.type,Object.entries(h.fields).sort(([a],[b])=>a.localeCompare(b))]);}
export function viewKey(room){const g=room?.game,s=g?.self;return JSON.stringify([room?.roomId,g?.matchId,g?.phase,s?.id,s?.alive,s?.roomId,s?.position,g?.systems?.selfTransit||s?.transit||null,g?.investigation?.session||null,g?.sabotage?.kind,g?.sabotage?.deadlineAt,g?.sabotage?.active,g?.sabotage?.repairsCompleted,g?.systems?.lights,g?.systems?.communications,g?.systems?.doors,g?.systems?.cooldowns,descriptors(g).map(h=>[descriptorKey(h),h.enabled])]);}
export function criticalSites(game){
 if(game?.beaconVersion!==1||!game.sabotage?.active)return [];
 const kind=game.sabotage.kind,sites=game.systems?.critical?.sites||game.sabotage.sites;
 const supplied=Array.isArray(sites)?sites:Object.entries(sites||{}).map(([id,value])=>({id,...value}));
 return supplied.map(site=>{const fixture=BEACON_REPAIRS[kind]?.find(f=>f.id===site.id);return {id:site.id,roomId:site.roomId||fixture?.roomId,position:site.position||fixture?.position,label:site.label||fixture?.label,progress:site.progress,completed:site.progress===1||site.completed===true};});
}
export function criticalText(game){
 const s=game?.sabotage;if(!s?.active)return '';
 const sites=criticalSites(game);
 return `${s.kind==='flood'?'FLOOD WARNING':'BEACON POWER FAILURE'}: ${s.repairsCompleted||0}/${s.repairsRequired||0} repairs${sites.length?' - '+sites.map(site=>`${site.label||site.id}${site.roomId?' ('+site.roomId+')':''}: ${site.completed?'complete':'required'}`).join('; '):''}. Each site needs a distinct living crew keeper. Countdown continues through council.`;
}
const seconds=(deadline,now)=>Number.isFinite(deadline)&&Number.isFinite(now)?Math.max(0,Math.ceil((deadline-now)/1000)):null;
export function systemSummary(game,now=game?.serverNow){
 const s=game?.systems;if(!s)return 'System status unavailable.';
 const state=value=>value?.active===true?`disrupted${seconds(value.deadlineAt,now)!==null?' ('+seconds(value.deadlineAt,now)+'s remaining)':''}`:value?.active===false?'normal':'unknown';
 const doors=(s.doors||[]).map(d=>`${d.id}: ${d.closed===true?'closed'+(seconds(d.deadlineAt,now)!==null?' ('+seconds(d.deadlineAt,now)+'s remaining)':''):d.closed===false?'open':'unknown'}`).join('; ');
 return `Lights: ${state(s.lights)}. Communications: ${state(s.communications)}.${doors?' Doors: '+doors+'.':''}`;
}
export function cooldownText(game,now){
 if(game?.self?.role!=='saboteur')return '';
 const c=game.systems?.cooldowns;if(!c)return '';
 return [['auxiliaryAt','Auxiliary sabotage'],['criticalAt','Critical sabotage'],['ventAt','Hatch travel']].filter(([key])=>seconds(c[key],now)>0).map(([key,label])=>`${label}: ${seconds(c[key],now)}s cooldown`).join('. ');
}
export function interactionLabel(h){
 if(h.type==='systemSabotage'&&h.fields.kind==='door'){const door=BEACON_DOORS.find(d=>d.id===h.fields.targetId);return `${h.label||'Disrupt door'}: ${h.fields.targetId}${door?' ('+door.roomId+')':''}`;}
 if(h.type==='systemRepair'&&h.fields.systemId==='door')return `${h.label||'Reopen door'}: ${h.fields.siteId}`;
 return h.label||h.type;
}
export function sessionText(investigation,now){
 const session=investigation?.session;if(!session)return `Devices: ${investigation?.status||'status unavailable'}.`;
 const name=BEACON_DEVICES.find(d=>d.id===session.deviceId)?.label||session.deviceId||'terminal',cooldown=seconds(session.cooldownAt,now),suffix=cooldown>0?` Equipment cooldown: ${cooldown}s.`:'';
 if(session.status==='reading')return `Reading ${name}${seconds(session.deadlineAt,now)!==null?' - '+seconds(session.deadlineAt,now)+'s remaining':''}. Stay still at the device. Movement, council or communications loss can cancel the read.`;
 if(session.status==='elapsed')return `Read complete: ${name}. See your timestamped observations.${suffix}`;
 const reasons={cancelled:'cancelled by you',dead:'keeper fell',phase:'watch phase changed',communications:'communications lost',transit:'hatch transit',position:'position unavailable',movement:'keeper moved',out_of_range:'console no longer in range',stale:'sampling deadline missed'};
 return `Read ${session.status==='stale'?'stale':'failed'}: ${name}${session.reason?' - '+(reasons[session.reason]||'unavailable'):''}. No new sample.${suffix}`;
}
export function observationText(observation,players=[]){
 const who=id=>players.find(p=>p.id===id)?.name||'Unidentified keeper';
 const kind=observation.kind||observation.type,data=observation.data||observation;
 const sampled=new Date(observation.at),time=Number.isFinite(observation.at)&&Number.isFinite(sampled.getTime())?`Sample at ${sampled.toISOString()}`:'Sample time unavailable';
 if(kind==='vitals'&&Array.isArray(data.players))return `${time}. Vitals: ${data.players.map(p=>`${who(p.id||p.playerId)}: ${['alive','dead'].includes(p.status)?p.status:typeof p.alive==='boolean'?(p.alive?'alive':'dead'):'unknown'}`).join('; ')}. Historical sample, not live status or eyewitness evidence.`;
 if(kind==='occupancy'&&Array.isArray(data.rooms))return `${time}. Occupancy: ${data.rooms.map(r=>`${r.roomId}: ${Number.isFinite(r.count)?r.count:'unknown'}`).join('; ')}. Counts only; identities unavailable. Historical sample.`;
 if(kind==='cameras'&&Array.isArray(data.frames))return `${time}. Cameras: ${data.frames.map(c=>{const camera=BEACON_CAMERAS.find(f=>f.id===c.cameraId);return `${camera?.roomId||c.cameraId}: ${(c.players||[]).map(p=>who(p.id)).join(', ')||'no observed keepers'}${c.limited?' (limited sample)':''}`;}).join('; ')}. Historical camera sample, not eyewitness evidence.`;
 return `${time}. ${kind||'Device'} observation received; details unavailable in this client.`;
}
