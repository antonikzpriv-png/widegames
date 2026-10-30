import test from 'node:test';
import assert from 'node:assert/strict';
import {visionFrame,doorShapes} from '../public/world/beacon-scene.mjs';
import {createWorldScene} from '../public/world/scene.mjs';
import {contexts,validTaskSession} from '../public/world/model.mjs';
import * as world from '../shared/world.mjs';
import {createWorldInput} from '../public/world/input.mjs';

// Command-recording canvas, not pixels/browser qualification or engine physics.
function canvas(width=390,height=640){
 const calls=[];
 const ctx=new Proxy({}, {get(target,key){if(key in target)return target[key];if(key==='createRadialGradient'||key==='createLinearGradient')return (...args)=>{calls.push([key,...args]);return {addColorStop(){}};};return (...args)=>calls.push([key,...args]);},set(target,key,value){target[key]=value;return true;}});
 return {calls,getContext:()=>ctx,getBoundingClientRect:()=>({width,height,left:0,top:0})};
}
function room(){return {roomId:'spatial-fixture',game:{beaconVersion:1,worldVersion:1,matchId:'spatial-match',phase:'roam',vision:{origin:{x:930,y:730},radius:110},self:{id:'k-12',alive:true,role:'crew',roomId:'workshop',position:{x:930,y:730},inputSeq:27,tasks:[]},players:[{id:'k-12',name:'SELF FIXTURE',color:'#abc',status:'alive',alive:true,position:{x:930,y:730}},{id:'unknown',name:'HIDDEN FIXTURE',status:'unknown',alive:true,position:null}],events:[],availableActions:[],systems:{doors:[{id:'lower-spine',closed:true}],lights:{active:true},communications:{active:false},selfTransit:null},interactions:[]}};}
test('vision uses the safe origin and supplied radius without a 360-unit cap; unknown radius stays unknown',()=>{
 const g=room().game;g.vision.radius=850;assert.equal(visionFrame(g).radius,850);assert.deepEqual(visionFrame(g).origin,{x:930,y:730});delete g.vision.radius;assert.equal(visionFrame(g).radius,0);assert.equal(visionFrame({worldVersion:1}),null);
});
test('doors use only supplied public open/closed status and preserve unknown',()=>{
 const doors=doorShapes(room().game);assert.equal(doors.find(d=>d.id==='lower-spine').closed,true);assert.equal(doors.find(d=>d.id==='east-upper').closed,null);
});
for(const width of [320,390,768])test(`actual canvas commands at ${width} use reduced vision, safe labels and camera origin`,()=>{
 const surface=canvas(width),scene=createWorldScene(surface,{reduced:true}),r=room();scene.update(r,0);scene.draw(100);const gradient=surface.calls.filter(c=>c[0]==='createRadialGradient').at(-1);const zoom=Math.max(.64,Math.min(1.28,Math.min(width/650,640/650)));assert(Math.abs(gradient[6]-110*zoom)<1e-8);assert.deepEqual(scene.toWorld(width/2,320),r.game.vision.origin);const labels=surface.calls.filter(c=>c[0]==='fillText').map(c=>c[1]);assert(labels.includes('SELF FIXTURE'));assert(!labels.includes('HIDDEN FIXTURE'));assert(labels.includes('CLOSED'));assert(labels.includes('UNKNOWN'));scene.dispose();
});
test('hidden safe actor is removed immediately; static hatches reveal no transit identities/routes',()=>{
 const surface=canvas(),scene=createWorldScene(surface,{reduced:true}),r=room();scene.update(r,0);scene.draw(0);surface.calls.length=0;r.game.players[0].position=null;r.game.players[0].status='unknown';scene.update(r,10);scene.draw(10);const labels=surface.calls.filter(c=>c[0]==='fillText').map(c=>c[1]);assert(!labels.includes('SELF FIXTURE'));assert(labels.includes('HATCH'));assert(!labels.some(text=>/archive-hatch.*lantern-hatch|k-12/.test(text)));scene.dispose();
});
test('multiple flood sites are drawn at their actual fixture coordinates instead of one Engine station',()=>{
 const surface=canvas(),scene=createWorldScene(surface,{reduced:true}),r=room();r.game.sabotage={active:true,kind:'flood',roomId:'galley',sites:[{id:'pump-galley',completed:true},{id:'pump-archive',completed:false}]};scene.update(r,0);scene.draw(0);const markers=surface.calls.filter(c=>c[0]==='fillText'&&String(c[1]).startsWith('FLOOD'));assert(markers.some(c=>c[1]==='FLOOD OK'&&c[2]===370&&c[3]===989));assert(markers.some(c=>c[1]==='FLOOD !'&&c[2]===370&&c[3]===539));scene.dispose();
});
test('USE opens explicit permitted repair/device/hatch choices; no guessed hatch exit or legacy repair',()=>{
 const g=room().game;g.interactions=[{id:'route',type:'vent',fields:{entryId:'workshop-hatch',exitId:'archive-hatch'},label:'Hatch to Archive',enabled:true}];let use=contexts(g,world).use;assert.equal(use.type,'beaconPanel');assert.equal(use.descriptorId,'route');assert.equal(use.fields,undefined);g.interactions=[{id:'repair',type:'systemRepair',fields:{systemId:'power',siteId:'power-west'},label:'Power coupler',enabled:true}];use=contexts(g,world).use;assert.equal(use.descriptorId,'repair');assert.notEqual(use.type,'repair');
});
test('a current task becomes invalid during self-only transit even if its last position remains at the station',()=>{
 const r=room(),g=r.game;g.self.position={...world.WORLD_STATIONS.workshop};g.self.tasks=[{id:'task-fixture',roomId:'workshop',completed:false}];g.availableActions=['task'];g.interactions=[{id:'task-fixture',type:'task',fields:{taskId:'task-fixture'},label:'Task fixture',enabled:true}];const session={roomId:r.roomId,matchId:g.matchId,taskId:'task-fixture',location:'workshop'};assert.equal(validTaskSession(session,r,world),true);g.self.transit={entryId:'workshop-hatch',exitId:'archive-hatch',deadlineAt:2600};assert.equal(!!validTaskSession(session,r,world),false);
});
test('opening equipment can explicitly cancel an accepted click route while manual input is idle',async()=>{
 const emitter=()=>({addEventListener(){},removeEventListener(){}}),win={...emitter(),setInterval:()=>1,clearInterval(){}},doc={...emitter(),hidden:false},target=emitter(),calls=[];
 const input=createWorldInput({win,doc,target,joystick:{...emitter()},knob:{style:{}},getState:()=>({enabled:false,inputAllowed:true,inputSeq:27}),onInput:async value=>calls.push(value),onClick(){},onShortcut(){}});await input.stop();assert.equal(calls.length,0);await input.stop({force:true});assert.deepEqual(calls,[{seq:28,dx:0,dy:0}]);input.dispose();
});
