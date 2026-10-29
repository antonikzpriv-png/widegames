import http from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {serveStatic} from './static.mjs';
import {validatePublicOrigin} from './origin.mjs';
import {createRoomStore} from './store.mjs';
import {createDailyBudget} from './budget.mjs';
import {createRooms,ServiceError,fail,identityFor,issueIdentity,cookie,requestId} from './rooms.mjs';
import {CHARACTERS} from '../shared/contracts.mjs';

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
  return (key,limit,window=60000)=>{
    const at=now();let bucket=buckets.get(key);
    if(!bucket||at>=bucket.until){if(buckets.size>=10000){for(const [id,b]of buckets)if(at>=b.until)buckets.delete(id);if(buckets.size>=10000)fail(429,'RATE_LIMIT','Too many requests. Try again later.');}bucket={until:at+window,count:0};buckets.set(key,bucket);}
    if(++bucket.count>limit)fail(429,'RATE_LIMIT','Too many requests. Try again later.');
  };
}

// Optional dependencies let transport tests exercise faults without provider calls.
export async function createGameServer(config,dependencies={}) {
  const now=config.now||Date.now;
  const origin=validatePublicOrigin(config.publicOrigin),secure=origin.startsWith('https:');
  const engine=dependencies.engine||await import('./engine/index.mjs');
  const ai=dependencies.aiController||(await import('./ai/index.mjs')).createAiController({config:config.ai});
  const store=dependencies.store||await createRoomStore(config.dataDir,{worldGeometry:dependencies.worldGeometry});
  let daily,service;
  try {
    daily=dependencies.dailyBudget||await createDailyBudget({directory:config.dataDir,maxCostUsd:config.ai?.maxDailyCostUsd??5,now});
    service=createRooms({store,engine,ai,now,maxActiveRooms:config.maxActiveRooms??12,roomTtlMs:config.roomTtlMs??3600000});await service.restore();
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
    for(const ws of room.sockets){if(ws.readyState!==WebSocket.OPEN)continue;if(ws.bufferedAmount>256*1024){ws.close(1013,'Client too slow');continue;}try{ws.send(JSON.stringify({type:'state',room:view(room,ws.identity)}));}catch{ws.terminate();}}
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
      const ip=req.socket.remoteAddress||'unknown';limit(`all:${ip}`,600);
      if(url.search)fail(400,'INVALID_REQUEST','API requests do not accept query parameters.');
      if(req.method==='GET'&&url.pathname==='/api/health'){json(res,200,{ok:true,game:'Lantern Wake',protocol:1});return;}
      if(req.method==='POST'&&url.pathname==='/api/rooms') {
        limit(`create:${ip}`,8);const input=await body(req,Math.min(config.maxBodyBytes??8192,8192));
        if(!['human','spectator'].includes(input.mode)||Object.keys(input).some(k=>!['mode','name'].includes(k))||(input.name!==undefined&&(typeof input.name!=='string'||input.name.length>40)))fail(400,'INVALID_ROOM','Choose human or spectator mode.');
        const {room,token,identity}=await service.create(input.mode);json(res,201,view(room,identity),{'Set-Cookie':cookie(room.data.id,token,secure)});return;
      }
      const match=/^\/api\/rooms\/([A-Za-z0-9_-]+)(?:\/(join|start|action|input|replay|socket))?$/.exec(url.pathname);
      if(!match)fail(404,'NOT_FOUND','Route not found.');
      const room=get(match[1]),route=match[2]||'';
      if(route==='join'&&req.method==='POST') {
        limit(`join:${ip}`,40);const input=await body(req,Math.min(config.maxBodyBytes??8192,8192));if(Object.keys(input).length)fail(400,'INVALID_JOIN','Join requires an empty object.');
        const result=await run(room,async data=>{
          const existing=identityFor(data,req.headers.cookie);if(existing)return {identity:existing};
          const next=structuredClone(data),issued=issueIdentity(next);await commit(room,next);return issued;
        });
        json(res,200,view(room,result.identity),result.token?{'Set-Cookie':cookie(room.data.id,result.token,secure)}:{});return;
      }
      const identity=authenticate(room,req);
      if(route===''&&req.method==='GET'){json(res,200,view(room,identity));return;}
      if(route==='replay'&&req.method==='GET') {
        if(room.data.state?.phase!=='ended')fail(409,'REPLAY_UNAVAILABLE','Replay is available after the match ends.');
        json(res,200,{roomId:room.data.id,replay:engine.getReplay(room.data.state)});return;
      }
      if(route==='input'&&req.method==='POST') {
        limit(`input-ip:${ip}`,600);limit(`input-actor:${room.data.id}:${identity.hash}`,600);
        if(identity.seatId!=='p1'||room.data.mode!=='human')fail(403,'SPECTATOR','Only this room\'s human seat can send movement input.');
        const input=await body(req,Math.min(config.maxBodyBytes??8192,8192));
        if(Object.keys(input).length!==3||!['seq','dx','dy'].every(key=>Object.hasOwn(input,key))||!Number.isSafeInteger(input.seq)||input.seq<=0||!['dx','dy'].every(key=>Number.isInteger(input[key])&&input[key]>=-1&&input[key]<=1))fail(400,'INVALID_INPUT','Movement requires exactly {seq,dx,dy}: a positive safe sequence and integer directions from -1 to 1.');
        await run(room,async data=>{
          if(!data.state)fail(409,'NOT_STARTED','Start the match first.');
          if(typeof engine.applyInput!=='function')fail(409,'INPUT_UNAVAILABLE','Continuous movement is not available for this match.');
          const result=engine.applyInput(structuredClone(data.state),identity.seatId,input,now());
          if(!object(result)||typeof result.accepted!=='boolean'||!object(result.state)||result.state.id!==data.state.id||result.state.mode!==data.state.mode||result.state.schemaVersion!==data.state.schemaVersion||!Number.isSafeInteger(result.state.version)||result.state.version<data.state.version)throw new Error('Invalid engine input result');
          const next=structuredClone(data);next.state=result.state;
          // Validate even an inert result before considering a durable update.
          service.validate(next);
          if(result.accepted&&result.state.schemaVersion===2&&result.state.players.find(player=>player.id===identity.seatId)?.motion.seq!==input.seq)throw new Error('Invalid engine input sequence');
          if(result.state.version!==data.state.version){await commit(room,next);broadcast(room);}
          if(!result.accepted){const error=result.error||{};fail(409,typeof error.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)?error.code:'INPUT_REJECTED',typeof error.message==='string'&&error.message.length<=240?error.message:'Movement input rejected.');}
        });
        json(res,200,view(room,identity));return;
      }
      if((route==='start'||route==='action')&&req.method==='POST') {
        limit(`write:${ip}`,180);limit(`actor:${room.data.id}:${identity.hash}`,60);
        const input=await body(req,Math.min(config.maxBodyBytes??8192,8192));
        if(!requestId(input.id))fail(400,'INVALID_ID','A bounded unique request ID is required.');
        await run(room,async data=>{
          if(route==='start') {
            if(!identity.host)fail(403,'HOST_REQUIRED','Only the host can start this room.');
            if(Object.keys(input).some(k=>k!=='id'))fail(400,'INVALID_START','Start accepts only a request ID.');
            if(data.startId===input.id)return;
            if(data.state)fail(409,'ALREADY_STARTED','This match has already started.');
            const next=structuredClone(data);next.startId=input.id;next.state=engine.createMatch({id:data.id,mode:data.mode,humanPlayerId:'p1',now:now(),config:config.rules||{},world:config.worldMode===true});await commit(room,next);
          } else {
            if(!identity.seatId)fail(403,'SPECTATOR','Spectators cannot act.');
            if(!data.state)fail(409,'NOT_STARTED','Start the match first.');
            const result=engine.applyAction(data.state,identity.seatId,input,now());
            if(!result.accepted){if(result.state.version!==data.state.version){const next=structuredClone(data);next.state=result.state;await commit(room,next);broadcast(room);}const error=result.error||{};fail(409,typeof error.code==='string'?error.code:'ACTION_REJECTED',typeof error.message==='string'?error.message:'Action rejected.');}
            const next=structuredClone(data);next.state=result.state;await commit(room,next);
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
        ws.identity=identity;ws.alive=true;room.sockets.add(ws);
        ws.on('error',()=>{});ws.on('pong',()=>{ws.alive=true;});ws.on('message',()=>ws.close(1008,'Use HTTP actions'));
        ws.on('close',()=>room.sockets.delete(ws));
        ws.send(JSON.stringify({type:'state',room:view(room,identity)}));
      });
    }catch(error){const safe=safeError(error),payload=JSON.stringify({error:safe.error});socket.end(`HTTP/1.1 ${safe.status} Rejected\r\nContent-Type: application/json\r\nConnection: close\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);}
  });
  function scheduleAi(room) {
    if(closing||room.aiBusy||room.aiBlocked||room.removed||!room.data.state||['ended','paused'].includes(room.data.state.phase))return;
    const roster=(room.data.state.players??CHARACTERS).slice(0,24).map(p=>({id:p.id,name:p.name,color:p.color}));
    const player=roster.filter(p=>(room.data.mode==='spectator'||p.id!=='p1')&&(room.nextDecision.get(p.id)||0)<=now()&&engine.getPlayerView(room.data.state,p.id,now()).self?.alive).sort((a,b)=>(room.nextDecision.get(a.id)||0)-(room.nextDecision.get(b.id)||0))[0];
    if(!player)return;
    room.nextDecision.set(player.id,now()+Math.max(100,config.ai?.decisionIntervalMs??1800));room.aiBusy=true;
    track((async()=>{
      const originState=room.data.state,generation=room.aiGeneration;
      const context=structuredClone(room.data.aiContext),snapshot=engine.getPlayerView(room.data.state,player.id,now());
      const freshView=()=>room.aiGeneration===generation&&!room.removed&&room.data.state?.id===originState.id?engine.getPlayerView(room.data.state,player.id,now()):null;
      const valid=()=>{const v=freshView();return room.aiGeneration===generation&&!room.removed&&v?.matchId===snapshot.matchId&&v.phase===snapshot.phase&&v.meeting?.id===snapshot.meeting?.id&&v.self?.alive;};
      try {
        const commitReservation=async({id,amountUsd})=>{
          if(closing||room.abort.signal.aborted||!valid())throw new Error('AI stopped');
          if(typeof id!=='string'||!/^[A-Za-z0-9:._-]{1,150}$/.test(id)||!Number.isFinite(amountUsd)||amountUsd<0)throw new Error('Invalid AI reservation');
          await run(room,async data=>{if(!valid())throw new Error('AI stopped');const next=structuredClone(data);next.aiContext=structuredClone(context);await commit(room,next);});
          // Ordering is essential: match reservation, then deployment reservation, then send.
          await daily.reserve({id:`${room.data.id}:${id}`,amount:amountUsd});
        };
        const proposal=await ai.decide({view:snapshot,player,context,signal:room.abort.signal,commitReservation,getCurrentView:freshView});
        if(closing||room.abort.signal.aborted)return;
        await run(room,async data=>{
          if(!valid())return;
          const next=structuredClone(data);next.aiContext=structuredClone(context);
          if(proposal&&!['ended','paused'].includes(next.state.phase)) {
            const result=engine.applyAction(next.state,player.id,proposal,now());next.state=result.state;
          }
          await commit(room,next);
        });broadcast(room);
      }catch {room.aiBlocked=true;if(!closing)broadcast(room);}
      finally {room.aiBusy=false;}
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
            if(result.state.version!==data.state.version){const next=structuredClone(data);next.state=result.state;await commit(room,next);broadcast(room);}
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
