/** Original waiting-bay artwork: shared visual grammar, no imported game assets. */
import {drawKeeper} from './world/scene.mjs';
const NS='http://www.w3.org/2000/svg';
function shape(tag,attributes={},text){const node=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));if(text!==undefined)node.textContent=text;return node;}
const add=(parent,tag,attributes,text)=>{const node=shape(tag,attributes,text);parent.append(node);return node;};
function label(parent,text,x,y,size=12,color='#bcc6c6',extra={}){return add(parent,'text',{x,y,fill:color,'font-size':size,'font-family':'system-ui,sans-serif','font-weight':800,'text-anchor':'middle',...extra},text);}
function chair(parent,x,y,scale=1,mirror=false){
 const group=add(parent,'g',{transform:`translate(${x} ${y}) scale(${mirror?-scale:scale} ${scale})`});
 add(group,'ellipse',{cx:0,cy:40,rx:32,ry:10,fill:'#151e23',opacity:.5});
 add(group,'path',{d:'M-19 20 L-25 49 M20 21 L26 49',stroke:'#1e2b31','stroke-width':8});
 add(group,'path',{d:'M-23 11 Q-26 -25 -7 -31 Q12 -38 21 -15 L27 13 Z',fill:'#476372',stroke:'#1c2d36','stroke-width':5});
 add(group,'path',{d:'M-18 9 Q-20 -18 -5 -24 Q8 -29 15 -12 L20 10',fill:'#5c7c88',stroke:'#79939a','stroke-width':2});
 add(group,'path',{d:'M-27 13 Q-3 2 26 13 L30 29 Q3 41 -26 29 Z',fill:'#526d78',stroke:'#20333c','stroke-width':5});
 add(group,'path',{d:'M-24 17 Q0 10 23 17',fill:'none',stroke:'#9bafb0','stroke-width':2});
}
export function createWaitingRoomScene({profile,onSettings,onWardrobe}){
 const root=document.createElement('div');root.className='launch-room-scene';root.setAttribute('aria-label','Waiting bay with a computer on the left, wardrobe on the right, and your keeper in the middle.');
 const svg=shape('svg',{viewBox:'0 0 1160 740',preserveAspectRatio:'xMidYMid meet','aria-hidden':'true',focusable:'false',class:'launch-room-art'});root.append(svg);
 const defs=add(svg,'defs');
 const gradient=(id,stops,attrs={})=>{const g=add(defs,'linearGradient',{id,x1:0,y1:0,x2:0,y2:1,...attrs});for(const [offset,color]of stops)add(g,'stop',{offset,'stop-color':color});};
 gradient('bay-wall',[[0,'#637174'],[.5,'#48575b'],[1,'#27363d']]);
 gradient('bay-floor',[[0,'#697777'],[1,'#424d53']]);
 gradient('bay-door',[[0,'#6d7f81'],[1,'#3d5057']]);
 gradient('bay-screen',[[0,'#a2e4b9'],[1,'#478779']]);
 const stars=add(svg,'g',{fill:'#b7c7c8',opacity:.35});for(let i=0;i<32;i++)add(stars,'circle',{cx:20+(i*199)%1120,cy:15+(i*113)%700,r:i%3===0?1.7:.8});
 add(svg,'path',{d:'M88 718 L88 204 Q94 72 296 24 L864 24 Q1066 72 1072 204 L1072 718 Z',fill:'#1b272c',stroke:'#080f14','stroke-width':18,'stroke-linejoin':'round'});
 add(svg,'path',{d:'M112 718 L112 208 Q118 91 305 48 L855 48 Q1042 91 1048 208 L1048 718 Z',fill:'url(#bay-wall)',stroke:'#718084','stroke-width':5});
 add(svg,'path',{d:'M150 410 L285 266 L875 266 L1010 410 L1010 710 L150 710 Z',fill:'url(#bay-floor)',stroke:'#26373c','stroke-width':6});
 // Tall chamfered walls and inset panels establish the perspective of the bay.
 add(svg,'path',{d:'M150 409 L150 187 L285 99 L285 266 Z',fill:'#43565b',stroke:'#26383e','stroke-width':6});
 add(svg,'path',{d:'M1010 409 L1010 187 L875 99 L875 266 Z',fill:'#3c4f55',stroke:'#25373d','stroke-width':6});
 add(svg,'path',{d:'M285 99 L875 99 L875 266 L285 266 Z',fill:'#526568',stroke:'#26393f','stroke-width':7});
 add(svg,'path',{d:'M285 99 L305 58 L855 58 L875 99 Z',fill:'#4b5a5c',stroke:'#283a40','stroke-width':5});
 for(let i=0;i<5;i++){
  const x=298+i*116;add(svg,'rect',{x,y:112,width:103,height:137,rx:4,fill:'#647579',stroke:'#35494e','stroke-width':4});
  add(svg,'path',{d:`M${x+8} 132 H${x+95} M${x+8} 222 H${x+95}`,stroke:'#819092','stroke-width':2,opacity:.65});
 }
 for(let side=0;side<2;side++){
  const g=add(svg,'g',{transform:side?'translate(1160 0) scale(-1 1)':''});
  for(let i=0;i<3;i++)add(g,'path',{d:`M${161+i*38} ${184-i*25} L${185+i*38} ${168-i*25} L${185+i*38} ${287-i*25} L${161+i*38} ${314-i*25} Z`,fill:'#5b7074',stroke:'#2b4249','stroke-width':4});
  add(g,'path',{d:'M154 341 L280 215 M154 367 L280 241',stroke:'#263a43','stroke-width':5});
  for(let i=0;i<10;i++)add(g,'path',{d:`M${155+i*12} ${369-i*12} l0 25`,stroke:'#819090','stroke-width':3,opacity:.5});
 }
 // Rear airlock, handwheel and small access console.
 add(svg,'path',{d:'M488 272 V147 Q488 130 507 130 H653 Q672 130 672 147 V272 Z',fill:'#253940',stroke:'#1b2b32','stroke-width':9});
 add(svg,'path',{d:'M505 265 V153 H575 V265 Z M585 153 H655 V265 H585 Z',fill:'url(#bay-door)',stroke:'#829394','stroke-width':3});
 add(svg,'path',{d:'M533 156 V190 L518 204 V237 M627 156 V190 L642 204 V237',fill:'none',stroke:'#344b54','stroke-width':7,'stroke-linejoin':'round'});
 add(svg,'rect',{x:558,y:142,width:44,height:11,rx:3,fill:'#a5d9ba',stroke:'#2a4c4c','stroke-width':3});
 label(svg,'AIRLOCK 06',580,117,11,'#c9d1ca',{'letter-spacing':3});
 add(svg,'rect',{x:450,y:190,width:24,height:38,rx:4,fill:'#223b47',stroke:'#91a1a0','stroke-width':3});
 add(svg,'rect',{x:455,y:196,width:14,height:14,rx:2,fill:'#89d9e0'});add(svg,'circle',{cx:462,cy:220,r:3,fill:'#e9c56b'});
 // Side benches retain the visual rhythm of a crew assembly room.
 for(let i=0;i<5;i++){chair(svg,205+i*22,352-i*22,.75-i*.045);chair(svg,955-i*22,352-i*22,.75-i*.045,true);}
 // Walkway joints and a muted yellow loading grid.
 const floorLines=add(svg,'g',{stroke:'#a4afab','stroke-width':2,opacity:.25});
 for(const y of [310,354,408,473,550,640])add(floorLines,'path',{d:`M${150+Math.max(0,410-y)*.94} ${y} H${1010-Math.max(0,410-y)*.94}`});
 for(let i=0;i<7;i++)add(floorLines,'path',{d:`M${345+i*78} 275 L${190+i*130} 710`});
 add(svg,'path',{d:'M296 475 H864 V675 H296 Z M296 540 H864 M296 606 H864 M438 475 V675 M580 475 V675 M722 475 V675',fill:'none',stroke:'#c5b36b','stroke-width':3,opacity:.48});
 for(const x of [160,986]){add(svg,'rect',{x,y:454,width:14,height:188,rx:4,fill:'#263b42'});for(let i=0;i<12;i++)add(svg,'path',{d:`M${x+2} ${462+i*14} h10`,stroke:'#7e9294','stroke-width':3});}
 // Left: compact gray work table with an actual visible laptop.
 add(svg,'ellipse',{cx:339,cy:490,rx:105,ry:20,fill:'#17282d',opacity:.33});
 add(svg,'path',{d:'M254 427 V489 H270 V431 M407 427 V489 H391 V431',stroke:'#22363e','stroke-width':6,fill:'#899293'});
 add(svg,'path',{d:'M245 401 L381 382 L423 420 L265 443 Z',fill:'#a1a7a2',stroke:'#263b43','stroke-width':6,'stroke-linejoin':'round'});
 add(svg,'path',{d:'M245 401 L265 423 L423 403 V420 L265 443 L245 425 Z',fill:'#6c7d80',stroke:'#2b4148','stroke-width':4});
 add(svg,'path',{d:'M294 331 L370 329 L378 394 L298 401 Z',fill:'#243a44',stroke:'#142831','stroke-width':6,'stroke-linejoin':'round'});
 add(svg,'path',{d:'M302 340 L361 338 L367 385 L307 389 Z',fill:'url(#bay-screen)',stroke:'#9dc7bd','stroke-width':2});
 add(svg,'path',{d:'M300 400 L378 392 L396 409 L314 420 Z',fill:'#a2b0ae',stroke:'#263d44','stroke-width':4});
 for(let y=0;y<3;y++)for(let x=0;x<7;x++)add(svg,'path',{d:`M${317+x*9+y*3} ${401+y*4} l5 -.5`,stroke:'#4e6d72','stroke-width':2});
 add(svg,'path',{d:'M315 360 h38 M315 367 h27 M315 375 h34',stroke:'#d9ffe0','stroke-width':3,opacity:.9});
 add(svg,'circle',{cx:351,cy:350,r:4,fill:'#e1ffb6'});label(svg,'CONTROL',332,356,5,'#264f49');
 // Right: freestanding metal wardrobe, hanging raincoats and changing platform.
 add(svg,'ellipse',{cx:836,cy:532,rx:111,ry:21,fill:'#17282d',opacity:.35});
 add(svg,'path',{d:'M768 316 L889 308 L921 331 L918 510 L781 526 L755 503 Z',fill:'#3b515c',stroke:'#20343e','stroke-width':7,'stroke-linejoin':'round'});
 add(svg,'path',{d:'M781 336 L906 327 L903 494 L783 508 Z',fill:'#243e4a',stroke:'#78908f','stroke-width':4});
 add(svg,'path',{d:'M790 351 L892 344',stroke:'#bbc9c4','stroke-width':5});
 for(const [i,color]of ['#b9d892','#dcae77','#93bfd0'].entries()){
  const x=807+i*31;add(svg,'path',{d:`M${x} 354 l-10 11 h20 z`,fill:'none',stroke:'#a4b9b7','stroke-width':2});
  add(svg,'path',{d:`M${x-8} 368 l-10 16 3 47 10 -4 v28 l15 -2 v-29 l9 1 1 -43 -10 -16 z`,fill:color,stroke:'#192f3b','stroke-width':4,'stroke-linejoin':'round'});
 }
 add(svg,'path',{d:'M768 316 L781 336 V526 L755 503 V335 Z',fill:'#657d83',stroke:'#263c46','stroke-width':4});
 label(svg,'FIELD GEAR',840,321,8,'#e6e4c4',{'letter-spacing':2});
 add(svg,'path',{d:'M757 522 L903 510 L931 536 L775 553 Z',fill:'#72898a',stroke:'#263f48','stroke-width':4});
 add(svg,'path',{d:'M786 537 L915 527',stroke:'#d0c88b','stroke-width':3});
 label(svg,'ASSEMBLY BAY',580,637,13,'#d3d7cb',{'letter-spacing':5});label(svg,'STORM BEACON · DEPARTURE DECK',580,660,8,'#b5c4c1',{'letter-spacing':3});
 const portrait=document.createElement('canvas');portrait.className='launch-your-keeper';portrait.width=240;portrait.height=280;portrait.setAttribute('aria-hidden','true');root.append(portrait);
 const name=document.createElement('span');name.className='launch-keeper-name';root.append(name);
 function hotspot(kind,title,hint,handler){const b=document.createElement('button');b.type='button';b.className=`launch-object launch-object-${kind}`;b.dataset[`launch${kind==='computer'?'Computer':'Wardrobe'}`]='';b.dataset.focus=`launch-${kind}`;b.setAttribute('aria-label',`${title}. ${hint}`);const label=document.createElement('span');label.className='launch-object-caption';label.textContent=title;const sub=document.createElement('small');sub.textContent=hint;label.append(sub);b.append(label);b.onclick=()=>handler(b);root.append(b);return b;}
 const computer=hotspot('computer','PLAY SETTINGS','Use computer',onSettings),wardrobe=hotspot('wardrobe','CUSTOMIZE','Open wardrobe',onWardrobe);
 function update(next,{pending=false}={}){const ctx=portrait.getContext('2d');ctx.clearRect(0,0,240,280);drawKeeper(ctx,{id:'p1',...next},120,215,{scale:2.5,label:false});name.textContent=next.name||'Your keeper';computer.disabled=wardrobe.disabled=pending;}
 update(profile);
 return {node:root,update};
}
