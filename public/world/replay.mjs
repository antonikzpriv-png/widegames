/** Attributed world motion wording, used only with ended safe views and replay. */
import {replayText} from '../presentation.mjs';
export function worldReplayText(event,game){
 const actor=id=>{const p=game.players.find(p=>p.id===id);return `${p?.name||id||'Keeper'}${game.phase==='ended'&&p?.role?` (${p.role})`:''}`;};
 const direction=(dx,dy)=>`${dy<0?'north':dy>0?'south':''}${dx<0?'west':dx>0?'east':''}`;
 if(event.type==='direction')return `${actor(event.playerId)} ${event.dx||event.dy?`steered ${direction(event.dx,event.dy)} across the deck`:'stopped walking'}.`;
 if(event.type==='motion')return `${actor(event.playerId)} ${({arrived:'reached the walking destination',lease_expired:'stopped when the movement lease expired',blocked:'stopped at a blocked route',meeting:'stopped for council',death:'fell on the deck',ended:'stopped as the watch ended'})[event.reason]||'was observed moving on the deck'}.`;
 if(event.type==='action'&&event.action?.type==='navigate')return `${actor(event.playerId)} set a walking destination on the beacon.`;
 return replayText(event,game);
}
