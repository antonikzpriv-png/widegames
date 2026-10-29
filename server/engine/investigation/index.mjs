export const INVESTIGATION_ACTIONS=Object.freeze(['investigate','deviceCancel']);
export function initializeInvestigation(state){state.investigation={version:1,sessions:{},observations:{},cooldowns:{}};}
export function investigationDeadline(){return Infinity;}
export function advanceInvestigation(){return false;}
export function onInvestigationPhaseChange(){return false;}
export function validateInvestigationAction(){return {code:'UNAVAILABLE',message:'The terminal is unavailable.'};}
export function applyInvestigationAction(){return false;}
export function investigationActionHints(){return [];}
export function getInvestigationView(){return {devices:[],session:null,observations:[],status:'available'};}
export function validateInvestigationState(state){if(state.investigation?.version!==1)throw new Error('Invalid investigation version');return true;}

