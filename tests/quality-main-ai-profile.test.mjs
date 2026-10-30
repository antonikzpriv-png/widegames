import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// The default exercises the integrated checkout. An explicit immutable source
// overlay is supported before installation; no dependency or assertion skips.
const root = process.env.QUALITY_MAIN_AI_ROOT
  ? pathToFileURL(path.resolve(process.env.QUALITY_MAIN_AI_ROOT) + path.sep)
  : new URL('../', import.meta.url);
const [{createAiController}, engine, {CHARACTERS}] = await Promise.all([
  'server/ai/index.mjs', 'server/engine/index.mjs', 'shared/contracts.mjs'
].map(file => import(new URL(file, root))));
const generic = 'A keeper aboard the beacon.';
const config = {provider:'anthropic', apiKey:'synthetic-profile-key', maxTokens:250000,
  maxCostUsd:10, timeoutMs:1000, decisionIntervalMs:1};
function council(actorId='p1') {
  const state = engine.createMatch({id:'profile-fixture', mode:'human', seed:7,
    now:100000, config:{meetingCooldownMs:1}});
  const meeting = engine.applyAction(state, 'p1', {id:'profile:meeting',type:'meeting'}, 100002);
  assert.equal(meeting.accepted, true);
  return engine.getPlayerView(meeting.state, actorId, 100002);
}
function poison(id) {
  return {id, get persona(){assert.fail('supplied hidden persona was read');},
    get name(){assert.fail('supplied private name was read');}};
}
function mockProvider(t) {
  const requests=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://api.anthropic.com/v1/messages');
    assert.equal(options.redirect,'error');
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({stop_reason:'tool_use',content:[
      {type:'tool_use',name:'pick_action',input:{choice:0}}
    ],usage:{input_tokens:100,output_tokens:20}}));
  });
  return requests;
}
async function propose(view) {
  const context={}; let reservations=0;
  const action=await createAiController({config}).decide({view,player:poison(view.self.id),context,
    state:new Proxy({},{get(){assert.fail('full state read');}}),
    commitReservation:async()=>{reservations++;}});
  return {action,context,reservations};
}

test('six exact canonical public identities retain distinct safe traits in mocked provider requests',async t=>{
  const requests=mockProvider(t), systems=[];
  assert.equal(new Set(CHARACTERS.map(p=>p.persona)).size,6);
  for(const character of CHARACTERS){
    const view=council(character.id),entry=view.players.find(p=>p.id===character.id);
    assert.equal(entry.name,character.name);
    Object.defineProperty(entry,'persona',{get(){assert.fail('roster persona read');}});
    const {action,reservations}=await propose(view);
    assert.equal(action.type,'say');assert.equal(reservations,1);
    const system=requests.at(-1).system;systems.push(system);
    assert.ok(system.includes(`You play ${character.name},`));
    assert.ok(system.includes(character.persona),`${character.id} lost its canonical traits`);
    for(const other of CHARACTERS.filter(p=>p.id!==character.id))assert.ok(!system.includes(other.persona));
    assert.ok(!system.includes(generic));
  }
  assert.equal(requests.length,6);assert.equal(new Set(systems).size,6);
});

test('custom identity requires both canonical ID and exact public name before borrowing canonical traits',async t=>{
  const requests=mockProvider(t);
  for(const [id,name] of [['p1','Public Custom'],['p1','Iona '],['custom_keeper','Iona'],['toString','Custom Keeper']]){
    const view=council(),entry=view.players.find(p=>p.id==='p1');
    view.self.id=id;entry.id=id;entry.name=name;
    Object.defineProperty(entry,'persona',{get(){assert.fail('roster persona read');}});
    const {action,reservations}=await propose(view);
    assert.equal(action.type,'say');assert.equal(reservations,1);
    const system=requests.at(-1).system;
    assert.ok(system.includes(`You play ${name},`));assert.ok(system.includes(generic));
    for(const character of CHARACTERS)assert.ok(!system.includes(character.persona));
    assert.doesNotMatch(action.text,/undefined|I saw/);
  }
  assert.equal(requests.length,4);
});

test('missing malformed and mismatched public actor profiles still fail closed before reservation',async t=>{
  const network=t.mock.method(globalThis,'fetch',()=>assert.fail('invalid profile sent'));
  for(const name of [undefined,null,'','   ','x'.repeat(81),'unsafe\u0001name']){
    const view=council();view.players.find(p=>p.id==='p1').name=name;
    const {action,reservations,context}=await propose(view);
    assert.equal(action,null);assert.equal(reservations,0);assert.deepEqual(context,{});
  }
  for(const change of ['missing','wrong-owner','invalid-id']){
    const view=council();
    if(change==='missing')view.players=view.players.filter(p=>p.id!=='p1');
    if(change==='wrong-owner')view.self.id='p2';
    if(change==='invalid-id'){view.self.id='bad/id';view.players[0].id='bad/id';}
    let reservations=0;
    const action=await createAiController({config}).decide({view,player:poison(change==='invalid-id'?'bad/id':'p1'),context:{},commitReservation:()=>{reservations++;}});
    assert.equal(action,null);assert.equal(reservations,0);
  }
  assert.equal(network.mock.callCount(),0);
});
