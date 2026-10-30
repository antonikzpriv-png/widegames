import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCouncil} from '../public/world/phases.mjs';
import {createTaskPuzzle} from '../public/world/puzzles.mjs';
import {createStationChallenge} from '../shared/station-challenges.mjs';
// Limited actual CSS cascade/rectangle contracts, not browser text measurement.
// Native focus, scroll offsets, virtual keyboard and touch remain lease-holder gates.
const base=readFileSync(new URL('../public/game.css',import.meta.url),'utf8');
const scoped=readFileSync(process.env.QUALITY_CLIENT_COUNCIL_SCOPED_CSS||new URL('../public/world/beacon.css',import.meta.url),'utf8');
function rules(source,queries=[],output=[]){
 source=source.replace(/\/\*[\s\S]*?\*\//g,'');let at=0;
 while(at<source.length){const open=source.indexOf('{',at);if(open<0)break;let end=open+1,depth=1;while(depth&&end<source.length){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;end++;}
  const head=source.slice(at,open).trim(),body=source.slice(open+1,end-1);at=end;
  if(head.startsWith('@media')){rules(body,[...queries,head.slice(6).trim()],output);continue;}
  if(head.startsWith('@'))continue;
  const declarations=body.split(';').flatMap(item=>{const m=item.trim().match(/^([\w-]+)\s*:\s*(.*)$/s);return m?[[m[1],m[2].trim()]]:[];});
  for(const selector of head.split(','))output.push({selector:selector.trim(),queries,declarations});
 }return output;
}
function media(query,{width,height,forcedColors=false}){return query.split(',').some(branch=>branch.split(/\s+and\s+/).every(part=>{
 const m=part.trim().match(/^\((min|max)-(width|height):\s*(\d+)px\)$/);if(m){const value=m[2]==='width'?width:height;return m[1]==='min'?value>=+m[3]:value<=+m[3];}
 if(/\((?:hover:none|pointer:coarse)\)/.test(part))return true;
 if(part==='(forced-colors:active)')return forcedColors;
 if(part==='(forced-colors:none)')return !forcedColors;
 if(/prefers-reduced-motion/.test(part))return false;
 throw Error('Unsupported media contract: '+part);
}));}

const node=(cls,parent=null,tag='div')=>({classes:cls.split(' '),parent,tag});
const world=node('lw-world'),stage=node('lw-stage',world),overlay=node('lw-scene-overlay',stage),council=node('lw-council',overlay),header=node('lw-council-heading',council),columns=node('lw-council-columns',council),critical=node('lw-critical',stage),task=node('lw-task-modal lw-station-modal',overlay),modalTitle=node('lw-modal-title',task);
const nodes={world,overlay,council,columns,header,clock:node('lw-council-clock',header,'span'),title:node('',header,'h1'),reason:node('lw-council-reason',council,'p'),transition:node('lw-meeting-transition',council,'p'),topbar:node('lw-topbar',stage),feedback:node('lw-feedback',stage,'p'),critical,criticalInfo:node('',critical,'span'),rail:node('',stage),task,modalTitle};
function matches(selector,target,state){
 for(const [part,yes]of [[':has(>.lw-council:not([hidden]))',state.council],[':has(.lw-council:not([hidden]))',state.council],[':has(.lw-feedback:not(:empty))',state.feedback],[':has(.lw-task-modal:not([hidden]))',!state.council]])if(selector.includes(part)){if(!yes)return false;selector=selector.replaceAll(part,'');}
 if(selector.includes('[data-critical=true]')){if(!state.critical)return false;selector=selector.replaceAll('[data-critical=true]','');}
 if(selector.includes(':not([hidden])')){if(!state.council&&target===council)return false;selector=selector.replaceAll(':not([hidden])','');}
 if(selector.includes(':empty')){if(state.feedback)return false;selector=selector.replaceAll(':empty','');}
 if(selector.includes('::after')){if(target!==nodes.rail)return false;selector=selector.replace('::after','');target=stage;}
 if(selector.includes(':last-child')){if(target!==nodes.criticalInfo)return false;selector=selector.replace(':last-child','');}
 if(/[[:#]/.test(selector))return false;
 const parts=selector.replaceAll('>',' > ').trim().split(/\s+/);let current=target,child=false;
 const accept=(part,n)=>{const m=part.match(/^([a-z][a-z0-9]*|\*)?((?:\.[\w-]+)*)$/);return m&&(!m[1]||m[1]==='*'||m[1]===n.tag)&&m[2].split('.').filter(Boolean).every(c=>n.classes.includes(c));};
 for(let i=parts.length-1;i>=0;i--){if(parts[i]==='>'){child=true;continue;}if(i===parts.length-1){if(!accept(parts[i],current))return false;}else{current=current?.parent;if(!child)while(current&&!accept(parts[i],current))current=current.parent;if(!current||!accept(parts[i],current))return false;}child=false;}return true;
}
const sheets=rules(base+'\n'+scoped);
function expand(key,value){const v=value.split(/\s+/),four=names=>names.map((n,i)=>[n,v.length===1?v[0]:v.length===2?v[i%2]:v.length===3?v[[0,1,2,1][i]]:v[i]]);return key==='padding'?four(['padding-top','padding-right','padding-bottom','padding-left']):key==='margin'?four(['margin-top','margin-right','margin-bottom','margin-left']):key==='inset'?four(['top','right','bottom','left']):[[key,value]];}
function style(name,view,state,source=sheets){const out={},rank={};for(const rule of source){if(!rule.queries.every(q=>media(q,view))||!matches(rule.selector,nodes[name],state))continue;const specificity=(rule.selector.match(/\.[\w-]+|\[[^\]]+\]/g)||[]).length;for(const [key,raw]of rule.declarations){const score=specificity+(/!important$/.test(raw)?1000:0);for(const [property,value]of expand(key,raw.replace(/\s*!important$/,''))){if(score<(rank[property]??-1))continue;rank[property]=score;out[property]=value;}}}return out;}
const px=v=>{assert.match(v,/^(?:0|[\d.]+px)$/,'expected actual pixel reservation');return parseFloat(v);};
const views=[{width:320,height:740},{width:390,height:844},{width:844,height:390}];
for(const view of views)for(const criticalState of [false,true])for(const feedbackState of [false,true])test(`council reservation ${view.width}x${view.height} critical=${criticalState} feedback=${feedbackState}`,()=>{
 const state={council:true,critical:criticalState,feedback:feedbackState},outer=style('overlay',view,state),panel=style('council',view,state),body=style('columns',view,state),topbar=style('topbar',view,state),rail=style('rail',view,state),top=px(outer.top),bottom=view.height-px(outer.bottom);
 assert(top>=px(topbar['min-height'])+8,'heading starts below persistent topbar');assert(bottom<=view.height-px(rail.height),'all council targets end above rail');assert.equal(outer.overflow,'hidden','focus cannot scroll the outer council under topbar');assert.equal(outer.display,'block');assert.equal(panel.height,'100%');assert.equal(panel['min-height'],'0');assert.equal(panel.overflow,'hidden');assert.equal(panel.display,'grid');assert.equal(panel['grid-template-rows'],'auto auto auto minmax(0,1fr)');assert.equal(panel['margin-top'],'0');assert.equal(body['min-height'],'0');assert.equal(body.overflow,'auto');assert.equal(body['overscroll-behavior'],'contain');assert.equal(style('world',view,state)['min-height'],'0','keyboard-sized viewport must not retain a550px minimum');
 assert.equal(style('clock',view,state)['flex-shrink'],'0');assert.equal(style('header',view,state)['align-items'],'flex-start');
 if(criticalState){const alert=style('critical',view,state);assert(px(alert.top)>=px(topbar['min-height']));assert(px(alert.top)+px(alert['max-height'])<=top-8,'critical clock has its own reserved band');assert.equal(style('criticalInfo',view,state).overflow,'auto');}
 if(feedbackState){const feedback=style('feedback',view,state),feedbackTop=view.height-px(feedback.bottom)-px(feedback['max-height']);assert(bottom<=feedbackTop-4,'feedback cannot cover Send/vote hit targets even at its maximum height');assert(view.height-px(feedback.bottom)<view.height-px(rail.height));assert.equal(feedback.transform,'none');assert.equal(feedback.overflow,'auto');assert.notEqual(feedback.display,'none','current failure/status stays visible');}
 const panelHeight=bottom-top-px(outer['padding-top'])-px(outer['padding-bottom']);assert(panelHeight>=120,'council has a usable bounded viewport');
});
test('short landscape reserves at least a44px body row with its actual compact header metrics',()=>{
 const view=views[2],state={council:true,critical:true,feedback:true},outer=style('overlay',view,state),panel=style('council',view,state),badge=style('transition',view,state),heading=style('title',view,state),reason=style('reason',view,state);
 const line=c=>parseFloat(c['font-size'])*parseFloat(c['line-height']);
 const headerBudget=line(badge)+px(badge['padding-top'])+px(badge['padding-bottom'])+2*px(badge.border.split(' ')[0])+px(badge['margin-bottom'])+line(heading)+line(reason)+px(reason['margin-top'])+px(reason['margin-bottom']);
 const bodyBudget=view.height-px(outer.top)-px(outer.bottom)-px(outer['padding-top'])-px(outer['padding-bottom'])-px(panel['padding-top'])-px(panel['padding-bottom'])-2*px(panel.border.split(' ')[0])-headerBudget;
 assert(bodyBudget>=44,'one-line bounded header fixture leaves a whole touch row; native text/wrapping still requires browser QA');
});
test('council-only rules leave gameplay and glyph equipment scrolling unchanged',()=>{
 for(const view of views){const state={council:false,critical:false,feedback:true};for(const name of ['task','modalTitle'])assert.deepEqual(style(name,view,state),style(name,view,state,rules(base)),'scoped council rules must not alter task scroll/header');const panel=style('task',view,state);assert.equal(panel.overflow,'auto');assert.equal(style('modalTitle',view,state).position,'sticky');}
});
function domFixture(){
 const saved=new Map(['document','window','matchMedia','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
 const events=()=>({handlers:new Map(),addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn);},removeEventListener(type,fn){this.handlers.get(type)?.delete(fn);},emit(type,init={}){const e={key:'',target:this,button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...init};for(const fn of this.handlers.get(type)||[])fn(e);return e;}});
 const document={...events(),hidden:false,activeElement:null};
 const ctx=new Proxy({}, {get:(_,key)=>key.startsWith('create')?()=>({addColorStop(){}}):()=>{},set:()=>true});
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attrs=new Map();this.dataset={};this.style={setProperty(){}};this.hidden=false;this.disabled=false;this.text='';this.value='';this.ownerDocument=document;Object.assign(this,events());}
  setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)??null;}
  set className(v){this.setAttribute('class',v);}get className(){return this.getAttribute('class')||'';}
  get classList(){return {add:(...v)=>this.className=[...new Set([...this.className.split(' '),...v])].join(' '),remove:(...v)=>this.className=this.className.split(' ').filter(s=>!v.includes(s)).join(' ')};}
  append(...nodes){for(const n of nodes){n.remove();this.children.push(n);n.parentNode=this;}}
  replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.text='';this.append(...nodes);}
  remove(){if(this.parentNode){if(this.contains(document.activeElement))document.activeElement=document.body;this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}
  get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}set textContent(v){this.replaceChildren();this.text=String(v);}
  get isConnected(){return this===document.body||this===document.head||!!this.parentNode?.isConnected;}
  get visible(){return this.isConnected&&!this.hidden&&(!this.parentNode||this.parentNode.visible);}
  contains(node){return this===node||this.children.some(n=>n.contains(node));}
  matches(selector){if(selector==='link[data-beacon-style]')return this.tagName==='LINK'&&this.attrs.has('data-beacon-style');if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));if(selector.startsWith('[')){const m=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return m&&this.attrs.has(m[1])&&(m[2]===undefined||this.attrs.get(m[1])===m[2]);}return this.tagName===selector.toUpperCase();}
  querySelectorAll(selector){const tests=selector.split(','),found=[];const walk=node=>{for(const child of node.children){if(tests.some(s=>child.matches(s)))found.push(child);walk(child);}};walk(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){return selector.split(',').some(s=>this.matches(s))?this:this.parentNode?.closest(selector);}
  focus(){if(this.visible&&!this.disabled)document.activeElement=this;}
  getClientRects(){return this.visible?[{}]:[];}
  getContext(){return ctx;}getBoundingClientRect(){return {width:0,height:0,left:0,top:0};}
 }
 document.createElement=tag=>new Node(tag);document.body=new Node('body');document.head=new Node('head');document.activeElement=document.body;document.querySelector=selector=>document.head.querySelector(selector)||document.body.querySelector(selector);
 const win={...events(),setInterval:()=>1,clearInterval(){}};Object.assign(globalThis,{document,window:win,matchMedia:()=>({matches:true}),requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const host=new Node('main');document.body.append(host);return {host,document,win,dispose(){host.remove();for(const [k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}


test('real council keeps heading/timer outside the body, native controls and IME/draft focus across updates',async()=>{
 const f=domFixture(),calls=[];let resolve;const pane=createCouncil({id:'layout',action:(type,fields)=>{calls.push({type,fields});return new Promise(done=>resolve=done);},feedback(){},pending:()=>false});
 const g={matchId:'layout',phase:'discussion',self:{id:'owner',alive:true},players:[{id:'owner',name:'Owner',alive:true},{id:'other',name:'Other',alive:true}],deadlineAt:20000,availableActions:['say'],meeting:{id:'council',calledBy:'owner',reason:'emergency',eligibleVoters:['owner','other'],votes:[],messages:[]}};
 try{f.host.append(pane.node);pane.update(g,{now:1000});const columns=pane.node.querySelector('.lw-council-columns'),heading=pane.node.querySelector('.lw-council-heading'),timer=pane.node.querySelector('.lw-council-clock'),form=pane.node.querySelector('form');assert.equal(columns.contains(heading),false);assert.equal(heading.contains(timer),true);assert.equal(timer.getAttribute('role'),'timer');assert.equal(columns.contains(pane.chat),true);pane.focus();pane.chat.value='draft ??';pane.chat.emit('compositionstart');pane.update(structuredClone(g),{now:1500});assert.equal(f.document.activeElement,pane.chat);assert.equal(pane.chat.value,'draft ??');form.emit('submit',{isComposing:true});assert.equal(calls.length,0);pane.chat.emit('compositionend');form.emit('submit');assert.equal(calls[0].type,'say');resolve();await new Promise(done=>setImmediate(done));const vote=structuredClone(g);vote.phase='voting';vote.availableActions=['vote'];pane.update(vote,{now:2000});assert.ok(columns.querySelectorAll('button').some(b=>b.getAttribute('aria-label')==='Vote to eject Other'&&!b.disabled));assert.equal(pane.node.querySelector('.lw-council-heading'),heading);
 }finally{pane.dispose();f.dispose();}
});
test('glyph target clue remains in the scrollable modal flow with its native Close and tile controls',()=>{
 const f=domFixture(),puzzle=createTaskPuzzle({id:'recover',task:{id:'glyph',label:'Glyph inspection',kind:'station',challenge:createStationChallenge({kind:'glyphs',seed:'recover'})},onSubmit(){},onClose(){}});try{f.host.append(puzzle.node);const clue=puzzle.node.querySelector('.lw-task-instruction'),title=puzzle.node.querySelector('.lw-modal-title');assert.match(clue.textContent,/Select every .*tile/);assert.equal(puzzle.node.children.includes(clue),true);assert.equal(title.contains(clue),false,'clue stays in normal recoverable modal flow');assert.ok(puzzle.node.querySelectorAll('button').some(b=>b.textContent==='Close station'));assert.equal(puzzle.node.querySelectorAll('button').filter(b=>b.getAttribute('aria-label')?.startsWith('Inspection tile ')).length,9);}finally{puzzle.dispose();f.dispose();}
});

test('CSS fixture preserves normal and explicitly active forced-colors media semantics',()=>{assert.equal(media('(forced-colors:active)',{width:320,height:740}),false);assert.equal(media('(forced-colors:active)',{width:320,height:740,forcedColors:true}),true);assert.equal(media('(forced-colors:none)',{width:320,height:740,forcedColors:true}),false);});
