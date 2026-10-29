import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import http from 'node:http';
import {serveStatic} from '../server/static.mjs';
import {ROOM_LAYOUT} from '../shared/contracts.mjs';

// Opt in with an existing browser/driver; no downloads, providers, or extra dependencies.
const enabled=process.env.LW_UI_BROWSER==='1';
const root=fileURLToPath(new URL('../',import.meta.url));
const fromEnv=(key,fallback)=>pathToFileURL(path.resolve(process.env[key]||path.join(root,fallback))).href;

test('real backend: keyboard human play, spectator auth, fallback polling, council, results and replay',{skip:!enabled,timeout:180000},async()=>{
 const {default:puppeteer}=await import(fromEnv('LW_UI_PUPPETEER','node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'));
 const {createGameServer}=await import(fromEnv('LW_UI_TRANSPORT','server/transport.mjs'));
 const actualEngine=await import(fromEnv('LW_UI_ENGINE','server/engine/index.mjs'));
 let fixture='crew';
 const seeds={};
 for(let i=0;!seeds.crew||!seeds.saboteur;i++){
  const candidate=actualEngine.createMatch({id:'fixture',seed:String(i)});
  const role=candidate.players.find(p=>p.id==='p1').role;
  seeds[role]??=String(i);
 }
 // Deterministic preconditions still use the real engine, transport, and demo AI.
 const engine={...actualEngine,createMatch(options){
  const special=fixture==='saboteur'||fixture==='critical';
  const state=actualEngine.createMatch({...options,now:fixture==='critical'?options.now-1:options.now,seed:seeds[fixture==='saboteur'?'saboteur':'crew'],config:{...options.config,...(special?{initialKillCooldownMs:fixture==='saboteur'?1:500000,sabotageCooldownMs:1}:{})}});
  if(fixture!=='critical')return state;
  const saboteur=state.players.find(p=>p.role==='saboteur');
  return actualEngine.applyAction(state,saboteur.id,{id:'fixture-sabotage',type:'sabotage'},options.now).state;
 }};
 const {createAiController}=await import(fromEnv('LW_UI_AI','server/ai/index.mjs'));
 const artifacts=path.join(root,'tests','ui-artifacts');await mkdir(artifacts,{recursive:true});
 const dataDir=await mkdtemp(path.join(artifacts,'data-'));
 const profile=await mkdtemp(path.join(artifacts,'browser-'));
 const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const origin=`http://127.0.0.1:${port}`;
 let stamp=Date.now(),browser,game;
 const errors=[];
 try{
  const ai={provider:'demo',decisionIntervalMs:1000,maxDailyCostUsd:0};
  game=await createGameServer({publicOrigin:origin,dataDir,now:()=>stamp,tickMs:20,ai,rules:{tasksPerCrew:1,moveCooldownMs:1,taskCooldownMs:1,initialKillCooldownMs:500000,sabotageCooldownMs:500000,meetingCooldownMs:1,discussionMs:10000,votingMs:10000,roamDeadlineMs:300000,maxMatchMs:3600000}},{engine,aiController:createAiController({config:ai})});
  // Keep the actual transport handler for every API request, serve this worktree's UI.
  const handler=game.server.listeners('request')[0];game.server.removeAllListeners('request');
  game.server.on('request',(req,res)=>req.url.startsWith('/api/')?handler(req,res):serveStatic(req,res));
  await new Promise(resolve=>game.server.listen(port,'127.0.0.1',resolve));
  browser=await puppeteer.launch({executablePath:process.env.LW_UI_EXECUTABLE,headless:true,userDataDir:profile,args:['--disable-gpu','--no-first-run','--disable-default-apps']});
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.setViewport({width:1440,height:1000});await page.goto(origin,{waitUntil:'networkidle0'});
  assert.equal(await page.$$eval('[data-room]',nodes=>nodes.length),6);
  await page.screenshot({path:path.join(artifacts,'desktop-home.png'),fullPage:true});
  await page.click('#rules-toggle');await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#rules-toggle',node=>document.activeElement===node),true);
  await page.focus('[data-focus=create-human]');await page.keyboard.press('Enter');
  await page.waitForSelector('[data-focus=start]');
  const roomUrl=page.url();let id=new URL(roomUrl).pathname.split('/').pop();
  await page.setViewport({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(artifacts,'mobile-lobby.png'),fullPage:true});
  await page.focus('[data-focus=start]');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.body.textContent.includes('Your assignment'));
  const view=()=>page.evaluate(async id=>(await fetch(`/api/rooms/${id}`)).json(),id);
  let state=await view();assert.equal(state.seatId,'p1');assert.equal(state.game.self.id,'p1');
  const spectatorContext=await browser.createBrowserContext();const spectator=await spectatorContext.newPage();
  const joins=[];spectator.on('request',req=>{if(req.url().endsWith('/join'))joins.push(req.url());});
  // Exercise the shipped polling fallback without changing HTTP responses.
  await spectator.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){throw new Error('WebSocket unavailable for fallback test');}};});
  await spectator.goto(roomUrl,{waitUntil:'networkidle0'});
  await spectator.waitForFunction(()=>document.body.textContent.includes('You are a spectator.'));
  assert.equal(joins.length,1);await spectator.reload({waitUntil:'networkidle0'});assert.equal(joins.length,1);
  assert.equal(await spectator.$eval('.connection',node=>node.textContent.includes('Polling')),true);
  assert.equal(await spectator.$('[data-focus=meeting]'),null);
  async function fresh(){stamp+=5;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await new Promise(resolve=>setTimeout(resolve,100));}
  async function walkTo(target){
   let current=(await view()).game.self.roomId;
   const queue=[[current]],seen=new Set();let route;
   while(queue.length){const candidate=queue.shift(),tail=candidate.at(-1);if(tail===target){route=candidate;break;}if(seen.has(tail))continue;seen.add(tail);for(const neighbor of ROOM_LAYOUT.find(r=>r.id===tail).neighbors)queue.push([...candidate,neighbor]);}
   for(const next of route.slice(1)){await fresh();await page.waitForSelector(`[data-room=${next}][aria-disabled=false]`);await page.focus(`[data-room=${next}]`);await page.keyboard.press('Enter');await page.waitForFunction(next=>document.querySelector(`[data-room=${next}]`)?.classList.contains('current'),{},next);}
  }
  if(state.game.self.role==='crew'){
   const task=state.game.self.tasks.find(t=>!t.completed);await walkTo(task.roomId);await fresh();
   await page.waitForSelector(`[data-focus=task-${task.id}]:not([disabled])`);await page.click(`[data-focus=task-${task.id}]`);
   await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Task complete'));
  }
  await walkTo('bridge');await fresh();
  await page.waitForSelector('[data-focus=meeting]:not([disabled])');await page.click('[data-focus=meeting]');
  await page.waitForSelector('#council-message:not([disabled])');
  const message='<img src=x onerror=alert(1)> I saw the bridge.';
  await page.type('#council-message',message);
  await page.waitForFunction(text=>document.querySelector('#council-message')?.value===text,{},message);
  await page.evaluate(()=>{globalThis.uiMessageNode=document.querySelector('#council-message');});
  await new Promise(resolve=>setTimeout(resolve,2200));
  assert.equal(await page.evaluate(()=>globalThis.uiMessageNode===document.querySelector('#council-message')),true);
  assert.equal(await page.$eval('#council-message',node=>node.value),message);
  assert.equal(await page.$eval('#council-message',node=>node===document.activeElement),true);
  await page.focus('[data-focus=send-message]');await page.keyboard.press('Enter');
  await page.waitForFunction(text=>[...document.querySelectorAll('.dialogue p')].some(node=>node.textContent===text),{},message);
  assert.equal(await page.$('.dialogue img'),null);
  await page.screenshot({path:path.join(artifacts,'mobile-discussion.png'),fullPage:true});
  stamp+=10001;
  await page.waitForSelector('[data-focus=vote-skip]:not([disabled])');
  await spectator.waitForFunction(()=>document.body.textContent.includes('Cast your vote'));
  await page.focus('[data-focus=vote-skip]');await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.vote-status')?.textContent.includes('Your vote is recorded'));
  await page.screenshot({path:path.join(artifacts,'mobile-voting.png'),fullPage:true});
  stamp+=10001;
  // Continue the real demo AI and engine on the accelerated test clock.
  for(let step=0;step<150;step++){
   await new Promise(resolve=>setTimeout(resolve,160));state=await view();
   if(state.game.phase==='ended')break;
   stamp+=2000;
  }
  assert.equal(state.game.phase,'ended','real demo match must finish');
  await page.waitForSelector('[data-focus=load-replay]');await page.click('[data-focus=load-replay]');
  await page.waitForSelector('#replay-step');await page.focus('#replay-step');await page.keyboard.press('ArrowRight');
  assert.equal(await page.$eval('#replay-step',node=>Number(node.value)>0),true);
  assert.equal(await page.$$eval('.revealed li .tag',nodes=>nodes.filter(node=>node.textContent==='saboteur').length),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(artifacts,'mobile-results.png'),fullPage:true});
  await page.setViewport({width:1440,height:1100});await page.screenshot({path:path.join(artifacts,'desktop-results.png'),fullPage:true});
  assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),['lantern-room']);
  await page.reload({waitUntil:'networkidle0'});assert.equal((await view()).seatId,'p1');
  await spectator.goto(origin,{waitUntil:'networkidle0'});
  // A new context can create a six-AI spectator room from the public landing.
  await spectator.click('[data-focus=leave-room]');await spectator.click('[data-focus=create-spectator]');
  await spectator.waitForSelector('[data-focus=start]');await spectator.click('[data-focus=start]');
  await spectator.waitForFunction(()=>document.body.textContent.includes('You are a spectator.'));
  assert.equal(await spectator.$('[data-focus=meeting]'),null);
  assert.match(await spectator.$eval('.tag.demo',node=>node.textContent),/Demo/);
  fixture='saboteur';
  await page.click('[data-focus=leave-room]');await page.click('[data-focus=create-human]');
  await page.waitForSelector('[data-focus=start]');await page.click('[data-focus=start]');
  id=new URL(page.url()).pathname.split('/').pop();await fresh();
  await page.waitForSelector('[data-focus=sabotage]:not([disabled])');
  await page.click('[data-focus=sabotage]');
  await page.waitForFunction(()=>document.querySelector('.critical')?.textContent.includes('Critical system failing'));
  await spectator.goto(page.url(),{waitUntil:'networkidle0'});
  const observed=await spectator.evaluate(async id=>(await (await fetch(`/api/rooms/${id}`)).json()).game.players,id);
  const target=observed.find(player=>player.id!=='p1'&&player.alive);
  await walkTo(target.roomId);await fresh();
  await page.waitForSelector(`[data-focus=eliminate-${target.id}]:not([disabled])`);
  await page.click(`[data-focus=eliminate-${target.id}]`);
  assert.match(await page.$eval('.confirm',node=>node.textContent),/cannot be undone/);
  await page.click(`[data-focus=eliminate-${target.id}]`);
  await page.waitForSelector(`[data-focus=report-body-${target.id}]`);
  await page.screenshot({path:path.join(artifacts,'desktop-saboteur-report.png'),fullPage:true});
  await page.click(`[data-focus=report-body-${target.id}]`);
  await page.waitForSelector('.council');
  assert.match(await page.$eval('.council',node=>node.textContent),/reported a fallen keeper/);
  fixture='critical';
  await page.click('[data-focus=leave-room]');await page.click('[data-focus=create-human]');
  await page.waitForSelector('[data-focus=start]');await page.click('[data-focus=start]');
  id=new URL(page.url()).pathname.split('/').pop();
  await page.waitForSelector('.watch-panel');
  await walkTo('engine');await fresh();
  await page.waitForSelector('[data-focus=repair]:not([disabled])');await page.click('[data-focus=repair]');
  await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('Repair contribution received'));
  assert.equal((await view()).game.sabotage.repairsCompleted,1);
  await page.screenshot({path:path.join(artifacts,'desktop-critical-repair.png'),fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{
  if(browser)await browser.close();if(game)await game.close();
  // Both paths are fresh test-owned directories beneath this worktree's artifacts.
  for(const dir of [dataDir,profile]){assert.ok(path.resolve(dir).startsWith(path.resolve(artifacts)+path.sep));await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
 }
});
