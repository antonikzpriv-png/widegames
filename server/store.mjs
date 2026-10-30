import {validateFeatures} from './feature-validation.mjs';
import {canWorldAct} from '../shared/features.mjs';
import {validProgress} from './engine/tasks.mjs';
import {mkdir, readdir, lstat, readFile, open, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateReplayHistory,REPLAY_LIMITS} from '../shared/replay.mjs';
import {ROOM_LAYOUT} from '../shared/contracts.mjs';
import {normalizeRoster,PLAYER_ID} from './features/lobbies/index.mjs';
import {DEFAULT_BEACON_RULES} from '../shared/beacon.mjs';
import {validateSystemsState} from './engine/systems/index.mjs';
import {validateInvestigationState} from './engine/investigation/index.mjs';
import {createSpatialWorld} from './engine/world/index.mjs';
import * as defaultGeometry from '../shared/world.mjs';
import {validateStationChallenge,stationComplete} from '../shared/station-challenges.mjs';
import {getMap} from '../shared/maps/index.mjs';
import {TACTICAL_PRESET,validateMapSelection} from '../shared/tactical.mjs';
const spatialValidator=createSpatialWorld(defaultGeometry);
const extended=state=>[3,4,5].includes(state.schemaVersion);
const mapRooms=state=>[4,5].includes(state.schemaVersion)?getMap(state.map).roomLayout:ROOM_LAYOUT;

export const ROOM_ID = /^[A-Za-z0-9_-]{20,40}$/;
const phases = new Set(['roam','discussion','voting','ended','paused']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateRoom(room) {
  if (!object(room) || ![1,2,3,4].includes(room.schema) || !ROOM_ID.test(room.id) || !['human','spectator'].includes(room.mode)) throw new Error('Invalid room');
  if (![room.createdAt,room.updatedAt].every(n => Number.isSafeInteger(n) && n >= 0) || room.updatedAt < room.createdAt) throw new Error('Invalid room time');
  if (!Array.isArray(room.identities) || !room.identities.length || room.identities.length > 128) throw new Error('Invalid identities');
  const setup=[2,3,4].includes(room.schema)?normalizeRoster({...room.lobby,mode:room.mode}):null;
  if([3,4].includes(room.schema))validateTacticalRoomMetadata(room);
  if(room.schema===4?room.stationTasksVersion!==1:Object.hasOwn(room,'stationTasksVersion'))throw new Error('Invalid room station task version');
  const seatIds=setup?setup.humanPlayerIds:room.mode==='human'?['p1']:[];
  const seen = new Set(),seenSeats=new Set();
  for (const identity of room.identities) {
    if (!object(identity) || !/^[a-f0-9]{64}$/.test(identity.hash) || seen.has(identity.hash) || typeof identity.host !== 'boolean' || !(identity.seatId===null||seatIds.includes(identity.seatId))) throw new Error('Invalid identity');
    if(identity.seatId){if(room.mode!=='human'||seenSeats.has(identity.seatId)||(room.schema===1&&!identity.host))throw new Error('Invalid seat');seenSeats.add(identity.seatId);}
    seen.add(identity.hash);
  }
  if (room.identities.filter(i=>i.host).length !== 1 || (room.schema===1?room.identities.filter(i=>i.seatId).length !== (room.mode === 'human' ? 1 : 0):room.identities.filter(i=>i.seatId).length>seatIds.length)) throw new Error('Invalid host');
  if (!object(room.aiContext) || (room.startId !== null && (typeof room.startId !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(room.startId)))) throw new Error('Invalid metadata');
  if (room.state !== null && (!object(room.state) || room.state.id !== room.id || !phases.has(room.state.phase) || !Number.isSafeInteger(room.state.version) || !Array.isArray(room.state.players) || (room.schema===1?room.state.players.length!==6:room.state.players.length!==setup.players.length) || room.startId === null)) throw new Error('Invalid match');
  if (room.state === null && room.startId !== null) throw new Error('Invalid lobby');
  if(room.state!==null){
    const state=room.state;
    if(state.replayHistory!==undefined){
      if(![2,3,4,5].includes(state.schemaVersion))throw new Error('Mixed legacy/world replay history');
      validateReplayHistory(state.replayHistory);
      if(state.replayHistory.checkpoints.some(a=>a.at<state.startedAt||a.at>state.updatedAt||a.sequence>state.replaySequence))throw new Error('Replay checkpoint exceeds match history');
    }
    if(state.replayBytes!==undefined&&(!Number.isSafeInteger(state.replayBytes)||state.replayBytes<0||state.replayBytes>REPLAY_LIMITS.bytes||!Array.isArray(state.replay)||state.replay.length>REPLAY_LIMITS.events||state.replayBytes!==state.replay.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0)))throw new Error('Invalid replay byte accounting');
    if(![1,2,3,4,5].includes(state.schemaVersion)||state.mode!==room.mode||state.version<1)throw new Error('Unsupported match schema');
    if([4,5].includes(state.schemaVersion)){if(room.schema!==(state.schemaVersion===5?4:3)||state.tacticalVersion!==1||validateMapSelection(state.map).id!==room.map.id||state.map.version!==room.map.version||state.preset?.id!==room.preset.id||state.preset?.version!==room.preset.version||Object.keys(state.preset).length!==2)throw new Error('Tactical match selection mismatch');}
    else if(['map','preset','tacticalVersion'].some(key=>Object.hasOwn(state,key)))throw new Error('Mixed tactical/legacy match');
    if([3,4].includes(room.schema)&&state.schemaVersion!==(room.schema===4?5:4))throw new Error('Tactical lobby needs matching versioned match');
    if(state.schemaVersion===5?state.stationTasksVersion!==1:Object.hasOwn(state,'stationTasksVersion'))throw new Error('Invalid station task version');
    if(state.schemaVersion===1){
      if(Object.hasOwn(state,'worldVersion')||state.players.some(p=>Object.hasOwn(p,'position')||Object.hasOwn(p,'motion')))throw new Error('Mixed legacy/world match');
    }else validateWorldStructure(state);
    if(extended(state)){if(![2,3,4].includes(room.schema))throw new Error('Beacon match requires versioned lobby');validateBeaconStructure(state,setup);}
  }
  validateFeatures(room);
  return room;
}

function validateTacticalRoomMetadata(room){
 const reference=validateMapSelection(room.map);let map;try{map=getMap(reference);}catch{throw Object.assign(new Error('Saved map version is unavailable; preserve the data directory and install the matching application version.'),{code:'MAP_UNAVAILABLE'});}if(map.id!==room.map.id||!object(room.preset)||Object.keys(room.preset).length!==2||room.preset.id!==TACTICAL_PRESET.id||room.preset.version!==TACTICAL_PRESET.version)throw new Error('Unsupported tactical preset');
 const s=room.settings;if(!object(s)||Object.keys(s).length!==2||!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.requests)||s.requests.length>64||s.revision!==s.requests.filter(r=>r?.accepted===true).length||new Set(s.requests.map(r=>r?.id)).size!==s.requests.length)throw new Error('Invalid lobby settings ledger');
 for(const r of s.requests)if(!object(r)||typeof r.id!=='string'||!/^[A-Za-z0-9:_-]{1,100}$/.test(r.id)||typeof r.fingerprint!=='string'||r.fingerprint.length>300||typeof r.accepted!=='boolean'||!Number.isSafeInteger(r.revision)||r.revision<0||r.revision>s.revision||Object.keys(r).some(k=>!['id','fingerprint','accepted','revision','error'].includes(k))||(!r.accepted&&(!object(r.error)||typeof r.error.code!=='string'||typeof r.error.message!=='string'||r.error.message.length>240))||(r.accepted&&Object.hasOwn(r,'error')))throw new Error('Invalid lobby setting receipt');
}
const finiteTime=value=>Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
const point=value=>object(value)&&Number.isFinite(value.x)&&Number.isFinite(value.y);
function validateWorldStructure(state){
  const roomIds=new Set(mapRooms(state).map(r=>r.id));
  if(state.worldVersion!==1||!finiteTime(state.startedAt)||!finiteTime(state.updatedAt)||state.updatedAt<state.startedAt||!Array.isArray(state.bodies))throw new Error('Invalid world match');
  const ids=new Set();
  for(const player of state.players){
    if(!object(player)||!(extended(state)?PLAYER_ID.test(player.id):/^p[1-6]$/.test(player.id))||ids.has(player.id)||!['crew','saboteur'].includes(player.role)||typeof player.alive!=='boolean'||!roomIds.has(player.roomId)||player.human!==(extended(state)?state.configuration.humanPlayerIds.includes(player.id):state.mode==='human'&&player.id==='p1')||!point(player.position))throw new Error('Invalid world player');
    if(!Array.isArray(player.tasks)||player.tasks.length>(extended(state)?240:100)||player.tasks.some(t=>Object.hasOwn(t,'progress')&&!validProgress(t.progress,t,state)))throw new Error('Invalid task progress');
    ids.add(player.id);const motion=player.motion;
    if(!object(motion)||!Number.isSafeInteger(motion.seq)||motion.seq<0||![motion.dx,motion.dy].every(n=>Number.isInteger(n)&&n>=-1&&n<=1)||typeof motion.manual!=='boolean'||![motion.at,motion.leaseUntil,motion.recordedAt].every(finiteTime)||motion.at>state.updatedAt+1e-6||motion.recordedAt>state.updatedAt+1e-6||!Array.isArray(motion.path)||motion.path.length>4096||motion.path.some(p=>!point(p))||(motion.destination!==null&&!point(motion.destination)))throw new Error('Invalid world motion');
    // Early schema-2 checkpoints lack error; new Core persists null or a bounded receipt.
    if(Object.hasOwn(motion,'error')&&motion.error!==null){
      const error=motion.error;
      if(!object(error)||Object.keys(error).length!==2||!Object.hasOwn(error,'code')||!Object.hasOwn(error,'message')||typeof error.code!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)||typeof error.message!=='string'||error.message.length<1||error.message.length>240)throw new Error('Invalid world motion error');
    }
    if((motion.manual&&(!(motion.dx||motion.dy)||motion.path.length||motion.destination!==null))||(motion.path.length===0)!==(motion.destination===null)||((!canWorldAct(state,player)||state.phase!=='roam')&&(motion.manual||motion.path.length||motion.destination!==null)))throw new Error('Inconsistent world motion');
  }
  if(state.players.filter(player=>player.role==='saboteur').length!==(extended(state)?state.configuration.saboteurCount:1))throw new Error('Invalid world role assignment');
  for(const body of state.bodies)if(!object(body)||!(extended(state)?body.id==='body-'+body.playerId:/^body-p[1-6]$/.test(body.id))||!ids.has(body.playerId)||!roomIds.has(body.roomId)||typeof body.reported!=='boolean'||!point(body.position)||!finiteTime(body.at)||body.at>state.updatedAt)throw new Error('Invalid world body');
}
function validateBeaconStructure(state,setup){
 const roomIds=new Set(mapRooms(state).map(r=>r.id));
 if(state.beaconVersion!==1||!object(state.configuration)||!object(state.beaconRules)||state.deathPolicy!=='redistribute-at-muster'||!object(state.abilities)||!Array.isArray(state.replaySnapshots)||state.replaySnapshots.length>256)throw new Error('Invalid beacon state');
 const stored=normalizeRoster({...state.configuration,roster:state.configuration.players,mode:state.mode});
 if(JSON.stringify(stored)!==JSON.stringify(setup)||state.players.some(p=>!setup.players.some(q=>q.id===p.id&&q.name===p.name&&q.color===p.color)))throw new Error('Beacon roster mismatch');
 for(const key of Object.keys(DEFAULT_BEACON_RULES))if(!Number.isSafeInteger(state.beaconRules[key])||state.beaconRules[key]<1||state.beaconRules[key]>86400000)throw new Error('Invalid beacon rule');
 if(Object.keys(state.beaconRules).length!==Object.keys(DEFAULT_BEACON_RULES).length||state.beaconRules.visionRadius<80||state.beaconRules.visionRadius>900||state.beaconRules.saboteurVisionRadius<80||state.beaconRules.saboteurVisionRadius>900||state.beaconRules.lightsVisionRadius>state.beaconRules.visionRadius||state.beaconRules.observationLimit>64)throw new Error('Invalid beacon vision');
 validateSystemsState(state);validateInvestigationState(state);([4,5].includes(state.schemaVersion)?createSpatialWorld(getMap(state.map).geometry):spatialValidator).validateSpatialState(state);
 const ids=new Set(state.players.map(p=>p.id));
 if(!object(state.requests)||Object.keys(state.requests).length!==ids.size||Object.keys(state.requests).some(id=>!ids.has(id)))throw new Error('Invalid request ledger');
 for(const p of state.players){
  if(!Array.isArray(p.tasks)||p.tasks.length>240||typeof p.human!=='boolean'||!object(p.cooldowns)||!Number.isSafeInteger(p.meetingsRemaining)||p.meetingsRemaining<0||p.meetingsRemaining>10)throw new Error('Invalid keeper state');
  for(const t of p.tasks)if(!object(t)||typeof t.id!=='string'||t.id.length>100||!roomIds.has(t.roomId)||typeof t.label!=='string'||t.label.length>200||typeof t.completed!=='boolean')throw new Error('Invalid task state');
  for(const task of p.tasks){if(state.schemaVersion===5){if(task.kind!=='station')throw new Error('Invalid station task kind');validateStationChallenge(task.challenge);if(task.completed!==stationComplete(task.challenge))throw new Error('Inconsistent station task progress');}else if(task.kind==='station'||Object.hasOwn(task,'challenge'))throw new Error('Mixed station/legacy tasks');}
  for(const key of ['moveAt','taskAt','killAt','sabotageAt','meetingAt'])if(!finiteTime(p.cooldowns[key]))throw new Error('Invalid cooldown');
  const requests=state.requests[p.id];if(!Array.isArray(requests)||requests.length>2048||new Set(requests.map(r=>r.id)).size!==requests.length||requests.some(r=>!object(r)||typeof r.id!=='string'||!/^[A-Za-z0-9:_-]{1,100}$/.test(r.id)||typeof r.fingerprint!=='string'||r.fingerprint.length>10000||typeof r.accepted!=='boolean'))throw new Error('Invalid accepted request history');
 }
 for(const [id,entry]of Object.entries(state.abilities)){if(!ids.has(id)||!object(entry)||!finiteTime(entry.nextAt)||!Array.isArray(entry.notes)||entry.notes.length>32||entry.notes.some(n=>!object(n)||!finiteTime(n.at)||n.at>state.updatedAt||!roomIds.has(n.roomId)||!point(n.position)))throw new Error('Invalid ability state');}
 if(!Array.isArray(state.replay)||state.replay.length>12000||!Array.isArray(state.events)||state.events.length>256)throw new Error('Invalid event history');
 let previous=-1;for(const snap of state.replaySnapshots){if([4,5].includes(state.schemaVersion)&&(!snap.map||snap.map.id!==state.map.id||snap.map.version!==state.map.version||Object.keys(snap.map).length!==2))throw new Error('Replay map mismatch');if(!object(snap)||snap.version!==1||!finiteTime(snap.at)||snap.at<previous||snap.at>state.updatedAt||!phases.has(snap.phase)||!Array.isArray(snap.players)||snap.players.length!==ids.size||snap.players.some(p=>!ids.has(p.id)||!point(p.position)||typeof p.alive!=='boolean'))throw new Error('Invalid replay snapshot');previous=snap.at;}
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
    const geometry=[4,5].includes(room.state.schemaVersion)?getMap(room.state.map).geometry:await worldGeometry(provided),{WORLD,isWalkable}=geometry;
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
          const candidate=JSON.parse(await readFile(file,'utf8'));if(Number.isSafeInteger(candidate.schema)&&candidate.schema>4||Number.isSafeInteger(candidate.state?.schemaVersion)&&candidate.state.schemaVersion>5||(Number.isSafeInteger(candidate.state?.features?.version)&&candidate.state.features.version>1)||(Number.isSafeInteger(candidate.state?.replayHistory?.version)&&candidate.state.replayHistory.version>2)||candidate.stationTasksVersion>1||candidate.state?.stationTasksVersion>1||candidate.state?.players?.some?.(p=>p.tasks?.some?.(t=>t.kind==='station'&&t.challenge?.version>1)))throw Object.assign(new Error('Saved room version is newer than this application; preserve the data directory.'),{code:'VERSION_UNAVAILABLE'});room=validateRoom(candidate);if(room.id!==match[1])throw new Error('Room ID mismatch');
        } catch(error) {if(['MAP_UNAVAILABLE','VERSION_UNAVAILABLE'].includes(error.code))throw error;await rename(file,`${file}.quarantine-${randomUUID()}`);continue;}
        // Missing deployment geometry is a setup error, not corrupt user data.
        const geometry=[2,3].includes(room.state?.schemaVersion)?await worldGeometry(providedGeometry):undefined;
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
