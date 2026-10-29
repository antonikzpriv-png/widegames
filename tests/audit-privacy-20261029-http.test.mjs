import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {once} from 'node:events';
import {createHash,randomUUID} from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'ws';
import {createGameServer} from '../server/transport.mjs';
import * as engine from '../server/engine/index.mjs';
import {ROOM_LAYOUT} from '../shared/contracts.mjs';

const PIN='0842a0090f1cfd1ec43b898f16e8191e5b9c2497';
const root=fileURLToPath(new URL('../',import.meta.url));
const origin='http://privacy-fixture.test';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){const end=Date.now()+4000;while(Date.now()<end){if(await check())return;await delay(10);}throw new Error('Timed out: '+label);}
// Inert, labeled actor fixture, not a test/approval of the AI implementation.
const inert={describe:()=>({mode:'demo',provider:'audit-fixture',calls:0,tokens:0,costUsd:0}),decide:async()=>null};
const rules={moveCooldownMs:1,taskCooldownMs:1,killCooldownMs:1,initialKillCooldownMs:1,meetingCooldownMs:1,discussionMs:100,votingMs:100,roamDeadlineMs:100000,maxMatchMs:1000000};
async function fixture(t,options={}){
 const parent=path.join(root,'_artifacts','test-temp');await mkdir(parent,{recursive:true});
 const directory=await mkdtemp(path.join(parent,'audit-privacy-20261029-'));
 let at=100000,game,base;
 const config={dataDir:directory,publicOrigin:origin,tickMs:60000,roomTtlMs:3600000,ai:{provider:'demo',decisionIntervalMs:60000},rules,now:()=>at,...options};
 let seed=0;while(engine.createMatch({id:'seed-search',seed,now:at}).players.find(p=>p.id==='p1').role!==(options.fixtureRole??'crew'))seed++;
 const seeded={...engine,createMatch:opts=>engine.createMatch({...opts,seed})};
 async function start(){game=await createGameServer(config,{engine:seeded,aiController:inert});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base=`http://127.0.0.1:${game.server.address().port}`;}
 await start();
 t.after(async()=>{await game.close();const absolute=path.resolve(directory);assert(absolute.startsWith(parent+path.sep)&&path.basename(absolute).startsWith('audit-privacy-20261029-'));await rm(absolute,{recursive:true,force:true});});
 async function request(route,{method='GET',data,raw,cookie,headers={}}={}){
  const response=await fetch(base+route,{method,redirect:'manual',headers:{Origin:origin,...(data!==undefined||raw!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:raw??(data===undefined?undefined:JSON.stringify(data))});
  const text=await response.text();let body;try{body=JSON.parse(text);}catch{body=text;}
  return {status:response.status,body,text,headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 const create=async()=>{const result=await request('/api/rooms',{method:'POST',data:{mode:'human'}});assert.equal(result.status,201);return result;};
 return {directory,config,request,create,get game(){return game;},get base(){return base;},get now(){return at;},set now(value){at=value;},step(){at+=10;},async restart(){await game.close();await start();}};
}
function privacy(view,internal,seatId){
 assert.equal(view.seatId,seatId);assert.equal(view.game.self?.id??null,seatId);
 assert(!Object.hasOwn(view,'identities'));assert(!Object.hasOwn(view,'aiContext'));
 for(const player of view.game.players){if(view.game.phase!=='ended')assert(!Object.hasOwn(player,'role'));assert(!Object.hasOwn(player,'tasks'));assert(!Object.hasOwn(player,'human'));}
 const serialized=JSON.stringify(view);
 for(const identity of internal.identities)assert(!serialized.includes(identity.hash));
 for(const key of ['"requests":','"replaySequence":','"repairers":','"visibleTo":','"schemaVersion":'])assert(!serialized.includes(key),key);
 if(!seatId){assert.equal(view.game.self,null);assert.deepEqual(view.game.availableActions,[]);}
}
async function wsResult(base,route,cookie,extra={}){
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(base.replace('http:','ws:')+route,{headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...extra}});
  const timer=setTimeout(()=>{ws.terminate();reject(new Error('WS fixture timeout'));},3000);
  ws.on('error',()=>{});
  ws.on('unexpected-response',(_req,res)=>{clearTimeout(timer);const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{ws.terminate();resolve({status:res.statusCode,text:Buffer.concat(chunks).toString()});});res.resume();});
  ws.once('message',data=>{clearTimeout(timer);resolve({status:101,ws,body:JSON.parse(data.toString())});});
 });
}

test('saved-revision credential ambiguity matrix rejects forged, renamed and cross-room cookies on HTTP and WS',async t=>{
 const f=await fixture(t),a=await f.create(),b=await f.create(),route=`/api/rooms/${a.body.roomId}`;
 const token=a.cookie.split('=')[1],name=a.cookie.split('=')[0];
 const rejected=[undefined,`${name}=${'f'.repeat(64)}`,`${name}=${token.toUpperCase()}`,`${name}=${token.slice(0,-1)}`,b.cookie,`${name}=${b.cookie.split('=')[1]}`,`${a.cookie}; ${a.cookie}`,`${a.cookie}; ${name}=`,`${name}=; ${a.cookie}`];
 for(const cookie of rejected){
  const reply=await f.request(route,{cookie});assert.equal(reply.status,401);assert.equal(reply.headers.get('cache-control'),'no-store');assert(!reply.text.includes(token));
  assert.equal((await wsResult(f.base,route+'/socket',cookie)).status,401);
 }
 const combined=`${b.cookie}; unrelated=ignored; ${a.cookie}`;
 assert.equal((await f.request(route,{cookie:combined})).body.seatId,'p1');
 const join=await f.request(route+'/join',{method:'POST',data:{},cookie:a.cookie});assert.equal(join.body.seatId,'p1');assert.equal(join.cookie,undefined);
 const guest=await f.request(route+'/join',{method:'POST',data:{}});assert.equal(guest.body.seatId,null);
 assert.equal((await f.request(route+'/start',{method:'POST',data:{id:'forged-host',host:true},cookie:guest.cookie})).status,403);
 const socket=await wsResult(f.base,route+'/socket',combined);assert.equal(socket.status,101);assert.equal(socket.body.room.seatId,'p1');socket.ws.terminate();
});

test('body/report/ejection/restart views retain redaction and only ended replay reveals identities',async t=>{
 const f=await fixture(t),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;
 const guest=await f.request(route+'/join',{method:'POST',data:{}});
 await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'start'}});
 const entry=f.game.rooms.get(host.body.roomId),sab=entry.data.state.players.find(p=>p.role==='saboteur').id;
 const victim=entry.data.state.players.find(p=>p.role==='crew'&&p.id!=='p1').id;
 const ejected=entry.data.state.players.find(p=>p.role==='crew'&&!['p1',victim].includes(p.id)).id;
 // Trusted precondition driver: real engine actions for NPCs, not forged client auth.
 function npc(playerId,action){f.step();const result=engine.applyAction(entry.data.state,playerId,{id:'fixture-'+randomUUID(),...action},f.now);assert(result.accepted,JSON.stringify(result.error));entry.data.state=result.state;}
 const send=async action=>{f.step();return f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'http-'+randomUUID(),...action}});};
 assert.equal((await send({type:'move',roomId:'archive'})).status,200);
 npc(sab,{type:'move',roomId:'lantern'});npc(sab,{type:'move',roomId:'engine'});
 npc(victim,{type:'move',roomId:'workshop'});npc(victim,{type:'move',roomId:'engine'});npc(sab,{type:'eliminate',targetId:victim});npc(sab,{type:'move',roomId:'lantern'});
 const first=await f.request(route,{cookie:host.cookie}),publicFirst=await f.request(route,{cookie:guest.cookie});
 privacy(first.body,entry.data,'p1');privacy(publicFirst.body,entry.data,null);
 assert(!first.body.game.events.some(e=>e.type==='witness'||e.type==='body'));assert(publicFirst.body.game.events.some(e=>e.type==='body'));
 const publicSocket=await wsResult(f.base,route+'/socket',guest.cookie);assert.equal(publicSocket.status,101);t.after(()=>publicSocket.ws.terminate());privacy(publicSocket.body.room,entry.data,null);
 for(const roomId of ['bridge','lantern','engine'])assert.equal((await send({type:'move',roomId})).status,200);
 const local=await f.request(route,{cookie:host.cookie});assert(local.body.game.events.some(e=>e.bodyId==='body-'+victim));
 assert.equal((await send({type:'report',bodyId:'body-'+victim})).status,200);
 const reportView=await f.request(route,{cookie:guest.cookie});assert(!reportView.body.game.events.some(e=>e.type==='body'));privacy(reportView.body,entry.data,null);
 f.now=entry.data.state.deadlineAt;
 assert.equal((await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'boundary-vote',type:'vote',targetId:'skip'}})).status,200);
 npc(sab,{type:'vote',targetId:ejected});const other=entry.data.state.players.find(p=>p.alive&&![sab,'p1',ejected].includes(p.id)).id;npc(other,{type:'vote',targetId:ejected});
 const voting=await f.request(route,{cookie:guest.cookie});assert(voting.body.game.meeting.votes.every(v=>!Object.hasOwn(v,'targetId')));privacy(voting.body,entry.data,null);
 f.now=entry.data.state.deadlineAt;
 const late=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'late-council-ballot',type:'vote',targetId:sab}});assert.equal(late.status,409);assert.equal(late.body.error.code,'WRONG_PHASE');
 const after=await f.request(route,{cookie:guest.cookie});assert.equal(after.body.game.phase,'roam');assert.equal(after.body.game.players.find(p=>p.id===ejected).alive,false);assert(after.body.game.meeting.votes.some(v=>v.targetId===ejected));privacy(after.body,entry.data,null);
 assert.equal((await f.request(route+'/replay',{cookie:guest.cookie})).status,409);
 publicSocket.ws.terminate();await f.restart();const restored=f.game.rooms.get(host.body.roomId);
 for(const [cookie,seat]of [[host.cookie,'p1'],[guest.cookie,null]]){const v=await f.request(route,{cookie});privacy(v.body,restored.data,seat);assert(!v.body.game.events.some(e=>e.type==='body'));assert(!v.body.game.players.find(p=>p.id===ejected).alive);}
 // Finish by legal crew tasks; only the authoritative engine creates the outcome.
 function apply(playerId,action){f.step();const result=engine.applyAction(restored.data.state,playerId,{id:'finish-'+randomUUID(),...action},f.now);assert(result.accepted,JSON.stringify(result.error));restored.data.state=result.state;}
 function pathTo(from,to){const queue=[[from]],seen=new Set([from]);for(const trail of queue){if(trail.at(-1)===to)return trail.slice(1);for(const next of ROOM_LAYOUT.find(r=>r.id===trail.at(-1)).neighbors)if(!seen.has(next)){seen.add(next);queue.push([...trail,next]);}}}
 for(const p of restored.data.state.players.filter(p=>p.alive&&p.role==='crew'&&p.id!=='p1'))for(const task of [...p.tasks].filter(t=>!t.completed)){for(const next of pathTo(restored.data.state.players.find(q=>q.id===p.id).roomId,task.roomId))apply(p.id,{type:'move',roomId:next});apply(p.id,{type:'task',taskId:task.id});}
 for(const task of [...restored.data.state.players.find(p=>p.id==='p1').tasks].filter(t=>!t.completed)){
  for(const next of pathTo(restored.data.state.players.find(p=>p.id==='p1').roomId,task.roomId))assert.equal((await send({type:'move',roomId:next})).status,200);
  assert.equal((await send({type:'task',taskId:task.id})).status,200);
 }
 const ended=await f.request(route,{cookie:guest.cookie});assert.equal(ended.body.game.phase,'ended');assert(ended.body.game.players.every(p=>p.role));
 const replay=await f.request(route+'/replay',{cookie:guest.cookie});assert.equal(replay.status,200);assert(replay.body.replay.some(e=>e.type==='witness'&&e.playerId===sab));assert(replay.body.replay.some(e=>e.type==='role_reveal'));
 assert.equal((await f.request(route+'/replay',{cookie:'invalid=credential'})).status,401);
});

test('malformed and private-file probes preserve API error redaction and no-store headers',async t=>{
 const f=await fixture(t),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;
 await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'start'}});
 for(const raw of ['null','[]','{"id":"x","type":"move","roomId":null}','{"id":"x","type":"wait","__proto__":{"host":true}}','{"id":null,"type":"wait"}','{"id":"x","type":"task","taskId":"guessed-other-task"}']){
  const r=await f.request(route+'/action',{method:'POST',cookie:host.cookie,raw});assert([400,409].includes(r.status));assert.equal(r.headers.get('cache-control'),'no-store');assert(!/stack|identities|aiContext|schemaVersion/.test(r.text));
 }
 for(const suffix of ['?token=secret','?playerId=p2','?__proto__=secret'])assert.equal((await f.request(route+suffix,{cookie:host.cookie})).status,400);
 for(const target of ['/server/config.mjs','/.env','/.git/config','/data/room-'+host.body.roomId+'.json','/shared/%2e%2e%2fserver%2fconfig.mjs','/shared/%2e%2e%5cserver%5cconfig.mjs','/%2e%2e%2fserver%2fstore.mjs','/shared/../../server/config.mjs']){const r=await f.request(target);assert.equal(r.status,404,target);assert(!r.text.includes('apiKey'));}
 const shell=await f.request('/r/'+host.body.roomId);assert.equal(shell.status,200);assert.match(shell.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(shell.headers.get('x-content-type-options'),'nosniff');assert(!shell.text.includes(host.cookie.split('=')[1]));
});

test('expired lobby credentials cannot revive a room and its established WS closes',async t=>{
 const f=await fixture(t,{tickMs:10,roomTtlMs:50}),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;
 const connected=await wsResult(f.base,route+'/socket',host.cookie);assert.equal(connected.status,101);const closed=once(connected.ws,'close');
 f.now+=100;await until(()=>!f.game.rooms.has(host.body.roomId),'room expiry');const [code]=await closed;assert.equal(code,1001);
 for(const suffix of ['','/replay'])assert.equal((await f.request(route+suffix,{cookie:host.cookie})).status,404);
 assert.equal((await f.request(route+'/join',{method:'POST',cookie:host.cookie,data:{}})).status,404);
 assert.equal((await wsResult(f.base,route+'/socket',host.cookie)).status,404);
 await f.restart();assert.equal((await f.request(route,{cookie:host.cookie})).status,404);
});

test('a partial HTTP body is judged at completion across discussion/voting boundary without ballot leakage',async t=>{
 const f=await fixture(t),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;
 const guest=await f.request(route+'/join',{method:'POST',data:{}});await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'start'}});f.step();
 assert.equal((await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'meeting',type:'meeting'}})).status,200);
 const entry=f.game.rooms.get(host.body.roomId),target=entry.data.state.players.find(p=>p.id!=='p1'&&p.role==='crew').id;
 const socket=await wsResult(f.base,route+'/socket',guest.cookie);assert.equal(socket.status,101);t.after(()=>socket.ws.terminate());
 const broadcast=once(socket.ws,'message');
 const raw=JSON.stringify({id:'split-body-vote',type:'vote',targetId:target}),arrived=once(f.game.server,'request');
 const response=new Promise((resolve,reject)=>{
  const req=http.request(f.base+route+'/action',{method:'POST',headers:{Origin:origin,Cookie:host.cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))}));});
  req.on('error',reject);req.write(raw.slice(0,20));
  arrived.then(()=>{f.now=entry.data.state.deadlineAt;req.end(raw.slice(20));}).catch(reject);
 });
 const replied=await response;assert.equal(replied.status,200);assert.equal(replied.body.game.phase,'voting');
 const [wire]=await broadcast,payload=JSON.parse(wire.toString());assert.equal(payload.room.game.phase,'voting');assert(payload.room.game.meeting.votes.every(v=>!Object.hasOwn(v,'targetId')));privacy(payload.room,entry.data,null);
 assert.equal((await f.request(route+'/replay',{cookie:guest.cookie})).status,409);
 f.now=entry.data.state.deadlineAt;
 const denied=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'disputed-late-vote',type:'vote',targetId:'skip'}});
 assert.equal(denied.status,409);assert.equal(denied.body.error.code,'WRONG_PHASE');
 const current=await f.request(route,{cookie:guest.cookie});assert.equal(current.body.game.phase,'roam');assert.equal(current.body.game.players.find(p=>p.id===target).alive,false);privacy(current.body,entry.data,null);
});

test('maximum-duration pause never becomes an unauthorized role reveal or replay after late requests/restart',async t=>{
 const f=await fixture(t,{rules:{...rules,maxMatchMs:1000}}),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;
 const guest=await f.request(route+'/join',{method:'POST',data:{}});await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'start'}});
 f.now+=1000;const rejected=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'at-maximum',type:'wait'}});assert.equal(rejected.status,409);assert.equal(rejected.body.error.code,'MATCH_INACTIVE');
 const entry=f.game.rooms.get(host.body.roomId),paused=await f.request(route,{cookie:guest.cookie});assert.equal(paused.body.game.phase,'paused');privacy(paused.body,entry.data,null);assert.equal((await f.request(route+'/replay',{cookie:guest.cookie})).status,409);
 await f.restart();f.now+=500000;const again=await f.request(route,{cookie:guest.cookie});assert.equal(again.body.game.phase,'paused');privacy(again.body,f.game.rooms.get(host.body.roomId).data,null);assert.equal((await f.request(route+'/replay',{cookie:guest.cookie})).status,409);
});

test('human saboteur and spectator WS views differ only by authorized private seat fields',async t=>{
 const f=await fixture(t,{fixtureRole:'saboteur'}),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;
 const guest=await f.request(route+'/join',{method:'POST',data:{}});f.step();await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'start'}});f.step();
 const own=await wsResult(f.base,route+'/socket',host.cookie),publicView=await wsResult(f.base,route+'/socket',guest.cookie);
 assert.equal(own.status,101);assert.equal(publicView.status,101);t.after(()=>{own.ws.terminate();publicView.ws.terminate();});
 const entry=f.game.rooms.get(host.body.roomId);privacy(own.body.room,entry.data,'p1');privacy(publicView.body.room,entry.data,null);
 assert.equal(own.body.room.game.self.role,'saboteur');assert.deepEqual(own.body.room.game.self.tasks,[]);assert.deepEqual(own.body.room.game.players,publicView.body.room.game.players);
 const impersonate=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'forge-actor',type:'wait',playerId:'p2'}});assert.equal(impersonate.status,409);assert.equal(impersonate.body.error.code,'INVALID_ACTION');
 const override=await f.request(route+'/action',{method:'POST',cookie:guest.cookie,data:{id:'forge-seat',type:'wait',seatId:'p1'}});assert.equal(override.status,403);
});

test('real council markup remains literal through HTTP response and saved frontend renderer fixture',async t=>{
 const {councilPanel,resultsPanel}=await import('../public/panels.mjs');
 const f=await fixture(t),host=await f.create(),route=`/api/rooms/${host.body.roomId}`;
 await f.request(route+'/start',{method:'POST',cookie:host.cookie,data:{id:'start'}});f.step();
 await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'meeting',type:'meeting'}});
 const text='<img src=x onerror="privateRole()"><script>steal()</script> & "crew"';
 const response=await f.request(route+'/action',{method:'POST',cookie:host.cookie,data:{id:'literal-dialogue',type:'say',text}});
 assert.equal(response.status,200);assert.equal(response.body.game.meeting.messages[0].text,text);
 class NodeFixture{
  constructor(type,tag='',value=''){this.nodeType=type;this.tagName=tag.toUpperCase();this.nodeValue=value;this.childNodes=[];}
  append(...nodes){this.childNodes.push(...nodes);}setAttribute(){}addEventListener(){}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(n=>n.textContent).join('');}
 }
 const previous={Node:globalThis.Node,document:globalThis.document};globalThis.Node=NodeFixture;globalThis.document={createElement:tag=>new NodeFixture(1,tag),createTextNode:text=>new NodeFixture(3,'',text)};
 t.after(()=>{for(const [key,value]of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
 const pane=councilPanel(response.body.game,{pending:false,act:()=>{},now:f.now,draft:'',setDraft:()=>{}});
 assert(pane.textContent.includes(text));const nodes=node=>[node,...node.childNodes.flatMap(nodes)];assert(!nodes(pane).some(n=>['IMG','SCRIPT'].includes(n.tagName)));
 assert.equal(resultsPanel(response.body.game,{}),null);
});
