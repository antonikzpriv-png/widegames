import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createLobbyPanel} from '../public/lobby.mjs';
import {LOBBY_DEFAULTS,rosterFor} from '../shared/lobby.mjs';
import {worldInputEnvelope} from '../public/world-input-envelope.mjs';
import {createRoom,issueIdentity,cookie} from '../server/rooms.mjs';
import {createRoomStore} from '../server/store.mjs';
import {createGameServer} from '../server/transport.mjs';
import {loadConfig} from '../server/config.mjs';
import {mapFor,mapIdentity} from '../shared/maps/index.mjs';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const source=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
function rootFixture(){
 const requests=[],feedback={children:[],classList:{toggle(){}},setAttribute(){},replaceChildren(...children){this.children=children;},append(child){this.children.push(child);},get textContent(){return this.children.map(child=>child.text??'').join(' ');},set textContent(text){this.children=[{text}];}};
 const main={replaceChildren(){},querySelector(){return null;},querySelectorAll(){return [];}};
 const context={AbortController,DOMException,crypto,Date,setTimeout,clearTimeout,worldInputEnvelope,document:{hidden:false,body:{},querySelector:selector=>selector==='#feedback'?feedback:main},history:{replaceState(){},pushState(){}},sessionStorage:{setItem(){},removeItem(){}},h:(tag,attrs,text)=>({tag,attrs,text}),button:(text,click)=>({text,click}),roomFrom:value=>value,roomPath:(id,suffix='')=>'/api/rooms/'+id+suffix,actionEnvelope:(type,fields)=>({id:crypto.randomUUID(),type,...fields}),request:(route,options)=>new Promise((resolve,reject)=>requests.push({route,options,resolve,reject}))};
 context.globalThis=context;
 vm.runInNewContext(source.slice(0,source.indexOf('const rulesToggle=')).replace(/^import .*$/gm,'')+`;render=()=>{};saveFocus=()=>({});restoreFocus=()=>{};connect=()=>{};let releaseOpen;const realOpen=openRoom;globalThis.api={create,home,state:()=>({roomId,room,pending}),open:realOpen,holdOpen(){openRoom=async(...args)=>{await realOpen(...args);await new Promise(resolve=>releaseOpen=resolve);};},releaseOpen:()=>releaseOpen()};`,context);
 return {api:context.api,requests,feedback};
}
const created=()=>({roomId:'retained-room',generation:1,revision:1,isHost:true,seatId:'p1',phase:'lobby',game:null,seats:rosterFor(6),settings:{...LOBBY_DEFAULTS}});

for(const failure of ['settings','profile'])test(`a failed ${failure} setup keeps the created room and reports the unconfirmed change`,async()=>{
 const f=rootFixture(),preferences={settings:{speed:225},profile:{name:'Custom keeper',color:rosterFor(6)[1].color}},work=f.api.create('human',preferences);
 f.requests[0].resolve(created());await flush();assert.equal(f.requests[1].route,'/api/rooms/retained-room/settings');
 if(failure==='profile'){f.requests[1].resolve({...created(),settings:{...LOBBY_DEFAULTS,speed:225}});await flush();assert.equal(f.requests[2].route,'/api/rooms/retained-room/profile');}
 f.requests.at(-1).reject(new Error('Setup receipt unavailable'));await work;
 assert.equal(f.api.state().roomId,'retained-room');assert.equal(f.api.state().room.seatId,'p1');assert.equal(f.api.state().pending,false);
 assert.match(f.feedback.textContent,/room is open.*setup changes could not be confirmed.*Setup receipt unavailable.*Review the settings/);
 if(failure==='profile')assert.equal(f.api.state().room.settings.speed,225);
});

test('an aborted setup cannot reopen a room or publish a failure message',async()=>{
 const f=rootFixture(),work=f.api.create('human',{settings:{speed:225}});f.requests[0].resolve(created());await flush();f.requests[1].reject(new DOMException('Obsolete setup','AbortError'));await work;
 assert.equal(f.api.state().roomId,null);assert.equal(f.feedback.textContent,'');assert.equal(f.api.state().pending,false);
});

test('partial setup recovery cannot overwrite feedback after room navigation leaves and returns',async()=>{
 const f=rootFixture();f.api.holdOpen();const work=f.api.create('human',{settings:{speed:225}});f.requests[0].resolve(created());await flush();f.requests[1].reject(new Error('Obsolete setup failure'));await flush();
 assert.equal(f.api.state().roomId,'retained-room');f.api.home();await f.api.open('retained-room',created());const current=f.feedback.textContent;
 f.api.releaseOpen();await work;assert.equal(f.feedback.textContent,current);assert.doesNotMatch(f.feedback.textContent,/Obsolete setup failure/);
});

function domFixture(){
 const previous=globalThis.document,ctx=new Proxy({},{get:()=>()=>{},set:()=>true});
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.attrs=new Map();this.listeners=new Map();this.value='';this.text='';this.parentNode=null;}
  append(...children){for(const child of children){child.parentNode=this;this.children.push(child);}}
  replaceChildren(...children){this.children=[];this.text='';this.append(...children);}
  set textContent(text){this.children=[];this.text=String(text);}get textContent(){return this.text+this.children.map(child=>child.textContent).join('');}
  get options(){return this.children.filter(child=>child.tagName==='OPTION');}
  setAttribute(key,value){this.attrs.set(key,String(value));}getAttribute(key){return this.attrs.get(key)??null;}
  addEventListener(type,callback){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(callback);}
  emit(type){for(const callback of this.listeners.get(type)||[])callback({target:this});}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  getContext(){return ctx;}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);}
 }
 const document={createElement:tag=>new Node(tag),activeElement:null};globalThis.document=document;const host=new Node('section');
 return {host,all(){const values=[];function visit(node){values.push(node);node.children.forEach(visit);}visit(host);return values;},dispose(){if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}};
}

test('numeric settings from a restored Beacon1 lobby retain its exact map; an explicit destination change remains available',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'lw-client-legacy-map-')),store=await createRoomStore(dir),historical=createRoom('human',100000,true),issued=issueIdentity(historical,true),before=mapIdentity(mapFor(historical));
 await store.save(historical);await store.close();
 const config={...loadConfig({}),dataDir:dir,publicOrigin:'http://localhost:3000',now:()=>100000,tickMs:1000000},app=await createGameServer(config,{aiController:{describe:()=>({mode:'demo'}),decide:async()=>null}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 const route='/api/rooms/'+historical.id,auth=cookie(historical.id,issued.token,false).split(';')[0];
 async function request(suffix,body){const response=await fetch(`http://127.0.0.1:${app.server.address().port}${route}${suffix}`,{method:body===undefined?'GET':'POST',headers:{Origin:config.publicOrigin,Cookie:auth,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,200);return response.json();}
 let room=await request('');const dom=domFixture(),calls=[];t.after(()=>dom.dispose());
 const panel=createLobbyPanel({host:dom.host,mutate:async(suffix,body)=>{calls.push(body);room=await request(suffix,{generation:room.generation,...body});return room;},start:async()=>{},report:message=>assert.fail(message),archive:async()=>({})});panel.update(room);
 const fields=dom.all(),map=fields.find(node=>node.className==='lw-map-select'),settings=fields.find(node=>node.className==='lw-lobby-settings'),speed=fields.find(node=>node.name==='speed');
 assert.equal(map.options.length,5);assert.match(map.options.find(option=>option.value==='beacon').textContent,/6 rooms/);
 speed.value='225';speed.emit('input');await settings.onsubmit({preventDefault(){}});
 assert.equal(Object.hasOwn(calls[0],'mapId'),false);assert.equal(app.rooms.get(historical.id).data.settings.speed,225);assert.equal(mapIdentity(mapFor(app.rooms.get(historical.id).data)),before);
 panel.update(room);map.value='stormbreak-annex';map.emit('change');await settings.onsubmit({preventDefault(){}});
 assert.equal(calls[1].mapId,'stormbreak-annex');assert.equal(mapFor(app.rooms.get(historical.id).data).id,'stormbreak-annex');
});
