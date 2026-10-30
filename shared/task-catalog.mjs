import {CAPTCHA_KINDS,captchaChallenge} from './captcha.mjs';
/** Readable, deterministic game equipment. This module grants no completion authority. */
const rows=[
 ['wires','Reconnect wiring','equipment',4,['Select cable','Match socket','Connect cable','Check final cable']],
 ['tuning','Tune radio frequency','equipment',1,['Lock carrier frequency']],
 ['sequence','Restore memory record','equipment',4,['Repeat 1 signal','Repeat 2 signals','Repeat 3 signals','Repeat 4 signals']],
 ['pressure','Balance reservoirs','equipment',2,['Set flow direction','Transfer pressure']],
 ['repair','Replace fuse assembly','equipment',4,['Isolate power','Replace fuse','Start diagnostic','Verify diagnostic']],
 ['glyphs','Identify signal glyphs','captcha',3,['Select every target','Select every target','Select every target']],
 ['count','Count signal markers','captcha',2,['Count target markers','Count target markers']],
 ['order','Sort cargo tags','captcha',4,['Smallest tag','Next tag','Next tag','Final tag']],
 ['rotate','Orient navigation signal','captcha',3,['Align north','Align north','Align north']],
 ['oddity','Find the anomalous symbol','captcha',2,['Find the anomaly','Find the anomaly']],
 ['code','Enter authentication code','captcha',1,['Read and enter code']],
 ['course','Chart a safe course','equipment',4,['Plot waypoint 1','Plot waypoint 2','Plot waypoint 3','Plot waypoint 4']],
 ['steering','Stabilize navigation','equipment',2,['Align horizontal axis','Align vertical axis']],
 ['shields','Prime defense grid','equipment',2,['Activate red sectors','Verify second circuit']],
 ['power','Divert and accept power','equipment',2,['Divert requested circuit','Accept routed power']],
 ['transfer','Transfer beacon records','equipment',3,['Connect data link','Transfer records','Verify checksum']],
 ['sample','Inspect culture samples','equipment',3,['Begin incubation','Finish incubation','Identify anomalous vial']],
 ['filter','Clear intake filter','equipment',3,['Extract debris 1','Extract debris 2','Extract debris 3']],
 ['pairs','Find paired signal tokens','captcha',2,['Find the matching pair','Find the matching pair']],
 ['arithmetic','Verify cargo arithmetic','captcha',2,['Solve manifest check','Solve manifest check']],
 ['compare','Read instrument gauges','captcha',2,['Choose highest reading','Choose highest reading']],
 ['pattern','Complete beacon pattern','captcha',3,['Complete the pattern','Complete the pattern','Complete the pattern']],
 ['frequency','Match waveform traces','captcha',2,['Match reference trace','Match reference trace']],
 ['sorting','Sort recovered materials','captcha',3,['Classify material','Classify material','Classify material']],
 ['path','Trace navigation checkpoints','captcha',4,['Find start','Follow route','Follow route','Reach endpoint']]
];
const longWork=new Set(['sequence','repair','power','transfer','sample']);
export const TASK_CATALOG=Object.freeze(Object.fromEntries(rows.map(([kind,title,category,total,stages])=>[kind,Object.freeze({kind,title,category,total,durationClass:longWork.has(kind)?'long':'short',stages:Object.freeze(stages)})])));
export const TASK_LENGTHS=Object.freeze(Object.fromEntries(rows.map(([kind,,,total])=>[kind,total])));
export const TASK_ORDER=Object.freeze(rows.map(row=>row[0]));
export const NEW_TASK_KINDS=Object.freeze(TASK_ORDER.filter(kind=>!['wires','tuning','sequence','pressure','repair',...CAPTCHA_KINDS].includes(kind)));
export const TASK_SYMBOLS=Object.freeze(['SUN','WAVE','STAR','MOON']);
export const TASK_TIMERS=Object.freeze({repair:1500,transfer:2500,sample:3000});
function generator(c,stage=true){
 let seed=2166136261;for(const character of `${c.kind}|${c.target}|${c.sequence.join(',')}|${c.pressure}|${stage?c.index:0}`)seed=Math.imul(seed^character.charCodeAt(0),16777619)>>>0;
 return max=>{seed=(seed+0x6D2B79F5)>>>0;let v=seed;v=Math.imul(v^(v>>>15),v|1);v^=v+Math.imul(v^(v>>>7),v|61);return ((v^(v>>>14))>>>0)%max;};
}
const shuffle=(list,r)=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=r(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
/** Display values are generated from an owner's permitted challenge, never hidden roles/state. */
export function taskDisplay(c){
 if(!c||!TASK_CATALOG[c.kind])return null;
 if(CAPTCHA_KINDS.includes(c.kind))return captchaChallenge(c);
 const random=generator(c,!['wires','course','steering','power','sample','filter','path'].includes(c.kind));
 switch(c.kind){
  case 'wires':return {wireLabels:TASK_SYMBOLS,wireOrder:shuffle([0,1,2,3],random)};
  case 'course':return {course:shuffle([0,1,2,3],random).map((id,i)=>({id,x:16+i*22,y:20+random(60)}))};
  case 'steering':return {axes:[{id:'x',target:c.target},{id:'y',target:20+c.sequence[0]*15}]};
  case 'shields':{const red=new Set(shuffle([0,1,2,3,4,5,6,7,8],random).slice(0,3));return {cells:Array.from({length:9},(_,i)=>red.has(i))};}
  case 'power':return {channel:c.target%4,channels:['Habitat','Navigation','Life support','Uplink']};
  case 'transfer':return {fileCount:12+c.target%28,checksum:`LW-${c.target}-${c.sequence.join('')}`,durationMs:TASK_TIMERS.transfer};
  case 'sample':return {oddVial:random(5),vials:5,durationMs:TASK_TIMERS.sample};
  case 'filter':return {debris:[{id:0,label:'Loose bolt',x:23,y:34},{id:1,label:'Tangled kelp',x:68,y:63},{id:2,label:'Metal fragment',x:44,y:78}]};
  case 'pairs':{const symbols=shuffle(TASK_SYMBOLS,random),tiles=shuffle([symbols[0],symbols[0],symbols[1],symbols[2],'COMET','ANCHOR'],random);return {tiles};}
  case 'arithmetic':{let left=3+random(14),right=2+random(8);const operator=random(2)?'+':'−';if(operator==='−'&&left<right)[left,right]=[right,left];const answer=operator==='+'?left+right:left-right;return {left,right,operator,choices:shuffle([answer,answer+1,answer+3,answer+5],random)};}
  case 'compare':return {gauges:shuffle([20+random(10),50+random(10),80+random(10)],random)};
  case 'pattern':{const symbols=shuffle(TASK_SYMBOLS,random).slice(0,3);return {pattern:[...symbols,...symbols.slice(0,2)],choices:shuffle(TASK_SYMBOLS,random)};}
  case 'frequency':{const first=Array.from({length:8},()=>random(2)),waves=[first,[...first].map((bit,i)=>i===2?1-bit:bit),[...first].map((bit,i)=>i===5?1-bit:bit)];const ordered=shuffle(waves,random);return {signal:[...first],waves:ordered};}
  case 'sorting':{const bins=[{id:'metal',label:'Metal'},{id:'glass',label:'Glass'},{id:'organic',label:'Organic'},{id:'polymer',label:'Polymer'}],items=[['Copper coil','metal'],['Glass lens','glass'],['Kelp strand','organic'],['Rubber seal','polymer'],['Steel bolt','metal'],['Sample jar','glass'],['Leaf fragment','organic'],['Insulated sleeve','polymer']],item=items[random(items.length)];return {item:{label:item[0],material:item[1]},bins};}
  case 'path':return {route:shuffle([[0,1,2,5],[6,3,4,5],[8,7,4,1],[2,5,4,3]],random)[0]};
  default:return {};
 }
}
