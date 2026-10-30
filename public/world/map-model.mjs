import {getMap,mapIdentity} from '../../shared/maps/index.mjs';
export const mapReference=room=>room?.game?.map!==undefined?room.game.map:room?.game?.mapId!==undefined||room?.game?.mapRevision!==undefined?{mapId:room.game.mapId??'beacon',revision:room.game.mapRevision??1}:room?.map!==undefined?room.map:room?.mapId!==undefined||room?.mapRevision!==undefined?{mapId:room.mapId??'beacon',revision:room.mapRevision??1}:undefined;
export const mapKey=reference=>mapIdentity(reference);
export function roomName(map,id){return map.roomLayout.find(room=>room.id===id)?.name||id||'Between rooms';}
export function equipmentOwner(room){const g=room?.game;return JSON.stringify([room?.roomId,g?.matchId,mapKey(mapReference(room)),g?.self?.id,g?.phase,g?.self?.alive]);}
export function resolveViewMap(room){return getMap(mapReference(room));}
