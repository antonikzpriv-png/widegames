/** Attributed world motion wording, used only with ended safe views and replay. */
import {replayText} from '../presentation.mjs';
export function worldReplayText(event,game){
 const actor=id=>{const p=game.players.find(p=>p.id===id);return `${p?.name||id||'Keeper'}${game.phase==='ended'&&p?.role?` (${p.role})`:''}`;};
 const direction=(dx,dy)=>`${dy<0?'north':dy>0?'south':''}${dx<0?'west':dx>0?'east':''}`;
 if(event.type==='action'&&event.action?.type==='taskStep')return `${actor(event.playerId)} confirmed ${['wires','tuning','sequence','pressure','repair'].includes(event.taskProgress?.kind)?event.taskProgress.kind:'equipment'} step ${Number.isInteger(event.action.step)?event.action.step+1:'(recorded)'}.`;
 if(event.type==='effect_started')return `${actor(event.playerId)} activated ${event.kind==='ward'?'Harbor Ward':'Signal Echo'}${event.targetId?' for '+actor(event.targetId):''}.`;
 if(event.type==='effect_ended')return `${event.kind==='ward'?'Harbor Ward':'Signal Echo'} ended (${event.reason}).`;
 if(event.type==='attack_blocked')return `Harbor Ward absorbed ${actor(event.playerId)}’s attack on ${actor(event.targetId)}. No keeper fell.`;
 if(event.type==='action'&&['protect','decoy'].includes(event.action?.type))return `${actor(event.playerId)} used ${event.action.type==='protect'?'Harbor Ward':'Signal Echo'}.`;
 if(event.type==='direction')return `${actor(event.playerId)} ${event.dx||event.dy?`steered ${direction(event.dx,event.dy)} across the deck`:'stopped walking'}.`;
 if(event.type==='motion')return `${actor(event.playerId)} ${({arrived:'reached the walking destination',lease_expired:'stopped when the movement lease expired',blocked:'stopped at a blocked route',meeting:'stopped for council',death:'fell on the deck',ended:'stopped as the watch ended'})[event.reason]||'was observed moving on the deck'}.`;
 if(event.type==='action'&&event.action?.type==='navigate')return `${actor(event.playerId)} set a walking destination on the beacon.`;
 return replayText(event,game);
}
