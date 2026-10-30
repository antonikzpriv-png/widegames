/** Independent native audit. Explicit pinned raw source; demo only, never a provider. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import net from 'node:net';
import puppeteer from 'puppeteer-core';

/** Prepared for the next exact UI integration/lease; not run on the old baseline.
 * readRoom must use the actual authenticated HTTP safe view. travel must issue
 * real validated navigation and await arrival; neither may replace responses.
 * Buttons/labels were inspected read-only in the pending renderer; those source
 * assumptions must be rechecked against its committed integration before use.
 */
export async function exerciseNativeStationTask({page,taskId,readRoom,record=()=>{},timeoutMs=15000}){
 const read=async()=>{const r=await readRoom();assert.equal(r.game?.stationTasksVersion,1);assert(r.game.self?.alive);assert.equal(r.game.phase,'roam');const task=r.game.self.tasks.find(t=>t.id===taskId);assert.equal(task?.kind,'station');return task;};
 const click=label=>page.locator('[aria-label='+JSON.stringify(label)+']').click();
 let task=await read(),steps=0;
 assert(!task.completed,'Use an incomplete actual task');await page.waitForSelector('.lw-station-modal');
 while(!task.completed){
  assert(++steps<=12,'Bounded six-puzzle controls, never local completion');const previous=JSON.stringify(task.challenge.progress),{kind,puzzle:p,progress:{values:v}}=task.challenge;
  await page.waitForFunction(()=>[...document.querySelectorAll('.lw-station-control')].some(n=>!n.disabled));
  if(kind==='circuit'){const l=p.left.find(x=>!v.some(s=>s.startsWith(x.id+':')));await click('Cable '+l.symbol);await click('Socket '+p.right.find(r=>r.symbol===l.symbol).symbol);}
  else if(kind==='signal'){await page.$eval('.lw-station-slider',(n,value)=>{n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));},p.target);await page.locator('button::-p-text(Transmit frequency)').click();}
  else if(kind==='sequence')await click('Record tile '+p.order[v.length]);
  else if(kind==='glyphs'){const wrong=p.tiles.find(t=>t.symbol!==p.target&&v.includes(t.id)),missing=p.tiles.find(t=>t.symbol===p.target&&!v.includes(t.id)),tile=wrong||missing;if(tile)await click('Inspection tile '+(Number(tile.id.slice(1))+1)+': '+tile.symbol);else await page.locator('button::-p-text(Verify selected glyphs)').click();}
  else if(kind==='alignment'){const d=p.dials.find(x=>!v.some(s=>s.startsWith(x.id+':')));const index=p.dials.indexOf(d);const selects=await page.$$('.lw-station-direction');assert.equal(selects.length,p.dials.length);await selects[index].select(String(d.target));await click('Lock rotor '+(index+1));}
  else if(kind==='manifolds'){const valve=[...p.valves].sort((a,b)=>a.value-b.value)[v.length];await click('Pressure valve '+valve.value);}
  else throw Error('Unqualified station kind '+kind);
  const end=Date.now()+timeoutMs;let changed=false;while(Date.now()<end){task=await read();if(task.completed||JSON.stringify(task.challenge.progress)!==previous){changed=true;break;}await new Promise(r=>setTimeout(r,60));}assert(changed,'Actual server must acknowledge each native puzzle input');
 }
 record({taskId,kind:task.challenge.kind,steps,completed:task.completed,source:'actual owner HTTP safe view after native in-game controls'});return task.challenge.kind;
}

/** Drives the actual human seat's generated jobs, never changes task definitions.
 * One generated watch has four kinds; caller must cover all six over real new
 * watches and explicitly compare the returned union, including the glyph grid.
 * This helper qualifies console input, not an invented whole-match outcome.
 */
export async function exerciseHumanStationJobs({page,readRoom,travel,record=()=>{},screenshot=async()=>{}}){
 const first=await readRoom();assert(first.seatId&&first.game.self?.role==='crew');assert.equal(first.game.stationTasksVersion,1);const kinds=[];
 for(const assignment of first.game.self.tasks){const room=await readRoom();if(room.game.phase!=='roam')throw Error('Actual human watch changed phase before task coverage');if(room.game.self.tasks.find(t=>t.id===assignment.id)?.completed)continue;
  await travel(assignment,room);await page.waitForSelector('.lw-action-use[aria-disabled="false"]');await page.locator('.lw-action-use').click();await page.waitForSelector('.lw-station-modal');const before=(await readRoom()).game.self.tasks.find(t=>t.id===assignment.id);assert.equal(before.completed,false,'Opening is not completion');await screenshot('station-'+before.challenge.kind+'-open');
  kinds.push(await exerciseNativeStationTask({page,taskId:assignment.id,readRoom,record}));await screenshot('station-'+before.challenge.kind+'-confirmed');if(await page.$('.lw-station-modal'))await page.locator('button::-p-text(Close station)').click();
 }
 return kinds;
}

/** Observe a real full human or all-AI DEMO watch; never substitute a winner.
 * advance may only tick actual authoritative time (a labeled acceleration).
 * Complete browser integration supplies council controls through native UI.
 */
export async function observeNativeDemoOutcome({readRoom,advance=async()=>{},record=()=>{},timeoutMs=90000,allAi=false}){
 const start=Date.now();let room;
 while(Date.now()-start<timeoutMs){room=await readRoom();assert.equal(room.ai.mode,'demo');assert.equal(room.ai.calls,0);assert.equal(room.ai.costUsd,0);assert.equal(room.game.stationTasksVersion,1);if(allAi)assert.equal(room.game.self,null);record({phase:room.game.phase,serverNow:room.game.serverNow,tasks:room.game.tasks});
  if(room.game.phase==='ended'){assert(room.game.outcome?.winner&&room.game.outcome?.reason,'Actual engine outcome is required');return {outcome:room.game.outcome,tasks:room.game.tasks,wallMs:Date.now()-start};}
  if(room.game.phase==='paused')throw Error('Actual watch paused without a winner');await advance(room);await new Promise(r=>setTimeout(r,100));
 }
 throw Error('Bounded actual watch did not finish; no fallback winner is qualified');
}

async function main(){
const own=fileURLToPath(new URL('../',import.meta.url));
const source=path.resolve(process.env.QUALITY_BROWSER_ROOT||own),url=pathToFileURL(source+path.sep);
const mode=process.env.QUALITY_BROWSER_MODE||'baseline';
assert.equal(mode,'baseline','New station UI/native full-match qualification requires its forthcoming committed integration; this driver currently runs baseline only.');
const manifest=JSON.parse(await readFile(path.join(source,'source-manifest.json'),'utf8'));
const pin=manifest.revision||manifest.commit||manifest.sourceCommit||manifest.source;
assert(['941e857f046ef7cc9bae25f0fcad27cf6ab7578a','d55144dd3c71f5ad965814aee92f4612bc4084ba'].includes(pin),'Baseline requires one of the two authorized frozen historical pins.');
const engine=await import(new URL('server/engine/index.mjs',url)),{getMap}=await import(new URL('shared/maps/index.mjs',url)),{loadConfig}=await import(new URL('server/config.mjs',url)),{createGameServer}=await import(new URL('server/transport.mjs',url));
await mkdir(path.join(own,'_artifacts'),{recursive:true});
const output=await mkdtemp(path.join(own,'_artifacts','quality-browser-baseline-'));
const report={sourceCommit:pin,sourceRoot:path.relative(own,source),mode,fixture:'Frozen raw app/server/shared source. Real HTTP/WS and safe views, seeded crew human; other seats explicitly idle fixture. Validated navigation may use accelerated server time to stage station arrival. No fabricated positions, state, outcome or provider. Not a complete match or new station UI qualification.',checks:[],errors:[],consoleErrors:[],screenshots:[],measurements:[],httpSafeViews:0,wsSafeViews:0,inputPackets:[],outboundRequests:[],limits:['Instrumented rAF intervals include scheduler/monitor overhead and are not a GPU/FPS guarantee.','Canvas dispatch wall time includes instrumented JS/native dispatch overhead, not GPU completion.','V8 samples are sampled browser-main-thread CPU attribution; CDP TaskDuration is not whole-machine CPU.','Two bounded viewports on this host; no production latency or broad benchmark grade.']};
const pause=ms=>new Promise(r=>setTimeout(r,ms));let game,browser,page,origin,roomId,skew=0,closed=false;const pending=new Set(),nativeFetch=globalThis.fetch;
function safe(room){if(!room?.game)return;const g=room.game;assert.equal(g.self?.id??null,room.seatId);for(const k of ['identities','aiContext','fingerprint'])assert(!Object.hasOwn(room,k));for(const k of ['requests','replay','reservations'])assert(!Object.hasOwn(g,k));for(const p of g.players){for(const k of ['tasks','motion','destination','transit'])assert(!Object.hasOwn(p,k));if(g.phase!=='ended')assert(!Object.hasOwn(p,'role'));}if(!g.self){assert.deepEqual(g.interactions,[]);assert.deepEqual(g.investigation.observations,[]);}return room;}
async function view(){const r=await page.evaluate(async()=>{const r=await fetch('/api/rooms/'+location.pathname.split('/')[2]);if(!r.ok)throw Error('GET '+r.status);return r.json();});return safe(r);}
async function until(fn,label,ms=15000){const end=Date.now()+ms;while(Date.now()<end){const r=await view();if(fn(r))return r;await pause(80);}throw Error('Timed out '+label);}
async function check(name,fn){const c={name,passed:false};report.checks.push(c);await fn();c.passed=true;console.log('PASS '+name);}
async function shot(name){const file=name+'.png';await page.screenshot({path:path.join(output,file),fullPage:true});report.screenshots.push(file);}
async function press(text){await page.locator('button::-p-text('+text+')').click();}
function track(p){pending.add(p);p.catch(e=>report.errors.push(String(e))).finally(()=>pending.delete(p));}
async function instrument(){
 await page.setRequestInterception(true);page.on('request',r=>{const u=r.url();if(!u.startsWith(origin+'/')&&!u.startsWith('data:')&&!u.startsWith('about:')){report.outboundRequests.push(u);r.abort();return;}if(r.method()==='POST'&&u.endsWith('/input'))report.inputPackets.push(JSON.parse(r.postData()));r.continue();});
 page.on('requestfinished',r=>{const res=r.response();if(!closed&&res?.ok()&&r.url().startsWith(origin+'/api/rooms'))track(res.json().then(v=>{safe(v);report.httpSafeViews++;}));});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 await page.evaluateOnNewDocument(()=>{
  const p=window.__quality={intervals:[],canvas:{},last:null,collect:false,visibility:[]};
  const frame=t=>{if(p.collect&&p.last!==null)p.intervals.push(t-p.last);p.last=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  document.addEventListener('visibilitychange',()=>p.visibility.push({hidden:document.hidden,at:performance.now()}));
  for(const key of Object.getOwnPropertyNames(CanvasRenderingContext2D.prototype)){const d=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,key);if(typeof d?.value!=='function'||key==='constructor')continue;const fn=d.value;Object.defineProperty(CanvasRenderingContext2D.prototype,key,{...d,value:function(...a){if(!p.collect)return Reflect.apply(fn,this,a);const start=performance.now();try{return Reflect.apply(fn,this,a);}finally{const c=p.canvas[key]??={calls:0,dispatchMs:0};c.calls++;c.dispatchMs+=performance.now()-start;}}});}
 });
}
async function measure(label,fn){
 const cdp=await page.createCDPSession();await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});
 await page.evaluate(()=>{const p=window.__quality;p.intervals=[];p.canvas={};p.last=null;p.collect=true;});
 const before=await cdp.send('Performance.getMetrics'),wall=performance.now(),cpu=process.cpuUsage();await cdp.send('Profiler.start');await fn();const profile=(await cdp.send('Profiler.stop')).profile,after=await cdp.send('Performance.getMetrics'),instrumentation=await page.evaluate(()=>{window.__quality.collect=false;return window.__quality;});
 const metrics=new Map(after.metrics.map(x=>[x.name,x.value]));for(const x of before.metrics)if(metrics.has(x.name))metrics.set(x.name,metrics.get(x.name)-x.value);
 const intervals=instrumentation.intervals.filter(Number.isFinite).sort((a,b)=>a-b),quantile=q=>intervals.length?intervals[Math.min(intervals.length-1,Math.floor(q*(intervals.length-1)))]:null;
 const profileFile=label+'.cpuprofile';await writeFile(path.join(output,profileFile),JSON.stringify(profile));
 report.measurements.push({label,wallMs:performance.now()-wall,nodeServerHarnessCpuMicros:process.cpuUsage(cpu),raf:{count:intervals.length,min:intervals[0]??null,median:quantile(.5),p95:quantile(.95),max:intervals.at(-1)??null,rawIntervalsMs:instrumentation.intervals},canvas:instrumentation.canvas,cdpMetricDeltas:Object.fromEntries([...metrics].filter(([k])=>['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].includes(k))),v8Samples:profile.samples?.length??0,cpuProfile:profileFile});await cdp.detach();
}
try{
 for(const [file,row] of Object.entries(manifest.files)){const digest=createHash('sha256').update(await readFile(path.join(source,file))).digest('hex');assert.equal(digest.toLowerCase(),row.sha256.toLowerCase(),'Archive integrity '+file);}
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));origin='http://127.0.0.1:'+port;
 globalThis.fetch=(i,o)=>{const u=typeof i==='string'?i:i.url;if(!u.startsWith(origin+'/'))throw Error('Outbound Node fetch prohibited');return nativeFetch(i,o);};
 let seed;for(let i=0;i<128;i++){const s='quality-native-'+i;if(engine.createMatch({id:'seed',tactical:true,map:{id:'beacon',version:1},now:1000,seed:s}).players.find(p=>p.human).role==='crew'){seed=s;break;}}assert(seed);
 const config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:path.join(output,'data'),AI_PROVIDER:'demo',MAX_AI_CALLS:'0',MAX_AI_COST_USD:'0',MAX_DAILY_AI_COST_USD:'0'});config.now=()=>Date.now()+skew;config.tickMs=50;config.rules={roamDeadlineMs:600000,maxMatchMs:900000};
 game=await createGameServer(config,{engine:{...engine,createMatch:o=>engine.createMatch({...o,seed})},aiController:{describe:()=>({mode:'demo',provider:'idle-audit-fixture',calls:0,tokens:0,costUsd:0}),async decide(){return null;}}});await new Promise(r=>game.server.listen(port,'127.0.0.1',r));
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome'),headless:true,userDataDir:path.join(output,'profile'),args:['--no-sandbox','--disable-dev-shm-usage']});report.browser=await browser.version();page=await browser.newPage();page.setDefaultTimeout(15000);await page.setViewport({width:1440,height:1000,hasTouch:true});await instrument();
 const wire=await page.createCDPSession();await wire.send('Network.enable');wire.on('Network.webSocketFrameReceived',e=>{if(e.response.opcode===1)try{const v=JSON.parse(e.response.payloadData);if(v.type==='state'){safe(v.room);report.wsSafeViews++;}}catch(e){report.errors.push(String(e));}});
 await check('native lobby role and real safe HTTP/WS state',async()=>{await page.goto(origin,{waitUntil:'networkidle0'});await page.locator('.harbor-play').click();await page.waitForSelector('.lw-lobby');roomId=new URL(page.url()).pathname.split('/')[2];await press('Begin the watch');await page.waitForSelector('.lw-role-scene:not([hidden])');await press('Enter the beacon');await page.waitForSelector('.lw-connection[data-connected="true"]');const r=await view();assert.equal(r.game.self.role,'crew');assert.deepEqual(r.game.map,{id:'beacon',version:1});await shot('desktop-start');});
 for(const size of [{width:1440,height:1000,hasTouch:true},{width:390,height:844,hasTouch:true,isMobile:true}]){
  const label=size.width>500?'desktop':'mobile';await page.setViewport(size);await pause(250);if(await page.$('.lw-role-scene:not([hidden])'))await press('Enter the beacon');
  await check(label+' native movement, idle and real metrics',async()=>{const before=(await view()).game.self.position;await measure(label+'-move-idle',async()=>{if(label==='desktop'){await page.focus('.lw-world-canvas');await page.keyboard.down('d');await pause(400);await page.keyboard.up('d');}else{const box=await page.$eval('.lw-joystick',n=>{const r=n.getBoundingClientRect();return{x:r.x+r.width/2-28,y:r.y+r.height/2};}),touch=await page.createCDPSession();await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[box]});await pause(400);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();}await until(r=>!r.game.self.moving,'stop');await pause(850);});const after=(await view()).game.self.position;assert(Math.hypot(after.x-before.x,after.y-before.y)>10);await shot(label+'-walking');});
 }
 await check('native visibility stop, resume and safe snapshot interaction',async()=>{await page.focus('.lw-world-canvas');await page.keyboard.down('d');await pause(170);const background=await browser.newPage();await background.goto('about:blank');await background.bringToFront();await pause(750);assert.equal(await page.evaluate(()=>document.hidden),true);const r=game.rooms.get(roomId).data.state,who=(await view()).seatId;assert.equal(engine.getPlayerView(r,who,config.now()).self.moving,false);await page.keyboard.up('d');await page.bringToFront();await background.close();await pause(200);assert.equal(await page.evaluate(()=>document.hidden),false);await page.focus('.lw-world-canvas');await page.keyboard.press('m');await page.waitForSelector('.lw-map-pane:not([hidden])');await shot('mobile-map-snapshot');await page.keyboard.press('m');await page.waitForSelector('.lw-map-pane[hidden]',{hidden:true});});
 await check('actual legacy station opens without completing task',async()=>{const r=await view(),task=r.game.self.tasks.find(t=>!t.completed),map=getMap(r.game.map),point=map.geometry.WORLD_STATIONS[task.roomId];const response=await page.evaluate(async({id,point})=>{const r=await fetch('/api/rooms/'+location.pathname.split('/')[2]+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,type:'navigate',...point})});return {status:r.status,body:await r.json()};},{id:'quality-baseline:'+randomUUID(),point});assert.equal(response.status,200,JSON.stringify(response.body));const p=game.rooms.get(roomId).data.state.players.find(p=>p.id===r.seatId);let distance=0,last=p.position;for(const q of p.motion.path){distance+=map.geometry.distance(last,q);last=q;}skew+=Math.ceil(distance/map.geometry.WORLD.speed*1000)+150;await until(v=>!v.game.self.moving&&map.geometry.distance(v.game.self.position,point)<1,'station arrival');await page.waitForSelector('.lw-action-use[aria-disabled="false"]');await page.locator('.lw-action-use').click();await page.waitForSelector('.lw-task-modal');assert.equal((await view()).game.self.tasks.find(t=>t.id===task.id).completed,false);await shot('mobile-legacy-station');await press('Close station');});
 await Promise.allSettled([...pending]);assert.equal(report.wsSafeViews>0,true);assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.outboundRequests,[]);report.providerCalls=0;report.archiveRechecked=true;for(const [file,row] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(path.join(source,file))).digest('hex').toLowerCase(),row.sha256.toLowerCase());
}catch(e){report.failure=String(e.stack||e);console.error(report.failure);process.exitCode=1;try{if(page)await shot('failure');}catch{}}
finally{closed=true;await Promise.allSettled([...pending]);try{await browser?.close();report.browserClosed=true;}catch(e){report.errors.push(String(e));}try{await game?.close();report.serverClosed=true;}catch(e){report.errors.push(String(e));}globalThis.fetch=nativeFetch;for(const name of ['profile','data']){const target=path.resolve(output,name);assert.equal(path.dirname(target),output);await rm(target,{recursive:true,force:true});}report.summary={passed:report.checks.filter(c=>c.passed).length,failed:report.checks.filter(c=>!c.passed).length};await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Quality baseline evidence: '+output);}


}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
