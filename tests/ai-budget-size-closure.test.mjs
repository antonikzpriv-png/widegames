import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,readdir,mkdir,rmdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const PIN='c77f2836094049c4e0e9fccceb19ef91d4ce042f';
const repo=fileURLToPath(new URL('../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'});
const source=git('show',`${PIN}:server/budget.mjs`);
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const {createDailyBudget}=await import(url(source));
const now=()=>Date.parse('2026-10-29T12:00:00Z');
const fileFor=dir=>path.join(dir,'ai-daily-budget.json');
async function scratch(t){
 const parent=path.resolve(repo,'tests'),dir=await mkdtemp(path.join(parent,'ai-budget-size-closure-'));
 t.after(async()=>{const absolute=path.resolve(dir);assert(absolute.startsWith(parent+path.sep)&&path.basename(absolute).startsWith('ai-budget-size-closure-'));await rm(absolute,{recursive:true,force:true});});return dir;
}
function fixture(){
 const count=9708,amount=1.2345678901234567e-10,id=i=>'r'.repeat(176)+String(i).padStart(4,'0');
 const reservations=Object.fromEntries(Array.from({length:count},(_,i)=>[id(i),amount]));
 return {count,amount,id,bytes:JSON.stringify({day:'2026-10-29',version:2,reservations,totalNanos:count,total:count/1e9})};
}
async function controlled(initial=null){
 const events=[];let persisted=initial,temporary=null,failure=null,gate=null;
 const fail=stage=>{if(failure===stage)throw new Error(`injected ${stage}`);};
 const io={mkdir:async()=>{},lstat:async()=>{if(persisted===null)throw Object.assign(new Error('absent'),{code:'ENOENT'});return {isFile:()=>true,isSymbolicLink:()=>false,size:Buffer.byteLength(persisted)};},readFile:async()=>persisted,
  open:async()=>{events.push('open');fail('open');return {writeFile:async bytes=>{events.push('write');fail('write');temporary=bytes;},sync:async()=>{events.push('sync');fail('sync');if(gate)await gate;},close:async()=>{events.push('close');fail('close');}};},
  rename:async()=>{events.push('rename');fail('rename');persisted=temporary;},unlink:async()=>{events.push('unlink');temporary=null;}
 };
 const key=`__aiSizeIo_${crypto.randomUUID().replaceAll('-','')}`;globalThis[key]=io;
 const declaration="import {mkdir,readFile,open,rename,lstat,unlink} from 'node:fs/promises';";assert.equal(source.split(declaration).length,2);
 try{const module=await import(url(source.replace(declaration,`const {mkdir,readFile,open,rename,lstat,unlink}=globalThis[${JSON.stringify(key)}];`)));
  return {budget:await module.createDailyBudget({directory:'unused-fake-directory',maxCostUsd:1,now}),events,bytes:()=>persisted,failAt:stage=>{failure=stage;},hold:value=>{gate=value;}};
 }finally{delete globalThis[key];}
}

test('size closure pins c77 budget and unchanged qualified transport/store objects',()=>{
 assert.equal(git('rev-parse',`${PIN}:server/budget.mjs`).trim(),'a69eb7bd30d45c58701fe93885bf1291815011fb');
 assert.equal(git('rev-parse',`${PIN}:server/transport.mjs`).trim(),'506473809782165254c7c7d30c33d64f216c7811');
 assert.equal(git('rev-parse',`${PIN}:server/store.mjs`).trim(),'e5a846a72d550413bbaafa6067fd7ef37397bf40');
});

test('9708-entry size counterexample now denies without changing bytes/memory and remains restorable',async t=>{
 const directory=await scratch(t),f=fixture();assert.equal(Buffer.byteLength(f.bytes),1999935);await writeFile(fileFor(directory),f.bytes);
 const budget=await createDailyBudget({directory,maxCostUsd:.01,now});
 await assert.rejects(budget.reserve({id:f.id(f.count),amount:f.amount}),/storage limit/);
 assert.equal(await readFile(fileFor(directory),'utf8'),f.bytes);assert.equal(budget.status().reservedUsd,f.count/1e9);
 assert.deepEqual(await readdir(directory),['ai-daily-budget.json']);
 assert.equal((await createDailyBudget({directory,maxCostUsd:.01,now})).status().reservedUsd,f.count/1e9);
 // A later valid short-ID request still fits; denial neither charged nor blocked the queue.
 await budget.reserve({id:'ok',amount:f.amount});const after=await readFile(fileFor(directory),'utf8');
 assert(Buffer.byteLength(after)<=2000000);const saved=JSON.parse(after);assert.equal(saved.totalNanos,f.count+1);assert(!Object.hasOwn(saved.reservations,f.id(f.count)));
 assert.equal((await createDailyBudget({directory,maxCostUsd:.01,now})).status().reservedUsd,(f.count+1)/1e9);
});

test('size admission rejects before any temporary open, write, sync or rename',async()=>{
 const f=fixture(),h=await controlled(f.bytes);
 await assert.rejects(h.budget.reserve({id:f.id(f.count),amount:f.amount}),/storage limit/);
 assert.deepEqual(h.events,[]);assert.equal(h.bytes(),f.bytes);assert.equal(h.budget.status().reservedUsd,f.count/1e9);
});

test('previous v1 raw/canonical tiny-entry migration and strict v2 restore controls still pass',async t=>{
 const reservations=Object.fromEntries(Array.from({length:1112},(_,i)=>['r'+i,1e-10]));
 for(const total of [Object.values(reservations).reduce((sum,n)=>sum+n,0),1112/1e9]){
  const directory=await scratch(t);await writeFile(fileFor(directory),JSON.stringify({version:1,day:'2026-10-29',reservations,total}));
  const budget=await createDailyBudget({directory,maxCostUsd:.01,now});await budget.reserve({id:'next',amount:1e-10});
  const saved=JSON.parse(await readFile(fileFor(directory),'utf8'));assert.equal(saved.version,2);assert.equal(saved.totalNanos,1113);assert.equal(saved.total,1113/1e9);
  assert.equal((await createDailyBudget({directory,maxCostUsd:.01,now})).status().reservedUsd,1113/1e9);
  for(const mutation of [{totalNanos:1112},{total:0},{total:-1e-15}]){await writeFile(fileFor(directory),JSON.stringify({...saved,...mutation}));await assert.rejects(createDailyBudget({directory,now}),/cannot be restored/);}
 }
});

test('positive tiny inputs retain ceiling accounting and strict zero-cap denial',async t=>{
 const directory=await scratch(t),budget=await createDailyBudget({directory,maxCostUsd:16e-9,now});
 const cases=[[1e-15,1],[.25e-9,1],[.999e-9,1],[1e-9,1],[1.0001e-9,2],[9.5e-9,10]];let expected=0;
 for(const [i,[amount,nanos]]of cases.entries()){await budget.reserve({id:'r'+i,amount});expected+=nanos;assert.equal(budget.status().reservedUsd,expected/1e9);}
 await assert.rejects(budget.reserve({id:'excess',amount:Number.MIN_VALUE}),/exhausted/);assert.equal((await createDailyBudget({directory,maxCostUsd:16e-9,now})).status().reservedUsd,16e-9);
 const zeroDir=await scratch(t),zero=await createDailyBudget({directory:zeroDir,maxCostUsd:0,now});
 for(const amount of [Number.MIN_VALUE,1e-15,1e-10,1e-9])await assert.rejects(zero.reserve({id:'positive',amount}),/exhausted/);
 await writeFile(fileFor(zeroDir),JSON.stringify({version:1,day:'2026-10-29',reservations:{},total:-5e-7}));await assert.rejects(createDailyBudget({directory:zeroDir,maxCostUsd:0,now}),/cannot be restored/);
});

test('accepted writes still await sync and atomic rename before acknowledgement',async()=>{
 const h=await controlled();let release,acknowledged=false;h.hold(new Promise(resolve=>{release=resolve;}));
 const pending=h.budget.reserve({id:'order',amount:.25}).then(()=>{acknowledged=true;});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(h.events,['open','write','sync']);assert.equal(acknowledged,false);assert.equal(h.budget.status().reservedUsd,0);
 release();await pending;assert.deepEqual(h.events,['open','write','sync','close','rename']);assert.equal(acknowledged,true);assert.equal(JSON.parse(h.bytes()).totalNanos,250000000);
});
for(const stage of ['open','write','sync','close','rename'])test(`c77 ${stage} failure preserves prior ledger and allows recovery`,async()=>{
 const h=await controlled();await h.budget.reserve({id:'prior',amount:.25});const before=h.bytes();h.events.length=0;h.failAt(stage);
 await assert.rejects(h.budget.reserve({id:'denied',amount:.5}),new RegExp(`injected ${stage}`));assert.equal(h.budget.status().reservedUsd,.25);assert.equal(h.bytes(),before);assert(h.events.includes('unlink'));
 if(stage!=='rename')assert(!h.events.includes('rename'));h.failAt(null);await h.budget.reserve({id:'recovered',amount:.25});assert.equal(h.budget.status().reservedUsd,.5);
});

test('real rename obstruction rejects, recovers and restores at c77',async t=>{
 const directory=await scratch(t),budget=await createDailyBudget({directory,maxCostUsd:1,now});await mkdir(fileFor(directory));
 await assert.rejects(budget.reserve({id:'denied',amount:.25}));assert.equal(budget.status().reservedUsd,0);await rmdir(fileFor(directory));
 await budget.reserve({id:'recovered',amount:.25});assert.equal((await createDailyBudget({directory,maxCostUsd:1,now})).status().reservedUsd,.25);
});
