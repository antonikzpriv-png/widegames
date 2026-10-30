import {parseFeatures} from '../shared/features.mjs';
import {randomBytes,createHash} from 'node:crypto';
import {ROOM_ID,validateRoom} from './store.mjs';
import {normalizeRoster,publicRoster} from './features/lobbies/index.mjs';
import {getMap,getLegacyMap,PUBLIC_MAP_CATALOG} from '../shared/maps/index.mjs';
import {spectatorInspection} from './spectator.mjs';
import {hasTacticalFixtures} from './config.mjs';
import {CHARACTERS} from '../shared/contracts.mjs';
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
/** Reprofile an unstarted lobby only; identities, receipts and budgets are retained. */
export function selectRoomMap(room,reference,{tactical=true,stationTasks=true,mapRevision}={}) {
  if(room.state)fail(409,'ALREADY_STARTED','The map is fixed after the watch begins.');
  if(mapRevision!==undefined&&![1,2].includes(mapRevision))throw new TypeError('Invalid map revision');
  const legacy=!tactical&&typeof reference==='string'&&['beacon','storm-foundry','tidal-observatory'].includes(reference);
  const selected=legacy?getLegacyMap(reference,mapRevision??(reference==='beacon'?1:getMap(reference).legacyRevision)):getMap(reference),systems=tactical&&hasTacticalFixtures(selected);
  const setup=normalizeRoster({...room.lobby,mode:room.mode,...(room.mode==='spectator'?{humanPlayerIds:[]}:{})});
  if(!systems&&(setup.players.length!==6||setup.saboteurCount!==1||setup.players.some((p,i)=>p.id!==CHARACTERS[i].id||p.name!==CHARACTERS[i].name||p.color!==CHARACTERS[i].color)||setup.humanPlayerIds.some(id=>id!=='p1')))fail(409,'MAP_ROSTER_UNSUPPORTED','This walking map requires the original six keeper seats and one saboteur.');
  room.lobby={roster:setup.players,saboteurCount:setup.saboteurCount,humanPlayerIds:setup.humanPlayerIds};
  room.schema=systems?(stationTasks?4:3):2;
  room.map={id:selected.id,version:selected.version};
  if(!systems||Object.hasOwn(room,'mapId'))room.mapId=selected.legacyMapId??selected.id;
  if(!systems&&selected.legacyRevision===2)room.mapRevision=2;else delete room.mapRevision;
  room.settings??={revision:0,requests:[]};
  if(systems){room.preset={id:TACTICAL_PRESET.id,version:TACTICAL_PRESET.version};if(stationTasks)room.stationTasksVersion=1;else delete room.stationTasksVersion;}
  else {delete room.preset;delete room.stationTasksVersion;}
  return room;
}
export function createRoom(mode,now,lobbyConfig,{tactical=false,mapId,mapRevision,stationTasks=false}={}) {
  if(mapRevision!==undefined&&![1,2].includes(mapRevision))throw new TypeError('Invalid map revision');
  if(typeof stationTasks!=='boolean'||stationTasks&&!tactical)throw new TypeError('Invalid station task mode');
  const id=randomBytes(18).toString('base64url');
  const setup=(lobbyConfig||tactical)?normalizeRoster({...lobbyConfig,mode,...(mode==='spectator'?{humanPlayerIds:[]}: {})}):null;
  const room={schema:setup?2:1,...(setup?{lobby:{roster:setup.players,saboteurCount:setup.saboteurCount,humanPlayerIds:setup.humanPlayerIds}}:{}),id,mode,createdAt:now,updatedAt:now,identities:[],state:null,startId:null,aiContext:{}};
  if(tactical||mapId!==undefined||mapRevision!==undefined)selectRoomMap(room,mapId===undefined?'beacon':mapId,{tactical,stationTasks,mapRevision});
  return room;
}

export function createRooms({store,engine,ai,now=Date.now,maxActiveRooms=12,roomTtlMs=3600000,lobbyConfig,tacticalMode=false,mapId,mapRevision,stationTasksMode=false}) {
  const rooms=new Map();let creationQueue=Promise.resolve();
  const entry=data=>({data,queue:Promise.resolve(),sockets:new Set(),aiBusy:false,aiGeneration:0,aiBlocked:false,nextDecision:new Map(),abort:new AbortController(),removed:false});
  const get=id=>{if(!ROOM_ID.test(id)||!rooms.has(id))fail(404,'ROOM_NOT_FOUND','Room not found.');return rooms.get(id);};
  function run(room,fn) {
    const result=room.queue.catch(()=>{}).then(()=>{if(room.removed)fail(404,'ROOM_NOT_FOUND','Room not found.');return fn(room.data);});
    room.queue=result.catch(()=>{});return result;
  }
  async function commit(room,next){next.updatedAt=Math.max(next.updatedAt,now());validateRoom(next);await store.save(next);
    const fence=state=>JSON.stringify([state?.id,state?.startedAt,state?.phase,state?.meeting?.id,state?.meetingCount,(state?.players??[]).map(p=>[p.id,p.alive])]);
    if(fence(room.data.state)!==fence(next.state))room.aiGeneration++;
    room.data=next;}
  function view(room,identity) {
    const data=room.data;
    const summary=ai.describe(data.aiContext);
    // Explicit allowlist: private AI memory and provider errors never cross transport.
    const safeAi={};for(const key of ['mode','provider','model','calls','tokens','costUsd','limitReason','strategy','navigation','council'])if(['string','number'].includes(typeof summary?.[key]))safeAi[key]=summary[key];
    const notices=Array.isArray(data.aiContext.notices)?data.aiContext.notices.filter(x=>typeof x==='string').slice(-10).map(x=>x.slice(0,240)):[];
    if(safeAi.mode==='live')notices.push(safeAi.strategy==='strategic'?'Strategic AI: model plans and council; local legal execution.':'Hybrid AI: live model council; navigation and deck actions use local policy.');
    if(room.aiBlocked)notices.push('AI paused because durable storage or budget reservation failed.');
    const at=now(),game=data.state?engine.getPlayerView(data.state,identity.seatId,at):null;
    // Only the identity resolved from this room's cookie grants private inspection.
    if(game&&identity.host===true&&data.mode==='spectator'){
      const inspection=spectatorInspection(data.state,{mode:data.mode,identity,seatId:identity.seatId,now:at,context:data.aiContext});
      if(inspection)game.inspection=inspection;
    }
    return {...(data.features?{features:structuredClone(data.features)}:{}),...(data.schema===4?{stationTasksVersion:1}:{}),...(data.mapId?{mapId:data.mapId}:{}),...(data.mapRevision===2?{mapRevision:2}:{}),...(data.map?{map:{...data.map},...(data.preset?{preset:{...data.preset}}:{}),availableMaps:PUBLIC_MAP_CATALOG,...(data.settings?{settingsRevision:data.settings.revision}:{})}:{}),...([2,3,4].includes(data.schema)?{roster:data.lobby.roster.map(({id,name,color,persona})=>({id,name,color,persona}))}:{}),roomId:data.id,mode:data.mode,isHost:identity.host,seatId:identity.seatId,phase:data.state?.phase||'lobby',connection:'connected',game,ai:safeAi,notices,createdAt:data.createdAt};
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
  async function create(mode,features,selectedMap=mapId) {
    const work=creationQueue.catch(()=>{}).then(async()=>{
      if(rooms.size>=maxActiveRooms)fail(429,'ROOM_LIMIT','All room slots are in use.');
      const data=createRoom(mode,now(),lobbyConfig,{tactical:tacticalMode,mapId:selectedMap??undefined,...(!tacticalMode&&mapRevision!==undefined?{mapRevision}:{}),stationTasks:stationTasksMode});if(features!==undefined)data.features=parseFeatures(features);const issued=issueIdentity(data,true);await store.save(data);
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
