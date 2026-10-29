import {mkdir, readdir, lstat, readFile, open, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

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
export async function createRoomStore(directory) {
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
        try {
          const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>8*1024*1024)throw new Error('Invalid room file');
          const room=validateRoom(JSON.parse(await readFile(file,'utf8')));if(room.id!==match[1])throw new Error('Room ID mismatch');rooms.push(room);
        } catch {await rename(file,`${file}.quarantine-${randomUUID()}`);}
      }
      return rooms;
    },
    async save(room) {
      if(closed)throw new Error('Storage closed');validateRoom(room);
      const file=fileFor(room.id), temporary=`${file}.${randomUUID()}.tmp`;
      const json=JSON.stringify(room);if(Buffer.byteLength(json)>8*1024*1024)throw new Error('Room storage limit');
      try {const handle=await open(temporary,'wx',0o600);try{await handle.writeFile(json);await handle.sync();}finally{await handle.close();}await rename(temporary,file);}
      catch(error){await unlink(temporary).catch(()=>{});throw error;}
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
