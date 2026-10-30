/** Real HTTP/WS and independent cookie jars. Local demo fixtures; no paid calls. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {createGameServer} from '../server/transport.mjs';
import * as engine from '../server/engine/index.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
await mkdir('_artifacts',{recursive:true});const output=await mkdtemp(path.resolve('_artifacts/multiplayer-browser-'));
const report={sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),modifiedPaths:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),fixture:'Real server, app modules, independent browser contexts, cookies and WebSockets. Local idle AI and controlled clock; legal engine council votes by fixture AI actors finish the match. No paid calls.',checks:[],errors:[],screenshots:[]};
let browser,game,now=Date.now(),origin;
async function until(fn,label){for(let i=0;i<250;i++){const value=await fn();if(value)return value;await pause(40);}throw Error('Timed out: '+label);}
function check(value,label){assert(value,label);report.checks.push(label);console.log('PASS '+label);}
async function shot(page,label){const file=label+'.png';await page.screenshot({path:path.join(output,file),fullPage:true});report.screenshots.push(file);}
async function view(page){return page.evaluate(async()=>{const id=location.pathname.split('/')[2];return (await fetch('/api/rooms/'+id)).json();});}
async function press(page,text){await page.locator(`button::-p-text(${text})`).click();}
async function set(page,name,value){await page.$eval(`[name="${name}"]`,(node,v)=>{node.focus();if(node.type==='checkbox')node.checked=v;else node.value=String(v);node.dispatchEvent(new Event('input',{bubbles:true}));},value);}
async function action(page,type,fields={}){return page.evaluate(async({type,fields})=>{const id=location.pathname.split('/')[2],room=await (await fetch('/api/rooms/'+id)).json();const r=await fetch('/api/rooms/'+id+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),type,...fields,generation:room.generation,matchId:room.game.matchId})});if(!r.ok)throw Error(JSON.stringify(await r.json()));return r.json();},{type,fields});}
try{
 // Select an ephemeral port without exposing a preview.
 const {createServer}=await import('node:net'),probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));origin=`http://127.0.0.1:${port}`;
 game=await createGameServer({dataDir:path.join(output,'data'),publicOrigin:origin,worldMode:true,tickMs:20,now:()=>now,ai:{provider:'demo'},rules:{discussionMs:1000,votingMs:1000,meetingCooldownMs:1}},{aiController:{describe:()=>({mode:'demo'}),decide:async()=>null}});await new Promise(r=>game.server.listen(port,'127.0.0.1',r));
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const hostContext=await browser.createBrowserContext(),guestContext=await browser.createBrowserContext(),observerContext=await browser.createBrowserContext();
 const host=await hostContext.newPage(),guest=await guestContext.newPage(),observer=await observerContext.newPage();
 for(const page of [host,guest,observer]){page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));await page.setViewport({width:1440,height:1000});}
 await host.bringToFront();await host.goto(origin,{waitUntil:'networkidle0'});await press(host,'PLAY AS A KEEPER');await host.waitForSelector('.lw-lobby-settings');
 await set(host,'capacity',15);await set(host,'saboteurs',3);await set(host,'speed',240);await set(host,'vision',420);await host.select('.lw-death-policy','ghost-tasks');await host.$eval('.lw-ability-preset',n=>{if(!n.checked)n.click();});await host.evaluate(()=>document.activeElement.blur());await pause(2200);check(await host.$eval('[name=capacity]',n=>n.value)==='15'&&await host.$eval('[name=saboteurs]',n=>n.value)==='3','unsaved settings survive focus loss and room refresh');await press(host,'Apply settings');await until(async()=> (await view(host)).settings.capacity===15,'host settings applied');
 check(await host.$$eval('.lw-seat',nodes=>nodes.length)===15,'15 keeper roster rendered');
 const initial=await view(host),id=initial.roomId,code=initial.inviteCode;
 await guest.bringToFront();await guest.goto(origin,{waitUntil:'networkidle0'});await guest.type('[aria-label="Invitation code"]',code);await press(guest,'Join friends');await guest.waitForSelector('.lw-lobby');
 await press(guest,'Claim a keeper');await until(async()=>(await view(guest)).seatId==='p2','second human claims seat');
 check((await view(guest)).roomId===id,'invitation code opens the same room in a separate identity');
 await guest.$eval('[aria-label="Your keeper name"]',n=>{n.value='Rook';});await guest.select('[aria-label="Raincoat color"]','#73c9df');await press(guest,'Save appearance');await until(async()=>(await view(guest)).seats[1].name==='Rook','guest profile');
 await host.bringToFront();await host.$eval('[aria-label="Your keeper name"]',n=>{n.value='Marin';});await press(host,'Save appearance');await until(async()=>(await view(host)).seats[0].name==='Marin','host profile');
 check((await view(guest)).seats[1].color==='#73c9df','custom raincoat color persists with its unique numbered badge');
 check(await host.$eval('.lw-lobby-settings [name=capacity]',n=>!n.disabled),'host can configure settings');check(await guest.$eval('.lw-lobby-settings [name=capacity]',n=>n.disabled),'guest settings are read only');
 await shot(host,'01-configurable-lobby-15');await host.$eval('.lw-lobby',n=>{n.scrollTop=n.scrollHeight;});await shot(host,'01b-host-settings');await guest.setViewport({width:390,height:844});await shot(guest,'02-guest-lobby-mobile');
 check(await host.$$eval('.lw-lobby button',nodes=>nodes.find(n=>n.textContent==='Begin the watch').disabled),'start is gated by readiness');
 await press(guest,'Ready');await press(host,'Ready');await until(async()=>(await view(host)).seats.filter(p=>p.human).every(p=>p.ready),'both humans ready');await press(host,'Begin the watch');
 await host.waitForSelector('.lw-role-scene:not([hidden])');await guest.waitForSelector('.lw-role-scene:not([hidden])');
 const first=await view(host),second=await view(guest),matchId=first.game.matchId;
 check(first.game.self.id==='p1'&&second.game.self.id==='p2','independent identities receive only their own assignment');check(first.game.players.length===15&&first.game.settings.speed===240&&first.game.settings.vision===420,'game locks the selected roster and settings');
 check(first.game.features?.deathPolicy==='ghost-tasks'&&first.game.features?.abilities===true,'merged ghost and ability presets work in a 15-player lobby');
 check(first.game.players.every(p=>!('role'in p))&&second.game.players.every(p=>!('role'in p)),'human HTTP projections hide other roles');
 await press(host,'Enter the beacon');await press(guest,'Enter the beacon');await host.bringToFront();await host.focus('.lw-world-canvas');await host.keyboard.down('s');await pause(230);now+=300;await pause(100);await host.keyboard.up('s');await pause(150);
 const moving=await view(host),idle=await view(guest);check(moving.game.self.inputSeq>0&&idle.game.self.inputSeq===0,'one browser moves its own keeper without steering the other');await shot(host,'03-multiplayer-world');await guest.bringToFront();await until(async()=>!(await view(host)).game.self.moving,'host stopped before second human moves');const hostBefore=(await view(host)).game.self.position;await guest.focus('.lw-world-canvas');await guest.keyboard.down('s');await pause(220);now+=300;await pause(100);await guest.keyboard.up('s');await pause(120);const guestMoved=await view(guest),hostAfter=(await view(host)).game.self.position;check(guestMoved.game.self.inputSeq>0&&Math.hypot(hostAfter.x-hostBefore.x,hostAfter.y-hostBefore.y)<.01,'second human keyboard input cannot steer the host');await shot(guest,'03b-second-human-controls');
 await observer.goto(origin+'/r/'+id,{waitUntil:'networkidle0'});const publicView=await view(observer);check(publicView.seatId===null&&publicView.game.self===null,'active invitation admits spectators only');check(publicView.game.players.every(p=>!('role'in p)),'spectator HTTP projection hides all assignments');
 await guest.bringToFront();await guest.reload({waitUntil:'networkidle0'});check((await view(guest)).game.self.id==='p2','reload restores the second human seat');await press(guest,'Enter the beacon');
 // Real timeout council. Fixture AI votes use the authoritative engine, never fabricated winners.
 const room=game.rooms.get(id);now=room.data.state.deadlineAt;await until(async()=>(await view(host)).game.phase==='discussion','council');
 const saboteurs=room.data.state.players.filter(p=>p.role==='saboteur').map(p=>p.id);
 for(const [round,targetId]of saboteurs.entries()){
  if(round){now=room.data.state.deadlineAt;await until(()=>room.data.state.phase==='discussion','next council');}
  now=room.data.state.deadlineAt;await until(()=>room.data.state.phase==='voting','voting');
  for(const page of [host,guest]){const own=await view(page);if(own.game.self.alive)await action(page,'vote',{targetId});}
  // Serialize fixture AI votes behind any room work, using the same engine as HTTP.
  const vote=room.queue.catch(()=>{}).then(()=>{for(const player of room.data.state.players.filter(p=>p.alive&&!p.human)){room.data.state=engine.applyAction(room.data.state,player.id,{id:`fixture-vote-${round}-${player.id}`,type:'vote',targetId},now).state;}});room.queue=vote;await vote;
  now=room.data.state.deadlineAt;await until(()=>round===saboteurs.length-1?room.data.state.phase==='ended':room.data.state.phase==='roam','vote tally');
 }
 await host.bringToFront();await host.waitForSelector('.lw-results:not([hidden])');await shot(host,'04-completed-match');await press(host,'Open the role-revealed replay');await host.waitForSelector('.lw-replay:not([hidden])');
 check((await view(host)).game.outcome.winner==='crew','multi-saboteur match ends only after every saboteur is ejected');
 await press(host,'Rematch with this crew');await host.waitForSelector('.lw-lobby-settings');await until(async()=>(await view(guest)).game===null,'guest sees game-to-lobby transition');
 check((await view(host)).generation===2&&(await view(host)).inviteCode===code,'rematch retains the invitation and increments generation');check((await view(guest)).seatId==='p2','rematch retains both human seats');await shot(host,'05-rematch-lobby');await host.click('.lw-lobby-archives summary');await press(host,'Replay watch 1');await host.waitForSelector('.lw-archive-log li');check(await host.$$eval('.lw-archive-log li',nodes=>nodes.some(n=>n.textContent.includes('Roles revealed'))),'completed replay remains available privately after rematch');
 await guest.bringToFront();await press(guest,'Ready');await host.bringToFront();await press(host,'Begin the watch');await host.waitForSelector('.lw-role-scene:not([hidden])');
 const fresh=await view(host);check(fresh.game.features?.deathPolicy==='ghost-tasks'&&fresh.game.features?.abilities===true,'rematch preserves the merged optional feature presets');check(fresh.game.matchId!==matchId&&fresh.game.self.inputSeq===0&&fresh.game.version===1,'fresh match identity resets versions, controls and role reveal');await shot(host,'06-fresh-role-assignment');
 await press(host,'Enter the beacon');await guest.bringToFront();await guest.waitForSelector('.lw-role-scene:not([hidden])');await press(guest,'Enter the beacon');const guestIdentity=room.data.identities.find(i=>i.seatId==='p2');await until(()=>[...room.sockets].some(ws=>ws.identity.hash===guestIdentity.hash),'second human socket connected');await host.bringToFront();await press(host,'Manage crew');await host.waitForSelector('.lw-member-controls:not([hidden])');check(await host.$eval('.lw-member-controls',n=>n.textContent.includes('Rook #2')),'authenticated host management is available during the match');await shot(host,'07-active-host-controls');await press(host,'Revoke #2');await until(async()=>(await view(host)).seats[1].revoked,'host revocation');check(room.data.state.players.find(p=>p.id==='p2').human,'revoked active human seat stays idle without AI takeover');await guest.bringToFront();await guest.waitForSelector('.lw-connection[data-connected="false"]');check(await guest.evaluate(async()=> (await fetch('/api/rooms/'+location.pathname.split('/')[2])).status)===401,'revoked browser loses authorization and movement controls');
 check(report.errors.length===0,'no browser exceptions across join, gameplay and rematch');
}catch(error){if(browser)for(const [i,p]of (await browser.pages()).entries()){await shot(p,`failure-${i}`).catch(()=>{});console.error('PAGE',i,await p.evaluate(()=>({url:location.href,feedback:document.querySelector('.lw-feedback')?.textContent,inputs:[...document.querySelectorAll('.lw-lobby-settings input')].map(n=>[n.name,n.value,n.validity.valid,n.validationMessage])})).catch(()=>({})));}report.failure=String(error.stack||error);console.error(report.failure);process.exitCode=1;}
finally{await browser?.close();await game?.close();await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Multiplayer browser evidence: '+output);}
