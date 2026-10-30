/** Real native app/API and Chromium. Fixtures use legal engine actions, no providers. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {createGameServer} from '../server/transport.mjs';
import {spatialFixture} from '../tests/spatial-replay-fixture.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));await mkdir(path.join(root,'_artifacts'),{recursive:true});const output=await mkdtemp(path.join(root,'_artifacts/spatial-browser-'));
const report={fixture:'Seeded legal engine actions and accelerated clocks produce a completed match. Native app, authenticated HTTP and WebSocket paths; demo/idle scheduling, no provider calls. This is playback qualification, not a full AI strategy evaluation.',checks:[],screenshots:[],errors:[],consoleErrors:[],sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()};
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','public','server','shared'],{cwd:root,encoding:'utf8'}).trim().split('\n');
const hashes=async()=>Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(path.join(root,f))).digest('hex')]));const before=await hashes();
const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const origin=`http://127.0.0.1:${port}`;
let browser,game,page;const pause=ms=>new Promise(r=>setTimeout(r,ms));
function check(value,name){assert(value,name);report.checks.push(name);console.log('PASS '+name);}
async function shot(name){const file=name+'.png';if(name!=='01-live-ai-spectator')await page.$eval('.lw-replay',(n,claims)=>{const overlay=n.closest('.lw-scene-overlay');if(claims){const history=n.querySelector('.lw-replay-history');overlay.scrollTop+=history.getBoundingClientRect().top-160;}else overlay.scrollTop=n.offsetTop-150;},name.includes('perspective'));await page.screenshot({path:path.join(output,file),fullPage:true});report.screenshots.push(file);}
try{
 game=await createGameServer({publicOrigin:origin,dataDir:path.join(output,'state'),worldMode:true,tickMs:1000,ai:{provider:'demo'}},{aiController:{describe:()=>({mode:'demo',strategy:'demo',calls:0,tokens:0,costUsd:0}),async decide(){return null;}}});await new Promise(r=>game.server.listen(port,'127.0.0.1',r));
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,userDataDir:path.join(output,'profile'),args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage();page.setDefaultTimeout(14000);await page.setViewport({width:1440,height:1100});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 const writes=[];page.on('request',req=>{if(req.method()==='POST'&&req.url().includes('/api/rooms'))writes.push(new URL(req.url()).pathname);});
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.click('.harbor-watch');await page.waitForSelector('.lw-lobby:not([hidden])');await page.click('.lw-lobby .lw-primary');await page.waitForSelector('.lw-spectator:not([hidden])');
 const roomId=new URL(page.url()).pathname.split('/')[2];await page.select('[aria-label="Follow a keeper"]','p2');await page.select('[aria-label="Inspect world object"]','player:p2');const observer=await page.evaluate(async id=>(await fetch('/api/rooms/'+id).then(response=>response.json())).game,roomId);check(await page.$eval('.lw-inspector',n=>!n.hidden&&n.textContent.includes('Roles are revealed to observers'))&&observer.inspection?.mode==='all-ai-observer'&&observer.players.every(player=>!Object.hasOwn(player,'role')),'all-AI observer inspection reveals roles separately from redacted player views');await page.click('[aria-label="Close inspector"]');
 check(await page.$eval('.lw-ai',n=>n.textContent.includes('DEMO')),'live demo label remains visible');await shot('01-live-ai-spectator');
 const f=spatialFixture(roomId);await game.rooms.get(roomId).queue;game.rooms.get(roomId).data.state=f.state;
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.lw-results:not([hidden])');const beforePlayback=writes.length;
 await page.click('.lw-results>.lw-primary');await page.waitForSelector('.lw-replay-canvas');
 check(await page.$eval('.lw-replay-coverage',n=>n.textContent.includes('Full recorded history')),'new full recording loads from authoritative initial anchor');
 check(await page.$eval('.lw-replay-canvas',n=>n.width>300&&n.height>200&&n.getContext('2d').getImageData(n.width/2,n.height/2,1,1).data[3]>0),'initial paused replay paints the map immediately');
 check(await page.$eval('.lw-replay-usage',n=>n.textContent.includes('not provider invoices')),'recorded AI usage is labeled as reservations');await shot('02-spatial-overview');
 const navigate=f.replay.find(e=>e.action?.type==='navigate'&&e.route.length>1),fraction=f.replay.find(e=>!Number.isInteger(e.at));assert(fraction);
 async function seek(time){await page.$eval('.lw-replay-seek',(n,value)=>{n.value=String(value);n.dispatchEvent(new Event('input',{bubbles:true}));},time);const actual=await page.$eval('.lw-replay',n=>Number(n.dataset.replayTime));assert.equal(actual,time,'Exact fractional seek: requested '+time+'; observed '+actual);}
 await seek(navigate.at+1200.25);await page.select('[aria-label="Follow keeper"]',navigate.playerId);check(await page.$eval('.lw-replay-time',(n,value)=>n.textContent.includes(String(value)),navigate.at+1200.25),'fractional time scrub is not rounded');await shot('03-follow-recorded-route');
 await seek(fraction.at);check(await page.$eval('.lw-replay',n=>Number(n.dataset.replayTime))===fraction.at,'fractional authoritative arrival time is preserved');
 await page.select('[aria-label="Playback speed"]','4');await page.click('.lw-replay-toolbar button');await pause(350);await page.click('.lw-replay-toolbar button');const played=await page.$eval('.lw-replay',n=>Number(n.dataset.replayTime));check(played>fraction.at,'play/pause advances the replay clock at bounded speed');
 await seek(f.metadata.coverage.through);await page.select('[aria-label="Historical character perspective"]','p2');
 check(await page.$eval('.lw-replay-history',n=>n.textContent.includes('Recorded elimination observations: 1')),'character history distinguishes a captured witness from reconstructed visibility');
 check(await page.$eval('.lw-replay-history',n=>n.textContent.includes('Public claim')&&n.textContent.includes('No automatic truth verdict')),'claims and evidence are compared without a truth verdict');
 check(await page.$eval('.lw-replay-ballots',n=>n.textContent.includes('→')),'postgame ballots are overlaid');await shot('04-perspective-claims-and-ballots');
 const eventRange=await page.$('.lw-replay input');await eventRange.focus();await page.keyboard.press('Home');const start=await page.$eval('.lw-replay',n=>Number(n.dataset.replayTime));await page.keyboard.press('End');check(start===f.metadata.coverage.from&&await page.$eval('.lw-replay-event',n=>n.textContent.includes('Roles revealed')),'keyboard event seek returns consistently to start and final reveal');
 const tiedIndex=f.replay.findIndex(e=>e.type==='vote_result');
 await page.$eval('.lw-replay input',(n,value)=>{n.value=String(value);n.dispatchEvent(new Event('input',{bubbles:true}));},tiedIndex);
 check(await page.$eval('.lw-replay input',n=>Number(n.value))===tiedIndex&&await page.$eval('.lw-replay',n=>n.dataset.replayPhase)==='roam','equal-time event scrub preserves the causal prefix before the outcome');
 await page.select('[aria-label="Follow keeper"]','p4');await page.select('[aria-label="Historical character perspective"]','p4');await page.setViewport({width:1360,height:1000});await pause(100);
 check(await page.$eval('.lw-replay input',n=>Number(n.value))===tiedIndex&&await page.$eval('.lw-replay',n=>n.dataset.replayPhase)==='roam','following, perspective and resize preserve the selected equal-time event');
 await page.click('.lw-replay-toolbar button');check(await page.$eval('.lw-replay',n=>n.dataset.replayPhase)==='ended','play finishes remaining terminal events before restarting the watch');
 const bookmark=await page.$eval('[aria-label="Event bookmarks"]',n=>[...n.options].find(o=>o.text.includes('eliminated'))?.value);assert(bookmark);await page.select('[aria-label="Event bookmarks"]',bookmark);check(await page.$eval('.lw-replay-event',n=>n.textContent.includes('eliminated')),'event bookmarks seek real eliminations');
 await page.setViewport({width:390,height:844});await shot('05-mobile-spatial-replay');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'replay controls and map fit mobile width');
 await page.setViewport({width:1440,height:1100});await seek(f.metadata.coverage.from);await page.click('.lw-replay-toolbar button');const cover=await browser.newPage();await cover.bringToFront();await page.waitForFunction(()=>document.hidden);const hiddenTime=await page.$eval('.lw-replay',n=>Number(n.dataset.replayTime));await pause(300);check(await page.$eval('.lw-replay',n=>Number(n.dataset.replayTime))===hiddenTime,'hidden-page lifecycle pauses playback');await page.bringToFront();await cover.close();
 await page.click('.lw-exit');await page.waitForSelector('.harbor-watch');await page.keyboard.press('w');await pause(250);check(writes.length===beforePlayback,'playback, scrubbing, following and leave emit no game actions or movement');
 check(report.errors.length===0&&report.consoleErrors.length===0,'no browser or console errors');check(JSON.stringify(before)===JSON.stringify(await hashes()),'source files remain unchanged during real browser qualification');report.browser=await browser.version();report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;if(page)await shot('failure').catch(()=>{});console.error(error);}
finally{await browser?.close();await game?.close();report.cleanup={browserClosed:!!browser,serverClosed:!!game};await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Spatial replay evidence: '+output);}
