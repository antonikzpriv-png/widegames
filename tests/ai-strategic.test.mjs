import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiController } from '../server/ai/index.mjs';
import { intentions, install, execute, remember } from '../server/ai/strategic.mjs';
import { createMatch, getPlayerView, applyAction } from '../server/engine/index.mjs';
import { CHARACTERS } from '../shared/contracts.mjs';
import { WORLD_STATIONS } from '../shared/world.mjs';
import { loadConfig } from '../server/config.mjs';
const controller = extra => createAiController({config:{provider:'anthropic',apiKey:'offline',strategy:'strategic',maxTokens:250000,decisionIntervalMs:1,...extra}});
function fixture() {
 const state=createMatch({id:'strategy',mode:'spectator',seed:1,world:true,now:1000});
 const p=state.players.find(p=>p.role==='crew');
 return {state,view:getPlayerView(state,p.id,1000),player:CHARACTERS.find(c=>c.id===p.id)};
}
function response(choice) {return new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',name:'pick_action',input:{choice}}],usage:{input_tokens:100,output_tokens:20}}));}
test('strategic mode explicit; hybrid remains default',()=>{
 assert.equal(loadConfig({}).ai.strategy,'hybrid');assert.equal(loadConfig({AI_STRATEGY:'strategic'}).ai.strategy,'strategic');
 assert.throws(()=>loadConfig({AI_STRATEGY:'bad'}));
});
test('different safe observations offer meaningful goals; fake work never grants tasks',()=>{
 const {view}=fixture();let m={};remember(view,m);
 const base=intentions(view,m);assert(base.filter(c=>c.goal==='task').length>1);
 view.sabotage={active:true,roomId:'engine',deadlineAt:50000};assert.equal(intentions(view,m)[0].goal,'repair');
 view.self.role='saboteur';view.self.position={...WORLD_STATIONS.bridge};view.self.roomId='bridge';view.availableActions.push('task');
 install(m,{type:'intend',goal:'fake_work',roomId:'bridge'},view);assert.equal(execute(view,m).type,'wait');
 assert(!intentions(view,m).some(c=>c.goal==='task'));
});
test('provider chooses non-default persisted task plan; restore continues locally without reservation',async t=>{
 const {view,player,state}=fixture();const context={};let body;
 const mock=t.mock.method(globalThis,'fetch',async(_url,options)=>{body=JSON.parse(options.body);const input=JSON.parse(body.messages[0].content);return response(input.choices.findIndex(c=>c.goal==='task'&&c.taskId===view.self.tasks[1].id));});
 let hooks=0;const c=controller();const action=await c.decide({view,player,context,commitReservation:async()=>{hooks++;assert.equal(c.describe(context).calls,1);}});
 assert.equal(c.describe(context).strategy,'strategic');assert.equal(hooks,1);assert.equal(mock.mock.callCount(),1);
 assert(applyAction(state,player.id,action,1000).accepted);
 const memory=context.matches['match:strategy'].memories[`actor:${player.id}`];assert.equal(memory.intention.taskId,view.self.tasks[1].id);
 const prompt=JSON.parse(body.messages[0].content);assert(!JSON.stringify(prompt).includes('apiKey'));assert(!prompt.players.some(p=>Object.hasOwn(p,'role')));assert(!prompt.players.some(p=>Object.hasOwn(p,'destination')));
 const restored=JSON.parse(JSON.stringify(context));view.serverNow+=2;
 assert(await controller().decide({view,player,context:restored,commitReservation:()=>assert.fail('route must not spend')}));
 assert.equal(mock.mock.callCount(),1);
});
test('stale phase results are discarded; reservation retained',async t=>{
 const {view,player}=fixture();let current=view;const context={};
 t.mock.method(globalThis,'fetch',async()=>{current={...view,phase:'discussion',meeting:{id:'next'}};return response(0);});
 assert.equal(await controller().decide({view,player,context,getCurrentView:()=>current,commitReservation:async()=>{}}),null);
 assert.equal(controller().describe(context).calls,1);assert(!context.matches['match:strategy'].memories[`actor:${player.id}`].intention);
});
test('invalid strategic output falls back once; unknown spend remains reserved',async t=>{
 const {view,player}=fixture(),context={},c=controller();const mock=t.mock.method(globalThis,'fetch',async()=>response(999));
 assert(await c.decide({view,player,context,commitReservation:async()=>{}}));assert.equal(c.describe(context).mode,'demo');
 view.serverNow+=2;await c.decide({view,player,context});assert.equal(mock.mock.callCount(),1);assert.equal(c.describe(context).calls,1);
});
test('lost follow targets and expired/stalled plans invalidate without historical pursuit',()=>{
 const {view}=fixture(),m={};const p=view.players.find(p=>p.id!==view.self.id);p.position={...view.self.position};p.alive=true;
 install(m,{type:'intend',goal:'follow',targetId:p.id},view);assert(execute(view,m));p.position=null;assert.equal(execute(view,m),null);
 install(m,{type:'intend',goal:'position',roomId:'engine'},view);view.serverNow+=30001;assert.equal(execute(view,m),null);
});
test('dynamic public profiles beyond six seats are bounded and use no supplied private persona',async t=>{
 const {view}=fixture();view.self.id='p7';view.players.push({id:'p7',name:'New Keeper',alive:true});const context={};
 t.mock.method(globalThis,'fetch',async(_u,o)=>{const body=JSON.parse(o.body);assert(!body.system.includes('secret-persona'));assert(JSON.parse(body.messages[0].content).players.some(p=>p.id==='p7'));return response(0);});
 assert(await controller().decide({view,player:{id:'p7',persona:'secret-persona'},context,commitReservation:async()=>{}}));
});
test('strategic retries each reserve; parallel actors cannot exceed match cap',async t=>{
 const {state,view,player}=fixture(),context={};let hooks=0;
 const mock=t.mock.method(globalThis,'fetch',async()=>new Response('',{status:503}));
 const c=controller({maxCalls:2});await c.decide({view,player,context,commitReservation:async()=>{hooks++;}});
 assert.equal(hooks,2);assert.equal(mock.mock.callCount(),2);assert.equal(c.describe(context).calls,2);
 const shared={},limited=controller({maxCalls:1});mock.mock.mockImplementation(async()=>response(0));
 await Promise.all(CHARACTERS.slice(0,3).map(player=>limited.decide({view:getPlayerView(state,player.id,1000),player,context:shared,commitReservation:async()=>{}})));
 assert.equal(limited.describe(shared).calls,1);
});
test('unchanged completed/failed plans cannot buy repeated replans every tick',async t=>{
 const {view,player}=fixture(),context={},c=controller();
 const mock=t.mock.method(globalThis,'fetch',async()=>response(0));
 await c.decide({view,player,context,commitReservation:async()=>{}});
 const m=context.matches['match:strategy'].memories[`actor:${player.id}`];m.planProgress.failures=3;
 for(let i=0;i<5;i++){view.serverNow+=2;await c.decide({view,player,context,commitReservation:()=>assert.fail('unchanged state must not spend')});}
 assert.equal(mock.mock.callCount(),1);
});
test('room generation changes for phase, meeting, death and match transitions, not ordinary progress',async()=>{
 const {createRooms}=await import('../server/rooms.mjs');
 const engine=await import('../server/engine/index.mjs');
 const service=createRooms({store:{save:async()=>{}},engine,ai:controller(),now:()=>1000});
 const {room}=await service.create('spectator');let next=structuredClone(room.data);next.startId='start-fixture';next.state=engine.createMatch({id:next.id,mode:'spectator',world:false,now:1000,seed:1});await service.commit(room,next);
 const generation=room.aiGeneration;
 next=structuredClone(room.data);next.state.version++;await service.commit(room,next);assert.equal(room.aiGeneration,generation);
 for(const mutate of [s=>{s.phase='discussion';s.meeting={id:'meeting-new'};},s=>{s.players[0].alive=false;},s=>{s.phase='paused';},s=>{s.startedAt++;s.phase='roam';s.meeting=null;}]){
  next=structuredClone(room.data);mutate(next.state);const before=room.aiGeneration;await service.commit(room,next);assert.equal(room.aiGeneration,before+1);
 }
});
