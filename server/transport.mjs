import {parseFeatures,isGhost} from '../shared/features.mjs';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
const cryptoRandomCode=()=>randomBytes(6).toString('hex').toUpperCase();
import {WebSocketServer,WebSocket} from 'ws';
import {serveStatic} from './static.mjs';
import {validatePublicOrigin} from './origin.mjs';
import {createRoomStore} from './store.mjs';
import {createDailyBudget} from './budget.mjs';
import {createRooms,ServiceError,fail,identityFor,issueIdentity,cookie,requestId,selectRoomMap,isConfigurableRoom} from './rooms.mjs';
import {CHARACTERS} from '../shared/contracts.mjs';
import {aiRoster} from './features/lobbies/index.mjs';
import {getMap,mapFor,mapIdentity} from '../shared/maps/index.mjs';
import {proposeMapSetting} from './map-settings.mjs';
import {PERSONAS,changeSettings,playerName,rosterFor,LOBBY_DEFAULTS,matchRules} from '../shared/lobby.mjs';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function safeError(error) {
  return error instanceof ServiceError ? {status:error.status,error:{code:error.code,message:error.message}} : {status:503,error:{code:'SERVICE_UNAVAILABLE',message:'The service could not safely complete this request.'}};
}
function json(res,status,body,headers={}) {
  if(res.destroyed)return;
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin',...headers});res.end(JSON.stringify(body));
}
async function body(req,max) {
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))fail(400,'INVALID_JSON','Send an application/json object.');
  if(Number(req.headers['content-length'])>max){req.resume();fail(413,'BODY_TOO_LARGE','Request body is too large.');}
  let size=0;const chunks=[];
  for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>max){req.resume();fail(413,'BODY_TOO_LARGE','Request body is too large.');}chunks.push(chunk);}
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(400,'INVALID_JSON','Send a valid JSON object.');}
  if(!object(value))fail(400,'INVALID_JSON','Send a JSON object.');return value;
}
function limiter(now) {
  const buckets=new Map();
  return (key,limit,window=60000,weight=1)=>{
    const at=now();let bucket=buckets.get(key);
    if(!bucket||at>=bucket.until){if(buckets.size>=10000){for(const [id,b]of buckets)if(at>=b.until)buckets.delete(id);if(buckets.size>=10000)fail(429,'RATE_LIMIT','Too many requests. Try again later.');}bucket={until:at+window,count:0};buckets.set(key,bucket);}
    if((bucket.count+=weight)>limit+1e-7)fail(429,'RATE_LIMIT','Too many requests. Try again later.');
  };
}

// Optional dependencies let transport tests exercise faults without provider calls.
export async function createGameServer(config,dependencies={}) {
  if(Object.hasOwn(config,'mapRevision')&&![1,2].includes(config.mapRevision))throw new TypeError('Invalid map revision');
  if(config.mapRevision===2&&config.worldMode!==true)throw new TypeError('Map revision requires world mode');
  const mapRevision=config.worldMode===true?(config.mapRevision??1):1;
  const now=config.now||Date.now;
  const origin=validatePublicOrigin(config.publicOrigin),secure=origin.startsWith('https:');
  if(config.mapId!==undefined)getMap(config.mapId);
  const engine=dependencies.engine||await import('./engine/index.mjs');
  if(config.worldMode===true&&config.tacticalMode===true&&typeof engine.prepareNavigation==='function')engine.prepareNavigation([config.mapId]);
  const ai=dependencies.aiController||(await import('./ai/index.mjs')).createAiController({config:config.ai});
  const store=dependencies.store||await createRoomStore(config.dataDir,{worldGeometry:dependencies.worldGeometry});
  let daily,service;
  try {
    daily=dependencies.dailyBudget||await createDailyBudget({directory:config.dataDir,maxCostUsd:config.ai?.maxDailyCostUsd??5,now});
    service=createRooms({store,engine,ai,now,maxActiveRooms:config.maxActiveRooms??12,roomTtlMs:config.roomTtlMs??3600000,configurable:config.worldMode===true&&config.configurableLobbies!==false&&!config.lobbyConfig,lobbyConfig:config.systemsMode?config.lobbyConfig??{}:null,tacticalMode:config.tacticalMode===true&&config.worldMode===true&&config.systemsMode===true,mapId:config.mapId,mapRevision:config.mapRevision,stationTasksMode:config.stationTasksMode===true&&config.tacticalMode===true&&config.worldMode===true&&config.systemsMode===true});await service.restore();
  } catch(error){await store.close();throw error;}
  const {rooms,get,run,commit,view}=service;
  const limit=limiter(now),tasks=new Set();let closing=false,maintenance=null,closePromise;
  function track(promise){tasks.add(promise);promise.finally(()=>tasks.delete(promise)).catch(()=>{});return promise;}
  function checkOrigin(req,required=false) {
    if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin && req.headers.origin!==origin)||(required&&req.headers.origin!==origin))fail(403,'ORIGIN_DENIED','Use this service from its configured origin.');
  }
  function authenticate(room,req){const identity=identityFor(room.data,req.headers.cookie);if(!identity)fail(401,'ROOM_AUTH_REQUIRED','Join this room to continue.');return identity;}
  function broadcast(room) {
    if(['ended','paused'].includes(room.data.state?.phase))room.abort.abort();
    for(const ws of room.sockets){if(ws.readyState!==WebSocket.OPEN)continue;if(ws.bufferedAmount>256*1024){ws.close(1013,'Client too slow');continue;}try{const current=room.data.identities.find(i=>i.hash===ws.identity.hash&&!i.revoked);if(!current){ws.close(1008,'Identity revoked');continue;}ws.send(JSON.stringify({type:'state',room:view(room,current)}));}catch{ws.terminate();}}
  }
  // A shared address can carry several authenticated humans. Charge each its
  // share of the room's address budget; per-identity limits stay unchanged.
  function addressShare(room,req){if(!room)return 1;const actor=identityFor(room.data,req.headers.cookie);if(!actor?.seatId)return 1;return 1/Math.max(1,room.data.identities.filter(i=>i.seatId&&!i.revoked).length);}
  const nameInput=value=>{try{return playerName(value);}catch(error){fail(400,'INVALID_NAME',error.message);}};
  function generation(data,input){
    if((input.generation!==undefined&&input.generation!==(data.generation??0))||((data.generation??0)>1&&input.generation!==data.generation))fail(409,'STALE_MATCH','This request belongs to an older watch. Resynchronize.');
    if(input.matchId!==undefined&&input.matchId!==data.state?.id)fail(409,'STALE_MATCH','This action belongs to an older match.');
  }
  const coreInput=input=>Object.fromEntries(Object.entries(input).filter(([k])=>!['generation','matchId'].includes(k)));
  function hostOnly(identity){if(!identity.host)fail(403,'HOST_REQUIRED','Only the host can change this room.');}
  function lobbyOnly(data){if(data.state)fail(409,'SETTINGS_LOCKED','Seats and gameplay settings lock when the watch begins.');}
  function promote(data){
    if(isConfigurableRoom(data))return;
    const prior=data.lobby?.roster??data.state?.players??CHARACTERS;
    if(prior.some((p,i)=>p.id!==`p${i+1}`||!PERSONAS.some(q=>q.color===p.color)||typeof p.name!=='string'||p.name.length>24))fail(409,'LOBBY_UPGRADE_UNSUPPORTED','This historical custom roster retains its original seats and rules.');
    const mapSettings=data.settings?.requests?data.settings:undefined;
    Object.assign(data,{schema:data.map?5:2,generation:1,revision:0,settings:{...LOBBY_DEFAULTS,capacity:prior.length,saboteurs:data.lobby?.saboteurCount??data.state?.configuration?.saboteurCount??1},roster:rosterFor(prior.length,prior),inviteCode:cryptoRandomCode(),archives:[],...(mapSettings?{mapSettings}:{})});
    for(const identity of data.identities)Object.assign(identity,{ready:!!identity.seatId,revoked:false});
  }
  function claim(data,identity,seatId,name){
    lobbyOnly(data);
    if(seatId!==null){
      const chosen=seatId==='auto'?(identity.seatId??data.roster.find(p=>!data.identities.some(i=>i.seatId===p.id))?.id):seatId;
      if(!data.roster.some(p=>p.id===chosen)||data.identities.some(i=>i.hash!==identity.hash&&i.seatId===chosen))fail(409,'SEAT_UNAVAILABLE','Choose an unclaimed seat.');
      if(identity.seatId!==chosen)identity.ready=false;
      identity.seatId=chosen;if(name!==undefined){const profile=data.roster.find(p=>p.id===chosen),normalized=nameInput(name);if(profile.name!==normalized)identity.ready=false;profile.name=normalized;}
    }else{identity.seatId=null;identity.ready=false;}
  }
  async function updateMapSetting(room,req,input){
    await run(room,async data=>{
      const identity=authenticate(room,req);generation(data,input);
      const dynamic=isConfigurableRoom(data),request=Object.fromEntries(Object.entries(input).filter(([key])=>key!=='generation'));
      const source=dynamic?{...data,schema:3,settings:data.mapSettings??{revision:0,requests:[]}}:data.map&&data.settings&&data.schema===2?{...data,schema:3}:data;
      const result=proposeMapSetting(source,identity,request);
      if(result.next){
        result.next.schema=data.schema;
        if(dynamic){result.next.mapSettings=result.next.settings;result.next.settings=data.settings;}
        if(result.accepted)selectRoomMap(result.next,result.next.map,{tactical:config.tacticalMode===true||!!data.preset,stationTasks:config.stationTasksMode===true||data.stationTasksVersion===1});
        await commit(room,result.next);if(result.accepted)broadcast(room);
      }
      if(result.error)fail(409,result.error.code,result.error.message);
    });
  }
  const server=http.createServer((req,res)=>track(handle(req,res)));
  server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=64;
  const wss=new WebSocketServer({noServer:true,maxPayload:1024,perMessageDeflate:false});
  async function handle(req,res) {
    try {
      if(closing)fail(503,'SHUTTING_DOWN','Service is shutting down.');
      const url=new URL(req.url,'http://local');
      if(!url.pathname.startsWith('/api/')){await serveStatic(req,res);return;}
      checkOrigin(req,req.method!=='GET');
      const ip=req.socket.remoteAddress||'unknown',candidateId=/^\/api\/rooms\/([A-Za-z0-9_-]+)(?:\/|$)/.exec(url.pathname)?.[1];limit(`all:${ip}`,600,60000,addressShare(rooms.get(candidateId),req));
      if(url.search&&!(req.method==='GET'&&/^\/api\/rooms\/[A-Za-z0-9_-]+\/replay$/.test(url.pathname)&&[...url.searchParams.keys()].length===1&&url.searchParams.has('matchId')))fail(400,'INVALID_REQUEST','API requests do not accept query parameters.');
      if(req.method==='GET'&&url.pathname==='/api/health'){json(res,200,{ok:true,game:'Lantern Wake',protocol:1});return;}
      if(req.method==='POST'&&url.pathname==='/api/rooms') {
        limit(`create:${ip}`,8);const input=await body(req,Math.min(config.maxBodyBytes??8192,8192));
        if(!['human','spectator'].includes(input.mode)||Object.keys(input).some(k=>!['mode','name','features','mapId'].includes(k))||(input.name!==undefined&&(typeof input.name!=='string'||input.name.length>40)))fail(400,'INVALID_ROOM','Choose human or spectator mode.');
        let features;try{features=parseFeatures(Object.hasOwn(input,'features')?input.features:config.features);}catch{fail(400,'INVALID_FEATURES','Choose a valid death policy and ability preset.');}
        if((features.deathPolicy==='ghost-tasks'||features.abilities)&&config.worldMode!==true)fail(400,'WORLD_REQUIRED','Optional presets require world mode.');
        let selectedMap=config.tacticalMode!==true&&(!config.mapId||config.mapId==='beacon')&&!Object.hasOwn(input,'mapId')?null:config.mapId;
        if(Object.hasOwn(input,'mapId')){try{if(typeof input.mapId!=='string')throw new TypeError();selectedMap=getMap(input.mapId).id;}catch{fail(400,'INVALID_MAP','Choose an available map.');}}
        if(selectedMap!==undefined&&selectedMap!==null&&config.worldMode!==true){if(getMap(selectedMap).id!=='beacon')fail(400,'WORLD_REQUIRED','Maps require world mode.');selectedMap=null;}
        const {room,token,identity}=await service.create(input.mode,input.name===undefined?undefined:nameInput(input.name),features,selectedMap);json(res,201,view(room,identity),{'Set-Cookie':cookie(room.data.id,token,secure)});return;
      }
      if(req.method==='POST'&&url.pathname==='/api/invitations'){
        limit(`join:${ip}`,40);const input=await body(req,8192);if(Object.keys(input).some(k=>k!=='code')||typeof input.code!=='string')fail(400,'INVALID_CODE','Enter an invitation code.');
        const invited=[...rooms.values()].find(r=>r.data.inviteCode===input.code.trim().toUpperCase());if(!invited)fail(404,'INVITATION_NOT_FOUND','Invitation not found.');json(res,200,{roomId:invited.data.id});return;
      }
      const match=/^\/api\/rooms\/([A-Za-z0-9_-]+)(?:\/(join|start|action|input|replay|socket|seat|ready|profile|settings|members|rematch|inspection))?$/.exec(url.pathname);
      if(!match)fail(404,'NOT_FOUND','Route not found.');
      const room=get(match[1]),route=match[2]||'';
      if(route==='join'&&req.method==='POST') {
        limit(`join:${ip}`,40);const input=await body(req,Math.min(config.maxBodyBytes??8192,8192));if(Object.keys(input).some(k=>!['intent','name'].includes(k))||(input.intent!==undefined&&!['play','spectate'].includes(input.intent)))fail(400,'INVALID_JOIN','Choose play or spectate.');if(input.name!==undefined)nameInput(input.name);
        const result=await run(room,async data=>{
          const existing=identityFor(data,req.headers.cookie);if(existing)return {identity:existing};
          const next=structuredClone(data),issued=issueIdentity(next);if(input.intent==='play'&&!next.state){promote(next);claim(next,issued.identity,'auto',input.name);}await commit(room,next);return issued;
        });
        json(res,200,view(room,result.identity),result.token?{'Set-Cookie':cookie(room.data.id,result.token,secure)}:{});return;
      }
      let identity=authenticate(room,req);
      if(route===''&&req.method==='GET'){json(res,200,view(room,identity));return;}
      if(route==='settings'&&req.method==='POST'&&req.headers['x-lobby-settings-protocol']==='map-v1'){
        limit('write:'+ip,180,60000,addressShare(room,req));limit('actor:'+room.data.id+':'+identity.hash,60);
        const input=await body(req,Math.min(config.maxBodyBytes??8192,8192));
        await updateMapSetting(room,req,input);
        json(res,200,view(room,authenticate(room,req)));return;
      }
      if(route==='replay'&&req.method==='GET') {
        const requestedMatch=url.searchParams.get('matchId')||req.headers['x-match-id'];const archived=requestedMatch?room.data.archives?.find(a=>a.matchId===requestedMatch):null;
        if(archived){json(res,200,{roomId:room.data.id,matchId:archived.matchId,generation:archived.generation,replay:archived.replay,players:archived.players,...(archived.metadata?{metadata:archived.metadata}:{})});return;}
        if(requestedMatch&&requestedMatch!==room.data.state?.id)fail(404,'REPLAY_UNAVAILABLE','Archived replay unavailable.');
        if(room.data.state?.phase!=='ended')fail(409,'REPLAY_UNAVAILABLE','Replay is available after the match ends.');
        json(res,200,{roomId:room.data.id,matchId:room.data.state.id,generation:room.data.generation??0,...(room.data.state.map?{map:{...room.data.state.map},...(room.data.state.preset?{preset:{...room.data.state.preset}}:{})}:{}),...(room.data.state.mapId?{mapId:room.data.state.mapId}:{}),...(room.data.state.mapRevision===2?{mapRevision:2}:{}),replay:engine.getReplay(room.data.state),...(room.data.state.beaconVersion?{snapshots:engine.getReplaySnapshots(room.data.state)}:{}),...(engine.getReplayMetadata?{metadata:engine.getReplayMetadata(room.data.state)}:{}),ai:view(room,identity).ai});return;
      }
      if(['seat','ready','profile','settings','members','rematch','inspection'].includes(route)&&req.method==='POST'){
        limit(`write:${ip}`,180,60000,addressShare(room,req));limit(`actor:${room.data.id}:${identity.hash}`,60);
        const input=await body(req,8192);
        if(route==='settings'&&(Object.hasOwn(input,'id')||Object.hasOwn(input,'expectedRevision'))){await updateMapSetting(room,req,input);json(res,200,view(room,authenticate(room,req)));return;}
        const allowed={seat:['seatId','name'],ready:['ready'],profile:['name','color'],settings:['settings','features','mapId','id','expectedRevision'],members:['seatId','operation'],rematch:['id'],inspection:['enabled']}[route];
        if(Object.keys(input).some(k=>!allowed.includes(k)&&k!=='generation'))fail(400,'INVALID_LOBBY_REQUEST','Unknown lobby fields.');
        await run(room,async data=>{
          identity=authenticate(room,req);
          if(route==='rematch')hostOnly(identity);
          if(route==='rematch'&&data.lastRematch?.id===input.id&&data.lastRematch?.from===(input.generation??0))return;
          generation(data,input);const next=structuredClone(data);
          if(route==='rematch'){
            hostOnly(identity);if(!requestId(input.id))fail(400,'INVALID_ID','A request ID is required.');
            if(!data.state||!['ended','paused'].includes(data.state.phase))fail(409,'MATCH_ACTIVE','Finish the current watch before a rematch.');
            const from=data.generation??0;promote(next);
            if(data.state.phase==='ended'){
              const replay=engine.getReplay(data.state).slice(-2000);while(Buffer.byteLength(JSON.stringify(replay))>1000000)replay.shift();
              next.archives.push({matchId:data.state.id,generation:from,replay,players:engine.getPlayerView(data.state,null,now()).players,...(engine.getReplayMetadata?{metadata:engine.getReplayMetadata({...data.state,replay})}:{})});
              while(next.archives.length>3||Buffer.byteLength(JSON.stringify(next.archives))>2000000)next.archives.shift();
            }
            next.generation++;next.lastRematch={id:input.id,from};next.state=null;next.startId=null;next.aiContext={};
            for(const member of next.identities){member.inspection=false;if(member.revoked)member.seatId=null;member.ready=member.host&&!!member.seatId;}
            await commit(room,next);
            room.abort.abort();room.abort=new AbortController();room.nextDecision.clear();room.aiBusy=false;room.aiBlocked=false;room.aiWork=null;
            return;
          }
          if(route==='inspection'){
            if(typeof input.enabled!=='boolean')fail(400,'INVALID_INSPECTION','Choose whether to reveal AI inspection.');
            if(!identity.host||!next.state||next.mode!=='spectator'||identity.seatId||next.state.players.some(p=>p.human))fail(403,'INSPECTION_UNAVAILABLE','AI inspection is available only to the unseated host of a watch with no human players.');
            next.identities.find(i=>i.hash===identity.hash).inspection=input.enabled;
          }else if(route==='members'){
            hostOnly(identity);if(!['release','revoke'].includes(input.operation)||!next.roster?.some(p=>p.id===input.seatId))fail(400,'INVALID_MEMBER','Choose a seated player.');
            const member=next.identities.find(i=>i.seatId===input.seatId);if(!member||member.host)fail(409,'INVALID_MEMBER','The host seat cannot be removed.');
            if(input.operation==='release'){lobbyOnly(next);member.seatId=null;member.ready=false;}
            else{member.revoked=true;member.ready=false;if(!next.state)member.seatId=null;}
          }else{
            lobbyOnly(next);promote(next);const member=next.identities.find(i=>i.hash===identity.hash);
            if(route==='seat')claim(next,member,input.seatId,input.name);
            if(route==='ready'){if(!member.seatId||typeof input.ready!=='boolean')fail(400,'INVALID_READY','Claim a seat before readying.');member.ready=input.ready;}
            if(route==='profile'){
              if(!member.seatId)fail(403,'SEAT_REQUIRED','Claim a seat first.');const profile=next.roster.find(p=>p.id===member.seatId);
              if(input.name!==undefined)profile.name=nameInput(input.name);
              if(input.color!==undefined){if(!PERSONAS.some(p=>p.color===input.color))fail(400,'INVALID_COLOR','Choose a keeper color.');profile.color=input.color;}
              member.ready=false;
            }
            if(route==='settings'){
              hostOnly(identity);if(input.settings!==undefined){try{next.settings=changeSettings(next.settings,input.settings);}catch(error){fail(400,'INVALID_SETTINGS',error.message);}}else if(!Object.hasOwn(input,'features')&&!Object.hasOwn(input,'mapId'))fail(400,'INVALID_SETTINGS','Provide settings or feature presets.');
              if(Object.hasOwn(input,'features')){try{next.features=parseFeatures(input.features);}catch{fail(400,'INVALID_FEATURES','Choose a valid death policy and ability preset.');}if((next.features.deathPolicy==='ghost-tasks'||next.features.abilities)&&config.worldMode!==true)fail(400,'WORLD_REQUIRED','Optional presets require world mode.');}
              if(Object.hasOwn(input,'mapId')){let chosen;try{if(typeof input.mapId!=='string')throw new TypeError();chosen=getMap(input.mapId).id;}catch{fail(400,'INVALID_MAP','Choose an available map.');}if(config.worldMode!==true)fail(400,'WORLD_REQUIRED','Maps require world mode.');selectRoomMap(next,chosen,{tactical:config.tacticalMode===true||!!next.preset,stationTasks:config.stationTasksMode===true||next.stationTasksVersion===1,mapRevision:config.tacticalMode!==true?next.mapRevision??config.mapRevision:undefined});}
              if(next.identities.some(i=>i.seatId&&Number(i.seatId.slice(1))>next.settings.capacity))fail(409,'SEAT_OCCUPIED','Release occupied seats before reducing capacity.');
              next.roster=rosterFor(next.settings.capacity,next.roster);
              for(const member of next.identities)member.ready=member.host&&!!member.seatId;
            }
          }
          await commit(room,next);
        });broadcast(room);json(res,200,view(room,authenticate(room,req)));return;
      }
      if(route==='input'&&req.method==='POST') {
        limit(`input-ip:${ip}`,600,60000,addressShare(room,req));limit(`input-actor:${room.data.id}:${identity.hash}`,600);
        if(!identity.seatId)fail(403,'SPECTATOR','Only a seated player can send movement input.');
        const envelope=await body(req,Math.min(config.maxBodyBytes??8192,8192)),input=coreInput(envelope);
        if(Object.keys(input).length!==3||!['seq','dx','dy'].every(key=>Object.hasOwn(input,key))||!Number.isSafeInteger(input.seq)||input.seq<=0||!['dx','dy'].every(key=>Number.isInteger(input[key])&&input[key]>=-1&&input[key]<=1))fail(400,'INVALID_INPUT','Movement requires exactly {seq,dx,dy}: a positive safe sequence and integer directions from -1 to 1.');
        await run(room,async data=>{
          identity=authenticate(room,req);generation(data,envelope);if(!identity.seatId||data.state&&!data.state.players.some(p=>p.id===identity.seatId&&p.human))fail(403,'SPECTATOR','Only a seated player can move.');
          if(!data.state)fail(409,'NOT_STARTED','Start the match first.');
          if(typeof engine.applyInput!=='function')fail(409,'INPUT_UNAVAILABLE','Continuous movement is not available for this match.');
          const result=engine.applyInput(structuredClone(data.state),identity.seatId,input,now());
          if(!object(result)||typeof result.accepted!=='boolean'||!object(result.state)||result.state.id!==data.state.id||result.state.mode!==data.state.mode||result.state.schemaVersion!==data.state.schemaVersion||!Number.isSafeInteger(result.state.version)||result.state.version<data.state.version)throw new Error('Invalid engine input result');
          // The engine result owns its state. Copy the room envelope, not the
          // retained replay again; commit publishes only after durable save.
          const next={...data,state:result.state};
          // Validate even an inert result before considering a durable update.
          service.validate(next);
          if(result.accepted&&[2,3,4,5].includes(result.state.schemaVersion)&&result.state.players.find(player=>player.id===identity.seatId)?.motion.seq!==input.seq)throw new Error('Invalid engine input sequence');
          if(result.state.version!==data.state.version){await commit(room,next);broadcast(room);}
          if(!result.accepted){const error=result.error||{};fail(409,typeof error.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)?error.code:'INPUT_REJECTED',typeof error.message==='string'&&error.message.length<=240?error.message:'Movement input rejected.');}
        });
        json(res,200,view(room,identity));return;
      }
      if((route==='start'||route==='action')&&req.method==='POST') {
        limit(`write:${ip}`,180,60000,addressShare(room,req));limit(`actor:${room.data.id}:${identity.hash}`,60);
        const envelope=await body(req,Math.min(config.maxBodyBytes??8192,8192)),input=coreInput(envelope);
        if(!requestId(input.id))fail(400,'INVALID_ID','A bounded unique request ID is required.');
        await run(room,async data=>{
          identity=authenticate(room,req);generation(data,envelope);
          if(route==='start') {
            if(!identity.host)fail(403,'HOST_REQUIRED','Only the host can start this room.');
            if(Object.keys(input).some(k=>!['id','features','mapId'].includes(k)))fail(400,'INVALID_START','Start accepts a request ID and optional feature presets.');
            if(data.state&&data.startId!==input.id)fail(409,'ALREADY_STARTED','This match has already started.');
            let requestedFeatures;try{requestedFeatures=parseFeatures(Object.hasOwn(input,'features')?input.features:data.features);}catch{fail(400,'INVALID_FEATURES','Choose a valid death policy and ability preset.');}
            let requestedMap;if(Object.hasOwn(input,'mapId')){try{if(typeof input.mapId!=='string')throw new TypeError();requestedMap=getMap(input.mapId).id;}catch{fail(400,'INVALID_MAP','Choose an available map.');}}
            if(data.startId===input.id){if(requestedMap!==undefined){const acceptedMap=mapFor(data.state),retryMap=[1,2].includes(data.state.schemaVersion)&&requestedMap===(data.state.mapId??'beacon')&&(!data.map||data.map.id===requestedMap||config.tacticalMode!==true)?acceptedMap:getMap(requestedMap);if(mapIdentity(retryMap)!==mapIdentity(acceptedMap))fail(409,'START_CONFLICT','This start request ID was accepted with a different map.');}const accepted=parseFeatures(data.features);if(accepted.deathPolicy!==requestedFeatures.deathPolicy||accepted.abilities!==requestedFeatures.abilities)fail(409,'START_CONFLICT','This start request ID was accepted with different feature settings.');return;}
            if(isConfigurableRoom(data)&&data.identities.some(i=>i.seatId&&(!i.ready||i.revoked)))fail(409,'NOT_READY','Every seated human must be ready.');
            const next=structuredClone(data);next.features=requestedFeatures;
            if(requestedMap!==undefined){if(config.worldMode!==true){if(requestedMap!=='beacon')fail(400,'WORLD_REQUIRED','Maps require world mode.');}else selectRoomMap(next,requestedMap,{tactical:config.tacticalMode===true||[3,4].includes(data.schema),stationTasks:config.stationTasksMode===true||data.schema===4,mapRevision:next.mapRevision??(config.tacticalMode!==true?config.mapRevision:undefined)});}
            if((next.features?.deathPolicy==='ghost-tasks'||next.features?.abilities)&&config.worldMode!==true)fail(400,'WORLD_REQUIRED','Optional presets require world mode.');
            next.startId=input.id;
            const configured=isConfigurableRoom(next),systems=!!next.preset||!configured&&[2,3,4].includes(next.schema)&&!next.map&&!next.mapId&&next.mapRevision===undefined,tactical=!!next.preset;
            next.state=engine.createMatch({id:configured&&next.generation>1?`${next.id}_g${next.generation}`:next.id,mode:next.mode,humanPlayerId:next.lobby?.humanPlayerIds[0]??'p1',...(configured?{roster:next.roster,humanPlayerIds:next.identities.filter(i=>i.seatId).map(i=>i.seatId),saboteurCount:next.settings.saboteurs,settings:next.settings}:next.lobby?{roster:next.lobby.roster,humanPlayerIds:next.lobby.humanPlayerIds,saboteurCount:next.lobby.saboteurCount}:{}),now:now(),config:config.rules||{},world:config.worldMode===true||[2,3,4,5].includes(next.schema),systems,...(tactical?{tactical:true,map:next.map,stationTasks:next.stationTasksVersion===1}:next.map||next.mapId||next.mapRevision!==undefined?{mapId:mapFor(next).legacyMapId??mapFor(next).id,...(mapFor(next).legacyRevision===2?{mapRevision:2}:{})}:{}),features:next.features,beaconRules:config.beaconRules??{}});await commit(room,next);
          } else {
            if(!identity.seatId||(data.state&&!data.state.players.some(p=>p.id===identity.seatId&&p.human)))fail(403,'SPECTATOR','Spectators cannot act.');
            if(!data.state)fail(409,'NOT_STARTED','Start the match first.');
            const result=engine.applyAction(data.state,identity.seatId,input,now());
            if(!result.accepted){if(result.state.version!==data.state.version){const next={...data,state:result.state};await commit(room,next);broadcast(room);}const error=result.error||{};fail(409,typeof error.code==='string'?error.code:'ACTION_REJECTED',typeof error.message==='string'?error.message:'Action rejected.');}
            const next={...data,state:result.state};await commit(room,next);
          }
        });
        broadcast(room);json(res,200,view(room,identity));return;
      }
      fail(404,'NOT_FOUND','Route not found.');
    } catch(error){const safe=safeError(error);json(res,safe.status,{error:safe.error});}
  }
  server.on('upgrade',(req,socket,head)=>{
    try {
      if(closing)fail(503,'SHUTTING_DOWN','Service is shutting down.');checkOrigin(req,true);
      const url=new URL(req.url,'http://local'),match=/^\/api\/rooms\/([A-Za-z0-9_-]+)\/socket$/.exec(url.pathname);
      if(req.method!=='GET'||!match||url.search)fail(404,'NOT_FOUND','Socket not found.');
      limit(`ws:${req.socket.remoteAddress}`,30);const room=get(match[1]),identity=authenticate(room,req);
      if(wss.clients.size>=100||[...room.sockets].filter(ws=>ws.identity.hash===identity.hash).length>=4)fail(429,'SOCKET_LIMIT','Too many connections.');
      wss.handleUpgrade(req,socket,head,ws=>{
        ws.identity={hash:identity.hash};ws.alive=true;room.sockets.add(ws);
        ws.on('error',()=>{});ws.on('pong',()=>{ws.alive=true;});ws.on('message',()=>ws.close(1008,'Use HTTP actions'));
        ws.on('close',()=>room.sockets.delete(ws));
        ws.send(JSON.stringify({type:'state',room:view(room,authenticate(room,req))}));
      });
    }catch(error){const safe=safeError(error),payload=JSON.stringify({error:safe.error});socket.end(`HTTP/1.1 ${safe.status} Rejected\r\nContent-Type: application/json\r\nConnection: close\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);}
  });
  function scheduleAi(room) {
    if(closing||room.aiBusy||room.aiBlocked||room.removed||!room.data.state||['ended','paused'].includes(room.data.state.phase))return;
    const canScheduleActor=actor=>{
      // Eligibility needs authoritative local fields, not a full view per NPC.
      // Keep every fallen faction's one local message and stop idle planning.
      const state=room.data.state,player=state.players.find(p=>p.id===actor.id);
      if(player?.alive)return true;
      if(!player||!isGhost(state,player)||state.phase!=='roam')return false;
      if(player.role==='crew'&&player.tasks.some(t=>!t.completed))return true;
      // A fallen observer may send one local message, then needs no idle planner.
      const memory=room.data.aiContext?.matches?.['match:'+state.id]?.memories?.['actor:'+actor.id];
      return !memory?.ghostSpoken&&!(state.ghostChat??[]).some(message=>message.playerId===actor.id);
    };
    const player=aiRoster(room.data.state).filter(p=>(room.nextDecision.get(p.id)||0)<=now()&&canScheduleActor(p)).sort((a,b)=>(room.nextDecision.get(a.id)||0)-(room.nextDecision.get(b.id)||0))[0];
    if(!player)return;
    room.nextDecision.set(player.id,now()+Math.max(100,config.ai?.decisionIntervalMs??1800));room.aiBusy=true;const work=Symbol(),matchId=room.data.state.id,abort=room.abort,decisionGeneration=room.aiGeneration;room.aiWork=work;
    const current=()=>!room.removed&&room.aiGeneration===decisionGeneration&&room.data.state?.id===matchId&&!['ended','paused'].includes(room.data.state.phase)&&room.abort===abort&&!abort.signal.aborted&&!closing;
    track((async()=>{
      const context=structuredClone(room.data.aiContext),snapshot=engine.getPlayerView(room.data.state,player.id,now());
      const freshView=()=>current()?engine.getPlayerView(room.data.state,player.id,now()):null;
      try {
        const commitReservation=async({id,amountUsd})=>{
          if(!current()||['ended','paused'].includes(room.data.state?.phase))throw new Error('AI stopped');
          if(typeof id!=='string'||!/^[A-Za-z0-9:._-]{1,150}$/.test(id)||!Number.isFinite(amountUsd)||amountUsd<0)throw new Error('Invalid AI reservation');
          await run(room,async data=>{if(!current())throw Error('Stale AI reservation');const next={...data,aiContext:structuredClone(context)};await commit(room,next);});
          if(!current())throw Error('Stale AI reservation');
          // Ordering is essential: match reservation, then deployment reservation, then send.
          await daily.reserve({id:`${matchId}:${id}`,amount:amountUsd});
          if(!current())throw Error('AI match changed during reservation');
        };
        const proposal=await ai.decide({view:snapshot,player:{...player,persona:player.persona??PERSONAS.find(p=>p.id===player.id)?.persona},context,signal:abort.signal,commitReservation,getCurrentView:freshView});
        if(!current())return;
        await run(room,async data=>{
          if(!current())return;
          const next={...data,aiContext:structuredClone(context)};
          if(proposal&&!['ended','paused'].includes(next.state.phase)) {
            const result=engine.applyAction(next.state,player.id,proposal,now());next.state=result.state;
          }
          await commit(room,next);
        });broadcast(room);
      }catch {if(current()){room.aiBlocked=true;if(!closing)broadcast(room);}}
      finally {if(room.aiWork===work){room.aiBusy=false;room.aiWork=null;}}
    })());
  }
  const interval=setInterval(()=>{
    if(closing||maintenance)return;
    maintenance=(async()=>{
      await Promise.all([...rooms.values()].map(async room=>{
        try {
          if(await service.expire(room))return;
          await run(room,async data=>{
            if(!data.state||['ended','paused'].includes(data.state.phase))return;
            const result=engine.tick(data.state,now());
            if(result.state.version!==data.state.version){const next={...data,state:result.state};await commit(room,next);broadcast(room);}
          });scheduleAi(room);
        }catch {room.aiBlocked=true;}
      }));
    })().finally(()=>{maintenance=null;});
  },Math.max(10,config.tickMs??500));interval.unref();
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},30000);heartbeat.unref();
  async function close() {
    if(closePromise)return closePromise;
    closing=true;clearInterval(interval);clearInterval(heartbeat);
    closePromise=(async()=>{
      for(const room of rooms.values())room.abort.abort();for(const ws of wss.clients)ws.terminate();
      const stopped=new Promise((resolve,reject)=>{server.close(error=>error&&error.code!=='ERR_SERVER_NOT_RUNNING'?reject(error):resolve());server.closeAllConnections();});
      await stopped;if(maintenance)await maintenance;await Promise.allSettled([...tasks]);await Promise.all([...rooms.values()].map(room=>room.queue));
      await new Promise(resolve=>wss.close(resolve));try{if(ai.close)await ai.close();}finally{await store.close();}
    })();return closePromise;
  }
  return {server,close,rooms};
}
