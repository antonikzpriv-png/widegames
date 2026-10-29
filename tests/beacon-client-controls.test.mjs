import test from 'node:test';
import assert from 'node:assert/strict';
import {descriptors,knowledge,observationText,criticalSites} from '../public/world/beacon-model.mjs';
import {visiblePlayers} from '../public/world/model.mjs';
import {createBeaconPanel} from '../public/world/beacon-panel.mjs';

// Explicit safe-view presentation fixtures. Not real engine/browser workflows.
const hint=(overrides={})=>({id:'lights',type:'systemRepair',fields:{systemId:'lights',siteId:'relay'},label:'Repair lighting relay',enabled:true,...overrides});
const room=()=>({roomId:'fixture-room',game:{beaconVersion:1,matchId:'fixture-match',phase:'roam',self:{id:'keeper-9',alive:true,roomId:'workshop',position:{x:665,y:680}},players:[],interactions:[hint()],systems:{lights:{active:true},communications:{active:false},doors:[],selfTransit:null},investigation:{session:null,observations:[],status:'available'}}});
function fixture(){
 const old=globalThis.document,document={hidden:false,activeElement:null};
 class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.handlers={};this.hidden=false;this.disabled=false;this.ownerDocument=document;this.text='';}
  append(...nodes){for(const n of nodes){n.remove();n.parent=this;this.children.push(n);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
  replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.text='';this.append(...nodes);}
  set textContent(v){this.replaceChildren();this.text=String(v);}get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
  addEventListener(k,fn){this.handlers[k]=fn;}
  contains(n){return this===n||this.children.some(c=>c.contains(n));}
  get isConnected(){return this===document.body||!!this.parent?.isConnected;}
  get visible(){return this.isConnected&&!this.hidden&&(!this.parent||this.parent.visible);}
  getClientRects(){return this.visible?[{}]:[];}
  focus(){if(this.visible&&!this.disabled)document.activeElement=this;}
 }
 document.createElement=tag=>new Node(tag);document.body=new Node('body');document.activeElement=document.body;globalThis.document=document;
 const calls=[],feedback=[];let action=async(type,fields)=>calls.push({type,fields}),stop=async()=>{};
 const panel=createBeaconPanel({id:'fixture',action:(...args)=>action(...args),stop:()=>stop(),feedback:text=>feedback.push(text)});document.body.append(panel.node);
 const all=(node=panel.node)=>[node,...node.children.flatMap(child=>all(child))];
 const button=id=>all().find(n=>n.dataset.interactionId===id);
 const click=async node=>{assert(node);if(!node.disabled)await node.handlers.click?.({target:node,preventDefault(){}});};
 const update=r=>panel.update(r,{now:1000,connected:true,pending:false});
 return {panel,document,calls,feedback,button,click,all,update,defer(){let fail;action=(type,fields)=>{calls.push({type,fields});return new Promise((_,reject)=>{fail=reject;});};return()=>fail(Error('OLD EQUIPMENT FAILURE'));},deferStop(){let done;stop=()=>new Promise(resolve=>{done=resolve;});return()=>done();},dispose(){panel.dispose();globalThis.document=old;}};
}

test('descriptor controls retain exact allowed fields and reject malformed/future ability hints',()=>{
 const game=room().game;game.interactions.push(hint({id:'extra',fields:{systemId:'lights',siteId:'relay',secret:'no'}}),hint({id:'bad',fields:{systemId:1,siteId:'relay'}}),hint({id:'future',type:'ability',fields:{abilityId:'x',targetId:'y'}}));assert.deepEqual(descriptors(game).map(h=>h.id),['lights']);
});
test('unknown status never becomes confirmed living or a visible actor from last-known alive',()=>{
 const game={beaconVersion:1,players:[{id:'u',status:'unknown',alive:true,position:{x:1,y:1}},{id:'a',status:'alive',alive:true,position:{x:2,y:2}},{id:'d',status:'dead',alive:false,position:{x:3,y:3}}]};assert.equal(knowledge(game,game.players[0]),'unknown');assert.deepEqual(visiblePlayers(game).map(p=>p.id),['a']);assert.equal(knowledge({}, {alive:false}),'dead');
});
test('enabled repair/device/hatch/cancel controls send exact server proposals',async()=>{
 const f=fixture();try{const r=room();r.game.interactions=[hint(),hint({id:'camera',type:'investigate',fields:{deviceId:'security'}}),hint({id:'hatch',type:'vent',fields:{entryId:'archive-hatch',exitId:'lantern-hatch'}}),hint({id:'cancel',type:'deviceCancel',fields:{}})];f.update(r);for(const h of r.game.interactions)await f.click(f.button(h.id));assert.deepEqual(f.calls,r.game.interactions.map(h=>({type:h.type,fields:h.fields})));}finally{f.dispose();}
});
test('unavailable action exposes the server reason without dispatching; update preserves its button',async()=>{
 const f=fixture();try{const r=room();r.game.interactions=[hint({enabled:false,reason:'Communications disrupted'})];f.update(r);const button=f.button('lights');await f.click(button);assert.deepEqual(f.feedback,['Communications disrupted']);assert.equal(f.calls.length,0);f.update(r);assert.equal(f.button('lights'),button);}finally{f.dispose();}
});
for(const boundary of ['room','match','actor','phase','position','hidden','disposed','withdrawn'])test('old equipment failure is inert after '+boundary,async()=>{
 const f=fixture();try{const r=room();f.update(r);const reject=f.defer(),pending=f.click(f.button('lights'));await new Promise(resolve=>setImmediate(resolve));const next=structuredClone(r);if(boundary==='room')next.roomId='next';if(boundary==='match')next.game.matchId='next';if(boundary==='actor')next.game.self.id='other';if(boundary==='phase')next.game.phase='discussion';if(boundary==='position')next.game.self.position.x++;if(boundary==='withdrawn')next.game.interactions=[];if(boundary==='hidden'){f.document.hidden=true;f.panel.suspend();f.document.hidden=false;}if(boundary==='disposed')f.panel.dispose();else f.update(next);reject();await pending;assert.deepEqual(f.feedback,[]);}finally{f.dispose();}
});
test('still-current failed action retains useful feedback and permits a new attempt',async()=>{
 const f=fixture();try{const r=room();f.update(r);const reject=f.defer(),pending=f.click(f.button('lights'));await new Promise(resolve=>setImmediate(resolve));reject();await pending;assert.deepEqual(f.feedback,['OLD EQUIPMENT FAILURE']);assert.equal(f.button('lights').disabled,false);}finally{f.dispose();}
});
test('deferred zero-input acknowledgement cannot dispatch equipment in a replacement room',async()=>{
 const f=fixture();try{const r=room();f.update(r);const finish=f.deferStop(),pending=f.click(f.button('lights'));const next=structuredClone(r);next.roomId='next';f.update(next);finish();await pending;assert.deepEqual(f.calls,[]);}finally{f.dispose();}
});
test('Escape closes the systems pane and restores its still-visible toggle focus',async()=>{
 const f=fixture();try{f.update(room());const toggle=f.all().find(n=>n.className==='lw-beacon-toggle');await f.click(toggle);assert.equal(f.panel.open,true);const pane=f.all().find(n=>n.className==='lw-beacon-pane');pane.handlers.keydown({key:'Escape',preventDefault(){}});assert.equal(f.panel.open,false);assert.equal(f.document.activeElement,toggle);}finally{f.dispose();}
});
test('critical sites use public infrastructure and supplied progress; samples are attributed historical text',()=>{
 const game=room().game;game.sabotage={active:true,kind:'flood',sites:[{id:'pump-galley',completed:true},{id:'pump-archive',completed:false}]};assert.equal(criticalSites(game)[0].roomId,'galley');const text=observationText({kind:'vitals',at:1000,players:[{id:'keeper-9',status:'dead'}]},[{id:'keeper-9',name:'Ada'}]);assert.match(text,/Ada: dead/);assert.match(text,/Historical sample, not live/);assert.doesNotMatch(text,/saboteur|crew|\{/);
});
