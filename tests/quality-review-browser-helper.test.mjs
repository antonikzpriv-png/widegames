/** Driver-unit controls, not native-browser qualification. All game views/actions
 * below come from the actual engine; only the browser control surface is stubbed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {exerciseNativeStationTask,verifyFinalArchive,assertPinnedDriver,assertCouncilGeometry,assertSelectedWardEffect,clickNativeCouncilControl} from '../scripts/quality-browser-check.mjs';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=process.env.QUALITY_REVIEW_ROOT?pathToFileURL(path.resolve(process.env.QUALITY_REVIEW_ROOT)+path.sep):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root)),{getMap}=await import(new URL('shared/maps/index.mjs',root)),{nextStationInput}=await import(new URL('shared/station-challenges.mjs',root));
function finalTask(){let state,actor;for(let seed=0;seed<40;seed++){state=engine.createMatch({id:'quality-driver-final-task',mode:'human',tactical:true,stationTasks:true,map:{id:'beacon',version:2},seed,now:1000,config:{tasksPerCrew:1,roamDeadlineMs:600000,maxMatchMs:900000,meetingCooldownMs:1}});actor=state.players.find(p=>p.human);if(actor.role==='crew'&&actor.tasks[0].challenge.kind==='signal')break;}assert.equal(actor.tasks[0]?.challenge.kind,'signal');const id=actor.id,taskId=actor.tasks[0].id,map=getMap(state.map);let now=1000,seq=0;
 const view=()=>engine.getPlayerView(state,id,now),act=(who,type,fields={})=>{const r=engine.applyAction(state,who,{id:'driver:'+ ++seq,type,...fields},now);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;},walk=(who,point)=>{act(who,'navigate',{x:point.x,y:point.y});let length=0,last=state.players.find(p=>p.id===who).position;for(const q of state.players.find(p=>p.id===who).motion.path){length+=map.geometry.distance(last,q);last=q;}now+=Math.ceil(length/map.geometry.WORLD.speed*1000)+1;state=engine.tick(state,now).state;};
 for(const p of state.players.filter(p=>p.role==='crew'&&p.id!==id)){const task=p.tasks[0];walk(p.id,map.geometry.WORLD_STATIONS[task.roomId]);while(!state.players.find(q=>q.id===p.id).tasks[0].completed){act(p.id,'taskInteract',{taskId:task.id,...nextStationInput(state.players.find(q=>q.id===p.id).tasks[0].challenge)});}}
 walk(id,map.geometry.WORLD_STATIONS[actor.tasks[0].roomId]);assert.equal(view().phase,'roam');assert.equal(view().tasks.completed,view().tasks.total-1);let chosen;
 const submit=async()=>{act(id,'taskInteract',{taskId,interactionId:'tune',value:String(chosen)});};
 const page={evaluate:async()=>({x:1,y:1,disabled:false,clickable:true}),viewport:()=>({isMobile:false}),mouse:{click:submit},waitForSelector:async()=>{},waitForFunction:async()=>{},$eval:async(_selector,_fn,target)=>{chosen=target;},locator:()=>({async click(){act(id,'taskInteract',{taskId,interactionId:'tune',value:String(chosen)});}})};
 return {page,taskId,readRoom:async()=>({game:view()}),view,die(){const sab=state.players.find(p=>p.role==='saboteur').id;walk(sab,state.players.find(p=>p.id===id).position);act(sab,'eliminate',{targetId:id});assert.equal(view().self.alive,false);},interrupt(){const caller=state.players.find(p=>p.id!==id&&p.role==='crew').id;walk(caller,map.geometry.WORLD_BELL);act(caller,'meeting');assert.equal(view().phase,'discussion');}};
}
test('driver permits a final native-input acknowledgement only when the real engine completes the task and outcome',async()=>{const f=finalTask(),records=[];assert.equal(await exerciseNativeStationTask({...f,record:r=>records.push(r)}),'signal');assert.equal(f.view().phase,'ended');assert.deepEqual({winner:f.view().outcome.winner,reason:f.view().outcome.reason},{winner:'crew',reason:'tasks'});assert(f.view().self.tasks.find(t=>t.id===f.taskId).completed);assert.equal(records.length,1);});
test('driver does not misclassify an actual incomplete council interruption as a solved station',async()=>{const f=finalTask();f.interrupt();assert.equal(f.view().self.tasks.find(t=>t.id===f.taskId).completed,false);await assert.rejects(exerciseNativeStationTask(f),/actual completed task\/outcome/);assert.equal(f.view().phase,'discussion');});

test('driver ghost opt-in cannot turn an actual dead non-ghost into a permitted station owner',async()=>{const f=finalTask();f.die();assert(!f.view().self.ghost);await assert.rejects(exerciseNativeStationTask({...f,allowGhost:true}),/living owner or explicitly permitted crew ghost/);});

/** These additional cases qualify harness guards only, not the pending app/UI.
 * Miniature commits are fixtures, never advertised as game qualification. */
async function archiveFixture(t){
 const parent=path.resolve(fileURLToPath(new URL('../_artifacts/',import.meta.url)));
 await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'quality-driver-unit-')),repository=path.join(dir,'repo'),source=path.join(dir,'raw');
 await mkdir(repository);await mkdir(source);t.after(async()=>{assert.equal(path.dirname(dir),parent);await rm(dir,{recursive:true,force:true});});
 const run=promisify(execFile),git=async(...args)=>(await run('git',['-C',repository,...args],{encoding:'utf8'})).stdout.trim();await git('init','--quiet');
 const contents={'app.mjs':Buffer.from('export const version=1;\n'),'binary fixture.bin':Buffer.from([0,255,13,10,42])};
 for(const [file,bytes]of Object.entries(contents)){await writeFile(path.join(repository,file),bytes);await writeFile(path.join(source,file),bytes);}
 await git('-c','core.autocrlf=false','add','--all');await git('-c','user.name=Harness fixture','-c','user.email=fixture@invalid.local','commit','--quiet','-m','Fixture, not product source');
 let pin=await git('rev-parse','HEAD'),manifest;
 const refresh=async()=>{pin=await git('rev-parse','HEAD');manifest={revision:pin,files:{}};const {stdout}=await run('git',['-C',repository,'ls-tree','-r','-z',pin],{encoding:'utf8'});for(const row of stdout.split('\0').filter(Boolean)){const at=row.indexOf('\t'),[mode,,blob]=row.slice(0,at).split(' '),file=row.slice(at+1),bytes=await readFile(path.join(source,file));manifest.files[file]={mode,blob,sha256:createHash('sha256').update(bytes).digest('hex')};}await save();};
 const save=()=>writeFile(path.join(source,'source-manifest.json'),JSON.stringify(manifest));await refresh();
 return {source,repository,git,refresh,save,get pin(){return pin;},get manifest(){return manifest;}};
}
test('final archive gate accepts new explicit commit pins without editing the runner; covers every binary/text blob',async t=>{
 const f=await archiveFixture(t);assert.equal((await verifyFinalArchive(f)).allGitBlobsVerified,true);assert.equal((await verifyFinalArchive(f)).sourceFileCount,2);
 const first=f.pin,bytes=Buffer.from('export const version=2;\n');await writeFile(path.join(f.repository,'app.mjs'),bytes);await writeFile(path.join(f.source,'app.mjs'),bytes);await f.git('-c','core.autocrlf=false','add','--all');await f.git('-c','user.name=Harness fixture','-c','user.email=fixture@invalid.local','commit','--quiet','-m','Second exact fixture pin');await f.refresh();assert.notEqual(f.pin,first);assert.equal((await verifyFinalArchive(f)).allGitBlobsVerified,true);
 await assert.rejects(verifyFinalArchive({...f,pin:undefined}),/explicit QUALITY_BROWSER_PIN/);await assert.rejects(verifyFinalArchive({...f,pin:first}),/exactly equal/);
 const tree=await f.git('rev-parse','HEAD^{tree}');f.manifest.revision=tree;await f.save();await assert.rejects(verifyFinalArchive({...f,pin:tree}),/commit, not a tree/);
});
test('final archive gate rejects omitted files, forged SHA/manifest blobs, and mismatched modes before runtime import',async t=>{
 const f=await archiveFixture(t),original=structuredClone(f.manifest);delete f.manifest.files['binary fixture.bin'];await f.save();await assert.rejects(verifyFinalArchive(f),/complete pinned Git tree/);
 f.manifest.files=structuredClone(original.files);const forged=Buffer.from('export const version=999;\n');await writeFile(path.join(f.source,'app.mjs'),forged);f.manifest.files['app.mjs'].sha256=createHash('sha256').update(forged).digest('hex');await f.save();await assert.rejects(verifyFinalArchive(f),/Raw Git blob/);
 f.manifest.files['app.mjs'].blob=createHash('sha1').update(Buffer.from('blob '+forged.length+'\0')).update(forged).digest('hex');await f.save();await assert.rejects(verifyFinalArchive(f),/Manifest Git blob/);
 await writeFile(path.join(f.source,'app.mjs'),Buffer.from('export const version=1;\n'));f.manifest.files=structuredClone(original.files);f.manifest.files['app.mjs'].mode='100755';await f.save();await assert.rejects(verifyFinalArchive(f),/Git mode/);
 f.manifest.files=structuredClone(original.files);f.manifest.files['extra.mjs']=structuredClone(original.files['app.mjs']);await f.save();await assert.rejects(verifyFinalArchive(f),/complete pinned Git tree/);
 f.manifest.files=structuredClone(original.files);await f.save();assert.equal((await verifyFinalArchive(f)).sourceFileCount,2);
});
function councilRectangleFixture(width,height,{critical=false,feedback=true}={}){
 const rect=(left,top,right,bottom)=>({left,top,right,bottom,width:right-left,height:bottom-top}),top=critical?height<540?144:188:76,bodyTop=top+76;
 return {viewport:{width,height},topbar:rect(0,0,width,60),panel:rect(10,top,width-10,height-108),heading:rect(22,top+12,width-90,top+46),timer:rect(width-80,top+12,width-22,top+40),body:rect(22,bodyTop,width-22,height-120),feedback:feedback?rect(12,height-104,width-12,height-64):null,critical:critical?rect(12,64,width-12,top-8):null};
}
test('council rectangle guard requires header/timer, body, feedback and critical separation at all three target viewports',()=>{
 for(const [w,h]of [[320,740],[390,844],[844,390]])for(const critical of [false,true])assert.doesNotThrow(()=>assertCouncilGeometry(councilRectangleFixture(w,h,{critical})));
 const r=councilRectangleFixture(390,844),bad=mutate=>{const n=structuredClone(r);mutate(n);return n;};
 assert.throws(()=>assertCouncilGeometry(bad(n=>{n.heading.top=55;})),/below status/);
 assert.throws(()=>assertCouncilGeometry(bad(n=>{n.timer.top=55;})),/below status/);
 assert.throws(()=>assertCouncilGeometry(bad(n=>{n.body.bottom=790;})),/60px control rail/);
 assert.throws(()=>assertCouncilGeometry(bad(n=>{n.feedback.top=n.body.bottom-10;})),/Feedback must have a separate band/);
 assert.throws(()=>assertCouncilGeometry(bad(n=>{n.critical={...n.heading,bottom:n.panel.top+10};})),/Critical countdown/);
 assert.throws(()=>assertCouncilGeometry(bad(n=>{n.timer.right=400;})),/fit viewport width/);
});
test('Ward target guard accepts selected OTHER and SELF separately, rejecting self fallback and absent cooldown',()=>{
 const game={self:{id:'owner',alive:true,ability:{type:'ward',readyAt:36000}},effects:[{id:'effect-other',kind:'ward',targetId:'other',expiresAt:9000}]};
 assert.equal(assertSelectedWardEffect(game,{actorId:'owner',targetId:'other'}).id,'effect-other');assert.throws(()=>assertSelectedWardEffect(game,{actorId:'owner',targetId:'owner'}),/selected target/);
 const self=structuredClone(game);self.effects[0].targetId='owner';assert.equal(assertSelectedWardEffect(self,{actorId:'owner',targetId:'owner'}).targetId,'owner');assert.throws(()=>assertSelectedWardEffect(self,{actorId:'owner',targetId:'other'}),/selected target/);
 const noCooldown=structuredClone(game);noCooldown.self.ability.readyAt=9000;assert.throws(()=>assertSelectedWardEffect(noCooldown,{actorId:'owner',targetId:'other'}),/expiry must precede/);
});
test('native council click helper scrolls then uses actual hit-test center; covered/disabled controls never dispatch',async()=>{
 // Deliberately labeled DOM-shaped unit fixture, not Chromium layout evidence.
 let hit=true,disabled=false,scrolled=false;const clicks=[],body={left:10,right:300,top:160,bottom:600},node={disabled:false,scrollIntoView(){scrolled=true;},getBoundingClientRect(){return{left:40,top:200,right:140,bottom:244,x:40,y:200,width:100,height:44};},closest(){return{getBoundingClientRect:()=>body};},contains(){return false;}};
 const handle={evaluate:async fn=>{node.disabled=disabled;return vm.runInNewContext('('+fn.toString()+')(node)',{node,document:{elementFromPoint(){assert(scrolled);return hit?node:{tagName:'P'};}}});}},page={$:async()=>handle,viewport:()=>({isMobile:true}),touchscreen:{tap:async(x,y)=>clicks.push({x,y})}};
 await clickNativeCouncilControl(page,'fixture-send');assert.deepEqual(clicks,[{x:90,y:222}]);hit=false;await assert.rejects(clickNativeCouncilControl(page,'fixture-vote'),/Actual council click/);hit=true;disabled=true;await assert.rejects(clickNativeCouncilControl(page,'fixture-vote'),/Actual council click/);assert.equal(clicks.length,1);
});

test('final driver must match pinned harness text; CRLF is recorded separately and changed logic is rejected',()=>{
 const pinned=Buffer.from('export const guard=true;\n');assert.deepEqual(assertPinnedDriver(pinned,pinned),{runnerMatchesPinnedSource:true,runnerRawMatchesPinnedBlob:true});
 assert.deepEqual(assertPinnedDriver(Buffer.from('export const guard=true;\r\n'),pinned),{runnerMatchesPinnedSource:true,runnerRawMatchesPinnedBlob:false});
 assert.throws(()=>assertPinnedDriver(Buffer.from('export const guard=false;\n'),pinned),/match the harness in the pinned complete source/);
});
