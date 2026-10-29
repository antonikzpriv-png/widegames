import {BEACON_ACTION_FIELDS,BEACON_REPAIRS} from '../../shared/beacon.mjs';
const TYPES=new Set(['systemSabotage','systemRepair','vent','investigate','deviceCancel']);
export const finitePoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
export function knowledge(game,player){
 if(game?.beaconVersion===1)return ['alive','dead'].includes(player?.status)?player.status:'unknown';
 return player?.alive===false?'dead':'alive';
}
export function descriptors(game){
 if(game?.beaconVersion!==1)return [];
 return (game.interactions||[]).filter(h=>h&&typeof h.id==='string'&&TYPES.has(h.type)&&h.fields&&Object.keys(h.fields).length===BEACON_ACTION_FIELDS[h.type].length&&BEACON_ACTION_FIELDS[h.type].every(key=>typeof h.fields[key]==='string'));
}
export function descriptorKey(h){return JSON.stringify([h.id,h.type,Object.entries(h.fields).sort(([a],[b])=>a.localeCompare(b))]);}
export function viewKey(room){const g=room?.game,s=g?.self;return JSON.stringify([room?.roomId,g?.matchId,g?.phase,s?.id,s?.alive,s?.roomId,s?.position,g?.systems?.selfTransit||null]);}
export function criticalSites(game){
 if(game?.beaconVersion!==1||!game.sabotage?.active)return [];
 const kind=game.sabotage.kind,sites=game.sabotage.sites;
 // Public fixture positions describe infrastructure, never hidden actors.
 const supplied=Array.isArray(sites)?sites:Object.entries(sites||{}).map(([id,value])=>({id,...value}));
 return supplied.map(site=>({...BEACON_REPAIRS[kind]?.find(f=>f.id===site.id),...site}));
}
export function criticalText(game){
 const s=game?.sabotage;if(!s?.active)return '';
 const sites=criticalSites(game);
 return `${s.kind==='flood'?'FLOOD WARNING':'BEACON POWER FAILURE'}: ${s.repairsCompleted||0}/${s.repairsRequired||0} repairs${sites.length?' - '+sites.map(site=>`${site.label||site.id}${site.roomId?' ('+site.roomId+')':''}: ${site.completed===true?'complete':Number.isFinite(site.progress)?site.progress:'required'}`).join('; '):''}. Countdown continues through council.`;
}
export function systemSummary(game){
 const s=game?.systems;if(!s)return 'System status unavailable.';
 const state=value=>value?.active===true?'disrupted':value?.active===false?'normal':'unknown';
 const doors=(s.doors||[]).map(d=>`${d.id}: ${d.closed===true?'closed':d.closed===false?'open':'unknown'}`).join('; ');
 return `Lights: ${state(s.lights)}. Communications: ${state(s.communications)}.${doors?' Doors: '+doors+'.':''}`;
}
export function observationText(observation,players=[]){
 const who=id=>players.find(p=>p.id===id)?.name||id||'Keeper';
 const kind=observation.kind||observation.type;
 const time=Number.isFinite(observation.at)?`Sample at ${new Date(observation.at).toISOString()}`:'Sample time unavailable';
 if(kind==='vitals'&&Array.isArray(observation.players))return `${time}. Vitals: ${observation.players.map(p=>`${who(p.id||p.playerId)}: ${['alive','dead'].includes(p.status)?p.status:typeof p.alive==='boolean'?(p.alive?'alive':'dead'):'unknown'}`).join('; ')}. Historical sample, not live status.`;
 if(kind==='occupancy'&&Array.isArray(observation.rooms))return `${time}. Occupancy: ${observation.rooms.map(r=>`${r.roomId}: ${Number.isFinite(r.count)?r.count:'unknown'}`).join('; ')}. Counts only; identities unavailable.`;
 if(kind==='cameras'&&Array.isArray(observation.cameras))return `${time}. Cameras: ${observation.cameras.map(c=>`${c.roomId||c.id}: ${(c.players||[]).map(p=>who(p.id||p.playerId)).join(', ')||'no observed keepers'}`).join('; ')}. Historical camera sample.`;
 return `${time}. ${kind||'Device'} observation received; details unavailable in this client.`;
}
