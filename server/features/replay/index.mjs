/** Snapshots remain private until the engine has resolved the match. */
export function captureReplaySnapshot(state,at){
 const entries=state.replaySnapshots??=[];const last=entries.at(-1);if(last&&at-last.at<5000&&state.phase!=='ended')return false;
 if(last?.at===at&&last.phase===state.phase)return false;
 entries.push({version:1,...(state.tacticalVersion===1?{map:{...state.map}}:{}),at,phase:state.phase,players:state.players.map(p=>({id:p.id,position:{...p.position},roomId:p.roomId,alive:p.alive})),doors:structuredClone(state.systems?.doors??[]),lights:!!state.systems?.lights?.active,tasks:{completed:state.players.flatMap(p=>p.tasks).filter(t=>t.completed).length,total:state.players.flatMap(p=>p.tasks).length}});
 if(entries.length>256)entries.splice(1,entries.length-256);return true;
}
export function getReplaySnapshots(state){return state.phase==='ended'?structuredClone(state.replaySnapshots??[]):null;}

