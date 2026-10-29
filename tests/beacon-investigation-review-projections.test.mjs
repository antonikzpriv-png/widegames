import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Default = actual checkout. Explicit root = a tracked, ignored exact-source archive.
// No source fallback, legacy skip, hidden state passed to AI, or network dependency.
const root=process.env.BEACON_INVESTIGATION_REVIEW_ROOT
  ?pathToFileURL(resolve(process.env.BEACON_INVESTIGATION_REVIEW_ROOT)+'/')
  :new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const geometry=await import(new URL('shared/world.mjs',root));
const {createSpatialWorld}=await import(new URL('server/engine/world/index.mjs',root));
const {DEFAULT_BEACON_RULES}=await import(new URL('shared/beacon.mjs',root));
const {createAiController}=await import(new URL('server/ai/index.mjs',root));
const {observe,candidates}=await import(new URL('server/ai/demo.mjs',root));
const {makeRequest}=await import(new URL('server/ai/anthropic.mjs',root));
const {deviceFacts}=await import(new URL('server/features/strategy/index.mjs',root));
const clone=value=>structuredClone(value);
const ids=['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel'];
const roster=names=>names.map(id=>({id,name:id,color:'#123456',persona:'Labeled independent roster fixture.'}));
const world=createSpatialWorld(geometry);
function game(options={}){
 let state=engine.createMatch({id:'review-projections',world:true,systems:true,mode:'spectator',now:0,seed:0,roster:roster(ids.slice(0,6)),config:{initialKillCooldownMs:1,meetingCooldownMs:1,roamDeadlineMs:600000,maxMatchMs:900000},beaconRules:{deviceReadMs:100},...options});
 assert.equal(state.schemaVersion,3,'Requires actual schema3 orchestrator; never skip a legacy foundation');
 let now=0,sequence=0;
 return {get state(){return state;},get now(){return now;},get crew(){return state.players.filter(p=>p.role==='crew').map(p=>p.id);},get sab(){return state.players.find(p=>p.role==='saboteur').id;},
  view(id){return engine.getPlayerView(state,id,now);},
  tick(at){now=at;state=engine.tick(state,at).state;},
  act(id,type,fields={}){const result=engine.applyAction(state,id,{id:'review:'+ ++sequence,type,...fields},now);assert.equal(result.accepted,true,JSON.stringify({type,error:result.error}));state=result.state;return result;},
  walk(id,position){this.act(id,'navigate',{x:position.x,y:position.y});this.tick(now+12000);assert(geometry.distance(state.players.find(p=>p.id===id).position,position)<.001);},
  restore(){state=JSON.parse(JSON.stringify(state));assert.equal(world.validateSpatialState(state),true);}
 };
}
const row=(view,id)=>view.players.find(p=>p.id===id);
function noHidden(view){
 for(const p of view.players){for(const key of ['role','tasks','motion','knowledge','transit','destination','human','persona'])assert.equal(Object.hasOwn(p,key),false,key);}
 assert.equal(view.systems.transit,undefined);
 if(view.self)assert.deepEqual(Object.keys(view.systems.cooldowns).sort(),['auxiliaryAt','criticalAt','ventAt']);else assert.equal(view.systems.cooldowns,null);
 assert.equal(view.investigation.cooldowns,undefined);
}

// Isolated Core fixture, explicitly NOT a client action or fabricated played match.
// This allows two hidden worlds to be compared with identical public knowledge.
function spatialFixture(){
 const s={phase:'roam',updatedAt:0,beaconRules:{...DEFAULT_BEACON_RULES},players:roster(ids.slice(0,6)).map((p,i)=>({...p,role:i===5?'saboteur':'crew',alive:true})),systems:{doors:[],lights:{active:false},transit:{}},bodies:[],replay:[],replaySequence:0};
 world.initialize(s,0);
 for(const p of s.players){p.position={x:1430,y:960};p.roomId='engine';}
 s.players[0].position={x:620,y:300};s.players[0].roomId='bridge';
 return s;
}
function record(s,type,at,data){s.replay.push({id:'r'+ ++s.replaySequence,type,at,...data});}
function checkpoint(s,at){world.observe(s,at,record);s.updatedAt=at;assert.equal(world.validateSpatialState(s),true);}

test('Core independent: hidden living/dead counterfactuals are identical until owner sight; death never resurrects',()=>{
 const living=spatialFixture();checkpoint(living,0);const dead=clone(living);dead.players[1].alive=false;dead.bodies.push({id:'body-bravo',playerId:'bravo',roomId:'engine',position:{x:1430,y:960},at:5,reported:false});checkpoint(living,10);checkpoint(dead,10);
 for(const viewer of ['alpha',null]){assert.deepEqual(world.projectWorld(dead,viewer,10),world.projectWorld(living,viewer,10));const p=row(world.projectWorld(dead,viewer,10),'bravo');assert.equal(p.status,'unknown');assert.equal(p.alive,null);assert.equal(p.position,null);}
 dead.players[0].position={x:1370,y:960};dead.players[0].roomId='engine';checkpoint(dead,20);assert.equal(row(world.projectWorld(dead,'alpha',20),'bravo').status,'dead');
 const event=world.projectWorld(dead,'alpha',20).localEvents.find(e=>e.type==='body');assert.equal(event.at,5);assert.equal(event.observedAt,20);assert.equal(event.killerId,undefined);
 assert.equal(world.adoptVitals(dead,'alpha',{at:30,players:[{id:'bravo',alive:true}]},30,record),false);assert.equal(row(world.projectWorld(dead,null,30),'bravo').alive,null);
});

test('Core independent: fixed spectator loses remote/dead/transit sight and never follows private observer position',()=>{
 const s=spatialFixture();checkpoint(s,0);const origin=clone(world.projectWorld(s,null,0).vision.origin);
 s.players[0].position={x:1430,y:960};s.systems.transit.foxtrot={entryId:'archive-hatch',exitId:'lantern-hatch'};checkpoint(s,10);
 const v=world.projectWorld(s,null,10);assert.equal(v.vision.mode,'bridge');assert.deepEqual(v.vision.origin,origin);assert(v.players.every(p=>p.position===null));assert(v.players.every(p=>!Object.hasOwn(p,'role')));assert.equal(v.localEvents.length,0);
 const bad=clone(s);bad.spatial.spectator.position={x:1430,y:960};assert.throws(()=>world.validateSpatialState(bad),/Invalid spatial/);
});

test('Core independent: native vitals adoption rejects cross-owner/future samples and never creates an attack witness',()=>{
 const s=spatialFixture();s.players[1].alive=false;checkpoint(s,10);
 const sample={id:'obs:alpha:vitals:15',deviceId:'vitals',kind:'vitals',at:15,data:{players:s.players.map(p=>({id:p.id,status:p.alive?'alive':'dead'}))}};
 s.investigation={observations:{charlie:[clone(sample)],alpha:[sample]}};const before=clone(sample);checkpoint(s,14);assert.equal(row(world.projectWorld(s,'alpha',14),'bravo').alive,null);checkpoint(s,20);
 assert.equal(row(world.projectWorld(s,'alpha',20),'bravo').alive,false);assert.equal(row(world.projectWorld(s,'charlie',20),'bravo').alive,null);assert.equal(row(world.projectWorld(s,null,20),'bravo').alive,null);assert.deepEqual(sample,before);
 const events=world.projectWorld(s,'alpha',20).localEvents;assert.deepEqual(events.map(e=>e.type),['vitals']);assert.equal(events[0].at,15);assert.equal(events[0].observedAt,20);assert(s.replay.filter(e=>e.type==='observation').every(e=>JSON.stringify(e.visibleTo)==='["alpha"]'));
});

test('real engine: custom inherited identities, humans and two factions remain safe and cloneable',()=>{
 const names=['toString','valueOf','hasOwnProperty','isPrototypeOf','alpha','bravo','charlie','delta'];const f=game({mode:'human',roster:roster(names),humanPlayerIds:['valueOf','delta'],saboteurCount:2});
 assert.equal(f.state.players.filter(p=>p.role==='saboteur').length,2);assert.deepEqual(f.state.players.filter(p=>p.human).map(p=>p.id),['valueOf','delta']);
 for(const id of names){const v=f.view(id);assert.equal(v.self.id,id);assert.equal(v.self.transit,null);assert.deepEqual(v.investigation.observations,[]);noHidden(v);}
 f.restore();noHidden(f.view(null));assert.equal(f.view(null).self,null);assert.equal(engine.getReplay(f.state),null);
 assert.throws(()=>f.view('outsider'),/Unknown spatial viewer/);
});

test('real engine: remote death and body hints stay private before local discovery, then council muster discloses status',()=>{
 const f=game(),[observer,victim,caller]=f.crew;f.walk(observer,geometry.WORLD_STATIONS.engine);f.walk(victim,{x:150,y:550});f.walk(f.sab,{x:150,y:550});const last=row(f.view(observer),victim);f.act(f.sab,'eliminate',{targetId:victim});
 for(const id of [observer,null]){const v=f.view(id);assert.equal(row(v,victim).status,last.status);assert.equal(row(v,victim).position,null);assert(!v.events.some(e=>e.type==='body'||e.type==='witness'||e.type==='eliminated'));assert(!v.interactions.some(d=>d.type==='report'||d.fields?.targetId===victim));noHidden(v);}
 assert.equal(engine.getReplay(f.state),null);f.restore();f.walk(caller,{x:150,y:550});const local=f.view(caller);assert.equal(row(local,victim).status,'dead');assert(local.interactions.some(d=>d.type==='report'&&d.fields.bodyId==='body-'+victim));assert(!local.events.some(e=>e.type==='witness'));
 f.act(caller,'report',{bodyId:'body-'+victim});assert.equal(f.state.phase,'discussion');assert.equal(row(f.view(observer),victim).status,'dead');assert.equal(row(f.view(observer),victim).position,null);assert.equal(row(f.view(null),victim).role,undefined);
});

test('real engine: vent witnesses see one dated hatch only; hidden/transit targets create neither hints nor positions',()=>{
 const f=game(),[west,east,remote]=f.crew;f.walk(west,{x:200,y:550});f.walk(east,{x:1430,y:550});f.walk(remote,geometry.WORLD_STATIONS.engine);f.walk(f.sab,{x:150,y:550});const enteredAt=f.now;f.act(f.sab,'vent',{entryId:'archive-hatch',exitId:'lantern-hatch'});
 const departure=f.view(west).events.filter(e=>e.type.startsWith('vent_'));assert.equal(departure.length,1);assert.equal(departure[0].at,enteredAt);assert.equal(departure[0].entryId,'archive-hatch');assert.equal(departure[0].exitId,undefined);
 for(const id of [west,east,remote,null]){const v=f.view(id);assert.equal(row(v,f.sab).position,null);assert.equal(v.systems.selfTransit,null);assert(!v.interactions.some(d=>d.fields?.targetId===f.sab));noHidden(v);}
 assert.equal(f.view(east).events.some(e=>e.type==='vent_enter'),false);assert.equal(f.view(remote).events.some(e=>e.type.startsWith('vent_')),false);assert.equal(f.view(null).events.some(e=>e.type.startsWith('vent_')),false);
 const deadline=f.state.systems.transit[f.sab].deadlineAt;f.restore();f.tick(deadline);const exit=f.view(east).events.find(e=>e.type==='vent_exit');assert.equal(exit.at,deadline);assert.equal(exit.exitId,'lantern-hatch');assert.equal(exit.entryId,undefined);assert.equal(exit.visibleTo,undefined);assert.equal(exit.role,undefined);assert.equal(f.view(west).events.some(e=>e.type==='vent_exit'),false);
 f.restore();f.tick(deadline+1);assert.equal(f.view(east).events.filter(e=>e.type==='vent_exit').length,1);
});

test('real engine root integration: dated device facts stay owner-only through restore, without attack-witness promotion',()=>{
 const f=game(),[reader,victim,other]=f.crew;f.walk(victim,geometry.WORLD_STATIONS.engine);f.walk(f.sab,geometry.WORLD_STATIONS.engine);f.act(f.sab,'eliminate',{targetId:victim});f.walk(reader,{x:150,y:900});f.act(reader,'investigate',{deviceId:'vitals'});const sampledAt=f.now+100;f.tick(sampledAt);f.restore();
 const own=f.view(reader),facts=deviceFacts(own);assert.equal(facts.length,1);assert.equal(facts[0].at,sampledAt);assert.equal(facts[0].players.find(p=>p.id===victim).status,'dead');assert.equal(row(own,victim).position,null);assert.equal(row(own,victim).status,'dead');
 const memory={};observe(own,memory);assert.equal(memory.witnesses,undefined);assert(own.events.some(e=>e.type==='vitals'));assert(!own.events.some(e=>e.type==='witness'));for(const id of [other,null]){const v=f.view(id);assert.deepEqual(deviceFacts(v),[]);assert.equal(row(v,victim).status,'alive');}
 const samples=f.state.replay.filter(e=>e.type==='observation'&&e.observation.type==='vitals');assert.equal(samples.length,1);assert.deepEqual(samples[0].visibleTo,[reader]);assert.equal(engine.getReplay(f.state),null);
});

test('coordinator projection: hidden crew body cannot be guessed into report/eliminate hints across door/light boundaries',()=>{
 const f=game(),[target]=f.crew;f.walk(target,{x:500,y:490});f.walk(f.sab,{x:560,y:490});
 f.act(f.sab,'systemSabotage',{kind:'door',targetId:'west-upper'});const v=f.view(f.sab);assert.equal(row(v,target).position,null);assert(!v.interactions.some(d=>d.type==='eliminate'&&d.fields.targetId===target));assert(!v.availableActions.includes('eliminate'));
 const denied=engine.applyAction(f.state,f.sab,{id:'hidden-guess',type:'eliminate',targetId:target},f.now);assert.equal(denied.accepted,false);assert.equal(denied.error.code,'INVALID_TARGET');
});

function councilView(){return {beaconVersion:1,worldVersion:1,matchId:'review-council',phase:'discussion',serverNow:2000,self:{id:'alpha',role:'crew',alive:true,roomId:'bridge',position:{x:620,y:300},tasks:[]},players:[{id:'alpha',name:'Alpha',color:'#123456',alive:true,status:'alive',roomId:'bridge',position:{x:620,y:300}},{id:'bravo',name:'Bravo',alive:null,status:'unknown',roomId:null,position:null}],events:[],availableActions:['say'],meeting:{id:'review-meeting',reason:'emergency',messages:[],votes:[]},investigation:{observations:[]}};}

test('coordinator AI adaptation: unknown is JSON null; bounded dated source samples cannot become attacker witnesses',()=>{
 const v=councilView();v.investigation.observations=[{id:'obs:alpha:security:1500',deviceId:'security',kind:'cameras',at:1500,data:{frames:[{cameraId:'archive-camera',limited:true,players:[{id:'bravo',position:{x:300,y:510},role:'SECRET'}]}]},privateSentinel:'SECRET'}];const memory={};observe(v,memory);assert.deepEqual(memory.observation.dead,[]);assert.equal(memory.witnesses,undefined);
 const choices=candidates(v,memory);assert.match(choices[0].text,/past sample, not an attack witness/);const safe=JSON.parse(JSON.parse(makeRequest(v,{name:'Alpha',persona:'fixture'},memory,choices).body).messages[0].content);
 assert.equal(safe.players[1].alive,null);assert.equal(safe.players[1].status,'unknown');assert.deepEqual(safe.firsthandWitnesses,{});assert.deepEqual(safe.deviceObservations,deviceFacts(v));assert.equal(safe.deviceObservations[0].at,1500);assert.deepEqual(safe.deviceObservations[0].frames[0].players,['bravo']);assert(!JSON.stringify(safe).includes('SECRET'));assert(!JSON.stringify(safe.deviceObservations).includes('position'));
});

test('mocked council transport: custom actor receives only its safe facts; reservations precede the intercepted request',async t=>{
 const v=councilView(),requests=[],reservations=[];const context={};const ai=createAiController({config:{provider:'anthropic',apiKey:'fixture-not-a-key',maxTokens:120000,maxCostUsd:.5,decisionIntervalMs:1}});
 t.mock.method(globalThis,'fetch',async (_url,options)=>{assert.equal(reservations.length,requests.length+1);requests.push(JSON.parse(options.body));return new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',name:'pick_action',input:{choice:0,speech:'Fixture council statement.'}}],usage:{input_tokens:10,output_tokens:10}}),{status:200});});
 const action=await ai.decide({view:v,player:{id:'alpha',persona:'Fixture'},context,commitReservation:async r=>{reservations.push(r);return true;}});assert.equal(action.type,'say');assert.equal(requests.length,1);const safe=JSON.parse(requests[0].messages[0].content);assert.equal(safe.players[1].alive,null);assert.equal(safe.players[1].status,'unknown');assert.deepEqual(safe.deviceObservations,[]);assert.equal(ai.describe(context).mode,'live');
});

test('real engine ended-only reveal: normal ejection ends match without leaking roles or replay beforehand',()=>{
 const f=game({config:{initialKillCooldownMs:1,meetingCooldownMs:1,roamDeadlineMs:1,discussionMs:1,votingMs:1}});f.tick(1);assert.equal(f.state.phase,'discussion');assert.equal(engine.getReplay(f.state),null);assert.equal(engine.getReplaySnapshots(f.state),null);f.tick(2);assert.equal(f.state.phase,'voting');
 for(const p of f.state.players)f.act(p.id,'vote',{targetId:f.sab});f.tick(3);assert.equal(f.state.phase,'ended');const view=f.view(null);assert(view.players.every(p=>['crew','saboteur'].includes(p.role)));const replay=engine.getReplay(f.state);assert(replay.some(e=>e.type==='role_reveal'));replay[0].type='mutated';assert.notEqual(engine.getReplay(f.state)[0].type,'mutated');assert(engine.getReplaySnapshots(f.state).length>0);
});

// Active positive requirement: intended to FAIL on 6a97c798, never skip/todo it.
// Only coordinator-authored beaconCandidates is under independent review here;
// legacy AI authored in this worker's earlier assignments remains a self-check.
test('REGRESSION: two-saboteur Beacon AI must choose an engine-permitted target when one is offered',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw new Error('No network permitted');});
 const f=game({roster:roster(ids),saboteurCount:2});f.tick(1);const actor=f.state.players.find(p=>p.id==='echo');assert.equal(actor.role,'saboteur');const view=f.view(actor.id);const targets=view.interactions.filter(d=>d.enabled&&d.type==='eliminate').map(d=>d.fields.targetId);assert.deepEqual(targets,['delta','foxtrot','golf']);
 const ai=createAiController({config:{provider:'demo',decisionIntervalMs:1}}),context={},receipts=[];let state=f.state;
 for(const now of [1,2]){state=engine.tick(state,now).state;const current=engine.getPlayerView(state,actor.id,now);const action=await ai.decide({view:current,player:{id:actor.id,persona:actor.persona},context});assert.equal(action.type,'eliminate');const result=engine.applyAction(state,actor.id,action,now);state=result.state;receipts.push({actor:actor.id,proposed:action.targetId,accepted:result.accepted,permitted:targets,error:result.error});}
 assert.equal(ai.describe(context).calls,0);assert(receipts.every(r=>r.accepted&&r.permitted.includes(r.proposed)),JSON.stringify(receipts));
});
