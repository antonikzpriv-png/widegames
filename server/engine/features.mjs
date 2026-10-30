import {randomBytes} from 'node:crypto';
import {parseFeatures,isGhost,ABILITY_RULES as R} from '../../shared/features.mjs';
export {isGhost};
export const canWorldAct=(state,p)=>!!p&&(p.alive||isGhost(state,p));
export function initializeFeatures(state,options,random){
 if(options===undefined)return;
 const config=parseFeatures(options);
 if(config.deathPolicy==='transfer'&&!config.abilities)return;
 if(![2,3,4,5].includes(state.schemaVersion))throw new TypeError('Optional features require a world match');
 state.features={version:1,...config};
 if(config.deathPolicy==='ghost-tasks')state.ghostChat=[];
 if(config.abilities){
  state.effects=[];
  const crew=state.players.filter(p=>p.role==='crew'),guardian=crew[random(crew.length)];
  guardian.ability={type:'ward',readyAt:state.startedAt};
  state.players.find(p=>p.role==='saboteur').ability={type:'echo',readyAt:state.startedAt};
 }
}
export const nextEffectAt=state=>Math.min(Infinity,...(state.effects||[]).map(e=>e.expiresAt));
export function clearEffects(state,at,reason,record,predicate=()=>true){
 if(!state.effects)return;
 const removed=state.effects.filter(predicate);state.effects=state.effects.filter(e=>!predicate(e));
 for(const effect of removed)record(state,'effect_ended',at,{effectId:effect.id,kind:effect.kind,reason});
}
export function featureDenial(state,p,a,now,world){
 const fail=(code,message)=>({code,message});
 if(a.type==='ghostSay'){
  if(!isGhost(state,p))return fail('GHOST_ONLY','Only fallen keepers can use fallen chat.');
  if(!a.text.trim()||a.text.length>R.ghostChatLength||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(a.text))return fail('INVALID_TEXT','Invalid fallen message.');
  const own=state.ghostChat.filter(m=>m.playerId===p.id);
  if(state.ghostChat.length>=R.ghostChatLimit||own.length>=R.ghostChatPerPlayer)return fail('MESSAGE_LIMIT','Fallen chat limit reached.');
  if(own.length&&now<own.at(-1).at+R.ghostChatCooldownMs)return fail('COOLDOWN','Fallen chat is cooling down.');
  return null;
 }
 if(!['protect','decoy'].includes(a.type))return undefined;
 if(!p.alive||!state.features?.abilities||p.ability?.type!==(a.type==='protect'?'ward':'echo'))return fail('ABILITY_UNAVAILABLE','This ability is unavailable.');
 if(state.phase!=='roam')return fail('WRONG_PHASE','Abilities require roaming.');
 if(now<p.ability.readyAt)return fail('COOLDOWN','Ability is cooling down.');
 if(a.type==='protect'){
  const target=state.players.find(q=>q.id===a.targetId);
  // All living factions are equally valid targets, including self. Never probe role.
  if(!target?.alive||!world.nearby(p.position,target.position,R.wardRange))return fail('INVALID_TARGET','Choose a nearby living keeper in sight.');
  if(state.effects.some(e=>e.kind==='ward'&&e.targetId===target.id))return fail('EFFECT_ACTIVE','That keeper already has a ward.');
 }else{
  if(!world.walkable(a)||!world.nearby(p.position,a,R.echoRange))return fail('INVALID_DESTINATION','Place the echo on nearby visible deck.');
  if(state.effects.some(e=>e.kind==='echo'&&e.playerId===p.id))return fail('EFFECT_ACTIVE','Your signal echo is already active.');
 }
 return null;
}
export function activateFeature(state,p,a,now,record){
 if(a.type==='ghostSay'){
  state.ghostChat.push({id:`ghost-${state.ghostChat.length+1}`,playerId:p.id,text:a.text.trim(),at:now});
  // Private chat stays out of every public event and the role-revealed replay.
  return true;
 }
 if(!['protect','decoy'].includes(a.type))return false;
 const kind=a.type==='protect'?'ward':'echo';
 const effect={id:'fx-'+randomBytes(16).toString('hex'),kind,playerId:p.id,createdAt:now,expiresAt:now+(kind==='ward'?R.wardDurationMs:R.echoDurationMs),...(kind==='ward'?{targetId:a.targetId}:{position:{x:a.x,y:a.y}})};
 state.effects.push(effect);p.ability.readyAt=now+(kind==='ward'?R.wardCooldownMs:R.echoCooldownMs);
 record(state,'effect_started',now,{...structuredClone(effect),effectId:effect.id});return true;
}
export function safeEffects(state,p,world,now){
 return (state.effects||[]).filter(e=>e.expiresAt>now).flatMap(e=>{
  const target=e.kind==='ward'?state.players.find(q=>q.id===e.targetId):null;
  const position=target?.position||e.position;
  if((p||world.observerOrigin)&&!world.sees(p?.position??world.observerOrigin,position))return [];
  return [{id:e.id,kind:e.kind,expiresAt:e.expiresAt,...(target?{targetId:target.id}:{position:structuredClone(position),label:'Signal echo · distraction'})}];
 });
}
