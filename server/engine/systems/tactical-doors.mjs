import {exact,time} from './model.mjs';
export const openTacticalDoor=id=>({id,closed:false,status:'open',startedAt:null,closeAt:null,deadlineAt:null});
export const doorBusy=door=>door.status!=='open';
export function validateDoorState(d,fixtures,rules,phase){
 if(!exact(d,['id','closed','status','startedAt','closeAt','deadlineAt'])||!fixtures.has(d.id)||!['open','pending','closed','jammed'].includes(d.status)||d.closed!==(d.status==='closed'))throw new Error('Invalid tactical door');
 if(d.status==='open'){
  if(d.startedAt!==null||d.closeAt!==null||d.deadlineAt!==null)throw new Error('Invalid open door clocks');
 }else if(phase!=='roam'||!time(d.startedAt)||!time(d.deadlineAt)||d.deadlineAt-d.startedAt!==rules.doorGraceMs+rules.doorDurationMs||(d.status==='pending'?(!time(d.closeAt)||d.closeAt-d.startedAt!==rules.doorGraceMs):d.closeAt!==null))throw new Error('Invalid tactical door clocks');
}
// Circle/AABB contact includes the boundary and every non-transit keeper, including an undiscovered body.
// It is used only at the scheduled closure, never in permission/hint generation.
export function thresholdOccupied(state,fixture,radius){
 return state.players.some(p=>!(state.systems.transit&&Object.hasOwn(state.systems.transit,p.id))&&p.position&&Math.hypot(p.position.x-Math.max(fixture.x,Math.min(p.position.x,fixture.x+fixture.width)),p.position.y-Math.max(fixture.y,Math.min(p.position.y,fixture.y+fixture.height)))<=radius);
}
