/** Real browser + HTTP/WS + engine + demo controller. Seeded, accelerated QA only. */
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createGameServer} from '../server/transport.mjs';
import {loadConfig} from '../server/config.mjs';
import * as engine from '../server/engine/index.mjs';
import {ROOM_LAYOUT} from '../shared/contracts.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'_artifacts','browser-'+Date.now());await mkdir(output,{recursive:true});
const report={fixture:'Seeded QA, accelerated deadlines, real demo bots; no live provider calls.',checks:[],errors:[],consoleErrors:[],privacyChecks:0,screenshots:[],outcomes:[]};
const check=(condition,name)=>{report.checks.push({name,passed:!!condition});assert(condition,name);console.log('PASS '+name);};
let browser,game,activePage,skew=0,humanCreations=0;
const pending=new Set();
function safeRoom(room){
 if(!room?.game)return;
 const view=room.game;
 assert(!('aiContext' in room));assert(!('identities' in room));
 assert(!('memories' in (room.ai||{})));assert(!('requests' in view));assert(!('replay' in view));
 if(view.phase!=='ended')for(const player of view.players){assert(!Object.hasOwn(player,'role'));assert(!Object.hasOwn(player,'tasks'));}
 if(!room.seatId)assert.equal(view.self,null);else assert.equal(view.self?.id,room.seatId);
 if(['discussion','voting'].includes(view.phase))assert(view.meeting.votes.every(v=>!Object.hasOwn(v,'targetId')));
 report.privacyChecks++;
}
function track(promise){pending.add(promise);promise.catch(error=>report.errors.push(String(error))).finally(()=>pending.delete(promise));}
async function drain(){let timer;try{await Promise.race([Promise.allSettled([...pending]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('HTTP privacy audit did not drain within eight seconds')),8000);})]);}finally{clearTimeout(timer);}}
function seedFor(role){for(let i=0;i<100;i++){const seed='browser-fixture-'+role+'-'+i;if(engine.createMatch({id:'seed',seed,now:0}).players[0].role===role)return seed;}throw Error('No fixture seed');}
function nextRoom(from,to){const queue=[[from]],seen=new Set([from]);for(const route of queue){if(route.at(-1)===to)return route[1];for(const id of ROOM_LAYOUT.find(r=>r.id===route.at(-1)).neighbors)if(!seen.has(id)){seen.add(id);queue.push([...route,id]);}}}
async function clickText(page,label){await page.locator(`button::-p-text(${label})`).click();}
async function view(page){return page.evaluate(async()=>{const id=location.pathname.split('/')[2],r=await fetch('/api/rooms/'+id);if(!r.ok)throw Error('View status '+r.status);return r.json();});}
async function waitState(page,predicate,timeout=12000){const end=Date.now()+timeout;while(Date.now()<end){const r=await view(page);if(predicate(r))return r;await new Promise(r=>setTimeout(r,100));}throw Error('State wait expired');}
async function screenshot(page,name){const filename=name+'.png';await page.screenshot({path:path.join(output,filename),fullPage:true});report.screenshots.push(filename);}
async function taskAndReturn(page){
 let r=await view(page);const task=r.game.self.tasks.find(t=>!t.completed);assert(task);
 for(const target of [task.roomId,'bridge']){
  while((r=await view(page)).game.self.roomId!==target){
   const next=nextRoom(r.game.self.roomId,target);
   await page.waitForFunction(id=>{const b=document.querySelector(`[data-room="${id}"]`);return b&&!b.disabled&&b.getAttribute('aria-disabled')!=='true';},{timeout:8000},next);
   await page.locator(`[data-room="${next}"]`).click();await waitState(page,x=>x.game.self.roomId===next);
  }
  if(target===task.roomId){await page.locator(`[data-focus="task-${task.id}"]`).click();await waitState(page,x=>x.game.self.tasks.find(t=>t.id===task.id)?.completed);}
 }
}
async function finish(page,human){
 for(let i=0;i<250;i++){
  const r=await view(page);if(r.game.phase==='ended'){report.outcomes.push(r.game.outcome);return r;}
  assert.notEqual(r.game.phase,'paused','Fixture must finish with a rules-based winner');
  if(human&&r.game.self?.alive&&r.game.self.role==='crew'&&r.game.phase==='roam'){
   const task=r.game.self.tasks.find(t=>!t.completed);
   if(task){const action=task.roomId===r.game.self.roomId?{type:'task',taskId:task.id}:{type:'move',roomId:nextRoom(r.game.self.roomId,task.roomId)};
    if(r.game.availableActions.includes(action.type))await page.evaluate(async action=>{await fetch('/api/rooms/'+location.pathname.split('/')[2]+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),...action})});},action);
   }
  }
  skew+=2000;await new Promise(r=>setTimeout(r,100));
 }
 throw Error('Demo match did not finish within bounded QA steps');
}
try{
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:`http://127.0.0.1:${port}`,DATA_DIR:path.join(output,'state'),AI_PROVIDER:'demo'});
 config.tickMs=60;config.ai.decisionIntervalMs=250;config.now=()=>Date.now()+skew;
 config.rules={tasksPerCrew:4,moveCooldownMs:600,taskCooldownMs:8000,initialKillCooldownMs:45000,killCooldownMs:12000,sabotageCooldownMs:50000,criticalDurationMs:40000,discussionMs:18000,votingMs:10000,meetingCooldownMs:1000,roamDeadlineMs:180000,maxMatchMs:900000};
 game=await createGameServer(config,{engine:{...engine,createMatch:options=>engine.createMatch({...options,seed:options.mode==='human'?seedFor(humanCreations++===0?'crew':'saboteur'):'browser-spectator'})}});
 await new Promise(r=>game.server.listen(port,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${port}`;
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome'),headless:true,userDataDir:path.join(output,'chrome-profile'),args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();activePage=page;await page.setViewport({width:1440,height:1000});page.setDefaultTimeout(12000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 page.on('requestfinished',request=>{const response=request.response();if(response?.url().startsWith(origin+'/api/rooms')&&response.ok())track(response.json().then(r=>{if(r.game)safeRoom(r);}));});
 const cdp=await page.createCDPSession();await cdp.send('Network.enable');cdp.on('Network.webSocketFrameReceived',event=>{try{const value=JSON.parse(event.response.payloadData);if(value.type==='state')safeRoom(value.room);}catch(error){report.errors.push(String(error));}});
 await page.goto(origin,{waitUntil:'networkidle0'});await screenshot(page,'01-harbor-desktop');
 check((await page.title()).includes('Lantern Wake'),'Original game shell loads');
 await clickText(page,'Join the crew');await page.waitForSelector('button::-p-text(Start the watch)');await screenshot(page,'02-human-lobby');
 await clickText(page,'Start the watch');await page.waitForSelector('.watch-panel');
 let r=await view(page);check(r.game.self.role==='crew'&&r.seatId==='p1','Human receives exactly its own private role');
 check(await page.evaluate(()=>document.cookie===''),'Seat cookie is not readable by browser JavaScript');
 await taskAndReturn(page);check((await view(page)).game.self.tasks.some(t=>t.completed),'Human moves, performs a real task and returns to Bridge');
 await page.locator('[data-focus=meeting]').click();await page.waitForSelector('#council-message');
 const message='I checked the relay. <img src=x onerror=alert(1)> is only a log label.';
 await page.locator('#council-message').fill('');await page.type('#council-message',message,{delay:30});
 check(await page.$eval('#council-message',e=>e.value)===message,'Discussion draft and focus survive realtime updates while typing');
 await page.locator('[data-focus=send-message]').click();await waitState(page,x=>x.game.meeting.messages.some(m=>m.text===message));
 check(!(await page.$('img[src=x]')),'Player dialogue is text, never executable markup');await screenshot(page,'03-discussion-desktop');
 const humanId=r.roomId;
 const context=await browser.createBrowserContext(),observer=await context.newPage();await observer.setViewport({width:390,height:844});
 observer.on('pageerror',e=>report.errors.push(e.message));
 await observer.goto(origin+'/r/'+humanId,{waitUntil:'networkidle0'});const watched=await view(observer);safeRoom(watched);
 check(watched.seatId===null&&!watched.isHost&&watched.game.self===null,'Shared room link joins an independent public spectator');
 const forbidden=await observer.evaluate(async()=>{const r=await fetch('/api/rooms/'+location.pathname.split('/')[2]+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),type:'wait'})});return r.status;});check(forbidden===403,'Spectator cannot act as a keeper');
 await screenshot(observer,'04-spectator-mobile');await context.close();
 await page.reload({waitUntil:'networkidle0'});r=await view(page);check(r.seatId==='p1'&&r.game.self.role==='crew','Reload restores the original human seat and permitted state');
 skew+=18000;await page.waitForSelector('[data-focus=vote-skip]');await page.locator('[data-focus=vote-skip]').click();
 await waitState(page,x=>x.game.meeting.votes.some(v=>v.playerId==='p1'));check(true,'Human can skip voting; ballot targets remain hidden until tally');
 await new Promise(r=>setTimeout(r,900));await screenshot(page,'05-voting');skew+=10000;
 await waitState(page,x=>x.game.phase!=='voting');await finish(page,true);await page.waitForSelector('.results');
 await clickText(page,'Load full replay');await page.waitForSelector('#replay-step');check(true,'Human-plus-AI match reaches victory and loads attributed replay');await screenshot(page,'06-human-results-replay');
 await clickText(page,'Leave room');await clickText(page,'Watch the keepers');await clickText(page,'Start the watch');await page.waitForSelector('.watch-panel');r=await view(page);
 check(r.game.self===null&&r.mode==='spectator','All-AI mode uses the same engine with no human private view');
 await page.setViewport({width:390,height:844});await screenshot(page,'07-all-ai-mobile');
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile game fits 390px without horizontal overflow');
 await page.setViewport({width:320,height:720});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile game fits 320px without horizontal overflow');
 await finish(page,false);await page.waitForSelector('.results');await clickText(page,'Load full replay');await page.waitForSelector('#replay-step');r=await view(page);
 check(r.game.players.every(p=>['crew','saboteur'].includes(p.role)),'Roles reveal after the all-AI match, not before');await screenshot(page,'08-all-ai-results-mobile');
 await drain();check(!report.errors.length,'No browser runtime or payload privacy failures');
 report.browser=await browser.version();report.rules=config.rules;
}catch(error){report.failure=String(error.stack||error);try{if(activePage)await screenshot(activePage,'failure');}catch{}throw error;}
finally{
 const failures=[];try{await browser?.close();}catch(e){failures.push(String(e));}try{await game?.close();}catch(e){failures.push(String(e));}
 try{await drain();}catch(error){failures.push(String(error));}report.cleanupErrors=failures;await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Browser evidence: '+output);
 if(failures.length)throw new Error('Browser qualification cleanup failed: '+failures.join('; '));
}
