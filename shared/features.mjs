/** Optional world presets. Faction stays in player.role; powers are separate. */
export const ABILITY_RULES=Object.freeze({wardRange:140,wardDurationMs:8000,wardCooldownMs:35000,echoRange:240,echoDurationMs:6000,echoCooldownMs:25000,ghostChatLimit:120,ghostChatPerPlayer:20,ghostChatLength:280,ghostChatCooldownMs:2000});
export function parseFeatures(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.keys(value).some(k=>!['deathPolicy','abilities'].includes(k)))throw new TypeError('Invalid feature configuration');
 const {deathPolicy='transfer',abilities=false}=value;
 if(!['transfer','ghost-tasks'].includes(deathPolicy)||typeof abilities!=='boolean')throw new TypeError('Invalid feature configuration');
 return {deathPolicy,abilities};
}
export const ghostEnabled=state=>state.features?.deathPolicy==='ghost-tasks';
export const isGhost=(state,player)=>ghostEnabled(state)&&player?.alive===false;
export const canWorldAct=(state,player)=>!!player&&(player.alive||isGhost(state,player));
export const canViewAct=game=>!!game?.self&&(game.self.alive||game.self.ghost===true);
