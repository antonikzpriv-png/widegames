import {mkdir, readdir, lstat, readFile, open, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateReplayHistory,REPLAY_LIMITS} from '../shared/replay.mjs';
import {ROOM_LAYOUT} from '../shared/contracts.mjs';

export const ROOM_ID = /^[A-Za-z0-9_-]{20,40}$/;
const phases = new Set(['roam','discussion','voting','ended','paused']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateRoom(room) {
  if (!object(room) || room.schema !== 1 || !ROOM_ID.test(room.id) || !['human','spectator'].includes(room.mode)) throw new Error('Invalid room');
  if (![room.createdAt,room.updatedAt].every(n => Number.isSafeInteger(n) && n >= 0) || room.updatedAt < room.createdAt) throw new Error('Invalid room time');
  if (!Array.isArray(room.identities) || !room.identities.length || room.identities.length > 128) throw new Error('Invalid identities');
  const seen = new Set();
  for (const identity of room.identities) {
    if (!object(identity) || !/^[a-f0-9]{64}$/.test(identity.hash) || seen.has(identity.hash) || typeof identity.host !== 'boolean' || ![null,'p1'].includes(identity.seatId)) throw new Error('Invalid identity');
    if (identity.seatId && (!identity.host || room.mode !== 'human')) throw new Error('Invalid seat');
    seen.add(identity.hash);
  }
  if (room.identities.filter(i=>i.host).length !== 1 || room.identities.filter(i=>i.seatId).length !== (room.mode === 'human' ? 1 : 0)) throw new Error('Invalid host');
  if (!object(room.aiContext) || (room.startId !== null && (typeof room.startId !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(room.startId)))) throw new Error('Invalid metadata');
  if (room.state !== null && (!object(room.state) || room.state.id !== room.id || !phases.has(room.state.phase) || !Number.isSafeInteger(room.state.version) || !Array.isArray(room.state.players) || room.state.players.length !== 6 || room.startId === null)) throw new Error('Invalid match');
  if (room.state === null && room.startId !== null) throw new Error('Invalid lobby');
  if(room.state!==null){
    const state=room.state;
    if(state.replayHistory!==undefined){
      if(state.schemaVersion!==2)throw new Error('Mixed legacy/world replay history');
      validateReplayHistory(state.replayHistory);
      if(state.replayHistory.checkpoints.some(a=>a.at<state.startedAt||a.at>state.updatedAt||a.sequence>state.replaySequence))throw new Error('Replay checkpoint exceeds match history');
    }
    if(state.replayBytes!==undefined&&(!Number.isSafeInteger(state.replayBytes)||state.replayBytes<0||state.replayBytes>REPLAY_LIMITS.bytes||!Array.isArray(state.replay)||state.replay.length>REPLAY_LIMITS.events||state.replayBytes!==state.replay.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0)))throw new Error('Invalid replay byte accounting');
    if(![1,2].includes(state.schemaVersion)||state.mode!==room.mode||state.version<1)throw new Error('Unsupported match schema');
    if(state.schemaVersion===1){
      if(Object.hasOwn(state,'worldVersion')||state.players.some(p=>Object.hasOwn(p,'position')||Object.hasOwn(p,'motion')))throw new Error('Mixed legacy/world match');
    }else validateWorldStructure(state);
  }
  return room;
}

const roomIds=new Set(ROOM_LAYOUT.map(room=>room.id));
const finiteTime=value=>Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
const point=value=>object(value)&&Number.isFinite(value.x)&&Number.isFinite(value.y);
function validateWorldStructure(state){
  if(state.worldVersion!==1||!finiteTime(state.startedAt)||!finiteTime(state.updatedAt)||state.updatedAt<state.startedAt||!Array.isArray(state.bodies))throw new Error('Invalid world match');
  const ids=new Set();
  for(const player of state.players){
    if(!object(player)||!/^p[1-6]$/.test(player.id)||ids.has(player.id)||!['crew','saboteur'].includes(player.role)||typeof player.alive!=='boolean'||!roomIds.has(player.roomId)||player.human!==(state.mode==='human'&&player.id==='p1')||!point(player.position))throw new Error('Invalid world player');
    ids.add(player.id);const motion=player.motion;
    if(!object(motion)||!Number.isSafeInteger(motion.seq)||motion.seq<0||![motion.dx,motion.dy].every(n=>Number.isInteger(n)&&n>=-1&&n<=1)||typeof motion.manual!=='boolean'||![motion.at,motion.leaseUntil,motion.recordedAt].every(finiteTime)||motion.at>state.updatedAt+1e-6||motion.recordedAt>state.updatedAt+1e-6||!Array.isArray(motion.path)||motion.path.length>4096||motion.path.some(p=>!point(p))||(motion.destination!==null&&!point(motion.destination)))throw new Error('Invalid world motion');
    // Early schema-2 checkpoints lack error; new Core persists null or a bounded receipt.
    if(Object.hasOwn(motion,'error')&&motion.error!==null){
      const error=motion.error;
      if(!object(error)||Object.keys(error).length!==2||!Object.hasOwn(error,'code')||!Object.hasOwn(error,'message')||typeof error.code!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)||typeof error.message!=='string'||error.message.length<1||error.message.length>240)throw new Error('Invalid world motion error');
    }
    if((motion.manual&&(!(motion.dx||motion.dy)||motion.path.length||motion.destination!==null))||(motion.path.length===0)!==(motion.destination===null)||((!player.alive||state.phase!=='roam')&&(motion.manual||motion.path.length||motion.destination!==null)))throw new Error('Inconsistent world motion');
  }
  if(state.players.filter(player=>player.role==='saboteur').length!==1)throw new Error('Invalid world role assignment');
  for(const body of state.bodies)if(!object(body)||!/^body-p[1-6]$/.test(body.id)||!ids.has(body.playerId)||!roomIds.has(body.roomId)||typeof body.reported!=='boolean'||!point(body.position)||!finiteTime(body.at)||body.at>state.updatedAt)throw new Error('Invalid world body');
}
async function worldGeometry(supplied){
  const geometry=supplied??await import('../shared/world.mjs');
  if(!geometry?.WORLD||![geometry.WORLD.width,geometry.WORLD.height,geometry.WORLD.inputLeaseMs].every(n=>Number.isFinite(n)&&n>0)||typeof geometry.isWalkable!=='function')throw new Error('World geometry is unavailable');
  return geometry;
}
/** Read-only candidate validation, usable before an explicit offline migration. */
export async function validateRoomSnapshot(room,{worldGeometry:provided}={}){
  validateRoom(room);
  if(room.state?.schemaVersion===2){
    const geometry=await worldGeometry(provided),{WORLD,isWalkable}=geometry;
    const validPoint=p=>point(p)&&p.x>=0&&p.y>=0&&p.x<=WORLD.width&&p.y<=WORLD.height&&isWalkable(p);
    for(const player of room.state.players){
      const m=player.motion;
      if(!validPoint(player.position)||m.path.some(p=>!validPoint(p))||(m.destination!==null&&!validPoint(m.destination))||m.leaseUntil>m.at+WORLD.inputLeaseMs+1e-6)throw new Error('Invalid world position or input lease');
    }
    for(const body of room.state.bodies)if(!validPoint(body.position))throw new Error('Invalid world body position');
    for(const a of room.state.replayHistory?.checkpoints||[]){
      if(a.players.some(p=>!validPoint(p.position)||p.route.some(q=>!validPoint(q)))||a.bodies.some(b=>!validPoint(b.position)))throw new Error('Invalid replay checkpoint geometry');
    }
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
          room=validateRoom(JSON.parse(await readFile(file,'utf8')));if(room.id!==match[1])throw new Error('Room ID mismatch');
        } catch {await rename(file,`${file}.quarantine-${randomUUID()}`);continue;}
        // Missing deployment geometry is a setup error, not corrupt user data.
        const geometry=room.state?.schemaVersion===2?await worldGeometry(providedGeometry):undefined;
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
