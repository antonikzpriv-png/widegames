import {canWorldAct} from '../features.mjs';
import {exact,time} from './model.mjs';
export const openTacticalDoor=id=>({id,closed:false,status:'open',startedAt:null,closeAt:null,deadlineAt:null});
export const doorBusy=door=>door.status!=='open';
export function validateDoorState(d,fixtures,rules,phase){
 if(!exact(d,['id','closed','status','startedAt','closeAt','deadlineAt'])||!fixtures.has(d.id)||!['open','pending','closed','jammed'].includes(d.status)||d.closed!==(d.status==='closed'))throw new Error('Invalid tactical door');
 if(d.status==='open'){
  if(d.startedAt!==null||d.closeAt!==null||d.deadlineAt!==null)throw new Error('Invalid open door clocks');
 }else if(phase!=='roam'||!time(d.startedAt)||!time(d.deadlineAt)||d.deadlineAt-d.startedAt!==rules.doorGraceMs+rules.doorDurationMs||(d.status==='pending'?(!time(d.closeAt)||d.closeAt-d.startedAt!==rules.doorGraceMs):d.closeAt!==null))throw new Error('Invalid tactical door clocks');
}
// Circle/AABB contact includes living keepers, authorized physical task ghosts and unreported bodies.
// Other dead-player coordinates remain historical, not physical occupants.
// It is used only at the scheduled closure, never in permission/hint generation.
export function thresholdOccupied(state,fixture,radius){
 const inTransit=id=>state.systems.transit&&Object.hasOwn(state.systems.transit,id);
 const positions=state.players.filter(p=>canWorldAct(state,p)&&!inTransit(p.id)).map(p=>p.position);
 positions.push(...(state.bodies??[]).filter(body=>body.reported===false&&state.players.some(p=>p.id===body.playerId&&!p.alive)&&!inTransit(body.playerId)).map(body=>body.position));
 return positions.some(p=>p&&Math.hypot(p.x-Math.max(fixture.x,Math.min(p.x,fixture.x+fixture.width)),p.y-Math.max(fixture.y,Math.min(p.y,fixture.y+fixture.height)))<=radius);
}
