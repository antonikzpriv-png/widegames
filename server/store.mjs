import {mkdir, readdir, lstat, readFile, open, rename, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateSettings,ACTOR_ID,PERSONAS,playerName} from '../shared/lobby.mjs';
import {ROOM_LAYOUT,DEFAULT_RULES} from '../shared/contracts.mjs';

export const ROOM_ID = /^[A-Za-z0-9_-]{20,40}$/;
const phases = new Set(['roam','discussion','voting','ended','paused']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateRoom(room) {
  if (!object(room) || ![1,2].includes(room.schema) || !ROOM_ID.test(room.id) || !['human','spectator'].includes(room.mode)) throw new Error('Invalid room');
  if (![room.createdAt,room.updatedAt].every(n => Number.isSafeInteger(n) && n >= 0) || room.updatedAt < room.createdAt) throw new Error('Invalid room time');
  if (!Array.isArray(room.identities) || !room.identities.length || room.identities.length > 128) throw new Error('Invalid identities');
  const seen = new Set();
  for (const identity of room.identities) {
    if (!object(identity) || !/^[a-f0-9]{64}$/.test(identity.hash) || seen.has(identity.hash) || typeof identity.host !== 'boolean' || !(identity.seatId===null||(room.schema===2?ACTOR_ID.test(identity.seatId):identity.seatId==='p1'))) throw new Error('Invalid identity');
    if (room.schema===1&&identity.seatId && (!identity.host || room.mode !== 'human')) throw new Error('Invalid seat');
    seen.add(identity.hash);
  }
  if (room.identities.filter(i=>i.host).length !== 1 || (room.schema===1&&room.identities.filter(i=>i.seatId).length !== (room.mode === 'human' ? 1 : 0))) throw new Error('Invalid host');
  if (!object(room.aiContext) || (room.startId !== null && (typeof room.startId !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(room.startId)))) throw new Error('Invalid metadata');
  if (room.state !== null && (!object(room.state) || room.state.id !== (room.schema===2&&room.generation>1?`${room.id}_g${room.generation}`:room.id) || !phases.has(room.state.phase) || !Number.isSafeInteger(room.state.version) || !Array.isArray(room.state.players) || room.state.players.length !== (room.schema===2?room.settings.capacity:6) || room.startId === null)) throw new Error('Invalid match');
  if (room.state === null && room.startId !== null) throw new Error('Invalid lobby');
  if(room.schema===2)validateLobby(room);
  if(room.state!==null){
    const state=room.state;
    if(room.schema===1&&Object.hasOwn(state,'lobbySettings'))throw Error('Dynamic settings require room container schema2');
    if(![1,2].includes(state.schemaVersion)||state.mode!==room.mode||state.version<1)throw new Error('Unsupported match schema');
    if(state.schemaVersion===1){
      if(Object.hasOwn(state,'worldVersion')||state.players.some(p=>Object.hasOwn(p,'position')||Object.hasOwn(p,'motion')))throw new Error('Mixed legacy/world match');
    }else validateWorldStructure(state,room.schema===2);
  }
  return room;
}

const roomIds=new Set(ROOM_LAYOUT.map(room=>room.id));
const finiteTime=value=>Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
const point=value=>object(value)&&Number.isFinite(value.x)&&Number.isFinite(value.y);
function validateWorldStructure(state,dynamic=false){
  if(state.worldVersion!==1||!finiteTime(state.startedAt)||!finiteTime(state.updatedAt)||state.updatedAt<state.startedAt||!Array.isArray(state.bodies))throw new Error('Invalid world match');
  const ids=new Set();
  for(const player of state.players){
    if(!object(player)||!(dynamic?ACTOR_ID.test(player.id):/^p[1-6]$/.test(player.id))||ids.has(player.id)||!['crew','saboteur'].includes(player.role)||typeof player.alive!=='boolean'||!roomIds.has(player.roomId)||(dynamic?typeof player.human!=='boolean':player.human!==(state.mode==='human'&&player.id==='p1'))||!point(player.position))throw new Error('Invalid world player');
    ids.add(player.id);const motion=player.motion;
    if(!object(motion)||!Number.isSafeInteger(motion.seq)||motion.seq<0||![motion.dx,motion.dy].every(n=>Number.isInteger(n)&&n>=-1&&n<=1)||typeof motion.manual!=='boolean'||![motion.at,motion.leaseUntil,motion.recordedAt].every(finiteTime)||motion.at>state.updatedAt+1e-6||motion.recordedAt>state.updatedAt+1e-6||!Array.isArray(motion.path)||motion.path.length>4096||motion.path.some(p=>!point(p))||(motion.destination!==null&&!point(motion.destination)))throw new Error('Invalid world motion');
    // Early schema-2 checkpoints lack error; new Core persists null or a bounded receipt.
    if(Object.hasOwn(motion,'error')&&motion.error!==null){
      const error=motion.error;
      if(!object(error)||Object.keys(error).length!==2||!Object.hasOwn(error,'code')||!Object.hasOwn(error,'message')||typeof error.code!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)||typeof error.message!=='string'||error.message.length<1||error.message.length>240)throw new Error('Invalid world motion error');
    }
    if((motion.manual&&(!(motion.dx||motion.dy)||motion.path.length||motion.destination!==null))||(motion.path.length===0)!==(motion.destination===null)||((!player.alive||state.phase!=='roam')&&(motion.manual||motion.path.length||motion.destination!==null)))throw new Error('Inconsistent world motion');
  }
  if(state.players.filter(player=>player.role==='saboteur').length!==(dynamic?state.lobbySettings.saboteurs:1))throw new Error('Invalid world role assignment');
  for(const body of state.bodies)if(!object(body)||body.id!==`body-${body.playerId}`||!ACTOR_ID.test(body.playerId)||!ids.has(body.playerId)||!roomIds.has(body.roomId)||typeof body.reported!=='boolean'||!point(body.position)||!finiteTime(body.at)||body.at>state.updatedAt)throw new Error('Invalid world body');
}

function validateLobby(room){
 validateSettings(room.settings);
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
  if(!object(a)||typeof a.matchId!=='string'||!Number.isSafeInteger(a.generation)||a.generation>=room.generation||a.generation<0||a.matchId!==(a.generation<=1?room.id:`${room.id}_g${a.generation}`)||archived.has(a.generation)||!Array.isArray(a.replay)||a.replay.length>2000||Buffer.byteLength(JSON.stringify(a.replay))>1000000||a.replay.some(e=>!object(e)||!finiteTime(e.at)||typeof e.type!=='string')||!Array.isArray(a.players)||a.players.length<4||a.players.length>15||a.players.some((p,i)=>!object(p)||p.id!==`p${i+1}`||typeof p.name!=='string'||playerName(p.name)!==p.name||!PERSONAS.some(q=>q.color===p.color)||!['crew','saboteur'].includes(p.role))||a.players.filter(p=>p.role==='saboteur').length<1||a.players.filter(p=>p.role==='saboteur').length>3||a.players.filter(p=>p.role==='saboteur').length*2>=a.players.length)throw Error('Invalid archived replay');archived.add(a.generation);
 }
 if(room.state){
  const state=room.state;validateSettings(state.lobbySettings);
  if(JSON.stringify(state.lobbySettings)!==JSON.stringify(room.settings)||state.players.length!==room.roster.length||state.players.filter(p=>p.role==='saboteur').length!==room.settings.saboteurs)throw Error('Invalid locked settings');
  if(!object(state.rules)||Object.keys(state.rules).length!==Object.keys(DEFAULT_RULES).length||Object.keys(DEFAULT_RULES).some(k=>!Number.isSafeInteger(state.rules[k])||state.rules[k]<1||state.rules[k]>86400000)||state.rules.tasksPerCrew>20||state.rules.meetingsPerPlayer>10||state.rules.messagesPerDiscussion>20||state.rules.messageMaxLength>2000)throw Error('Invalid match rules');
  const taskIds=new Set();
  for(const [i,p]of state.players.entries()){
   if(!object(p)||p.id!==room.roster[i].id||p.name!==room.roster[i].name||p.color!==room.roster[i].color||p.badge!==room.roster[i].badge||p.persona!==PERSONAS[i].persona||typeof p.alive!=='boolean'||!['crew','saboteur'].includes(p.role)||p.human!==occupied.has(p.id)||!Array.isArray(p.tasks)||p.tasks.length>280||(p.role==='saboteur'&&p.tasks.length!==0)||!object(p.cooldowns)||Object.values(p.cooldowns).some(n=>!finiteTime(n))||!Number.isSafeInteger(p.meetingsRemaining)||p.meetingsRemaining<0||!roomIds.has(p.roomId))throw Error('Invalid dynamic player');
   for(const t of p.tasks){if(!object(t)||typeof t.id!=='string'||taskIds.has(t.id)||!roomIds.has(t.roomId)||typeof t.label!=='string'||typeof t.completed!=='boolean')throw Error('Invalid task');taskIds.add(t.id);}
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
  if(room.state?.schemaVersion===2){
    const geometry=await worldGeometry(provided),{WORLD,isWalkable}=geometry;
    const validPoint=p=>point(p)&&p.x>=0&&p.y>=0&&p.x<=WORLD.width&&p.y<=WORLD.height&&isWalkable(p);
    for(const player of room.state.players){
      const m=player.motion;
      if(!validPoint(player.position)||m.path.some(p=>!validPoint(p))||(m.destination!==null&&!validPoint(m.destination))||m.leaseUntil>m.at+WORLD.inputLeaseMs+1e-6)throw new Error('Invalid world position or input lease');
    }
    for(const body of room.state.bodies)if(!validPoint(body.position))throw new Error('Invalid world body position');
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
