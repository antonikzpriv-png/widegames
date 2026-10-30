/** Real optional-preset browser qualification; seeded roles, idle bots, accelerated clock.
 * Fixture deaths use legal authoritative engine actions. No provider calls or invented outcomes. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import * as engine from '../server/engine/index.mjs';
import {createGameServer} from '../server/transport.mjs';
import {loadConfig} from '../server/config.mjs';
import {WORLD,WORLD_STATIONS,distance,findWorldPath} from '../shared/world.mjs';
const root=path.resolve(import.meta.dirname,'..');await mkdir(path.join(root,'_artifacts'),{recursive:true});const output=await mkdtemp(path.join(root,'_artifacts/ghost-abilities-browser-'));
const report={fixture:'Real app, HTTP, WebSocket, cookie identity, engine and persistence; seeded assignments, idle demo bots and an accelerated server clock. The fixture saboteur submits legal engine actions. No paid calls.',checks:[],errors:[],screenshots:[]};
let skew=0,fixture='ward',browser,game,page,origin;
const features={deathPolicy:'ghost-tasks',abilities:true};
const seeds={};
for(let i=0;i<10000&&(!seeds.ward||!seeds.echo);i++){
 const s=engine.createMatch({id:'seed',seed:i,world:true,features});
 if(s.players[0].ability?.type==='ward'&&s.players[0].tasks.some(t=>t.roomId==='bridge'))seeds.ward??=i;
 if(s.players[0].ability?.type==='echo')seeds.echo??=i;
}
const check=(condition,name)=>{assert(condition,name);report.checks.push(name);console.log('PASS '+name);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function view(target=page){return target.evaluate(async()=>{const r=await fetch('/api/rooms/'+location.pathname.split('/')[2]);if(!r.ok)throw Error('Room response '+r.status);return r.json();});}
async function until(fn,label,target=page){for(let i=0;i<150;i++){const v=await view(target);if(fn(v))return v;await pause(80);}throw Error('Timed out: '+label);}
async function press(label){await page.locator(`button::-p-text(${label})`).click();}
async function shot(name){const file=name+'.png';await page.screenshot({path:path.join(output,file),fullPage:true});report.screenshots.push(file);}
async function navigate(position){
 const current=await view(),route=findWorldPath(current.game.self.position,position);assert(route);let length=0,previous=current.game.self.position;for(const p of route){length+=distance(previous,p);previous=p;}
 const r=await page.evaluate(async position=>{const res=await fetch('/api/rooms/'+location.pathname.split('/')[2]+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),type:'navigate',x:position.x,y:position.y})});return res.status;},position);assert.equal(r,200);
 skew+=Math.ceil(length/WORLD.speed*1000)+100;return until(v=>distance(v.game.self.position,position)<1&&!v.game.self.moving,'walk to station');
}
async function fixtureAction(roomId,actor,action){
 const entry=game.rooms.get(roomId);const work=entry.queue.then(()=>{const r=engine.applyAction(entry.data.state,actor,{id:crypto.randomUUID(),...action},Date.now()+skew);assert(r.accepted,JSON.stringify(r.error));entry.data={...entry.data,state:r.state,updatedAt:Date.now()+skew};});entry.queue=work.catch(()=>{});await work;
}
async function newWatch(){await page.locator('.harbor-play').click();await page.waitForSelector('.lw-lobby',{visible:true});await page.select('.lw-death-policy','ghost-tasks');await page.$eval('.lw-ability-preset',n=>{if(!n.checked)n.click();});}
async function begin(){await press('Begin the watch');await page.waitForSelector('.lw-role-scene',{visible:true});await press('Enter the beacon');await page.waitForSelector('.lw-connection[data-connected="true"]');}
try{
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));origin=`http://127.0.0.1:${port}`;
 const config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:path.join(output,'data'),AI_PROVIDER:'demo'});// Retain main's original world2 five-puzzle/ghost contract as a separate gate.
 config.tacticalMode=false;config.systemsMode=false;config.stationTasksMode=false;config.mapRevision=1;config.now=()=>Date.now()+skew;config.tickMs=30;config.rules={initialKillCooldownMs:1,killCooldownMs:100,meetingCooldownMs:1};
 game=await createGameServer(config,{engine:{...engine,createMatch:o=>engine.createMatch({...o,seed:seeds[fixture]})},aiController:{describe:()=>({mode:'demo',provider:'demo',strategy:'Idle browser fixture'}),decide:async()=>null}});await new Promise(r=>game.server.listen(port,'127.0.0.1',r));
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));await page.setViewport({width:1440,height:1000});await page.goto(origin,{waitUntil:'domcontentloaded'});
 await newWatch();await shot('01-optional-lobby');await begin();let state=await view();const roomId=state.roomId;check(state.game.features.deathPolicy==='ghost-tasks'&&state.game.features.abilities,'Lobby selections reach real persisted match');check(state.game.self.ability.type==='ward'&&state.game.self.role==='crew','Harbor Ward assignment is separate from crew faction');
 await page.select('.lw-ward-target','p1');await page.locator('.lw-action-protect').click();await until(v=>v.game.effects.some(e=>e.kind==='ward'),'ward activation');check((await view()).game.effects[0].targetId==='p1','Ward target selector activates real one-hit protection');await shot('02-harbor-ward');
 // Let the actual protection deadline pass, then legally approach and attack.
 skew+=8100;await until(v=>v.game.effects.length===0,'ward expiration');
 let stored=game.rooms.get(roomId).data.state;const sab=stored.players.find(p=>p.role==='saboteur');await fixtureAction(roomId,sab.id,{type:'navigate',x:stored.players[0].position.x,y:stored.players[0].position.y});skew+=1500;
 for(let i=0;i<100;i++){stored=game.rooms.get(roomId).data.state;if(distance(stored.players.find(p=>p.id===sab.id).position,stored.players[0].position)<=WORLD.killRadius)break;await pause(40);}
 await fixtureAction(roomId,sab.id,{type:'eliminate',targetId:'p1'});await page.waitForFunction(async()=>{const r=await (await fetch('/api/rooms/'+location.pathname.split('/')[2])).json();return r.game.self.ghost;});await page.waitForSelector('.lw-ghost-chat',{visible:true});
 state=await view();const corpse=structuredClone(game.rooms.get(roomId).data.state.bodies[0]);check(!state.game.self.alive&&state.game.self.ghost,'Eliminated human remains dead with playable ghost controls');
 await page.focus('.lw-world-canvas');await page.keyboard.down('d');await pause(350);await page.keyboard.up('d');await pause(200);check(distance((await view()).game.self.position,corpse.position)>5,'Ghost WASD reaches real authenticated input path');assert.deepEqual(game.rooms.get(roomId).data.state.bodies[0],corpse);
 await page.locator('[aria-label="Fallen chat"]').click();await page.waitForSelector('.lw-ghost-pane:not([hidden])');await page.type('.lw-ghost-pane textarea','Private fallen message <img src=x>');await page.locator('.lw-ghost-pane form button').click();await until(v=>v.game.ghostChat.length===1,'private chat acknowledgement');check(await page.$eval('.lw-ghost-chat ol',n=>n.textContent.includes('<img src=x>')),'Fallen chat renders literal text with no markup');check(!(await page.$('.lw-ghost-chat ol img')),'Fallen message cannot create HTML');await shot('03-ghost-tasks-chat');await page.locator('[aria-label="Close fallen chat"]').click();assert.equal(await page.$eval('.lw-ghost-toggle',n=>n.getAttribute('aria-expanded')),'false');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.lw-ghost-chat',{visible:true});await page.waitForSelector('.lw-connection[data-connected="true"]');
 check((await view()).game.self.ghost&&await page.$eval('.lw-role-scene',n=>n.hidden),'Ghost reload restores private identity without a living assignment modal');
 check(await page.$eval('.lw-action-protect',n=>n.hidden),'Fallen ability controls are unavailable');
 const context=await browser.createBrowserContext(),observer=await context.newPage();await observer.goto(origin+'/r/'+roomId,{waitUntil:'domcontentloaded'});await observer.waitForSelector('.lw-world');const seen=await view(observer);check(!seen.game.ghostChat&&seen.game.players.find(p=>p.id==='p1').position===null,'Authenticated spectator receives neither ghost chat nor ghost coordinates');check(await observer.$eval('.lw-ghost-chat',n=>n.hidden),'Public UI hides fallen channel');await context.close();await page.bringToFront();
 const task=(await view()).game.self.tasks.find(t=>t.roomId==='bridge');await navigate(WORLD_STATIONS.bridge);await page.waitForFunction(()=>document.querySelector('.lw-connection')?.dataset.connected==='true');await page.focus('.lw-world-canvas');await page.keyboard.press('e');await page.waitForSelector('.lw-task-modal',{visible:true});
 for(const n of [1,2,3]){await press(`Left cable ${n}`);await press(`Right socket ${n}`);await until(v=>v.game.self.tasks.find(t=>t.id===task.id).progress.index===n,'authoritative ghost wiring step');}await press('Send completed task');await until(v=>v.game.self.tasks.find(t=>t.id===task.id).completed,'ghost task completion');check(game.rooms.get(roomId).data.state.players[0].alive===false,'Ghost puzzle completes without resurrection');assert.deepEqual(game.rooms.get(roomId).data.state.bodies[0],corpse);check((await view()).game.tasks.total===15,'Ghost completion preserves task total and corpse');
 await page.setViewport({width:390,height:844});await shot('04-mobile-ghost');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile ghost controls fit viewport');await page.setViewport({width:1440,height:1000});
 await press('Exit');fixture='echo';await newWatch();await begin();state=await view();check(state.game.self.role==='saboteur'&&state.game.self.ability.type==='echo','Signal Echo assignment preserves saboteur faction');await page.locator('.lw-action-decoy').click();await until(v=>v.game.effects.some(e=>e.kind==='echo'),'echo activation');state=await view();check(state.game.effects[0].label==='Signal echo · distraction','Decoy is explicitly labeled and not an impersonated keeper');check(!state.game.events.some(e=>e.type==='eliminated'||e.type==='witness'),'Decoy forges no death or witness');await shot('05-signal-echo');
 skew+=6100;await until(v=>v.game.effects.length===0,'echo expiration');check((await view()).game.self.ability.readyAt>(await view()).game.serverNow,'Echo expires before its cooldown ends');
 check(report.errors.length===0,'No browser page errors');
}catch(error){report.failure=error.stack;console.error(error);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}
finally{if(browser)await browser.close();if(game)await game.close();await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Ghost/ability evidence: '+output);}
