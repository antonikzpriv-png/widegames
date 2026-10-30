import {STATION_TASK_KINDS,STATION_TASK_VERSION} from './station-contract.mjs';
const symbols=Object.freeze(['beacon','wave','star','bolt','anchor','sun']);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(o,keys)=>object(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const unique=a=>new Set(a).size===a.length;
const integer=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const clone=x=>structuredClone(x);
function randomFor(seed){let n=2166136261;for(const c of seed){n^=c.charCodeAt(0);n=Math.imul(n,16777619)>>>0;}return max=>{n^=n<<13;n^=n>>>17;n^=n<<5;n>>>=0;return n%max;};}
const shuffled=(a,r)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=r(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const tokens=c=>c.progress.values;
const required=c=>c.kind==='circuit'?c.puzzle.left.length:c.kind==='signal'?1:c.kind==='sequence'?c.puzzle.order.length:c.kind==='alignment'?c.puzzle.dials.length:c.kind==='manifolds'?c.puzzle.valves.length:c.puzzle.tiles.filter(t=>t.symbol===c.puzzle.target).length+1;
export function stationComplete(c){return c.kind==='glyphs'?tokens(c).at(-1)==='verified':tokens(c).length===required(c);}
export function stationProgress(c){const count=c.kind==='glyphs'?c.puzzle.tiles.filter(t=>t.symbol===c.puzzle.target&&tokens(c).includes(t.id)).length+(stationComplete(c)?1:0):tokens(c).length;return {progress:count,total:required(c),completed:stationComplete(c)};}
export function createStationChallenge({kind,seed}){
 if(!STATION_TASK_KINDS.includes(kind)||typeof seed!=='string'||seed.length<1||seed.length>512)throw new TypeError('Invalid station challenge setup');
 const r=randomFor(seed),pool=shuffled(symbols,r);let puzzle;
 if(kind==='circuit'){const picked=pool.slice(0,4);puzzle={left:picked.map((symbol,i)=>({id:'l'+i,symbol})),right:shuffled(picked,r).map((symbol,i)=>({id:'r'+i,symbol}))};}
 else if(kind==='signal')puzzle={target:10+r(81),min:0,max:100,unit:'kHz'};
 else if(kind==='sequence')puzzle={order:shuffled(['1','2','3','4','5','6'],r).slice(0,4),choices:['1','2','3','4','5','6']};
 else if(kind==='glyphs'){const target=pool[0],count=2+r(3),positions=shuffled(Array.from({length:9},(_,i)=>i),r).slice(0,count);puzzle={target,tiles:Array.from({length:9},(_,i)=>({id:'g'+i,symbol:positions.includes(i)?target:pool[1+r(5)]}))};}
 else if(kind==='alignment')puzzle={dials:Array.from({length:3},(_,i)=>{const target=r(4);return{id:'d'+i,target,start:(target+1+r(3))%4};})};
 else puzzle={valves:shuffled([1,2,3,4,5,6,7,8,9],r).slice(0,5).map((value,i)=>({id:'v'+i,value}))};
 const c={version:STATION_TASK_VERSION,kind,puzzle,progress:{values:[]}};validateStationChallenge(c);return c;
}
export function validateStationChallenge(c){
 if(!exact(c,['version','kind','puzzle','progress'])||c.version!==1||!STATION_TASK_KINDS.includes(c.kind)||!exact(c.progress,['values'])||!Array.isArray(c.progress.values)||c.progress.values.length>10||c.progress.values.some(v=>typeof v!=='string'||v.length>30)||!unique(c.progress.values))throw new TypeError('Invalid station challenge state');
 const p=c.puzzle,v=tokens(c),list=(a,length,prefix)=>Array.isArray(a)&&a.length===length&&a.every((x,i)=>exact(x,['id','symbol'])&&x.id===prefix+i&&symbols.includes(x.symbol));
 if(c.kind==='circuit'){
  if(!exact(p,['left','right'])||!list(p.left,4,'l')||!list(p.right,4,'r')||!unique(p.left.map(x=>x.symbol))||!unique(p.right.map(x=>x.symbol))||p.left.some(x=>!p.right.some(y=>y.symbol===x.symbol))||v.some(x=>{const[a,b,...extra]=x.split(':');return extra.length>0||!p.left.some(l=>l.id===a&&p.right.some(r=>r.id===b&&r.symbol===l.symbol));})||!unique(v.map(x=>x.split(':')[0])))throw new TypeError('Invalid circuit challenge');
 }else if(c.kind==='signal'){
  if(!exact(p,['target','min','max','unit'])||!integer(p.target,10,90)||p.min!==0||p.max!==100||p.unit!=='kHz'||v.length>1||v.some(x=>x!==String(p.target)))throw new TypeError('Invalid signal challenge');
 }else if(c.kind==='sequence'){
  if(!exact(p,['order','choices'])||!Array.isArray(p.order)||p.order.length!==4||!unique(p.order)||JSON.stringify(p.choices)!==JSON.stringify(['1','2','3','4','5','6'])||p.order.some(x=>!p.choices.includes(x))||v.length>4||v.some((x,i)=>x!==p.order[i]))throw new TypeError('Invalid sequence challenge');
 }else if(c.kind==='glyphs'){
  if(!exact(p,['target','tiles'])||!symbols.includes(p.target)||!list(p.tiles,9,'g')||p.tiles.filter(t=>t.symbol===p.target).length<2||p.tiles.filter(t=>t.symbol===p.target).length>4||v.some(x=>x!=='verified'&&!p.tiles.some(t=>t.id===x))||v.includes('verified')&&(v.at(-1)!=='verified'||p.tiles.some(t=>(t.symbol===p.target)!==v.includes(t.id))))throw new TypeError('Invalid glyph challenge');
 }else if(c.kind==='alignment'){
  if(!exact(p,['dials'])||!Array.isArray(p.dials)||p.dials.length!==3||p.dials.some((d,i)=>!exact(d,['id','target','start'])||d.id!=='d'+i||!integer(d.target,0,3)||!integer(d.start,0,3)||d.start===d.target)||v.some(x=>!p.dials.some(d=>x===d.id+':'+d.target))||!unique(v.map(x=>x.split(':')[0])))throw new TypeError('Invalid alignment challenge');
 }else{
  if(!exact(p,['valves'])||!Array.isArray(p.valves)||p.valves.length!==5||p.valves.some((d,i)=>!exact(d,['id','value'])||d.id!=='v'+i||!integer(d.value,1,9))||!unique(p.valves.map(d=>d.value))||v.length>5||v.some((x,i)=>x!==[...p.valves].sort((a,b)=>a.value-b.value)[i].id))throw new TypeError('Invalid manifold challenge');
 }
 return true;
}
export function projectStationChallenge(c){validateStationChallenge(c);return clone(c);}
export function applyStationInput(c,input){
 validateStationChallenge(c);const deny=(code,message)=>({accepted:false,error:{code,message},challenge:c,completed:stationComplete(c)});
 if(!exact(input,['interactionId','value'])||typeof input.interactionId!=='string'||typeof input.value!=='string'||input.value.length<1||input.value.length>80)return deny('INVALID_TASK_INPUT','Choose a valid station control.');
 if(stationComplete(c))return deny('TASK_COMPLETE','This station is already complete.');
 const n=clone(c),v=tokens(n),p=n.puzzle,{interactionId:id,value}=input;let valid=false;
 if(n.kind==='circuit'&&id==='connect'){const [l,r,...extra]=value.split(':');valid=!extra.length&&!v.some(x=>x.startsWith(l+':'))&&p.left.some(x=>x.id===l&&p.right.some(y=>y.id===r&&x.symbol===y.symbol));}
 else if(n.kind==='signal'&&id==='tune')valid=value===String(p.target);
 else if(n.kind==='sequence'&&id==='press')valid=value===p.order[v.length];
 else if(n.kind==='alignment'&&id==='align')valid=p.dials.some(d=>value===d.id+':'+d.target)&&!v.some(x=>x.split(':')[0]===value.split(':')[0]);
 else if(n.kind==='manifolds'&&id==='open')valid=value===[...p.valves].sort((a,b)=>a.value-b.value)[v.length]?.id;
 else if(n.kind==='glyphs'){
  if(id==='toggle'&&p.tiles.some(t=>t.id===value)){const at=v.indexOf(value);if(at<0)v.push(value);else v.splice(at,1);validateStationChallenge(n);return{accepted:true,challenge:n,completed:false};}
  if(id==='submit'&&value==='verify'&&p.tiles.every(t=>(t.symbol===p.target)===v.includes(t.id))){v.push('verified');validateStationChallenge(n);return{accepted:true,challenge:n,completed:true};}
 }
 if(!valid)return deny('INCORRECT_TASK_INPUT','The station input does not match its displayed instructions.');
 v.push(value);validateStationChallenge(n);return{accepted:true,challenge:n,completed:stationComplete(n)};
}
export function nextStationInput(c){
 validateStationChallenge(c);if(stationComplete(c))return null;const p=c.puzzle,v=tokens(c);
 if(c.kind==='circuit'){const l=p.left.find(l=>!v.some(x=>x.startsWith(l.id+':')));return{interactionId:'connect',value:l.id+':'+p.right.find(r=>r.symbol===l.symbol).id};}
 if(c.kind==='signal')return{interactionId:'tune',value:String(p.target)};
 if(c.kind==='sequence')return{interactionId:'press',value:p.order[v.length]};
 if(c.kind==='alignment'){const d=p.dials.find(d=>!v.some(x=>x.startsWith(d.id+':')));return{interactionId:'align',value:d.id+':'+d.target};}
 if(c.kind==='manifolds')return{interactionId:'open',value:[...p.valves].sort((a,b)=>a.value-b.value)[v.length].id};
 const wrong=p.tiles.find(t=>t.symbol!==p.target&&v.includes(t.id)),missing=p.tiles.find(t=>t.symbol===p.target&&!v.includes(t.id));return wrong||missing?{interactionId:'toggle',value:(wrong||missing).id}:{interactionId:'submit',value:'verify'};
}
