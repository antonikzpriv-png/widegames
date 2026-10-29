/** Public lobby contract. No role assignment or credential belongs here. */
import {CHARACTERS,DEFAULT_RULES} from './contracts.mjs';
export const ACTOR_ID=/^p(?:[1-9]|1[0-5])$/;
const extraNames=['Mira','Oren','Tess','Kito','Rhea','Finch','Uma','Joss','Lumi'];
const extraColors=['#73c9df','#c6a275','#a8cd79','#b6a4ed','#f09dc1','#e9cb69','#86c7a5','#d9a47f','#a8c6df'];
export const PERSONAS=Object.freeze([...CHARACTERS,...extraNames.map((name,i)=>({id:`p${i+7}`,name,color:extraColors[i],persona:`${name}, storm watch specialist ${i+7}. Observant, concise and cooperative; compare firsthand accounts before voting.`}))].map(p=>Object.freeze({...p,badge:p.id.slice(1)})));
export const SETTING_FIELDS=Object.freeze({
 capacity:[4,15,1],saboteurs:[1,3,1],tasksPerCrew:[1,8,1],speed:[90,300,1],vision:[120,600,1],
 taskCooldownMs:[1000,30000,1000],killCooldownMs:[5000,120000,1000],initialKillCooldownMs:[5000,120000,1000],
 sabotageCooldownMs:[10000,180000,1000],criticalDurationMs:[20000,180000,1000],meetingCooldownMs:[5000,120000,1000],
 discussionMs:[10000,180000,1000],votingMs:[10000,120000,1000],meetingsPerPlayer:[1,3,1],
 sabotageEnabled:'boolean',emergencyMeetingsEnabled:'boolean'
});
export const LOBBY_DEFAULTS=Object.freeze({capacity:6,saboteurs:1,tasksPerCrew:DEFAULT_RULES.tasksPerCrew,speed:180,vision:360,
 ...Object.fromEntries(['taskCooldownMs','killCooldownMs','initialKillCooldownMs','sabotageCooldownMs','criticalDurationMs','meetingCooldownMs','discussionMs','votingMs','meetingsPerPlayer'].map(k=>[k,DEFAULT_RULES[k]])),sabotageEnabled:true,emergencyMeetingsEnabled:true});
export function validateSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==Object.keys(LOBBY_DEFAULTS).length)throw Error('Invalid lobby settings');
 for(const [key,range]of Object.entries(SETTING_FIELDS)){
  const n=value[key];if(range==='boolean'?typeof n!=='boolean':!Number.isSafeInteger(n)||n<range[0]||n>range[1]||(n-range[0])%range[2]!==0)throw Error(`Invalid setting: ${key}`);
 }
 if(Object.keys(value).some(k=>!Object.hasOwn(LOBBY_DEFAULTS,k))||value.saboteurs*2>=value.capacity)throw Error('Saboteurs must be fewer than crew');
 return value;
}
export function changeSettings(current,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length||Object.keys(patch).some(k=>!Object.hasOwn(LOBBY_DEFAULTS,k)))throw Error('Unknown or empty settings');
 return validateSettings({...current,...patch});
}
export function playerName(name){
 if(typeof name!=='string')throw Error('Choose a player name');
 const normalized=name.normalize('NFKC').trim();
 if(!normalized||normalized.length>24||/[\p{Cc}\p{Cf}]/u.test(normalized))throw Error('Names must contain 1–24 visible characters');
 return normalized;
}
export function rosterFor(capacity,previous=[]){return PERSONAS.slice(0,capacity).map(p=>{const old=previous.find(q=>q.id===p.id);return {...p,...(old?{name:old.name,color:old.color}:{} )};});}
export function matchRules(settings){return Object.fromEntries(Object.keys(DEFAULT_RULES).filter(k=>Object.hasOwn(settings,k)).map(k=>[k,settings[k]]));}
