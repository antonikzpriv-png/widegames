/** Real expanded-map browser qualification. Seeded crew assignment, idle local bots
 * and an accelerated server clock; no remote CAPTCHA service or paid provider. */
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {getWorld,MAPS} from '../shared/world.mjs';
import {captchaChallenge} from '../shared/captcha.mjs';
import * as engine from '../server/engine/index.mjs';
import {createGameServer} from '../server/transport.mjs';
import {loadConfig} from '../server/config.mjs';
const expansions=['storm-foundry','tidal-observatory'],kinds=['glyphs','count','order','rotate','oddity','code'];
const root=path.resolve(import.meta.dirname,'..');await mkdir(path.join(root,'_artifacts'),{recursive:true});const output=await mkdtemp(path.join(root,'_artifacts/maps-captcha-browser-'));
const report={fixture:'Actual app, HTTP, cookie identity, map geometry, engine task steps and private store; seeded crew assignment, idle demo bots and accelerated movement time. Native UI selects and solves original game CAPTCHA puzzles; no external CAPTCHA service or provider calls.',checks:[],errors:[],screenshots:[],maps:[]};
let browser,game,page,origin,skew=0;
const seeds={};for(const mapId of expansions)for(let seed=0;seed<100&&!Object.hasOwn(seeds,mapId);seed++){const s=engine.createMatch({id:'seed',world:true,mapId,seed,now:1000});if(s.players[0].role==='crew')seeds[mapId]=seed;}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const check=(value,label)=>{assert(value,label);report.checks.push(label);console.log('PASS '+label);};
async function view(target=page){return target.evaluate(async()=>{const res=await fetch('/api/rooms/'+location.pathname.split('/')[2]);if(!res.ok)throw Error('Room '+res.status);return res.json();});}
async function until(predicate,label){for(let i=0;i<180;i++){const room=await view();if(predicate(room))return room;await pause(70);}throw Error('Timed out '+label);}
async function press(label){await page.locator(`button::-p-text(${label})`).click();}
async function shot(label){const filename=label+'.png';await page.screenshot({path:path.join(output,filename),fullPage:true});report.screenshots.push(filename);}
async function action(body){return page.evaluate(async body=>{const res=await fetch('/api/rooms/'+location.pathname.split('/')[2]+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),...body})});return {status:res.status,body:await res.json()};},body);}
async function navigate(position){const current=await view(),w=getWorld(current.game.mapId,current.game.mapRevision??1),route=w.findWorldPath(current.game.self.position,position);assert(route);let length=0,previous=current.game.self.position;for(const p of route){length+=w.distance(previous,p);previous=p;}const proposed=await action({type:'navigate',x:position.x,y:position.y});assert.equal(proposed.status,200);skew+=Math.ceil(length/w.WORLD.speed*1000)+120;await until(r=>w.distance(r.game.self.position,position)<1&&!r.game.self.moving,'map station arrival');}
function chooseAnswer(c){const puzzle=captchaChallenge(c);switch(c.kind){case 'glyphs':return puzzle.tiles.flatMap((glyph,i)=>glyph===puzzle.target?[i]:[]);case 'count':return puzzle.tiles.filter(glyph=>glyph===puzzle.target).length;case 'order':return [...puzzle.items].sort((a,b)=>a-b)[c.index];case 'rotate':return {north:'aligned',east:'left',south:'half',west:'right'}[puzzle.direction];case 'oddity':{const counts=new Map();for(const glyph of puzzle.tiles)counts.set(glyph,(counts.get(glyph)||0)+1);return puzzle.tiles.findIndex(glyph=>counts.get(glyph)===1);}case 'code':return puzzle.code;}}
try{
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));origin=`http://127.0.0.1:${port}`;
 const config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:path.join(output,'data'),AI_PROVIDER:'demo'});config.mapRevision=2;config.now=()=>Date.now()+skew;config.tickMs=40;config.rules={initialKillCooldownMs:300000,sabotageCooldownMs:300000,roamDeadlineMs:800000,maxMatchMs:1800000,taskCooldownMs:1};
 game=await createGameServer(config,{engine:{...engine,createMatch:o=>engine.createMatch({...o,seed:seeds[o.mapId||'beacon']??0})},aiController:{describe:()=>({mode:'demo',provider:'demo',strategy:'Idle expanded-map browser fixture'}),decide:async()=>null}});await new Promise(r=>game.server.listen(port,'127.0.0.1',r));
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/google-chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));await page.setViewport({width:1440,height:1000});await page.goto(origin,{waitUntil:'domcontentloaded'});
 for(const mapId of expansions){const map=getWorld(mapId,2),meta=MAPS.find(m=>m.id===mapId);await page.locator('.harbor-play').click();await page.waitForSelector('.lw-lobby',{visible:true});await page.select('.lw-map-select',mapId);check(await page.$eval('.lw-map-description',n=>n.textContent.length>25),mapId+' displays original map description');await shot(mapId+'-lobby');await press('Begin the watch');await page.waitForSelector('.lw-role-scene',{visible:true});await page.locator('.lw-role-scene button').click();await page.waitForSelector('.lw-connection[data-connected="true"]');let room=await view();check(room.game.mapId===mapId,mapId+' lobby selection reaches engine');check(room.game.tasks.total===60&&room.game.self.tasks.length===12,mapId+' starts sixty original tasks');check(room.game.self.role==='crew',mapId+' fixture keeps a real private crew assignment');
  await page.locator('.lw-map-toggle').click();await shot(mapId+'-overview');await page.locator('.lw-map-close').click();await page.waitForSelector('.lw-map-pane',{hidden:true});
  const mapReceipt={mapId,name:meta.name,kinds:[],rooms:map.WORLD_ROOMS.length,taskTotal:room.game.tasks.total};
  for(const kind of kinds){room=await view();const task=room.game.self.tasks.find(t=>t.progress.kind===kind&&!t.completed);assert(task,kind+' exists in assigned work');await navigate(map.WORLD_STATIONS[task.roomId]);await page.waitForSelector('.lw-connection[data-connected="true"]');await page.focus('.lw-world-canvas');await page.keyboard.press('e');await page.waitForSelector('.lw-task-modal',{visible:true});let current=(await view()).game.self.tasks.find(t=>t.id===task.id);
   const denied=await action({type:'task',taskId:task.id});check(denied.status===409&&denied.body.error.code==='TASK_INCOMPLETE',mapId+' '+kind+' cannot skip server steps');
   await shot(mapId+'-'+kind);
   if(kind==='glyphs'){await page.setViewport({width:390,height:844});await shot(mapId+'-glyphs-mobile');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.$eval('[data-captcha-index="0"]',n=>n.getBoundingClientRect().width>=44),mapId+' mobile CAPTCHA tiles fit and have touch-sized targets');await page.setViewport({width:1440,height:1000});}
   while(current.progress.index<current.progress.total){const c=current.progress,answer=chooseAnswer(c);assert(answer!==undefined,'independent display answer for '+kind);
    if(kind==='glyphs'){for(const i of answer)await page.locator(`[data-captcha-index="${i}"]`).click();await page.locator('[data-captcha-submit="glyphs"]').click();}
    else if(kind==='oddity')await page.locator(`[data-captcha-index="${answer}"]`).click();
    else if(kind==='code'){await page.locator('input[data-captcha-code]').fill(answer);await page.keyboard.press('Enter');}
    else await page.locator(`[data-captcha-answer="${answer}"]`).click();
    current=(await until(r=>r.game.self.tasks.find(t=>t.id===task.id).progress.index>c.index,kind+' accepted semantic input')).game.self.tasks.find(t=>t.id===task.id);
    await page.waitForFunction(()=>document.querySelector('.lw-task-modal button:not(:disabled)'));
   }
   await press('Send completed task');await until(r=>r.game.self.tasks.find(t=>t.id===task.id).completed,kind+' server completion');await page.waitForSelector('.lw-task-modal',{hidden:true});check((await view()).game.tasks.total===60,mapId+' '+kind+' completion preserves totals');mapReceipt.kinds.push(kind);
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.lw-connection[data-connected="true"]');if(await page.$('.lw-role-scene:not([hidden])'))await page.locator('.lw-role-scene button').click();room=await view();check(room.game.mapId===mapId&&room.game.self.tasks.filter(t=>t.completed).length===6,mapId+' reload restores selected map and six CAPTCHA completions');
  await page.setViewport({width:390,height:844});await shot(mapId+'-mobile');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),mapId+' mobile world fits viewport');await page.setViewport({width:1440,height:1000});report.maps.push(mapReceipt);await press('Exit');
 }
 check(report.errors.length===0,'No expanded-map browser page errors');
}catch(e){report.failure=e.stack;console.error(e);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}
finally{await browser?.close();await game?.close();await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Expanded-map evidence: '+output);}
