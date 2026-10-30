/** Real app qualification. Seeded/accelerated demo fixtures; no paid provider. */
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import {createGameServer} from '../server/transport.mjs';
import {loadConfig} from '../server/config.mjs';
import * as engine from '../server/engine/index.mjs';
import {WORLD,WORLD_STATIONS,WORLD_BELL,distance,findWorldPath,canSeeWorldPoint} from '../shared/world.mjs';
import {taskKind} from '../public/world/model.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await mkdir(path.join(root,'_artifacts'),{recursive:true});const output=await mkdtemp(path.join(root,'_artifacts','world-browser-'));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const report={sourceCommit:git('rev-parse','HEAD'),modifiedPaths:git('status','--porcelain').split(/\r?\n/).filter(Boolean),fixture:'Actual app/main browser modules, native HTTP/WS, persistent store, seeded world engine and real labeled demo AI. Physical routes may use normal authenticated navigate requests and accelerated server time; no state/winner fabrication or provider calls.',checks:[],privacyChecks:0,errors:[],consoleErrors:[],screenshots:[],outcomes:[],inputPackets:0,puzzleKinds:[]};
let browser,game,page,origin,skew=0,auditClosed=false;const pending=new Set();
const runtimeFiles=git('ls-files','public','server','shared','package.json','package-lock.json').split(/\r?\n/);
async function hashes(){return Promise.all(runtimeFiles.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')]));}
const before=await hashes();
function check(value,name){report.checks.push({name,passed:!!value});assert(value,name);console.log('PASS '+name);}
function contrast(foreground,background){const luminance=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
function safeRoom(room){
 if(!room?.game)return;const view=room.game;assert.equal(view.worldVersion,1);assert(!('identities'in room)&&!('aiContext'in room)&&!('requests'in view)&&!('replay'in view));
 assert(!('memories'in (room.ai||{})));assert.equal(view.self?.id??null,room.seatId);
 for(const player of view.players){assert(!('motion'in player)&&!('tasks'in player)&&!('destination'in player)&&!('inputSeq'in player));if(view.phase!=='ended')assert(!('role'in player));if(view.self&&view.phase!=='ended'&&player.id!==view.self.id&&player.position)assert(canSeeWorldPoint(view.self.position,player.position));}
 if(view.phase==='voting')assert(view.meeting.votes.every(v=>!Object.hasOwn(v,'targetId')));
 report.privacyChecks++;
}
function track(promise){pending.add(promise);promise.catch(error=>report.errors.push(String(error))).finally(()=>pending.delete(promise));}
async function drain(){let timeout;try{await Promise.race([Promise.allSettled([...pending]),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Privacy checks did not drain')),8000);})]);}finally{clearTimeout(timeout);}}
function instrument(target,consoleGate=false){
 target.on('pageerror',error=>report.errors.push(error.message));if(consoleGate)target.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
 target.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/input'))try{const input=JSON.parse(request.postData());assert.deepEqual(Object.keys(input).sort(),['dx','dy','seq']);assert([input.dx,input.dy].every(n=>Number.isInteger(n)&&Math.abs(n)<=1));report.inputPackets++;}catch(error){report.errors.push(String(error));}});
 target.on('requestfinished',request=>{const response=request.response();if(!auditClosed&&response?.ok()&&response.url().startsWith(origin+'/api/rooms'))track(response.json().then(safeRoom));});
}
async function view(target=page){const room=await target.evaluate(async()=>{const id=location.pathname.split('/')[2],response=await fetch('/api/rooms/'+id);if(!response.ok)throw Error('State HTTP '+response.status);return response.json();});safeRoom(room);return room;}
async function until(predicate,label,target=page,timeout=14000){const end=Date.now()+timeout;while(Date.now()<end){const room=await view(target);if(predicate(room))return room;await pause(90);}throw Error('Timed out: '+label);}
async function press(label,target=page){await target.locator(`button::-p-text(${label})`).click();}
async function shot(name,target=page){const file=name+'.png';await target.screenshot({path:path.join(output,file),fullPage:true});report.screenshots.push(file);}
async function chronologicalReplay(name){const events=await page.evaluate(async()=>{const response=await fetch('/api/rooms/'+location.pathname.split('/')[2]+'/replay');if(!response.ok)throw Error('Replay not authorized');return (await response.json()).replay;});check(events.every((event,index)=>Number.isFinite(event.at)&&(!index||event.at>=events[index-1].at)),name+' exports actual replay in chronological order');}
async function propose(action,target=page){return target.evaluate(async action=>{const response=await fetch('/api/rooms/'+location.pathname.split('/')[2]+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),...action})});return {status:response.status,body:await response.json()};},action);}
async function navigate(position){
 const room=await view(),route=findWorldPath(room.game.self.position,position);assert(route,'fixture station must be physically reachable');let length=0,previous=room.game.self.position;for(const p of route){length+=distance(previous,p);previous=p;}
 const result=await propose({type:'navigate',x:position.x,y:position.y});assert.equal(result.status,200);
 skew+=Math.ceil(length/WORLD.speed*1000)+250;
 return until(r=>distance(r.game.self.position,position)<2&&!r.game.self.moving,'physical route arrival');
}
async function solveTask(task){
 await navigate(WORLD_STATIONS[task.roomId]);await page.focus('.lw-world-canvas');await page.keyboard.press('e');await page.waitForSelector('.lw-task-modal',{visible:true});
 const kind=await page.$eval('.lw-puzzle',node=>['wires','tuning','sequence'].find(kind=>node.classList.contains('lw-puzzle-'+kind)));assert(kind);report.puzzleKinds.push(kind);await shot('04-task-'+kind);
 if(kind==='wires')for(const n of [1,2,3]){await page.locator(`button[aria-label^="Left cable ${n}"]`).click();await page.locator(`button[aria-label^="Right socket ${n}"]`).click();}
 else if(kind==='tuning'){await page.$eval('.lw-frequency-slider',node=>{node.value='72';node.dispatchEvent(new Event('input',{bubbles:true}));});await press('Lock frequency');}
 else for(const n of [2,4,1,3])await page.locator(`button[aria-label="Sequence tile ${n}"]`).click();
 await press('Send completed task');await until(r=>r.game.self.tasks.find(t=>t.id===task.id)?.completed,'server task acknowledgement');await page.waitForSelector('.lw-task-modal',{hidden:true});
}
async function finish(){
 for(let step=0;step<450;step++){
  const room=await view();if(room.game.phase==='ended'){report.outcomes.push(room.game.outcome);return room;}
  assert.notEqual(room.game.phase,'paused','Fixture must finish by game rules');skew+=1500;await pause(85);
 }
 throw Error('Demo world match did not finish within bounded QA steps');
}
function seedForHuman(){
 for(let i=0;i<2500;i++){const seed='world-browser-'+i,state=engine.createMatch({id:'seed',seed}),self=state.players[0];if(self.role==='crew'&&self.tasks.some(t=>t.roomId==='bridge')&&new Set(self.tasks.map((task,index)=>taskKind(task,index))).size===3)return seed;}
 throw Error('Normal generated tasks must expose three actual puzzle kinds, including a Bridge task');
}
try{
 const humanSeed=seedForHuman(),probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));origin=`http://127.0.0.1:${port}`;
 const config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:path.join(output,'state'),AI_PROVIDER:'demo'});config.now=()=>Date.now()+skew;config.tickMs=65;config.ai.decisionIntervalMs=250;
 config.rules={tasksPerCrew:3,moveCooldownMs:200,taskCooldownMs:1200,initialKillCooldownMs:300000,killCooldownMs:15000,sabotageCooldownMs:300000,criticalDurationMs:40000,discussionMs:18000,votingMs:10000,meetingCooldownMs:1000,roamDeadlineMs:180000,maxMatchMs:900000};
 game=await createGameServer(config,{engine:{...engine,createMatch:options=>engine.createMatch({...options,seed:options.mode==='human'?humanSeed:'world-browser-spectator'})}});await new Promise(resolve=>game.server.listen(port,'127.0.0.1',resolve));
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome'),headless:true,userDataDir:path.join(output,'chrome-profile'),args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();page.setDefaultTimeout(14000);await page.setViewport({width:1440,height:1000});instrument(page,true);
 const cdp=await page.createCDPSession();await cdp.send('Network.enable');cdp.on('Network.webSocketFrameReceived',event=>{if(event.response.opcode!==1)return;try{const payload=JSON.parse(event.response.payloadData);if(payload.type==='state')safeRoom(payload.room);}catch(error){report.errors.push(String(error));}});
 await page.goto(origin,{waitUntil:'networkidle0'});await page.waitForSelector('.harbor-play');await shot('01-harbor');check((await page.title()).includes('Lantern Wake'),'Original character game menu loads');
 await page.locator('#rules-toggle').click();check(await page.$eval('#rules',node=>!node.hidden),'Menu help opens before joining');
 await page.locator('.harbor-play').click();await page.waitForSelector('.lw-lobby');check(await page.$eval('#rules',node=>node.hidden),'Open menu help closes before the full-screen game');await shot('02-lobby');await press('Begin the watch');await page.waitForSelector('.lw-role-scene',{visible:true});await page.hover('.lw-role-scene .lw-primary');report.hoverColors=await page.$eval('.lw-role-scene .lw-primary',node=>({foreground:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor}));check(contrast(report.hoverColors.foreground,report.hoverColors.background)>=4.5,'Hovered primary game button retains readable measured contrast');await shot('03-private-role');await press('Enter the beacon');
 let room=await view();check(room.game.worldVersion===1&&room.game.self.role==='crew','Normal production config starts a physical world and private human role');check(await page.evaluate(()=>document.cookie===''),'Room seat remains HttpOnly');
 check(await page.$eval('#world-host',node=>{const r=node.getBoundingClientRect();return Math.abs(r.height-innerHeight)<2&&Math.abs(r.width-innerWidth)<2&&Math.abs(r.x)<2&&Math.abs(r.y)<2;}),'Physical game fills the viewport without displaced content');
 const start=room.game.self.position;await page.focus('.lw-world-canvas');await page.keyboard.down('d');await page.keyboard.down('s');await pause(350);await page.keyboard.up('d');await page.keyboard.up('s');await pause(250);room=await view();check(room.game.self.position.x>start.x+5&&room.game.self.position.y>start.y+5,'WASD diagonal moves the actual character through validated integer input');await shot('03b-world');
 const routeIntent=await propose({type:'navigate',x:WORLD_STATIONS.engine.x,y:WORLD_STATIONS.engine.y});assert.equal(routeIntent.status,200);await until(r=>r.game.self.moving,'click-route starts');
 const cover=await browser.newPage();await cover.bringToFront();await page.waitForFunction(()=>document.hidden);const hiddenStop=await until(r=>!r.game.self.moving,'hidden page stop reaches server');const hiddenPosition=hiddenStop.game.self.position;assert(distance(hiddenPosition,WORLD_STATIONS.engine)>30);skew+=1000;await pause(200);check(distance((await view()).game.self.position,hiddenPosition)<.01,'Hiding the page cancels an authoritative walking route before arrival');await page.bringToFront();await cover.close();await page.waitForFunction(()=>!document.hidden);await page.waitForSelector('.lw-connection[data-connected="true"]');
 // Retain a Bridge task so crew cannot finish before we exercise council, and
 // verify that an out-of-range task does not hide the usable nearby bell.
 const bridgeTask=room.game.self.tasks.find(task=>task.roomId==='bridge');assert(bridgeTask);
 for(const task of room.game.self.tasks.filter(task=>task!==bridgeTask))await solveTask(task);
 await navigate(WORLD_BELL);check(!(await page.$eval('.lw-action-use',node=>node.disabled)),'A pending out-of-range Bridge task does not mask the emergency bell');await page.focus('.lw-world-canvas');await page.keyboard.press('e');await until(r=>r.game.phase==='discussion','emergency council');await page.waitForSelector('.lw-chat-form textarea',{visible:true});
 const message='I checked the signal. <img src=x onerror=alert(1)> is just text.';await page.type('.lw-chat-form textarea',message,{delay:15});await pause(550);check(await page.$eval('.lw-chat-form textarea',node=>node.value)===message,'Council draft and focus survive physical-world snapshots');await press('Send message');await until(r=>r.game.meeting.messages.some(m=>m.text===message),'public message');check(!(await page.$('.lw-chat-log img')),'Council dialogue renders literal text');await shot('05-council');
 const humanId=(await view()).roomId,context=await browser.createBrowserContext(),observer=await context.newPage();instrument(observer);await observer.setViewport({width:390,height:844});await observer.goto(origin+'/r/'+humanId,{waitUntil:'networkidle0'});const seen=await view(observer);check(seen.seatId===null&&seen.game.self===null&&!seen.isHost,'Shared room opens a role-private public spectator');await drain();await context.close();
 await drain();await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.lw-connection[data-connected="true"]');room=await view();check(room.seatId==='p1'&&room.game.self.role==='crew','Reload restores the same world identity and private role');
 // Browser work consumes real time too. Advance only the remaining deadline;
 // adding the full phase duration after a slow reload can skip voting entirely.
 room=await view();
 if(room.game.phase==='discussion')skew+=Math.max(0,room.game.deadlineAt-(Date.now()+skew))+100;
 else assert.equal(room.game.phase,'voting','Reload must retain the active council');
 await until(r=>r.game.phase==='voting','voting phase');await press('Skip ejection');await until(r=>r.game.meeting.votes.some(v=>v.playerId==='p1'),'skip ballot');await shot('06-vote');
 room=await view();
 if(room.game.phase==='voting')skew+=Math.max(0,room.game.deadlineAt-(Date.now()+skew))+100;
 else assert.equal(room.game.phase,'roam','A cast ballot must proceed to roaming');
 await until(r=>r.game.phase==='roam','roaming resumes after skip');await page.waitForFunction(()=>document.querySelector('.lw-world')?.dataset.phase==='roam');if(await page.$('.lw-role-scene:not([hidden])'))await press('Enter the beacon');if(await page.$('.lw-ejection:not([hidden])'))await press('Return to watch');await solveTask(bridgeTask);
 check(new Set(report.puzzleKinds).size===3,'Three real generated equipment minigames complete through UI and server acknowledgement');
 await finish();await page.waitForSelector('.lw-results',{visible:true});await press('Open the role-revealed replay');await page.waitForSelector('.lw-replay',{visible:true});check(true,'Human-plus-AI world reaches a rules-based victory and attributed replay');await chronologicalReplay('Human-plus-AI');await shot('07-human-replay');
 await press('Exit');await page.locator('.harbor-watch').click();await press('Begin the watch');room=await until(r=>r.mode==='spectator'&&r.game?.worldVersion===1,'all-AI match starts');check(room.game.self===null,'All-AI world uses the same authoritative engine without a human private view');
 await page.setViewport({width:390,height:844});await shot('08-all-ai-mobile');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'World and HUD fit mobile390');await page.setViewport({width:320,height:720});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'World and HUD fit mobile320');await page.setViewport({width:844,height:390});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'World and HUD fit mobile landscape');
 await finish();await page.waitForSelector('.lw-results',{visible:true});await press('Open the role-revealed replay');await page.waitForSelector('.lw-replay',{visible:true});room=await view();check(room.game.players.every(p=>['crew','saboteur'].includes(p.role)),'All-AI world finishes and reveals roles only after the match');await chronologicalReplay('All-AI');await shot('09-all-ai-replay');
 await drain();check(!report.errors.length,'No browser exceptions or unsafe returned world views');check(!report.consoleErrors.length,'No primary-page console errors');check(JSON.stringify(before)===JSON.stringify(await hashes()),'Runtime source remained unchanged during qualification');report.browser=await browser.version();report.rules=config.rules;report.humanSeed=humanSeed;
}catch(error){report.failure=String(error.stack||error);try{if(page)await shot('failure');}catch{}console.error(report.failure);process.exitCode=1;}
finally{
 const cleanupErrors=[];auditClosed=true;try{await drain();}catch(error){cleanupErrors.push(String(error));}try{await browser?.close();}catch(error){cleanupErrors.push(String(error));}try{await game?.close();}catch(error){cleanupErrors.push(String(error));}try{await drain();}catch(error){cleanupErrors.push(String(error));}
 report.cleanupErrors=cleanupErrors;report.summary={passed:report.checks.filter(c=>c.passed).length,failed:report.checks.filter(c=>!c.passed).length};await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('World browser evidence: '+output);if(cleanupErrors.length||report.errors.length||report.consoleErrors.length)process.exitCode=1;
}
