import {CHARACTERS} from '../../../shared/contracts.mjs';
export const PLAYER_ID=/^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
export function normalizeRoster({roster=CHARACTERS,mode='human',saboteurCount=1,humanPlayerIds,humanPlayerId,configurable=false}={}){
 if(!Array.isArray(roster)||roster.length<4||roster.length>15||!['human','spectator'].includes(mode))throw new TypeError('Roster requires 4 to 15 keepers.');
 const ids=new Set();const players=roster.map(p=>{if(!p||!PLAYER_ID.test(p.id)||['constructor','prototype','__proto__'].includes(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>32||/[\x00-\x1f\x7f]/.test(p.name)||!/^#[a-fA-F0-9]{6}$/.test(p.color)||typeof (p.persona??'')!=='string'||(p.persona??'').length>500)throw new TypeError('Invalid keeper definition.');ids.add(p.id);return {id:p.id,name:p.name.trim(),color:p.color,persona:p.persona??'A storm-beacon keeper.'};});
 if(!Number.isSafeInteger(saboteurCount)||saboteurCount<1||saboteurCount>3||saboteurCount*2>=players.length)throw new TypeError('Crew must begin with a majority.');
 const humans=humanPlayerIds??(mode==='human'?[humanPlayerId??players[0].id]:[]);
 if(!Array.isArray(humans)||new Set(humans).size!==humans.length||humans.some(id=>!ids.has(id))||(!configurable&&mode==='spectator'&&humans.length)||(!configurable&&mode==='human'&&!humans.length))throw new TypeError('Invalid human seats.');
 return {players,saboteurCount,humanPlayerIds:[...humans]};
}
export function publicRoster(state){return state.players.map(({id,name,color,persona})=>({id,name,color,persona:persona??'A storm-beacon keeper.'}));}
export function aiRoster(state){return publicRoster(state).filter(p=>!state.players.find(q=>q.id===p.id).human);}

