import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,mkdir,rmdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Review exact committed objects. No moving-worktree imports or paid providers.
const repo=fileURLToPath(new URL('../',import.meta.url));
const FIX='c38d1f96b596e1831b175ed1cc549c790347d57d';
const OLD='43f300c2f74c6902c10dbadc123173b27d724e60';
const TRANSPORT='3ba5c8efd97e368e0d69a3a9aea9f5a8edbdb8cb';
const FRONT='0d93c1b1e707187fb1b632040d42a68ad8db1618';
const IMPORT='6411e8d2f8fb1eb88194cc43cb75f902ed339db2';
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'});
const source=(pin,file)=>git('show',`${pin}:${file}`);
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const budgetSource=source(FIX,'server/budget.mjs');
const {createDailyBudget}=await import(url(budgetSource));
const legacy=await import(url(source(OLD,'server/budget.mjs')));
const now=()=>Date.parse('2026-10-29T12:00:00Z');
async function scratch(t){
 const parent=path.resolve(repo,'tests'),dir=await mkdtemp(path.join(parent,'ai-budget-closure-'));
 t.after(async()=>{const absolute=path.resolve(dir);assert(absolute.startsWith(parent+path.sep)&&path.basename(absolute).startsWith('ai-budget-closure-'));await rm(absolute,{recursive:true,force:true});});return dir;
}
const ledgerFile=dir=>path.join(dir,'ai-daily-budget.json');
async function seed(dir,reservations,total){await writeFile(ledgerFile(dir),JSON.stringify({version:1,day:'2026-10-29',reservations,total}));}

// Replace only the named fs import to observe/fault individual I/O operations.
// All accounting, exception handling and acknowledgement code remains unchanged.
async function controlledBudget(){
 const events=[];let failure=null,persisted=null,temporary=null,gate=null;
 const fail=stage=>{if(failure===stage)throw new Error(`injected ${stage}`);};
 const io={
  mkdir:async()=>{},lstat:async()=>{throw Object.assign(new Error('absent'),{code:'ENOENT'});},readFile:async()=>persisted,
  open:async()=>{events.push('open');fail('open');return {
   writeFile:async bytes=>{events.push('write');fail('write');temporary=bytes;},
   sync:async()=>{events.push('sync');fail('sync');if(gate)await gate;},
   close:async()=>{events.push('close');fail('close');}
  };},
  rename:async()=>{events.push('rename');fail('rename');persisted=temporary;},
  unlink:async()=>{events.push('unlink');temporary=null;}
 };
 const key=`__aiClosureIo_${crypto.randomUUID().replaceAll('-','')}`;
 globalThis[key]=io;
 const declaration="import {mkdir,readFile,open,rename,lstat,unlink} from 'node:fs/promises';";
 assert.equal(budgetSource.split(declaration).length,2);
 const instrumented=budgetSource.replace(declaration,`const {mkdir,readFile,open,rename,lstat,unlink}=globalThis[${JSON.stringify(key)}];`);
 try{
  const module=await import(url(instrumented));
  return {budget:await module.createDailyBudget({directory:'unused-fake-directory',maxCostUsd:1,now}),events,
   failAt:value=>{failure=value;},hold:value=>{gate=value;},bytes:()=>persisted};
 }finally{delete globalThis[key];}
}

test('closure pins exact budget, transport and imported frontend source objects',()=>{
 assert.equal(git('rev-parse',`${FIX}:server/budget.mjs`).trim(),'2184c2b397f9a10753e33d37de2d9d122169112b');
 for(const file of ['server/budget.mjs','server/transport.mjs','server/store.mjs','server/rooms.mjs'])assert.equal(source(IMPORT,file),source(file.endsWith('budget.mjs')?FIX:TRANSPORT,file));
 assert.equal(git('diff',FRONT,IMPORT,'--','public'),'');
});

test('legacy negative-total zero-cap reproducer now rejects restore',async t=>{
 const oldDir=await scratch(t),newDir=await scratch(t);
 for(const dir of [oldDir,newDir])await seed(dir,{},-0.0000005);
 const before=await legacy.createDailyBudget({directory:oldDir,maxCostUsd:0,now});
 await before.reserve({id:'over-zero',amount:0.0000005});
 await assert.rejects(createDailyBudget({directory:newDir,maxCostUsd:0,now}),/cannot be restored/);
});

test('positive sub-nanodollar requests never bypass zero or floored caps',async t=>{
 const directory=await scratch(t),budget=await createDailyBudget({directory,maxCostUsd:0,now});
 for(const amount of [Number.MIN_VALUE,1e-15,1e-10,1e-9])await assert.rejects(budget.reserve({id:'positive',amount}),/exhausted/);
 assert.equal(budget.status().reservedUsd,0);
 const fractional=await createDailyBudget({directory,maxCostUsd:1.9e-9,now});
 await assert.rejects(fractional.reserve({id:'above-floor',amount:1.01e-9}),/exhausted/);
 await fractional.reserve({id:'exact-floor',amount:1e-9});
});

test('restore derives canonical conservative totals rather than a tolerated lower saved total',async t=>{
 const directory=await scratch(t);await seed(directory,{a:.1,b:.2},.2999995);
 const budget=await createDailyBudget({directory,maxCostUsd:.3,now});
 assert.equal(budget.status().reservedUsd,.3);
 await budget.reserve({id:'a',amount:.1});await assert.rejects(budget.reserve({id:'more',amount:1e-10}),/exhausted/);
 const writable=await createDailyBudget({directory,maxCostUsd:.5,now});await writable.reserve({id:'c',amount:.1});
 assert.equal(JSON.parse(await readFile(ledgerFile(directory),'utf8')).total,.4);
 assert.equal((await createDailyBudget({directory,maxCostUsd:.5,now})).status().reservedUsd,.4);
});

test('KNOWN DEFECT: many fractional entries produce a self-written ledger rejected on restart',async t=>{
 const directory=await scratch(t),reservations=Object.fromEntries(Array.from({length:1112},(_,i)=>['r'+i,1e-10]));
 await seed(directory,reservations,Object.values(reservations).reduce((sum,n)=>sum+n,0));
 const budget=await createDailyBudget({directory,maxCostUsd:.01,now});
 assert.equal(budget.status().reservedUsd,.000001112);
 await budget.reserve({id:'next',amount:1e-10});
 assert.equal(JSON.parse(await readFile(ledgerFile(directory),'utf8')).total,.000001113);
 await assert.rejects(createDailyBudget({directory,maxCostUsd:.01,now}),/cannot be restored/);
 t.diagnostic('Open P2 availability finding: 1,113 ceil-rounded entries exceed the old raw-sum tolerance; passing this reproducer does not mean closure.');
});

test('same-instance concurrent math, deduplication and restart retain the cap',async t=>{
 const directory=await scratch(t),budget=await createDailyBudget({directory,maxCostUsd:1,now});
 const settled=await Promise.allSettled(Array.from({length:8},(_,i)=>budget.reserve({id:'r'+i,amount:.25})));
 assert.equal(settled.filter(x=>x.status==='fulfilled').length,4);assert.equal(budget.status().reservedUsd,1);
 const before=await readFile(ledgerFile(directory),'utf8');
 await budget.reserve({id:'r0',amount:.25});await assert.rejects(budget.reserve({id:'r0',amount:.1}),/conflict/);
 assert.equal(await readFile(ledgerFile(directory),'utf8'),before);
 const restored=await createDailyBudget({directory,maxCostUsd:1,now});
 assert.equal(restored.status().reservedUsd,1);await assert.rejects(restored.reserve({id:'extra',amount:1e-9}),/exhausted/);
});

test('acknowledgement waits for write, sync, close and rename in that order',async()=>{
 const harness=await controlledBudget();let release,acknowledged=false;
 harness.hold(new Promise(resolve=>{release=resolve;}));
 const pending=harness.budget.reserve({id:'sync-order',amount:.25}).then(()=>{acknowledged=true;});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(harness.events,['open','write','sync']);assert.equal(acknowledged,false);assert.equal(harness.budget.status().reservedUsd,0);assert.equal(harness.bytes(),null);
 release();await pending;
 assert.deepEqual(harness.events,['open','write','sync','close','rename']);assert.equal(acknowledged,true);assert.equal(harness.budget.status().reservedUsd,.25);
});

for(const stage of ['open','write','sync','close','rename'])test(`injected ${stage} failure rejects acknowledgement and preserves prior ledger`,async()=>{
 const harness=await controlledBudget();await harness.budget.reserve({id:'prior',amount:.25});const bytes=harness.bytes();
 harness.events.length=0;harness.failAt(stage);
 await assert.rejects(harness.budget.reserve({id:'denied',amount:.5}),new RegExp(`injected ${stage}`));
 assert.equal(harness.budget.status().reservedUsd,.25);assert.equal(harness.bytes(),bytes);assert(harness.events.includes('unlink'));
 if(['open','write','sync','close'].includes(stage))assert(!harness.events.includes('rename'));
 harness.failAt(null);await harness.budget.reserve({id:'recovered',amount:.25});assert.equal(harness.budget.status().reservedUsd,.5);
});

test('actual filesystem rename failure keeps in-memory spend unchanged and recovers',async t=>{
 const directory=await scratch(t),budget=await createDailyBudget({directory,maxCostUsd:1,now});
 await mkdir(ledgerFile(directory));await assert.rejects(budget.reserve({id:'denied',amount:.25}));assert.equal(budget.status().reservedUsd,0);
 await rmdir(ledgerFile(directory));await budget.reserve({id:'recovered',amount:.25});
 assert.equal((await createDailyBudget({directory,maxCostUsd:1,now})).status().reservedUsd,.25);
});

test('real transport startup locks storage before constructing its sole daily-budget instance',async t=>{
 const storeUrl=url(source(TRANSPORT,'server/store.mjs'));
 const roomUrl=url(source(TRANSPORT,'server/rooms.mjs').replace("'./store.mjs'",JSON.stringify(storeUrl)));
 const sharedUrl=url(source(TRANSPORT,'shared/contracts.mjs'));
 let factories=0;
 class UnusedWebSocketServer{constructor(){this.clients=new Set();}close(done){done();}}
 const key=`__aiClosureTransport_${crypto.randomUUID().replaceAll('-','')}`;
 globalThis[key]={WebSocketServer:UnusedWebSocketServer,WebSocket:{OPEN:1},budget:async options=>{factories++;return createDailyBudget(options);}};
 let code=source(TRANSPORT,'server/transport.mjs');
 assert.equal((code.match(/await createDailyBudget\(/g)||[]).length,1);
 code=code.replace("import {WebSocketServer,WebSocket} from 'ws';",`const seam=globalThis[${JSON.stringify(key)}];const {WebSocketServer,WebSocket}=seam;`)
  .replace("import {serveStatic} from './static.mjs';","const serveStatic=()=>{throw new Error('No static/browser requests in closure audit');};")
  .replace("'./store.mjs'",JSON.stringify(storeUrl))
  .replace("import {createDailyBudget} from './budget.mjs';","const createDailyBudget=options=>seam.budget(options);")
  .replace("'./rooms.mjs'",JSON.stringify(roomUrl)).replace("'../shared/contracts.mjs'",JSON.stringify(sharedUrl));
 const {createGameServer}=await import(url(code));delete globalThis[key];
 const directory=await scratch(t),config={dataDir:directory,publicOrigin:'http://127.0.0.1:3000',tickMs:60000};
 const dependencies={engine:{},aiController:{describe:()=>({mode:'demo'})}};
 const first=await createGameServer(config,dependencies);let reopened;
 try{
  assert.equal(factories,1);
  await assert.rejects(createGameServer(config,dependencies),/already in use/);
  assert.equal(factories,1,'second server must fail before a second budget factory');
  await first.close();reopened=await createGameServer(config,dependencies);assert.equal(factories,2);
 }finally{if(reopened)await reopened.close();await first.close();}
});

test('safe room metadata excludes private context and identifies hybrid behavior',async()=>{
 const storeUrl=url(source(TRANSPORT,'server/store.mjs'));
 const {createRooms}=await import(url(source(TRANSPORT,'server/rooms.mjs').replace("'./store.mjs'",JSON.stringify(storeUrl))));
 const service=createRooms({store:{save:async()=>{}},engine:{},ai:{describe:()=>({mode:'live',strategy:'hybrid',navigation:'local',council:'model',apiKey:'secret-key',memory:'secret-memory',reasoning:'secret-reasoning'})},now});
 const {room,identity}=await service.create('spectator');room.data.aiContext={privateMemory:'private-context'};
 const view=service.view(room,identity),serialized=JSON.stringify(view);
 for(const secret of ['secret-key','secret-memory','secret-reasoning','private-context'])assert(!serialized.includes(secret));
 assert.equal(view.ai.strategy,'hybrid');assert(view.notices.some(n=>n.includes('live model council')&&n.includes('local policy')));
});

test('imported frontend renders dialogue as literal text and exposes only own role in assignment panel',async t=>{
 class DomNode{
  constructor(type,tag='',value=''){this.nodeType=type;this.tagName=tag.toUpperCase();this.nodeValue=value;this.childNodes=[];this.attributes=new Map();}
  append(...items){this.childNodes.push(...items);}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  addEventListener(){}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(n=>n.textContent).join('');}
 }
 const previous={document:globalThis.document,Node:globalThis.Node};
 globalThis.Node=DomNode;globalThis.document={createElement:tag=>new DomNode(1,tag),createTextNode:value=>new DomNode(3,'',value)};
 t.after(()=>{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 const uiUrl=url(source(FRONT,'public/ui.mjs')),presentationUrl=url(source(FRONT,'public/presentation.mjs'));
 const panels=await import(url(source(FRONT,'public/panels.mjs').replace("'./ui.mjs'",JSON.stringify(uiUrl)).replace("'./presentation.mjs'",JSON.stringify(presentationUrl))));
 const hostile='<img src=x onerror="steal()"><script>secret()</script>',game={phase:'discussion',self:null,players:[{id:'p2',name:'Pax'}],meeting:{reason:'timeout',messages:[{playerId:'p2',text:hostile}]}};
 const panel=panels.councilPanel(game,{pending:false,now:now(),draft:'',act:()=>{throw new Error('spectator action');}});
 assert(panel.textContent.includes(hostile));
 const walk=node=>[node,...node.childNodes.flatMap(walk)];
 assert(!walk(panel).some(node=>['IMG','SCRIPT'].includes(node.tagName)));
 const spectator=panels.watchPanel(game,{});assert(spectator.textContent.includes('You are a spectator.'));assert(!spectator.textContent.includes('You are the saboteur.'));
 const own=panels.watchPanel({...game,self:{id:'p1',role:'saboteur',alive:true}},{});assert(own.textContent.includes('You are the saboteur.'));
 assert.equal(panels.resultsPanel(game,{}),null,'role-revealed results cannot render before ended');
});
