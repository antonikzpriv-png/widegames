import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {observe,candidates} from '../server/ai/demo.mjs';
import {makeRequest} from '../server/ai/anthropic.mjs';
import {deviceFacts} from '../server/features/strategy/index.mjs';

test('unknown never becomes dead in AI memory or provider JSON, dated device facts remain attributed',()=>{
 const view={beaconVersion:1,worldVersion:1,matchId:'knowledge',phase:'discussion',serverNow:2000,self:{id:'captain',role:'crew',roomId:'bridge',alive:true,tasks:[]},players:[{id:'captain',name:'Ada',alive:true,status:'alive',roomId:'bridge'},{id:'signal',name:'Signal',alive:null,status:'unknown',roomId:null}],events:[],availableActions:['say'],meeting:{id:'m',reason:'emergency',messages:[],votes:[]},investigation:{observations:[{id:'obs:captain:vitals:1500',deviceId:'vitals',kind:'vitals',at:1500,data:{players:[{id:'captain',status:'alive'},{id:'signal',status:'dead'}]}}]}};const memory={};observe(view,memory);assert.deepEqual(memory.observation.dead,[]);const choices=candidates(view,memory);assert.match(choices[0].text,/Vitals sampled.*No location or attacker/);const req=JSON.parse(makeRequest(view,{name:'Ada',persona:'Fixture'},memory,choices).body),safe=JSON.parse(req.messages[0].content);assert.equal(safe.players[1].alive,null);assert.equal(safe.players[1].status,'unknown');assert.equal(safe.deviceObservations[0].at,1500);assert.equal(safe.deviceObservations[0].players[1].status,'dead');assert.equal(safe.firsthandWitnesses.signal,undefined);assert.deepEqual(deviceFacts(view),safe.deviceObservations);
});

test('reported historical body and completed terminal session cannot trap local navigation',async()=>{
 const state=engine.createMatch({id:'bot-regression',world:true,systems:true,now:1000,seed:8});const actor=state.players.find(p=>p.role==='crew');const view=engine.getPlayerView(state,actor.id,1000);view.events=[{id:'old-body',type:'body',reported:true,bodyId:'body-old',position:{x:1340,y:960}}];view.investigation.session={status:'elapsed',deviceId:'security'};const c=createAiController({config:{provider:'demo',decisionIntervalMs:1}}),context={};const action=await c.decide({view,player:{id:actor.id,name:actor.name,color:actor.color,persona:'Fixture'},context});assert(action);assert.notEqual(action.type,'report');if(action.type==='navigate')assert.notDeepEqual({x:action.x,y:action.y},{x:1340,y:960});assert.equal(c.describe(context).calls,0);
});

for(const mode of ['spectator','human'])test('actual beacon demo '+mode+' matches finish with bounded local navigation and safe restored views',{timeout:180000},async t=>{
 const outbound=t.mock.method(globalThis,'fetch',()=>{throw new Error('No provider calls permitted');}),receipts=[];
 for(const seed of [3,17]){
  let state=engine.createMatch({id:'beacon-demo-'+mode+'-'+seed,world:true,systems:true,mode,now:1000,seed}),context={},ai=createAiController({config:{provider:'demo',decisionIntervalMs:1800}}),restarted=false,actions=0,denials=0;
  const types=new Set();
  for(let now=1000;now<901001&&!['ended','paused'].includes(state.phase);now+=600){state=engine.tick(state,now).state;for(const p of state.players.filter(p=>!p.human)){const view=engine.getPlayerView(state,p.id,now);assert(view.players.every(q=>state.phase==='ended'||!Object.hasOwn(q,'role')));assert.equal(view.systems.transit,undefined);const action=await ai.decide({view,player:{id:p.id,name:p.name,color:p.color,persona:p.persona},context});if(!action)continue;const result=engine.applyAction(state,p.id,action,now);state=result.state;actions++;types.add(action.type);if(!result.accepted){denials++;assert(['UNREACHABLE','INVALID_TARGET','UNAVAILABLE'].includes(result.error.code),JSON.stringify({seed,mode,now,action,error:result.error}));}}
   if(!restarted&&now>20000){state=JSON.parse(JSON.stringify(state));context=JSON.parse(JSON.stringify(context));ai=createAiController({config:{provider:'demo',decisionIntervalMs:1800}});restarted=true;}
  }
  assert.equal(state.phase,'ended',JSON.stringify({mode,seed,phase:state.phase,actions,denials,tasks:state.players.map(p=>({id:p.id,role:p.role,alive:p.alive,tasks:p.tasks.filter(t=>!t.completed).length,position:p.position}))}));assert(state.outcome);assert(engine.getReplay(state).some(e=>e.type==='role_reveal'));assert(engine.getReplaySnapshots(state).length>1);assert.equal(ai.describe(context).calls,0);receipts.push({mode,seed,actions,denials,types:[...types],outcome:state.outcome});
 }
 assert.equal(outbound.mock.callCount(),0);t.diagnostic(JSON.stringify(receipts));
});

test('eight custom IDs and two saboteurs complete a real safe-view demo watch',{timeout:120000},async t=>{
 const outbound=t.mock.method(globalThis,'fetch',()=>{throw Error('No providers');}),roster=Array.from({length:8},(_,i)=>({id:'crew-'+i,name:'Keeper '+i,color:'#8fc8bc',persona:'Fixture keeper '+i}));let state=engine.createMatch({id:'eight-demo',world:true,systems:true,roster,saboteurCount:2,mode:'spectator',now:1000,seed:3}),ai=createAiController({config:{provider:'demo',decisionIntervalMs:1800}}),context={},actions=0;
 for(let now=1000;now<901000&&!['ended','paused'].includes(state.phase);now+=600){state=engine.tick(state,now).state;for(const p of state.players){const action=await ai.decide({view:engine.getPlayerView(state,p.id,now),player:{id:p.id,name:p.name,color:p.color,persona:p.persona},context});if(action){const r=engine.applyAction(state,p.id,action,now);assert(r.accepted,JSON.stringify(r.error));state=r.state;actions++;}}}assert.equal(state.phase,'ended');assert.equal(state.players.filter(p=>p.role==='saboteur').length,2);assert.equal(Object.keys(context.matches['match:'+state.id].memories).length,8);assert.equal(ai.describe(context).calls,0);assert.equal(outbound.mock.callCount(),0);t.diagnostic(JSON.stringify({actions,outcome:state.outcome}));
});
