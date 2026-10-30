/** Native browser qualification for local spectator movement and safe inspection. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {createGameServer} from '../server/transport.mjs';
import {loadConfig} from '../server/config.mjs';
import * as engine from '../server/engine/index.mjs';
import * as worlds from '../shared/world.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await mkdir(path.join(root,'_artifacts'),{recursive:true});
const output=await mkdtemp(path.join(root,'_artifacts/spectator-browser-'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const files=git('ls-files','--cached','--others','--exclude-standard','public','server','shared').split('\n').filter(Boolean);
const hashes=()=>Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(path.join(root,f))).digest('hex')]));
const before=await hashes();
const report={fixture:'Native app and HTTP/WebSocket APIs with real demo bots and deterministic engine seeds. Explicit lobby selection chooses the three canonical revision-2 cutaways; illustrated Beacon uses its distinct selection alias. Native keyboard ghost controls traverse real machinery and exterior walls without sending actor input. Long legal cooldowns prevent fixture combat; no fabricated outcome, provider call or deployment. Browser timings describe this headless Cloud host, not a guarantee on every device.',checks:[],errors:[],consoleErrors:[],screenshots:[],performance:[],sourceCommit:git('rev-parse','HEAD'),runtimeFingerprints:before};
let game,browser,page,origin;const writes=[];
function check(value,name){report.checks.push({name,passed:!!value});assert(value,name);console.log('PASS '+name);}
function instrument(target){target.on('pageerror',error=>report.errors.push(error.message));target.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});target.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/rooms'))writes.push({path:new URL(request.url()).pathname,body:request.postData()});});}
async function view(target=page){return target.evaluate(async()=>{const response=await fetch('/api/rooms/'+location.pathname.split('/')[2]);if(!response.ok)throw Error('State HTTP '+response.status);return response.json();});}
async function camera(){return page.$eval('.lw-world-canvas',n=>({x:Number(n.dataset.cameraX),y:Number(n.dataset.cameraY),zoom:Number(n.dataset.cameraZoom),mode:n.dataset.cameraMode}));}
async function press(text,target=page){await target.locator(`button::-p-text(${text})`).click();}
async function shot(name){const file=name+'.png';await page.screenshot({path:path.join(output,file),fullPage:true});report.screenshots.push(file);}
async function clickWorld(position){const p=await page.$eval('.lw-world-canvas',(n,p)=>{const r=n.getBoundingClientRect(),z=Number(n.dataset.cameraZoom);return {x:r.left+r.width/2+(p.x-Number(n.dataset.cameraX))*z,y:r.top+r.height/2+(p.y-Number(n.dataset.cameraY))*z};},position);await page.mouse.click(p.x,p.y);}
const geometryFor=state=>worlds.getWorld(state.mapId||'beacon',state.mapRevision??1);
async function driftTo(position){
 await page.focus('.lw-world-canvas');
 for(const axis of ['x','y']){
  const start=await camera(),delta=position[axis]-start[axis];if(Math.abs(delta)<10)continue;
  const direction=Math.sign(delta),key=axis==='x'?(direction>0?'d':'a'):(direction>0?'s':'w');
  await page.keyboard.down(key);
  try{await page.waitForFunction(({axis,target,direction})=>{const node=document.querySelector('.lw-world-canvas'),coordinate=Number(node.dataset[axis==='x'?'cameraX':'cameraY']);return direction>0?coordinate>=target-6:coordinate<=target+6;},{polling:'raf',timeout:15000},{axis,target:position[axis],direction});}
  finally{await page.keyboard.up(key);}
  await pause(70);
 }
}
async function proveGhostTraversal(geometry){
 const prop=geometry.WORLD_OBSTACLES.filter(p=>p.width>=80&&p.height>=70).sort((a,b)=>b.width*b.height-a.width*a.height)[0];assert(prop,'Fixture needs visible machinery with a solid interior');
 const center={x:prop.x+prop.width/2,y:prop.y+prop.height/2};assert(!geometry.isWalkable(center));
 await press('Free ghost');await driftTo(center);const inside=await camera();
 check(inside.mode==='free'&&inside.x>prop.x&&inside.x<prop.x+prop.width&&inside.y>prop.y&&inside.y<prop.y+prop.height&&!geometry.isWalkable(inside),'native free ghost passes through solid '+geometry.metadata.name+' machinery');
 await shot('ghost-inside-'+geometry.metadata.id);
 const outside={x:28,y:28};assert(!geometry.isWalkable(outside)&&geometry.worldRoomAt(outside)===null);await driftTo(outside);const exterior=await camera();
 check(exterior.mode==='free'&&!geometry.isWalkable(exterior)&&geometry.worldRoomAt(exterior)===null&&Math.hypot(exterior.x-outside.x,exterior.y-outside.y)<35,'native free ghost crosses the '+geometry.metadata.name+' hull into exterior space');
 await press('Overview');await pause(100);
}
async function measure(label,duration=2400){
 const cdp=await page.createCDPSession();await cdp.send('Performance.enable');
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));const initial=await metrics();
 const frames=await page.evaluate(duration=>new Promise(resolve=>{const samples=[];let previous=performance.now(),start=previous;function frame(now){samples.push(now-previous);previous=now;if(now-start<duration)requestAnimationFrame(frame);else resolve(samples);}requestAnimationFrame(frame);}),duration);
 const final=await metrics();const sorted=frames.slice(1).sort((a,b)=>a-b),elapsed=final.Timestamp-initial.Timestamp;
 const result={label,frames:sorted.length,meanFrameMs:sorted.reduce((sum,n)=>sum+n,0)/sorted.length,p95FrameMs:sorted[Math.floor(sorted.length*.95)],taskMsPerSecond:(final.TaskDuration-initial.TaskDuration)/elapsed*1000,layouts:final.LayoutCount-initial.LayoutCount,styleRecalculations:final.RecalcStyleCount-initial.RecalcStyleCount};report.performance.push(result);console.log('TIMING '+JSON.stringify(result));
 if(result.p95FrameMs>=100||result.meanFrameMs>=40){
  const methods=await page.evaluate(async()=>{const stats={},originals=new Map(),prototype=CanvasRenderingContext2D.prototype;for(const method of ['drawImage','fill','fillRect','stroke','fillText','strokeText']){const original=prototype[method];originals.set(method,original);prototype[method]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const entry=stats[method]||={calls:0,ms:0};entry.calls++;entry.ms+=performance.now()-start;}};}await new Promise(r=>setTimeout(r,1200));for(const [method,original]of originals)prototype[method]=original;return stats;});report.canvasProfile={label,methods};console.log('CANVAS PROFILE '+JSON.stringify(report.canvasProfile));
 }
 await cdp.detach();
 check(result.p95FrameMs<100&&result.meanFrameMs<40,label+' remains responsive under real demo updates (p95 <100ms, average <40ms)');
 return result;
}
try{
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));origin=`http://127.0.0.1:${port}`;
 const config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:path.join(output,'state'),AI_PROVIDER:'demo'});config.tickMs=65;config.ai.decisionIntervalMs=350;
 config.rules={tasksPerCrew:5,initialKillCooldownMs:300000,killCooldownMs:300000,sabotageCooldownMs:300000,roamDeadlineMs:600000,maxMatchMs:900000};
 game=await createGameServer(config,{engine:{...engine,createMatch:options=>engine.createMatch({...options,seed:'spectator-browser-'+options.mode})}});await new Promise(r=>game.server.listen(port,'127.0.0.1',r));
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome'),headless:true,userDataDir:path.join(output,'profile'),args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();page.setDefaultTimeout(20000);await page.setViewport({width:1440,height:1000});instrument(page);
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.click('.harbor-watch');await page.waitForSelector('.lw-lobby:not([hidden])');await page.select('.lw-map-select','beacon-illustrated');await press('Begin the watch');await page.waitForSelector('.lw-spectator:not([hidden])');
 check((await view()).game.self===null,'all-AI spectator has no playable seat');check(await page.$eval('.lw-ai',n=>n.textContent.includes('DEMO')),'demo execution is visibly labeled');
 const firstGame=(await view()).game,firstGeometry=geometryFor(firstGame);check(firstGame.mapRevision===2&&firstGeometry.metadata.revision===2,'production spectator starts the redesigned revision-2 beacon');
 const spectatorRoomId=(await view()).roomId,writesAtStart=writes.length;await press('Free ghost');await page.focus('.lw-world-canvas');await pause(100);const start=await camera();
 await page.keyboard.down('d');await page.keyboard.down('s');await pause(550);await page.keyboard.up('d');await page.keyboard.up('s');const moved=await camera();
 check(moved.mode==='free'&&moved.x>start.x+30&&moved.y>start.y+30,'spectator WASD moves a local free ghost camera diagonally');
 await pause(250);const stopped=await camera();check(Math.abs(stopped.x-moved.x)<1&&Math.abs(stopped.y-moved.y)<1,'releasing WASD stops free camera movement');
 check(writes.length===writesAtStart,'free ghost WASD sends no gameplay actions or movement packets');
 await proveGhostTraversal(firstGeometry);
 await page.select('[aria-label="Inspect world object"]','player:p2');await page.waitForSelector('.lw-inspector:not([hidden])');
 const keeper=game.rooms.get(spectatorRoomId).data.state.players.find(p=>p.id==='p2');const inspected=await page.$eval('.lw-inspector',n=>n.textContent);
 check(inspected.toLowerCase().includes(keeper.role),'authorized all-AI inspector shows the selected keeper actual role');
 check(inspected.includes('Current activity'),'inspector provides a labeled current-activity summary');
 check(!/chain.of.thought|api.?key|aiContext|memories|provider error/i.test(inspected),'inspector excludes private model context, unrestricted memory and secrets');
 await shot('01-spectator-agent-inspector');
 await page.select('[aria-label="Follow a keeper"]','p2');await pause(650);check((await camera()).mode==='follow','selected keeper following remains available');
 await page.click('.lw-inspector-close');await press('Overview');await pause(150);
 const worldState=(await view()).game,station=Object.entries(geometryFor(worldState).WORLD_STATIONS).find(([,p])=>worldState.players.every(a=>!a.position||Math.hypot(a.position.x-p.x,a.position.y-p.y)>90));assert(station,'demo fixture must leave an unoccupied station');
 await clickWorld(station[1]);await page.waitForSelector('.lw-inspector:not([hidden])');
 check(await page.$eval('[aria-label="Inspect world object"]',(n,id)=>n.value==='station:'+id,station[0]),'clicking a drawn station opens its inspector');
 await page.click('.lw-inspector-close');await clickWorld(geometryFor(worldState).WORLD_BELL);await page.waitForSelector('.lw-inspector:not([hidden])');
 check(await page.$eval('.lw-inspector',n=>n.dataset.selection==='bell:bell'),'clicking the drawn emergency bell opens its inspector');
 await page.click('.lw-inspector-close');await page.select('[aria-label="Follow a keeper"]','p2');await pause(800);
 // Click the visible followed keeper, rather than an authoritative position
 // fetched ahead of the renderer's interpolated sample.
 const keeperPoint=await page.$eval('.lw-world-canvas',n=>{const r=n.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2-25*Number(n.dataset.cameraZoom)};});await page.mouse.click(keeperPoint.x,keeperPoint.y);await page.waitForSelector('.lw-inspector:not([hidden])');
 check(await page.$eval('.lw-inspector',n=>n.dataset.selection==='player:p2'),'clicking a drawn keeper opens that keeper inspector');
 await measure('All-AI world with inspector');
 await page.setViewport({width:390,height:844});await shot('02-spectator-mobile');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'spectator inspector and controls fit a mobile viewport');
 await page.setViewport({width:1440,height:1000});await press('Free ghost');await page.focus('.lw-world-canvas');await page.keyboard.down('d');const cover=await browser.newPage();await cover.bringToFront();await page.waitForFunction(()=>document.hidden);await page.keyboard.up('d');const hidden=await camera();await pause(250);const later=await camera();check(Math.abs(hidden.x-later.x)<1,'hidden page stops spectator camera movement');await page.bringToFront();await cover.close();
 check(writes.length===writesAtStart,'spectator inspection, following and camera lifecycle emit no game actions');
 const replayDenied=await page.evaluate(async()=>{const r=await fetch('/api/rooms/'+location.pathname.split('/')[2]+'/replay');return r.status;});check(replayDenied===409,'live observer inspection does not unlock unfinished replay');
 const visitorContext=await browser.createBrowserContext(),visitor=await visitorContext.newPage();visitor.on('pageerror',error=>report.errors.push(error.message));try{await visitor.goto(origin+'/r/'+spectatorRoomId,{waitUntil:'domcontentloaded'});await visitor.waitForSelector('.lw-connection[data-connected="true"]');const publicView=await view(visitor);check(publicView.isHost===false&&publicView.seatId===null&&publicView.game.self===null&&publicView.game.inspection===undefined&&publicView.game.players.every(p=>!Object.hasOwn(p,'role')),'joined public observer receives no owner inspection or unrevealed roles');}finally{await visitorContext.close();}
 await press('Exit');await page.waitForSelector('.harbor-play');await page.keyboard.press('d');await pause(100);check(writes.length===writesAtStart,'leaving disposes the spectator controller');
 await page.click('.harbor-play');await page.waitForSelector('.lw-lobby:not([hidden])');await page.select('.lw-map-select','beacon-illustrated');await press('Begin the watch');await page.waitForSelector('.lw-role-scene:not([hidden])');await press('Enter the beacon');
 const humanStart=await view();check(humanStart.seatId==='p1'&&!humanStart.game.inspection,'human player receives no observer inspection payload');await page.focus('.lw-world-canvas');await page.keyboard.down('d');await pause(450);await page.keyboard.up('d');await pause(200);const humanMoved=await view();
 check(humanMoved.game.self.position.x>humanStart.game.self.position.x+15,'human WASD moves its authoritative keeper');check(writes.slice(writesAtStart).some(w=>w.path.endsWith('/input')),'human movement still uses validated authoritative input');
 check(humanMoved.game.players.filter(p=>p.id!=='p1').every(p=>!Object.hasOwn(p,'role')),'other players roles remain private in a human match');await measure('Human-plus-AI world');await shot('03-human-world');
 for(const map of (worlds.MAPS||[]).filter(map=>map.id!=='beacon')){
  await press('Exit');await page.waitForSelector('.harbor-watch');await page.click('.harbor-watch');await page.waitForSelector('.lw-lobby:not([hidden])');await page.select('[aria-label="Choose a map"]',map.id);await press('Begin the watch');await page.waitForSelector('.lw-spectator:not([hidden])');
  const state=await view(),geometry=geometryFor(state.game);check(state.game.mapId===map.id,'all-AI spectator starts the selected '+map.name+' map');check(state.game.mapRevision===2&&geometry.metadata.revision===2,'production spectator uses redesigned revision-2 '+map.name);const mapWrites=writes.length;
  await press('Free ghost');await page.focus('.lw-world-canvas');const beforeCamera=await camera();await page.keyboard.down('d');await pause(Math.max(300,(1601-beforeCamera.x)/440*1000+180));await page.keyboard.up('d');const afterCamera=await camera();check(afterCamera.x>beforeCamera.x+15&&afterCamera.x>1600,'local ghost camera uses expanded bounds on '+map.name);
  await proveGhostTraversal(geometry);
  await page.select('[aria-label="Inspect world object"]','player:p3');check(await page.$eval('.lw-inspector',n=>n.textContent.includes('Current activity')),'keeper inspection works on '+map.name);await page.click('.lw-inspector-close');await press('Overview');await pause(100);
  const players=(await view()).game.players;let selected=null;
  for(const [id,position]of Object.entries(geometry.WORLD_STATIONS)){
   if(players.some(player=>player.position&&Math.hypot(player.position.x-position.x,player.position.y-position.y)<100))continue;
   const unobstructed=await page.$eval('.lw-world-canvas',(n,p)=>{const r=n.getBoundingClientRect(),z=Number(n.dataset.cameraZoom),x=r.left+r.width/2+(p.x-Number(n.dataset.cameraX))*z,y=r.top+r.height/2+(p.y-Number(n.dataset.cameraY))*z;return document.elementFromPoint(x,y)===n;},position);
   if(unobstructed){selected={id,position};break;}
  }
  assert(selected,'fixture must expose a visible unoccupied station on '+map.id);await clickWorld(selected.position);await page.waitForSelector('.lw-inspector:not([hidden])');check(await page.$eval('[aria-label="Inspect world object"]',(n,id)=>n.value==='station:'+id,selected.id),'canvas station picking uses '+map.name+' geometry');
  await measure(map.name+' all-AI world',1800);await shot('04-spectator-'+map.id);check(writes.length===mapWrites,'inspection and camera on '+map.name+' send no gameplay input');
 }
 const expectedConflicts=report.consoleErrors.filter(m=>m==='Failed to load resource: the server responded with a status of 409 (Conflict)');check(report.errors.length===0&&report.consoleErrors.length===expectedConflicts.length&&expectedConflicts.length===1,'no browser exceptions or unexpected console errors');
 check(JSON.stringify(before)===JSON.stringify(await hashes()),'runtime source remains unchanged during browser qualification');report.browser=await browser.version();report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error);if(page)await shot('failure').catch(()=>{});}
finally{await browser?.close();await game?.close();report.summary={passed:report.checks.filter(c=>c.passed).length,failed:report.checks.filter(c=>!c.passed).length};await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Spectator evidence: '+output);}
