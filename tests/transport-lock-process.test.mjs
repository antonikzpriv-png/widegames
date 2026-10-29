import test from 'node:test';
import assert from 'node:assert/strict';
import {fork,spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRoomStore} from '../server/store.mjs';

const fixedModule=new URL('../server/store.mjs',import.meta.url).href;
// Retained negative control: acquisition/release protocol from 0979ea9.
// This is real exclusive-file I/O in two children, with IPC scheduling only.
const unsafeStore=String.raw`
import {mkdir,lstat,readFile,open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export async function createRoomStore(directory) {
  await mkdir(directory,{recursive:true,mode:0o700});
  const lockFile=path.join(directory,'service.lock'),token=randomUUID();
  let locked=false;
  for(let attempt=0;attempt<2;attempt++) {
    try {const handle=await open(lockFile,'wx',0o600);try{await handle.writeFile(JSON.stringify({pid:process.pid,token}));await handle.sync();}finally{await handle.close();}locked=true;break;}
    catch(error) {
      if(error.code!=='EEXIST')throw error;
      const info=await lstat(lockFile);if(!info.isFile()||info.isSymbolicLink()||info.size>1024)throw new Error('Unsafe data directory lock');
      const owner=JSON.parse(await readFile(lockFile,'utf8'));if(!Number.isSafeInteger(owner.pid)||owner.pid<=0)throw new Error('Invalid data directory lock');
      try{process.kill(owner.pid,0);throw new Error('Data directory already in use');}catch(probe){if(probe.code!=='ESRCH')throw probe;}
      await unlink(lockFile);
    }
  }
  if(!locked)throw new Error('Data directory already in use');
  let closed=false;
  return {async close(){if(closed)return;closed=true;const owner=JSON.parse(await readFile(lockFile,'utf8'));if(owner.token===token)await unlink(lockFile);}};
}
`;

const childSource=String.raw`
import fs from 'node:fs/promises';
import path from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
const [directory,moduleUrl,label,gate]=process.argv.slice(2);
const waiting=new Map(),queued=new Set();
process.on('message',message=>{const callback=waiting.get(message);if(callback){waiting.delete(message);callback();}else queued.add(message);});
const wait=message=>{if(queued.delete(message))return Promise.resolve();return new Promise(resolve=>waiting.set(message,resolve));};
const send=(type,details={})=>process.send({type,pid:process.pid,...details});
const read=fs.readFile,open=fs.open,unlink=fs.unlink;
let pausedRead=false,pausedOpen=false,pausedUnlink=false;
fs.readFile=async(...args)=>{
  const result=await read(...args);
  if(path.basename(String(args[0]))==='service.lock'&&String(result).includes(label)&&gate==='stale'&&!pausedRead){pausedRead=true;send('stale-read');await wait('continue-stale');}
  return result;
};
fs.open=async(...args)=>{
  if(path.basename(String(args[0]))==='service.lock.recovery'&&gate==='claim'&&!pausedOpen){pausedOpen=true;send('before-claim');await wait('continue-claim');}
  return open(...args);
};
fs.unlink=async(...args)=>{
  if(path.basename(String(args[0]))==='service.lock'&&gate==='unlink'&&!pausedUnlink){pausedUnlink=true;send('before-unlink');await wait('continue-unlink');}
  return unlink(...args);
};
syncBuiltinESMExports();
const {createRoomStore}=await import(moduleUrl);
send('ready');await wait('start');
try {
  const store=await createRoomStore(directory);send('acquired');
  // A winner stays alive, owning its lock until the parent explicitly releases it.
  await wait('release');
  try{await store.close();send('released');}catch(error){send('release-rejected',{message:error.message});}
}catch(error){send('rejected',{message:error.message});}
await wait('exit');process.disconnect();
`;

async function fixture(t,label) {
  const parent=path.resolve(process.env.TRANSPORT_TEST_TEMP||'../temp');await mkdir(parent,{recursive:true});
  const root=await mkdtemp(path.join(parent,`transport-lock-${label}-`)),directory=path.join(root,'data');await mkdir(directory);
  const childFile=path.join(root,'starter.mjs');await writeFile(childFile,childSource);
  const children=[];
  t.after(async()=>{
    await Promise.all(children.map(async child=>{
      if(child.process.exitCode===null&&child.process.signalCode===null){child.send('continue-stale');child.send('continue-claim');child.send('continue-unlink');child.send('release');child.send('exit');}
      await Promise.race([child.exited,new Promise(resolve=>{const timer=setTimeout(()=>{child.process.kill();resolve();},1000);timer.unref();})]);
      await child.exited;
    }));
    assert(root.startsWith(parent+path.sep));await rm(root,{recursive:true,force:true});
  });
  function starter(moduleUrl=fixedModule,gate='stale') {
    const process=fork(childFile,[directory,moduleUrl,label,gate],{stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
    const messages=[],listeners=new Set();let stderr='';process.stderr.on('data',data=>{stderr+=data;});
    process.on('message',message=>{messages.push(message);for(const check of listeners)check();});
    const exited=new Promise(resolve=>process.once('exit',(code,signal)=>resolve({code,signal})));
    const wait=types=>new Promise((resolve,reject)=>{
      types=Array.isArray(types)?types:[types];
      const check=()=>{const value=messages.find(message=>types.includes(message.type));if(value){clearTimeout(timer);listeners.delete(check);resolve(value);}};
      const timer=setTimeout(()=>{listeners.delete(check);reject(new Error(`Child wait ${types} timed out: ${JSON.stringify(messages)} ${stderr}`));},10000);
      listeners.add(check);check();
    });
    const child={process,messages,exited,wait,send:message=>{if(process.connected)process.send(message,()=>{});}};children.push(child);return child;
  }
  return {root,directory,starter,label,lock:path.join(directory,'service.lock'),claim:path.join(directory,'service.lock.recovery')};
}
async function deadPid() {
  for(let attempt=0;attempt<4;attempt++){
    const child=spawn(process.execPath,['-e','process.exit(0)'],{stdio:'ignore',windowsHide:true});
    await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    try{process.kill(child.pid,0);}catch(error){if(error.code==='ESRCH')return child.pid;throw error;}
  }
  throw new Error('Cannot establish an exited child PID');
}
async function race(t,moduleUrl,expected,label) {
  const f=await fixture(t,label);
  if(!moduleUrl){const file=path.join(f.root,'unsafe-store.mjs');await writeFile(file,unsafeStore);moduleUrl=pathToFileURL(file).href;}
  const stale={pid:await deadPid(),token:label};await writeFile(f.lock,JSON.stringify(stale));
  const contenders=[f.starter(moduleUrl),f.starter(moduleUrl)];
  await Promise.all(contenders.map(child=>child.wait('ready')));contenders.forEach(child=>child.send('start'));
  const first=await Promise.all(contenders.map(child=>child.wait(['stale-read','rejected','acquired'])));
  assert(first.some(message=>message.type==='stale-read'),'the labelled stale lock must actually be read');
  for(let index=0;index<contenders.length;index++)if(first[index].type==='stale-read'){
    contenders[index].send('continue-stale');await contenders[index].wait(['acquired','rejected']);
  }
  const results=await Promise.all(contenders.map(child=>child.wait(['acquired','rejected'])));
  const winners=contenders.filter((_,index)=>results[index].type==='acquired');assert.equal(winners.length,expected);
  // Nobody is allowed to exit/close before all contenders have made their claim.
  for(const winner of winners){assert.equal(winner.process.exitCode,null);process.kill(winner.process.pid,0);assert(!winner.messages.some(message=>message.type==='released'));}
  const owner=JSON.parse(await readFile(f.lock,'utf8'));assert(winners.some(child=>child.process.pid===owner.pid));
  if(expected===1){assert.equal(results.filter(message=>message.type==='rejected').length,1);assert.equal((await readdir(f.directory)).includes('service.lock.recovery'),false);}
  t.diagnostic(`${label}: ${winners.length} simultaneous held writers; stale PID ${stale.pid}; service owner ${owner.pid}`);
  for(const winner of winners){winner.send('release');await winner.wait(['released','release-rejected']);}
  contenders.forEach(child=>child.send('exit'));await Promise.all(contenders.map(child=>child.exited));
}

test('retained negative control: old stale reclaim admits two real held child writers',{timeout:20000},async t=>race(t,null,2,'negative-stale-owner'));
test('exclusive recovery claim admits only one real held child writer from a stale lock',{timeout:20000},async t=>race(t,fixedModule,1,'fixed-stale-owner'));

test('recovery rereads a replacement live owner and preserves its exact bytes',{timeout:15000},async t=>{
  const f=await fixture(t,'replacement-live-owner');
  await writeFile(f.lock,JSON.stringify({pid:await deadPid(),token:f.label}));
  const child=f.starter(fixedModule,'claim');await child.wait('ready');child.send('start');await child.wait('before-claim');
  const replacement=JSON.stringify({pid:process.pid,token:'foreign-live-owner'});await writeFile(f.lock,replacement);
  child.send('continue-claim');const rejected=await child.wait('rejected');assert.match(rejected.message,/already in use/);assert.equal(await readFile(f.lock,'utf8'),replacement);
  assert(!(await readdir(f.directory)).includes('service.lock.recovery'));child.send('exit');await child.exited;
});

test('close preserves a foreign service lock and releases only its own recovery claim',{timeout:15000},async t=>{
  const f=await fixture(t,'foreign-on-close'),child=f.starter();await child.wait('ready');child.send('start');await child.wait('acquired');
  const foreign=JSON.stringify({pid:process.pid,token:'foreign-service-lock'});await writeFile(f.lock,foreign);
  child.send('release');assert.match((await child.wait('release-rejected')).message,/ownership changed/);assert.equal(await readFile(f.lock,'utf8'),foreign);
  assert(!(await readdir(f.directory)).includes('service.lock.recovery'));child.send('exit');await child.exited;
});

test('ambiguous recovery claims are preserved even for a dead PID or missing service lock',async t=>{
  const f=await fixture(t,'ambiguous-claim');
  for(const bytes of ['{broken',JSON.stringify({pid:process.pid,token:'live-claim'}),JSON.stringify({pid:await deadPid(),token:'abandoned-claim'})]){
    await writeFile(f.claim,bytes);await assert.rejects(createRoomStore(f.directory),/recovery is pending/);assert.equal(await readFile(f.claim,'utf8'),bytes);assert(!(await readdir(f.directory)).includes('service.lock'));
  }
});

test('malformed, unlabelled and non-file service locks are preserved without recovery',async t=>{
  const f=await fixture(t,'invalid-service');
  for(const bytes of ['', '{broken',JSON.stringify({pid:await deadPid()}),JSON.stringify({pid:0,token:'invalid'}),JSON.stringify({pid:2147483648,token:'invalid'})]){
    await writeFile(f.lock,bytes);await assert.rejects(createRoomStore(f.directory));assert.equal(await readFile(f.lock,'utf8'),bytes);assert(!(await readdir(f.directory)).includes('service.lock.recovery'));
  }
  await rm(f.lock);await mkdir(f.lock);await assert.rejects(createRoomStore(f.directory),/Unsafe/);assert((await readdir(f.directory)).includes('service.lock'));
});

test('close can retry claim contention and releases neither foreign claim nor foreign live PID',async t=>{
  const f=await fixture(t,'close-contention'),store=await createRoomStore(f.directory),original=await readFile(f.lock,'utf8');
  const foreign=JSON.stringify({pid:process.pid,token:'foreign-recovery-claim'});await writeFile(f.claim,foreign);
  await assert.rejects(store.close(),/recovery is pending/);assert.equal(await readFile(f.claim,'utf8'),foreign);assert.equal(await readFile(f.lock,'utf8'),original);
  // The fixture's parent owns this artificial claim and acknowledges its release.
  await rm(f.claim);await Promise.all([store.close(),store.close()]);assert(!(await readdir(f.directory)).includes('service.lock'));await store.close();
});

test('stale observation cannot unlink a live replacement installed while the claim is held',{timeout:15000},async t=>{
  const f=await fixture(t,'replaced-under-claim');await writeFile(f.lock,JSON.stringify({pid:await deadPid(),token:f.label}));
  const child=f.starter();await child.wait('ready');child.send('start');await child.wait('stale-read');
  const foreign=JSON.stringify({pid:process.pid,token:'live-replacement-under-claim'});await writeFile(f.lock,foreign);child.send('continue-stale');
  assert.match((await child.wait('rejected')).message,/ownership changed/);assert.equal(await readFile(f.lock,'utf8'),foreign);assert(!(await readdir(f.directory)).includes('service.lock.recovery'));
  child.send('exit');await child.exited;
});

test('recovery release detects a foreign replacement claim and preserves it',{timeout:15000},async t=>{
  const f=await fixture(t,'foreign-claim-on-release');await writeFile(f.lock,JSON.stringify({pid:await deadPid(),token:f.label}));
  const child=f.starter();await child.wait('ready');child.send('start');await child.wait('stale-read');
  const foreign=JSON.stringify({pid:process.pid,token:'foreign-claim-keep-evidence'});await writeFile(f.claim,foreign);child.send('continue-stale');
  assert.match((await child.wait('rejected')).message,/ownership changed/);assert.equal(await readFile(f.claim,'utf8'),foreign);assert(!child.messages.some(message=>message.type==='acquired'));
  child.send('exit');await child.exited;
});
