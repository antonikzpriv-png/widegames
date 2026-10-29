import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as model from '../public/world/model.mjs';
import {CHARACTERS} from '../shared/contracts.mjs';
import {getMap} from '../shared/maps/index.mjs';
import * as mapHelpers from '../public/world/map-model.mjs';
import * as beaconHelpers from '../public/world/beacon-model.mjs';

// Actual experience render with a small DOM and inert drawing/input/phase panes.
// Safe-view/geometry fixtures test labels, not engine actions or browser accessibility.
function fixture(){
 const events=()=>({addEventListener(){},removeEventListener(){}});
 class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.style={};this.text='';this.hidden=false;Object.assign(this,events());}
  setAttribute(key,value){this.attrs[key]=String(value);}getAttribute(key){return this.attrs[key];}
  append(...nodes){for(const node of nodes){node.remove();node.parent=this;this.children.push(node);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
  set textContent(value){this.text=String(value);this.children=[];}get textContent(){return this.text+this.children.map(node=>node.textContent).join('');}
  focus(){}getContext(){return {clearRect(){}};}
 }
 const document={...events(),hidden:false,createElement:tag=>new Node(tag)};
 const pane=()=>({node:new Node('section'),update(){},focus(){},dispose(){}});
 const world={WORLD:{interactionRadius:92,killRadius:70,reportRadius:130},WORLD_STATIONS:{bridge:{x:100,y:100}},WORLD_BELL:{x:200,y:100}};
 const context=vm.createContext({...model,...mapHelpers,mapRoomName:mapHelpers.roomName,...beaconHelpers,getMap,world,CHARACTERS,document,window:events(),Date,performance:{now:()=>100},matchMedia:()=>({matches:true}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},
  drawKeeper(){},createWorldScene:()=>({update(){},draw(){},dispose(){}}),createWorldInput:()=>({stop(){},sync(){},dispose(){}}),createCouncil:pane,createResults:pane,restoreTrigger(){},trapDialog(){}});
 const module=(file,names)=>Object.assign(context,vm.runInContext(`(()=>{${readFileSync(new URL('../public/world/'+file+'.mjs',import.meta.url),'utf8').replace(/^\uFEFF/,'').replace(/^import .*$/gm,'').replace(/^export /gm,'')};return {${names}};})()`,context));
 module('dom','dom,control,setText,trapDialog,restoreTrigger');
 module('lobby-map','createLobbyMapSelector');
 module('sound','createLocalSound');
 const source=readFileSync(new URL('../public/world/experience.mjs',import.meta.url),'utf8').replace(/^\uFEFF/,'').replace(/^import .*$/gm,'').replace(/^export /gm,'');
 const create=vm.runInContext(`(()=>{${source};return createWorldExperience;})()`,context),host=new Node('main');
 const experience=create(host,{action:async()=>{throw Error('Unexpected action in label fixture');},input:async()=>{},start:async()=>{},leave(){},loadReplay:async()=>({replay:[]})});
 function find(className,node=host){if(node.className===className)return node;for(const child of node.children){const result=find(className,child);if(result)return result;}}
 return {experience,find,update:room=>experience.update(room,{now:1000,connected:true,pending:false})};
}
function room({alive=true,spectator=false,ended=false}={}){
 return {roomId:'label-room',mode:spectator?'spectator':'human',ai:{mode:'demo'},notices:[],game:{worldVersion:1,matchId:'label-match',phase:ended?'ended':'roam',players:CHARACTERS.map(p=>({...p,alive:true,position:null,...(ended?{role:p.id==='p2'?'saboteur':'crew'}:{})})),
  self:spectator?null:{id:'p1',alive,role:'crew',roomId:'bridge',position:{x:100,y:100},inputSeq:0,tasks:[]},tasks:{total:15,completed:0},availableActions:[],events:[]}};
}
function labels(f){return {help:f.find('lw-help').textContent,canvas:f.find('lw-world-canvas').getAttribute('aria-label'),location:f.find('lw-location').textContent};}
function assertObserving(f){const text=labels(f);assert.doesNotMatch(text.help,/walk|WASD|arrows|E use|R report|Q eliminate/i);assert.doesNotMatch(text.canvas,/keyboard|click the deck|to walk/i);assert.match(text.help,/observ|map/i);assert.match(text.canvas,/observ/i);assert.equal(f.find('lw-map-toggle').hidden,false,'map remains available to observers');}

test('living keeper in roam retains walking and contextual keyboard prompts',()=>{
 const f=fixture();try{f.update(room());const text=labels(f);assert.match(text.help,/WASD.*arrows.*walk/);assert.match(text.help,/E use.*R report.*Q eliminate.*M map/);assert.match(text.canvas,/keyboard or click the deck to walk/);assert.equal(text.location,'Bridge');}finally{f.experience.dispose();}
});
test('fallen keeper receives observation guidance without unavailable walking prompts',()=>{
 const f=fixture();try{f.update(room({alive:false}));assertObserving(f);assert.match(labels(f).location,/Fallen.*Bridge/);}finally{f.experience.dispose();}
});
test('active spectator sees observation guidance and truthful pre-end role privacy',()=>{
 const f=fixture();try{f.update(room({spectator:true}));assertObserving(f);assert.match(labels(f).location,/Public observation.*roles hidden/);assert.doesNotMatch(labels(f).location,/roles revealed/);}finally{f.experience.dispose();}
});
test('ended spectator sees roles revealed and no walking instructions',()=>{
 const f=fixture();try{f.update(room({spectator:true,ended:true}));assert.match(labels(f).location,/Public observation.*roles revealed/);assertObserving(f);assert.doesNotMatch(labels(f).location,/roles hidden/);}finally{f.experience.dispose();}
});
test('retained label and canvas nodes update across death, results and a fresh active watch',()=>{
 const f=fixture();try{f.update(room());const canvas=f.find('lw-world-canvas'),help=f.find('lw-help'),location=f.find('lw-location');f.update(room({alive:false}));assertObserving(f);f.update(room({spectator:true,ended:true}));assert.match(labels(f).location,/roles revealed/);f.update(room({spectator:true}));assert.match(labels(f).location,/roles hidden/);f.update(room({ended:true}));assertObserving(f);const fresh=room();fresh.game.matchId='fresh-watch';f.update(fresh);assert.match(labels(f).help,/WASD/);assert.equal(f.find('lw-world-canvas'),canvas);assert.equal(f.find('lw-help'),help);assert.equal(f.find('lw-location'),location);}finally{f.experience.dispose();}
});
