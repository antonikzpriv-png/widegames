/** Presentation helpers consume only the redacted view. */
export function canAct(game,type,pending=false){
 return !pending&&Boolean(game?.self?.alive)&&Boolean(game.availableActions?.includes(type));
}
export function localBodies(game){
 return (game?.events||[]).filter(event=>event.type==='body'&&event.bodyId&&event.roomId===game?.self?.roomId);
}
export function localTargets(game){
 return (game?.players||[]).filter(player=>player.alive&&player.id!==game?.self?.id&&player.roomId===game?.self?.roomId);
}
export function nameOf(game,id){return game?.players?.find(player=>player.id===id)?.name||id||'The watch';}
export function roomName(id){return ({bridge:'Bridge',archive:'Archive',lantern:'Lantern',galley:'Galley',engine:'Engine',workshop:'Workshop'})[id]||id||'Unknown';}
export function eventText(event,game){
 const name=id=>nameOf(game,id);
 switch(event.type){
  case 'started':return 'The keepers began their watch.';
  case 'meeting':return event.reason==='report'?`${name(event.calledBy)} reported a fallen keeper.`:event.reason==='timeout'?'The watch timer called a council.':`${name(event.calledBy)} rang the emergency bell.`;
  case 'voting':return 'Discussion closed. Voting began.';
  case 'vote_result':return event.ejectedId?`${name(event.ejectedId)} was ejected.`:'No keeper was ejected.';
  case 'ejected':return `${name(event.playerId)} was ejected.`;
  case 'eliminated':return `${name(event.playerId)} fell during the watch.`;
  case 'body':return `${name(event.playerId)} was found in ${roomName(event.roomId)}.`;
  case 'witness':return `You saw ${name(event.playerId)} eliminate ${name(event.targetId)} in ${roomName(event.roomId)}.`;
  case 'sabotage':return `Critical sabotage in ${roomName(event.roomId)}.`;
  case 'repair':return `${name(event.playerId)} contributed a repair.`;
  case 'repaired':return 'The critical system is repaired.';
  case 'said':return `${name(event.playerId)}: ${event.text||''}`;
  case 'ended':return `${event.winner==='crew'?'Crew':'Saboteur'} victory: ${outcomeText(event.reason)}`;
  case 'paused':return 'Maximum watch duration reached. No winner was manufactured.';
  case 'action':return `${name(event.playerId)} · ${event.action?.type||'action'}${event.action?.roomId?` → ${roomName(event.action.roomId)}`:''}${event.action?.targetId?` → ${event.action.targetId==='skip'?'Skip':name(event.action.targetId)}`:''}${event.action?.text?`: ${event.action.text}`:''}`;
  case 'role_reveal':return `Roles revealed: ${(event.players||[]).map(p=>`${name(p.id)} · ${p.role}`).join(', ')}`;
  case 'tasks_reassigned':return `${name(event.playerId)}'s unfinished tasks were reassigned.`;
  default:return String(event.type||'Watch event').replaceAll('_',' ');
 }
}
export function outcomeText(reason){return ({tasks:'Every crew task is complete.',ejection:'The saboteur has been ejected.',parity:'The saboteur reached parity with the crew.',critical:'The critical system was not repaired in time.'})[reason]||String(reason||'The watch is over.');}
export function replayEvents(data){const events=Array.isArray(data)?data:Array.isArray(data?.replay)?data.replay:Array.isArray(data?.events)?data.events:null;if(!events)throw new Error('The replay response is incomplete.');return events;}
export function aiNotice(reason){
 return ({demo_configured:'Demo mode: the keepers use local behavior.',missing_credentials:'Demo mode: live AI is not configured.',budget_calls:'Demo mode: this match reached its AI call limit.',budget_tokens:'Demo mode: this match reached its AI token limit.',budget_cost:'Demo mode: this match reached its AI spending limit.',provider_unavailable:'Demo mode: the live AI provider is unavailable.',timeout:'Demo mode: the live AI provider did not respond in time.',reservation_failed:'Demo mode: AI spending could not be reserved.'})[reason]||'Demo mode: live AI is unavailable for this watch.';
}
