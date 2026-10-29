/** Fresh 0842 frontend audit: real routes, new boundary assertions, no response fixtures. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {createGameServer} from '../server/transport.mjs';
import * as engine from '../server/engine/index.mjs';
import {createAiController} from '../server/ai/index.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const pin='0842a0090f1cfd1ec43b898f16e8191e5b9c2497';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('diff','--name-only',pin,'--','public','server','shared','package.json','package-lock.json'),'','Audit runtime must match saved revision');
const artifactsRoot=path.join(root,'_artifacts');await mkdir(artifactsRoot,{recursive:true});
const output=await mkdtemp(path.join(artifactsRoot,'audit-ui-20261029-'));
const report={sourcePin:pin,checkout:git('rev-parse','HEAD'),fixture:'Seeded real engine, controlled server clock, real demo AI, real HTTP/WS; no API response mocks.',cases:[],observations:[],runtimeErrors:[],screenshots:[],cleanupErrors:[]};
await writeFile(path.join(output,'source-pin.txt'),pin+'\n');
await writeFile(path.join(output,'audit-driver.mjs'),await readFile(fileURLToPath(import.meta.url)));
const files=git('ls-files','public','server','shared').split('\n');
const fingerprints=[];for(const file of files)fingerprints.push({path:file,sha256:createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')});
await writeFile(path.join(output,'source-sha256.json'),JSON.stringify(fingerprints,null,2));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,game,stamp=Date.now(),fixture='crew',forceAtAction=null;
const seeds={};
for(let i=0;!seeds.crew||!seeds.saboteur;i++){
 const candidate=engine.createMatch({id:'seed-fixture',seed:String(i)});
 if(candidate.players[0].role==='crew'&&candidate.players[1].role==='saboteur')seeds.crew??=String(i);
 if(candidate.players[0].role==='saboteur'&&candidate.players[1].tasks.some(task=>task.roomId==='bridge'))seeds.saboteur??=String(i);
}
function setupMatch(options){
 if(fixture!=='critical')return engine.createMatch({...options,now:options.now-1,seed:fixture==='saboteur'?seeds.saboteur:seeds.crew});
 let state=engine.createMatch({...options,now:options.now-30,seed:seeds.crew});
 const apply=(playerId,action,at)=>{const result=engine.applyAction(state,playerId,{id:'fixture-'+state.version,...action},at);assert.ok(result.accepted,result.error?.message);state=result.state;};
 let at=options.now-29;
 for(const playerId of ['p1','p2','p3']){apply(playerId,{type:'move',roomId:'lantern'},at++);apply(playerId,{type:'move',roomId:'engine'},at++);}
 apply('p2',{type:'eliminate',targetId:'p3'},at++);
 apply('p2',{type:'sabotage'},at++);
 apply('p1',{type:'report',bodyId:'body-p3'},at++);
 return state;
}
async function check(name,fn){
 const entry={name};report.cases.push(entry);
 try{await fn(entry);entry.passed=true;console.log('PASS '+name);}
 catch(error){entry.passed=false;entry.failure=String(error.stack||error);console.log('FAIL '+name+'\n'+entry.failure);}
}
async function shot(page,name){await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});report.screenshots.push(name+'.png');}
async function keyboard(page,selector){await page.waitForSelector(selector,{timeout:7000});await page.focus(selector);await page.keyboard.press('Enter');}
// No browser-side assertion helper or response replacement is installed.
async function ownView(page){return page.evaluate(async()=>{const response=await fetch('/api/rooms/'+location.pathname.split('/')[2]);if(!response.ok)throw new Error('View failed '+response.status);return response.json();});}
async function create(page,origin,kind){
 fixture=kind;stamp+=70000;
 await page.goto(origin,{waitUntil:'networkidle0'});
 await keyboard(page,'[data-focus=create-human]');await page.waitForSelector('[data-focus=start]');
 await keyboard(page,'[data-focus=start]');await page.waitForSelector('.watch-panel');
 return ownView(page);
}
async function fresh(page){await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await pause(150);}
try{
 const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const origin=`http://127.0.0.1:${port}`;report.origin=origin;
 const config={publicOrigin:origin,dataDir:path.join(output,'data'),now:()=>stamp,tickMs:80,ai:{provider:'demo',decisionIntervalMs:1000000,maxDailyCostUsd:0},rules:{moveCooldownMs:1,taskCooldownMs:10000,initialKillCooldownMs:1,killCooldownMs:1000000,sabotageCooldownMs:1,criticalDurationMs:5000,meetingCooldownMs:1,discussionMs:10000,votingMs:10000,roamDeadlineMs:300000,maxMatchMs:3600000}};
 // Crew AI's first action remains real; human-crew fixtures must not be killed during setup.
 const actualAi=createAiController({config:config.ai});
 game=await createGameServer(config,{engine:{...engine,createMatch:setupMatch},aiController:actualAi});
 const actualHandler=game.server.listeners('request')[0];game.server.removeAllListeners('request');
 game.server.on('request',(req,res)=>{if(forceAtAction!==null&&req.method==='POST'&&req.url.endsWith('/action')){stamp=forceAtAction;forceAtAction=null;}actualHandler(req,res);});
 await new Promise(resolve=>game.server.listen(port,'127.0.0.1',resolve));
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,userDataDir:path.join(output,'profile'),args:['--disable-gpu','--no-first-run','--disable-default-apps']});
 report.browser=await browser.version();report.node=process.version;report.seeds=seeds;
 const context=await browser.createBrowserContext(),page=await context.newPage();
 page.setDefaultTimeout(8000);page.on('pageerror',error=>report.runtimeErrors.push(error.message));
 await page.setViewport({width:1440,height:1000});
 // Keep normal crew initial kill delay large; fixture critical uses the documented 1ms initial delay.
 config.rules.initialKillCooldownMs=1000000;
 const crew=await create(page,origin,'crew');report.crewRoom=crew.roomId;
 await check('new boundary: unavailable room inspection sends no action and preserves native focus',async entry=>{
  const requests=[];const handler=request=>{if(request.url().endsWith('/action'))requests.push(request);};page.on('request',handler);
  await keyboard(page,'[data-room=galley]');await pause(100);
  entry.feedback=await page.$eval('#feedback',node=>node.textContent);entry.active=await page.evaluate(()=>document.activeElement.getAttribute('data-room'));
  page.off('request',handler);assert.equal(requests.length,0);assert.equal(entry.active,'galley');assert.match(entry.feedback,/connected room/);
 });
 await check('new boundary: map room labels remain opaque/readable at 320, 390, 768 and desktop',async entry=>{
  entry.widths=[];
  for(const width of [320,390,768,1440]){
   await page.setViewport({width,height:1000});
   const value=await page.evaluate(()=>{const luminance=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};return ({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,rooms:[...document.querySelectorAll('[data-room]')].map(node=>({name:node.querySelector('strong').textContent,opacity:getComputedStyle(node).opacity,bounds:{width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height},color:getComputedStyle(node.querySelector('strong')).color,background:getComputedStyle(node).backgroundColor,labelContrast:ratio(getComputedStyle(node.querySelector('strong')).color,getComputedStyle(node).backgroundColor),occupantContrast:ratio(getComputedStyle(node.querySelector('.occupants')).color,getComputedStyle(node).backgroundColor)}))});});
   entry.widths.push(value);assert.equal(value.overflow,false);assert.equal(value.rooms.length,6);assert.ok(value.rooms.every(room=>room.opacity==='1'&&room.bounds.width>=44&&room.bounds.height>=44&&room.labelContrast>=4.5&&room.occupantContrast>=4.5));await shot(page,'map-'+width);
  }
 });
 await check('new counterexample: interrupted first spectator join can recover using the visible retry',async entry=>{
  const observerContext=await browser.createBrowserContext(),observer=await observerContext.newPage();const joins=[];let interrupted=false;
  try{
   await observer.setRequestInterception(true);observer.on('request',request=>{if(request.url().endsWith('/join')){joins.push(request.url());if(!interrupted){interrupted=true;request.abort('internetdisconnected');return;}}request.continue();});
   await observer.goto(origin+'/r/'+crew.roomId,{waitUntil:'networkidle0'});await observer.waitForSelector('[data-focus=reconnect]');
   await keyboard(observer,'[data-focus=reconnect]');await pause(800);
   entry.afterVisibleRetry={joinAttempts:joins.length,feedback:await observer.$eval('#feedback',node=>node.textContent),stillFinding:await observer.$('[data-focus=reconnect]')!==null};
   await shot(observer,'join-interrupted-visible-retry');
   await observer.reload({waitUntil:'networkidle0'});await observer.waitForSelector('.watch-panel');
   entry.reloadControl={joinAttempts:joins.length,seatId:(await ownView(observer)).seatId};
   assert.equal(entry.afterVisibleRetry.stillFinding,false,'Visible Retry connection remained stuck after a one-time pre-delivery join fault; reload alone recovers');
  }finally{await observerContext.close();}
 });
 await check('new boundary: one human browser switches crew/saboteur rooms without stale controls or lost seats',async entry=>{
  await keyboard(page,'[data-focus=leave-room]');fixture='saboteur';stamp+=70000;config.rules.initialKillCooldownMs=1;
  await keyboard(page,'[data-focus=create-human]');await page.waitForSelector('[data-focus=start]');await keyboard(page,'[data-focus=start]');await page.waitForSelector('[data-focus=sabotage]');
  const sab=await ownView(page);entry.saboteurRoom=sab.roomId;report.saboteurRoom=sab.roomId;
  assert.equal(sab.game.self.role,'saboteur');assert.equal(await page.$('.task-list'),null);
  await page.goBack({waitUntil:'networkidle0'});await page.waitForSelector('.task-list');
  const back=await ownView(page);assert.equal(back.roomId,crew.roomId);assert.equal(back.game.self.role,'crew');assert.equal(await page.$('[data-focus=sabotage]'),null);
  await page.goForward({waitUntil:'networkidle0'});await page.waitForSelector('[data-focus=sabotage]');
  const forward=await ownView(page);assert.equal(forward.roomId,sab.roomId);assert.equal(forward.seatId,'p1');entry.forwardRole=forward.game.self.role;
  assert.equal(await page.$('.task-list'),null);
 });
 await check('new counterexample: canceling elimination returns keyboard focus to its trigger',async entry=>{
  const available=await page.$('[data-focus=eliminate-p2]:not([disabled])');assert.ok(available,'Fixture keeps Pax locally available');
  await keyboard(page,'[data-focus=eliminate-p2]');await page.waitForSelector('.confirm');
  entry.confirmFocus=await page.evaluate(()=>document.activeElement.textContent);
  const cancel=await page.$('.confirm button:last-child');await cancel.focus();await page.keyboard.press('Enter');
  entry.afterCancel=await page.evaluate(()=>({tag:document.activeElement.tagName,key:document.activeElement.getAttribute('data-focus')}));
  await shot(page,'elimination-cancel-focus');
  assert.equal(entry.afterCancel.key,'eliminate-p2','Cancel removed the focused control and left focus on BODY instead of restoring the elimination trigger');
 });
 await check('new boundary: hidden critical deadline rejects late speech, ends by rules, and keeps a true role-revealed replay',async entry=>{
  const criticalContext=await browser.createBrowserContext(),critical=await criticalContext.newPage();critical.on('pageerror',error=>report.runtimeErrors.push(error.message));
  try{
   config.rules.initialKillCooldownMs=1;await critical.setViewport({width:390,height:844});const room=await create(critical,origin,'critical');assert.equal(room.game.self.role,'crew');
   assert.equal(room.game.phase,'discussion');assert.equal(room.game.meeting.reason,'report');await critical.waitForSelector('#council-message');
   const text='Unsaved near-critical draft';await critical.type('#council-message',text);await critical.evaluate(()=>{window.auditDraftNode=document.querySelector('#council-message');});
   const cover=await criticalContext.newPage();await cover.bringToFront();await critical.waitForFunction(()=>document.hidden,{timeout:5000});stamp+=20;await critical.bringToFront();await critical.waitForFunction(()=>!document.hidden,{timeout:5000});await critical.waitForSelector('#council-message');await cover.close();
   assert.equal(await critical.$eval('#council-message',node=>node.value),text);assert.equal(await critical.evaluate(()=>window.auditDraftNode===document.querySelector('#council-message')),true);
   const before=await ownView(critical);entry.criticalDeadline=before.game.sabotage.deadlineAt;assert.equal(before.game.phase,'discussion');
   forceAtAction=before.game.sabotage.deadlineAt;
   const response=critical.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/action'));
   await keyboard(critical,'[data-focus=send-message]');const rejected=await response;entry.status=rejected.status();
   await critical.waitForSelector('.results');const ended=await ownView(critical);entry.outcome=ended.game.outcome;
   assert.equal(entry.status,409);assert.equal(ended.game.outcome.reason,'critical');assert.equal(ended.game.outcome.at,entry.criticalDeadline);assert.ok(!ended.game.meeting.messages.some(message=>message.text===text));
   await keyboard(critical,'[data-focus=load-replay]');await critical.waitForSelector('#replay-step');await critical.focus('#replay-step');await critical.keyboard.press('End');
   assert.equal(await critical.$eval('#replay-step',node=>node.value===node.max),true);assert.equal(await critical.$eval('[data-focus=replay-next]',node=>node.disabled),true);
   await critical.keyboard.press('Home');assert.equal(await critical.$eval('[data-focus=replay-prev]',node=>node.disabled),true);
   const log=await critical.$eval('.replay-log',node=>node.textContent);assert.match(log,/Pax \(saboteur\) eliminated Vale \(crew\)/);assert.doesNotMatch(log,/You saw/);
   await shot(critical,'critical-deadline-replay-390');
  }finally{await criticalContext.close();}
 });
 await check('browser runtime exceptions absent in tested boundaries',async()=>assert.deepEqual(report.runtimeErrors,[]));
}catch(error){report.setupFailure=String(error.stack||error);console.error(report.setupFailure);}
finally{
 try{await browser?.close();}catch(error){report.cleanupErrors.push(String(error));}
 try{await game?.close();}catch(error){report.cleanupErrors.push(String(error));}
 report.sourceUnchanged=git('diff','--name-only',pin,'--','public','server','shared','package.json','package-lock.json')==='';
 report.summary={passed:report.cases.filter(entry=>entry.passed).length,failed:report.cases.filter(entry=>entry.passed===false).length};
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('AUDIT_EVIDENCE '+output);console.log(JSON.stringify(report.summary));
 // Fresh audit-owned data/profile paths remain inside this run. Preserve logs and screenshots.
 for(const name of ['profile','data']){const target=path.resolve(output,name);assert.ok(target.startsWith(path.resolve(output)+path.sep));await rm(target,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
 process.exitCode=report.setupFailure||report.summary.failed||report.cleanupErrors.length?1:0;
}
