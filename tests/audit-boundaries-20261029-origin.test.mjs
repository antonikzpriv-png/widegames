import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,lstat,readdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {validatePublicOrigin} from '../server/origin.mjs';
import {loadConfig} from '../server/config.mjs';
import {createGameServer} from '../server/transport.mjs';

const temporary=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url));
const invalidOrigins=[
  null,undefined,'',false,{},'null','file:///origin-fixture','data:text/plain,origin-fixture','javascript:void(0)','ftp://example.invalid','ws://example.invalid',
  'not-a-url','//example.invalid','https:example.invalid','https:///example.invalid','http://','https://example.invalid:65536',
  'https://origin-user:origin-secret@example.invalid','https://origin-user@example.invalid','https://:origin-secret@example.invalid','https://@example.invalid',
  'https://example.invalid?origin-secret','https://example.invalid/?','https://example.invalid#origin-secret','https://example.invalid/#',
  'https://example.invalid/path','https://example.invalid/path/..','https://example.invalid/.','https://example.invalid/%2e','https://example.invalid/..','https://example.invalid//',
  ' https://example.invalid','https://example.invalid ','https://exam\nple.invalid','https://example.invalid\\',
];
const validOrigins=[
  ['http://localhost:3000','http://localhost:3000'],['HTTP://LOCALHOST:3000/','http://localhost:3000'],['http://localhost:80/','http://localhost'],
  ['HTTPS://Proxy.Example:443/','https://proxy.example'],['https://proxy.example:8443/','https://proxy.example:8443'],
  ['http://127.0.0.1:3000/','http://127.0.0.1:3000'],['http://[::1]:8080/','http://[::1]:8080'],['https://[2001:db8::1]:443/','https://[2001:db8::1]'],
];
function setupError(error){assert(error instanceof Error);assert.match(error.message,/PUBLIC_ORIGIN/);assert.match(error.message,/http:\/\/localhost:3000/);assert.match(error.message,/https:\/\/game\.example/);assert(!String(error.stack).includes('origin-secret'));assert.equal(error.cause,undefined);return true;}
async function fixture(t,label){await mkdir(temporary,{recursive:true});const directory=await mkdtemp(path.join(temporary,`audit-boundaries-origin-${label}-`)),closers=[];t.after(async()=>{for(const close of closers)await close();assert(path.resolve(directory).startsWith(path.resolve(temporary)+path.sep));await rm(directory,{recursive:true,force:true});});return {directory,closers};}
function post(port,Origin){return new Promise((resolve,reject)=>{const body=JSON.stringify({mode:'human'}),req=http.request({host:'127.0.0.1',port,path:'/api/rooms',method:'POST',headers:{Origin,'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(Buffer.concat(chunks).toString())}));});req.on('error',reject);req.end(body);});}

test('origin helper and loadConfig reject unsafe origin forms with useful non-secret setup errors',()=>{
  for(const value of invalidOrigins){
    assert.throws(()=>validatePublicOrigin(value),setupError);
    // Missing/empty environment values retain the established default; direct startup requires a value.
    if(value!==undefined&&value!=='')assert.throws(()=>loadConfig({PUBLIC_ORIGIN:value}),setupError);
  }
  assert.equal(loadConfig({}).publicOrigin,'http://localhost:3000');assert.equal(loadConfig({PUBLIC_ORIGIN:''}).publicOrigin,'http://localhost:3000');
});

test('valid localhost, proxy, IPv6, trailing slash and default-port origins canonicalize without altering budgets',()=>{
  for(const [value,expected] of validOrigins){
    assert.equal(validatePublicOrigin(value),expected);
    const env={PUBLIC_ORIGIN:value,MAX_AI_CALLS:'17',MAX_AI_TOKENS:'12001',MAX_AI_COST_USD:'0.25',MAX_DAILY_AI_COST_USD:'2',MAX_ACTIVE_ROOMS:'3'};
    const config=loadConfig(env);assert.equal(config.publicOrigin,expected);assert.equal(config.maxActiveRooms,3);assert.equal(config.ai.maxCalls,17);assert.equal(config.ai.maxTokens,12001);assert.equal(config.ai.maxCostUsd,.25);assert.equal(config.ai.maxDailyCostUsd,2);
  }
});

test('direct createGameServer rejects every unsafe form before dependencies or storage are touched',async t=>{
  const {directory}=await fixture(t,'pre-storage'),untouched=path.join(directory,'must-not-be-created');let accessed=0;
  const dependencies=Object.fromEntries(['engine','aiController','store','dailyBudget'].map(key=>[key,undefined]));
  for(const key of Object.keys(dependencies))Object.defineProperty(dependencies,key,{get(){accessed++;throw new Error('dependency accessed before validation');}});
  for(const publicOrigin of invalidOrigins){await assert.rejects(createGameServer({publicOrigin,dataDir:untouched},dependencies),setupError);assert.equal(accessed,0);await assert.rejects(lstat(untouched),error=>error.code==='ENOENT');}
});

test('direct validation preserves labelled pre-existing budget and lock evidence',async t=>{
  const {directory}=await fixture(t,'existing-data'),labels={'service.lock':'foreign-lock-label','service.lock.recovery':'foreign-recovery-label','ai-daily-budget.json':'private-budget-label'};
  for(const [name,bytes] of Object.entries(labels))await writeFile(path.join(directory,name),bytes);
  await assert.rejects(createGameServer({publicOrigin:'https://origin-user:origin-secret@example.invalid',dataDir:directory}),setupError);
  assert.deepEqual((await readdir(directory)).sort(),Object.keys(labels).sort());for(const [name,bytes] of Object.entries(labels))assert.equal(await readFile(path.join(directory,name),'utf8'),bytes);
});

test('direct startup enforces canonical origins for localhost HTTP and HTTPS proxy cookies',async t=>{
  const {directory,closers}=await fixture(t,'canonical-http');
  const aiController={describe:()=>({mode:'demo',provider:'origin-test-stub'}),decide:async()=>null};
  for(const [index,[publicOrigin,expected]] of validOrigins.entries()){
    const game=await createGameServer({publicOrigin,dataDir:path.join(directory,String(index)),ai:{provider:'demo'}},{aiController});closers.push(()=>game.close());
    game.server.listen(0,'127.0.0.1');await new Promise(resolve=>game.server.once('listening',resolve));const port=game.server.address().port;
    assert.equal((await post(port,'null')).status,403);assert.equal((await post(port,'https://foreign.invalid')).status,403);
    const accepted=await post(port,expected);assert.equal(accepted.status,201);assert.equal(accepted.body.seatId,'p1');assert.equal(accepted.headers['set-cookie'][0].includes('; Secure'),expected.startsWith('https:'));
    await game.close();
  }
});
