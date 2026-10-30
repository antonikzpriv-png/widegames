import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.TACTICAL_COORDINATOR_REVIEW_ROOT?pathToFileURL(resolve(process.env.TACTICAL_COORDINATOR_REVIEW_ROOT)+'/'):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const {getMap}=await import(new URL('shared/maps/index.mjs',root));
const {observe,candidates}=await import(new URL('server/ai/demo.mjs',root));
const {makeRequest}=await import(new URL('server/ai/anthropic.mjs',root));
const {deviceFacts}=await import(new URL('server/features/strategy/index.mjs',root));
const clone=value=>structuredClone(value);
function fixture(){
 const map=getMap('stormbreak-annex');let state=engine.createMatch({id:'coordinator-annex-review',tactical:true,map:{id:map.id,version:map.version},mode:'spectator',roster:Array.from({length:8},(_,i)=>({id:'review-keeper-'+i,name:'Review Keeper '+i,color:'#123456',persona:'Offline fixture keeper.'})),seed:'independent-eyewitness',now:1000,config:{initialKillCooldownMs:1,meetingCooldownMs:1,roamDeadlineMs:600000,maxMatchMs:900000},beaconRules:{deviceReadMs:100,deviceCooldownMs:50}});assert.equal(state.schemaVersion,4);let now=1000,seq=0;
 return {map,get state(){return state;},get now(){return now;},get crew(){return state.players.filter(p=>p.role==='crew').map(p=>p.id);},get sab(){return state.players.find(p=>p.role==='saboteur').id;},view(id){return engine.getPlayerView(state,id,now);},
  tick(at){now=at;state=engine.tick(state,now).state;},act(id,type,fields={}){const result=engine.applyAction(state,id,{id:'coordinator-review:'+ ++seq,type,...fields},now);assert.equal(result.accepted,true,JSON.stringify({type,fields,error:result.error}));state=result.state;},
  walk(id,target){this.act(id,'navigate',{x:target.x,y:target.y});const actor=state.players.find(p=>p.id===id);let length=0,last=actor.position;for(const p of actor.motion.path){length+=map.geometry.distance(last,p);last=p;}this.tick(now+Math.ceil(length/map.geometry.WORLD.speed*1000)+10);assert(map.geometry.distance(state.players.find(p=>p.id===id).position,target)<.01);}
 };
}
function actualWitness(){
 const f=fixture();f.tick(1001);const victim=f.crew[0],nearWitness=f.crew[1],point=clone(f.state.players.find(p=>p.id===victim).position);f.walk(nearWitness,point);f.walk(f.sab,point);f.act(f.sab,'eliminate',{targetId:victim});
 const witness=f.crew.find(id=>{const v=f.view(id);return v.events.some(e=>e.type==='witness'&&e.playerId===f.sab&&e.targetId===victim)&&v.interactions.some(h=>h.enabled&&h.type==='report'&&h.fields.bodyId==='body-'+victim);});assert(witness,'Real witness must also be physically able to report');const before=f.view(witness).events.find(e=>e.type==='witness'&&e.playerId===f.sab);assert.equal(before.roomId,'muster');f.act(witness,'report',{bodyId:'body-'+victim});assert.equal(f.state.phase,'discussion');return {f,witness,victim,view:f.view(witness),before};
}
function request(view,memory){const choices=candidates(view,memory);assert.equal(choices[0]?.type,'say');return {choices,safe:JSON.parse(JSON.parse(makeRequest(view,{id:view.self.id,name:'Independent fixture witness',persona:'State only observed facts.'},memory,choices).body).messages[0].content)};}

test('actual Annex eyewitness survives observe and names Muster Hall after legal movement/eliminate/report',t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('No provider/network calls allowed');});const {f,witness,victim,view,before}=actualWitness(),memory={};observe(view,memory);
 assert.deepEqual(memory.witnesses?.[f.sab],{targetId:victim,roomId:'muster',at:before.at},'Actual engine witness must survive the Annex room gate');const {choices,safe}=request(view,memory);assert.match(choices[0].text,/in Muster Hall/);assert.match(choices[0].text,/That is firsthand/);assert(!choices[0].text.includes('undefined'));assert.equal(safe.firsthandWitnesses[f.sab].targetId,victim);assert.equal(safe.firsthandWitnesses[f.sab].at,before.at);assert.equal(safe.self.id,witness);
});

test('actual eight-room occupancy survives deviceFacts/provider projection with map while private fields are stripped',t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('No provider/network calls allowed');});const f=fixture(),reader=f.crew[0],device=f.map.fixtures.devices.find(d=>d.kind==='occupancy');f.walk(reader,device.position);f.act(reader,'investigate',{deviceId:device.id});const at=f.now+100;f.tick(at);const raw=f.view(reader),sample=raw.investigation.observations[0];assert.equal(sample.at,at);assert.equal(sample.data.rooms.length,8);const adversarial=clone(raw);adversarial.investigation.observations[0].privateMemory='PRIVATE_SENTINEL';adversarial.investigation.observations[0].data.rooms.forEach(r=>r.hiddenIds=['PRIVATE_SENTINEL']);const facts=deviceFacts(adversarial);assert.equal(facts[0].rooms.length,8);assert.deepEqual(facts[0].rooms,sample.data.rooms);assert.deepEqual(facts[0].map,{id:'stormbreak-annex',version:1});assert.deepEqual(Object.keys(facts[0]).sort(),['at','id','kind','map','rooms','source']);assert(!JSON.stringify(facts).includes('PRIVATE_SENTINEL'));assert.deepEqual(deviceFacts(f.view(null)),[]);assert.deepEqual(deviceFacts(f.view(f.crew[1])),[]);
 f.walk(reader,f.map.geometry.WORLD_BELL);f.act(reader,'meeting');const view=f.view(reader),memory={};observe(view,memory);const {safe}=request(view,memory);assert.equal(safe.deviceObservations[0].rooms.length,8);assert.equal(safe.deviceObservations[0].at,at);assert.deepEqual(safe.deviceObservations[0].map,view.map);assert.deepEqual(safe.firsthandWitnesses,{});
});

test('provider context uses public Annex map and room names only, never copied geometry/roles/knowledge/recipients',t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('No provider/network calls allowed');});const {view}=actualWitness(),memory={};observe(view,memory);const v=clone(view);v.map.privateRoute='PRIVATE_SENTINEL';v.rooms.forEach(r=>{r.privateRoute='PRIVATE_SENTINEL';r.geometry={hidden:'PRIVATE_SENTINEL'};});v.players.forEach(p=>{p.role='PRIVATE_SENTINEL';p.knowledge={hidden:'PRIVATE_SENTINEL'};});v.self.knowledge='PRIVATE_SENTINEL';v.configuration='PRIVATE_SENTINEL';v.replay='PRIVATE_SENTINEL';v.aiContext='PRIVATE_SENTINEL';const {safe}=request(v,memory);
 assert.deepEqual(safe.map,{id:'stormbreak-annex',version:1});assert.equal(safe.rooms.length,8);assert.deepEqual(safe.rooms,view.rooms.map(({id,name})=>({id,name})));assert(safe.rooms.some(r=>r.name==='Muster Hall'));assert(safe.players.every(p=>Object.keys(p).sort().join(',')==='alive,id,roomId,status'));assert(!JSON.stringify(safe).includes('PRIVATE_SENTINEL'));for(const key of ['configuration','replay','aiContext','knowledge','visibleTo','geometry'])assert.equal(Object.hasOwn(safe,key),false);assert.equal(safe.self.role,'crew');
});
