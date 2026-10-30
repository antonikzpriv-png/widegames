/** Independent root-boundary checks. Defaults to this checkout. Optional raw root
 * may be a documented staged boundary fixture: never import conflicted source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import net from 'node:net';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const own=new URL('../',import.meta.url),root=process.env.QUALITY_MAIN_REVIEW_ROOT?pathToFileURL(path.resolve(process.env.QUALITY_MAIN_REVIEW_ROOT)+path.sep):own;
const engine=await import(new URL('server/engine/index.mjs',root)),{createRoom,issueIdentity}=await import(new URL('server/rooms.mjs',root)),{createRoomStore,validateRoomSnapshot}=await import(new URL('server/store.mjs',root)),{validateReplayHistory}=await import(new URL('shared/replay.mjs',root)),{createGameServer}=await import(new URL('server/transport.mjs',root)),{loadConfig}=await import(new URL('server/config.mjs',root));
async function dir(){const parent=fileURLToPath(new URL('_artifacts/',own));await mkdir(parent,{recursive:true});return mkdtemp(path.join(parent,'quality-main-boundary-'));}
function saved(tactical){const room=createRoom('human',1000,undefined,{tactical,stationTasks:tactical,...(tactical?{mapId:'beacon'}:{})});issueIdentity(room,true);room.startId='boundary:start';room.state=engine.createMatch({id:room.id,mode:'human',world:true,tactical,stationTasks:tactical,...(tactical?{map:room.map}:{}),now:1000,seed:2});return room;}
function v1(state){return {version:1,map:'lantern-wake-v1',checkpoints:[{at:state.updatedAt,sequence:0,phase:state.phase,players:state.players.map(p=>({id:p.id,role:p.role,alive:p.alive,roomId:p.roomId,position:structuredClone(p.position),tasks:[],route:[]})),bodies:[],sabotage:null,meeting:null,outcome:null}]};}

test('root start receipt binds a changed feature payload while same-payload retry and visitor guards remain valid',async t=>{
 const directory=await dir(),probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const origin='http://127.0.0.1:'+port;let app;
 t.after(async()=>{try{await app?.close();}finally{assert.equal(path.dirname(directory),path.resolve(fileURLToPath(new URL('_artifacts/',own))));await rm(directory,{recursive:true,force:true});}});
 const config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:directory,AI_PROVIDER:'demo',MAX_AI_CALLS:'0',MAX_AI_COST_USD:'0',MAX_DAILY_AI_COST_USD:'0'});config.now=()=>1000;
 app=await createGameServer(config,{engine,aiController:{describe:()=>({mode:'demo',calls:0,tokens:0,costUsd:0}),async decide(){return null;}}});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 const http=async(url,cookie,body)=>{const r=await fetch(origin+url,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 const created=await http('/api/rooms',null,{mode:'human'});assert.equal(created.status,201);const base='/api/rooms/'+created.data.roomId,body={id:'boundary:start-features',features:{deathPolicy:'transfer',abilities:false}},started=await http(base+'/start',created.cookie,body);assert.equal(started.status,200);assert.equal(started.data.features.deathPolicy,'transfer');assert.equal((await http(base+'/start',created.cookie,body)).status,200);
 const visitor=await http(base+'/join',null,{});assert.equal(visitor.status,200);assert.equal((await http(base+'/start',visitor.cookie,body)).status,403);assert.equal((await http(base+'/start',created.cookie,{...body,id:'boundary:different-start'})).status,409);
 const conflict=await http(base+'/start',created.cookie,{...body,features:{deathPolicy:'ghost-tasks',abilities:true}});t.diagnostic(JSON.stringify({changedPayloadStatus:conflict.status,returnedFeatures:conflict.data.features,sameMatch:conflict.data.game?.matchId===started.data.game.matchId}));assert.equal(conflict.status,409,'A fresh feature request must not be falsely acknowledged as the original accepted start');
});

test('legacy replay v1 remains readable but cannot be relabeled as a Beacon2/schema5 recording',async()=>{
 const legacy=saved(false);legacy.state.replayHistory=v1(legacy.state);validateReplayHistory(legacy.state.replayHistory);await validateRoomSnapshot(legacy);
 const large=saved(true);assert.equal(large.state.schemaVersion,5);assert.equal(large.map.version,2);await validateRoomSnapshot(large);const forged=v1(large.state);validateReplayHistory(forged);large.state.replayHistory=forged;
 // A well-shaped v1 anchor with empty task lists and six original IDs fits v1
 // bounds yet actually contains Beacon2 spawn coordinates. Static current-map
 // walkability alone cannot bind the recording's declared map/version.
 await assert.rejects(()=>validateRoomSnapshot(large),undefined,'Do not accept original-map replay metadata on a large-map match');
});

test('future replay-history versions fail closed without quarantining or rewriting otherwise valid station saves',async t=>{
 const directory=await dir();let store;t.after(async()=>{try{await store?.close();}finally{assert.equal(path.dirname(directory),path.resolve(fileURLToPath(new URL('_artifacts/',own))));await rm(directory,{recursive:true,force:true});}});const room=saved(true);await validateRoomSnapshot(room);room.state.replayHistory={version:3,map:{...room.map},checkpoints:[]};const file=path.join(directory,'room-'+room.id+'.json'),bytes=Buffer.from(JSON.stringify(room));await writeFile(file,bytes);store=await createRoomStore(directory);let error,loaded;try{loaded=await store.load();}catch(e){error=e;}
 const names=await readdir(directory),quarantine=names.find(n=>n.includes('.quarantine-'));t.diagnostic(JSON.stringify({errorCode:error?.code??null,loaded:loaded?.length??null,originalStillPresent:names.includes(path.basename(file)),quarantined:!!quarantine,quarantinePreservesBytes:quarantine?(await readFile(path.join(directory,quarantine))).equals(bytes):null,originalSha256:createHash('sha256').update(bytes).digest('hex')}));
 assert.equal(error?.code,'VERSION_UNAVAILABLE','An unsupported future replay is unavailable data, not corrupt user data');assert.deepEqual(await readFile(file),bytes);assert(!quarantine);
});

test('normal station lobby can start the merged ghost-task preset with its real schema5 feature state',async t=>{
 const preset={deathPolicy:'ghost-tasks',abilities:false},control=engine.createMatch({id:'quality-ghost-feature-control',mode:'human',tactical:true,stationTasks:true,map:{id:'beacon',version:2},features:preset,now:1000,seed:2});assert.equal(control.schemaVersion,5);assert.equal(control.features?.deathPolicy,'ghost-tasks','The composed engine itself supports the requested preset');
 const directory=await dir(),probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const origin='http://127.0.0.1:'+port;let app;t.after(async()=>{try{await app?.close();}finally{assert.equal(path.dirname(directory),path.resolve(fileURLToPath(new URL('_artifacts/',own))));await rm(directory,{recursive:true,force:true});}});
 const config=loadConfig({HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:directory,AI_PROVIDER:'demo',MAX_AI_CALLS:'0',MAX_AI_COST_USD:'0',MAX_DAILY_AI_COST_USD:'0'});config.now=()=>1000;app=await createGameServer(config,{engine,aiController:{describe:()=>({mode:'demo',calls:0,costUsd:0}),async decide(){return null;}}});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 const created=await fetch(origin+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({mode:'human',features:preset})});assert.equal(created.status,201);const room=await created.json(),cookie=created.headers.get('set-cookie').split(';')[0];assert.equal(room.features.deathPolicy,'ghost-tasks');const response=await fetch(origin+'/api/rooms/'+room.roomId+'/start',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({id:'quality:ghost-preset-start'})}),result=await response.json();t.diagnostic(JSON.stringify({startStatus:response.status,error:result.error,engineSchema:control.schemaVersion,engineFeatureVersion:control.features.version,storedPhase:app.rooms.get(room.roomId).data.state?.phase??'lobby'}));assert.equal(response.status,200,'Valid merged ghost preset must not fail persistence at normal station startup');assert.equal(result.game.features.deathPolicy,'ghost-tasks');assert.equal(result.game.stationTasksVersion,1);
});
