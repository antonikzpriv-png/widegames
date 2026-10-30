import {TASK_CATALOG,TASK_ORDER} from '../../shared/task-catalog.mjs';
import {PERSONAS,validateSettings,ACTOR_ID,matchRules} from '../../shared/lobby.mjs';
import {TASK_KINDS,taskProgress,stepError,advanceTask,interruptTasks} from './tasks.mjs';
import {initializeFeatures,isGhost,canWorldAct,nextEffectAt,clearEffects,featureDenial,activateFeature,safeEffects} from './features.mjs';
import {checkpointReplay,replayMetadata} from './replay-history.mjs';
import { randomBytes, createHash } from 'node:crypto';
import { CHARACTERS, ROOM_LAYOUT, DEFAULT_RULES, ACTION_TYPES } from '../../shared/contracts.mjs';
import {worldRuntime} from './world-runtime.mjs';
import {copyState} from './state-copy.mjs';
import {createSpatialWorld} from './world/index.mjs';
import * as systemsModule from './systems/index.mjs';
import * as investigationModule from './investigation/index.mjs';
import {BEACON_ACTION_FIELDS,DEFAULT_BEACON_RULES} from '../../shared/beacon.mjs';
import {normalizeRoster} from '../features/lobbies/index.mjs';
import {createStationChallenge} from '../../shared/station-challenges.mjs';
import {STATION_TASK_KINDS} from '../../shared/station-contract.mjs';
import {taskService} from '../features/tasks/index.mjs';
import {abilityService,getAbilityView,deathPolicy} from '../features/abilities/index.mjs';
import {captureReplaySnapshot,getReplaySnapshots as replaySnapshots} from '../features/replay/index.mjs';
import {getMap,getLegacyMap,mapIdentity,MAP_CATALOG} from '../../shared/maps/index.mjs';
import {TACTICAL_PRESET,DEFAULT_TACTICAL_BEACON_RULES} from '../../shared/tactical.mjs';
const geometry=await import(process.env.WORLD_ENGINE_GEOMETRY_MODULE||'../../shared/world.mjs');
const worldEngine=worldRuntime(geometry),spatialEngine=createSpatialWorld(geometry);
const isWorld=state=>[2,3,4,5].includes(state.schemaVersion)&&state.worldVersion===1;
const isBeacon=state=>[3,4,5].includes(state.schemaVersion)&&state.beaconVersion===1;
const stepTask=(state,t)=>!!t&&isWorld(state)&&!t.challenge&&(state.schemaVersion===2||[1,2,3].includes(t.progress?.v)||t.edition===3);
const featureWorld=(state,p)=>{const w=runtime(state);return {...w,sees:(a,b)=>isBeacon(state)?w.sees(a,b,state,p?.id??null):w.sees(a,b,state.lobbySettings?.vision),nearby:(a,b,r)=>w.nearby(a,b,Math.min(r,state.lobbySettings?.vision??r),state,p?.id??null),walkable:a=>isBeacon(state)?w.walkable(a,state):w.walkable(a),observerOrigin:isBeacon(state)?w.projectWorld(state,p?.id??null,state.updatedAt).vision.origin:null};};
const ownEntry=(map,id)=>map&&Object.hasOwn(map,id)?map[id]:undefined;
const mapRuntimes=new Map();
const mapGeometry=state=>state.map?getMap(state.map).geometry:state.mapId&&state.mapId!=='beacon'||state.mapRevision===2?getLegacyMap(state.mapId??'beacon',state.mapRevision??1).geometry:geometry;
const layoutFor=state=>state.map?getMap(state.map).roomLayout:state.mapId&&state.mapId!=='beacon'||state.mapRevision===2?getLegacyMap(state.mapId??'beacon',state.mapRevision??1).roomLayout:ROOM_LAYOUT;
const spatialFor=state=>{if(!state.map)return spatialEngine;const map=getMap(state.map),key=mapIdentity(map);if(!mapRuntimes.has(key))mapRuntimes.set(key,createSpatialWorld(map.geometry));return mapRuntimes.get(key);};
const legacyRuntimes=new Map();
const worldFor=state=>{const id=state.mapId??'beacon',revision=state.mapRevision??1;if(id==='beacon'&&revision===1)return worldEngine;const map=getLegacyMap(id,revision),key=mapIdentity(map);if(!legacyRuntimes.has(key))legacyRuntimes.set(key,worldRuntime(map.geometry));return legacyRuntimes.get(key);};
const runtime=state=>isBeacon(state)?spatialFor(state):worldFor(state);
const preparedNavigation=new Set();
/** Warm immutable navigation before accepting players; no match/AI state exists here. */
export function prepareNavigation(references=MAP_CATALOG.map(({id,version})=>({id,version}))){
 if(!Array.isArray(references)||references.length>8)throw new TypeError('Invalid navigation preparation');
 const result=[];for(const reference of references){const map=getMap(reference),key=mapIdentity(map);let warmed=false;if(!preparedNavigation.has(key)){const g=map.geometry,start=g.worldSpawn('p1'),target=Object.values(g.WORLD_STATIONS).sort((a,b)=>g.distance(start,b)-g.distance(start,a))[0];const state={map:{id:map.id,version:map.version},systems:{doors:[],transit:{}}};const route=map.tactical!==false?spatialFor(state).navigation({id:'prepare',alive:true,position:start},target,0,state):worldFor({mapId:map.legacyMapId??map.id,mapRevision:map.legacyRevision??1}).navigation({id:'prepare',alive:true,position:start},target,0);if(!route)throw new Error('Registered map navigation is unavailable');preparedNavigation.add(key);warmed=true;}result.push({id:map.id,version:map.version,warmed});}return result;
}

const nearby=(state,p,target,range=mapGeometry(state).WORLD.interactionRadius)=>runtime(state).nearby(p.position,target,range,state,p.id);
const sees=(state,p,target)=>isBeacon(state)?runtime(state).sees(p.position,target,state,state.players.includes(p)?p.id:null):runtime(state).sees(p.position,target,state.lobbySettings?.vision);
const context=state=>({record,publicEvent,nearby,sees,geometry:mapGeometry(state),stop:(s,p,at,reason)=>runtime(s).stop(s,p,at,reason,record)});
function refreshKnowledge(state,at){if(!isBeacon(state))return false;return runtime(state).observe(state,at,record)||false;}
function featureHints(state,p,now){
 if(!isBeacon(state)||!canWorldAct(state,p)||state.phase!=='roam'||ownEntry(state.systems.transit,p.id))return [];
 const ctx=context(state),hints=p.alive?[...systemsModule.systemActionHints(state,p,now,ctx),...investigationModule.investigationActionHints(state,p,now,ctx),...abilityService.hints(state,p,now,ctx)]:[];
 // Task descriptors advertise opening the equipment panel, not bypassing its steps.
 const add=(type,fields,label,position)=>{if(!denial(state,p,{id:'hint',type,...fields},now,true))hints.push({id:type+':'+Object.values(fields).join(':'),type,fields,label,enabled:true,...(position?{position:clone(position)}:{})});};
 for(const task of p.tasks)add('task',{taskId:task.id},task.label,runtime(state).station(task.roomId));
 if(!p.alive)return hints;
 if(p.ability?.type==='ward')for(const target of [p,...state.players.filter(q=>q.id!==p.id)])add('protect',{targetId:target.id},'Harbor Ward for '+target.name,target.position);
 if(p.ability?.type==='echo')add('decoy',{x:p.position.x,y:p.position.y},'Signal Echo at your position',p.position);
 for(const target of state.players)add('eliminate',{targetId:target.id},'Eliminate '+target.name,target.position);
 for(const body of state.bodies)add('report',{bodyId:body.id},'Report fallen keeper',body.position);
 add('meeting',{},'Emergency bell',runtime(state).bell);return hints;
}


const MAX_REQUESTS = 2048;
const MAX_EVENTS = 256;
const MAX_REPLAY = 12000;
const roomIds = ROOM_LAYOUT.map(r => r.id);
const fields = {move:['roomId'],task:['taskId'],eliminate:['targetId'],report:['bodyId'],say:['text'],vote:['targetId'],sabotage:[],repair:[],meeting:[],wait:[],navigate:['x','y'],taskStep:['taskId','step','input'],ghostSay:['text'],protect:['targetId'],decoy:['x','y'],...BEACON_ACTION_FIELDS};
const clone = value => structuredClone(value);
// Tactical modules retain the proven generic copy; legacy plain records use main's
// independent deep copier. Never share caller-owned history or mutable knowledge.
const copyEngineState = state => isBeacon(state) ? clone(state) : copyState(state);
const fail = (code, message) => ({code,message});
const finiteTime = n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
function publicEvent(state,type,at,data={}) {
  const event={type,at,...data,id:`e${++state.sequence}`};
  state.events.push(event);
  if (state.events.length>MAX_EVENTS) state.events.shift();
}
function record(state,type,at,data={}) {
  const sequence=++state.replaySequence,id=`r${sequence}`;
  const event=isBeacon(state)?{...data,id,type,at,eventVersion:1,sequence}:{id,type,at,...data,sequence};
  state.replayBytes=(state.replayBytes??state.replay.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0))+Buffer.byteLength(JSON.stringify(event));state.replay.push(event);
  while(state.replay.length>MAX_REPLAY||state.replayBytes>2*1024*1024)state.replayBytes-=Buffer.byteLength(JSON.stringify(state.replay.shift()));
}
function end(state,winner,reason,at) {
  clearEffects(state,at,'ended',record);
  if(isBeacon(state)){systemsModule.onSystemsPhaseChange(state,'ended',at,context(state));investigationModule.onInvestigationPhaseChange(state,'ended',at,context(state));}
  if(isWorld(state))runtime(state).stopAll(state,at,'ended',record);
  state.phase='ended'; state.deadlineAt=null; state.outcome={winner,reason,at};
  publicEvent(state,'ended',at,{winner,reason}); record(state,'ended',at,{winner,reason});
  record(state,'role_reveal',at,{players:state.players.map(p=>({id:p.id,role:p.role}))});
}
function victory(state,at) {
  if (state.phase==='ended' || state.phase==='paused') return;
  const living=state.players.filter(p=>p.alive);
  if (!living.some(p=>p.role==='saboteur')) return end(state,'crew','ejection',at);
  if (living.filter(p=>p.role==='saboteur').length >= living.filter(p=>p.role==='crew').length) return end(state,'saboteur','parity',at);
  const tasks=state.players.flatMap(p=>p.tasks);
  if (tasks.length && tasks.every(t=>t.completed)) end(state,'crew','tasks',at);
}
function startMeeting(state,calledBy,reason,bodyId,at) {
  clearEffects(state,at,'meeting',record);interruptTasks(state);
  if(isWorld(state))runtime(state).stopAll(state,at,'meeting',record);
  if(isBeacon(state)){
    systemsModule.onSystemsPhaseChange(state,'discussion',at,context(state));
    investigationModule.onInvestigationPhaseChange(state,'discussion',at,context(state));
    for(const victim of state.players.filter(q=>!q.alive))transferTasks(state,victim,at);
  }
  state.phase='discussion'; state.deadlineAt=at+state.rules.discussionMs;
  state.meeting={id:`m${++state.meetingCount}`,calledBy,reason,bodyId,deadlineAt:state.deadlineAt,messages:[],votes:[],eligibleVoters:state.players.filter(p=>p.alive).map(p=>p.id),tallied:false};
  publicEvent(state,'meeting',at,{calledBy,reason,bodyId}); record(state,'meeting',at,{calledBy,reason,bodyId});
}
function resume(state,at) {
  state.phase='roam'; state.deadlineAt=at+state.rules.roamDeadlineMs;
  for (const p of state.players) p.cooldowns.meetingAt=Math.max(p.cooldowns.meetingAt,at+state.rules.meetingCooldownMs);
}
function transferTasks(state,victim,at) {
  clearEffects(state,at,'death',record,e=>e.playerId===victim.id||e.targetId===victim.id);interruptTasks({players:[victim]});if(isGhost(state,victim))return;
  const crew=state.players.filter(p=>p.alive && p.role==='crew');
  if (!crew.length || (isBeacon(state)&&!deathPolicy(state).redistribute)) return;
  const unfinished=victim.tasks.filter(t=>!t.completed);
  victim.tasks=victim.tasks.filter(t=>t.completed);
  unfinished.forEach((t,i)=>crew[i%crew.length].tasks.push(t));
  record(state,'tasks_reassigned',at,{playerId:victim.id,assignments:unfinished.map(t=>({taskId:t.id,playerId:crew.find(p=>p.tasks.includes(t)).id}))});
}
function tally(state,at) {
  state.meeting.tallied=true;
  const counts=new Map();
  for (const v of state.meeting.votes) counts.set(v.targetId,(counts.get(v.targetId)||0)+1);
  const sorted=[...counts].sort((a,b)=>b[1]-a[1]);
  const target=sorted.length && (sorted.length===1 || sorted[0][1]>sorted[1][1]) ? sorted[0][0] : null;
  const ejectedId=target && target!=='skip'?target:null;
  publicEvent(state,'vote_result',at,{votes:clone(state.meeting.votes),ejectedId});
  record(state,'vote_result',at,{votes:clone(state.meeting.votes),ejectedId});
  if (ejectedId) {
    const p=state.players.find(p=>p.id===target); p.alive=false;
    if(isWorld(state))runtime(state).stop(state,p,at,'death',record);
    transferTasks(state,p,at);
    publicEvent(state,'ejected',at,{playerId:p.id}); record(state,'ejected',at,{playerId:p.id,role:p.role});
  }
  resume(state,at); victory(state,at);
}
function advance(state,now) {
  if (now<state.updatedAt || ['ended','paused'].includes(state.phase)) return false;
  let changed=false;
  // Process elapsed deadlines chronologically; late ticks do not extend any deadline.
  while (!['ended','paused'].includes(state.phase)) {
    const critical=state.sabotage?.active ? state.sabotage.deadlineAt : Infinity;
    const max=state.startedAt+state.rules.maxMatchMs;
    const systemAt=isBeacon(state)?systemsModule.systemsDeadline(state):Infinity;
    const deviceAt=isBeacon(state)?investigationModule.investigationDeadline(state):Infinity;
    const phaseAt=state.deadlineAt??Infinity;
    const effectAt=nextEffectAt(state),deadline=Math.min(critical,max,phaseAt,systemAt,deviceAt,effectAt);
    if(isWorld(state))changed=runtime(state).settle(state,Math.min(deadline,now),record)||changed;
    if (deadline>now) {
      if(isBeacon(state)){changed=investigationModule.advanceInvestigation(state,now,context(state))||changed;changed=refreshKnowledge(state,now)||changed;changed=captureReplaySnapshot(state,now)||changed;}
      break;
    }
    changed=true;
    if (critical===deadline) end(state,'saboteur','critical',deadline);
    else if (max===deadline) {
      if(isWorld(state))runtime(state).stopAll(state,deadline,'paused',record);
      if(isBeacon(state)){systemsModule.onSystemsPhaseChange(state,'paused',deadline,context(state));investigationModule.onInvestigationPhaseChange(state,'paused',deadline,context(state));}
      clearEffects(state,deadline,'paused',record);state.phase='paused'; state.deadlineAt=null; state.pauseReason='maximum_duration';
      publicEvent(state,'paused',deadline,{reason:'maximum_duration'}); record(state,'paused',deadline,{reason:'maximum_duration'});
    } else if (phaseAt===deadline&&state.phase==='roam') startMeeting(state,null,'timeout',null,deadline);
    else if (phaseAt===deadline&&state.phase==='discussion') {
      state.phase='voting'; state.deadlineAt=deadline+state.rules.votingMs; state.meeting.deadlineAt=state.deadlineAt;
      publicEvent(state,'voting',deadline,{meetingId:state.meeting.id}); record(state,'voting',deadline,{meetingId:state.meeting.id});
    } else if (phaseAt===deadline&&state.phase==='voting') tally(state,deadline);
    else if(systemAt===deadline){systemsModule.advanceSystems(state,deadline,context(state));if(state.tacticalVersion===1)runtime(state).invalidateRoutes?.(state,deadline,record);}
    else if(effectAt===deadline)clearEffects(state,deadline,'expired',record,e=>e.expiresAt<=deadline);
    else if(deviceAt===deadline)investigationModule.advanceInvestigation(state,deadline,context(state));
    else break;
    if(isBeacon(state)){refreshKnowledge(state,deadline);captureReplaySnapshot(state,deadline);}
  }
  if (changed) state.updatedAt=now;
  return changed;
}

export function createMatch({id,mode='human',humanPlayerId,now=Date.now(),seed,config={},world=false,systems=false,roster,saboteurCount=1,humanPlayerIds,beaconRules={},tactical=false,map,stationTasks=false,features,mapId,mapRevision=1,settings,taskEdition=3}={}) {
  if(![1,3].includes(taskEdition))throw new TypeError('Invalid task edition');
  if(typeof stationTasks!=='boolean'||stationTasks&&!tactical||typeof tactical!=='boolean'||(!tactical&&map!==undefined))throw new TypeError('Invalid tactical option');
  if(mapId!==undefined&&(typeof mapId!=='string'||tactical))throw new TypeError('Invalid legacy map selection');
  if(![1,2].includes(mapRevision)||mapRevision===2&&(!world||systems||tactical||stationTasks))throw new TypeError('Invalid map revision for world2');
  const legacy=mapRevision===2||mapId!==undefined&&mapId!=='beacon'?getLegacyMap(mapId??'beacon',mapRevision):null;
  const expanded=legacy&&(mapId??'beacon')!=='beacon'?legacy:null;
  if(expanded&&(!world||systems||expanded.tactical!==false||expanded.taskProtocol!=='taskStep'))throw new TypeError('Expanded maps require their authored world2 mode');
  if(tactical){world=true;systems=true;}
  const selected=tactical?getMap(map):legacy,layout=selected?.roomLayout??ROOM_LAYOUT,roomIds=layout.map(r=>r.id);
  if(tactical&&(selected.tactical===false||!selected.fixtures))throw new TypeError('Map does not support tactical systems');
  if (typeof world!=='boolean'||typeof systems!=='boolean'||(systems&&!world))throw new TypeError('Invalid world option');
  if (typeof id!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || !['human','spectator'].includes(mode) || !finiteTime(now) || (!systems&&(humanPlayerId??'p1')!=='p1')) throw new TypeError('Invalid match options');
  if (!config || typeof config!=='object' || Array.isArray(config)) throw new TypeError('Invalid rules');
  if(settings)validateSettings(settings);
  const rules={...DEFAULT_RULES,...(expanded?{tasksPerCrew:expanded.metadata?.tasksPerCrew??expanded.geometry.metadata?.tasksPerCrew,roamDeadlineMs:480000,maxMatchMs:1800000}:{}),...(stationTasks?{tasksPerCrew:4}:{}),...(settings?matchRules(settings):{})};
  for (const [key,value] of Object.entries(config)) {
    if (!Object.hasOwn(rules,key) || !Number.isSafeInteger(value) || value<1 || value>86400000) throw new TypeError('Invalid rules');
    rules[key]=value;
  }
  if (rules.tasksPerCrew>20 || rules.meetingsPerPlayer>10 || rules.messagesPerDiscussion>20 || rules.messageMaxLength>2000) throw new TypeError('Invalid rules');
  if (seed!==undefined && !['string','number'].includes(typeof seed)) throw new TypeError('Invalid seed');
  const secret=seed===undefined?randomBytes(32).toString('hex'):String(seed);
  let counter=0;
  const random=n=>createHash('sha256').update(`${secret}:${counter++}`).digest().readUInt32BE(0)%n;
  let setup;
  if(settings||!systems){
    roster??=CHARACTERS;
    if(!Array.isArray(roster)||roster.length<4||roster.length>15||new Set(roster.map(p=>p.id)).size!==roster.length||roster.some((p,i)=>p.id!==`p${i+1}`||!ACTOR_ID.test(p.id)||typeof p.name!=='string'||typeof p.color!=='string'))throw new TypeError('Invalid roster');
    if(settings&&settings.capacity!==roster.length)throw new TypeError('Settings and roster capacity differ');
    const humans=humanPlayerIds??(mode==='human'?[humanPlayerId??roster[0].id]:[]),count=settings?.saboteurs??saboteurCount;
    if(!Array.isArray(humans)||new Set(humans).size!==humans.length||humans.some(id=>!roster.some(p=>p.id===id)))throw new TypeError('Invalid human roster');
    if(!Number.isInteger(count)||count<1||count>3||count*2>=roster.length)throw new TypeError('Crew must begin with a majority');
    setup={players:roster.map(p=>({...p,...(settings?{persona:PERSONAS.find(q=>q.id===p.id).persona}: {})})),saboteurCount:count,humanPlayerIds:humans};
  }else setup=normalizeRoster({roster,mode,saboteurCount,humanPlayerIds,humanPlayerId});
  const modernTasks=world&&!!settings&&taskEdition===3;
  const taskPool=TASK_ORDER.filter(kind=>settings?.taskMix==='equipment'?TASK_CATALOG[kind].category==='equipment':settings?.taskMix==='captcha'?TASK_CATALOG[kind].category==='captcha':true);
  const taskOffset=createHash('sha256').update(`${secret}:task-catalog`).digest().readUInt32BE(0)%taskPool.length;
  const saboteurs=new Set();while(saboteurs.size<setup.saboteurCount)saboteurs.add(random(setup.players.length));
  const players=setup.players.map((p,i)=>({id:p.id,name:p.name,color:p.color,role:saboteurs.has(i)?'saboteur':'crew',alive:true,roomId:selected?.geometry.WORLD_SPAWN_ROOM??'bridge',human:setup.humanPlayerIds.includes(p.id),...(settings?{badge:p.id.slice(1),persona:p.persona}:systems?{persona:p.persona}:{}),
    tasks:saboteurs.has(i)?[]:(()=>{
      const remaining=[...roomIds],usedKinds=new Set();
      return Array.from({length:rules.tasksPerCrew},(_,j)=>{
        const useModern=modernTasks&&(!stationTasks||settings.taskMix==='captcha'||j%2===1);
        const nativeEquipment=modernTasks&&stationTasks&&!useModern&&settings.taskMix==='equipment';
        if(!remaining.length)remaining.push(...roomIds);
        let candidates=nativeEquipment?remaining.filter(r=>selected?.taskKinds?.[r]!=='glyphs'):remaining;
        if(!candidates.length)candidates=roomIds.filter(r=>selected?.taskKinds?.[r]!=='glyphs');
        let pool=stationTasks&&selected?.taskKinds?candidates.filter(r=>!usedKinds.has(selected.taskKinds[r])):candidates;
        if(!pool.length){usedKinds.clear();pool=candidates;}
        const roomId=expanded?roomIds[(i+j)%roomIds.length]:stationTasks?pool[random(pool.length)]:roomIds[random(roomIds.length)];
        if(stationTasks&&remaining.includes(roomId))remaining.splice(remaining.indexOf(roomId),1);
        const id=`t${createHash('sha256').update(`${secret}:task:${i}:${j}`).digest('hex').slice(0,20)}`;
        const nativeKinds=nativeEquipment?STATION_TASK_KINDS.filter(kind=>kind!=='glyphs'):STATION_TASK_KINDS;
        const kind=selected?.taskKinds?.[roomId]??nativeKinds[(j+i)%nativeKinds.length],modernKind=taskPool[(taskOffset+i*rules.tasksPerCrew+j)%taskPool.length];
        if(stationTasks)usedKinds.add(kind);
        return {id,label:useModern?`${TASK_CATALOG[modernKind].title} · ${layout.find(r=>r.id===roomId).name}`:stationTasks?`Restore ${layout.find(r=>r.id===roomId).name} ${kind}`:`Service ${layout.find(r=>r.id===roomId).name} relay`,roomId,completed:false,...(useModern?{kind:modernKind,edition:3}:stationTasks?{kind:'station',challenge:createStationChallenge({kind,seed:id})}:expanded?{kind:TASK_KINDS[(i+j)%TASK_KINDS.length]}:{})};
      });
    })(),
    cooldowns:{moveAt:now,taskAt:now,killAt:now+rules.initialKillCooldownMs,sabotageAt:now+rules.sabotageCooldownMs,meetingAt:now+rules.meetingCooldownMs},meetingsRemaining:rules.meetingsPerPlayer}));
  const state={...(expanded?{mapId:expanded.legacyMapId}:{}),...(mapRevision===2?{mapRevision:2}:{}),schemaVersion:1,id,mode,version:1,phase:'roam',startedAt:now,updatedAt:now,deadlineAt:now+rules.roamDeadlineMs,rules,players,bodies:[],sabotage:null,meeting:null,meetingCount:0,outcome:null,sequence:0,events:[],replaySequence:0,replay:[],requests:Object.fromEntries(players.map(p=>[p.id,[]]))};
  if(settings)state.lobbySettings=clone(settings);
  if(tactical){state.map={id:selected.id,version:selected.version};state.preset={id:TACTICAL_PRESET.id,version:TACTICAL_PRESET.version};state.tacticalVersion=1;}
  if(world)(systems?spatialFor(state):worldFor(state)).initialize(state,now);
  if(systems){
    if(!beaconRules||typeof beaconRules!=='object'||Array.isArray(beaconRules))throw new TypeError('Invalid beacon rules');
    const values={...(tactical?DEFAULT_TACTICAL_BEACON_RULES:DEFAULT_BEACON_RULES)};for(const [key,value]of Object.entries(beaconRules)){if(!Object.hasOwn(values,key)||!Number.isSafeInteger(value)||value<1||value>86400000)throw new TypeError('Invalid beacon rule');values[key]=value;}
    if(values.visionRadius<80||values.visionRadius>900||values.saboteurVisionRadius<80||values.saboteurVisionRadius>900||values.lightsVisionRadius>values.visionRadius||values.observationLimit>64)throw new TypeError('Invalid vision or observation limit');
    state.schemaVersion=stationTasks?5:tactical?4:3;if(stationTasks)state.stationTasksVersion=1;state.worldVersion=1;state.beaconVersion=1;state.configuration=structuredClone(setup);state.beaconRules=values;state.deathPolicy='redistribute-at-muster';state.abilities={};state.replaySnapshots=[];
    systemsModule.initializeSystems(state,now);investigationModule.initializeInvestigation(state,now);refreshKnowledge(state,now);captureReplaySnapshot(state,now);
  }
  initializeFeatures(state,features,random);
  publicEvent(state,'started',now); record(state,'started',now,{...(expanded?{mapId:expanded.legacyMapId}:{}),...(mapRevision===2?{mapRevision:2}:{}),...(tactical?{tacticalVersion:1,map:clone(state.map),preset:clone(state.preset)}:{}),...(world?{worldVersion:1,positions:players.map(p=>({id:p.id,position:clone(p.position)}))}:{}),roles:players.map(p=>({id:p.id,role:p.role})),tasks:players.map(p=>({id:p.id,tasks:clone(p.tasks)}))});
  checkpointReplay(state);return state;
}

function validateEnvelope(action) {
  if (!action || typeof action!=='object' || Array.isArray(action) || ![Object.prototype,null].includes(Object.getPrototypeOf(action))) return fail('INVALID_ACTION','Invalid action envelope.');
  if (typeof action.id!=='string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(action.id) || !Object.hasOwn(fields,action.type)) return fail('INVALID_ACTION','Invalid action envelope.');
  const keys=['id','type',...fields[action.type]];
  if (Object.keys(action).some(k=>!keys.includes(k)) || keys.some(k=>!Object.hasOwn(action,k))) return fail('INVALID_ACTION','Invalid action fields.');
  if(action.type==='taskStep'){if(typeof action.taskId!=='string'||action.taskId.length>100||!Number.isInteger(action.step)||action.step<0||action.step>4||typeof action.input!=='string'||action.input.length>40)return fail('INVALID_ACTION','Invalid task step.');return null;}
  if (['navigate','decoy'].includes(action.type) ? fields.navigate.some(k=>!Number.isFinite(action[k])) : fields[action.type].some(k=>typeof action[k]!=='string' || action[k].length>(k==='text'?2000:100))) return fail('INVALID_ACTION','Invalid action fields.');
  return null;
}
function denial(state,p,a,now,hint=false) {
  if (['ended','paused'].includes(state.phase)) return fail('MATCH_INACTIVE','This match is not active.');
  const feature=['ghostSay','protect','decoy'].includes(a.type)?featureDenial(state,p,a,now,featureWorld(state,p)):undefined;if(feature!==undefined)return feature;
  if (!p.alive&&!(isGhost(state,p)&&['wait','move','navigate','task','taskStep','taskInteract'].includes(a.type))) return fail('PLAYER_DEAD','Eliminated keepers cannot act.');
  if (a.type==='wait') return null;
  if (a.type==='say') {
    if (state.phase!=='discussion') return fail('WRONG_PHASE','Discussion is closed.');
    if (!a.text.trim() || a.text.length>state.rules.messageMaxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(a.text)) return fail('INVALID_TEXT','Invalid message.');
    if (state.meeting.messages.filter(m=>m.playerId===p.id).length>=state.rules.messagesPerDiscussion) return fail('MESSAGE_LIMIT','Discussion message limit reached.');
    return null;
  }
  if (a.type==='vote') {
    if (state.phase!=='voting') return fail('WRONG_PHASE','Voting is closed.');
    if (a.targetId!=='skip' && !state.meeting.eligibleVoters.includes(a.targetId)) return fail('INVALID_TARGET','Invalid vote target.');
    if (state.meeting.votes.some(v=>v.playerId===p.id)) return fail('ALREADY_VOTED','Vote already cast.');
    return null;
  }
  if (state.phase!=='roam') return fail('WRONG_PHASE','Action requires roaming.');
  if(state.lobbySettings?.sabotageEnabled===false&&['sabotage','systemSabotage'].includes(a.type))return fail('UNAVAILABLE','Sabotage is unavailable.');
  if(isBeacon(state)){
    if(ownEntry(state.systems.transit,p.id))return fail('IN_TRANSIT','Wait until you exit the secret route.');
    if(systemsModule.SYSTEM_ACTIONS.includes(a.type))return systemsModule.validateSystemAction(state,p,a,now,context(state));
    if(investigationModule.INVESTIGATION_ACTIONS.includes(a.type))return investigationModule.validateInvestigationAction(state,p,a,now,context(state));
    if(a.type==='ability')return abilityService.validate(state,p,a,now,context(state));
    if(['task','taskInteract'].includes(a.type)&&!stepTask(state,p.tasks.find(t=>t.id===a.taskId)))return taskService.validate(state,p,a,now,context(state));
  }
  if (a.type==='navigate') {
    if(!isWorld(state)||!(isBeacon(state)?runtime(state).walkable(a,state):runtime(state).walkable(a)))return fail('INVALID_DESTINATION','Choose a walkable world destination.');
  } else if (a.type==='move') {
    if (!layoutFor(state).find(r=>r.id===p.roomId)?.neighbors.includes(a.roomId)) return fail('INVALID_ROOM','Choose an adjacent room.');
    if (now<p.cooldowns.moveAt) return fail('COOLDOWN','Movement is cooling down.');
  } else if (a.type==='task'||a.type==='taskStep') {
    const t=p.tasks.find(t=>t.id===a.taskId);
    if (p.role!=='crew' || !t || t.completed || (isWorld(state)?!nearby(state,p,runtime(state).station(t.roomId),runtime(state).WORLD.interactionRadius):t.roomId!==p.roomId)) return fail('INVALID_TASK','No available task here.');
    if (now<p.cooldowns.taskAt) return fail('COOLDOWN','Task equipment is cooling down.');
    if(a.type==='taskStep'){if(!stepTask(state,t))return fail('INVALID_ACTION','Use the task protocol advertised by this station.');const error=stepError(t,a,now);if(error)return error;}
    if(a.type==='task'&&stepTask(state,t)&&!hint&&taskProgress(t).index<taskProgress(t).total)return fail('TASK_INCOMPLETE','Complete the station steps first.');
  } else if (a.type==='eliminate') {
    const target=state.players.find(t=>t.id===a.targetId);
    if (p.role!=='saboteur' || !target || !target.alive || target.role!=='crew' || (isBeacon(state)&&ownEntry(state.systems.transit,target.id)) || (isWorld(state)?!nearby(state,p,target.position,runtime(state).WORLD.killRadius):target.roomId!==p.roomId)) return fail('INVALID_TARGET','No valid target here.');
    if (now<p.cooldowns.killAt) return fail('COOLDOWN','Elimination is cooling down.');
  } else if (a.type==='sabotage') {
    if (state.lobbySettings?.sabotageEnabled===false || p.role!=='saboteur' || state.sabotage?.active) return fail('UNAVAILABLE','Sabotage is unavailable.');
    if (now<p.cooldowns.sabotageAt) return fail('COOLDOWN','Sabotage is cooling down.');
  } else if (a.type==='repair') {
    if (p.role!=='crew' || !state.sabotage?.active || (isWorld(state)?!nearby(state,p,runtime(state).station(state.sabotage.roomId),runtime(state).WORLD.interactionRadius):p.roomId!==state.sabotage.roomId) || state.sabotage.repairers.includes(p.id)) return fail('UNAVAILABLE','No repair available here.');
  } else if (a.type==='report') {
    if (!state.bodies.some(b=>b.id===a.bodyId && !b.reported && (isWorld(state)?nearby(state,p,b.position,Math.min(runtime(state).WORLD.reportRadius,state.lobbySettings?.vision??runtime(state).WORLD.visibilityRadius)):b.roomId===p.roomId))) return fail('INVALID_BODY','No reportable body here.');
  } else if (a.type==='meeting') {
    if (state.lobbySettings?.emergencyMeetingsEnabled===false || (isWorld(state)?!nearby(state,p,runtime(state).bell,runtime(state).WORLD.interactionRadius):p.roomId!=='bridge') || p.meetingsRemaining<1 || state.sabotage?.active) return fail('UNAVAILABLE','Emergency bell unavailable.');
    if (now<p.cooldowns.meetingAt) return fail('COOLDOWN','Emergency bell is cooling down.');
  }
  return null;
}

export function tick(input,now=Date.now()) {
  if (!finiteTime(now) || now<input.updatedAt) return {state:input,events:[]};
  if (['ended','paused'].includes(input.phase)) return {state:input,events:[]};
  // Only legacy schemas have this complete pending/deadline set. Tactical ticks
  // must also observe systems, transit, devices, discovery and replay snapshots.
  if (!isBeacon(input)) {
    const deadline=Math.min(input.sabotage?.active?input.sabotage.deadlineAt:Infinity,input.startedAt+input.rules.maxMatchMs,input.deadlineAt??Infinity,nextEffectAt(input));
    if(deadline>now&&(!isWorld(input)||!worldFor(input).pending(input,now)))return {state:input,events:[]};
  }
  const state=copyEngineState(input),seq=state.sequence;
  if (!advance(state,now)) return {state:input,events:[]};
  state.version++;checkpointReplay(state);
  return {state,events:clone(state.events.filter(e=>Number(e.id.slice(1))>seq))};
}

export function applyAction(input,playerId,action,now=Date.now()) {
  const timed=tick(input,now); let state=timed.state;
  const reject=error=>({state,events:timed.events,accepted:false,error});
  if (!finiteTime(now) || now<input.updatedAt) return reject(fail('INVALID_TIME','Invalid server time.'));
  if (typeof playerId!=='string' || !state.players.some(p=>p.id===playerId)) return reject(fail('INVALID_PLAYER','Unknown keeper.'));
  const invalid=validateEnvelope(action); if (invalid) return reject(invalid);
  if(Object.hasOwn(BEACON_ACTION_FIELDS,action.type)&&!isBeacon(state))return reject(fail('INVALID_ACTION','This action requires a beacon-systems match.'));
  if(action.type==='navigate'&&!isWorld(state))return reject(fail('INVALID_ACTION','Invalid action envelope.'));
  const fingerprint=JSON.stringify(Object.fromEntries(['type',...fields[action.type]].map(k=>[k,action[k]])));
  const prior=state.requests[playerId].find(r=>r.id===action.id);
  if (prior) {
    if (prior.fingerprint!==fingerprint) return reject(fail('REQUEST_CONFLICT','Request ID already used for another action.'));
    return {state,events:timed.events,accepted:prior.accepted,...(prior.error?{error:clone(prior.error)}:{}),duplicate:true};
  }
  if(state.requests[playerId].length>=MAX_REQUESTS)return reject(fail('REQUEST_LIMIT','This keeper has reached the match request limit. Existing requests remain idempotent.'));
  if(state===input)state=copyEngineState(state);
  const p=state.players.find(p=>p.id===playerId);
  let error=denial(state,p,action,now);
  let path,target;
  if(!error&&isWorld(state)&&['navigate','move'].includes(action.type)){
    target=action.type==='move'?runtime(state).station(action.roomId):action;path=runtime(state).navigation(p,target,now,state);
    if(path===null)error=fail('UNREACHABLE','No walkable route reaches that destination.');
  }
  // Persist both success and rule denials, bounded per actor. Never save malformed envelopes.
  state.requests[playerId].push({id:action.id,fingerprint,accepted:!error,...(error?{error}: {})});
  state.version++; state.updatedAt=now;
  if (error) return {state,events:timed.events,accepted:false,error};
  const seq=state.sequence;activateFeature(state,p,action,now,record);
  if (action.type==='move'||action.type==='navigate') {
    if(isWorld(state))runtime(state).navigate(p,target,path,now,state);else p.roomId=action.roomId;
    interruptTasks({players:[p]});p.cooldowns.moveAt=now+state.rules.moveCooldownMs;
  }
  if(action.type==='taskStep'){const task=p.tasks.find(t=>t.id===action.taskId),previousRoom=task.roomId;advanceTask(task,now,layoutFor(state));if(task.roomId!==previousRoom)record(state,'task_routed',now,{playerId:p.id,taskId:task.id,roomId:task.roomId,label:task.label});}
  if(isBeacon(state)&&systemsModule.SYSTEM_ACTIONS.includes(action.type))systemsModule.applySystemAction(state,p,action,now,context(state));
  if(isBeacon(state)&&investigationModule.INVESTIGATION_ACTIONS.includes(action.type))investigationModule.applyInvestigationAction(state,p,action,now,context(state));
  if(isBeacon(state)&&action.type==='ability')abilityService.apply(state,p,action,now,context(state));
  if(isBeacon(state)&&['task','taskInteract'].includes(action.type)&&!stepTask(state,p.tasks.find(t=>t.id===action.taskId)))taskService.apply(state,p,action,now,context(state));
  if ((!isBeacon(state)||stepTask(state,p.tasks.find(t=>t.id===action.taskId)))&&action.type==='task') {p.tasks.find(t=>t.id===action.taskId).completed=true;p.cooldowns.taskAt=now+state.rules.taskCooldownMs;}
  if (!isBeacon(state)&&action.type==='sabotage') {
    state.sabotage={active:true,roomId:'engine',deadlineAt:now+state.rules.criticalDurationMs,repairsCompleted:0,repairsRequired:2,repairers:[]};
    p.cooldowns.sabotageAt=now+state.rules.sabotageCooldownMs;
    publicEvent(state,'sabotage',now,{roomId:'engine',deadlineAt:state.sabotage.deadlineAt});
  }
  if (!isBeacon(state)&&action.type==='repair') {
    state.sabotage.repairers.push(p.id);state.sabotage.repairsCompleted++;
    publicEvent(state,'repair',now,{repairsCompleted:state.sabotage.repairsCompleted});
    if (state.sabotage.repairsCompleted>=state.sabotage.repairsRequired) {state.sabotage.active=false;publicEvent(state,'repaired',now);}
  }
  if (action.type==='eliminate') {
    const target=state.players.find(t=>t.id===action.targetId);const shield=state.effects?.find(e=>e.kind==='ward'&&e.targetId===target.id);if(shield){clearEffects(state,now,'blocked',record,e=>e.id===shield.id);p.cooldowns.killAt=now+state.rules.killCooldownMs;record(state,'attack_blocked',now,{playerId:p.id,targetId:target.id});checkpointReplay(state);return{state,events:timed.events,accepted:true};}target.alive=false;
    clearEffects(state,now,'death',record,e=>e.playerId===target.id||e.targetId===target.id);interruptTasks({players:[target]});
    p.cooldowns.killAt=now+state.rules.killCooldownMs;
    if(isWorld(state))runtime(state).stop(state,target,now,'death',record);
    state.bodies.push({id:`body-${target.id}`,playerId:target.id,roomId:target.roomId,reported:false,...(isWorld(state)?{position:clone(target.position),at:now}:{})});
    if(!isBeacon(state))transferTasks(state,target,now);
    // Attribution is private to actual eyewitnesses; never enters the public timeline.
    record(state,'witness',now,{playerId:p.id,targetId:target.id,roomId:p.roomId,...(isWorld(state)?{position:clone(target.position)}:{}),visibleTo:state.players.filter(w=>w.alive&&(isWorld(state)?sees(state,w,p.position)&&sees(state,w,target.position):w.roomId===p.roomId)).map(w=>w.id)});
    if(!isBeacon(state))publicEvent(state,'eliminated',now,{playerId:target.id});
  }
  if (action.type==='report') {
    const body=state.bodies.find(b=>b.id===action.bodyId);body.reported=true;
    startMeeting(state,p.id,'report',body.id,now);
    for (const b of state.bodies) b.reported=true;
  }
  if (action.type==='meeting') {p.meetingsRemaining--;startMeeting(state,p.id,'emergency',null,now);}
  if (action.type==='say') {
    const message={id:`${state.meeting.id}-s${state.meeting.messages.length+1}`,playerId:p.id,text:action.text.trim(),at:now};
    state.meeting.messages.push(message);publicEvent(state,'said',now,message);
  }
  if (action.type==='vote') state.meeting.votes.push({playerId:p.id,targetId:action.targetId});
  if(action.type!=='ghostSay')record(state,'action',now,{playerId:p.id,action:clone(action),...(['task','taskStep'].includes(action.type)&&stepTask(state,p.tasks.find(t=>t.id===action.taskId))?{taskProgress:clone(taskProgress(p.tasks.find(t=>t.id===action.taskId)))}:{}),...(isWorld(state)?{position:clone(p.position),...(['navigate','move'].includes(action.type)&&path.length<=128?{route:clone(path),speed:state.lobbySettings?.speed??runtime(state).WORLD.speed}:{})}:{}),...(action.type==='taskInteract'&&p.tasks.find(t=>t.id===action.taskId)?.challenge?{stationChallenge:clone(p.tasks.find(t=>t.id===action.taskId).challenge),completed:p.tasks.find(t=>t.id===action.taskId).completed}:{})});
  if(isBeacon(state)){investigationModule.advanceInvestigation(state,now,context(state));refreshKnowledge(state,now);}
  victory(state,now);checkpointReplay(state);if(isBeacon(state))captureReplaySnapshot(state,now);
  return {state,events:[...timed.events,...clone(state.events.filter(e=>Number(e.id.slice(1))>seq))],accepted:true};
}

export function getPlayerView(state,playerIdOrNull,now=Date.now()) {
  const p=state.players.find(p=>p.id===playerIdOrNull);
  const ended=state.phase==='ended';
  const projection=isBeacon(state)?runtime(state).projectWorld(state,playerIdOrNull,now):null;
  const visible=q=>q.id===p?.id||(!(isGhost(state,q)&&(!p||p.alive))&&(ended||!p||(isWorld(state)?sees(state,p,q.position):q.roomId===p.roomId)));
  const bodyVisible=b=>!p||(isWorld(state)?sees(state,p,b.position):b.roomId===p.roomId);
  const bodyEvent=b=>({id:b.id,type:'body',bodyId:b.id,playerId:b.playerId,roomId:b.roomId,at:isWorld(state)?b.at:state.updatedAt,...(isWorld(state)?{position:clone(b.position)}:{})});
  const events=clone(state.events);
  if(projection)events.push(...projection.localEvents);
  else if (p) {
    for (const e of state.replay.filter(e=>e.type==='witness' && e.visibleTo.includes(p.id)).slice(-30)) events.push({id:e.id,type:'witness',at:e.at,playerId:e.playerId,targetId:e.targetId,roomId:e.roomId,...(isWorld(state)?{position:clone(e.position)}:{})});
    // The frozen view has no bodies field: local sightings are safe timeline entries.
    for (const b of state.bodies.filter(b=>!b.reported&&bodyVisible(b))) events.push(bodyEvent(b));
  } else for (const b of state.bodies.filter(b=>!b.reported)) events.push(bodyEvent(b));
  const hints=[];
  if (p) for (const type of [...new Set([...Object.keys(fields).filter(type=>type!=='navigate'),...(isWorld(state)?['navigate']:[])])]) {
    let candidates=[{id:'hint',type}];
    if(type==='navigate')candidates=[{id:'hint',type,x:p.position.x,y:p.position.y}];
    if (type==='move') candidates=layoutFor(state).map(r=>r.id).map(roomId=>({id:'hint',type,roomId}));
    if(type==='taskStep'||isBeacon(state)&&['systemSabotage','systemRepair','vent','investigate','deviceCancel','taskInteract','ability'].includes(type))continue;
    if(type==='protect')candidates=state.players.map(q=>({id:'hint',type,targetId:q.id}));
    if(type==='decoy')candidates=[{id:'hint',type,x:p.position?.x,y:p.position?.y}];
    if(type==='ghostSay')candidates=[{id:'hint',type,text:'x'}];
    if (type==='task') candidates=p.tasks.map(t=>({id:'hint',type,taskId:t.id}));
    if (type==='eliminate') candidates=state.players.map(q=>({id:'hint',type,targetId:q.id}));
    if (type==='report') candidates=state.bodies.map(b=>({id:'hint',type,bodyId:b.id}));
    if (type==='say') candidates=[{id:'hint',type,text:'x'}];
    if (type==='vote') candidates=[{id:'hint',type,targetId:'skip'}];
    if (candidates.some(a=>!denial(state,p,a,now,true))) hints.push(type);
  }
  const descriptors=featureHints(state,p,now);for(const d of descriptors)if(d.enabled&&!hints.includes(d.type))hints.push(d.type);
  return {matchId:state.id,...(state.lobbySettings?{settings:clone(state.lobbySettings)}:{}),...(state.mapId?{mapId:state.mapId}:{}),...(state.mapRevision===2?{mapRevision:2}:{}),...(state.features?{features:clone(state.features),effects:safeEffects(state,p,featureWorld(state,p),now),...(isGhost(state,p)?{ghostChat:clone(state.ghostChat)}:{})}:{}),...(state.stationTasksVersion===1?{stationTasksVersion:1}:{}),...(state.tacticalVersion===1?{tacticalVersion:1,map:clone(state.map),preset:clone(state.preset)}:{}),...(isBeacon(state)?{beaconVersion:1,vision:projection.vision,systems:systemsModule.getSystemsView(state,playerIdOrNull,now,context(state)),investigation:investigationModule.getInvestigationView(state,playerIdOrNull,now,context(state)),abilities:getAbilityView(state,playerIdOrNull),interactions:descriptors}:{}),...(isWorld(state)?{worldVersion:1}:{}),version:state.version,phase:state.phase,serverNow:now,deadlineAt:state.deadlineAt,
    rooms:clone(layoutFor(state)),players:projection?.players??state.players.map(q=>({id:q.id,name:q.name,color:q.color,...(q.badge?{badge:q.badge}:{}),alive:q.alive,roomId:visible(q)?q.roomId:null,...(isWorld(state)?{position:visible(q)?clone(q.position):null}:{}),...(ended?{role:q.role}:{})})),
    self:p?{id:p.id,role:p.role,...(state.lobbySettings&&p.role==='saboteur'?{teammates:state.players.filter(q=>q.id!==p.id&&q.role==='saboteur').map(q=>q.id)}:{}),alive:p.alive,...(state.features?{ghost:isGhost(state,p),...(p.ability?{ability:clone(p.ability)}:{})}:{}),roomId:p.roomId,...(isWorld(state)?{position:clone(p.position),inputSeq:p.motion.seq,moving:runtime(state).moving(state,p,now),destination:clone(p.motion.destination)}:{}),tasks:isWorld(state)?p.tasks.map(t=>stepTask(state,t)?{...clone(t),progress:clone(taskProgress(t))}:isBeacon(state)?{...clone(t),...taskService.progress(t)}:clone(t)):clone(p.tasks),...(isBeacon(state)?{transit:ownEntry(state.systems.transit,p.id)?{entryId:ownEntry(state.systems.transit,p.id).entryId,exitId:ownEntry(state.systems.transit,p.id).exitId,deadlineAt:ownEntry(state.systems.transit,p.id).deadlineAt}:null}:{}),cooldowns:clone(p.cooldowns),meetingsRemaining:p.meetingsRemaining}:null,
    tasks:{completed:state.players.flatMap(q=>q.tasks).filter(t=>t.completed).length,total:state.players.flatMap(q=>q.tasks).length},
    sabotage:isBeacon(state)?systemsModule.getSystemsView(state,playerIdOrNull,now,context(state)).critical:state.sabotage?{active:state.sabotage.active,roomId:state.sabotage.roomId,deadlineAt:state.sabotage.deadlineAt,repairsCompleted:state.sabotage.repairsCompleted,repairsRequired:state.sabotage.repairsRequired,...(isBeacon(state)?{kind:state.sabotage.kind,sites:clone(state.sabotage.sites??[])}:{})}:null,
    meeting:state.meeting?{id:state.meeting.id,calledBy:state.meeting.calledBy,reason:state.meeting.reason,bodyId:state.meeting.bodyId,deadlineAt:state.meeting.deadlineAt,messages:clone(state.meeting.messages),votes:state.meeting.votes.map(v=>state.meeting.tallied?clone(v):{playerId:v.playerId}),eligibleVoters:clone(state.meeting.eligibleVoters)}:null,
    outcome:clone(state.outcome),events:events.sort((a,b)=>a.at-b.at).slice(-MAX_EVENTS),availableActions:state.stationTasksVersion===1&&hints.includes('task')?[...hints,'taskInteract']:hints};
}

export function getReplay(state) {
  // Settle may append an earlier arrival after another keeper's later sample.
  // Stable numeric sorting preserves causal append order for equal timestamps.
  return state.phase==='ended'?clone(state.replay).sort((a,b)=>a.at-b.at):null;
}

/** Steer only the authenticated actor; sequence state is separate from action IDs. */
export function applyInput(input,playerId,request,now=Date.now()) {
  const timed=tick(input,now);let state=timed.state;
  const reject=error=>({state,events:timed.events,accepted:false,error});
  if(!finiteTime(now)||now<input.updatedAt)return reject(fail('INVALID_TIME','Invalid server time.'));
  if(!isWorld(state))return reject(fail('WORLD_REQUIRED','Movement input requires a world match.'));
  if(typeof playerId!=='string'||!state.players.some(p=>p.id===playerId))return reject(fail('INVALID_PLAYER','Unknown keeper.'));
  if(!request||typeof request!=='object'||Array.isArray(request)||![Object.prototype,null].includes(Object.getPrototypeOf(request))||Object.keys(request).some(k=>!['seq','dx','dy'].includes(k))||!['seq','dx','dy'].every(k=>Object.hasOwn(request,k))||!Number.isSafeInteger(request.seq)||request.seq<=0||![request.dx,request.dy].every(n=>Number.isInteger(n)&&n>=-1&&n<=1))return reject(fail('INVALID_INPUT','Input requires a positive sequence and integer axes -1..1.'));
  const actor=state.players.find(p=>p.id===playerId),motion=actor.motion;
  if(request.seq<motion.seq)return reject(fail('STALE_INPUT','A newer movement input is already recorded.'));
  if(request.seq===motion.seq){
    if(request.dx!==motion.dx||request.dy!==motion.dy)return reject(fail('INPUT_CONFLICT','Sequence already used for a different direction.'));
    return {state,events:timed.events,accepted:!motion.error,...(motion.error?{error:clone(motion.error)}:{}),duplicate:true};
  }
  const error=isBeacon(state)&&ownEntry(state.systems.transit,actor.id)?fail('IN_TRANSIT','Wait until you exit the secret route.'):['ended','paused'].includes(state.phase)?fail('MATCH_INACTIVE','This match is not active.'):!canWorldAct(state,actor)?fail('PLAYER_DEAD','Eliminated keepers cannot move.'):state.phase!=='roam'?fail('WRONG_PHASE','Movement requires roaming.'):null;
  if(state===input)state=copyEngineState(state);const p=state.players.find(p=>p.id===playerId);
  if(error){p.motion.seq=request.seq;p.motion.dx=request.dx;p.motion.dy=request.dy;p.motion.error=error;state.version++;state.updatedAt=now;return {state,events:timed.events,accepted:false,error:clone(error)};}
  if(request.dx||request.dy)interruptTasks({players:[p]});
  if(runtime(state).input(p,request,now,state))record(state,'direction',now,{playerId:p.id,dx:request.dx,dy:request.dy,position:clone(p.position)});
  if(isBeacon(state)){investigationModule.advanceInvestigation(state,now,context(state));refreshKnowledge(state,now);}
  state.version++;state.updatedAt=now;checkpointReplay(state);
  return {state,events:timed.events,accepted:true};
}

export function getReplaySnapshots(state){return isBeacon(state)?replaySnapshots(state):state.phase==='ended'?[]:null;}

export const getReplayMetadata=replayMetadata;
