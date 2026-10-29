/** Bounded exact-archive production qualification. Run explicitly; no browser/providers. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,access,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
const pin='56c320a537d0cb2da7c5079f24bc26b9337d1f17';
const checkout=fileURLToPath(new URL('../',import.meta.url));
const artifact=path.join(checkout,'_artifacts');
const root=path.resolve(process.env.WORLD_PRODUCTION_REVIEW_ROOT||path.join(artifact,'world-production-56c320a'));
assert.ok(root.startsWith(artifact+path.sep),'Archive must remain inside this assigned checkout ignored artifacts');
const report={pin,node:process.version,checks:[],children:[],providerFetchAttempts:0,forcedStops:0};
const check=(condition,name)=>{assert.ok(condition,name);report.checks.push(name);console.log('PASS '+name);};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=data=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(await readFile(root+'-manifest.json','utf8'));assert.equal(manifest.pin,pin);
async function verifySource(){for(const entry of manifest.files)assert.equal(hash(await readFile(path.join(root,entry.file))),entry.sha256,entry.file);}
await verifySource();check(manifest.files.length===148,'All148 exact committed source blobs match immutable manifest');
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const require=createRequire(path.join(root,'package.json'));
const installed=JSON.parse(await readFile(path.join(root,'node_modules/.package-lock.json'),'utf8'));
assert.deepEqual(Object.keys(installed.packages),['node_modules/ws']);assert.equal(require('ws/package.json').version,'8.22.0');
check(require.resolve('ws').startsWith(path.join(root,'node_modules')+path.sep),'ws8.22.0 resolves from isolated production install');
await assert.rejects(access(path.join(root,'node_modules/puppeteer-core'),constants.F_OK),{code:'ENOENT'});
assert.throws(()=>require.resolve('puppeteer-core'),{code:'MODULE_NOT_FOUND'});
check(true,'Puppeteer absent; installed production graph contains only ws');
assert.equal(pkg.scripts.start,'node server/main.mjs');assert.equal(pkg.scripts.dev,'node --watch server/main.mjs');assert.match(pkg.scripts.test,/tests\/\*\.test\.mjs/);assert.equal(pkg.scripts['test:browser'],'node scripts/world-browser-check.mjs');
const browser=await readFile(path.join(root,'scripts/world-browser-check.mjs'),'utf8');assert.match(browser,/const config=loadConfig\(/);assert.match(browser,/worldVersion===1/);assert.match(await readFile(path.join(root,'server/config.mjs'),'utf8'),/worldMode:true/);
const docker=await readFile(path.join(root,'Dockerfile'),'utf8'),dockerignore=await readFile(path.join(root,'.dockerignore'),'utf8');
for(const group of ['server','shared','public']){assert.match(docker,new RegExp('COPY --chown=node:node '+group+' \\./'+group));assert.ok(!dockerignore.split(/\r?\n/).includes(group));}
assert.match(docker,/npm ci --omit=dev --ignore-scripts/);assert.match(docker,/CMD \["node","server\/main.mjs"\]/);
check(true,'Production start/Docker groups and world browser/test scripts target actual committed world');
const runtime=manifest.files.filter(entry=>/^(server|public|shared)\//.test(entry.file));
const sources=new Map(await Promise.all(runtime.map(async entry=>[entry.file,await readFile(path.join(root,entry.file),'utf8')])));
const refs=[];
for(const [file,source]of sources){
  if(!/\.mjs$/.test(file))continue;
  const specs=new Set([...source.matchAll(/\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?['"]([^'"]+)['"]/g),...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]));
  for(const spec of specs){if(spec.startsWith('node:'))continue;if(!spec.startsWith('.')){assert.equal(spec,'ws',file+' external import');continue;}const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));assert.ok(sources.has(target),file+' missing dependency '+target);refs.push({from:file,to:target});}
}
for(const file of ['server/engine/world-runtime.mjs','server/ai/world.mjs','shared/world.mjs','public/world-input-envelope.mjs',...runtime.filter(e=>e.file.startsWith('public/world/')).map(e=>e.file)])assert.ok(refs.some(ref=>ref.to===file),'New module not imported: '+file);
check(true,'All35 deployed runtime/static files and local import references are present, including every world module');
const {canSeeWorldPoint,WORLD_STATIONS,distance}=await import(pathToFileURL(path.join(root,'shared/world.mjs')));
function safe(room){
  assert.equal(room.mode,'human');assert.equal(room.ai.mode,'demo');assert.equal(room.ai.calls,0);
  for(const key of ['state','identities','aiContext'])assert.equal(Object.hasOwn(room,key),false);
  const view=room.game;assert.equal(view.worldVersion,1);for(const key of ['requests','replay','rules','schemaVersion'])assert.equal(Object.hasOwn(view,key),false);
  if(room.seatId==='p1'){assert.equal(view.self.id,'p1');assert.ok(['crew','saboteur'].includes(view.self.role));assert.ok(Number.isFinite(view.self.position.x)&&Number.isFinite(view.self.position.y));assert.ok(Number.isSafeInteger(view.self.inputSeq));}
  else assert.equal(view.self,null);
  for(const player of view.players){assert.equal(Object.hasOwn(player,'role'),false);for(const key of ['motion','tasks','destination','inputSeq'])assert.equal(Object.hasOwn(player,key),false);if(view.self&&player.id!==view.self.id&&player.position)assert.ok(canSeeWorldPoint(view.self.position,player.position));}
}
async function port(){const probe=net.createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});const value=probe.address().port;await new Promise(resolve=>probe.close(resolve));return value;}
await mkdir(artifact,{recursive:true});const data=await mkdtemp(path.join(artifact,'world-production-private-'));report.dataDir=data;
const marker='synthetic-unused-key-world-production';
const wrapper=String.raw`
  import{pathToFileURL}from'node:url';
  globalThis.fetch=()=>{process.send?.({type:'forbidden-fetch'});throw Error('External provider requests forbidden by production review');};
  process.on('message',message=>{if(message==='shutdown'){const handlers=process.listenerCount('SIGTERM');process.send({type:'shutdown-handler',handlers});if(!handlers)throw Error('main SIGTERM handler missing');process.emit('SIGTERM');process.disconnect();}});
  await import(pathToFileURL(process.env.REVIEW_MAIN));
  process.send({type:'main-loaded',handlers:process.listenerCount('SIGTERM')});
`;
let active=null,ws=null;
async function launch(){
  const number=await port(),origin='http://127.0.0.1:'+number;
  const env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:process.env.PATH,PATHEXT:process.env.PATHEXT,COMSPEC:process.env.COMSPEC,TEMP:'D:/Widegames-work/temp',TMP:'D:/Widegames-work/temp',npm_config_cache:'D:/Widegames-work/npm-cache',NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(number),PUBLIC_ORIGIN:origin,DATA_DIR:data,AI_PROVIDER:'demo',ANTHROPIC_API_KEY:marker,MAX_AI_CALLS:'0',MAX_AI_TOKENS:'0',MAX_AI_COST_USD:'0',MAX_DAILY_AI_COST_USD:'0',REVIEW_MAIN:path.join(root,'server/main.mjs')};
  const child=spawn(process.execPath,['--input-type=module','-e',wrapper],{cwd:root,env,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  const record={pid:child.pid,origin,stdout:'',stderr:'',messages:[]};report.children.push(record);
  child.stdout.on('data',bytes=>record.stdout+=bytes);child.stderr.on('data',bytes=>record.stderr+=bytes);child.on('message',message=>{record.messages.push(message);if(message.type==='forbidden-fetch')report.providerFetchAttempts++;});
  const exited=new Promise(resolve=>{child.once('error',error=>resolve({error:String(error)}));child.once('exit',(code,signal)=>resolve({code,signal}));});
  const instance={child,record,origin,exited};active=instance;
  for(let tries=0;tries<100;tries++){assert.equal(child.exitCode,null,'main exited during startup '+record.stderr);try{const response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(500)});if(response.ok)return instance;}catch{}await delay(50);}
  throw Error('Real main did not start within5s: '+record.stderr);
}
async function stop(instance){
  instance.child.send('shutdown');const timeout=Symbol('timeout');let timer;
  const ended=await Promise.race([instance.exited,new Promise(resolve=>{timer=setTimeout(()=>resolve(timeout),6000);})]);clearTimeout(timer);
  if(ended===timeout){report.forcedStops++;instance.child.kill();throw Error('main SIGTERM handler did not close within6s');}
  instance.record.exit=ended;assert.deepEqual(ended,{code:0,signal:null});assert.ok(instance.record.messages.some(m=>m.type==='shutdown-handler'&&m.handlers===1));
  assert.equal(instance.record.stdout.includes(marker)||instance.record.stderr.includes(marker),false,'Credential marker logged');assert.equal(instance.record.stderr,'');
  await assert.rejects(access(path.join(data,'service.lock')),{code:'ENOENT'});await assert.rejects(access(path.join(data,'service.lock.recovery')),{code:'ENOENT'});active=null;
}
async function request(instance,route,{method='GET',body,cookie,origin=instance.origin}={}){
  const response=await fetch(instance.origin+route,{method,headers:{...(method==='POST'?{'content-type':'application/json',origin}:{}),...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(4000)});
  const bytes=Buffer.from(await response.arrayBuffer()),text=bytes.toString('utf8');assert.equal(text.includes(marker),false);let value;try{value=JSON.parse(text);}catch{}return{response,text,value,bytes};
}
try{
  const first=await launch();const health=await request(first,'/api/health');assert.deepEqual(health.value,{ok:true,game:'Lantern Wake',protocol:1});check(true,'Real main health is ready and contains no room/private metadata');
  const lock=JSON.parse(await readFile(path.join(data,'service.lock'),'utf8'));assert.equal(lock.pid,first.child.pid);check(true,'Real main owns only isolated private DATA_DIR lock');
  let staticCount=0;
  for(const entry of runtime.filter(e=>/^(public|shared)\//.test(e.file))){const route=entry.file==='public/index.html'?'/':entry.file.startsWith('public/')?'/'+entry.file.slice(7):'/'+entry.file;const result=await request(first,route);assert.equal(result.response.status,200,route);assert.equal(hash(result.bytes),entry.sha256,route+' bytes');assert.equal(result.response.headers.get('x-content-type-options'),'nosniff');assert.match(result.response.headers.get('content-security-policy'),/default-src 'self'/);if(entry.file.endsWith('.mjs'))assert.match(result.response.headers.get('content-type'),/javascript/);staticCount++;}
  report.staticAssets=staticCount;check(true,'All public/shared world modules, styles, icon and HTML served with exact archived bytes and CSP');
  for(const route of ['/server/engine/index.mjs','/package.json','/data/service.lock'])assert.equal((await request(first,route)).response.status,404);
  const denied=await request(first,'/api/rooms',{method:'POST',body:{mode:'human'},origin:'https://foreign.invalid'});assert.equal(denied.response.status,403);check(true,'Foreign origin denied and runtime/package/private paths are not served');
  const created=await request(first,'/api/rooms',{method:'POST',body:{mode:'human',name:'Bounded production fixture'}});assert.equal(created.response.status,201);const roomId=created.value.roomId,cookie=created.response.headers.get('set-cookie').split(';')[0];assert.match(created.response.headers.get('set-cookie'),/HttpOnly/);assert.match(created.response.headers.get('set-cookie'),/SameSite=Strict/);
  const started=await request(first,'/api/rooms/'+roomId+'/start',{method:'POST',body:{id:'production:start'},cookie});assert.equal(started.response.status,200);safe(started.value);assert.equal(started.value.seatId,'p1');const originalPosition=structuredClone(started.value.game.self.position);check(true,'Real human create/start opts into worldVersion1 and reveals only self role/input/destination');
  assert.equal((await request(first,'/api/rooms/'+roomId)).response.status,401);
  assert.equal((await request(first,'/api/rooms/'+roomId+'/replay',{cookie})).response.status,409);
  const joined=await request(first,'/api/rooms/'+roomId+'/join',{method:'POST',body:{}});assert.equal(joined.response.status,200);safe(joined.value);assert.equal(joined.value.seatId,null);check(true,'Joiner is redacted spectator; room auth and pre-end replay guards hold');
  const one=await request(first,'/api/rooms/'+roomId+'/input',{method:'POST',body:{seq:1,dx:-1,dy:0},cookie});assert.equal(one.response.status,200);safe(one.value);await delay(180);
  const zero=await request(first,'/api/rooms/'+roomId+'/input',{method:'POST',body:{seq:2,dx:0,dy:0},cookie});assert.equal(zero.response.status,200);safe(zero.value);assert.equal(zero.value.game.self.inputSeq,2);assert.equal(zero.value.game.self.moving,false);assert.ok(distance(originalPosition,zero.value.game.self.position)>0);const stopped=zero.value.game.self.position;
  const foreignInput=await request(first,'/api/rooms/'+roomId+'/input',{method:'POST',body:{seq:3,dx:1,dy:0},cookie,origin:'https://foreign.invalid'});assert.equal(foreignInput.response.status,403);check(true,'Production authenticated steering moves physically and legitimate zero cleanup stops without origin relaxation');
  const WebSocket=require('ws');ws=new WebSocket(first.origin.replace('http:','ws:')+'/api/rooms/'+roomId+'/socket',{headers:{origin:first.origin,cookie}});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('WS state timeout')),4000);ws.once('error',reject);ws.once('message',bytes=>{clearTimeout(timer);const state=JSON.parse(bytes.toString());assert.equal(state.type,'state');safe(state.room);resolve();});});let socketClosed=false;ws.once('close',()=>{socketClosed=true;});check(true,'Production ws dependency serves authenticated safe world snapshot');
  await stop(first);assert.equal(socketClosed,true);check(true,'Real main SIGTERM handler exits0, closes live WS and removes lock/recovery claim');
  const files=await readdir(data);assert.ok(files.some(name=>name.startsWith('room-')&&name.endsWith('.json')));assert.equal(files.some(name=>/quarantine|\.tmp$/.test(name)),false);
  const saved=JSON.parse(await readFile(path.join(data,'room-'+roomId+'.json'),'utf8'));assert.equal(saved.state.schemaVersion,2);assert.equal(saved.state.worldVersion,1);assert.equal(saved.state.players.find(p=>p.id==='p1').motion.seq,2);
  const second=await launch();const lock2=JSON.parse(await readFile(path.join(data,'service.lock'),'utf8'));assert.equal(lock2.pid,second.child.pid);assert.notEqual(lock2.token,lock.token);
  const restored=await request(second,'/api/rooms/'+roomId,{cookie});assert.equal(restored.response.status,200);safe(restored.value);assert.equal(restored.value.game.self.inputSeq,2);assert.deepEqual(restored.value.game.self.position,stopped);
  const duplicate=await request(second,'/api/rooms/'+roomId+'/input',{method:'POST',body:{seq:2,dx:0,dy:0},cookie});assert.equal(duplicate.response.status,200);assert.deepEqual(duplicate.value.game.self.position,stopped);check(true,'Fresh real main restores schema2, original human cookie and inert input receipt without quarantine');
  await stop(second);check(true,'Restarted real main also releases its independently acquired data lock');
  await verifySource();check(report.providerFetchAttempts===0&&report.forcedStops===0,'All148 source blobs unchanged; zero provider fetches and no forced shutdowns');
  report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack||error);throw error;}
finally{
  if(ws&&ws.readyState!==3)ws.terminate();if(active){try{await stop(active);}catch(error){report.cleanupError=String(error);if(active?.child.exitCode===null)active.child.kill();}}
  await writeFile(path.join(artifact,'world-production-56c320a-result.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({pin,status:report.status,checks:report.checks.length,staticAssets:report.staticAssets,children:report.children.map(c=>({pid:c.pid,exit:c.exit})),providerFetchAttempts:report.providerFetchAttempts,forcedStops:report.forcedStops}));
