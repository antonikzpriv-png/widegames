import {randomBytes,createHash} from 'node:crypto';
import {LOBBY_DEFAULTS,rosterFor} from '../shared/lobby.mjs';
import {ROOM_ID,validateRoom} from './store.mjs';

export class ServiceError extends Error {
  constructor(status,code,message){super(message);this.status=status;this.code=code;}
}
export const fail=(status,code,message)=>{throw new ServiceError(status,code,message);};
export const requestId=id=>typeof id==='string' && /^[A-Za-z0-9:_-]{1,100}$/.test(id);
const hash=token=>createHash('sha256').update(token).digest('hex');
export const cookieName=id=>`lw_${id}`;
export function identityFor(room,header='') {
  if(typeof header!=='string'||header.length>16000)return null;
  const matches=header.split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName(room.id)+'='));
  if(matches.length!==1)return null;
  const token=matches[0].slice(cookieName(room.id).length+1);if(!/^[a-f0-9]{64}$/.test(token))return null;
  return room.identities.find(i=>i.hash===hash(token)&&!i.revoked)||null;
}
export function issueIdentity(room,host=false) {
  if(room.identities.length>=128)fail(429,'ROOM_FULL','This room has reached its visitor limit.');
  const token=randomBytes(32).toString('hex');
  const identity={hash:hash(token),host,seatId:host && room.mode==='human'?'p1':null,...(room.schema===2?{ready:host&&room.mode==='human',revoked:false}:{})};
  room.identities.push(identity);return {token,identity};
}
export function cookie(roomId,token,secure) {
  return `${cookieName(roomId)}=${token}; Path=/api/rooms/${roomId}; HttpOnly; SameSite=Strict; Max-Age=604800${secure?'; Secure':''}`;
}
export function createRoom(mode,now,configurable=false) {
  const id=randomBytes(18).toString('base64url');
  if(!configurable)return {schema:1,id,mode,createdAt:now,updatedAt:now,identities:[],state:null,startId:null,aiContext:{}};
  return {schema:2,id,mode,createdAt:now,updatedAt:now,identities:[],state:null,startId:null,aiContext:{},generation:1,revision:0,settings:{...LOBBY_DEFAULTS},roster:rosterFor(6),inviteCode:randomBytes(6).toString('hex').toUpperCase(),archives:[]};
}

export function createRooms({store,engine,ai,now=Date.now,maxActiveRooms=12,roomTtlMs=3600000,configurable=true}) {
  const rooms=new Map();let creationQueue=Promise.resolve();
  const entry=data=>({data,queue:Promise.resolve(),sockets:new Set(),aiBusy:false,aiBlocked:false,nextDecision:new Map(),abort:new AbortController(),removed:false});
  const get=id=>{if(!ROOM_ID.test(id)||!rooms.has(id))fail(404,'ROOM_NOT_FOUND','Room not found.');return rooms.get(id);};
  function run(room,fn) {
    const result=room.queue.catch(()=>{}).then(()=>{if(room.removed)fail(404,'ROOM_NOT_FOUND','Room not found.');return fn(room.data);});
    room.queue=result.catch(()=>{});return result;
  }
  async function commit(room,next){if(next.schema===2)next.revision=(room.data.revision??0)+1;next.updatedAt=Math.max(next.updatedAt,now());validateRoom(next);await store.save(next);room.data=next;}
  function view(room,identity) {
    const data=room.data;
    identity=data.identities.find(i=>i.hash===identity?.hash&&!i.revoked);if(!identity)fail(401,'ROOM_AUTH_REQUIRED','This room identity has been revoked.');
    const summary=ai.describe(data.aiContext);
    // Explicit allowlist: private AI memory and provider errors never cross transport.
    const safeAi={};for(const key of ['mode','provider','model','calls','tokens','costUsd','limitReason','strategy','navigation','council'])if(['string','number'].includes(typeof summary?.[key]))safeAi[key]=summary[key];
    const notices=Array.isArray(data.aiContext.notices)?data.aiContext.notices.filter(x=>typeof x==='string').slice(-10).map(x=>x.slice(0,240)):[];
    if(safeAi.mode==='live')notices.push('Hybrid AI: live model council; navigation and deck actions use local policy.');
    if(room.aiBlocked)notices.push('AI paused because durable storage or budget reservation failed.');
    return {roomId:data.id,...(data.schema===2?{generation:data.generation,revision:data.revision,inviteCode:data.inviteCode,settings:structuredClone(data.settings),ready:identity.ready,seats:data.roster.map(p=>({...p,persona:undefined,human:data.identities.some(i=>i.seatId===p.id),ready:data.identities.some(i=>i.seatId===p.id&&i.ready&&!i.revoked),host:data.identities.some(i=>i.seatId===p.id&&i.host)})),archives:data.archives.map(a=>({matchId:a.matchId,generation:a.generation}))}:{}),mode:data.mode,isHost:identity.host,seatId:identity.seatId,phase:data.state?.phase||'lobby',connection:'connected',game:data.state?engine.getPlayerView(data.state,identity.seatId,now()):null,ai:safeAi,notices,createdAt:data.createdAt};
  }
  async function restore() {
    for(const data of await store.load()) {
      if(!data.state || ['ended','paused'].includes(data.state.phase)) {
        if(now()-data.updatedAt>=roomTtlMs){await store.remove(data.id);continue;}
      }
      // Exercise engine deserialization before accepting persisted hidden state.
      try {if(data.state)engine.getPlayerView(data.state,null,now());}
      catch{throw new Error('Persisted match cannot be restored safely');}
      rooms.set(data.id,entry(data));
    }
    if(rooms.size>maxActiveRooms)throw new Error('Persisted rooms exceed configured room limit');
  }
  async function create(mode,name) {
    const work=creationQueue.catch(()=>{}).then(async()=>{
      if(rooms.size>=maxActiveRooms)fail(429,'ROOM_LIMIT','All room slots are in use.');
      const data=createRoom(mode,now(),configurable), issued=issueIdentity(data,true);if(name&&issued.identity.seatId)data.roster[0].name=name;await store.save(data);
      const room=entry(data);rooms.set(data.id,room);return {room,...issued};
    });creationQueue=work;return work;
  }
  async function expire(room) {
    return run(room,async data=>{
      if(data.state&&!['ended','paused'].includes(data.state.phase))return false;
      if(now()-data.updatedAt<roomTtlMs)return false;
      await store.remove(data.id);room.removed=true;room.abort.abort();for(const ws of room.sockets)ws.close(1001,'Room expired');rooms.delete(data.id);return true;
    });
  }
  return {rooms,get,run,commit,view,restore,create,expire,validate:validateRoom};
}
