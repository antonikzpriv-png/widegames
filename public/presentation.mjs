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
  case 'repair':return `Critical repair progress: ${event.repairsCompleted||1} contribution${event.repairsCompleted===1?'':'s'}.`;
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
export function aiLabel(ai){
 if(ai?.mode==='live'&&ai.strategy==='strategic')return 'Strategic: model plans / local execution';
 if(ai?.mode==='live')return 'Hybrid: live council / local navigation';
 if(ai?.mode==='demo')return 'Demo: local bots';
 return 'AI mode pending';
}
/** Ended-match replay has its own wording; the viewer did not witness every event. */
export function replayText(event,game){
 const actor=id=>{
  const player=game?.players?.find(p=>p.id===id);
  const role=game?.phase==='ended'&&['crew','saboteur'].includes(player?.role)?` (${player.role})`:'';
  return `${nameOf(game,id)}${role}`;
 };
 const ballot=vote=>vote.targetId==='skip'?`${actor(vote.playerId)} voted to skip ejection.`:vote.targetId?`${actor(vote.playerId)} voted to eject ${actor(vote.targetId)}.`:`${actor(vote.playerId)} cast a vote; its target is not revealed.`;
 if(event.type==='action'){
  const action=event.action||{},name=actor(event.playerId);
  switch(action.type){
   case 'vote':return ballot({playerId:event.playerId,targetId:action.targetId});
   case 'say':return `${name} said: ${action.text||''}`;
   case 'move':return `${name} moved to ${roomName(action.roomId)}.`;
   case 'task':return `${name} completed task ${action.taskId}.`;
   case 'eliminate':return `${name} eliminated ${actor(action.targetId)}.`;
   case 'sabotage':return `${name} triggered critical sabotage.`;
   case 'repair':return `${name} contributed a critical repair.`;
   case 'report':return `${name} reported ${action.bodyId?.startsWith('body-')?actor(action.bodyId.slice(5)):action.bodyId||'a fallen keeper'}.`;
   case 'meeting':return `${name} rang the emergency bell.`;
   case 'wait':return `${name} waited.`;
   default:return `${name} acted: ${action.type||'unknown action'}.`;
  }
 }
 if(event.type==='witness')return `${actor(event.playerId)} eliminated ${actor(event.targetId)} in ${roomName(event.roomId)}.${Array.isArray(event.visibleTo)&&event.visibleTo.length?` Observed by: ${event.visibleTo.map(actor).join(', ')}.`:''}`;
 if(event.type==='vote_result')return `${event.ejectedId?`${actor(event.ejectedId)} was ejected.`:'No keeper was ejected.'}${event.votes?.length?` Ballots: ${event.votes.map(ballot).join(' ')}`:' No ballots were cast.'}`;
 if(event.type==='role_reveal')return `Roles revealed: ${(event.players||[]).map(p=>`${nameOf(game,p.id)} (${p.role})`).join(', ')}.`;
 if(event.type==='started')return `The keepers began their watch.${event.roles?.length?` Revealed assignments: ${event.roles.map(p=>`${nameOf(game,p.id)} (${p.role})`).join(', ')}.`:''}`;
 if(event.type==='ejected')return `${actor(event.playerId)} was ejected.`;
 if(event.type==='tasks_reassigned')return `${actor(event.playerId)}'s unfinished tasks were reassigned.${event.assignments?.length?` ${event.assignments.map(a=>`${a.taskId} to ${actor(a.playerId)}`).join('; ')}.`:''}`;
 return eventText(event,game);
}
