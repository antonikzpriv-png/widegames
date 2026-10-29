/** Stable wire/rules constants; no server secrets in this module. */
export const PROTOCOL_VERSION = 1;
export const PHASES = Object.freeze(['lobby','roam','discussion','voting','ended','paused']);
export const ACTION_TYPES = Object.freeze(['move','task','sabotage','repair','eliminate','report','meeting','say','vote','wait']);
export const ROOM_LAYOUT = Object.freeze([
  {id:'bridge',name:'Bridge',x:50,y:15,neighbors:['archive','lantern','workshop'],description:'The storm chart and emergency bell.'},
  {id:'archive',name:'Archive',x:15,y:34,neighbors:['bridge','galley'],description:'Weather logs and signal records.'},
  {id:'lantern',name:'Lantern',x:85,y:34,neighbors:['bridge','engine'],description:'Keep the beacon burning.'},
  {id:'galley',name:'Galley',x:15,y:78,neighbors:['archive','workshop'],description:'Provisions and freshwater filters.'},
  {id:'engine',name:'Engine',x:85,y:78,neighbors:['lantern','workshop'],description:'The turbines beneath the deck.'},
  {id:'workshop',name:'Workshop',x:50,y:64,neighbors:['bridge','galley','engine'],description:'Tools, relays and spare parts.'}
]);
export const CHARACTERS = Object.freeze([
  {id:'p1',name:'Iona',color:'#edb66c',persona:'Practical engineer. Specific, measured, values a clear route and a working beacon.'},
  {id:'p2',name:'Pax',color:'#8fc8bc',persona:'Curious cartographer. Notices movement and asks precise questions.'},
  {id:'p3',name:'Vale',color:'#d5a3cf',persona:'Patient medic. Encourages cooperation but challenges contradictions.'},
  {id:'p4',name:'Nori',color:'#9fb7ed',persona:'Skeptical archivist. Compares claims against firsthand observations.'},
  {id:'p5',name:'Bram',color:'#d7c780',persona:'Blunt quartermaster. Suspicious of excuses, loyal when convinced.'},
  {id:'p6',name:'Sable',color:'#e99a88',persona:'Wry signal keeper. Concise, observant, willing to bluff if compromised.'}
]);
export const DEFAULT_RULES = Object.freeze({
  moveCooldownMs:1200,taskCooldownMs:4000,killCooldownMs:22000,initialKillCooldownMs:18000,
  sabotageCooldownMs:65000,criticalDurationMs:75000,discussionMs:30000,votingMs:20000,
  meetingCooldownMs:35000,meetingsPerPlayer:1,tasksPerCrew:3,roamDeadlineMs:240000,
  maxMatchMs:900000,messageMaxLength:280,messagesPerDiscussion:3
});
export function actionError(code,message){return {code,message};}
