import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Explicit composite pin: committed Reviewer AI + Core aa471eb + shared eb64cc8.
// Default after integration exercises the current checkout; missing modules fail.
const root = process.env.WORLD_CORE_AI_REVIEW_ROOT
  ? pathToFileURL(resolve(process.env.WORLD_CORE_AI_REVIEW_ROOT) + '/') : new URL('../', import.meta.url);
const engine = await import(new URL('server/engine/index.mjs', root));
const {createAiController} = await import(new URL('server/ai/index.mjs', root));
const {makeRequest,MODEL} = await import(new URL('server/ai/anthropic.mjs', root));
const {CHARACTERS} = await import(new URL('shared/contracts.mjs', root));
const {WORLD,WORLD_STATIONS,WORLD_BELL,isWalkable,findWorldPath,distance,canSeeWorldPoint} = await import(new URL('shared/world.mjs', root));
const json = x => JSON.parse(JSON.stringify(x));
const fields = ({id,...action}) => action;
const freeze = x => { if(x && typeof x==='object' && !Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x; };
const accept = r => {assert.equal(r.accepted,true,JSON.stringify(r.error));return r;};
const controller = (live=false) => createAiController({config:{provider:live?'anthropic':'demo',apiKey:live?'fixture-not-a-provider-key':'',model:MODEL,decisionIntervalMs:1}});

function fixture(id='spatial-review') {
  let state;
  for(let seed=0;seed<100;seed++) {
    state=engine.createMatch({id,seed,world:true,now:0,config:{initialKillCooldownMs:1,killCooldownMs:1,sabotageCooldownMs:1,meetingCooldownMs:1,taskCooldownMs:1,roamDeadlineMs:600000,maxMatchMs:900000}});
    if(state.players.find(p=>p.role==='saboteur').id==='p6')break;
  }
  assert.equal(state.players.find(p=>p.role==='saboteur').id,'p6');
  let now=0,serial=0;
  return {
    get state(){return state;},set state(value){state=value;},get now(){return now;},
    view(id){return engine.getPlayerView(state,id,now);},p(id){return state.players.find(p=>p.id===id);},
    tick(delta){now+=delta;const original=state,before=json(state);state=engine.tick(state,now).state;assert.deepEqual(original,before,'tick mutated input');},
    act(id,type,rest={}){const before=json(state),result=engine.applyAction(state,id,{id:'review:'+ ++serial,type,...rest},now);assert.deepEqual(state,before,'engine mutated input');state=result.state;return result;},
    apply(id,action){const before=json(state),result=engine.applyAction(state,id,action,now);assert.deepEqual(state,before,'engine mutated input');state=result.state;return result;},
    travel(id,target){const route=findWorldPath(this.p(id).position,target);assert.ok(route);let cost=0,last=this.p(id).position;for(const p of route){cost+=distance(last,p);last=p;}accept(this.act(id,'navigate',{x:target.x,y:target.y}));this.tick(Math.ceil(cost/WORLD.speed*1000)+1);assert.ok(distance(this.p(id).position,target)<.01);},
    async decide(c,context,id,extra={}){const view=freeze(this.view(id));return c.decide({view,player:CHARACTERS.find(p=>p.id===id),context,...extra});}
  };
}

function safeView(state,id,now) {
  const view=engine.getPlayerView(state,id,now),self=state.players.find(p=>p.id===id);
  for(const other of view.players.filter(p=>p.id!==id)) {
    for(const key of ['motion','destination','inputSeq','tasks'])assert.equal(Object.hasOwn(other,key),false,key);
    if(state.phase!=='ended')assert.equal(Object.hasOwn(other,'role'),false);
    const actual=state.players.find(p=>p.id===other.id);
    if(state.phase!=='ended'&&!canSeeWorldPoint(self.position,actual.position))assert.equal(other.position,null,'unseen actor coordinate');
  }
  return freeze(view);
}

test('explicit source pin validates original milestone blobs; normal checkout remains current',async()=>{
  if(!process.env.WORLD_CORE_AI_REVIEW_EXACT_PIN)return;
  const expected={
    'server/ai/index.mjs':'6c9171cb0384c5c0bb8da2548e5e0a1a4fc56595',
    'server/ai/demo.mjs':'77118cce2ddb3d0b6e579365a14c765d50b35bfe',
    'server/ai/world.mjs':'2e762375cdb4c80d4fb6f5c2d5fe3beb94f76498',
    'server/ai/anthropic.mjs':'379283d22ab7450647bf7bfa96e937961b742574',
    'server/engine/index.mjs':'47716933e36414e54cbf1b6edb0f97af69cb5aa5',
    'server/engine/world-runtime.mjs':'aa718782aea32472df3e723528ea087fb3d2a442',
    'shared/contracts.mjs':'cdc639ae763c33439849aca5966527cedaee4a44',
    'shared/world.mjs':'a2bc61a0320e6033feb8956e59884399d0a34d06'
  };
  for(const [name,hash]of Object.entries(expected)){const body=await readFile(new URL(name,root));assert.equal(createHash('sha1').update('blob '+body.length+'\0').update(body).digest('hex'),hash,name);}
});

test('actual crew route: frozen safe view, arrival, JSON controller restart, same-ID retry never resets route',async()=>{
  const g=fixture(),c=controller(),context={};g.tick(2);
  const action=await g.decide(c,context,'p1');assert.equal(action.type,'navigate');assert.ok(isWalkable(action));accept(g.apply('p1',action));
  g.tick(700);const midway=json(g.p('p1').position),destination=json(g.p('p1').motion.destination),remaining=json(g.p('p1').motion.path);
  const restored=json(g.state);g.state=restored;const restoredContext=json(context),fresh=controller();
  const duplicate=g.apply('p1',action);assert.equal(duplicate.duplicate,true);assert.deepEqual(g.p('p1').position,midway);assert.deepEqual(g.p('p1').motion.path,remaining);assert.deepEqual(g.p('p1').motion.destination,destination);
  const waiting=await g.decide(fresh,restoredContext,'p1');assert.equal(waiting.type,'wait');accept(g.apply('p1',waiting));assert.equal(await g.decide(fresh,restoredContext,'p1'),null,'restored decision throttle must dedupe same-time requests');
  let routeCost=0,last=g.p('p1').position;for(const next of g.p('p1').motion.path){routeCost+=distance(last,next);last=next;}
  g.tick(Math.ceil(routeCost/WORLD.speed*1000)+1);assert.equal(g.view('p1').self.moving,false);assert.ok(distance(g.p('p1').position,destination)<.01);
  const task=await g.decide(fresh,restoredContext,'p1');assert.equal(task.type,'task');accept(g.apply('p1',task));assert.equal(g.p('p1').tasks.find(t=>t.id===task.taskId).completed,true);
  assert.equal(fresh.describe(restoredContext).calls,0);
});

test('critical interruption: two real routes reach repair station; one contribution per crew and no speculative repair',async()=>{
  const g=fixture(),c=controller(),context={};g.tick(2);
  accept(g.act('p1','navigate',{x:WORLD_STATIONS.archive.x,y:WORLD_STATIONS.archive.y}));accept(g.act('p2','navigate',{x:WORLD_STATIONS.galley.x,y:WORLD_STATIONS.galley.y}));g.tick(100);accept(g.act('p6','sabotage'));
  for(const id of ['p1','p2']){const a=await g.decide(c,context,id);assert.equal(a.type,'navigate');assert.deepEqual({x:a.x,y:a.y},{x:WORLD_STATIONS.engine.x,y:WORLD_STATIONS.engine.y});accept(g.apply(id,a));}
  g.tick(100);for(const id of ['p1','p2'])assert.equal((await g.decide(c,context,id)).type,'wait','same critical route must not be reset');
  g.tick(20000);for(const id of ['p1','p2'])assert.ok(distance(g.p(id).position,WORLD_STATIONS.engine)<.01);
  const first=await g.decide(c,context,'p1');assert.equal(first.type,'repair');accept(g.apply('p1',first));g.tick(2);
  assert.notEqual((await g.decide(c,context,'p1')).type,'repair','already contributing keeper must not retry new IDs');
  const second=await g.decide(c,context,'p2');assert.equal(second.type,'repair');accept(g.apply('p2',second));assert.equal(g.state.sabotage.active,false);
  const publicRepairs=g.view('p3').events.filter(e=>e.type==='repair');assert.equal(publicRepairs.length,2);assert.ok(publicRepairs.every(e=>!('playerId'in e)&&!('position'in e)));
});

test('visible body interrupts actual route, reports only after approach, retains witness through council restart',async()=>{
  const g=fixture(),c=controller();let context={};g.travel('p1',{x:400,y:500});g.travel('p2',{x:220,y:500});g.travel('p6',{x:425,y:500});
  accept(g.act('p2','navigate',WORLD_STATIONS.galley));accept(g.act('p6','eliminate',{targetId:'p1'}));const deathAt=g.now;
  assert.equal(g.view('p2').availableActions.includes('report'),false);const body=g.view('p2').events.find(e=>e.type==='body');assert.deepEqual(body.position,{x:400,y:500});assert.equal(body.at,deathAt);
  const approach=await g.decide(c,context,'p2');assert.equal(approach.type,'navigate');assert.deepEqual({x:approach.x,y:approach.y},body.position);accept(g.apply('p2',approach));g.tick(400);
  const report=await g.decide(c,context,'p2');assert.equal(report.type,'report');accept(g.apply('p2',report));assert.equal(g.state.phase,'discussion');assert.equal(g.p('p2').motion.destination,null);
  g.state=json(g.state);context=json(context);const restarted=controller();g.tick(2);const speech=await g.decide(restarted,context,'p2');assert.match(speech.text,/I saw .* attack .*firsthand/);accept(g.apply('p2',speech));
  const request=JSON.parse(makeRequest(g.view('p2'),CHARACTERS[1],context.matches['match:'+g.state.id].memories['actor:p2'],[{type:'say',text:'fixture'}]).body);
  const prompt=JSON.parse(request.messages[0].content);assert.equal(JSON.stringify(prompt).includes('position'),false);assert.equal(JSON.stringify(prompt).includes('destination'),false);assert.ok(prompt.firsthandWitnesses.p6);
  g.tick(30000);assert.equal(g.state.phase,'voting');const vote=await g.decide(restarted,context,'p2');assert.equal(vote.targetId,'p6');accept(g.apply('p2',vote));g.tick(20000);assert.equal(g.state.outcome.reason,'ejection');assert.equal(g.state.outcome.winner,'crew');
  assert.equal(await g.decide(restarted,context,'p2'),null);assert.ok(engine.getReplay(g.state).some(e=>e.type==='role_reveal'));
});

test('unseen actors remain unavailable even with same last room; AI never reads hidden state or hidden player fields',async()=>{
  const g=fixture(),c=controller(),context={};for(const id of ['p1','p2','p3','p4','p5'])g.travel(id,WORLD_STATIONS.engine);
  const view=g.view('p6');assert.ok(view.players.filter(p=>p.id!=='p6').every(p=>p.position===null));
  for(const other of view.players.filter(p=>p.id!=='p6'))for(const key of ['destination','tasks','motion','role'])Object.defineProperty(other,key,{enumerable:false,get(){throw Error('hidden read '+key);}});
  const action=await c.decide({view:freeze(view),player:CHARACTERS[5],context,state:new Proxy({},{get(){throw Error('raw state read');}})});
  assert.equal(action.type,'sabotage','public scheduled sabotage needs no unseen target');accept(g.apply('p6',action));
  const spectator=engine.getPlayerView(g.state,null,g.now);assert.equal(spectator.self,null);assert.ok(spectator.players.every(p=>p.position&&!('role'in p)));assert.equal(await c.decide({view:spectator,player:CHARACTERS[5],context}),null);
});

test('live-configured real roaming never reserves or fetches; route target count stays bounded while walking',async t=>{
  const network=t.mock.method(globalThis,'fetch',()=>{throw Error('external requests forbidden');});const g=fixture(),c=controller(true),context={};let reservations=0,navigate=0,waits=0;g.tick(2);
  for(let i=0;i<30;i++){const a=await g.decide(c,context,'p1',{commitReservation:async()=>{reservations++;throw Error('must not reserve');}});assert.ok(a);if(a.type==='navigate')navigate++;if(a.type==='wait')waits++;accept(g.apply('p1',a));g.tick(50);}
  assert.equal(navigate,1);assert.equal(waits,29);assert.equal(reservations,0);assert.equal(network.mock.callCount(),0);assert.equal(c.describe(context).calls,0);assert.equal(c.describe(context).mode,'live');
});

test('corrected bell fixture distinguishes usable bell from actual solid prop; real witnessed emergency stays legal',async()=>{
  assert.equal(isWalkable(WORLD_BELL),true);assert.equal(isWalkable({x:800,y:205}),false);
  const g=fixture(),c=controller(),context={};g.tick(2);accept(g.act('p6','eliminate',{targetId:'p3'}));
  // Report the actual body with another keeper, then preserve p1 firsthand memory.
  await g.decide(c,context,'p1');accept(g.act('p2','report',{bodyId:'body-p3'}));g.tick(50002);assert.equal(g.state.phase,'roam');
  // Reporting removes local body interruption; the remembered killer triggers bell.
  const a=await g.decide(c,context,'p1');assert.equal(a.type,'meeting');accept(g.apply('p1',a));assert.equal(g.state.meeting.reason,'emergency');
});

for(const mode of ['spectator','human'])test('default-rules bounded new-seed '+mode+' worlds finish with safe views and serialized restarts',{timeout:120000},async t=>{
  const network=t.mock.method(globalThis,'fetch',()=>{throw Error('providers forbidden');});const receipts=[];
  for(const seed of [2,17,29,47]){
    let state=engine.createMatch({id:'independent-'+mode+'-'+seed,seed,mode,now:1000,world:true}),context={},c=createAiController({config:{provider:'demo',decisionIntervalMs:1800}}),restart=false,actions=0,nav=0,waits=0,denials=0;
    const idle=json(state.players[0].position),types=new Set();
    for(let now=1000;now<=901000&&!['ended','paused'].includes(state.phase);now+=600){
      state=engine.tick(state,now).state;
      for(const actor of CHARACTERS.filter(p=>mode!=='human'||p.id!=='p1')){
        const view=safeView(state,actor.id,now),a=await c.decide({view,player:actor,context});if(!a)continue;
        const before=state.version;const result=engine.applyAction(state,actor.id,a,now);if(!result.accepted)denials++;
        assert.equal(result.accepted,true,JSON.stringify({seed,mode,now,actor:actor.id,a,error:result.error}));assert.ok(result.state.version>=before);state=result.state;actions++;types.add(a.type);if(a.type==='navigate')nav++;if(a.type==='wait'&&view.self.moving)waits++;
      }
      if(!restart&&now>=16000&&state.players.some(p=>p.motion.path.length)){
        const saved=json(state),savedContext=json(context);const future=engine.tick(saved,now+300).state,uninterrupted=engine.tick(state,now+300).state;assert.deepEqual(future,uninterrupted,'serialized movement differs at restart');
        state=saved;context=savedContext;c=createAiController({config:{provider:'demo',decisionIntervalMs:1800}});restart=true;
      }
    }
    assert.equal(state.phase,'ended',JSON.stringify({seed,mode,phase:state.phase,denials,actions}));assert.ok(restart);assert.ok(nav>0&&waits>0);assert.equal(denials,0);assert.ok(['tasks','ejection','parity','critical'].includes(state.outcome.reason));assert.equal(c.describe(context).calls,0);assert.ok(nav<actions,'routes must not be reissued on every decision');
    if(mode==='human'){assert.deepEqual(state.players[0].position,idle);assert.equal(state.requests.p1.length,0);}
    const final=json(state),later=engine.tick(state,1000000).state;assert.deepEqual(later,final);assert.ok(engine.getReplay(state).some(e=>e.type==='role_reveal'));
    receipts.push({mode,seed,outcome:state.outcome,actions,navigate:nav,waits,types:[...types].sort(),restart});
  }
  assert.equal(network.mock.callCount(),0);t.diagnostic(JSON.stringify(receipts));
});
