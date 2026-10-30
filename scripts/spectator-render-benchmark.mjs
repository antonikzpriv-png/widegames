/** Same-device renderer comparison against the audited baseline; no providers. */
import assert from 'node:assert/strict';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

const root=fileURLToPath(new URL('../',import.meta.url)),baseline='43c079999506785196ab85750105ceb102ba9314';
await mkdir(path.join(root,'_artifacts'),{recursive:true});const output=await mkdtemp(path.join(root,'_artifacts/spectator-render-'));
const baselineFiles=['public/world/scene.mjs','public/world/model.mjs','shared/world.mjs','shared/contracts.mjs'];
const original=new Map(baselineFiles.map(file=>[file,execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8'})]));
const dependencies=new Set();
async function collect(file){if(dependencies.has(file))return;dependencies.add(file);const source=await readFile(path.join(root,file),'utf8');for(const match of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm)){const specifier=match[1]||match[2];if(specifier.startsWith('.'))await collect(path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier)));}}
for(const file of baselineFiles)await collect(file);const sourceFiles=[...dependencies].sort();
const fingerprints=()=>Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(path.join(root,file))).digest('hex')]));
const before=await fingerprints();
const server=http.createServer(async(req,res)=>{try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>Renderer benchmark</title><style>body{margin:0}canvas{display:block;width:1440px;height:1000px}</style><canvas></canvas>');return;}const match=/^\/(baseline|current)\/(.+)$/.exec(req.url);if(!match||!sourceFiles.includes(match[2])){res.writeHead(404).end();return;}res.setHeader('Content-Type','text/javascript');res.end(match[1]==='baseline'?original.get(match[2]):await readFile(path.join(root,match[2]),'utf8'));}catch{res.writeHead(500).end();}});
let browser;const report={baseline,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),runtimeFingerprints:before,fixture:'Identical 1440×1000 fresh software canvas per round, six visible moving keepers, same headless Chromium process and geometry. Overview, follow and human crew fixtures; human has five pending tasks and normal visibility fog. Alternating baseline/current rounds, 12 warm-up and 72 measured draws; willReadFrequently fixes the backend and 1px readback flushes deferred paint. Measures scene draw+flush CPU time, excluding full-app layout/network. No provider calls.',runs:[]};
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});await page.goto(origin);
 for(const mode of ['overview','follow','human'])for(const version of ['baseline','current','current','baseline']){
  const run=await page.evaluate(async({version,mode})=>{
   const {createWorldScene}=await import('/'+version+'/public/world/scene.mjs'),{CHARACTERS}=await import('/'+version+'/shared/contracts.mjs');
   const previous=document.querySelector('canvas'),canvas=document.createElement('canvas');previous.replaceWith(canvas);
   // Every round starts with the same explicit readback-oriented backend. A
   // reused canvas can switch backends after repeated reads and skew the order.
   canvas.getContext('2d',{willReadFrequently:true});
   const scene=createWorldScene(canvas),durations=[];
   const game={matchId:'benchmark',phase:'roam',self:null,players:[],events:[],tasks:{completed:0,total:20},sabotage:null};
   for(let frame=0;frame<84;frame++){
    const time=performance.now();game.players=CHARACTERS.map((p,i)=>({...p,alive:true,position:{x:690+i%3*75+Math.sin(frame/16+i)*25,y:270+Math.floor(i/3)*55},roomId:'bridge',moving:true}));
    if(mode==='human')game.self={...game.players[0],role:'crew',tasks:['lantern','galley','bridge','engine','engine'].map((roomId,i)=>({id:'task-'+i,roomId,completed:false}))};
    if(frame%4===0)scene.update({roomId:'benchmark',game},time);
    const start=performance.now();scene.draw(time,{overview:mode==='overview',follow:mode==='human'?'p1':'p2'});canvas.getContext('2d').getImageData(0,0,1,1);const elapsed=performance.now()-start;if(frame>=12)durations.push(elapsed);
    await new Promise(requestAnimationFrame);
   }
   scene.dispose();durations.sort((a,b)=>a-b);return {version,mode,frames:durations.length,meanMs:durations.reduce((sum,n)=>sum+n,0)/durations.length,medianMs:durations[Math.floor(durations.length/2)],p95Ms:durations[Math.floor(durations.length*.95)]};
  },{version,mode});report.runs.push(run);console.log(JSON.stringify(run));
 }
 report.browser=await browser.version();report.summary=['overview','follow','human'].map(mode=>{const mean=version=>report.runs.filter(r=>r.mode===mode&&r.version===version).reduce((sum,r)=>sum+r.meanMs,0)/2;return {mode,baselineMeanMs:mean('baseline'),currentMeanMs:mean('current'),reductionPercent:(1-mean('current')/mean('baseline'))*100};});
 console.log('SUMMARY '+JSON.stringify(report.summary));assert(report.summary.every(r=>r.currentMeanMs<r.baselineMeanMs),'Updated renderer must improve both camera modes on this host');assert.deepEqual(await fingerprints(),before,'Renderer source must remain unchanged during qualification');report.passed=true;
}catch(error){report.failure=error.stack;console.error(error);process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Renderer benchmark evidence: '+output);}
