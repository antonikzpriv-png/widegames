import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,lstat,mkdir,rmdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repo=fileURLToPath(new URL('../',import.meta.url));
const PIN='4f9f22f424e6660cac58306817fcfd9c925ee44a';
const HISTORICAL='c38d1f96b596e1831b175ed1cc549c790347d57d';
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'});
const source=(pin,file)=>git('show',`${pin}:${file}`);
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const budgetSource=source(PIN,'server/budget.mjs');
const {createDailyBudget}=await import(url(budgetSource));
const historical=await import(url(source(HISTORICAL,'server/budget.mjs')));
const now=()=>Date.parse('2026-10-29T12:00:00Z');
const fileFor=directory=>path.join(directory,'ai-daily-budget.json');
async function scratch(t){
 const parent=path.resolve(repo,'tests'),directory=await mkdtemp(path.join(parent,'ai-budget-final-'));
 t.after(async()=>{const absolute=path.resolve(directory);assert(absolute.startsWith(parent+path.sep)&&path.basename(absolute).startsWith('ai-budget-final-'));await rm(absolute,{recursive:true,force:true});});return directory;
}
async function seed(directory,value){await writeFile(fileFor(directory),JSON.stringify({day:'2026-10-29',...value}));}

async function controlledBudget(){
 const events=[];let failure=null,persisted=null,temporary=null,gate=null;
 const fail=stage=>{if(failure===stage)throw new Error(`injected ${stage}`);};
 const io={mkdir:async()=>{},lstat:async()=>{throw Object.assign(new Error('absent'),{code:'ENOENT'});},readFile:async()=>persisted,
  open:async()=>{events.push('open');fail('open');return {
   writeFile:async bytes=>{events.push('write');fail('write');temporary=bytes;},
   sync:async()=>{events.push('sync');fail('sync');if(gate)await gate;},
   close:async()=>{events.push('close');fail('close');}
  };},
  rename:async()=>{events.push('rename');fail('rename');persisted=temporary;},unlink:async()=>{events.push('unlink');temporary=null;}
 };
 const key=`__aiFinalIo_${crypto.randomUUID().replaceAll('-','')}`;globalThis[key]=io;
 const declaration="import {mkdir,readFile,open,rename,lstat,unlink} from 'node:fs/promises';";
 assert.equal(budgetSource.split(declaration).length,2);
 try{
  const module=await import(url(budgetSource.replace(declaration,`const {mkdir,readFile,open,rename,lstat,unlink}=globalThis[${JSON.stringify(key)}];`)));
  return {budget:await module.createDailyBudget({directory:'unused-fake-directory',maxCostUsd:1,now}),events,
   failAt:value=>{failure=value;},hold:value=>{gate=value;},bytes:()=>persisted};
 }finally{delete globalThis[key];}
}

test('final audit uses exact committed v2 budget and current process-lock sources',()=>{
 assert.equal(git('rev-parse',`${PIN}:server/budget.mjs`).trim(),'80716736b8517abea6ab3a61a16f4ea4284504f3');
 assert.equal(git('rev-parse',`${PIN}:server/store.mjs`).trim(),'e5a846a72d550413bbaafa6067fd7ef37397bf40');
 assert.equal(git('diff','3ba5c8e',PIN,'--','server/transport.mjs'),'');
});

test('historical c38 reproducer remains historical; 4f9 migrates, writes and restarts the same tiny inputs',async t=>{
 const reservations=Object.fromEntries(Array.from({length:1112},(_,i)=>['r'+i,1e-10]));
 const raw=Object.values(reservations).reduce((sum,n)=>sum+n,0);
 for(const [factory,expectFailure]of [[historical.createDailyBudget,true],[createDailyBudget,false]]){
  const directory=await scratch(t);await seed(directory,{version:1,reservations,total:raw});
  const budget=await factory({directory,maxCostUsd:.01,now});
  assert.equal(budget.status().reservedUsd,1112/1e9);
  await budget.reserve({id:'next',amount:1e-10});
  if(expectFailure)await assert.rejects(factory({directory,maxCostUsd:.01,now}),/cannot be restored/);
  else{
   const saved=JSON.parse(await readFile(fileFor(directory),'utf8'));
   assert.equal(saved.version,2);assert.equal(saved.totalNanos,1113);assert.equal(saved.total,1113/1e9);
   const restarted=await factory({directory,maxCostUsd:.01,now});assert.equal(restarted.status().reservedUsd,1113/1e9);
   await restarted.reserve({id:'another',amount:1e-10});
   assert.equal((await factory({directory,maxCostUsd:.01,now})).status().reservedUsd,1114/1e9);
  }
 }
});

test('both legacy raw and legacy canonical totals migrate only on a successful new write',async t=>{
 const reservations=Object.fromEntries(Array.from({length:1113},(_,i)=>['r'+i,1e-10]));
 for(const total of [Object.values(reservations).reduce((sum,n)=>sum+n,0),1113/1e9]){
  const directory=await scratch(t);await seed(directory,{version:1,reservations,total});
  const before=await readFile(fileFor(directory),'utf8'),budget=await createDailyBudget({directory,maxCostUsd:.01,now});
  assert.equal(budget.status().reservedUsd,1113/1e9);assert.equal(await readFile(fileFor(directory),'utf8'),before);
  await budget.reserve({id:'r0',amount:1e-10});assert.equal(await readFile(fileFor(directory),'utf8'),before);
  await budget.reserve({id:'migrate',amount:1e-10});
  const saved=JSON.parse(await readFile(fileFor(directory),'utf8'));
  assert.equal(saved.version,2);assert.equal(saved.totalNanos,1114);assert.equal(saved.total,1114/1e9);
  assert.equal((await createDailyBudget({directory,maxCostUsd:.01,now})).status().reservedUsd,1114/1e9);
 }
});

test('v2 validates both canonical fields and invalid schemas without modifying rejected bytes',async t=>{
 const valid={version:2,totalNanos:1,total:1e-9,reservations:{tiny:1e-10}};
 const variants=[{version:3},{totalNanos:0},{totalNanos:2},{totalNanos:1.5},{totalNanos:'1'},{totalNanos:null},{total:0},{total:2e-9},{total:-1e-15},{reservations:{tiny:-1e-10}},{reservations:{tiny:101}},{day:'2026-02-30'}];
 const directory=await scratch(t);
 for(const variant of variants){
  await seed(directory,{...valid,...variant});const before=await readFile(fileFor(directory),'utf8');
  await assert.rejects(createDailyBudget({directory,now}),/cannot be restored/);
  assert.equal(await readFile(fileFor(directory),'utf8'),before);
 }
 await seed(directory,{version:1,total:-5e-7,reservations:{}});await assert.rejects(createDailyBudget({directory,maxCostUsd:0,now}),/cannot be restored/);
 await seed(directory,{version:1,total:0,reservations:{large:.25}});await assert.rejects(createDailyBudget({directory,now}),/cannot be restored/);
});

test('independent tiny-value ceilings consume exactly the expected finite nanodollar cap',async t=>{
 const directory=await scratch(t),budget=await createDailyBudget({directory,maxCostUsd:16e-9,now});
 const cases=[[1e-15,1],[.25e-9,1],[.999e-9,1],[1e-9,1],[1.0001e-9,2],[9.5e-9,10]];
 let expected=0;
 for(const [i,[amount,nanos]]of cases.entries()){
  await budget.reserve({id:'r'+i,amount});expected+=nanos;
  assert.equal(budget.status().reservedUsd,expected/1e9);
 }
 assert.equal(expected,16);await assert.rejects(budget.reserve({id:'excess',amount:Number.MIN_VALUE}),/exhausted/);
 const saved=JSON.parse(await readFile(fileFor(directory),'utf8'));assert.equal(saved.totalNanos,16);assert.equal(saved.total,16e-9);
 assert.equal((await createDailyBudget({directory,maxCostUsd:16e-9,now})).status().reservedUsd,16e-9);
});

test('zero/floored caps remain strict after v2 write and restart',async t=>{
 const directory=await scratch(t),budget=await createDailyBudget({directory,maxCostUsd:0,now});
 await budget.reserve({id:'zero',amount:0});
 const saved=JSON.parse(await readFile(fileFor(directory),'utf8'));assert.equal(saved.version,2);assert.equal(saved.totalNanos,0);
 for(const instance of [budget,await createDailyBudget({directory,maxCostUsd:0,now})])for(const amount of [Number.MIN_VALUE,1e-15,1e-10,1e-9])await assert.rejects(instance.reserve({id:'positive',amount}),/exhausted/);
 const other=await scratch(t),floored=await createDailyBudget({directory:other,maxCostUsd:1.9e-9,now});
 await assert.rejects(floored.reserve({id:'above-floor',amount:1.01e-9}),/exhausted/);await floored.reserve({id:'at-floor',amount:1e-9});
});

test('v2 rollover is bounded and a backwards clock cannot reopen allowance',async t=>{
 const directory=await scratch(t);let at=Date.parse('2026-10-29T23:59:59Z');const clock=()=>at;
 const budget=await createDailyBudget({directory,maxCostUsd:1e-9,now:clock});
 await budget.reserve({id:'old-day',amount:1e-10});at+=2000;await budget.reserve({id:'new-day',amount:1e-10});
 const saved=JSON.parse(await readFile(fileFor(directory),'utf8'));
 assert.equal(saved.version,2);assert.equal(saved.totalNanos,1);assert.deepEqual(Object.keys(saved.reservations),['new-day']);
 at-=86400000;await assert.rejects(budget.reserve({id:'backwards',amount:1e-10}),/clock precedes/);
});

test('KNOWN DEFECT: acknowledged v2 file can cross its own restore byte limit',async t=>{
 const directory=await scratch(t),count=9708,amount=1.2345678901234567e-10;
 const id=i=>'r'.repeat(176)+String(i).padStart(4,'0');
 const reservations=Object.fromEntries(Array.from({length:count},(_,i)=>[id(i),amount]));
 await seed(directory,{version:2,reservations,totalNanos:count,total:count/1e9});
 assert.equal((await lstat(fileFor(directory))).size,1999935);
 const budget=await createDailyBudget({directory,maxCostUsd:.01,now});await budget.reserve({id:id(count),amount});
 assert.equal((await lstat(fileFor(directory))).size,2000141);
 assert.equal(Object.keys(JSON.parse(await readFile(fileFor(directory),'utf8')).reservations).length,9709);
 await assert.rejects(createDailyBudget({directory,maxCostUsd:.01,now}),/cannot be restored/);
 t.diagnostic('Open P2 availability counterexample: valid long IDs and tiny values write >2,000,000 bytes before 10,000 entries; startup then rejects. No overspend.');
});

test('v2 acknowledgement still waits for write then sync then close then atomic rename',async()=>{
 const harness=await controlledBudget();let release,acknowledged=false;
 harness.hold(new Promise(resolve=>{release=resolve;}));
 const pending=harness.budget.reserve({id:'order',amount:.25}).then(()=>{acknowledged=true;});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(harness.events,['open','write','sync']);assert.equal(acknowledged,false);assert.equal(harness.budget.status().reservedUsd,0);
 release();await pending;assert.deepEqual(harness.events,['open','write','sync','close','rename']);
 const saved=JSON.parse(harness.bytes());assert.equal(saved.version,2);assert.equal(saved.totalNanos,250000000);
});

for(const stage of ['open','write','sync','close','rename'])test(`v2 injected ${stage} failure keeps prior acknowledged totals and permits recovery`,async()=>{
 const harness=await controlledBudget();await harness.budget.reserve({id:'prior',amount:.25});const bytes=harness.bytes();
 harness.events.length=0;harness.failAt(stage);await assert.rejects(harness.budget.reserve({id:'denied',amount:.5}),new RegExp(`injected ${stage}`));
 assert.equal(harness.budget.status().reservedUsd,.25);assert.equal(harness.bytes(),bytes);assert(harness.events.includes('unlink'));
 if(stage!=='rename')assert(!harness.events.includes('rename'));
 harness.failAt(null);await harness.budget.reserve({id:'recovery',amount:.25});assert.equal(harness.budget.status().reservedUsd,.5);
});

test('v2 real rename failure rejects and later successful persistence restores',async t=>{
 const directory=await scratch(t),budget=await createDailyBudget({directory,maxCostUsd:1,now});await mkdir(fileFor(directory));
 await assert.rejects(budget.reserve({id:'denied',amount:.25}));assert.equal(budget.status().reservedUsd,0);
 await rmdir(fileFor(directory));await budget.reserve({id:'recovery',amount:.25});
 assert.equal((await createDailyBudget({directory,maxCostUsd:1,now})).status().reservedUsd,.25);
});

test('current exact transport and updated store preserve one factory under process ownership',async t=>{
 const storeUrl=url(source(PIN,'server/store.mjs')),roomUrl=url(source(PIN,'server/rooms.mjs').replace("'./store.mjs'",JSON.stringify(storeUrl))),sharedUrl=url(source(PIN,'shared/contracts.mjs'));
 let factories=0;class UnusedWebSocketServer{constructor(){this.clients=new Set();}close(done){done();}}
 const key=`__aiFinalTransport_${crypto.randomUUID().replaceAll('-','')}`;
 globalThis[key]={WebSocketServer:UnusedWebSocketServer,WebSocket:{OPEN:1},budget:async options=>{factories++;return createDailyBudget(options);}};
 let code=source(PIN,'server/transport.mjs');assert.equal((code.match(/await createDailyBudget\(/g)||[]).length,1);
 code=code.replace("import {WebSocketServer,WebSocket} from 'ws';",`const seam=globalThis[${JSON.stringify(key)}];const {WebSocketServer,WebSocket}=seam;`)
  .replace("import {serveStatic} from './static.mjs';","const serveStatic=()=>{throw new Error('No browser/static requests in final audit');};")
  .replace("'./store.mjs'",JSON.stringify(storeUrl)).replace("import {createDailyBudget} from './budget.mjs';","const createDailyBudget=options=>seam.budget(options);")
  .replace("'./rooms.mjs'",JSON.stringify(roomUrl)).replace("'../shared/contracts.mjs'",JSON.stringify(sharedUrl));
 const {createGameServer}=await import(url(code));delete globalThis[key];
 const directory=await scratch(t),config={dataDir:directory,publicOrigin:'http://127.0.0.1:3000',tickMs:60000};
 const dependencies={engine:{},aiController:{describe:()=>({mode:'demo'})}};
 const first=await createGameServer(config,dependencies);let reopened;
 try{assert.equal(factories,1);await assert.rejects(createGameServer(config,dependencies),/already in use/);assert.equal(factories,1);await first.close();reopened=await createGameServer(config,dependencies);assert.equal(factories,2);}
 finally{if(reopened)await reopened.close();await first.close();}
});
