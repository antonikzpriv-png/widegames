import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,applyAction,applyInput,tick,getPlayerView,getReplay} from '../server/engine/index.mjs';
import {WORLD_STATIONS as stations,WORLD_BELL,isWalkable} from '../shared/world.mjs';
import {ABILITY_RULES as R} from '../shared/features.mjs';
import {validateRoomSnapshot} from '../server/store.mjs';
import {parseFeatures} from '../shared/features.mjs';
import {loadConfig} from '../server/config.mjs';
const make=(features={deathPolicy:'ghost-tasks',abilities:true})=>createMatch({id:'ghost-fixture',mode:'spectator',world:true,seed:'ghost-fixture',now:1000,features,config:{initialKillCooldownMs:1,killCooldownMs:1,taskCooldownMs:1,meetingCooldownMs:1,discussionMs:100,votingMs:100}});
const clone=structuredClone;
let serial=0;
const act=(s,p,type,fields={},at=s.updatedAt)=>applyAction(s,p.id,{id:'g'+(++serial),type,...fields},at);
const place=(p,position=stations.bridge)=>{p.position={...position};p.roomId=Object.keys(stations).find(k=>stations[k]===position)||'bridge';};
function actors(s){return {sab:s.players.find(p=>p.role==='saboteur'),crew:s.players.filter(p=>p.role==='crew'),ward:s.players.find(p=>p.ability?.type==='ward')};}
function killed(features){let s=make(features);const {sab,crew}=actors(s);const victim=crew.find(p=>!p.ability)||crew[0];place(sab);place(victim);const result=act(s,sab,'eliminate',{targetId:victim.id},1001);assert(result.accepted);return {s:result.state,victim:result.state.players.find(p=>p.id===victim.id),sab:result.state.players.find(p=>p.id===sab.id)};}
function room(s){return {schema:1,id:s.id.padEnd(24,'x'),mode:s.mode,createdAt:1000,updatedAt:s.updatedAt,identities:[{hash:'a'.repeat(64),host:true,seatId:null}],state:{...s,id:s.id.padEnd(24,'x')},startId:'start',aiContext:{}};}

test('explicit presets validate outside numeric rules; defaults and old schema remain unchanged',()=>{
 const old=createMatch({id:'old',seed:'old',now:1000});assert.equal(old.features,undefined);assert.equal(old.effects,undefined);
 assert.deepEqual(parseFeatures(),{deathPolicy:'transfer',abilities:false});
 for(const features of [{deathPolicy:'ghost'},{abilities:1},{ghostMode:true},{deathPolicy:null}])assert.throws(()=>make(features),/Invalid feature/);
 assert.throws(()=>createMatch({id:'legacy',features:{abilities:true}}),/world/);
 assert.throws(()=>createMatch({id:'invalid',config:{ghostMode:true}}),/rules/);
 assert.equal(loadConfig({GAME_DEATH_POLICY:'ghost-tasks',GAME_ABILITIES:'true'}).features.abilities,true);
 assert.throws(()=>loadConfig({GAME_ABILITIES:'yes'}));assert.throws(()=>loadConfig({GAME_DEATH_POLICY:'invalid'}));
});

test('classic death transfers each unfinished task exactly once, preserving completed work, IDs and totals',()=>{
 let s=make({deathPolicy:'transfer'});const {sab,crew}=actors(s),v=crew[0];v.tasks[0].completed=true;const before=clone(s.players.flatMap(p=>p.tasks));place(sab);place(v);
 const a={id:'kill-once',type:'eliminate',targetId:v.id};const r=applyAction(s,sab.id,a,1001);assert(r.accepted);s=r.state;
 assert.deepEqual(s.players.find(p=>p.id===v.id).tasks,v.tasks.filter(t=>t.completed));
 assert.deepEqual(s.players.flatMap(p=>p.tasks).sort((a,b)=>a.id.localeCompare(b.id)),before.sort((a,b)=>a.id.localeCompare(b.id)));
 assert(applyAction(s,sab.id,a,1002).duplicate);assert.equal(applyInput(s,v.id,{seq:1,dx:1,dy:0},1002).error.code,'PLAYER_DEAD');
});

test('ghost death retains task identity/progress; dead movement and task completion preserve corpse and totals',()=>{
 let {s,victim:v}=killed({deathPolicy:'ghost-tasks'});const body=clone(s.bodies[0]),tasks=clone(v.tasks),total=s.players.flatMap(p=>p.tasks).length;
 assert.equal(v.alive,false);assert.deepEqual(v.tasks,tasks);
 let r=applyInput(s,v.id,{seq:1,dx:1,dy:0},1002);assert(r.accepted);s=tick(r.state,1202).state;
 assert.notDeepEqual(s.players.find(p=>p.id===v.id).position,body.position);assert.deepEqual(s.bodies[0],body);
 const living=getPlayerView(s,s.players.find(p=>p.alive&&p.role==='crew').id,1202),ghost=getPlayerView(s,v.id,1202),spectator=getPlayerView(s,null,1202);
 assert(ghost.self.ghost);assert.equal(ghost.self.alive,false);for(const view of [living,spectator]){const p=view.players.find(p=>p.id===v.id);assert.equal(p.position,null);assert.equal(p.roomId,null);assert.equal(view.ghostChat,undefined);}
 const task=v.tasks[0];place(s.players.find(p=>p.id===v.id),stations[task.roomId]);s.players.find(p=>p.id===v.id).motion.manual=false;
 r=act(s,v,'task',{taskId:task.id},1203);assert(r.accepted);assert.equal(r.state.players.flatMap(p=>p.tasks).length,total);assert.equal(r.state.players.find(p=>p.id===v.id).tasks[0].completed,true);assert.deepEqual(r.state.bodies[0],body);
});

test('ghost navigation uses ordinary walls, routes, input idempotency and lease expiry',()=>{
 let {s,victim:v}=killed({deathPolicy:'ghost-tasks'});
 assert.equal(act(s,v,'navigate',{x:0,y:0},1002).accepted,false);
 const r=applyInput(s,v.id,{seq:1,dx:1,dy:0},1002);assert(r.accepted);assert(applyInput(r.state,v.id,{seq:1,dx:1,dy:0},1100).duplicate);
 s=tick(r.state,2000).state;const pos=clone(s.players.find(p=>p.id===v.id).position);s=tick(s,3000).state;assert.deepEqual(s.players.find(p=>p.id===v.id).position,pos);assert(isWalkable(pos));
 const n=act(s,v,'navigate',stations.archive,3000);assert(n.accepted);s=tick(n.state,10000).state;assert.deepEqual(s.players.find(p=>p.id===v.id).position,{x:stations.archive.x,y:stations.archive.y});
});

test('ghosts cannot affect living reports, repair, emergency, eliminate, sabotage, council or votes',()=>{
 const {s,victim:v}=killed({deathPolicy:'ghost-tasks',abilities:true});
 for(const [type,fields]of [['report',{bodyId:s.bodies[0].id}],['repair',{}],['meeting',{}],['eliminate',{targetId:s.players.find(p=>p.alive).id}],['sabotage',{}],['say',{text:'hidden accusation'}],['vote',{targetId:'skip'}],['protect',{targetId:v.id}],['decoy',stations.bridge]])assert.equal(act(s,v,type,fields,1002).accepted,false,type);
 const living=s.players.find(p=>p.alive);place(living,stations.bridge);place(s.players.find(p=>p.id===s.bodies[0].playerId),stations.bridge);
 const reported=act(s,living,'report',{bodyId:s.bodies[0].id},1002);assert(reported.accepted);assert(!reported.state.meeting.eligibleVoters.includes(v.id));assert.equal(applyInput(reported.state,v.id,{seq:1,dx:1,dy:0},1003).error.code,'WRONG_PHASE');
});

test('elimination parity counts living crew only in the ghost preset',()=>{
 let {s,sab}=killed({deathPolicy:'ghost-tasks'});
 while(s.phase!=='ended') {const target=s.players.find(p=>p.alive&&p.role==='crew');place(target);place(s.players.find(p=>p.id===sab.id));const r=act(s,sab,'eliminate',{targetId:target.id},s.updatedAt+1);assert(r.accepted);s=r.state;}
 assert.equal(s.outcome.reason,'parity');assert.equal(s.players.filter(p=>p.role==='crew'&&p.alive).length,1);
});

test('ejection applies both death policies, excludes dead votes and preserves tasks',()=>{
 for(const deathPolicy of ['transfer','ghost-tasks']){
  let s=make({deathPolicy}),{crew}=actors(s),caller=crew[0],target=crew[1];place(caller,{x:WORLD_BELL.x,y:WORLD_BELL.y+60});
  s=act(s,caller,'meeting',{},1002).state;s=tick(s,1102).state;
  for(const p of s.players.filter(p=>p.alive))s=act(s,p,'vote',{targetId:target.id},1102).state;
  s=tick(s,1202).state;const v=s.players.find(p=>p.id===target.id);assert(!v.alive);assert.equal(s.players.flatMap(p=>p.tasks).length,15);assert.equal(v.tasks.length,deathPolicy==='transfer'?0:3);assert.equal(act(s,v,'vote',{targetId:'skip'},1202).accepted,false);
 }
});

test('fallen chat is bounded, dead-only, literal, idempotent and absent from public events/replay',()=>{
 let {s,victim:v,sab}=killed({deathPolicy:'ghost-tasks'});const a={id:'private',type:'ghostSay',text:'<img> hidden knowledge'};
 let r=applyAction(s,v.id,a,1002);assert(r.accepted);s=r.state;assert(applyAction(s,v.id,a,1003).duplicate);assert.equal(s.ghostChat.length,1);
 assert.equal(act(s,sab,'ghostSay',{text:'probe'},1003).error.code,'GHOST_ONLY');assert.equal(act(s,v,'ghostSay',{text:'too soon'},1003).error.code,'COOLDOWN');
 for(let i=1;i<20;i++){r=act(s,v,'ghostSay',{text:'private '+i},1002+i*2000);assert(r.accepted);s=r.state;}
 assert.equal(act(s,v,'ghostSay',{text:'over cap'},42002).error.code,'MESSAGE_LIMIT');
 assert.equal(getPlayerView(s,v.id,s.updatedAt).ghostChat.length,20);
 for(const id of [null,sab.id]){const text=JSON.stringify(getPlayerView(s,id,s.updatedAt));assert(!text.includes('hidden knowledge'));assert(!text.includes('private 19'));}
 assert(!JSON.stringify(s.events).includes('hidden knowledge'));s.phase='ended';assert(!JSON.stringify(getReplay(s)).includes('hidden knowledge'));
});

test('ward can target either faction and self without faction probes; metadata never changes base roles',()=>{
 for(const targetType of ['self','saboteur','crew']){
  const s=make(),{ward,sab,crew}=actors(s),target=targetType==='self'?ward:targetType==='saboteur'?sab:crew.find(p=>p.id!==ward.id);place(ward);place(target);
  const r=act(s,ward,'protect',{targetId:target.id});assert(r.accepted,targetType);assert.equal(r.state.effects[0].targetId,target.id);
  const view=getPlayerView(r.state,target.id,1000);assert.equal(view.players.find(p=>p.id===ward.id).role,undefined);assert(!('playerId'in view.effects[0]));assert.match(view.effects[0].id,/^fx-[a-f0-9]{32}$/);
  assert.equal(r.state.players.find(p=>p.id===ward.id).role,'crew');
 }
});

test('ward blocks one hit, consumes attacker cooldown, is idempotent, and never invents death/witness',()=>{
 let s=make(),{ward,sab,crew}=actors(s),target=crew.find(p=>p.id!==ward.id);[ward,sab,target].forEach(p=>place(p));
 const activation={id:'shield',type:'protect',targetId:target.id};s=applyAction(s,ward.id,activation,1000).state;assert(applyAction(s,ward.id,activation,1001).duplicate);
 const attack={id:'blocked',type:'eliminate',targetId:target.id};let r=applyAction(s,sab.id,attack,1001);assert(r.accepted);s=r.state;
 assert(s.players.find(p=>p.id===target.id).alive);assert.equal(s.effects.length,0);assert.equal(s.bodies.length,0);assert(!s.replay.some(e=>e.type==='witness'));assert.equal(s.players.find(p=>p.id===sab.id).cooldowns.killAt,1002);
 assert(applyAction(s,sab.id,attack,1002).duplicate);assert.equal(act(s,sab,'eliminate',{targetId:target.id},1002).state.players.find(p=>p.id===target.id).alive,false);
});

test('ability targeting, envelopes, cooldowns, stacking and duplicate conflicts are rejected',()=>{
 const s=make(),{ward,sab,crew}=actors(s),plain=crew.find(p=>p.id!==ward.id);place(ward);place(sab);
 assert.equal(act(s,plain,'protect',{targetId:plain.id}).error.code,'ABILITY_UNAVAILABLE');
 assert.equal(act(s,ward,'decoy',stations.bridge).error.code,'ABILITY_UNAVAILABLE');
 assert.equal(act(s,sab,'decoy',{x:0,y:0}).error.code,'INVALID_DESTINATION');
 assert.equal(act(s,ward,'protect',{targetId:'not-a-player'}).error.code,'INVALID_TARGET');
 place(plain,stations.engine);assert.equal(act(s,ward,'protect',{targetId:plain.id}).error.code,'INVALID_TARGET');
 const a={id:'ward-id',type:'protect',targetId:ward.id},r=applyAction(s,ward.id,a,1000);assert(r.accepted);
 assert.equal(applyAction(r.state,ward.id,{...a,targetId:sab.id},1001).error.code,'REQUEST_CONFLICT');
 assert.equal(act(r.state,ward,'protect',{targetId:sab.id},1001).error.code,'COOLDOWN');
 const stacking=clone(r.state);stacking.players.find(p=>p.id===ward.id).ability.readyAt=1001;assert.equal(act(stacking,ward,'protect',{targetId:ward.id},1001).error.code,'EFFECT_ACTIVE');
 assert.equal(applyAction(s,ward.id,{id:'bad',type:'protect',targetId:ward.id,role:'saboteur'},1000).error.code,'INVALID_ACTION');
});

test('effects expire exactly and chronologically with motion, meetings, death and terminal deadlines',()=>{
 let s=make(),{ward,sab}=actors(s);place(ward);place(sab);s=act(s,ward,'protect',{targetId:ward.id},1000).state;s=act(s,sab,'decoy',stations.bridge,1000).state;
 assert.equal(tick(s,6999).state.effects.length,2);s=tick(s,7000).state;assert.deepEqual(s.effects.map(e=>e.kind),['ward']);assert.equal(s.replay.find(e=>e.type==='effect_ended').at,7000);
 s=tick(s,9000).state;assert.equal(s.effects.length,0);assert.equal(s.replay.filter(e=>e.type==='effect_ended').at(-1).at,9000);
 let before=make();({ward,sab}=actors(before));place(ward);place(sab);before=act(before,ward,'protect',{targetId:ward.id},1000).state;
 assert.equal(act(before,sab,'eliminate',{targetId:ward.id},8999).state.players.find(p=>p.id===ward.id).alive,true);
 assert.equal(act(before,sab,'eliminate',{targetId:ward.id},9000).state.players.find(p=>p.id===ward.id).alive,false);
 for(const phase of ['meeting','paused','ended']){
  let state=make();const p=actors(state).ward;place(p);state=act(state,p,'protect',{targetId:p.id},1000).state;
  if(phase==='meeting'){place(state.players.find(q=>q.id===p.id),{x:WORLD_BELL.x,y:WORLD_BELL.y+60});state=act(state,p,'meeting',{},1002).state;}
  else {state.rules.maxMatchMs=2;if(phase==='ended')state.sabotage={active:true,deadlineAt:1002,roomId:'engine',repairers:[],repairsCompleted:0,repairsRequired:2};state=tick(state,1002).state;}
  assert.equal(state.effects.length,0,phase);
 }
});

test('echo is a labeled, range-filtered distraction, never an actor, death, witness or victory',()=>{
 const s=make(),{sab,crew}=actors(s);place(sab);place(crew[0]);place(crew[1],stations.engine);
 const r=act(s,sab,'decoy',stations.bridge);assert(r.accepted);assert.equal(r.state.bodies.length,0);assert.equal(r.state.outcome,null);
 const near=getPlayerView(r.state,crew[0].id,1000),far=getPlayerView(r.state,crew[1].id,1000);assert.equal(near.effects.length,1);assert.equal(far.effects.length,0);assert.equal(near.effects[0].label,'Signal echo · distraction');assert(!('playerId'in near.effects[0]));assert(!near.events.some(e=>e.type==='witness'||e.type==='eliminated'));
});

test('new snapshots restore active ghost navigation, chat and effects; invalid metadata is rejected; old saves remain readable',async()=>{
 let {s,victim:v}=killed({deathPolicy:'ghost-tasks',abilities:true});let {ward,sab}=actors(s);place(ward);place(sab);
 s=act(s,ward,'protect',{targetId:sab.id},1002).state;s=act(s,v,'ghostSay',{text:'private restart'},1002).state;s=act(s,v,'navigate',stations.archive,1002).state;
 const restored=JSON.parse(JSON.stringify(s));await validateRoomSnapshot(room(restored));assert.equal(restored.effects.length,1);assert.equal(getPlayerView(restored,v.id,1002).ghostChat[0].text,'private restart');
 const settled=tick(restored,10000).state;assert.equal(settled.effects.length,0);assert.deepEqual(settled.players.find(p=>p.id===v.id).position,{x:stations.archive.x,y:stations.archive.y});
 const old=createMatch({id:s.id,mode:'spectator',world:true,now:1000});await validateRoomSnapshot(room(old));
 for(const mutate of [s=>s.features.deathPolicy='invalid',s=>s.features.version=99,s=>s.players.find(p=>p.id===s.bodies[0].playerId).alive=true,s=>s.players.find(p=>p.tasks.length).tasks[0].roomId='nowhere',s=>s.players.find(p=>p.ability).ability.type='saboteur',s=>s.effects[0].expiresAt++,s=>s.players[0].tasks.push(clone(s.players.find(p=>p.tasks.length).tasks[0])),s=>s.ghostChat[0].playerId=s.players.find(p=>p.alive).id]){const bad=clone(restored);mutate(bad);await assert.rejects(validateRoomSnapshot(room(bad)));}
});

test('cooldown boundary, issuer death and critical failure preserve authoritative ability counters',()=>{
 let s=make(),{ward,sab,crew}=actors(s);for(const p of [ward,sab,crew.find(p=>p.id!==ward.id)])place(p);
 s=act(s,ward,'protect',{targetId:sab.id},1000).state;
 assert.equal(act(s,ward,'protect',{targetId:ward.id},35999).error.code,'COOLDOWN');
 const renewed=act(s,ward,'protect',{targetId:ward.id},36000);assert(renewed.accepted);assert.equal(renewed.state.players.find(p=>p.id===ward.id).ability.readyAt,71000);
 const killedIssuer=act(s,sab,'eliminate',{targetId:ward.id},1001);assert(killedIssuer.accepted);assert.equal(killedIssuer.state.effects.length,0);
 let critical=make();({ward,sab}=actors(critical));place(ward);place(sab);critical=act(critical,ward,'protect',{targetId:ward.id},1000).state;
 critical.sabotage={active:true,deadlineAt:1002,roomId:'engine',repairers:[],repairsCompleted:0,repairsRequired:2};critical=tick(critical,1002).state;assert.equal(critical.outcome.reason,'critical');assert.equal(critical.effects.length,0);
});

test('ghost-only tasks can supply the final authoritative crew task victory',()=>{
 let {s,victim:v}=killed({deathPolicy:'ghost-tasks'});for(const p of s.players)for(const t of p.tasks)t.completed=true;
 const task=s.players.find(p=>p.id===v.id).tasks[0];task.completed=false;place(s.players.find(p=>p.id===v.id),stations[task.roomId]);
 const r=act(s,v,'task',{taskId:task.id},1002);assert(r.accepted);assert.equal(r.state.outcome.reason,'tasks');assert.equal(r.state.players.find(p=>p.id===v.id).alive,false);
});
