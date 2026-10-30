import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,open,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from '../server/config.mjs';
import {createAiController} from '../server/ai/index.mjs';
import {MODEL,OUTPUT_TOKENS,MAX_RESPONSE_BYTES,MAX_REQUEST_BYTES,makeRequest,send} from '../server/ai/anthropic.mjs';
import {createDailyBudget} from '../server/budget.mjs';
import * as engine from '../server/engine/index.mjs';
import {CHARACTERS} from '../shared/contracts.mjs';
const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url)),key='audit-synthetic-provider-key-only';
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('AUDIT: real provider network forbidden');};after(()=>{globalThis.fetch=originalFetch;});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function council(){const state=engine.createMatch({id:'boundary_council_fixture',mode:'human',seed:'boundary-council',now:100000,config:{meetingCooldownMs:1}});const meeting=engine.applyAction(state,'p1',{id:'meeting',type:'meeting'},100002);assert(meeting.accepted);return engine.getPlayerView(meeting.state,'p1',100002);}
function input(){return {view:council(),player:CHARACTERS[0],context:{},signal:new AbortController().signal,commitReservation:async()=>{}};}
function live(extra={}){return createAiController({config:{provider:'anthropic',apiKey:key,model:MODEL,maxCalls:48,maxTokens:250000,maxCostUsd:10,timeoutMs:1000,decisionIntervalMs:1,...extra}});}
const state=context=>context.matches[`match:${context.activeMatchId}`];
function provider(extra={}){return {stop_reason:'tool_use',content:[{type:'text',text:'synthetic-private-provider-reasoning'},{type:'tool_use',name:'pick_action',input:{choice:0}}],usage:{input_tokens:100,output_tokens:20},...extra};}
function response(extra={}){return new Response(JSON.stringify(provider(extra)),{headers:{'content-type':'application/json'}});}
async function fixture(t,label){await mkdir(temporary,{recursive:true});const directory=await mkdtemp(path.join(temporary,`audit-boundaries-provider-${label}-`));t.after(async()=>{assert(path.resolve(directory).startsWith(path.resolve(temporary)+path.sep));await rm(directory,{recursive:true,force:true});});return directory;}
function streamResponse(bytes,stats){let offset=0;return new Response(new ReadableStream({pull(controller){if(offset===bytes.length){controller.close();return;}const next=Math.min(offset+137,bytes.length);controller.enqueue(bytes.subarray(offset,next));offset=next;},cancel(){stats.cancelled++;}},{highWaterMark:0}));}

// These checks use the actual adapter/controller and a denied-by-default fetch.
test('adapter prompt allowlist omits injected remote roles, keys, replay and unused private memory',()=>{
  const view=council();view.apiKey=key;view.replay=[{secret:'full-hidden-replay-fixture'}];view.players[1].role='remote-role-fixture';
  const request=makeRequest(view,CHARACTERS[0],{privateReasoning:'unused-private-memory-fixture'},[{type:'say',text:'public fixture'}]);
  for(const sentinel of [key,'full-hidden-replay-fixture','remote-role-fixture','unused-private-memory-fixture'])assert(!request.body.includes(sentinel));
  assert(Buffer.byteLength(request.body)<=MAX_REQUEST_BYTES);assert(request.tokens>Buffer.byteLength(request.body)+OUTPUT_TOKENS);assert(request.amountUsd>0);
  const payload=JSON.parse(request.body);assert.equal(JSON.parse(payload.messages[0].content).self.role,view.self.role);assert.equal(payload.model,MODEL);
});

test('adapter fixes the first-party URL, refuses every redirect status and never follows a supplied endpoint',async t=>{
  const choices=[{type:'say',text:'safe'}],request=makeRequest(council(),CHARACTERS[0],{},choices);request.url='https://evil.invalid/collect';let calls=0,cancelled=0;
  const statuses=[301,302,303,307,308];
  t.mock.method(globalThis,'fetch',async(url,options)=>{const status=statuses[calls++];assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(options.redirect,'error');assert.equal(options.headers['x-api-key'],key);assert(!options.body.includes(key));return new Response(new ReadableStream({cancel(){cancelled++;}}),{status,headers:{location:'https://evil.invalid/collect'}});});
  for(const status of statuses)await assert.rejects(send({request,apiKey:key,choices,signal:new AbortController().signal}),error=>error.code==='provider_unavailable'&&!error.retryable,`redirect ${status}`);
  assert.equal(calls,5);assert.equal(cancelled,5);
});

test('adapter accepts exactly 32768 response bytes but cancels 32769, in 137-byte stream chunks',async t=>{
  const choices=[{type:'say',text:'safe'}],request=makeRequest(council(),CHARACTERS[0],{},choices),serialized=JSON.stringify(provider()),stats={cancelled:0};
  const within=Buffer.from(serialized+' '.repeat(MAX_RESPONSE_BYTES-Buffer.byteLength(serialized)));let count=0;
  t.mock.method(globalThis,'fetch',async()=>streamResponse(count++===0?within:Buffer.concat([within,Buffer.from(' ')]),stats));
  assert.equal((await send({request,apiKey:key,choices,signal:new AbortController().signal})).type,'say');
  await assert.rejects(send({request,apiKey:key,choices,signal:new AbortController().signal}),error=>error.code==='output_limit');assert.equal(stats.cancelled,1);
});

test('adapter rejects usage ceilings, multiple tools, out-of-range choices and oversized/control dialogue',async t=>{
  const choices=[{type:'say',text:'safe'}],request=makeRequest(council(),CHARACTERS[0],{},choices);
  const cases=[{usage:{input_tokens:request.tokens,output_tokens:1}},{usage:{input_tokens:0,output_tokens:257}},{usage:{input_tokens:1.5,output_tokens:1}},{content:[{type:'tool_use',name:'pick_action',input:{choice:-1}}]},{content:[{type:'tool_use',name:'pick_action',input:{choice:0,speech:'x'.repeat(281)}}]},{content:[{type:'tool_use',name:'pick_action',input:{choice:0,speech:'bad\u0001text'}}]},{content:[{type:'tool_use',name:'pick_action',input:{choice:0,privateReasoning:'forbidden'}}]},{content:[{type:'tool_use',name:'pick_action',input:{choice:0}},{type:'tool_use',name:'pick_action',input:{choice:0}}]}];
  let index=0;t.mock.method(globalThis,'fetch',async()=>response(cases[index++]));
  for(const value of cases)await assert.rejects(send({request,apiKey:key,choices,signal:new AbortController().signal}),error=>['provider_usage','provider_response'].includes(error.code));assert.equal(index,cases.length);
});

test('retry sends only after each private checkpoint and real deployment reservation are durable',async t=>{
  const directory=await fixture(t,'retry'),budget=await createDailyBudget({directory,maxCostUsd:1}),controller=live(),args=input(),order=[],ids=[];
  args.commitReservation=async reservation=>{ids.push(reservation.id);const temporaryFile=path.join(directory,'private-context.tmp'),file=path.join(directory,'private-context.json');const handle=await open(temporaryFile,'wx',0o600);try{await handle.writeFile(JSON.stringify(args.context));await handle.sync();}finally{await handle.close();}await rename(temporaryFile,file);await budget.reserve({id:reservation.id,amount:reservation.amountUsd});order.push('durable');};
  let calls=0;t.mock.method(globalThis,'fetch',async(_url,options)=>{
    const saved=JSON.parse(await readFile(path.join(directory,'private-context.json'),'utf8')),ledger=JSON.parse(await readFile(path.join(directory,'ai-daily-budget.json'),'utf8'));assert.equal(state(saved).calls,calls+1);assert(Object.hasOwn(ledger.reservations,ids[calls]));assert.equal(options.headers['x-api-key'],key);order.push('send');return ++calls===1?new Response('synthetic unavailable',{status:503}):response();
  });
  const action=await controller.decide(args);assert.equal(action.type,'say');assert.deepEqual(order,['durable','send','durable','send']);assert.equal(new Set(ids).size,2);assert.equal(state(args.context).calls,2);assert.equal(Object.keys(JSON.parse(await readFile(path.join(directory,'ai-daily-budget.json'),'utf8')).reservations).length,2);
  for(const value of [JSON.stringify(action),JSON.stringify(controller.describe(args.context)),JSON.stringify(args.context)])assert(!value.includes('synthetic-private-provider-reasoning'));assert(!JSON.stringify(controller.describe(args.context)).includes(key));
});

test('abort after response headers interrupts a stalled body without retry or refund',async t=>{
  const controller=live(),args=input(),abort=new AbortController();args.signal=abort.signal;let sent,headers;
  const started=new Promise(resolve=>{sent=resolve;});let requests=0;
  t.mock.method(globalThis,'fetch',async(_url,options)=>{requests++;headers=options;const body=new ReadableStream({start(stream){options.signal.addEventListener('abort',()=>stream.error(new DOMException('synthetic abort','AbortError')),{once:true});}});sent();return new Response(body);});
  const pending=controller.decide(args);await started;await delay(5);abort.abort();assert.equal(await pending,null);assert(headers.signal.aborted);assert.equal(requests,1);assert.equal(state(args.context).calls,1);assert(state(args.context).costUsd>0);assert.equal(state(args.context).reservations.length,1);
});

test('late persistence acknowledgement after timeout never starts a provider request',{timeout:10000},async t=>{
  const directory=await fixture(t,'late-ack'),budget=await createDailyBudget({directory,maxCostUsd:1}),controller=live({timeoutMs:150}),args=input();let release,acknowledgement,reservationId;
  const gate=new Promise(resolve=>{release=resolve;});
  args.commitReservation=reservation=>acknowledgement=(async()=>{reservationId=reservation.id;await budget.reserve({id:reservation.id,amount:reservation.amountUsd});await gate;})();
  const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new Error('late send forbidden');});
  try{
    const action=await controller.decide(args);assert.equal(action.type,'say');assert.equal(controller.describe(args.context).limitReason,'reservation_failed');assert.equal(fetch.mock.callCount(),0);
  }finally{
    release();let timer;
    try{assert(acknowledgement,'controller invoked the durable reservation callback');await Promise.race([acknowledgement,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Durable reservation acknowledgement timed out')),5000);})]);}
    finally{clearTimeout(timer);}
  }
  assert.equal(fetch.mock.callCount(),0);assert.equal(state(args.context).calls,1);assert(budget.status().reservedUsd>0);
  const ledger=JSON.parse(await readFile(path.join(directory,'ai-daily-budget.json'),'utf8'));
  assert.deepEqual(Object.keys(ledger.reservations),[reservationId]);assert.equal(ledger.total,budget.status().reservedUsd);assert.equal(ledger.reservations[reservationId],state(args.context).reservations[0].amountUsd);
});

test('stalled response timeout cannot obtain a retry when its first send exhausted the call cap',async t=>{
  const controller=live({timeoutMs:150,maxCalls:1}),args=input();let requests=0,reservations=0;args.commitReservation=async()=>{reservations++;};
  t.mock.method(globalThis,'fetch',async(_url,options)=>{requests++;return new Response(new ReadableStream({start(stream){options.signal.addEventListener('abort',()=>stream.error(new DOMException('synthetic timeout','AbortError')),{once:true});}}));});
  assert.equal((await controller.decide(args)).type,'say');assert.equal(controller.describe(args.context).limitReason,'budget_calls');assert.equal(requests,1);assert.equal(reservations,1);assert.equal(state(args.context).reservations.length,1);assert(state(args.context).costUsd>0);
});

test('zero token/cost environment bounds prevent the adapter boundary from being reached',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new Error('zero cap send forbidden');});
  for(const [setting,value] of [['MAX_AI_TOKENS','0'],['MAX_AI_COST_USD','0'],['MAX_AI_CALLS','0']]){const config=loadConfig({AI_PROVIDER:'anthropic',ANTHROPIC_API_KEY:key,[setting]:value}),controller=createAiController({config:config.ai}),args=input();let reservations=0;args.commitReservation=async()=>{reservations++;};assert.equal((await controller.decide(args)).type,'say');assert.equal(controller.describe(args.context).mode,'demo');assert.equal(reservations,0);}
  assert.equal(fetch.mock.callCount(),0);
});

test('adapter constructor accepts exactly 12000 prompt bytes and rejects 12001 before any send',()=>{
  // Synthetic choice padding isolates serialization size; it is not a legal speech proposal.
  const view=council(),choices=[{type:'say',text:''}],baseline=makeRequest(view,CHARACTERS[0],{},choices);
  choices[0].text='x'.repeat(MAX_REQUEST_BYTES-Buffer.byteLength(baseline.body));
  const exact=makeRequest(view,CHARACTERS[0],{},choices);assert.equal(Buffer.byteLength(exact.body),12000);
  choices[0].text+='x';assert.throws(()=>makeRequest(view,CHARACTERS[0],{},choices),error=>error.code==='prompt_limit');
});
