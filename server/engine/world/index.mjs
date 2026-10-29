import {worldRuntime} from '../world-runtime.mjs';
/** Spatial factory interface. Builder owns this directory; legacy runtime stays immutable. */
export function createSpatialWorld(geometry){
 const base=worldRuntime(geometry);
 return {...base,observe(){return false;},projectWorld(state,viewerId,now){const p=state.players.find(p=>p.id===viewerId);return {players:state.players.map(q=>({id:q.id,name:q.name,color:q.color,alive:q.alive,roomId:!p||q.id===p.id||base.sees(p.position,q.position)?q.roomId:null,position:!p||q.id===p.id||base.sees(p.position,q.position)?structuredClone(q.position):null,...(state.phase==='ended'?{role:q.role}:{})})),localEvents:[],vision:{radius:state.beaconRules.visionRadius}};}};
}

