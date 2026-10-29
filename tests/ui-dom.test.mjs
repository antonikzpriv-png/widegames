import test from 'node:test';
import assert from 'node:assert/strict';
import {syncChildren} from '../public/ui.mjs';

// A small DOM interface fixture exercises reconciliation without launching a browser.
class FixtureNode{
 constructor(tag,attributes={},children=[]){
  this.nodeType=1;this.tagName=tag.toUpperCase();this._attributes=new Map(Object.entries(attributes));
  this.childNodes=[];this.parentNode=null;this._listeners=new Map();this.value='';
  for(const child of children)this.insertBefore(child,null);
 }
 get attributes(){return [...this._attributes].map(([name,value])=>({name,value}));}
 get id(){return this.getAttribute('id')||'';}
 get lastChild(){return this.childNodes.at(-1);}
 getAttribute(name){return this._attributes.get(name)??null;}
 hasAttribute(name){return this._attributes.has(name);}
 setAttribute(name,value){this._attributes.set(name,String(value));}
 removeAttribute(name){this._attributes.delete(name);}
 insertBefore(node,before){node.remove();const index=before?this.childNodes.indexOf(before):this.childNodes.length;assert.ok(index>=0);this.childNodes.splice(index,0,node);node.parentNode=this;}
 remove(){if(this.parentNode){const siblings=this.parentNode.childNodes;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}
 addEventListener(type,listener){this._listeners.set(type,listener);}
 removeEventListener(type,listener){if(this._listeners.get(type)===listener)this._listeners.delete(type);}
}
const node=(tag,attrs={},...children)=>new FixtureNode(tag,attrs,children);

test('removing a fallback notice preserves the live council and its typed field',()=>{
 const input=node('textarea',{id:'council-message','data-focus':'council-message'});input.value='My live draft';
 const council=node('section',{},input),grid=node('div',{id:'game-layout'},council);
 const root=node('main',{},node('div',{id:'watch-heading'}),node('p',{class:'notice'}),node('div',{id:'phase-clock'}),grid);
 const nextInput=node('textarea',{id:'council-message','data-focus':'council-message'});nextInput.value='My live draft';
 const source=node('div',{},node('div',{id:'watch-heading'}),node('div',{id:'phase-clock'}),node('div',{id:'game-layout'},node('section',{},nextInput)));
 syncChildren(root,source);
 assert.equal(root.childNodes[2],grid);assert.equal(grid.childNodes[0],council);assert.equal(council.childNodes[0],input);assert.equal(input.value,'My live draft');
});

test('live reconciliation retains IME text and installs the current action handler',()=>{
 const input=node('textarea',{id:'council-message'});input.value='composition in progress';input._uiComposing=true;
 const button=node('button',{'data-focus':'vote-skip'}),old=()=>{},current=()=>{};
 button._uiHandlers={click:old};button.addEventListener('click',old);
 const root=node('main',{},input,button),nextInput=node('textarea',{id:'council-message'});nextInput.value='last committed draft';
 const nextButton=node('button',{'data-focus':'vote-skip'});nextButton._uiHandlers={click:current};
 syncChildren(root,node('div',{},nextInput,nextButton));
 assert.equal(root.childNodes[0],input);assert.equal(input.value,'composition in progress');assert.equal(button._listeners.get('click'),current);
 input._uiComposing=false;syncChildren(root,node('div',{},nextInput,nextButton));
 assert.equal(input.value,'last committed draft');
});
