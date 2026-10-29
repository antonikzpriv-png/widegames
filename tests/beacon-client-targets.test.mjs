import test from 'node:test';
import assert from 'node:assert/strict';
import {contexts,validTaskSession} from '../public/world/model.mjs';
import {actionDescriptors,descriptors,hasActionDescriptor,fieldNotes,fieldNoteText,hatchTraces,hatchTraceText} from '../public/world/beacon-model.mjs';
import * as world from '../shared/world.mjs';

// Safe-view counterexamples. Distances/type hints cannot authorize schema3 targets.
const hint=(type,fields,extra={})=>({id:type+':'+Object.values(fields).join(':'),type,fields,label:type,enabled:true,...extra});
function room(count=3){const position={...world.WORLD_STATIONS.bridge};return {roomId:'target-fixture',game:{beaconVersion:1,worldVersion:1,matchId:'target-match',phase:'roam',self:{id:'keeper-custom-81',alive:true,role:'saboteur',roomId:'bridge',position,tasks:[]},players:Array.from({length:count},(_,i)=>({id:'candidate-'+i,name:'Candidate '+i,status:'alive',alive:true,position:{x:position.x+i+1,y:position.y}})),events:[{type:'body',bodyId:'old-near-body',position:{x:position.x+1,y:position.y}},{type:'body',bodyId:'permitted-body',position:{x:position.x+40,y:position.y}}],availableActions:['report','eliminate','meeting','task'],interactions:[],systems:{selfTransit:null}}};}

test('schema3 reports the exact enabled body, bypassing a nearer historic/blocked body',()=>{
 const g=room().game;g.interactions=[hint('report',{bodyId:'old-near-body'},{enabled:false}),hint('report',{bodyId:'permitted-body'})];assert.deepEqual(contexts(g,world).report.fields,{bodyId:'permitted-body'});assert.equal(contexts(g,world).report.enabled,true);g.interactions=[];assert.equal(contexts(g,world).report.enabled,false);
});
for(const count of [3,8,11])test(`schema3 elimination uses the permitted custom target among ${count} candidates`,()=>{
 const g=room(count).game,targetId=g.players.at(-1).id;g.interactions=[hint('eliminate',{targetId:'candidate-0'},{enabled:false}),hint('eliminate',{targetId})];assert.deepEqual(contexts(g,world).eliminate.fields,{targetId});g.interactions=[];assert.equal(contexts(g,world).eliminate.enabled,false);
});
test('schema3 selects the exact permitted task instead of the first unfinished local task',()=>{
 const r=room(),g=r.game;g.self.role='crew';g.self.tasks=[{id:'blocked-first',roomId:'bridge',label:'Blocked relay',completed:false},{id:'allowed-second',roomId:'bridge',label:'Allowed relay',completed:false}];g.interactions=[hint('task',{taskId:'allowed-second'})];assert.equal(contexts(g,world).use.type,'task');assert.equal(contexts(g,world).use.task.id,'allowed-second');const session={roomId:r.roomId,matchId:g.matchId,taskId:'blocked-first',location:'bridge'};assert.equal(!!validTaskSession(session,r,world),false);session.taskId='allowed-second';assert.equal(validTaskSession(session,r,world),true);g.interactions=[];assert.equal(!!validTaskSession(session,r,world),false);
});
test('schema3 bell needs its own exact enabled descriptor, even beside the bell with a type hint',()=>{
 const g=room().game;g.self.position={...world.WORLD_BELL};g.availableActions=['meeting'];assert.notEqual(contexts(g,world).use.type,'meeting');g.interactions=[hint('meeting',{})];assert.equal(contexts(g,world).use.type,'meeting');assert.equal(contexts(g,world).use.enabled,true);
});
test('schema2 keeps its original proximity/type-hint behavior without new descriptors',()=>{
 const g=room().game;delete g.beaconVersion;assert.equal(contexts(g,world).report.fields.bodyId,'old-near-body');assert.equal(contexts(g,world).eliminate.fields.targetId,'candidate-0');g.self.position={...world.WORLD_BELL};g.availableActions=['meeting'];assert.equal(contexts(g,world).use.type,'meeting');
});

test('malformed/disabled base descriptors cannot authorize an action or pass through puzzle-free panel controls',()=>{
 const g=room().game;g.interactions=[hint('report',{bodyId:'permitted-body',extra:'ignored'}),hint('eliminate',{targetId:'candidate-0'},{enabled:false}),hint('meeting',{extra:'no'}),hint('constructor',{}),hint('toString',{})];assert.equal(contexts(g,world).report.enabled,false);assert.equal(contexts(g,world).eliminate.enabled,false);assert.notEqual(contexts(g,world).use.type,'meeting');g.interactions=[hint('task',{taskId:'own-task'}),hint('report',{bodyId:'permitted-body'}),hint('meeting',{})];assert.equal(actionDescriptors(g).length,3);assert.equal(descriptors(g).length,0,'task actions must not bypass the actual puzzle');
});
test('an exact task descriptor remains usable from the authorized side of a room threshold',()=>{
 const r=room(),g=r.game;g.self.roomId=null;g.self.tasks=[{id:'threshold-task',label:'Service relay',roomId:'workshop',completed:false}];g.interactions=[hint('task',{taskId:'threshold-task'})];assert.equal(contexts(g,world).use.task.id,'threshold-task');assert.equal(validTaskSession({roomId:r.roomId,matchId:g.matchId,taskId:'threshold-task',location:null},r,world),true);
});
test('existing field-note accepts only the exact own custom target, never another actor or future ability',()=>{
 const g=room(11).game;g.interactions=[hint('ability',{abilityId:'field-note',targetId:g.self.id}),hint('ability',{abilityId:'field-note',targetId:'candidate-0'}),hint('ability',{abilityId:'future-ability',targetId:g.self.id})];assert.equal(descriptors(g).length,1);assert.deepEqual(descriptors(g)[0].fields,{abilityId:'field-note',targetId:'keeper-custom-81'});g.self=null;assert.equal(descriptors(g).length,0);
});
test('field notes display only safe own samples with their recorded timestamp and position',()=>{
 const g=room().game;g.abilities={notes:[{id:'note-custom',at:1000,roomId:'archive',position:{x:150.25,y:450},privateReason:'DO NOT RENDER'}]};const notes=fieldNotes(g);assert.equal(notes.length,1);assert.deepEqual(notes[0].position,{x:150.25,y:450});const text=fieldNoteText(notes[0]);assert.match(text,/1970-01-01T00:00:01.000Z.*archive.*150.3.*450.0/);assert.doesNotMatch(text,/DO NOT RENDER|privateReason/);g.self=null;assert.deepEqual(fieldNotes(g),[]);
});
test('permitted hatch history attributes one observed endpoint without invented other end, role or recipients',()=>{
 const g=room().game;g.events=[{id:'trace-entry',type:'vent_enter',at:1000,playerId:'candidate-2',roomId:'archive',position:{x:150,y:550},entryId:'archive-hatch',exitId:'SECRET OTHER END',visibleTo:['SECRET RECIPIENT'],role:'SECRET ROLE'},{id:'trace-exit',type:'vent_exit',at:2000,playerId:'candidate-1',roomId:'lantern',position:{x:1450,y:550},exitId:'lantern-hatch',entryId:'SECRET ENTRY'},{type:'unrelated',at:3000,position:{x:1,y:1}}];const traces=hatchTraces(g);assert.equal(traces.length,2);assert.equal(Object.hasOwn(traces[0],'exitId'),false);assert.equal(Object.hasOwn(traces[1],'entryId'),false);assert.equal(Object.hasOwn(traces[0],'visibleTo'),false);const text=traces.map(e=>hatchTraceText(e,g.players)).join(' ');assert.match(text,/Candidate 2 entered archive-hatch/);assert.match(text,/Candidate 1 exited lantern-hatch/);assert.match(text,/Historical local observation/);assert.doesNotMatch(text,/SECRET|saboteur|\{|->/);assert.equal(g.players[2].status,'alive','history renderer must not mutate roster knowledge');
});
