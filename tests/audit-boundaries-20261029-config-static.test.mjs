import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm,cp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {loadConfig} from '../server/config.mjs';
import {serveStatic} from '../server/static.mjs';
import {createGameServer} from '../server/transport.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),temporary='D:/Widegames-work/temp',cache='D:/Widegames-work/npm-cache';
const origin='http://boundary-audit.test';
const resources=new WeakMap();
const stub={describe:()=>({mode:'demo',provider:'boundary-stub'}),decide:async()=>null};
async function fixture(t,label){await mkdir(temporary,{recursive:true});const directory=await mkdtemp(path.join(temporary,`audit-boundaries-${label}-`));resources.set(t,[]);t.after(async()=>{for(const close of resources.get(t))await close();assert(path.resolve(directory).startsWith(path.resolve(temporary)+path.sep));await rm(directory,{recursive:true,force:true});});return directory;}
async function running(t,config){const game=await createGameServer(config,{aiController:stub});game.server.listen(0,'127.0.0.1');await new Promise(resolve=>game.server.once('listening',resolve));resources.get(t).push(()=>game.close());return {game,port:game.server.address().port};}
function request(port,url,{method='GET',body,Origin=origin,chunked=false,headers={}}={}){return new Promise((resolve,reject)=>{
  const data=body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body);
  const req=http.request({host:'127.0.0.1',port,path:url,method,headers:{Origin,...headers,...(data===undefined?{}:{'content-type':'application/json',...(chunked?{'transfer-encoding':'chunked'}:{'content-length':Buffer.byteLength(data)})})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.end(data);
});}
function environment(){return Object.fromEntries(Object.entries({PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,COMSPEC:process.env.COMSPEC,PATHEXT:process.env.PATHEXT,TEMP:temporary,TMP:temporary,npm_config_cache:cache}).filter(([,value])=>value!==undefined));}
async function launch(t,directory,publicOrigin,runtimeRoot=root){
  const dataDir=path.join(directory,'private-data'),envFile=path.join(directory,'synthetic.env');
  await writeFile(envFile,`HOST=127.0.0.1\nPORT=0\nDATA_DIR=${dataDir.replaceAll('\\','/')}\nPUBLIC_ORIGIN=${publicOrigin}\nAI_PROVIDER=demo\nANTHROPIC_API_KEY=audit-provider-key-never-log\n`,{mode:0o600});
  const script=`process.on('message',message=>{if(message==='stop'){process.disconnect();process.emit('SIGTERM');}});await import(${JSON.stringify(pathToFileURL(path.join(runtimeRoot,'server/main.mjs')).href)});`;
  const child=spawn(process.execPath,[`--env-file=${envFile}`,'--input-type=module','--eval',script],{cwd:runtimeRoot,env:environment(),stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  let stdout='',stderr='';child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
  resources.get(t).push(async()=>{if(child.connected)child.send('stop',()=>{});const timer=setTimeout(()=>child.kill(),3000);try{await exited;}finally{clearTimeout(timer);}});
  const end=Date.now()+3000;while(!stdout.includes('Listening on')&&child.exitCode===null&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,10));
  const found=/Listening on 127\.0\.0\.1:(\d+)/.exec(stdout);
  return {child,exited,dataDir,get stdout(){return stdout;},get stderr(){return stderr;},port:found?Number(found[1]):null};
}

test('config counterexamples remain within numeric room/token/call/cost bounds',()=>{
  for(const [name,bad] of Object.entries({PORT:['-1','65536','1.5','NaN','Infinity'],MAX_ACTIVE_ROOMS:['0','101','1.5','NaN'],MAX_AI_CALLS:['-1','501','1.5','Infinity'],MAX_AI_TOKENS:['-1','250001','NaN'],MAX_AI_COST_USD:['-0.01','10.01','NaN','Infinity'],MAX_DAILY_AI_COST_USD:['-0.01','100.01','NaN','Infinity']}))for(const value of bad)assert.throws(()=>loadConfig({[name]:value}),new RegExp(name));
  const c=loadConfig({PORT:'0',MAX_ACTIVE_ROOMS:'1e2',MAX_AI_CALLS:'0',MAX_AI_TOKENS:'0',MAX_AI_COST_USD:'0',MAX_DAILY_AI_COST_USD:'0'});assert.equal(c.port,0);assert.equal(c.maxActiveRooms,100);assert.equal(c.ai.maxCostUsd,0);assert.equal(c.ai.maxDailyCostUsd,0);
});

test('FINDING B01: an opaque PUBLIC_ORIGIN must not authorize Origin null clients',async t=>{
  const directory=await fixture(t,'opaque-origin');let config,service;
  try{config=loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:'file:///D:/audit-origin-fixture'});service=await running(t,config);}catch(error){assert.match(error.message,/origin|URL/i);return;}
  const result=await request(service.port,'/api/rooms',{method:'POST',body:{mode:'human'},Origin:'null'});
  t.diagnostic(`Opaque origin maps to ${new URL(config.publicOrigin).origin}; Origin:null create returned ${result.status}`);
  const crossSite=await request(service.port,'/api/rooms',{method:'POST',body:{mode:'human'},Origin:'null',headers:{'sec-fetch-site':'cross-site'}});assert.equal(crossSite.status,403,'Cross-site fetch protection remains effective');
  assert.notEqual(result.status,201,'Opaque origins must be rejected during startup or authorization, not mint authenticated rooms');
});

test('FINDING B02: CLI must not log credentials embedded in PUBLIC_ORIGIN',async t=>{
  const directory=await fixture(t,'origin-log'),cli=await launch(t,directory,'http://audit-user:origin-userinfo-fixture-secret@127.0.0.1:0');
  assert(!cli.stdout.includes('audit-provider-key-never-log'));assert(!cli.stderr.includes('audit-provider-key-never-log'));
  t.diagnostic(`Synthetic userinfo accepted: ${Boolean(cli.port)}; userinfo secret in stdout: ${cli.stdout.includes('origin-userinfo-fixture-secret')}`);
  assert(!cli.stdout.includes('origin-userinfo-fixture-secret'),'Reject credential-bearing PUBLIC_ORIGIN or log only its validated origin');
});

test('documented env-file CLI boots with production-only dependencies and excludes provider keys from health/static/logs',async t=>{
  const directory=await fixture(t,'cli-demo'),production=path.join(directory,'production-image-fixture');await mkdir(production);
  for(const entry of ['server','shared','public','package.json','package-lock.json'])await cp(path.join(root,entry),path.join(production,entry),{recursive:true});
  const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  const install=spawnSync(process.execPath,[npmCli,'ci','--omit=dev','--offline','--ignore-scripts','--no-audit','--no-fund'],{cwd:production,env:environment(),encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(install.status,0,install.stderr||install.error?.message);
  const cli=await launch(t,directory,'http://localhost:3000',production);assert(cli.port,cli.stderr);
  const health=await request(cli.port,'/api/health',{Origin:'http://localhost:3000'});assert.equal(health.status,200);
  const home=await request(cli.port,'/',{Origin:'http://localhost:3000'});assert.equal(home.status,200);
  for(const text of [health.text,home.text,cli.stdout,cli.stderr])assert(!text.includes('audit-provider-key-never-log'));
  cli.child.send('stop');const stopped=await cli.exited;assert.equal(stopped.code,0);assert(!(await readdir(cli.dataDir)).includes('service.lock'));assert(!(await readdir(cli.dataDir)).includes('service.lock.recovery'));
  const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
  assert.deepEqual(Object.entries(lock.packages).filter(([name,value])=>name.startsWith('node_modules/')&&!value.dev).map(([name])=>name),['node_modules/ws']);
  assert.throws(()=>createRequire(pathToFileURL(path.join(production,'package.json'))).resolve('puppeteer-core'));
  assert.deepEqual((await readdir(path.join(production,'node_modules'))).filter(name=>!name.startsWith('.')),['ws']);
});

test('static raw-path traversal probes and inline policy remain denied without a browser',async t=>{
  const server=http.createServer(serveStatic);server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));const port=server.address().port;
  for(const raw of ['/server/main.mjs','/.env','/.git/config','/data/ai-daily-budget.json','/node_modules/ws/lib/websocket.js','/shared/%2e%2e%2fserver/config.mjs','/shared/%2e%2e%5cserver%5cconfig.mjs','/..%5cserver%5cconfig.mjs','/%2e%2e%2fpackage-lock.json','/shared/contracts.mjs%00','/shared/%252e%252e%252fserver/config.mjs','/%ZZ']){
    const response=await request(port,raw);assert([400,404].includes(response.status),`${raw}: ${response.status}`);assert(!response.text.includes('ANTHROPIC_API_KEY'));
  }
  for(const raw of ['/','/r/fixture-audit','/shared/contracts.mjs','/app.mjs']){const response=await request(port,raw);assert.equal(response.status,200,raw);assert.equal(response.headers['x-content-type-options'],'nosniff');const csp=response.headers['content-security-policy'];for(const directive of ["script-src 'self'","connect-src 'self'","frame-ancestors 'none'","base-uri 'none'","form-action 'self'"])assert(csp.includes(directive));assert(!csp.includes('unsafe-inline'));assert(!csp.includes('unsafe-eval'));}
  const head=await request(port,'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.text,'');assert.equal((await request(port,'/',{method:'POST',body:{}})).status,405);
});

test('self-check: configured active-room ceiling wins under simultaneous creates',async t=>{
  const directory=await fixture(t,'room-cap'),{port}=await running(t,loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:origin,MAX_ACTIVE_ROOMS:'2'}));
  const results=await Promise.all(Array.from({length:3},()=>request(port,'/api/rooms',{method:'POST',body:{mode:'spectator'}})));assert.equal(results.filter(result=>result.status===201).length,2);assert.equal(results.filter(result=>result.status===429).length,1);
});

test('self-check: per-address creation cap prevents ninth room even with configured capacity',async t=>{
  const directory=await fixture(t,'creation-cap'),{port}=await running(t,loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:origin,MAX_ACTIVE_ROOMS:'100'}));
  for(let i=0;i<8;i++)assert.equal((await request(port,'/api/rooms',{method:'POST',body:{mode:'spectator'}})).status,201);
  assert.equal((await request(port,'/api/rooms',{method:'POST',body:{mode:'spectator'}})).status,429);
});

test('self-check: 600-request cap and streaming 8KiB cap agree with advertised boundaries',async t=>{
  const directory=await fixture(t,'http-caps'),{port}=await running(t,loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:origin}));
  const overhead=Buffer.byteLength(JSON.stringify({mode:'human',padding:''}));
  const atLimit=JSON.stringify({mode:'human',padding:'x'.repeat(8192-overhead)}),overLimit=JSON.stringify({mode:'human',padding:'x'.repeat(8193-overhead)});assert.equal(Buffer.byteLength(atLimit),8192);assert.equal(Buffer.byteLength(overLimit),8193);
  const within=await request(port,'/api/rooms',{method:'POST',body:atLimit,chunked:true});assert.equal(within.status,400);assert.equal(JSON.parse(within.text).error.code,'INVALID_ROOM');
  const oversized=await request(port,'/api/rooms',{method:'POST',body:overLimit,chunked:true});assert.equal(oversized.status,413);
  for(let i=2;i<600;i++)assert.equal((await request(port,'/api/health')).status,200,`request ${i+1}`);
  assert.equal((await request(port,'/api/health')).status,429);
});

test('self-check: invalid origin and corrupt budget startup failures preserve data and release acquired locks',async t=>{
  const directory=await fixture(t,'startup-fail'),ledger=path.join(directory,'ai-daily-budget.json');await writeFile(ledger,'audit-labelled-corrupt-ledger');
  await assert.rejects(createGameServer(loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:'not-a-valid-url'}),{aiController:stub}),/URL/);
  assert.deepEqual((await readdir(directory)).sort(),['ai-daily-budget.json']);
  await assert.rejects(createGameServer(loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:origin}),{aiController:stub}),/cannot be restored safely/);
  assert.equal(await readFile(ledger,'utf8'),'audit-labelled-corrupt-ledger');assert.deepEqual((await readdir(directory)).sort(),['ai-daily-budget.json']);
});

test('Docker static inspection matches production command boundary; actual availability is recorded',async t=>{
  const docker=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');assert(docker.includes('npm ci --omit=dev --ignore-scripts --no-audit --no-fund'));assert(docker.includes('USER node'));assert(docker.includes('AI_PROVIDER=demo'));assert(docker.includes('CMD ["node","server/main.mjs"]'));
  for(const asset of ['server','shared','public'])assert(docker.includes(`${asset} ./${asset}`));
  const result=spawnSync('docker',['version'],{encoding:'utf8',timeout:3000,windowsHide:true,env:environment()});
  t.diagnostic(JSON.stringify({command:'docker version',error:result.error?.code,status:result.status}));
  if(result.error)assert(['ENOENT','ETIMEDOUT'].includes(result.error.code));
});
