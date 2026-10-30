import {randomBytes,createHash} from 'node:crypto';
import {ROOM_ID,validateRoom} from './store.mjs';
import {normalizeRoster,publicRoster} from './features/lobbies/index.mjs';
import {getMap,MAP_CATALOG} from '../shared/maps/index.mjs';
import {TACTICAL_PRESET} from '../shared/tactical.mjs';

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
  return room.identities.find(i=>i.hash===hash(token))||null;
}
export function issueIdentity(room,host=false) {
  if(room.identities.length>=128)fail(429,'ROOM_FULL','This room has reached its visitor limit.');
  const token=randomBytes(32).toString('hex');
  const identity={hash:hash(token),host,seatId:host&&room.mode==='human'?(room.lobby?.humanPlayerIds[0]??'p1'):null};
  room.identities.push(identity);return {token,identity};
}
export function cookie(roomId,token,secure) {
  return `${cookieName(roomId)}=${token}; Path=/api/rooms/${roomId}; HttpOnly; SameSite=Strict; Max-Age=604800${secure?'; Secure':''}`;
}
export function createRoom(mode,now,lobbyConfig,{tactical=false,mapId}={}) {
  const id=randomBytes(18).toString('base64url');
  const setup=(lobbyConfig||tactical)?normalizeRoster({...lobbyConfig,mode,...(mode==='spectator'?{humanPlayerIds:[]}: {})}):null;
  const selected=tactical?getMap(mapId):null;
  return {schema:tactical?3:setup?2:1,...(tactical?{map:{id:selected.id,version:selected.version},preset:{id:TACTICAL_PRESET.id,version:TACTICAL_PRESET.version},settings:{revision:0,requests:[]}}:{}),...(setup?{lobby:{roster:setup.players,saboteurCount:setup.saboteurCount,humanPlayerIds:setup.humanPlayerIds}}:{}),id,mode,createdAt:now,updatedAt:now,identities:[],state:null,startId:null,aiContext:{}};
}

export function createRooms({store,engine,ai,now=Date.now,maxActiveRooms=12,roomTtlMs=3600000,lobbyConfig,tacticalMode=false,mapId}) {
  const rooms=new Map();let creationQueue=Promise.resolve();
  const entry=data=>({data,queue:Promise.resolve(),sockets:new Set(),aiBusy:false,aiBlocked:false,nextDecision:new Map(),abort:new AbortController(),removed:false});
  const get=id=>{if(!ROOM_ID.test(id)||!rooms.has(id))fail(404,'ROOM_NOT_FOUND','Room not found.');return rooms.get(id);};
  function run(room,fn) {
    const result=room.queue.catch(()=>{}).then(()=>{if(room.removed)fail(404,'ROOM_NOT_FOUND','Room not found.');return fn(room.data);});
    room.queue=result.catch(()=>{});return result;
  }
  async function commit(room,next){next.updatedAt=Math.max(next.updatedAt,now());validateRoom(next);await store.save(next);room.data=next;}
  function view(room,identity) {
    const data=room.data;
    const summary=ai.describe(data.aiContext);
    // Explicit allowlist: private AI memory and provider errors never cross transport.
    const safeAi={};for(const key of ['mode','provider','model','calls','tokens','costUsd','limitReason','strategy','navigation','council'])if(['string','number'].includes(typeof summary?.[key]))safeAi[key]=summary[key];
    const notices=Array.isArray(data.aiContext.notices)?data.aiContext.notices.filter(x=>typeof x==='string').slice(-10).map(x=>x.slice(0,240)):[];
    if(safeAi.mode==='live')notices.push('Hybrid AI: live model council; navigation and deck actions use local policy.');
    if(room.aiBlocked)notices.push('AI paused because durable storage or budget reservation failed.');
    return {...(data.schema===3?{map:{...data.map},preset:{...data.preset},availableMaps:MAP_CATALOG,settingsRevision:data.settings.revision}:{}),...([2,3].includes(data.schema)?{roster:data.lobby.roster.map(({id,name,color,persona})=>({id,name,color,persona}))}:{}),roomId:data.id,mode:data.mode,isHost:identity.host,seatId:identity.seatId,phase:data.state?.phase||'lobby',connection:'connected',game:data.state?engine.getPlayerView(data.state,identity.seatId,now()):null,ai:safeAi,notices,createdAt:data.createdAt};
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
  async function create(mode) {
    const work=creationQueue.catch(()=>{}).then(async()=>{
      if(rooms.size>=maxActiveRooms)fail(429,'ROOM_LIMIT','All room slots are in use.');
      const data=createRoom(mode,now(),lobbyConfig,{tactical:tacticalMode,mapId}), issued=issueIdentity(data,true);await store.save(data);
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
