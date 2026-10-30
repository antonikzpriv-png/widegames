/** Offline engine timing receipt. No providers, persisted rooms or timing assertions. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';

async function measure(root) {
 const engine=await import(new URL('server/engine/index.mjs',root));
 const {WORLD_STATIONS}=await import(new URL('shared/world.mjs',root));
 const rows=[];
 for(const mode of ['human','spectator'])for(const records of [0,12000]){
  let state=engine.createMatch({id:'spectator-performance',mode,seed:7,now:1000,world:true});
  const navigated=engine.applyAction(state,'p2',{id:'perf-route',type:'navigate',x:WORLD_STATIONS.archive.x,y:WORLD_STATIONS.archive.y},1000);
  assert(navigated.accepted);
  function history(input){
   const next=structuredClone(input);
   if(records){next.replay=Array.from({length:records},(_,i)=>({id:'r'+(i+1),sequence:i+1,type:'action',at:1000,playerId:'p3',position:{x:800,y:300},action:{id:'sample-'+i,type:'wait'}}));next.replaySequence=records;next.replayBytes=next.replay.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e)),0);}
   return next;
  }
  const idle=history(state);state=history(navigated.state);
  // Warm caches/JIT outside the measured intervals.
  for(let i=0;i<12;i++)engine.tick(idle,1100);
  let start=performance.now();
  for(let i=0;i<120;i++){const result=engine.tick(idle,1100);assert.equal(result.state.version,idle.version);}
  const idleMs=(performance.now()-start)/120;
  start=performance.now();
  for(let i=1;i<=30;i++)state=engine.tick(state,1000+i*100).state;
  const movingMs=(performance.now()-start)/30;
  start=performance.now();
  for(let i=0;i<120;i++)engine.getPlayerView(state,mode==='human'?'p1':null,4000);
  rows.push({mode,retainedRecords:records,idleTickMs:idleMs,movingTickMs:movingMs,viewMs:(performance.now()-start)/120});
 }
 return rows;
}
const report={method:'Same seeded world fixture, 120 idle ticks, 30 moving ticks, 120 recipient views. 12,000-record fixture is synthetic and bounded. Wall-clock timings are diagnostic, not frame-rate guarantees or CI thresholds.',current:await measure(new URL('../',import.meta.url))};
if(process.env.SPECTATOR_BASELINE_ROOT)report.baseline=await measure(pathToFileURL(resolve(process.env.SPECTATOR_BASELINE_ROOT)+'/'));
if(process.env.SPECTATOR_PERF_REPORT)await writeFile(process.env.SPECTATOR_PERF_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
