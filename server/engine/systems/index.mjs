/** Executable integration surface; specialized implementations live in this directory. */
export const SYSTEM_ACTIONS=Object.freeze(['sabotage','repair','systemSabotage','systemRepair','vent']);
export function initializeSystems(state,now){state.systems={version:1,lights:{active:false},communications:{active:false},doors:[],transit:{},cooldowns:{}};}
export function systemsDeadline(){return Infinity;}
export function advanceSystems(){return false;}
export function onSystemsPhaseChange(){return false;}
export function validateSystemAction(){return {code:'UNAVAILABLE',message:'This system is unavailable.'};}
export function applySystemAction(){return false;}
export function systemActionHints(){return [];}
export function getSystemsView(state){return structuredClone(state.systems);}
export function validateSystemsState(state){if(state.systems?.version!==1)throw new Error('Invalid systems version');return true;}

