import {getMap} from '../../shared/maps/index.mjs';
export const mapReference=room=>room?.game?.map??room?.game?.mapId??room?.map??room?.mapId;
export const mapKey=reference=>{const map=reference===undefined||typeof reference==='string'?getMap(reference):reference;return JSON.stringify([map?.id,map?.version]);};
export function roomName(map,id){return map.roomLayout.find(room=>room.id===id)?.name||id||'Between rooms';}
export function equipmentOwner(room){const g=room?.game;return JSON.stringify([room?.roomId,g?.matchId,mapKey(mapReference(room)),g?.self?.id,g?.phase,g?.self?.alive]);}
export function resolveViewMap(room){return getMap(mapReference(room));}
