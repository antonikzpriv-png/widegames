import {getWorld} from '../shared/world.mjs';
import {ROOM_LAYOUT} from '../shared/contracts.mjs';
import {parseFeatures,isGhost,ABILITY_RULES as R} from '../shared/features.mjs';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const time=v=>Number.isSafeInteger(v)&&v>=0;
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const assert=(test)=>{if(!test)throw new Error('Invalid optional feature metadata');};
export function validateFeatures(room){
 if(Object.hasOwn(room,'features')){assert(exact(room.features,['deathPolicy','abilities']));parseFeatures(room.features);}
 const s=room.state;if(!s)return;
 if(!Object.hasOwn(s,'features')){
  assert(!room.features||(room.features.deathPolicy==='transfer'&&!room.features.abilities));
  assert(!Object.hasOwn(s,'effects')&&!Object.hasOwn(s,'ghostChat')&&!s.players.some(p=>Object.hasOwn(p,'ability')));return;
 }
 assert(s.schemaVersion===2&&exact(s.features,['version','deathPolicy','abilities'])&&s.features.version===1);
 const f=parseFeatures({deathPolicy:s.features.deathPolicy,abilities:s.features.abilities});
 assert(f.deathPolicy==='ghost-tasks'||f.abilities);
 if(room.features)assert(room.features.deathPolicy===f.deathPolicy&&room.features.abilities===f.abilities);
 const taskRooms=getWorld(s.mapId).ROOM_LAYOUT;
 const tasks=s.players.flatMap(p=>p.tasks||[]);
 assert(tasks.length===s.rules.tasksPerCrew*s.players.filter(p=>p.role==='crew').length&&new Set(tasks.map(t=>t.id)).size===tasks.length);
 assert(tasks.every(t=>object(t)&&/^t[a-f0-9]{20}$/.test(t.id)&&typeof t.completed==='boolean'&&taskRooms.some(r=>r.id===t.roomId)&&typeof t.label==='string'&&t.label.length<=200));
 assert(new Set(s.bodies.map(b=>b.playerId)).size===s.bodies.length&&s.bodies.every(b=>s.players.some(p=>p.id===b.playerId&&!p.alive)));
 if(f.deathPolicy==='ghost-tasks'){
  assert(Array.isArray(s.ghostChat)&&s.ghostChat.length<=R.ghostChatLimit);
  let previous=0;const counts=new Map(),last=new Map();
  for(const [i,m]of s.ghostChat.entries()){
   const sender=s.players.find(p=>p.id===m.playerId);
   assert(exact(m,['id','playerId','text','at'])&&m.id===`ghost-${i+1}`&&isGhost(s,sender)&&time(m.at)&&m.at>=previous&&m.at<=s.updatedAt&&typeof m.text==='string'&&m.text.trim()===m.text&&m.text.length>0&&m.text.length<=R.ghostChatLength&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(m.text));
   assert(!last.has(m.playerId)||m.at-last.get(m.playerId)>=R.ghostChatCooldownMs);
   previous=m.at;last.set(m.playerId,m.at);counts.set(m.playerId,(counts.get(m.playerId)||0)+1);assert(counts.get(m.playerId)<=R.ghostChatPerPlayer);
  }
 }else assert(!Object.hasOwn(s,'ghostChat'));
 if(!f.abilities){assert(!Object.hasOwn(s,'effects')&&!s.players.some(p=>Object.hasOwn(p,'ability')));return;}
 assert(s.players.filter(p=>p.ability?.type==='ward').length===1&&s.players.filter(p=>p.ability?.type==='echo').length===1);
 for(const p of s.players)if(Object.hasOwn(p,'ability'))assert(exact(p.ability,['type','readyAt'])&&['ward','echo'].includes(p.ability.type)&&p.role===(p.ability.type==='ward'?'crew':'saboteur')&&time(p.ability.readyAt));
 assert(Array.isArray(s.effects)&&s.effects.length<=2&&(s.phase==='roam'||s.effects.length===0));
 const ids=new Set(),targets=new Set(),owners=new Set();
 for(const e of s.effects){
  assert(exact(e,['id','kind','playerId','createdAt','expiresAt',e.kind==='ward'?'targetId':'position'])&&['ward','echo'].includes(e.kind)&&typeof e.id==='string'&&/^fx-[a-f0-9]{32}$/.test(e.id)&&!ids.has(e.id));ids.add(e.id);
  const actor=s.players.find(p=>p.id===e.playerId);assert(actor?.alive&&actor.ability?.type===e.kind&&time(e.createdAt)&&e.createdAt>=s.startedAt&&e.createdAt<=s.updatedAt&&e.expiresAt>s.updatedAt&&e.expiresAt===e.createdAt+(e.kind==='ward'?R.wardDurationMs:R.echoDurationMs)&&actor.ability.readyAt===e.createdAt+(e.kind==='ward'?R.wardCooldownMs:R.echoCooldownMs));
  assert(!owners.has(e.playerId));owners.add(e.playerId);
  const key=e.kind+':'+(e.kind==='ward'?e.targetId:e.playerId);assert(!targets.has(key));targets.add(key);
  if(e.kind==='ward')assert(s.players.some(p=>p.id===e.targetId&&p.alive));
  else assert(exact(e.position,['x','y'])&&Number.isFinite(e.position.x)&&Number.isFinite(e.position.y));
 }
}
