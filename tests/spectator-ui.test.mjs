import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorld,MAPS} from '../shared/world.mjs';
import {createSpectatorInput,describeSpectatorSelection,observerAgents} from '../public/world/spectator.mjs';

class Events{
 constructor(){this.listeners=new Map();}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 fire(type,fields={}){const event={key:'',button:0,target:{closest:()=>null},preventDefault(){this.defaultPrevented=true;},...fields};for(const fn of this.listeners.get(type)||[])fn(event);return event;}
 count(){return [...this.listeners.values()].reduce((sum,set)=>sum+set.size,0);}
}
function fixture(){const win=new Events(),doc=new Events(),target=new Events(),moves=[],clicks=[];doc.hidden=false;let enabled=true;const controller=createSpectatorInput({target,getState:()=>({enabled}),onMove:(vector,elapsed)=>moves.push({vector,elapsed}),onClick:event=>clicks.push(event),win,doc});return {win,doc,target,moves,clicks,controller,setEnabled:value=>{enabled=value;}};}

test('spectator ghost controls move locally with normalized diagonals and bounded frame gaps',()=>{
 const f=fixture();f.controller.step(0);assert.equal(f.win.fire('keydown',{key:'w'}).defaultPrevented,true);f.win.fire('keydown',{key:'d'});f.controller.step(16);
 assert.equal(f.moves.length,1);assert.equal(f.moves[0].elapsed,16);assert.ok(Math.abs(Math.hypot(f.moves[0].vector.dx,f.moves[0].vector.dy)-1)<1e-12);assert.ok(f.moves[0].vector.dx>0&&f.moves[0].vector.dy<0);
 f.controller.step(1000);assert.equal(f.moves[1].elapsed,50);f.win.fire('keyup',{key:'d'});f.win.fire('keyup',{key:'w'});f.controller.step(1016);assert.equal(f.moves.length,2);f.controller.dispose();
});

test('spectator controls protect typing and stop on hidden, blur, disabled state and disposal',()=>{
 const f=fixture();f.controller.step(0);f.win.fire('keydown',{key:'w',target:{closest:()=>({})}});f.controller.step(20);assert.equal(f.moves.length,0);
 f.win.fire('keydown',{key:'w'});f.win.fire('blur');f.controller.step(40);assert.equal(f.moves.length,0);
 f.win.fire('keydown',{key:'w'});f.doc.hidden=true;f.doc.fire('visibilitychange');f.doc.hidden=false;f.controller.step(60);f.controller.step(80);assert.equal(f.moves.length,0);
 f.setEnabled(false);f.win.fire('keydown',{key:'w'});f.target.fire('click');f.controller.step(100);assert.equal(f.moves.length,0);assert.equal(f.clicks.length,0);
 f.setEnabled(true);f.target.fire('click');assert.equal(f.clicks.length,1);f.controller.dispose();assert.equal(f.win.count()+f.doc.count()+f.target.count(),0);f.win.fire('keydown',{key:'w'});f.controller.step(120);assert.equal(f.moves.length,0);
});

function game(){return {matchId:'m1',self:null,players:[{id:'p1',name:'Iona',alive:true,roomId:'bridge',position:{x:800,y:280}}],events:[],inspection:{mode:'all-ai-observer',matchId:'m1',agents:[{id:'p1',role:'saboteur',alive:true,roomId:'bridge',position:{x:800,y:280},tasks:[{id:'t1',label:'Fix wiring',roomId:'bridge',completed:false,progress:{kind:'wires',index:1,total:3}}],activity:{source:'recorded-action',label:'Navigating to Bridge'},recentActions:[{at:10.25,type:'navigate',label:'Moved toward station'}],claims:[{at:11.5,text:'I am doing wiring.'}],rawContext:'SECRET',thinking:'SECRET'}]}};}

test('all-AI inspector shows only narrow role/tasks/activity fields and labels reasoning limits',()=>{
 const data=game();data.serverNow=1000;data.inspection.agents[0].cooldowns={taskAt:2000,killAt:900,untrusted:30};const description=describeSpectatorSelection(data,{type:'player',id:'p1'});assert.deepEqual(description.facts.find(([key])=>key==='Role'),['Role','saboteur']);assert.equal(description.followId,'p1');const serialized=JSON.stringify(description);assert.match(serialized,/1\/3 confirmed steps/);assert.match(serialized,/10.25/);assert.match(serialized,/Private thoughts are unavailable/);assert.match(serialized,/accepted recorded action/);assert.doesNotMatch(serialized,/SECRET|rawContext|thinking|untrusted/);assert.match(serialized,/Task equipment · 1s remaining/);assert.match(serialized,/Elimination · Ready/);
});

test('inspector denies player-seat and mismatched-match inspection while preserving safe public observations',()=>{
 const data=game();data.inspection.matchId='old';assert.deepEqual(observerAgents(data),[]);assert.deepEqual(describeSpectatorSelection(data,{type:'player',id:'p1'}).facts.find(([key])=>key==='Role'),['Role','Hidden']);data.self={id:'p1'};data.inspection.matchId='m1';assert.equal(describeSpectatorSelection(data,{type:'player',id:'p1'}),null);assert.deepEqual(observerAgents(data),[]);
});

test('world-object inspection supports stations, rooms, bell, props and unknown safe fallbacks',()=>{
 const data=game();assert.match(JSON.stringify(describeSpectatorSelection(data,{type:'station',id:'station-bridge'})),/Fix wiring/);assert.match(JSON.stringify(describeSpectatorSelection(data,{type:'room',id:'bridge'})),/Iona/);assert.match(describeSpectatorSelection(data,{type:'bell',id:'bell'}).description,/Observers cannot ring/);assert.match(describeSpectatorSelection(data,{type:'prop',id:'chart-table'}).description,/furniture/);assert.equal(describeSpectatorSelection(data,{type:'unrecognized',id:'x'}),null);assert.equal(describeSpectatorSelection(data,{type:'player',id:'missing'}),null);
});

test('ability-effect inspector uses the authoritative kind field',()=>{
 const data=game();data.effects=[{id:'fx-1',kind:'ward',targetId:'p1',expiresAt:1010.5}];const description=describeSpectatorSelection(data,{type:'effect',id:'fx-1'});assert.equal(description.title,'Harbor Ward');assert.match(JSON.stringify(description),/1010.5/);assert.equal(describeSpectatorSelection(data,{type:'effect',id:'missing'}),null);
});

test('selected strategic plan is labeled as last recorded controller state, and absence stays explicit',()=>{
 const data=game();assert.match(JSON.stringify(describeSpectatorSelection(data,{type:'player',id:'p1'})),/No selected plan recorded/);
 data.inspection.agents[0].plan={goal:'doTask',label:'Work on a recorded task',source:'recorded-controller-state',recordedAt:10.5,expiresAt:20.75,status:'last-selected',notice:'Last selected plan; may no longer be current. This is not private thoughts.'};
 const description=JSON.stringify(describeSpectatorSelection(data,{type:'player',id:'p1'}));assert.match(description,/Selected plan \(recorded controller state\)/);assert.match(description,/10.5/);assert.match(description,/20.75/);assert.match(description,/may no longer be current/);assert.match(description,/not private thoughts/);
});

test('spectator inspection uses each selected map’s real room, station and bell geometry',()=>{
 for(const map of MAPS){
  const geometry=getWorld(map.id),data=game();data.mapId=map.id;data.rooms=geometry.ROOM_LAYOUT;const room=geometry.WORLD_ROOMS.at(-1),name=geometry.ROOM_LAYOUT.find(entry=>entry.id===room.id).name;
  data.players[0].roomId=room.id;data.inspection.agents[0].roomId=room.id;data.inspection.agents[0].tasks[0].roomId=room.id;
  assert.equal(describeSpectatorSelection(data,{type:'room',id:room.id}).title,name);const station=describeSpectatorSelection(data,{type:'station',id:geometry.WORLD_STATIONS[room.id].id});assert.equal(station.title,`${name} station`);assert.deepEqual(station.facts.find(([key])=>key==='Position'),['Position',`${geometry.WORLD_STATIONS[room.id].x}, ${geometry.WORLD_STATIONS[room.id].y}`]);
  if(geometry.WORLD_DECOR?.length){const detail=geometry.WORLD_DECOR[0];assert.ok(describeSpectatorSelection(data,{type:'decor',id:detail.id||'decor-0'}));}
  const bell=describeSpectatorSelection(data,{type:'bell',id:'bell'}),bellRoom=geometry.ROOM_LAYOUT.find(entry=>entry.id===geometry.worldRoomAt(geometry.WORLD_BELL));assert.deepEqual(bell.facts.find(([key])=>key==='Location'),['Location',bellRoom.name]);assert.match(JSON.stringify(describeSpectatorSelection(data,{type:'player',id:'p1'})),new RegExp(name));
 }
});
