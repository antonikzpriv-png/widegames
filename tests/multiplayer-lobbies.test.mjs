import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createGameServer} from '../server/transport.mjs';
import {createRoom,issueIdentity} from '../server/rooms.mjs';
import {createRoomStore,validateRoomSnapshot} from '../server/store.mjs';
import * as engine from '../server/engine/index.mjs';
import {LOBBY_DEFAULTS,PERSONAS,rosterFor,changeSettings} from '../shared/lobby.mjs';
import {WORLD,worldSpawn,isWalkable,distance} from '../shared/world.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {makeRequest} from '../server/ai/anthropic.mjs';
import {createDailyBudget} from '../server/budget.mjs';
import {taskProgress,taskInput} from '../server/engine/tasks.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<200;i++){const v=await fn();if(v)return v;await delay(10);}throw Error('Timeout: '+label);}
const idle={describe:()=>({mode:'demo'}),decide:async()=>null};
async function fixture(t,{ai=idle,rules={},worldMode=true,daily,seed}={}){
 const directory=await mkdtemp(path.join(tmpdir(),'lantern-multiplayer-'));let now=100000,game,origin;
 async function boot(){game=await createGameServer({dataDir:directory,publicOrigin:'http://multiplayer.test',worldMode,tickMs:15,now:()=>now,rules,ai:{provider:'demo',decisionIntervalMs:100,maxDailyCostUsd:5}},{aiController:ai,...(daily?{dailyBudget:daily}:{}),...(seed===undefined?{}:{engine:{...engine,createMatch:options=>engine.createMatch({...options,seed})}})});await new Promise(r=>game.server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${game.server.address().port}`;}
 await boot();t.after(async()=>{await game.close();await rm(directory,{recursive:true,force:true});});
 async function request(route,body,cookie,extra={}){const r=await fetch(origin+route,{method:body===undefined?'GET':'POST',headers:{Origin:'http://multiplayer.test',...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function socket(id,cookie){const frames=[],ws=new WebSocket(origin.replace('http:','ws:')+`/api/rooms/${id}/socket`,{headers:{Origin:'http://multiplayer.test',Cookie:cookie}});ws.on('message',b=>frames.push(JSON.parse(b)));await until(()=>frames.length,'socket initial frame');t.after(()=>ws.terminate());return {ws,frames};}
 async function create(mode='human'){const r=await request('/api/rooms',{mode});assert.equal(r.status,201,JSON.stringify(r.body));return {...r,id:r.body.roomId,route:`/api/rooms/${r.body.roomId}`};}
 return {get game(){return game;},get now(){return now;},directory,request,socket,create,advance:ms=>{now+=ms;},restart:async()=>{await game.close();await boot();}};
}
function assertPrivate(view){
 if(view.game.phase!=='ended')assert(view.game.players.every(p=>!Object.hasOwn(p,'role')));
 assert(!JSON.stringify(view).includes('"hash"'));assert(!Object.hasOwn(view,'aiContext'));
 if(view.game.self?.role!=='saboteur')assert(!view.game.self||!Object.hasOwn(view.game.self,'teammates'));
}
for(const capacity of [4,6,15])test(`multiplayer ${capacity}: serialized seats, strict save/reload and actor-specific HTTP/WS`,async t=>{
 const f=await fixture(t),host=await f.create(),saboteurs=capacity===15?3:1;
 const settings=await f.request(host.route+'/settings',{settings:{capacity,saboteurs}},host.cookie);assert.equal(settings.status,200);
 const joined=await Promise.all(Array.from({length:capacity-1},(_,i)=>f.request(host.route+'/join',{intent:'play',name:`Human ${i+2}`})));
 assert(joined.every(r=>r.status===200));assert.equal(new Set(joined.map(r=>r.body.seatId)).size,capacity-1);
 const people=[host,...joined];
 for(const person of joined){assert.equal((await f.request(host.route+'/ready',{ready:true},person.cookie)).status,200);}
 assert.equal((await f.request(host.route+'/join',{intent:'play'})).status,409,'cannot overbook');
 const starts=await Promise.all([f.request(host.route+'/start',{id:'same-start'},host.cookie),f.request(host.route+'/start',{id:'same-start'},host.cookie)]);assert(starts.every(r=>r.status===200));
 const entry=f.game.rooms.get(host.id);assert.equal(entry.data.state.players.length,capacity);assert.equal(entry.data.state.players.filter(p=>p.human).length,capacity);assert.equal(entry.data.state.players.filter(p=>p.role==='saboteur').length,saboteurs);
 for(const person of people){const view=await f.request(host.route,undefined,person.cookie);assert.equal(view.status,200);assert.equal(view.body.game.self.id,view.body.seatId);assertPrivate(view.body);const actor=entry.data.state.players.find(p=>p.id===view.body.seatId);if(actor.role==='saboteur')assert.equal(view.body.game.self.teammates.length,saboteurs-1);}
 const last=joined.at(-1),seatId=last.body.seatId,ws=await f.socket(host.id,last.cookie);assert.equal(ws.frames[0].room.game.self.id,seatId);assertPrivate(ws.frames[0].room);
 assert.equal((await f.request(host.route+'/input',{seq:1,dx:1,dy:0},last.cookie)).status,200);
 assert.equal(entry.data.state.players.find(p=>p.id===seatId).motion.seq,1);assert.equal(entry.data.state.players[0].motion.seq,0);
 assert.equal((await f.request(host.route+'/action',{id:'own-action',type:'wait',playerId:'p1'},last.cookie)).status,409);
 assert.equal(entry.data.state.requests.p1.length,0);
 if(capacity===15){for(const person of [...people.filter(person=>entry.data.state.players.find(p=>p.id===person.body.seatId)?.role==='saboteur'),people.find(person=>entry.data.state.players.find(p=>p.id===person.body.seatId)?.role==='crew')]){const channel=await f.socket(host.id,person.cookie);assertPrivate(channel.frames[0].room);assert.equal(channel.frames[0].room.game.self.id,person.body.seatId);channel.ws.terminate();}}
 const late=await f.request(host.route+'/join',{intent:'play'});assert.equal(late.status,200);assert.equal(late.body.seatId,null);assert.equal(late.body.game.self,null);assertPrivate(late.body);const spectatorSocket=await f.socket(host.id,late.cookie);assertPrivate(spectatorSocket.frames[0].room);assert.equal(spectatorSocket.frames[0].room.game.self,null);spectatorSocket.ws.terminate();
 assert.equal((await f.request(host.route+'/seat',{seatId:'p1'},late.cookie)).status,409);
 assert.equal((await f.request(host.route+'/settings',{settings:{speed:300}},host.cookie)).status,409);
 ws.ws.terminate();await f.restart();const restored=f.game.rooms.get(host.id).data;assert.equal(restored.state.players.length,capacity);assert.equal(restored.state.players.find(p=>p.id===seatId).motion.seq,1);
 const reconnect=await f.request(host.route+'/join',{},last.cookie);assert.equal(reconnect.body.seatId,seatId);assert.equal(reconnect.body.game.self.id,seatId);assertPrivate(reconnect.body);
 assert(!(await readdir(f.directory)).some(p=>p.includes('quarantine')));
 await validateRoomSnapshot(restored);
});

test('spawns, settings bounds/faction ratios, separate room speed/vision and teammate privacy',()=>{
 const points=PERSONAS.map(p=>worldSpawn(p.id));for(const [i,p]of points.entries()){assert(isWalkable(p));for(const q of points.slice(i+1))assert(distance(p,q)>=2*WORLD.bodyRadius);}
 for(const patch of [{capacity:3},{capacity:16},{capacity:4,saboteurs:2},{capacity:6,saboteurs:3},{tasksPerCrew:0},{speed:Infinity},{vision:601},{votingMs:1},{unknown:true}])assert.throws(()=>changeSettings(LOBBY_DEFAULTS,patch));
 const settings=changeSettings(LOBBY_DEFAULTS,{capacity:15,saboteurs:3,speed:300,vision:120}),other=changeSettings(LOBBY_DEFAULTS,{speed:90,vision:600});
 let a=engine.createMatch({id:'dynamic',world:true,now:100000,settings,roster:rosterFor(15),seed:'settings'}),b=engine.createMatch({id:'other',world:true,now:100000,settings:other,seed:'settings'});
 const a0={...a.players[0].position},b0={...b.players[0].position};a=engine.applyInput(a,'p1',{seq:1,dx:-1,dy:0},100000).state;b=engine.applyInput(b,'p1',{seq:1,dx:-1,dy:0},100000).state;
 a=engine.tick(a,100100).state;b=engine.tick(b,100100).state;assert(Math.abs(distance(a0,a.players[0].position)-30)<.001);assert(Math.abs(distance(b0,b.players[0].position)-9)<.001);assert.equal(WORLD.speed,180);assert.equal(WORLD.visibilityRadius,360);
 const sab=a.players.filter(p=>p.role==='saboteur'),crew=a.players.find(p=>p.role==='crew');assert.equal(engine.getPlayerView(a,sab[0].id).self.teammates.length,2);
 for(const p of a.players){const v=engine.getPlayerView(a,p.id);assert(v.players.every(q=>!Object.hasOwn(q,'role')));if(p.role==='crew')assert(!Object.hasOwn(v.self,'teammates'));}
 const observer=engine.getPlayerView(a,null);assert.equal(observer.self,null);assert(observer.players.every(p=>!Object.hasOwn(p,'role')));
 assert(engine.getPlayerView(a,crew.id).players.filter(p=>p.position).every(p=>distance(p.position,a.players.find(q=>q.id===crew.id).position)<=120));
});

test('settings, claims and start serialize; host authentication and readiness gate transitions',async t=>{
 const f=await fixture(t),host=await f.create(),visitor=await f.request(host.route+'/join',{});
 assert.equal((await f.request(host.route+'/settings',{settings:{capacity:15}},visitor.cookie)).status,403);
 assert.equal((await f.request(host.route+'/start',{id:'visitor-start'},visitor.cookie)).status,403);
 const claimed=await f.request(host.route+'/seat',{seatId:'p2'},visitor.cookie);assert.equal(claimed.status,200);
 assert.equal((await f.request(host.route+'/start',{id:'not-ready'},host.cookie)).status,409);
 const race=await Promise.all([f.request(host.route+'/ready',{ready:true},visitor.cookie),f.request(host.route+'/start',{id:'racing-start'},host.cookie)]);
 if(race[1].status!==200)assert.equal((await f.request(host.route+'/start',{id:'after-ready'},host.cookie)).status,200);
 const state=f.game.rooms.get(host.id).data.state;assert(state.players[1].human);assert.equal((await f.request(host.route+'/seat',{seatId:'p3'},visitor.cookie)).status,409);
 const concurrentHost=await f.create(),raceJoin=await Promise.all([f.request(concurrentHost.route+'/join',{intent:'play'}),f.request(concurrentHost.route+'/start',{id:'join-race'},concurrentHost.cookie)]);
 if(raceJoin[1].status===200){assert.equal(raceJoin[0].body.seatId,null);assert.equal(f.game.rooms.get(concurrentHost.id).data.state.players.filter(p=>p.human).length,1);}else{assert.equal(raceJoin[1].status,409);await f.request(concurrentHost.route+'/ready',{ready:true},raceJoin[0].cookie);assert.equal((await f.request(concurrentHost.route+'/start',{id:'ready-after-join'},concurrentHost.cookie)).status,200);assert.equal(f.game.rooms.get(concurrentHost.id).data.state.players.filter(p=>p.human).length,2);}
 const code=await f.request('/api/invitations',{code:host.body.inviteCode.toLowerCase()});assert.equal(code.body.roomId,host.id);
});

test('socket projection re-resolves reassigned seats and revocation; queued HTTP cannot retain old authority',async t=>{
 const f=await fixture(t),host=await f.create(),guest=await f.request(host.route+'/join',{intent:'play'}),watch=await f.socket(host.id,guest.cookie);
 assert.equal(watch.frames[0].room.seatId,'p2');await f.request(host.route+'/members',{seatId:'p2',operation:'release'},host.cookie);
 await until(()=>watch.frames.some(x=>x.room.seatId===null),'socket loses seat');
 await f.request(host.route+'/seat',{seatId:'p3'},guest.cookie);await until(()=>watch.frames.some(x=>x.room.seatId==='p3'),'socket gains current seat');
 await f.request(host.route+'/ready',{ready:true},guest.cookie);await f.request(host.route+'/start',{id:'start'},host.cookie);
 await until(()=>watch.frames.some(x=>x.room.game?.self?.id==='p3'),'socket own role');
 const queued=f.game.rooms.get(host.id);let release;const block=new Promise(r=>{release=r;});queued.queue=block;
 const revoke=f.request(host.route+'/members',{seatId:'p3',operation:'revoke'},host.cookie);await delay(25);
 const action=f.request(host.route+'/action',{id:'late-write',type:'wait'},guest.cookie);await delay(25);release();
 assert.equal((await revoke).status,200);assert.equal((await action).status,401);
 await until(()=>watch.ws.readyState===WebSocket.CLOSED,'revoked socket closes');assert.equal((await f.request(host.route,undefined,guest.cookie)).status,401);
 assert.equal(queued.data.state.requests.p3.length,0);assert(queued.data.state.players.find(p=>p.id==='p3').human,'revoked seat stays idle; no silent AI takeover');
});

test('human actors excluded from AI scheduling and dynamic p10–p15 AI proposals/prompts are supported',async t=>{
 const seen=new Set(),ai={describe:()=>({mode:'demo'}),async decide({player,view}){assert(!Object.hasOwn(player,'role'));assert(!Object.hasOwn(player,'tasks'));assert.equal(view.self.id,player.id);seen.add(player.id);return null;}};
 const f=await fixture(t,{ai}),host=await f.create();await f.request(host.route+'/settings',{settings:{capacity:15,saboteurs:3}},host.cookie);
 const guest=await f.request(host.route+'/join',{intent:'play'});await f.request(host.route+'/ready',{ready:true},guest.cookie);await f.request(host.route+'/start',{id:'ai-start'},host.cookie);
 for(let i=0;i<20;i++){f.advance(150);await delay(25);}assert(!seen.has('p1'));assert(!seen.has('p2'));for(let i=3;i<=15;i++)assert(seen.has('p'+i));
 const state=f.game.rooms.get(host.id).data.state,controller=createAiController({config:{provider:'demo',decisionIntervalMs:1}});
 for(let i=10;i<=15;i++){const player=PERSONAS[i-1],view=engine.getPlayerView(state,player.id,f.now),proposal=await controller.decide({view,player,context:{}});assert(proposal,'dynamic bot proposal');}
 const council=engine.tick(state,state.deadlineAt).state,actor=council.players.find(p=>p.role==='saboteur'),view=engine.getPlayerView(council,actor.id,council.updatedAt),request=makeRequest(view,PERSONAS.find(p=>p.id===actor.id),{},[{type:'say',text:'Safe dialogue.'}]);
 const snapshot=JSON.parse(JSON.parse(request.body).messages[0].content);assert.equal(snapshot.players.length,15);assert.equal(snapshot.self.teammates.length,2);
});

test('multiple saboteurs: ejecting one does not end; ejecting all wins; living parity wins; p15 body persists',async t=>{
 const settings=changeSettings(LOBBY_DEFAULTS,{capacity:15,saboteurs:3});let state=engine.createMatch({id:'large',settings,roster:rosterFor(15),world:true,seed:'victory',now:100000,config:{meetingCooldownMs:1,discussionMs:1,votingMs:1,killCooldownMs:1,initialKillCooldownMs:1}});
 const saboteurs=state.players.filter(p=>p.role==='saboteur');let now=100002;
 for(const [i,sab]of saboteurs.entries()){
  // The legal emergency caller fixture starts at the actual Bridge bell.
  const caller=state.players.find(p=>p.alive&&p.role==='crew');caller.position={x:800,y:250};caller.cooldowns.meetingAt=now;caller.meetingsRemaining=10;
  state=engine.applyAction(state,caller.id,{id:'meeting'+i,type:'meeting'},now).state;state=engine.tick(state,now+1).state;
  for(const p of state.players.filter(p=>p.alive))state=engine.applyAction(state,p.id,{id:'vote'+i,type:'vote',targetId:sab.id},now+1).state;
  state=engine.tick(state,now+2).state;if(i<2)assert.notEqual(state.phase,'ended');now+=4;
 }
 assert.equal(state.outcome.winner,'crew');
 let parity=engine.createMatch({id:'parity',settings:changeSettings(LOBBY_DEFAULTS,{capacity:7,saboteurs:3}),roster:rosterFor(7),seed:'parity',now:1,config:{initialKillCooldownMs:1}});
 const attacker=parity.players.find(p=>p.role==='saboteur'),victim=parity.players.find(p=>p.role==='crew');parity=engine.applyAction(parity,attacker.id,{id:'parity-kill',type:'eliminate',targetId:victim.id},2).state;assert.equal(parity.outcome.winner,'saboteur');
 let seed=0,large;do{large=engine.createMatch({id:'bodies',settings,roster:rosterFor(15),seed:String(seed++),now:1,world:true,config:{initialKillCooldownMs:1}});}while(large.players.slice(9).some(p=>p.role!=='crew'));
 for(let i=9;i<15;i++){const killer=large.players.find(p=>p.role==='saboteur');killer.position={...large.players[i].position};killer.cooldowns.killAt=i;large=engine.applyAction(large,killer.id,{id:'kill-p'+(i+1),type:'eliminate',targetId:'p'+(i+1)},i).state;}
 assert.equal(large.bodies.length,6);for(let i=10;i<=15;i++)assert(large.bodies.some(b=>b.id==='body-p'+i));
 const room=createRoom('human',1,true);issueIdentity(room,true);room.settings=settings;room.roster=rosterFor(15);large.id=room.id;room.state=large;room.startId='body-start';room.updatedAt=large.updatedAt;await validateRoomSnapshot(room);
 const directory=await mkdtemp(path.join(tmpdir(),'lantern-bodies-')),store=await createRoomStore(directory);try{await store.save(room);const [restored]=await store.load();assert.equal(restored.state.bodies.length,6);assert(restored.state.bodies.some(b=>b.id==='body-p15'));}finally{await store.close();await rm(directory,{recursive:true,force:true});}
 for(const mutate of [r=>r.identities.push({...r.identities[0],hash:'b'.repeat(64),host:false}),r=>r.state.players[14].id='p1',r=>r.state.bodies[0].id='body-p16',r=>r.state.players[14].role='saboteur',r=>r.state.lobbySettings.speed=999,r=>r.state.players[14].badge='1',r=>r.state.players[14].persona='Changed persona',r=>r.lastRematch={from:0}]){const bad=structuredClone(room);mutate(bad);await assert.rejects(validateRoomSnapshot(bad));}
});

test('rematch fences pending AI/provider/reservations/actions/input, resets context and preserves budget/replay/group',async t=>{
 let captured,finish;const pending=new Promise(r=>{finish=r;});t.after(()=>finish(null));
 const ai={describe:()=>({mode:'demo'}),async decide(args){if(captured)return null;captured=args;args.context.oldMemory='private';await args.commitReservation({id:'uncertain_old',amountUsd:.1});return pending;}};
 const f=await fixture(t,{ai,rules:{tasksPerCrew:1}}),host=await f.create(),guest=await f.request(host.route+'/join',{intent:'play'});
 await f.request(host.route+'/ready',{ready:true},guest.cookie);await f.request(host.route+'/start',{id:'start'},host.cookie);await until(()=>captured,'pending AI');await until(async()=>{try{return JSON.parse(await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8')).total>0;}catch{return false;}},'durable budget');
 const entry=f.game.rooms.get(host.id),oldId=entry.data.state.id;
 // Reach a rules-based terminal state by completing every crew task through engine actions.
 for(const actor of [...entry.data.state.players.filter(p=>p.role==='crew')])for(const task of [...actor.tasks]){
  const player=entry.data.state.players.find(p=>p.id===actor.id);
  player.position={x:task.roomId==='bridge'?930:({archive:370,lantern:1450,workshop:930,galley:370,engine:1450})[task.roomId],y:({bridge:230,archive:510,lantern:510,workshop:730,galley:960,engine:960})[task.roomId]};
  player.roomId=task.roomId;player.cooldowns.taskAt=f.now;
  for(let step=0;step<5;step++){const current=entry.data.state.players.find(p=>p.id===player.id).tasks.find(t=>t.id===task.id),progress=taskProgress(current);if(progress.index>=progress.total)break;if(progress.kind==='repair'&&progress.index===3&&f.now<progress.readyAt)f.advance(progress.readyAt-f.now);const result=engine.applyAction(entry.data.state,player.id,{id:`step-${task.id}-${progress.index}`,type:'taskStep',taskId:task.id,step:progress.index,input:taskInput(current)},f.now);assert(result.accepted,JSON.stringify(result.error));entry.data.state=result.state;}
  const completed=engine.applyAction(entry.data.state,player.id,{id:'complete-'+task.id,type:'task',taskId:task.id},f.now);assert(completed.accepted,JSON.stringify(completed.error));entry.data.state=completed.state;
 }
 assert.equal(entry.data.state.phase,'ended');
 const rematch=await f.request(host.route+'/rematch',{id:'again',generation:1},host.cookie);assert.equal(rematch.status,200,JSON.stringify(rematch.body));assert.equal(rematch.body.generation,2);assert.equal(rematch.body.game,null);assert.equal(rematch.body.inviteCode,host.body.inviteCode);assert.equal(entry.data.aiContext.oldMemory,undefined);
 await assert.rejects(captured.commitReservation({id:'late_old',amountUsd:.3}));
 assert.equal((await f.request(host.route+'/rematch',{id:'again',generation:1},host.cookie)).body.generation,2,'idempotent rematch');
 const replay=await f.request(host.route+'/replay',undefined,host.cookie,{'X-Match-ID':oldId});assert.equal(replay.status,200);assert(replay.body.replay.some(e=>e.type==='role_reveal'));
 assert.equal((await f.request(host.route+'/start',{id:'old-start',generation:1},host.cookie)).status,409);
 await f.request(host.route+'/ready',{ready:true,generation:2},guest.cookie);const started=await f.request(host.route+'/start',{id:'new-start',generation:2},host.cookie);assert.equal(started.status,200);assert.notEqual(started.body.game.matchId,oldId);assert.equal(started.body.game.version,1);
 assert.equal((await f.request(host.route+'/input',{seq:99,dx:1,dy:1,generation:1,matchId:oldId},host.cookie)).status,409);
 assert.equal((await f.request(host.route+'/input',{seq:99,dx:1,dy:1},host.cookie)).status,409);
 assert.equal((await f.request(host.route+'/action',{id:'old-action',type:'wait',generation:1,matchId:oldId},host.cookie)).status,409);
 finish({id:'late-ai',type:'wait'});await delay(70);assert.equal(entry.data.state.requests[captured.player.id].length,0);assert.equal(entry.data.aiContext.oldMemory,undefined);assert(entry.data.state.players.every(p=>p.motion.seq===0));
 const budget=JSON.parse(await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8'));assert(budget.reservations[oldId+':uncertain_old']);assert(!budget.reservations[oldId+':late_old']);
 await f.restart();assert.equal(f.game.rooms.get(host.id).data.generation,2);assert.equal((await f.request(host.route,undefined,guest.cookie)).body.seatId,guest.body.seatId);
});

test('valid historical room schema1 with legacy or world state survives byte-preserving save/restore',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'lantern-legacy-'));const store=await createRoomStore(directory);t.after(async()=>{await store.close();await rm(directory,{recursive:true,force:true});});
 for(const world of [false,true]){const room=createRoom('human',100000);issueIdentity(room,true);room.startId='old';room.state=engine.createMatch({id:room.id,now:100000,world});await store.save(room);const file=path.join(directory,`room-${room.id}.json`),before=await readFile(file,'utf8');assert((await store.load()).some(r=>r.id===room.id));assert.equal(await readFile(file,'utf8'),before);}
 assert(!(await readdir(directory)).some(p=>p.includes('quarantine')));
});

test('audit: named legacy create remains compatible',async t=>{
 const f=await fixture(t,{worldMode:false});
 const named=await f.request('/api/rooms',{mode:'human',name:'Legacy captain'});
 assert.equal(named.status,201,JSON.stringify(named.body));assert.equal(named.body.seatId,'p1');
});

test('audit: retrying auto-claim retains the same ready seat even when the lobby is full',async t=>{
 const f=await fixture(t),host=await f.create();await f.request(host.route+'/settings',{settings:{capacity:4}},host.cookie);
 const people=await Promise.all(Array.from({length:3},()=>f.request(host.route+'/join',{intent:'play'})));
 const guest=people[0];await f.request(host.route+'/ready',{ready:true},guest.cookie);
 const retry=await f.request(host.route+'/seat',{seatId:'auto'},guest.cookie);
 assert.equal(retry.status,200);assert.equal(retry.body.seatId,guest.body.seatId);assert.equal(retry.body.ready,true);
 assert.equal(new Set(f.game.rooms.get(host.id).data.identities.map(i=>i.seatId)).size,4);
});

test('audit: host authorization also applies to duplicate rematch requests',async t=>{
 const f=await fixture(t,{rules:{maxMatchMs:1}}),host=await f.create(),guest=await f.request(host.route+'/join',{});
 await f.request(host.route+'/start',{id:'terminal-start'},host.cookie);f.advance(2);await until(()=>f.game.rooms.get(host.id).data.state.phase==='paused','paused');
 const input={id:'known-rematch-id',generation:1};assert.equal((await f.request(host.route+'/rematch',input,host.cookie)).status,200);
 assert.equal((await f.request(host.route+'/rematch',input,guest.cookie)).status,403);
 assert.equal((await f.request(host.route+'/rematch',input,host.cookie)).status,200);
});

test('audit: disabled emergency bell does not divert suspicious crew from unfinished stations',async()=>{
 const {worldCandidates}=await import('../server/ai/world.mjs');
 const settings=changeSettings(LOBBY_DEFAULTS,{emergencyMeetingsEnabled:false});
 const state=engine.createMatch({id:'no-bell',settings,world:true,now:100000,seed:'no-bell',config:{meetingCooldownMs:1}}),actor=state.players.find(p=>p.role==='crew');
 actor.position={x:800,y:250};actor.roomId='bridge';actor.tasks[0].roomId='galley';
 const view=engine.getPlayerView(state,actor.id,100002);view.self.tasks=view.self.tasks.slice(0,1);
 const proposal=worldCandidates(view,{},state.players.find(p=>p.id!==actor.id).id)[0];
 assert.equal(proposal.type,'navigate');assert.equal(proposal.x,370);assert.equal(proposal.y,960);
});

test('audit: every supported capacity/faction ratio creates a private, restorable dynamic roster',async()=>{
 const before=JSON.stringify(WORLD);
 for(let capacity=4;capacity<=15;capacity++)for(let saboteurs=1;saboteurs<=3;saboteurs++){
  if(2*saboteurs>=capacity)continue;
  const settings=changeSettings(LOBBY_DEFAULTS,{capacity,saboteurs,tasksPerCrew:8,sabotageEnabled:false,emergencyMeetingsEnabled:false});
  const room=createRoom('human',100000,true);issueIdentity(room,true);room.settings=settings;room.roster=rosterFor(capacity);room.startId='all-settings';
  room.state=engine.createMatch({id:room.id,settings,roster:room.roster,world:true,now:100000,seed:`ratio-${capacity}-${saboteurs}`});
  assert.equal(room.state.players.filter(p=>p.role==='saboteur').length,saboteurs);assert.equal(room.state.players.flatMap(p=>p.tasks).length,(capacity-saboteurs)*8);
  await validateRoomSnapshot(JSON.parse(JSON.stringify(room)));
  for(const player of room.state.players){const v=engine.getPlayerView(room.state,player.id,200000);assert(!v.availableActions.includes('sabotage'));assert(!v.availableActions.includes('meeting'));assert(v.players.every(p=>!Object.hasOwn(p,'role')));if(player.role==='saboteur')assert.equal(v.self.teammates.length,saboteurs-1);else assert(!Object.hasOwn(v.self,'teammates'));}
 }
 assert.equal(JSON.stringify(WORLD),before);
});

for(const capacity of [4,15])test(`audit: real dynamic demo bots complete a ${capacity}-keeper world without paid calls`,async()=>{
 const settings=changeSettings(LOBBY_DEFAULTS,{capacity,saboteurs:capacity===15?3:1,tasksPerCrew:1});
 let state=engine.createMatch({id:`demo-${capacity}`,mode:'spectator',settings,roster:rosterFor(capacity),world:true,now:100000,seed:`demo-dynamic-${capacity}`});
 const context={},controller=createAiController({config:{provider:'demo',decisionIntervalMs:1}});
 for(let step=1;step<=400&&state.phase!=='ended';step++){
  const now=100000+step*1000;state=engine.tick(state,now).state;
  for(const p of state.players.filter(p=>p.alive)){
   const action=await controller.decide({view:engine.getPlayerView(state,p.id,now),player:PERSONAS.find(a=>a.id===p.id),context});
   if(action){const result=engine.applyAction(state,p.id,action,now);assert(result.accepted,JSON.stringify(result.error));state=result.state;}
  }
 }
 assert.equal(state.phase,'ended');assert(['crew','saboteur'].includes(state.outcome.winner));assert.equal(controller.describe(context).calls,0);assert.equal(controller.describe(context).costUsd,0);
});


test('audit: an in-flight daily reservation cannot grant an old provider send after rematch',async t=>{
 let f,release,ledger,started=false,finished=false,called=false,sends=0;
 const gate=new Promise(resolve=>{release=resolve;}),fallback=setTimeout(()=>release(),3500);fallback.unref();t.after(()=>{release();clearTimeout(fallback);});
 const daily={async reserve(reservation){ledger??=await createDailyBudget({directory:f.directory,maxCostUsd:5,now:()=>f.now});const result=await ledger.reserve(reservation);started=true;await gate;return result;}};
 const ai={describe:()=>({mode:'demo'}),async decide({context,commitReservation}){if(called)return null;called=true;context.olderGeneration='private';try{await commitReservation({id:'inflight_old',amountUsd:.2});sends++;return {id:'old-proposal',type:'wait'};}finally{finished=true;}}};
 f=await fixture(t,{ai,daily,rules:{maxMatchMs:1}});const host=await f.create();await f.request(host.route+'/start',{id:'old-watch'},host.cookie);await until(()=>started,'old deployment reservation persisted');
 f.advance(2);await until(()=>f.game.rooms.get(host.id).data.state.phase==='paused','old watch paused');
 assert.equal((await f.request(host.route+'/rematch',{id:'new-watch',generation:1},host.cookie)).status,200);
 assert.equal((await f.request(host.route+'/start',{id:'new-start',generation:2},host.cookie)).status,200);
 release();await until(()=>finished,'old callback fenced');await delay(30);
 const current=f.game.rooms.get(host.id);assert.equal(sends,0);assert.equal(current.data.aiContext.olderGeneration,undefined);assert.equal(current.aiBlocked,false);assert(current.data.state.players.every(p=>current.data.state.requests[p.id].length===0));
 const budget=JSON.parse(await readFile(path.join(f.directory,'ai-daily-budget.json'),'utf8'));assert.equal(budget.total,.2);assert.equal(budget.reservations[host.id+':inflight_old'],.2);
});

test('integration: 15 keepers preserve ghost task/chat privacy, optional abilities and fresh rematches',async t=>{
 const features={deathPolicy:'ghost-tasks',abilities:true},settings=changeSettings(LOBBY_DEFAULTS,{capacity:15,saboteurs:3,tasksPerCrew:1});
 let seed=0,probe;do{probe=engine.createMatch({id:'combined-seed',settings,roster:rosterFor(15),world:true,now:100000,seed:seed++,features});}while(probe.players[14].role!=='crew');
 const f=await fixture(t,{rules:{initialKillCooldownMs:1},seed:seed-1}),created=await f.request('/api/rooms',{mode:'human',features}),host={...created,id:created.body.roomId,route:'/api/rooms/'+created.body.roomId};assert.equal(created.status,201);
 assert.equal((await f.request(host.route+'/settings',{settings},host.cookie)).status,200);
 const guest=await f.request(host.route+'/join',{intent:'play'});assert.equal((await f.request(host.route+'/seat',{seatId:'p15'},guest.cookie)).status,200);await f.request(host.route+'/ready',{ready:true},guest.cookie);
 const entry=f.game.rooms.get(host.id);await f.request(host.route+'/start',{id:'optional-start'},host.cookie);
 const attacker=entry.data.state.players.find(p=>p.role==='saboteur'),destination=entry.data.state.players[14].position;
 async function fixtureAction(action){const work=entry.queue.then(()=>{const result=engine.applyAction(entry.data.state,attacker.id,action,f.now);assert(result.accepted,JSON.stringify(result.error));entry.data={...entry.data,state:result.state,updatedAt:f.now};});entry.queue=work.catch(()=>{});await work;}
 await fixtureAction({id:'approach-p15',type:'navigate',...destination});f.advance(5000);
 await until(()=>distance(entry.data.state.players.find(p=>p.id===attacker.id).position,entry.data.state.players[14].position)<=WORLD.killRadius,'approach dynamic human');
 await fixtureAction({id:'eliminate-p15',type:'eliminate',targetId:'p15'});
 const privateView=await f.request(host.route,undefined,guest.cookie);assert.equal(privateView.body.game.self.id,'p15');assert.equal(privateView.body.game.self.ghost,true);assert.equal(privateView.body.game.self.tasks.length,1);const corpse=structuredClone(entry.data.state.bodies.find(b=>b.playerId==='p15'));
 assert.equal((await f.request(host.route+'/action',{id:'p15-private-chat',type:'ghostSay',text:'Fallen p15 only'},guest.cookie)).status,200);
 const spectator=await f.request(host.route+'/join',{}),spectatorSocket=await f.socket(host.id,spectator.cookie);assert.equal(spectator.body.game.players[14].position,null);assert(!Object.hasOwn(spectator.body.game,'ghostChat'));assert(!Object.hasOwn(spectatorSocket.frames[0].room.game,'ghostChat'));spectatorSocket.ws.terminate();
 assert.equal((await f.request(host.route+'/input',{seq:1,dx:-1,dy:0},guest.cookie)).status,200);f.advance(100);await until(()=>distance(entry.data.state.players[14].position,corpse.position)>1,'dynamic ghost movement');assert.deepEqual(entry.data.state.bodies.find(b=>b.playerId==='p15'),corpse);
 await f.restart();const restored=await f.request(host.route,undefined,guest.cookie);assert(restored.body.game.self.ghost);assert.equal(restored.body.game.ghostChat.length,1);assert.equal(f.game.rooms.get(host.id).data.state.players.filter(p=>p.ability?.type==='ward').length,1);assert.equal(f.game.rooms.get(host.id).data.state.players.filter(p=>p.ability?.type==='echo').length,1);
 f.advance(900001);await until(()=>f.game.rooms.get(host.id).data.state.phase==='paused','optional pause');const next=await f.request(host.route+'/rematch',{id:'optional-rematch',generation:1},host.cookie);assert.equal(next.status,200);assert.deepEqual(next.body.features,features);await f.request(host.route+'/ready',{ready:true,generation:2},guest.cookie);
 assert.equal((await f.request(host.route+'/start',{id:'optional-next',generation:2},host.cookie)).status,200);const fresh=await f.request(host.route,undefined,guest.cookie);assert.equal(fresh.body.game.self.alive,true);assert.equal(fresh.body.game.self.ghost,false);assert.equal(fresh.body.game.self.inputSeq,0);assert(!Object.hasOwn(fresh.body.game,'ghostChat'));assert.equal(fresh.body.game.effects.length,0);assert(!(await readdir(f.directory)).some(p=>p.includes('quarantine')));
});

test('audit: humans sharing one network address retain normal movement throughput',async t=>{
 const f=await fixture(t),host=await f.create(),guest=await f.request(host.route+'/join',{intent:'play'});
 await f.request(host.route+'/ready',{ready:true},guest.cookie);assert.equal((await f.request(host.route+'/start',{id:'shared-address'},host.cookie)).status,200);f.advance(60001);
 for(let seq=1;seq<=310;seq++){const responses=await Promise.all([host.cookie,guest.cookie].map(cookie=>f.request(host.route+'/input',{seq,dx:0,dy:0},cookie)));assert(responses.every(r=>r.status===200),JSON.stringify({seq,responses}));}
});
