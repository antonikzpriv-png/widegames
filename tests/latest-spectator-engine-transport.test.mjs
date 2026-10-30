import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';
import {createGameServer} from '../server/transport.mjs';
import {loadConfig} from '../server/config.mjs';
import {createAiController} from '../server/ai/index.mjs';
import * as engine from '../server/engine/index.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const parent=fileURLToPath(new URL('../_artifacts/test-temp/',import.meta.url));
test('actual offline transport scheduler seed3 Beacon2 reaches a real outcome with structured job progress',{timeout:100000},async t=>{
 await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'spectator-seed3-'));
 let game,clock=1000,decisions=0,external=0,auxInputs=0;const counts={},started=performance.now(),nativeFetch=globalThis.fetch,contexts=[],proposals=[];
 const origin='http://offline-spectator.test';let base;
 const fetch=t.mock.method(globalThis,'fetch',(url,opts)=>{if(base&&String(url).startsWith(base+'/'))return nativeFetch(url,opts);external++;throw Error('No external requests');});
 const config=loadConfig({PUBLIC_ORIGIN:origin,DATA_DIR:dir,AI_PROVIDER:'demo',MAX_AI_CALLS:'0',MAX_AI_COST_USD:'0',MAX_DAILY_AI_COST_USD:'0'});config.now=()=>clock;config.tickMs=10;
 const ai=createAiController({config:config.ai}),controller={describe:ai.describe,async decide(args){decisions++;const a=await ai.decide(args);if(a){counts[a.type]=(counts[a.type]??0)+1;if(a.type==='taskInteract'&&(args.view.systems?.lights?.active||args.view.systems?.communications?.active))auxInputs++;proposals.push({at:clock,type:a.type,id:a.id});if(proposals.length>12)proposals.shift();}contexts.push(args.context);if(contexts.length>1)contexts.shift();return a;}};
 try{
  // Match seed is the only construction override. All ordinary settings/deadlines,
  // persistence, HTTP auth and earliest-due scheduling are actual transport code.
  game=await createGameServer(config,{engine:{...engine,createMatch:options=>engine.createMatch({...options,seed:3})},aiController:controller});game.server.listen(0,'127.0.0.1');await once(game.server,'listening');base='http://127.0.0.1:'+game.server.address().port;
  const create=await fetch(base+'/api/rooms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({mode:'spectator'})});assert.equal(create.status,201);const created=await create.json(),cookie=create.headers.get('set-cookie').split(';')[0],route='/api/rooms/'+created.roomId;
  const start=await fetch(base+route+'/start',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({id:'seed3-native-start'})});assert.equal(start.status,200);const initial=await start.json();assert.equal(initial.game.stationTasksVersion,1);assert.deepEqual(initial.game.map,{id:'beacon',version:2});
  const room=game.rooms.get(created.roomId);let loops=0;const realLimit=performance.now()+85000;
  // Monotonic500ms increments20ms apart stress real asynchronous persistence,
  // without changing engine rules, phase deadlines, accepted actions or outcomes.
  while(!['ended','paused'].includes(room.data.state.phase)&&clock<901000&&performance.now()<realLimit){clock+=500;loops++;await delay(20);}
  await delay(100);
  const state=room.data.state,receipts=Object.values(state.requests).flat(),denied=receipts.filter(r=>!r.accepted);const result={fixture:'Real createGameServer HTTP/auth/store/scheduler/controller, virtual monotonic clock500ms/20ms, default rules and seed3; not browser/native-main qualification',loops,clock,decisions,counts,auxInputs,completed:state.players.flatMap(p=>p.tasks).filter(t=>t.completed).length,phase:state.phase,outcome:state.outcome,denials:denied.map(r=>r.error?.code),recent:proposals,external,cpuElapsedMs:performance.now()-started};t.diagnostic(JSON.stringify(result));
  assert.equal(state.phase,'ended',JSON.stringify(result));assert(state.outcome);assert(counts.taskInteract>0);assert(auxInputs>0);assert.equal(external,0);assert.equal(ai.describe(room.data.aiContext).calls,0);assert.equal(ai.describe(room.data.aiContext).costUsd,0);assert(receipts.some(r=>r.accepted&&r.fingerprint.includes('taskInteract')));assert(engine.getReplay(state).every((e,i,events)=>!i||e.at>=events[i-1].at));
 }finally{await game?.close();const relative=path.relative(parent,dir);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));await rm(dir,{recursive:true,force:true});}
});
