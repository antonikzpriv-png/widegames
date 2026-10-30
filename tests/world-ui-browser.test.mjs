import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import http from 'node:http';
import {taskKind} from '../public/world/model.mjs';

const enabled=process.env.LW_WORLD_BROWSER==='1',root=fileURLToPath(new URL('../',import.meta.url));
const runtime=path.resolve(process.env.LW_WORLD_RUNTIME||root);
const moduleAt=(base,rel)=>pathToFileURL(path.join(base,rel)).href;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const git=(base,...args)=>execFileSync('git',args,{cwd:base,encoding:'utf8'}).trim();
async function files(base,prefix){const absolute=path.join(base,prefix),stat=await import('node:fs/promises').then(fs=>fs.stat(absolute));return stat.isDirectory()?(await Promise.all((await readdir(absolute)).sort().map(name=>files(base,path.join(prefix,name))))).flat():[prefix];}
async function hashes(base,paths){const all=(await Promise.all(paths.map(p=>files(base,p)))).flat();return Object.fromEntries(await Promise.all(all.map(async p=>[p.replaceAll('\\','/'),createHash('sha256').update(await readFile(path.join(base,p))).digest('hex')])));}

test('world UI: real room APIs, walking leases, three task puzzles, council focus/vote, results and replay',{skip:!enabled,timeout:240000},async()=>{
 const puppeteerPath=process.env.LW_WORLD_PUPPETEER||path.join(root,'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js');
 const {default:puppeteer}=await import(pathToFileURL(puppeteerPath).href);
 const geometry=await import(moduleAt(runtime,'shared/world.mjs'));
 const actual=await import(moduleAt(runtime,'server/engine/index.mjs'));
 const {createGameServer}=await import(moduleAt(runtime,'server/transport.mjs'));
 await mkdir(path.join(root,'_artifacts'),{recursive:true});
 const evidence=await mkdtemp(path.join(root,'_artifacts/world-ui-'));
 const report={checkout:git(root,'rev-parse','HEAD'),modifiedPaths:git(root,'status','--short'),runtimeCheckout:git(runtime,'rev-parse','HEAD'),runtimeModifiedPaths:git(runtime,'status','--short'),fixture:'Real transport, cookies, WS and engine. Seeded roles/tasks, idle AI scheduling and a controlled clock; no API responses mocked. Long transit uses real navigate actions. Critical-council preconditions use legal engine actions by fixture AI seats; this is not a full demo-AI match or performance claim.',checks:[],errors:[],screenshots:[],cleanup:{}};
 const before={frontend:await hashes(root,['public/world','public/game.css']),runtime:await hashes(runtime,['server','shared','public/app.mjs','public/index.html','public/styles.css','public/world-input-envelope.mjs'])};
 await writeFile(path.join(evidence,'source-before.json'),JSON.stringify(before,null,2));await writeFile(path.join(evidence,'browser-driver.mjs'),await readFile(fileURLToPath(import.meta.url)));
 const dataDir=path.join(evidence,'data'),profile=path.join(evidence,'profile');await mkdir(dataDir);await mkdir(profile);
 let browser,server,offset=0,fixture='crew';const stamp=()=>Date.now()+offset,seeds={};
 for(let i=0;i<10000&&(!seeds.crew||!seeds.saboteur);i++){
  const state=actual.createMatch({id:'seed-probe',seed:String(i),world:true}),p=state.players[0];
  if(p.role==='saboteur')seeds.saboteur??=String(i);
  if(p.role==='crew'&&p.tasks.some(t=>t.roomId==='bridge')&&['bridge','lantern','archive'].every(roomId=>p.tasks.some(task=>task.roomId===roomId)))seeds.crew??=String(i);
 }
 assert.ok(seeds.crew&&seeds.saboteur,'Actual engine must supply role/task fixture seeds.');
 const engine={...actual,createMatch(options){let state=actual.createMatch({...options,now:options.now-5,seed:seeds[fixture==='critical'?'crew':fixture],world:true});if(fixture==='critical'){const actor=state.players.find(p=>p.role==='saboteur');const result=actual.applyAction(state,actor.id,{id:'fixture-critical',type:'sabotage'},options.now);assert.ok(result.accepted);state=result.state;}return state;}};
 const aiController={describe:()=>({mode:'demo',provider:'demo',strategy:'Idle scheduling fixture',calls:0,tokens:0,costUsd:0}),async decide(){return null;}};
 const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));const origin=`http://127.0.0.1:${port}`;
 let page;
 async function check(name,fn){try{const detail=await fn();report.checks.push({name,pass:true,detail});}catch(error){report.checks.push({name,pass:false,error:error.stack});throw error;}}
 async function shot(name){const file=path.join(evidence,`${name}.png`);await page.screenshot({path:file,fullPage:true});report.screenshots.push(file);}
 try{
  server=await createGameServer({publicOrigin:origin,dataDir,now:stamp,tickMs:30,worldMode:true,ai:{provider:'demo',decisionIntervalMs:1000,maxDailyCostUsd:0},rules:{moveCooldownMs:1,taskCooldownMs:1,initialKillCooldownMs:1,killCooldownMs:1,sabotageCooldownMs:1,meetingCooldownMs:1,discussionMs:20000,votingMs:20000,criticalDurationMs:60000,roamDeadlineMs:900000,maxMatchMs:3600000}},{engine,aiController,worldGeometry:geometry});
  const apiHandler=server.server.listeners('request')[0];server.server.removeAllListeners('request');
  server.server.on('request',(req,res)=>{
   if(req.url.startsWith('/api/')){apiHandler(req,res);return;}
   (async()=>{
    const pathname=new URL(req.url,origin).pathname;
    const own=pathname.startsWith('/world/')||pathname==='/game.css';
    const base=own?path.join(root,'public'):pathname.startsWith('/shared/')?runtime:path.join(runtime,'public');
    const rel=pathname==='/'||pathname.startsWith('/r/')?'index.html':pathname.slice(1);
    const file=path.resolve(base,rel);if(!file.startsWith(base+path.sep))throw new Error('Invalid static path');
    const body=await readFile(file),ext=path.extname(file);
    res.writeHead(200,{'Content-Type':({'.mjs':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'})[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
   })().catch(()=>{res.writeHead(404);res.end('Not found');});
  });
  await new Promise(resolve=>server.server.listen(port,'127.0.0.1',resolve));
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,userDataDir:profile,args:[...(process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[]),'--disable-gpu','--no-first-run','--disable-default-apps']});
  report.browserPid=browser.process()?.pid;report.browserVersion=await browser.version();report.nodeVersion=process.version;report.serverOrigin=origin;
  page=await browser.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));
  const requests=[];page.on('request',req=>{if(/\/(input|action|start)$/.test(req.url())){let body;try{body=JSON.parse(req.postData()||'{}');}catch{}requests.push({path:new URL(req.url()).pathname,body});}});
  const viewport=value=>page.setViewport({...value,hasTouch:true});
  await viewport({width:1440,height:1000});await page.goto(origin,{waitUntil:'networkidle0'});
  await page.click('[data-focus=create-human]');await page.waitForSelector('.lw-lobby:not([hidden])');let id=new URL(page.url()).pathname.split('/').pop();
  const view=()=>page.evaluate(async id=>(await fetch(`/api/rooms/${id}`)).json(),id);
  async function settleInput(){await pause(40);const latest=requests.filter(r=>r.path===`/api/rooms/${id}/input`).at(-1)?.body.seq||0;await page.waitForFunction(async({id,seq})=>{const view=await (await fetch('/api/rooms/'+id)).json();return view.game?.self?.inputSeq>=seq&&!view.game.self.moving;},{timeout:10000,polling:100},{id,seq:latest});}
  const realAction=async(type,fields={})=>{const response=await page.evaluate(async({id,type,fields})=>{const res=await fetch(`/api/rooms/${id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),type,...fields})});return {ok:res.ok,body:await res.json()};},{id,type,fields});assert.ok(response.ok,JSON.stringify(response.body));return response.body;};
  async function navigate(position){await settleInput();await realAction('navigate',{x:position.x,y:position.y});offset+=30000;await page.waitForFunction(async({id,position})=>{const view=await (await fetch('/api/rooms/'+id)).json();return view.game?.self?.position&&Math.hypot(view.game.self.position.x-position.x,view.game.self.position.y-position.y)<1&&!view.game.self.moving;},{timeout:12000,polling:100},{id,position});await pause(100);}
  await check('lobby: all six original keeper seats and real host start',async()=>{assert.equal(await page.$$eval('.lw-lobby-roster .lw-seat',nodes=>nodes.length),6);assert.equal(await page.$eval('.lw-lobby .lw-primary',n=>n.disabled),false);await shot('desktop-lobby');});
  await page.click('.lw-lobby .lw-primary');await page.waitForSelector('.lw-role-scene:not([hidden])');
  await check('crew assignment: private own role reveal, status and exit remain visible',async()=>{assert.equal((await view()).game.self.role,'crew');assert.match(await page.$eval('.lw-role-scene h1',n=>n.textContent),/CREW/);assert.equal(await page.$eval('.lw-exit',n=>n.getClientRects().length>0),true);await shot('desktop-role');});
  await page.click('.lw-role-scene .lw-primary');
  await check('real keyboard movement refreshes integer leases and stops after keyup',async()=>{const start=(await view()).game.self.position;await page.focus('.lw-world-canvas');await page.keyboard.down('d');try{await page.waitForFunction(async({id,x})=>(await (await fetch('/api/rooms/'+id)).json()).game.self.position.x>x+100,{timeout:10000,polling:100},{id,x:start.x});}finally{await page.keyboard.up('d');}await settleInput();const now=(await view()).game.self;report.movement={start,now,requests:requests.filter(r=>r.path.endsWith('/input'))};assert.ok(now.position.x>start.x+100);assert.equal(now.moving,false);const input=requests.filter(r=>r.path.endsWith('/input'));assert.ok(input.length>=4);assert.ok(input.every(r=>Number.isInteger(r.body.dx)&&Number.isInteger(r.body.dy)));const count=input.length;await pause(400);assert.equal(requests.filter(r=>r.path.endsWith('/input')).length,count);return {start,end:now.position,leases:count};});
  await check('stage layout and map: desktop, 320, 390, 768 and mobile landscape',async()=>{const output=[];for(const [width,height]of [[1440,1000],[320,740],[390,844],[768,1024],[844,390]]){await viewport({width,height});await pause(80);const rect=await page.$eval('.lw-world',n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}));assert.ok(rect.width<=width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot(`world-${width}x${height}`);output.push({width,height,stage:rect});}await viewport({width:1440,height:1000});await page.keyboard.press('m');assert.equal(await page.$eval('.lw-map-pane',n=>n.hidden),false);await shot('desktop-map');await page.keyboard.press('m');return output;});
  await check('actual touch joystick releases to zero; click-to-walk arrives without extrapolating position',async()=>{
   await page.evaluate(()=>{window.touchTrace=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])document.querySelector('.lw-joystick').addEventListener(type,event=>touchTrace.push({type,id:event.pointerId,x:event.clientX,y:event.clientY,hidden:document.hidden}),true);});const before=(await view()).game.self.position;const box=await page.$eval('.lw-joystick',n=>{const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
   await page.touchscreen.touchStart(box.x,box.y);await page.touchscreen.touchMove(box.x,box.y+30);try{await page.waitForFunction(async({id,y})=>(await (await fetch('/api/rooms/'+id)).json()).game.self.position.y>y+15,{timeout:10000,polling:100},{id,y:before.y});}finally{await page.touchscreen.touchEnd();report.pointerEvents=await page.evaluate(()=>touchTrace);}await settleInput();const touched=(await view()).game.self;report.touch={before,touched,events:await page.evaluate(()=>touchTrace),requests:requests.filter(r=>r.path.endsWith('/input'))};assert.ok(touched.position.y>before.y+15);assert.equal(touched.moving,false);
   await navigate(geometry.WORLD_STATIONS.bridge);await pause(300);const from=(await view()).game.self.position;await page.mouse.click(720-30*1.2,500+22*1.2);await page.waitForFunction(async({id,from})=>{const state=(await (await fetch('/api/rooms/'+id)).json()).game.self;return Math.hypot(state.position.x-from.x,state.position.y-from.y)>15&&!state.moving;},{timeout:12000,polling:100},{id,from});const clicked=(await view()).game.self;assert.ok(geometry.distance(from,clicked.position)>15);assert.equal(clicked.moving,false);await navigate(geometry.WORLD_STATIONS.bridge);
  });
  await check('synthetic blur event stops a real lease and idle updates preserve canvas identity',async()=>{await page.evaluate(()=>{window.originalCanvas=document.querySelector('.lw-world-canvas');});await page.focus('.lw-world-canvas');await page.keyboard.down('s');await pause(120);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('s');await settleInput();assert.equal((await view()).game.self.moving,false);assert.equal(await page.evaluate(()=>originalCanvas===document.querySelector('.lw-world-canvas')),true);await navigate(geometry.WORLD_STATIONS.bridge);});
  await check('an open task is invalidated by actual movement before any task request',async()=>{await page.waitForSelector('[data-world-action=use][aria-disabled=false]');await page.focus('.lw-world-canvas');await page.keyboard.press('e');await page.waitForSelector('.lw-task-modal');const before=requests.filter(r=>r.body?.type==='task').length;await navigate({x:680,y:320});await page.waitForSelector('.lw-task-modal',{hidden:true});assert.equal(requests.filter(r=>r.body?.type==='task').length,before);assert.match(await page.$eval('.lw-feedback',n=>n.textContent),/Station closed/);await navigate(geometry.WORLD_STATIONS.bridge);});
  await check('real spectator cookie + HTTP polling fallback exposes no private assignment or action controls',async()=>{
   const context=await browser.createBrowserContext(),visitor=await context.newPage();try{await visitor.setViewport({width:390,height:844});await visitor.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){throw new Error('Fixture: socket unavailable');}};});await visitor.goto(origin+'/r/'+id,{waitUntil:'networkidle0'});await visitor.waitForSelector('.lw-role');const safe=await visitor.evaluate(async id=>(await fetch('/api/rooms/'+id)).json(),id);assert.equal(safe.seatId,null);assert.equal(safe.game.self,null);assert.equal(await visitor.$eval('.lw-role',n=>n.textContent),'Spectator');assert.equal(await visitor.$eval('.lw-actions',n=>n.hidden),true);assert.equal(await visitor.$eval('.lw-role-scene',n=>n.hidden),true);const shotPath=path.join(evidence,'spectator-mobile.png');await visitor.screenshot({path:shotPath,fullPage:true});report.screenshots.push(shotPath);}finally{await context.close();await page.bringToFront();}
  });
  let tasks=(await view()).game.self.tasks;
  for(const kind of ['wires','tuning','sequence'])await check(`actual ${kind} task: puzzle gates one real task completion`,async()=>{
   const task=tasks.find(t=>taskKind(t)===kind);assert.ok(task);if(kind!=='wires'||task.roomId!=='bridge')await navigate(geometry.WORLD_STATIONS[task.roomId]);
   await page.waitForSelector('[data-world-action=use][aria-disabled=false]');await page.focus('.lw-world-canvas');const before=requests.filter(r=>r.body?.type==='task').length;await page.keyboard.press('e');await page.waitForSelector('.lw-task-modal');
   assert.equal(await page.$$eval('.lw-task-modal button',buttons=>buttons.some(button=>button.textContent==='Send completed task')),false);
   let current=(await view()).game.self.tasks.find(t=>t.id===task.id);
   const count=current.progress.total;
   while(current.progress.index<count){const progress=current.progress;
    if(kind==='wires'){await page.locator(`button::-p-text(Left cable ${progress.index+1})`).click();await page.locator(`button::-p-text(Right socket ${progress.index+1})`).click();}
    else if(kind==='tuning'){await page.focus('.lw-frequency-slider');await page.keyboard.press('Home');for(let i=0;i<progress.target;i++)await page.keyboard.press('ArrowRight');await page.click('.lw-puzzle-tuning button');}
    else {if(progress.index===0){await page.click(`[aria-label="Sequence tile ${progress.sequence[0]===1?2:1}"]`);await page.waitForFunction(()=>document.querySelector('.lw-puzzle-status')?.textContent.includes('incorrect'));}await page.locator(`button[aria-label="Sequence tile ${progress.sequence[progress.index]}"]`).click();}
    await page.waitForFunction(async({id,taskId,index})=>{const room=await (await fetch('/api/rooms/'+id)).json();return room.game.self.tasks.find(t=>t.id===taskId).progress.index>index;},{timeout:12000,polling:80},{id,taskId:task.id,index:progress.index});
    current=(await view()).game.self.tasks.find(t=>t.id===task.id);
   }
   await shot(`task-${kind}`);assert.equal(requests.filter(r=>r.body?.type==='task').length,before);await page.locator('button::-p-text(Send completed task)').click();await page.waitForSelector('.lw-task-modal',{hidden:true});assert.equal((await view()).game.self.tasks.find(t=>t.id===task.id).completed,true);assert.equal(requests.filter(r=>r.body?.type==='task').length,before+1);

  });
  await navigate(geometry.WORLD_BELL);
  await check('emergency transition + persistent live chat draft/focus and literal text',async()=>{
   await page.waitForSelector('[data-world-action=use][aria-disabled=false]');await page.focus('.lw-world-canvas');await page.keyboard.press('e');await page.waitForSelector('.lw-council:not([hidden])');assert.match(await page.$eval('.lw-meeting-transition',n=>n.textContent),/EMERGENCY/);
   await page.focus('.lw-chat-form textarea');await page.keyboard.type('I saw <b>Pax</b> near the bridge.');await page.evaluate(()=>{window.savedChat=document.querySelector('.lw-chat-form textarea');window.savedCanvas=document.querySelector('.lw-world-canvas');savedChat.setSelectionRange(5,10);});
   const inputCount=requests.filter(r=>r.path.endsWith('/input')).length;await pause(700);assert.equal(await page.evaluate(()=>savedChat===document.querySelector('.lw-chat-form textarea')&&document.activeElement===savedChat&&savedChat.selectionStart===5&&savedCanvas===document.querySelector('.lw-world-canvas')),true);assert.equal(requests.filter(r=>r.path.endsWith('/input')).length,inputCount);
   await page.click('.lw-chat-form button');await page.waitForFunction(()=>document.querySelector('.lw-chat-log')?.textContent.includes('<b>Pax</b>'));assert.equal(await page.$('.lw-chat-log b'),null);await shot('desktop-discussion');
   await viewport({width:320,height:740});await shot('mobile-discussion');await viewport({width:1440,height:1000});
  });
  offset+=22000;await page.waitForSelector('.lw-vote-button:not([hidden])');
  const saboteur=server.rooms.get(id).data.state.players.find(p=>p.role==='saboteur').id;
  await check('vote cast status hides targets until tally; server ejection ends match',async()=>{assert.ok((await view()).game.meeting.votes.every(v=>!Object.hasOwn(v,'targetId')));const targetName=(await view()).game.players.find(p=>p.id===saboteur).name;await page.click(`[aria-label="Vote to eject ${targetName}"]`);await page.waitForFunction(()=>document.querySelector('.lw-ballot-status')?.textContent.includes('Your vote is final'));assert.ok((await view()).game.meeting.votes.every(v=>!Object.hasOwn(v,'targetId')));await shot('desktop-vote');offset+=22000;await page.waitForSelector('.lw-results:not([hidden])');assert.equal((await view()).game.outcome.winner,'crew');});
  await check('role-revealed results/replay are attributed, readable and keyboard scrubbable',async()=>{await shot('desktop-results');await page.click('.lw-results>.lw-primary');await page.waitForSelector('.lw-replay:not([hidden])');const log=await page.$eval('.lw-replay-log',n=>n.textContent);assert.match(log,/voted to eject/);assert.match(log,/\(saboteur\)/);assert.doesNotMatch(log,/\{"(?:id|type)":/);await page.focus('.lw-replay input');await page.keyboard.press('End');assert.match(await page.$eval('.lw-replay-event',n=>n.textContent),/Roles revealed/);await shot('desktop-replay');await viewport({width:390,height:844});await shot('mobile-replay');await viewport({width:1440,height:1000});});
  await page.click('.lw-exit');fixture='saboteur';await page.click('[data-focus=create-human]');await page.waitForSelector('.lw-lobby:not([hidden])');id=new URL(page.url()).pathname.split('/').pop();await page.click('.lw-lobby .lw-primary');await page.waitForSelector('.lw-role-scene:not([hidden])');await shot('saboteur-role');await page.click('.lw-role-scene .lw-primary');
  await check('saboteur Q confirmation: keyboard Cancel restores only valid trigger; confirm is real',async()=>{assert.equal((await view()).game.self.role,'saboteur');await page.waitForSelector('[data-world-action=eliminate][aria-disabled=false]');await page.focus('.lw-world-canvas');await page.keyboard.press('q');await page.waitForSelector('.lw-confirm:not([hidden])');await page.keyboard.press('Enter');assert.equal(await page.$eval('[data-world-action=eliminate]',n=>document.activeElement===n),true);assert.equal((await view()).game.players.filter(p=>!p.alive).length,0);await page.keyboard.press('q');await page.click('.lw-confirm .lw-danger');await page.waitForFunction(()=>document.querySelector('[data-world-action=report]')?.getAttribute('aria-disabled')==='false');assert.equal((await view()).game.players.filter(p=>!p.alive).length,1);await shot('saboteur-fallen');});
  await check('report key opens actual reported-body council; no invented opponent roles',async()=>{await page.focus('.lw-world-canvas');await page.keyboard.press('r');await page.waitForSelector('.lw-council:not([hidden])');assert.equal((await view()).game.meeting.reason,'report');assert.match(await page.$eval('.lw-meeting-transition',n=>n.textContent),/REPORTED/);assert.ok((await view()).game.players.every(p=>!Object.hasOwn(p,'role')));await shot('report-council');});
  offset+=22000;await page.waitForSelector('.lw-vote-button:not([hidden])');
  await check('nonterminal ejection scene states only the role supplied by the safe server view',async()=>{const safe=await view(),target=safe.game.players.find(p=>p.alive&&p.id!=='p1');await page.click('[aria-label="Vote to eject '+target.name+'"]');offset+=22000;await page.waitForSelector('.lw-ejection:not([hidden])');assert.match(await page.$eval('.lw-ejection p:not(.lw-eyebrow)',n=>n.textContent),/not revealed/);await shot('ejection-scene');await page.click('.lw-ejection .lw-primary');});
  await page.click('.lw-exit');fixture='critical';await page.click('[data-focus=create-human]');await page.waitForSelector('.lw-lobby:not([hidden])');id=new URL(page.url()).pathname.split('/').pop();await page.click('.lw-lobby .lw-primary');await page.waitForSelector('.lw-role-scene:not([hidden])');await page.click('.lw-role-scene .lw-primary');
  await check('critical countdown stays visible on mobile; real crew USE contributes an actual repair',async()=>{await navigate(geometry.WORLD_STATIONS.engine);await viewport({width:390,height:844});assert.equal(await page.$eval('.lw-critical',n=>n.hidden),false);await shot('mobile-critical');await page.waitForSelector('[data-world-action=use][aria-disabled=false]');await page.focus('.lw-world-canvas');await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('.lw-critical')?.textContent.includes('1/2'));assert.equal((await view()).game.sabotage.repairsCompleted,1);assert.equal((await view()).game.availableActions.includes('repair'),false);await shot('mobile-critical-repair');await viewport({width:1440,height:1000});});
  await check('critical deadline continues through a real reported-body council',async()=>{
   // Legal engine actions by a fixture-controlled AI seat establish the body report.
   const entry=server.rooms.get(id);await entry.queue;let state=entry.data.state;const sab=state.players.find(p=>p.role==='saboteur');
   let result=actual.applyAction(state,sab.id,{id:'fixture-nav-sab',type:'navigate',...geometry.WORLD_STATIONS.bridge},stamp());assert.ok(result.accepted);state=actual.tick(result.state,stamp()+10000).state;offset+=10000;
   const victim=state.players.filter(p=>p.alive&&p.role==='crew'&&p.id!=='p1').sort((a,b)=>geometry.distance(sab.position,a.position)-geometry.distance(sab.position,b.position))[0];
   result=actual.applyAction(state,sab.id,{id:'fixture-nav-target',type:'navigate',x:victim.position.x,y:victim.position.y},stamp());assert.ok(result.accepted);state=actual.tick(result.state,stamp()+5000).state;offset+=5000;
   result=actual.applyAction(state,sab.id,{id:'fixture-eliminate',type:'eliminate',targetId:victim.id},stamp());assert.ok(result.accepted,JSON.stringify(result.error));state=result.state;result=actual.applyAction(state,sab.id,{id:'fixture-report',type:'report',bodyId:'body-'+victim.id},stamp());assert.ok(result.accepted);entry.data={...entry.data,state:result.state};
   await page.waitForSelector('.lw-council:not([hidden])');const before=(await view()).game.sabotage.deadlineAt;await page.focus('.lw-chat-form textarea');await page.keyboard.type('Repair needed after council.');const draft=await page.$eval('.lw-chat-form textarea',n=>n.value);offset+=5000;await pause(160);assert.equal((await view()).game.sabotage.deadlineAt,before);assert.equal(await page.$eval('.lw-chat-form textarea',n=>n.value),draft);await shot('critical-council');
  });
  assert.deepEqual(report.errors,[]);
 }catch(error){report.failure=error.stack;if(page)await shot('failure').catch(()=>{});throw error;}
 finally{
  if(browser){await browser.close();report.cleanup.browserClosed=true;}
  if(server){await server.close();report.cleanup.serverClosed=true;}
  const after={frontend:await hashes(root,['public/world','public/game.css']),runtime:await hashes(runtime,['server','shared','public/app.mjs','public/index.html','public/styles.css','public/world-input-envelope.mjs'])};
  await writeFile(path.join(evidence,'source-after.json'),JSON.stringify(after,null,2));report.sourceUnchanged=JSON.stringify(before)===JSON.stringify(after);
  // Remove only this fresh fixture's owned profile/state, preserve every receipt/screenshot.
  for(const dir of [profile,dataDir]){assert.equal(path.dirname(dir),evidence);await rm(dir,{recursive:true,force:true});}report.cleanup.ownedDataRemoved=true;
  await writeFile(path.join(evidence,'report.json'),JSON.stringify(report,null,2));console.log(`World UI evidence: ${evidence}`);
  assert.ok(report.sourceUnchanged,'Runtime source changed during the browser run; receipt is not qualification.');
 }
});
