/** Actual revision-2 maps in the app: native controls, server routes, private
 * persistence and original vector artwork. Seeded crew, idle demo bots and an
 * accelerated clock make this a bounded offline visual qualification fixture. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {mkdir,mkdtemp,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {getWorld} from '../shared/world.mjs';
import {captchaChallenge} from '../shared/captcha.mjs';
import * as engine from '../server/engine/index.mjs';
import {createGameServer} from '../server/transport.mjs';
import {loadConfig} from '../server/config.mjs';

const ids=['beacon','storm-foundry','tidal-observatory'];
const root=path.resolve(import.meta.dirname,'..');
await mkdir(path.join(root,'_artifacts'),{recursive:true});
const output=await mkdtemp(path.join(root,'_artifacts/illustrated-maps-browser-'));
const report={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fixture:'Actual production app, HTTP/cookies, revision-2 collision/pathfinding, native task controls and persistent store. Seeded crew assignment, explicitly idle demo AI and accelerated server clock; no provider calls, response fabrication or artificial task completion.',checks:[],errors:[],consoleErrors:[],screenshots:[],maps:[]};
async function sources(directory){const files=[];for(const entry of await readdir(path.join(root,directory),{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())files.push(...await sources(file));else if(entry.isFile()&&/\.(?:mjs|css|html)$/.test(entry.name))files.push(file);}return files;}
async function hashes(){const files=(await Promise.all(['public','shared','server'].map(sources))).flat().sort();return Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')])));}
let browser,game,page,origin,skew=0,before;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(value,label)=>{assert(value,label);report.checks.push(label);console.log('PASS '+label);};
function safeRoom(room){
 assert(room?.game&&Array.isArray(room.game.players));
 if(room.game.phase!=='ended')for(const actor of room.game.players)assert(!Object.hasOwn(actor,'role'),'Other actor factions remain hidden');
 for(const actor of room.game.players)for(const key of ['tasks','motion','destination','requests','aiContext','inputSeq'])assert(!Object.hasOwn(actor,key),'Actor payload excludes private '+key);
 for(const key of ['requests','aiContext','replayHistory','replay','seed'])assert(!Object.hasOwn(room.game,key),'Room payload excludes '+key);
 return room;
}
async function view(target=page){return safeRoom(await target.evaluate(async()=>{const res=await fetch('/api/rooms/'+location.pathname.split('/')[2]);if(!res.ok)throw Error('State HTTP '+res.status);return res.json();}));}
async function until(predicate,label,target=page){for(let attempt=0;attempt<160;attempt++){const room=await view(target);if(predicate(room))return room;await pause(80);}throw Error('Timed out '+label);}
async function press(label){await page.locator(`button::-p-text(${label})`).click();}
async function shot(label,{canvas=false}={}){const file=label+'.png';if(canvas){const node=await page.$('.lw-map-pane:not([hidden]) .lw-mini-map')||await page.$('.lw-world-canvas');await node.screenshot({path:path.join(output,file)});}else await page.screenshot({path:path.join(output,file),fullPage:true});report.screenshots.push(file);}
async function action(body){return page.evaluate(async body=>{const res=await fetch('/api/rooms/'+location.pathname.split('/')[2]+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),...body})});return {status:res.status,body:await res.json()};},body);}
async function navigate(position){
 const current=await view(),w=getWorld(current.game.mapId||'beacon',current.game.mapRevision||1),route=w.findWorldPath(current.game.self.position,position);assert(route,'Collision-safe route exists');
 let length=0,previous=current.game.self.position;for(const p of route){assert(w.isWalkable(p),'Every waypoint is walkable');length+=w.distance(previous,p);previous=p;}
 const proposed=await action({type:'navigate',x:position.x,y:position.y});assert.equal(proposed.status,200,JSON.stringify(proposed.body));
 skew+=Math.ceil(length/w.WORLD.speed*1000)+180;
 await until(r=>w.distance(r.game.self.position,position)<1&&!r.game.self.moving,'real map station arrival');
 await pause(300);
 return route;
}
async function puzzleButton(label){
 await page.waitForFunction(label=>[...document.querySelectorAll('.lw-task-modal button')].some(button=>button.textContent===label&&!button.disabled),{},label);
 await page.evaluate(label=>[...document.querySelectorAll('.lw-task-modal button')].find(button=>button.textContent===label&&!button.disabled).focus(),label);
 await page.keyboard.press('Enter');
}
async function solve(task,map){
 await navigate(map.WORLD_STATIONS[task.roomId]);await page.focus('.lw-world-canvas');await page.keyboard.press('e');await page.waitForSelector('.lw-task-modal',{visible:true});
 let current=(await view()).game.self.tasks.find(t=>t.id===task.id);
 const kind=current.progress.kind;
 await shot(map.metadata.id+'-task-'+kind);
 while(current.progress.index<current.progress.total){
  const c=current.progress,display=captchaChallenge(c);
  if(kind==='wires'){await puzzleButton(`Left cable ${c.index+1}`);await puzzleButton(`Right socket ${c.index+1}`);}
  else if(kind==='sequence')await puzzleButton(String(c.sequence[c.index]));
  else if(kind==='pressure')await puzzleButton(c.index===0?(c.pressure<5?'Flow right to left':'Flow left to right'):`Transfer ${Math.abs(5-c.pressure)} bar`);
  else if(kind==='repair'){if(c.index===3)skew+=1600;await puzzleButton(['Isolate power','Replace fuse','Start diagnostic','Verify diagnostic'][c.index]);}
  else if(kind==='tuning'){await page.focus('.lw-frequency-slider');await page.keyboard.press('Home');for(let value=0;value<c.target;value++)await page.keyboard.press('ArrowRight');await puzzleButton('Lock frequency');}
  else if(kind==='glyphs'){for(const [i,glyph]of display.tiles.entries())if(glyph===display.target)await page.locator(`[data-captcha-index="${i}"]`).click();await page.locator('[data-captcha-submit="glyphs"]').click();}
  else if(kind==='oddity'){const answer=display.tiles.findIndex(glyph=>display.tiles.filter(other=>other===glyph).length===1);await page.locator(`[data-captcha-index="${answer}"]`).click();}
  else if(kind==='code'){await page.locator('input[data-captcha-code]').fill(display.code);await page.keyboard.press('Enter');}
  else {const answer=kind==='count'?display.tiles.filter(glyph=>glyph===display.target).length:kind==='order'?[...display.items].sort((a,b)=>a-b)[c.index]:{north:'aligned',east:'left',south:'half',west:'right'}[display.direction];await page.locator(`[data-captcha-answer="${answer}"]`).click();}
  current=(await until(r=>r.game.self.tasks.find(t=>t.id===task.id).progress.index>c.index,kind+' server-confirmed input')).game.self.tasks.find(t=>t.id===task.id);
 }
 await puzzleButton('Send completed task');await until(r=>r.game.self.tasks.find(t=>t.id===task.id).completed,'authoritative task completion');await page.waitForSelector('.lw-task-modal',{hidden:true});
 return kind;
}
try{
 before=await hashes();
 const seeds={};for(const mapId of ids)for(let seed=0;seed<100&&!Object.hasOwn(seeds,mapId);seed++)if(engine.createMatch({id:'seed',world:true,mapId,mapRevision:2,seed,now:1000}).players[0].role==='crew')seeds[mapId]=seed;
 const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));origin=`http://127.0.0.1:${port}`;
 const config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:path.join(output,'data'),AI_PROVIDER:'demo'});config.now=()=>Date.now()+skew;config.tickMs=40;config.rules={roamDeadlineMs:86400000,maxMatchMs:86400000,taskCooldownMs:1};
 game=await createGameServer(config,{engine:{...engine,createMatch:options=>engine.createMatch({...options,seed:seeds[options.mapId||'beacon']})},aiController:{describe:()=>({mode:'demo',provider:'demo',strategy:'Idle illustrated-map qualification fixture'}),decide:async()=>null}});
 await new Promise(resolve=>game.server.listen(port,'127.0.0.1',resolve));
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});await page.setViewport({width:1800,height:1200});await page.goto(origin,{waitUntil:'domcontentloaded'});
 for(const mapId of ids){
  const map=getWorld(mapId,2);await page.locator('.harbor-play').click();await page.waitForSelector('.lw-lobby',{visible:true});await page.select('.lw-map-select',mapId==='beacon'?'beacon-illustrated':mapId);await shot(mapId+'-lobby');await press('Begin the watch');await page.waitForSelector('.lw-role-scene',{visible:true});await page.locator('.lw-role-scene button').click();await page.waitForSelector('.lw-role-scene',{hidden:true});await page.waitForSelector('.lw-connection[data-connected="true"]');
  let room=await view();check((room.game.mapId||'beacon')===mapId&&room.game.mapRevision===2,mapId+' production lobby selects immutable revision-2 geometry');check(room.game.self.role==='crew'&&room.game.tasks.total===map.metadata.tasksPerCrew*5,mapId+' keeps real crew assignment and workload');
  await page.locator('.lw-map-toggle').click();await pause(250);await shot(mapId+'-overview');await shot(mapId+'-map-art',{canvas:true});await page.keyboard.press('m');await page.waitForSelector('.lw-map-pane',{hidden:true});check(await page.$eval('.lw-joystick',node=>!node.hidden),mapId+' closing the overview with M restores movement controls');await page.locator('.lw-map-toggle').click();await page.keyboard.press('Escape');await page.waitForSelector('.lw-map-pane',{hidden:true});check(await page.$eval('.lw-map-toggle',node=>node.getAttribute('aria-expanded')==='false'),mapId+' Escape closes the map accessibly');
  const receipt={mapId,revision:2,roomCount:map.WORLD_ROOMS.length,props:map.WORLD_OBSTACLES.length,rooms:[],tasks:[],total:room.game.tasks.total};
  const remaining=[...map.WORLD_ROOMS];
  while(remaining.length){const position=(await view()).game.self.position;remaining.sort((a,b)=>map.distance(position,map.WORLD_STATIONS[a.id])-map.distance(position,map.WORLD_STATIONS[b.id]));const r=remaining.shift(),route=await navigate(map.WORLD_STATIONS[r.id]);room=await view();check(room.game.self.roomId===r.id&&map.isWalkable(room.game.self.position),mapId+' reaches '+r.id+' through authoritative collision-safe navigation');receipt.rooms.push({id:r.id,waypoints:route.length});await shot(mapId+'-room-'+r.id,{canvas:true});}
  const task=(await view()).game.self.tasks.find(t=>!t.completed);receipt.tasks.push(await solve(task,map));check((await view()).game.self.tasks.find(t=>t.id===task.id).completed,mapId+' native equipment completes through server acknowledgment');
  const beforePosition=(await view()).game.self.position,prop=map.WORLD_OBSTACLES[0],blocked=await action({type:'navigate',x:prop.x+prop.width/2,y:prop.y+prop.height/2});check(blocked.status===409&&!map.isWalkable({x:prop.x+prop.width/2,y:prop.y+prop.height/2}),mapId+' illustrated machinery remains a server-owned collider');check(map.distance((await view()).game.self.position,beforePosition)<.01,mapId+' rejected obstacle route cannot move the actor');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.lw-connection[data-connected="true"]');await page.waitForSelector('.lw-role-scene',{visible:true});await page.locator('.lw-role-scene button').click();await page.waitForSelector('.lw-role-scene',{hidden:true});room=await view();check(room.game.mapRevision===2&&room.game.self.tasks.find(t=>t.id===task.id).completed,mapId+' reload retains layout revision and confirmed task');
  const context=await browser.createBrowserContext(),observer=await context.newPage();observer.on('pageerror',error=>report.errors.push(error.message));await observer.goto(origin+'/r/'+room.roomId,{waitUntil:'domcontentloaded'});await observer.waitForSelector('.lw-world');const seen=await view(observer);check(seen.seatId===null&&seen.game.self===null&&seen.game.mapRevision===2,mapId+' spectator sees correct artwork with private roles/tasks withheld');await context.close();await page.bringToFront();
  await page.setViewport({width:390,height:844});await pause(250);await shot(mapId+'-mobile');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),mapId+' mobile world fits viewport');await page.locator('.lw-map-toggle').click();await shot(mapId+'-mobile-overview');await page.locator('.lw-map-close').click();await page.waitForSelector('.lw-map-pane',{hidden:true});await page.setViewport({width:1800,height:1200});report.maps.push(receipt);await press('Exit');
 }
 check(report.errors.length===0,'No illustrated-map browser page errors');
 check(report.consoleErrors.length===ids.length&&report.consoleErrors.every(message=>message==='Failed to load resource: the server responded with a status of 409 (Conflict)'),'Only the three deliberately rejected collision requests produce console errors');
 check(JSON.stringify(before)===JSON.stringify(await hashes()),'Runtime source remains unchanged during real browser qualification');
 report.browser=await browser.version();report.passed=true;
}catch(error){report.failure=error.stack;console.error(error);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}
finally{await browser?.close();await game?.close();await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Illustrated-map evidence: '+output);}
