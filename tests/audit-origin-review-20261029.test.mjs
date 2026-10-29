/** Independent PUBLIC_ORIGIN review; optional override selects an exact archived revision. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readdir,readFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {inspect} from 'node:util';

const root=process.env.ORIGIN_REVIEW_ROOT||fileURLToPath(new URL('../',import.meta.url));
const {loadConfig}=await import(pathToFileURL(path.join(root,'server/config.mjs')));
const {createGameServer}=await import(pathToFileURL(path.join(root,'server/transport.mjs')));
const {WebSocket}=createRequire(path.join(root,'package.json'))('ws');
const temp=path.resolve('D:/Widegames-work/temp');
const userMarker='origin-review-synthetic-user',secretMarker='origin-review-synthetic-password',providerMarker='origin-review-synthetic-provider-key';
const stub={describe:()=>({mode:'demo',provider:'review-stub',calls:0,tokens:0,costUsd:0}),async decide(){return null;}};
const invalid=[
 ['opaque-file','file:///D:/origin-review-fixture'],['opaque-data','data:text/plain,fixture'],['opaque-about','about:blank'],['literal-null','null'],
 ['websocket','ws://localhost:3000'],['secure-websocket','wss://example.test'],['ftp','ftp://example.test'],
 ['userinfo',`http://${userMarker}:${secretMarker}@localhost:3000`],['username-only',`https://${userMarker}@example.test`],
 ['userinfo-invalid-port',`http://${userMarker}:${secretMarker}@localhost:999999`],
 ['path','https://example.test/nested'],['query','https://example.test/?fixture=1'],['fragment','https://example.test/#fixture'],['malformed','not-a-valid-origin']
];
const valid=[
 ['http://localhost','http://localhost'],['http://localhost/','http://localhost'],['http://localhost:80/','http://localhost'],
 ['http://localhost:3000/','http://localhost:3000'],['http://127.0.0.1:0/','http://127.0.0.1:0'],
 ['https://example.test','https://example.test'],['https://example.test/','https://example.test'],['https://example.test:443/','https://example.test'],
 ['https://example.test:8443/','https://example.test:8443'],['http://[::1]:3000/','http://[::1]:3000']
];
async function fixture(t,label){const directory=await mkdtemp(path.join(temp,`audit-origin-review-${label}-`));const closes=[];t.after(async()=>{try{for(const close of closes.reverse())await close();}finally{const rel=path.relative(temp,directory);assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));await rm(directory,{recursive:true,force:true});}});return {directory,closes};}
function config(directory,publicOrigin){return {...loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:'http://localhost:3000',AI_PROVIDER:'demo'}),publicOrigin,tickMs:600000};}
async function running(f,c){const game=await createGameServer(c,{aiController:stub});f.closes.push(()=>game.close());await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));return {game,port:game.server.address().port};}
function request(port,url,{method='GET',origin,body,headers={}}={}){return new Promise((resolve,reject)=>{
 const data=body===undefined?undefined:JSON.stringify(body);const req=http.request({host:'127.0.0.1',port,path:url,method,headers:{...(origin===undefined?{}:{Origin:origin}),...headers,...(data===undefined?{}:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.setTimeout(5000,()=>req.destroy(new Error('Review HTTP timeout')));req.end(data);
});}
async function socket(port,route,cookie,origin){return new Promise((resolve,reject)=>{
 const ws=new WebSocket(`ws://127.0.0.1:${port}${route}`,{headers:{Cookie:cookie,...(origin===undefined?{}:{Origin:origin})}});let settled=false;
 const timer=setTimeout(()=>{ws.terminate();reject(new Error('Review socket timeout'));},5000);
 const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
 ws.on('error',error=>{if(!settled){clearTimeout(timer);reject(error);}});
 ws.on('unexpected-response',(_,res)=>{res.resume();finish(res.statusCode);ws.terminate();});
 ws.on('open',()=>{ws.close();});ws.on('close',()=>{if(!settled)finish(101);});
});}
async function until(predicate,timeout=10000){const end=Date.now()+timeout;while(!predicate()&&Date.now()<end)await new Promise(r=>setTimeout(r,10));assert.ok(predicate(),'Review child did not start or exit within bound');}
async function cli(f,publicOrigin,label){
 const directory=path.join(f.directory,label),env=Object.fromEntries(Object.entries({PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,COMSPEC:process.env.COMSPEC,PATHEXT:process.env.PATHEXT,TEMP:temp,TMP:temp,npm_config_cache:'D:/Widegames-work/npm-cache'}).filter(([,value])=>value!==undefined));
 Object.assign(env,{HOST:'127.0.0.1',PORT:'0',DATA_DIR:directory,PUBLIC_ORIGIN:publicOrigin,AI_PROVIDER:'demo',ANTHROPIC_API_KEY:providerMarker});
 const script=`process.on('message',message=>{if(message==='stop'){process.disconnect();process.emit('SIGTERM');}});await import(${JSON.stringify(pathToFileURL(path.join(root,'server/main.mjs')).href)});`;
 const child=spawn(process.execPath,['--input-type=module','--eval',script],{cwd:root,env,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);
 const exited=new Promise((resolve,reject)=>{child.once('exit',(code,signal)=>resolve({code,signal}));child.once('error',reject);});
 f.closes.push(async()=>{if(child.connected)child.send('stop',()=>{});const timer=setTimeout(()=>child.kill(),3000);try{await exited;}finally{clearTimeout(timer);}});
 await until(()=>child.exitCode!==null||stdout.includes('Listening on'));
 return {child,directory,get stdout(){return stdout;},get stderr(){return stderr;},get port(){return Number(/Listening on 127\.0\.0\.1:(\d+)/.exec(stdout)?.[1])||null;},exited};
}

test('loadConfig rejects 14 non-origin/credential-bearing values without disclosing their input',()=>{
 const failures=[];
 for(const [label,value]of invalid){let error;try{loadConfig({PUBLIC_ORIGIN:value,DATA_DIR:temp});}catch(e){error=e;}
  if(!error)failures.push({label,accepted:true});else if([userMarker,secretMarker].some(marker=>inspect(error).includes(marker)))failures.push({label,unsafeError:true});
 }
 assert.deepEqual(failures,[],'PUBLIC_ORIGIN environment validation must reject invalid forms with safe errors');
});

test('direct constructor rejects invalid origin before reading storage or budget dependencies',async t=>{
 const f=await fixture(t,'constructor-invalid'),failures=[];
 for(const [label,value]of [...invalid,['undefined',undefined],['number',123],['object',{}],['empty','']]){
  const directory=path.join(f.directory,label);await mkdir(directory);let storeReads=0,budgetReads=0,error,game;
  const dependencies={aiController:stub,get store(){storeReads++;return undefined;},get dailyBudget(){budgetReads++;return {async reserve(){}};}};
  try{game=await createGameServer(config(directory,value),dependencies);}catch(e){error=e;}finally{await game?.close();}
  const files=await readdir(directory),unsafeError=error&&[userMarker,secretMarker].some(marker=>inspect(error).includes(marker));
  if(!error||storeReads||budgetReads||files.length||unsafeError)failures.push({label,rejected:!!error,storeReads,budgetReads,files,unsafeError:!!unsafeError});
 }
 assert.deepEqual(failures,[],'Invalid origins must fail before any storage lock/budget boundary');
});

test('ten valid HTTP(S) origin forms support canonical browser origins and preserve secure cookies',async t=>{
 const f=await fixture(t,'valid-matrix');
 for(let i=0;i<valid.length;i++){
  const [raw,canonical]=valid[i],directory=path.join(f.directory,String(i));const loaded=loadConfig({DATA_DIR:directory,PUBLIC_ORIGIN:raw});assert.equal(new URL(loaded.publicOrigin).origin,canonical);
  // Raw override independently exercises constructor normalization as well as loadConfig.
  const {port}=await running(f,{...loaded,publicOrigin:raw,tickMs:600000});
  const made=await request(port,'/api/rooms',{method:'POST',origin:canonical,body:{mode:'human'}});assert.equal(made.status,201,raw);assert.equal(made.headers['set-cookie'][0].includes('; Secure'),canonical.startsWith('https:'));
  for(const wrong of [undefined,'null',canonical+'/',canonical+'.attacker.test']){const denied=await request(port,'/api/rooms',{method:'POST',origin:wrong,body:{mode:'human'}});assert.equal(denied.status,403,`${raw}: wrong ${String(wrong)}`);}
  assert.equal((await request(port,'/api/rooms',{method:'POST',origin:canonical,body:{mode:'human'},headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
 }
});

test('ordinary unset-origin defaults remain localhost with configured ports',()=>{
 assert.equal(new URL(loadConfig({}).publicOrigin).origin,'http://localhost:3000');
 assert.equal(new URL(loadConfig({PORT:'0'}).publicOrigin).origin,'http://localhost:0');
 assert.equal(new URL(loadConfig({PORT:'8080'}).publicOrigin).origin,'http://localhost:8080');
});

test('WebSocket authorization still requires exact canonical origin and authenticated room cookie',async t=>{
 const f=await fixture(t,'websocket'),{port}=await running(f,config(f.directory,'https://example.test:443/'));
 const made=await request(port,'/api/rooms',{method:'POST',origin:'https://example.test',body:{mode:'spectator'}});assert.equal(made.status,201);
 const route='/api/rooms/'+JSON.parse(made.text).roomId+'/socket',cookie=made.headers['set-cookie'][0].split(';')[0];
 assert.equal(await socket(port,route,cookie,'https://example.test'),101);
 for(const wrong of [undefined,'null','https://example.test/','https://example.test:443','http://example.test','https://example.test.attacker.test'])assert.equal(await socket(port,route,cookie,wrong),403);
 assert.equal(await socket(port,route,'lw_wrongroom=synthetic','https://example.test'),401);
});

test('real CLI rejects userinfo origins without logging synthetic URL or provider credentials',async t=>{
 const f=await fixture(t,'cli-invalid'),failures=[];
 for(const [label,raw]of invalid.filter(([label])=>label==='userinfo'||label==='userinfo-invalid-port')){
  const child=await cli(f,raw,label);const output=child.stdout+child.stderr;
  const leaked=[userMarker,secretMarker,providerMarker].filter(marker=>output.includes(marker));let files=[];try{files=await readdir(child.directory);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(child.port||leaked.length||files.length||child.child.exitCode===0)failures.push({label,listened:!!child.port,leaked:leaked.map((_,i)=>`synthetic-marker-${i}`),files,exitCode:child.child.exitCode});
 }
 assert.deepEqual(failures,[],'Invalid PUBLIC_ORIGIN must reject safely before startup/logging');
});

test('real CLI accepts HTTPS root/default-port origin and keeps provider marker out of logs/health',async t=>{
 const f=await fixture(t,'cli-valid'),child=await cli(f,'https://example.test:443/','state');assert.ok(child.port,child.stderr);
 const health=await request(child.port,'/api/health',{origin:'https://example.test'});assert.equal(health.status,200);
 for(const output of [child.stdout,child.stderr,health.text])assert.equal(output.includes(providerMarker),false);
});

test('opaque origin cannot mint a room using Origin null; cross-site protection must remain intact',async t=>{
 const f=await fixture(t,'opaque-null');let service;
 try{service=await running(f,config(f.directory,'file:///D:/origin-review-null-fixture'));}catch(error){assert.match(error.message,/origin|URL/i);assert.deepEqual(await readdir(f.directory),[]);return;}
 const crossSite=await request(service.port,'/api/rooms',{method:'POST',origin:'null',body:{mode:'human'},headers:{'Sec-Fetch-Site':'cross-site'}});assert.equal(crossSite.status,403);
 const result=await request(service.port,'/api/rooms',{method:'POST',origin:'null',body:{mode:'human'}});assert.notEqual(result.status,201,'Invalid opaque PUBLIC_ORIGIN must not authorize null-origin room creation');
});
