import {validateReplayHistoryState} from './engine/replay-history.mjs';
import {validateFeatures} from './feature-validation.mjs';
import {canWorldAct} from '../shared/features.mjs';
import * as taskRules from './engine/tasks.mjs';
const {validProgress}=taskRules;
import {mkdir, readdir, lstat, readFile, open, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateReplayHistory,validateReplayMetadata,REPLAY_LIMITS} from '../shared/replay.mjs';
import {ROOM_LAYOUT,DEFAULT_RULES} from '../shared/contracts.mjs';
import {validateSettings as validateGameplaySettings,ACTOR_ID,PERSONAS,playerName} from '../shared/lobby.mjs';
const configurable=room=>Array.isArray(room?.roster)&&Number.isSafeInteger(room.generation);
import {normalizeRoster,PLAYER_ID} from './features/lobbies/index.mjs';
import {DEFAULT_BEACON_RULES} from '../shared/beacon.mjs';
import {validateSystemsState} from './engine/systems/index.mjs';
import {validateInvestigationState} from './engine/investigation/index.mjs';
import {createSpatialWorld} from './engine/world/index.mjs';
import * as defaultGeometry from '../shared/world.mjs';
import {validateStationChallenge,stationComplete} from '../shared/station-challenges.mjs';
import {getMap,getLegacyMap,mapFor,mapIdentity} from '../shared/maps/index.mjs';
import {hasTacticalFixtures} from './config.mjs';
import {TACTICAL_PRESET,validateMapSelection} from '../shared/tactical.mjs';
const spatialValidator=createSpatialWorld(defaultGeometry);
const extended=state=>[3,4,5].includes(state.schemaVersion);
function savedMap(value){
  if(Object.hasOwn(value,'map'))validateMapSelection(value.map);
  if(Object.hasOwn(value,'mapId')&&(typeof value.mapId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(value.mapId)))throw new Error('Invalid saved map ID');
  if(Object.hasOwn(value,'mapRevision')&&![1,2].includes(value.mapRevision))throw new Error('Invalid saved map revision');
  let selected;
  try{selected=mapFor(value);}catch(error){
    if(/Conflicting/.test(error.message))throw new Error('Inconsistent saved map identities/namespaces');
    throw Object.assign(new Error('Saved map version or revision is unavailable; preserve the data directory and install the matching application version.'),{code:'MAP_UNAVAILABLE'});
  }
  // World2 has a canonical legacy identity, even when a modern room adds an exact alias.
  if(value.map!==undefined&&(value.schemaVersion===2||[1,2].includes(value.schema))&&(value.mapId!==undefined||value.schemaVersion===2)){
    let canonical;try{canonical=getLegacyMap(value.mapId??'beacon',value.mapRevision??1);}catch{throw new Error('World2 exact map requires its matching legacy map ID/revision');}
    if(mapIdentity(canonical)!==mapIdentity(selected))throw new Error('World2 exact map requires its matching legacy map ID/revision');
  }
  return selected;
}
const mapRooms=state=>savedMap(state).roomLayout;
const validStepKind=task=>typeof taskRules.validTaskKind==='function'?taskRules.validTaskKind(task):!Object.hasOwn(task,'kind')&&ROOM_LAYOUT.some(r=>r.id===task.roomId);
function refuseFuture(room){
  const s=room?.state;
  if([room?.mapRevision,s?.mapRevision,s?.replayHistory?.mapRevision].some(r=>Number.isSafeInteger(r)&&r>2))throw Object.assign(new Error('Saved map revision is unavailable; preserve the data directory and install the matching application version.'),{code:'MAP_UNAVAILABLE'});
  const newerTask=s?.players?.some?.(p=>p.tasks?.some?.(t=>t.kind==='station'?t.challenge?.version>1:t.progress?.v>(s.lobbySettings&&t.edition===3?3:s.schemaVersion===2?2:1)));
  if(newerTask)throw Object.assign(new Error('Saved station challenge or task progress version is newer than this application; preserve the data directory.'),{code:'VERSION_UNAVAILABLE'});
  if(room?.schema>5||s?.schemaVersion>5||s?.features?.version>1||s?.replayHistory?.version>2||room?.stationTasksVersion>1||s?.stationTasksVersion>1)throw Object.assign(new Error('Saved room version is newer than this application; preserve the data directory.'),{code:'VERSION_UNAVAILABLE'});
}

export const ROOM_ID = /^[A-Za-z0-9_-]{20,40}$/;
const phases = new Set(['roam','discussion','voting','ended','paused']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateRoom(room) {
  refuseFuture(room);
  if (!object(room) || ![1,2,3,4,5].includes(room.schema) || !ROOM_ID.test(room.id) || !['human','spectator'].includes(room.mode)) throw new Error('Invalid room');
  if(Object.hasOwn(room,'mapRevision')&&(![1,2].includes(room.mapRevision)||[3,4].includes(room.schema)))throw new Error('Invalid room map revision');
  if(room.state&&Object.hasOwn(room.state,'mapRevision')&&(![1,2].includes(room.state.mapRevision)||room.state.schemaVersion!==2))throw new Error('Invalid match map revision');
  if (![room.createdAt,room.updatedAt].every(n => Number.isSafeInteger(n) && n >= 0) || room.updatedAt < room.createdAt) throw new Error('Invalid room time');
  if (!Array.isArray(room.identities) || !room.identities.length || room.identities.length > 128) throw new Error('Invalid identities');
  const dynamic=configurable(room);
  if(dynamic&&![2,5].includes(room.schema))throw new Error('Invalid configurable container schema');
  const setup=dynamic?normalizeRoster({roster:room.roster,saboteurCount:room.settings?.saboteurs,humanPlayerIds:room.identities.filter(i=>i.seatId).map(i=>i.seatId),mode:room.mode,configurable:true}):[2,3,4].includes(room.schema)?normalizeRoster({...room.lobby,mode:room.mode}):null;
  if(room.schema===5){const persisted=normalizeRoster({...room.lobby,mode:room.mode,configurable:true});if(JSON.stringify(persisted)!==JSON.stringify(setup))throw new Error('Inconsistent configurable lobby mirror');}
  const selected=savedMap(room);
  if([3,4].includes(room.schema)||room.schema===5&&room.preset)validateTacticalRoomMetadata(room);
  else {if(Object.hasOwn(room,'preset'))throw new Error('Mixed tactical lobby metadata');if(Object.hasOwn(room,'settings'))(dynamic?validateGameplaySettings:validateSettings)(room.settings);}
  if(room.state&&(mapIdentity(savedMap(room.state))!==mapIdentity(selected)))throw new Error('Inconsistent room and match map or revision');
  if((room.schema===4||room.schema===5&&room.preset&&Object.hasOwn(room,'stationTasksVersion'))?room.stationTasksVersion!==1:Object.hasOwn(room,'stationTasksVersion'))throw new Error('Invalid room station task version');
  const seatIds=setup?setup.humanPlayerIds:room.mode==='human'?['p1']:[];
  const seen = new Set(),seenSeats=new Set();
  for (const identity of room.identities) {
    if (!object(identity) || !/^[a-f0-9]{64}$/.test(identity.hash) || seen.has(identity.hash) || typeof identity.host !== 'boolean' || !(identity.seatId===null||seatIds.includes(identity.seatId))) throw new Error('Invalid identity');
    if(Object.hasOwn(identity,'inspection')&&(typeof identity.inspection!=='boolean'||identity.inspection&&identity.seatId))throw new Error('Invalid inspection consent');
    if(identity.seatId){if((!dynamic&&room.mode!=='human')||seenSeats.has(identity.seatId)||(room.schema===1&&!identity.host))throw new Error('Invalid seat');seenSeats.add(identity.seatId);}
    seen.add(identity.hash);
  }
  if (room.identities.filter(i=>i.host).length !== 1 || (room.schema===1?room.identities.filter(i=>i.seatId).length !== (room.mode === 'human' ? 1 : 0):room.identities.filter(i=>i.seatId).length>seatIds.length)) throw new Error('Invalid host');
  if (!object(room.aiContext) || (room.startId !== null && (typeof room.startId !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(room.startId)))) throw new Error('Invalid metadata');
  if (room.state !== null && (!object(room.state) || room.state.id !== (dynamic&&room.generation>1?`${room.id}_g${room.generation}`:room.id) || !phases.has(room.state.phase) || !Number.isSafeInteger(room.state.version) || !Array.isArray(room.state.players) || (room.schema===1?room.state.players.length!==6:room.state.players.length!==setup.players.length) || room.startId === null)) throw new Error('Invalid match');
  if (room.state === null && room.startId !== null) throw new Error('Invalid lobby');
  if(room.schema===5&&!dynamic)throw new Error('Invalid configurable room container');
  if(dynamic){validateLobby(room);if(room.mapSettings!==undefined)validateSettings(room.mapSettings);}

  if(room.state!==null){
    const state=room.state;
    if(!dynamic&&Object.hasOwn(state,'lobbySettings'))throw new Error('Dynamic settings require a configurable room container');
    if(state.replayHistory!==undefined){
      if(![2,3,4,5].includes(state.schemaVersion))throw new Error('Mixed legacy/world replay history');
      if(state.schemaVersion!==2&&state.replayHistory.version!==2)throw new Error('Replay version does not match the saved map');
      if(state.schemaVersion===2&&(state.replayHistory.mapRevision??1)!==(state.mapRevision??1))throw new Error('Replay map revision mismatch');
      validateReplayHistory(state.replayHistory);validateReplayHistoryState(state.replayHistory,state);
      if(state.replayHistory.checkpoints.some(a=>a.at<state.startedAt||a.at>state.updatedAt||a.sequence>state.replaySequence))throw new Error('Replay checkpoint exceeds match history');
    }
    if(state.replayBytes!==undefined&&(!Number.isSafeInteger(state.replayBytes)||state.replayBytes<0||state.replayBytes>REPLAY_LIMITS.bytes||!Array.isArray(state.replay)||state.replay.length>REPLAY_LIMITS.events||state.replayBytes!==state.replay.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0)))throw new Error('Invalid replay byte accounting');
    if(![1,2,3,4,5].includes(state.schemaVersion)||state.mode!==room.mode||state.version<1)throw new Error('Unsupported match schema');
    if([4,5].includes(state.schemaVersion)){if((room.schema!==5&&room.schema!==(state.schemaVersion===5?4:3))||state.tacticalVersion!==1||validateMapSelection(state.map).id!==room.map.id||state.map.version!==room.map.version||state.preset?.id!==room.preset.id||state.preset?.version!==room.preset.version||Object.keys(state.preset).length!==2)throw new Error('Tactical match selection mismatch');}
    else if(['preset','tacticalVersion',...(state.schemaVersion===2?[]:['map','mapId'])].some(key=>Object.hasOwn(state,key)))throw new Error('Mixed tactical/legacy match');
    if([3,4].includes(room.schema)&&state.schemaVersion!==(room.schema===4?5:4))throw new Error('Tactical lobby needs matching versioned match');
    if(state.schemaVersion===5?state.stationTasksVersion!==1:Object.hasOwn(state,'stationTasksVersion'))throw new Error('Invalid station task version');
    if(state.schemaVersion===1){
      if(Object.hasOwn(state,'worldVersion')||state.players.some(p=>Object.hasOwn(p,'position')||Object.hasOwn(p,'motion')))throw new Error('Mixed legacy/world match');
    }else validateWorldStructure(state,dynamic);
    if(extended(state)){if(![2,3,4,5].includes(room.schema))throw new Error('Beacon match requires versioned lobby');validateBeaconStructure(state,setup);}
  }
  validateFeatures(room);
  return room;
}

function validateTacticalRoomMetadata(room){
 const reference=validateMapSelection(room.map);let map;try{map=getMap(reference);}catch{throw Object.assign(new Error('Saved map version is unavailable; preserve the data directory and install the matching application version.'),{code:'MAP_UNAVAILABLE'});}if(!hasTacticalFixtures(map)||map.id!==room.map.id||!object(room.preset)||Object.keys(room.preset).length!==2||room.preset.id!==TACTICAL_PRESET.id||room.preset.version!==TACTICAL_PRESET.version)throw new Error('Unsupported tactical preset');
 (configurable(room)?validateGameplaySettings:validateSettings)(room.settings);
}
function validateSettings(s){
 if(!object(s)||Object.keys(s).length!==2||!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.requests)||s.requests.length>64||s.revision!==s.requests.filter(r=>r?.accepted===true).length||new Set(s.requests.map(r=>r?.id)).size!==s.requests.length)throw new Error('Invalid lobby settings ledger');
 for(const r of s.requests)if(!object(r)||typeof r.id!=='string'||!/^[A-Za-z0-9:_-]{1,100}$/.test(r.id)||typeof r.fingerprint!=='string'||r.fingerprint.length>300||typeof r.accepted!=='boolean'||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>s.revision||Object.keys(r).some(k=>!['id','fingerprint','accepted','revision','error'].includes(k))||(!r.accepted&&(!object(r.error)||typeof r.error.code!=='string'||typeof r.error.message!=='string'||r.error.message.length>240))||(r.accepted&&Object.hasOwn(r,'error')))throw new Error('Invalid lobby setting receipt');
}
const finiteTime=value=>Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
const point=value=>object(value)&&Number.isFinite(value.x)&&Number.isFinite(value.y);
function validateWorldStructure(state,dynamic=false){
  const roomIds=new Set(mapRooms(state).map(r=>r.id));
  if(state.worldVersion!==1||!finiteTime(state.startedAt)||!finiteTime(state.updatedAt)||state.updatedAt<state.startedAt||!Array.isArray(state.bodies))throw new Error('Invalid world match');
  const expanded=state.schemaVersion===2&&!hasTacticalFixtures(savedMap(state))&&(savedMap(state).legacyMapId??savedMap(state).id)!=='beacon';
  if(expanded){const tasks=state.players.flatMap(p=>p.tasks??[]);if(tasks.length!==state.rules.tasksPerCrew*state.players.filter(p=>p.role==='crew').length||new Set(tasks.map(t=>t?.id)).size!==tasks.length||tasks.some(t=>!object(t)||!/^t[a-f0-9]{20}$/.test(t.id)||!Object.hasOwn(t,'kind')||typeof t.label!=='string'||t.label.length<1||t.label.length>200||typeof t.completed!=='boolean'||t.completed&&!Object.hasOwn(t,'progress')))throw new Error('Invalid map task descriptors');}
  const ids=new Set();
  for(const player of state.players){
    if(!object(player)||!(dynamic?ACTOR_ID.test(player.id):extended(state)?PLAYER_ID.test(player.id):/^p[1-6]$/.test(player.id))||ids.has(player.id)||!['crew','saboteur'].includes(player.role)||typeof player.alive!=='boolean'||!roomIds.has(player.roomId)||player.human!==(extended(state)?state.configuration.humanPlayerIds.includes(player.id):dynamic?typeof player.human==='boolean'&&player.human:state.mode==='human'&&player.id==='p1')||!point(player.position))throw new Error('Invalid world player');
    if(!Array.isArray(player.tasks)||player.tasks.length>(dynamic?280:extended(state)?240:100)||player.tasks.some(t=>!object(t)||!roomIds.has(t.roomId)||state.schemaVersion===2&&!validStepKind(t)||Object.hasOwn(t,'progress')&&!validProgress(t.progress,t,state)))throw new Error('Invalid task progress');
    ids.add(player.id);const motion=player.motion;
    if(!object(motion)||!Number.isSafeInteger(motion.seq)||motion.seq<0||![motion.dx,motion.dy].every(n=>Number.isInteger(n)&&n>=-1&&n<=1)||typeof motion.manual!=='boolean'||![motion.at,motion.leaseUntil,motion.recordedAt].every(finiteTime)||motion.at>state.updatedAt+1e-6||motion.recordedAt>state.updatedAt+1e-6||!Array.isArray(motion.path)||motion.path.length>4096||motion.path.some(p=>!point(p))||(motion.destination!==null&&!point(motion.destination)))throw new Error('Invalid world motion');
    // Early schema-2 checkpoints lack error; new Core persists null or a bounded receipt.
    if(Object.hasOwn(motion,'error')&&motion.error!==null){
      const error=motion.error;
      if(!object(error)||Object.keys(error).length!==2||!Object.hasOwn(error,'code')||!Object.hasOwn(error,'message')||typeof error.code!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)||typeof error.message!=='string'||error.message.length<1||error.message.length>240)throw new Error('Invalid world motion error');
    }
    if((motion.manual&&(!(motion.dx||motion.dy)||motion.path.length||motion.destination!==null))||(motion.path.length===0)!==(motion.destination===null)||((!canWorldAct(state,player)||state.phase!=='roam')&&(motion.manual||motion.path.length||motion.destination!==null)))throw new Error('Inconsistent world motion');
  }
  if(state.players.filter(player=>player.role==='saboteur').length!==(dynamic?state.lobbySettings.saboteurs:extended(state)?state.configuration.saboteurCount:1))throw new Error('Invalid world role assignment');
  for(const body of state.bodies)if(!object(body)||!((dynamic||extended(state))?body.id==='body-'+body.playerId:/^body-p[1-6]$/.test(body.id))||!ids.has(body.playerId)||!roomIds.has(body.roomId)||typeof body.reported!=='boolean'||!point(body.position)||!finiteTime(body.at)||body.at>state.updatedAt)throw new Error('Invalid world body');
}
function validateBeaconStructure(state,setup){
 const roomIds=new Set(mapRooms(state).map(r=>r.id));
 if(state.beaconVersion!==1||!object(state.configuration)||!object(state.beaconRules)||state.deathPolicy!=='redistribute-at-muster'||!object(state.abilities)||!Array.isArray(state.replaySnapshots)||state.replaySnapshots.length>256)throw new Error('Invalid beacon state');
 const stored=normalizeRoster({...state.configuration,roster:state.configuration.players,mode:state.mode,...(state.lobbySettings?{configurable:true}:{})});
 if(JSON.stringify(stored)!==JSON.stringify(setup)||state.players.some(p=>!setup.players.some(q=>q.id===p.id&&q.name===p.name&&q.color===p.color)))throw new Error('Beacon roster mismatch');
 for(const key of Object.keys(DEFAULT_BEACON_RULES))if(!Number.isSafeInteger(state.beaconRules[key])||state.beaconRules[key]<1||state.beaconRules[key]>86400000)throw new Error('Invalid beacon rule');
 if(Object.keys(state.beaconRules).length!==Object.keys(DEFAULT_BEACON_RULES).length||state.beaconRules.visionRadius<80||state.beaconRules.visionRadius>900||state.beaconRules.saboteurVisionRadius<80||state.beaconRules.saboteurVisionRadius>900||state.beaconRules.lightsVisionRadius>state.beaconRules.visionRadius||state.beaconRules.observationLimit>64)throw new Error('Invalid beacon vision');
 validateSystemsState(state);validateInvestigationState(state);([4,5].includes(state.schemaVersion)?createSpatialWorld(getMap(state.map).geometry):spatialValidator).validateSpatialState(state);
 const ids=new Set(state.players.map(p=>p.id));
 if(!object(state.requests)||Object.keys(state.requests).length!==ids.size||Object.keys(state.requests).some(id=>!ids.has(id)))throw new Error('Invalid request ledger');
 for(const p of state.players){
  if(!Array.isArray(p.tasks)||p.tasks.length>(state.lobbySettings?280:240)||typeof p.human!=='boolean'||!object(p.cooldowns)||!Number.isSafeInteger(p.meetingsRemaining)||p.meetingsRemaining<0||p.meetingsRemaining>10)throw new Error('Invalid keeper state');
  for(const t of p.tasks)if(!object(t)||typeof t.id!=='string'||t.id.length>100||!roomIds.has(t.roomId)||typeof t.label!=='string'||t.label.length>200||typeof t.completed!=='boolean')throw new Error('Invalid task state');
  for(const task of p.tasks){if(state.schemaVersion===5&&task.kind==='station'){if(task.kind!=='station')throw new Error('Invalid station task kind');validateStationChallenge(task.challenge);if(task.completed!==stationComplete(task.challenge))throw new Error('Inconsistent station task progress');}else if(task.edition===3&&state.lobbySettings){if(task.edition!==3||!validStepKind(task)||Object.hasOwn(task,'challenge')||Object.hasOwn(task,'progress')&&!validProgress(task.progress,task,state))throw new Error('Invalid edition-3 task');}else if(state.schemaVersion===5||task.kind==='station'||Object.hasOwn(task,'challenge')||state.schemaVersion!==2&&(task.kind!==undefined&&task.kind!=='relay'||task.progress?.v===2))throw new Error('Mixed station/legacy task protocol');}
  for(const key of ['moveAt','taskAt','killAt','sabotageAt','meetingAt'])if(!finiteTime(p.cooldowns[key]))throw new Error('Invalid cooldown');
  const requests=state.requests[p.id];if(!Array.isArray(requests)||requests.length>2048||new Set(requests.map(r=>r.id)).size!==requests.length||requests.some(r=>!object(r)||typeof r.id!=='string'||!/^[A-Za-z0-9:_-]{1,100}$/.test(r.id)||typeof r.fingerprint!=='string'||r.fingerprint.length>10000||typeof r.accepted!=='boolean'))throw new Error('Invalid accepted request history');
 }
 for(const [id,entry]of Object.entries(state.abilities)){if(!ids.has(id)||!object(entry)||!finiteTime(entry.nextAt)||!Array.isArray(entry.notes)||entry.notes.length>32||entry.notes.some(n=>!object(n)||!finiteTime(n.at)||n.at>state.updatedAt||!roomIds.has(n.roomId)||!point(n.position)))throw new Error('Invalid ability state');}
 if(!Array.isArray(state.replay)||state.replay.length>12000||!Array.isArray(state.events)||state.events.length>256)throw new Error('Invalid event history');
 let previous=-1;for(const snap of state.replaySnapshots){if([4,5].includes(state.schemaVersion)&&(!snap.map||snap.map.id!==state.map.id||snap.map.version!==state.map.version||Object.keys(snap.map).length!==2))throw new Error('Replay map mismatch');if(!object(snap)||snap.version!==1||!finiteTime(snap.at)||snap.at<previous||snap.at>state.updatedAt||!phases.has(snap.phase)||!Array.isArray(snap.players)||snap.players.length!==ids.size||snap.players.some(p=>!ids.has(p.id)||!point(p.position)||typeof p.alive!=='boolean'))throw new Error('Invalid replay snapshot');previous=snap.at;}
}
function validateLobby(room){
 validateGameplaySettings(room.settings);
 if(!Number.isSafeInteger(room.generation)||room.generation<1||room.generation>1000000||!Number.isSafeInteger(room.revision)||room.revision<0||!/^[A-F0-9]{12}$/.test(room.inviteCode))throw Error('Invalid lobby generation');
 if(!Array.isArray(room.roster)||room.roster.length!==room.settings.capacity)throw Error('Invalid lobby roster');
 for(const [i,p]of room.roster.entries())if(!object(p)||p.id!==`p${i+1}`||playerName(p.name)!==p.name||!PERSONAS.some(q=>q.color===p.color)||p.persona!==PERSONAS[i].persona||p.badge!==String(i+1))throw Error('Invalid roster profile');
 const occupied=new Set();
 for(const identity of room.identities){
  if(typeof identity.ready!=='boolean'||typeof identity.revoked!=='boolean')throw Error('Invalid readiness');
  if(identity.revoked&&(identity.host||(!room.state&&identity.seatId)||identity.ready))throw Error('Invalid revocation');
  if(identity.seatId){if(!room.roster.some(p=>p.id===identity.seatId)||occupied.has(identity.seatId))throw Error('Duplicate seat ownership');occupied.add(identity.seatId);}
  else if(identity.ready)throw Error('Spectator ready');
 }
 if(Object.hasOwn(room,'lastRematch')&&(!object(room.lastRematch)||typeof room.lastRematch.id!=='string'||!/^[A-Za-z0-9:_-]{1,100}$/.test(room.lastRematch.id)||!Number.isSafeInteger(room.lastRematch.from)||room.lastRematch.from<0||room.generation!==(room.lastRematch.from===0?2:room.lastRematch.from+1)))throw Error('Invalid rematch receipt');
 if(!Array.isArray(room.archives)||room.archives.length>3||Buffer.byteLength(JSON.stringify(room.archives))>2000000)throw Error('Invalid replay archive');
 const archived=new Set();for(const a of room.archives){
  if(!object(a)||typeof a.matchId!=='string'||!Number.isSafeInteger(a.generation)||a.generation>=room.generation||a.generation<0||a.matchId!==(a.generation<=1?room.id:`${room.id}_g${a.generation}`)||archived.has(a.generation)||!Array.isArray(a.replay)||a.replay.length>2000||Buffer.byteLength(JSON.stringify(a.replay))>1000000||a.replay.some(e=>!object(e)||!finiteTime(e.at)||typeof e.type!=='string')||!Array.isArray(a.players)||a.players.length<4||a.players.length>15||a.players.some((p,i)=>!object(p)||p.id!==`p${i+1}`||typeof p.name!=='string'||playerName(p.name)!==p.name||!PERSONAS.some(q=>q.color===p.color)||!['crew','saboteur'].includes(p.role))||a.players.filter(p=>p.role==='saboteur').length<1||a.players.filter(p=>p.role==='saboteur').length>3||a.players.filter(p=>p.role==='saboteur').length*2>=a.players.length)throw Error('Invalid archived replay');if(a.metadata!==undefined&&a.metadata!==null)validateReplayMetadata(a.metadata,a.matchId);archived.add(a.generation);
 }
 if(room.state){
  const state=room.state;const roomIds=new Set(mapRooms(state).map(r=>r.id));validateGameplaySettings(state.lobbySettings);
  if(JSON.stringify(state.lobbySettings)!==JSON.stringify(room.settings)||state.players.length!==room.roster.length||state.players.filter(p=>p.role==='saboteur').length!==room.settings.saboteurs)throw Error('Invalid locked settings');
  if(!object(state.rules)||Object.keys(state.rules).length!==Object.keys(DEFAULT_RULES).length||Object.keys(DEFAULT_RULES).some(k=>!Number.isSafeInteger(state.rules[k])||state.rules[k]<1||state.rules[k]>86400000)||state.rules.tasksPerCrew>20||state.rules.meetingsPerPlayer>10||state.rules.messagesPerDiscussion>20||state.rules.messageMaxLength>2000)throw Error('Invalid match rules');
  const taskIds=new Set();
  for(const [i,p]of state.players.entries()){
   if(!object(p)||p.id!==room.roster[i].id||p.name!==room.roster[i].name||p.color!==room.roster[i].color||p.badge!==room.roster[i].badge||p.persona!==PERSONAS[i].persona||typeof p.alive!=='boolean'||!['crew','saboteur'].includes(p.role)||p.human!==occupied.has(p.id)||!Array.isArray(p.tasks)||p.tasks.length>280||(p.role==='saboteur'&&p.tasks.length!==0)||!object(p.cooldowns)||Object.values(p.cooldowns).some(n=>!finiteTime(n))||!Number.isSafeInteger(p.meetingsRemaining)||p.meetingsRemaining<0||!roomIds.has(p.roomId))throw Error('Invalid dynamic player');
   for(const t of p.tasks){if(t?.edition===3&&t.completed&&!Object.hasOwn(t,'progress'))throw new Error('Completed task requires canonical progress');if(!object(t)||typeof t.id!=='string'||taskIds.has(t.id)||!roomIds.has(t.roomId)||typeof t.label!=='string'||typeof t.completed!=='boolean')throw Error('Invalid task');taskIds.add(t.id);}
  }
  if(taskIds.size!==(room.settings.capacity-room.settings.saboteurs)*state.rules.tasksPerCrew)throw Error('Invalid task accounting');
  const bodies=new Set();if(!Array.isArray(state.bodies))throw Error('Invalid bodies');
  for(const body of state.bodies){if(!object(body)||bodies.has(body.id)||body.id!==`body-${body.playerId}`||!state.players.some(p=>p.id===body.playerId&&!p.alive)||!roomIds.has(body.roomId)||typeof body.reported!=='boolean')throw Error('Invalid body ownership');bodies.add(body.id);}
  if(state.meeting){const m=state.meeting,ids=state.players.map(p=>p.id);if(!object(m)||!Array.isArray(m.eligibleVoters)||new Set(m.eligibleVoters).size!==m.eligibleVoters.length||m.eligibleVoters.some(id=>!ids.includes(id))||!Array.isArray(m.votes)||new Set(m.votes.map(v=>v.playerId)).size!==m.votes.length||m.votes.some(v=>!m.eligibleVoters.includes(v.playerId)||(v.targetId!=='skip'&&!m.eligibleVoters.includes(v.targetId)))||!Array.isArray(m.messages)||m.messages.length>15*state.rules.messagesPerDiscussion||m.messages.some(message=>!ids.includes(message.playerId)||typeof message.text!=='string'||message.text.length>state.rules.messageMaxLength))throw Error('Invalid council');}
  if(!object(state.requests)||Object.keys(state.requests).length!==room.roster.length||state.players.some(p=>!Array.isArray(state.requests[p.id])||state.requests[p.id].length>2048||state.requests[p.id].some(r=>!object(r)||typeof r.id!=='string'||typeof r.fingerprint!=='string'||typeof r.accepted!=='boolean')))throw Error('Invalid receipts');
  if(!Array.isArray(state.events)||state.events.length>256||!Array.isArray(state.replay)||state.replay.length>12000||!finiteTime(state.startedAt)||!finiteTime(state.updatedAt))throw Error('Invalid dynamic timeline');
 }
}

async function worldGeometry(supplied){
  const geometry=supplied??await import('../shared/world.mjs');
  if(!geometry?.WORLD||![geometry.WORLD.width,geometry.WORLD.height,geometry.WORLD.inputLeaseMs].every(n=>Number.isFinite(n)&&n>0)||typeof geometry.isWalkable!=='function')throw new Error('World geometry is unavailable');
  return geometry;
}
/** Read-only candidate validation, usable before an explicit offline migration. */
export async function validateRoomSnapshot(room,{worldGeometry:provided}={}){
  validateRoom(room);
  if([2,3,4,5].includes(room.state?.schemaVersion)){
    const geometry=(Object.hasOwn(room.state,'map')||Object.hasOwn(room.state,'mapId')||Object.hasOwn(room.state,'mapRevision'))?savedMap(room.state).geometry:await worldGeometry(provided),{WORLD,isWalkable}=geometry;
    const validPoint=p=>point(p)&&p.x>=0&&p.y>=0&&p.x<=WORLD.width&&p.y<=WORLD.height&&isWalkable(p);
    for(const player of room.state.players){
      const m=player.motion;
      if(!validPoint(player.position)||m.path.some(p=>!validPoint(p))||(m.destination!==null&&!validPoint(m.destination))||m.leaseUntil>m.at+WORLD.inputLeaseMs+1e-6)throw new Error('Invalid world position or input lease');
    }
    for(const body of room.state.bodies)if(!validPoint(body.position))throw new Error('Invalid world body position');
    if([4,5].includes(room.state.schemaVersion)){
      const roomIds=new Set(getMap(room.state.map).roomLayout.map(r=>r.id));
      // Historical coordinates use static geometry, not today's temporary doors.
      // A corridor retains the last entered room, as authoritative motion does.
      const validHistorical=value=>{if(!validPoint(value.position)||!roomIds.has(value.roomId))return false;const actual=geometry.worldRoomAt(value.position);return !actual||(typeof actual==='string'?actual:actual.id)===value.roomId;};
      for(const entry of Object.values(room.state.abilities))for(const note of entry.notes)if(!validHistorical(note))throw new Error('Invalid historical note map position');
      for(const snapshot of room.state.replaySnapshots)for(const player of snapshot.players)if(!validHistorical(player))throw new Error('Invalid replay map position');
    }
    for(const a of room.state.replayHistory?.checkpoints||[]){
      if(a.players.some(p=>!validPoint(p.position)||p.route.some(q=>!validPoint(q)))||a.bodies.some(b=>!validPoint(b.position))||(a.effects||[]).some(e=>e.kind==='echo'&&!validPoint(e.position)))throw new Error('Invalid replay checkpoint geometry');
    }
    for(const e of room.state.effects||[])if(e.kind==='echo'&&!validPoint(e.position))throw new Error('Invalid echo position');
  }
  return room;
}
async function readLock(file) {
  const info=await lstat(file);
  if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>1024)throw new Error('Unsafe data directory lock; preserve and inspect it');
  const owner=JSON.parse(await readFile(file,'utf8'));
  if(!object(owner)||!Number.isSafeInteger(owner.pid)||owner.pid<=0||owner.pid>2147483647||typeof owner.token!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(owner.token))throw new Error('Invalid data directory lock; preserve and inspect it');
  return owner;
}
async function writeLock(file,owner) {
  const handle=await open(file,'wx',0o600);
  // Failed initialization leaves evidence in place rather than guessing ownership.
  try {await handle.writeFile(JSON.stringify(owner));await handle.sync();}finally{await handle.close();}
}
function sameOwner(left,right){return left.pid===right.pid&&left.token===right.token;}
function proveDead(owner) {
  try {process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH')return;throw error;}
  throw new Error('Data directory already in use');
}
async function unlinkOwned(file,expected,dead=false) {
  const current=await readLock(file);
  if(!sameOwner(current,expected))throw new Error('Data directory lock ownership changed; foreign lock preserved');
  if(dead)proveDead(current);
  await unlink(file);
}
// All cooperating pathname mutations, including normal close, hold this claim.
// An abandoned/ambiguous claim is deliberately never reclaimed automatically.
async function withRecoveryClaim(file,operation) {
  const owner={pid:process.pid,token:randomUUID()};
  try {await writeLock(file,owner);}catch(error){
    if(error.code==='EEXIST')throw new Error('Data directory already in use or lock recovery is pending; preserve and inspect the recovery claim');
    throw error;
  }
  try {return await operation();}finally{await unlinkOwned(file,owner);}
}

// One writer owns both room files and the deployment budget in this directory.
export async function createRoomStore(directory,{worldGeometry:providedGeometry}={}) {
  await mkdir(directory,{recursive:true,mode:0o700});
  const lockFile=path.join(directory,'service.lock'), claimFile=path.join(directory,'service.lock.recovery');
  const owner={pid:process.pid,token:randomUUID()};
  await withRecoveryClaim(claimFile,async()=>{
    let previous;
    try {previous=await readLock(lockFile);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(previous) {
      proveDead(previous);
      // Reread under the exclusive claim; never unlink an earlier observation.
      await unlinkOwned(lockFile,previous,true);
    }
    await writeLock(lockFile,owner);
  });
  let closed=false,released=false,closePromise;
  const fileFor=id=>{if(!ROOM_ID.test(id))throw new Error('Invalid room ID');return path.join(directory,`room-${id}.json`);};
  return {
    async load() {
      const rooms=[];
      for(const name of await readdir(directory)) {
        const match=/^room-([A-Za-z0-9_-]{20,40})\.json$/.exec(name);if(!match)continue;
        const file=fileFor(match[1]);
        let room;
        try {
          const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>8*1024*1024)throw new Error('Invalid room file');
          const candidate=JSON.parse(await readFile(file,'utf8'));refuseFuture(candidate);room=validateRoom(candidate);if(room.id!==match[1])throw new Error('Room ID mismatch');
        } catch(error) {if(['MAP_UNAVAILABLE','VERSION_UNAVAILABLE'].includes(error.code))throw error;await rename(file,`${file}.quarantine-${randomUUID()}`);continue;}
        // Missing deployment geometry is a setup error, not corrupt user data.
        const geometry=[2,3].includes(room.state?.schemaVersion)&&!room.state?.mapId&&!room.state?.map&&room.state?.mapRevision===undefined?await worldGeometry(providedGeometry):undefined;
        try{await validateRoomSnapshot(room,{worldGeometry:geometry});rooms.push(room);}catch{await rename(file,`${file}.quarantine-${randomUUID()}`);}
      }
      return rooms;
    },
    async save(room) {
      if(closed)throw new Error('Storage closed');await validateRoomSnapshot(room,{worldGeometry:providedGeometry});
      const file=fileFor(room.id), temporary=`${file}.${randomUUID()}.tmp`;
      const json=JSON.stringify(room);if(Buffer.byteLength(json)>8*1024*1024)throw new Error('Room storage limit');
      try {const handle=await open(temporary,'wx',0o600);try{await handle.writeFile(json);await handle.sync();}finally{await handle.close();}await rename(temporary,file);}
      catch(error){await unlink(temporary).catch(()=>{});throw error;}
    },
    async backup(id){
      if(closed)throw new Error('Storage closed');
      const file=fileFor(id),info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>8*1024*1024)throw new Error('Invalid room file');
      const bytes=await readFile(file,'utf8'),snapshot=await validateRoomSnapshot(JSON.parse(bytes),{worldGeometry:providedGeometry});if(snapshot.id!==id)throw new Error('Room ID mismatch');
      const backupFile=`${file}.backup-${randomUUID()}`,handle=await open(backupFile,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
      return {roomId:id,file:backupFile,schemaVersion:snapshot.state?.schemaVersion??null};
    },
    async remove(id){await unlink(fileFor(id)).catch(error=>{if(error.code!=='ENOENT')throw error;});},
    async close(){
      if(released)return;
      if(closePromise)return closePromise;
      closed=true;
      closePromise=withRecoveryClaim(claimFile,async()=>{await unlinkOwned(lockFile,owner);});
      try {await closePromise;released=true;}finally{closePromise=null;}
    }
  };
}
