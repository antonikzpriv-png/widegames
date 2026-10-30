import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Normal integrated tests use current checkout source. Historical source is opt-in.
const root=process.env.BEACON_WORLD_INTEGRATION_REVIEW_ROOT?pathToFileURL(resolve(process.env.BEACON_WORLD_INTEGRATION_REVIEW_ROOT)+'/'):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const geo=await import(new URL('shared/world.mjs',root));
const {BEACON_DEVICES}=await import(new URL('shared/beacon.mjs',root));
const {validateInvestigationState}=await import(new URL('server/engine/investigation/index.mjs',root));
const json=value=>JSON.parse(JSON.stringify(value));
const device=id=>BEACON_DEVICES.find(d=>d.id===id).position;
const duration=(from,to)=>{const route=geo.findWorldPath(from,to);assert.ok(route);let length=0,last=from;for(const p of route){length+=geo.distance(last,p);last=p;}return Math.ceil(length/geo.WORLD.speed*1000)+1;};
function game({config={},beaconRules={}}={}){
 let state;
 for(let seed=0;seed<100;seed++){state=engine.createMatch({id:'independent-device-review',world:true,systems:true,seed,now:0,config:{initialKillCooldownMs:1,killCooldownMs:1,meetingCooldownMs:1,sabotageCooldownMs:1,roamDeadlineMs:600000,maxMatchMs:900000,...config},beaconRules:{deviceReadMs:1000,deviceCooldownMs:1,auxiliaryCooldownMs:1,lightsDurationMs:1001,doorDurationMs:1001,communicationsDurationMs:1000,...beaconRules}});assert.equal(state.schemaVersion,3,'Review requires real integrated schema3 orchestration');if(state.players.find(p=>p.role==='saboteur').id==='p6')break;}
 assert.equal(state.players.find(p=>p.role==='saboteur').id,'p6');let now=0,serial=0;
 return {get state(){return state;},set state(s){state=s;},get now(){return now;},p(id){return state.players.find(p=>p.id===id);},
  view(id){return engine.getPlayerView(state,id,now);},
  tick(at){assert.ok(at>=now);const before=json(state),original=state;now=at;state=engine.tick(state,at).state;assert.deepEqual(original,before,'tick mutated input');return state;},
  submit(actor,action,expected=true,at=now){const before=json(state),original=state;now=at;const result=engine.applyAction(state,actor,action,at);assert.deepEqual(original,before,'action mutated input');assert.equal(result.accepted,expected,JSON.stringify({actor,action,at,error:result.error}));state=result.state;return result;},
  act(actor,type,fields={},expected=true,at=now){return this.submit(actor,{id:'independent:'+ ++serial,type,...fields},expected,at);},
  input(actor,request,at=now){now=at;const r=engine.applyInput(state,actor,request,at);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;return r;},
  travel(actor,target){this.act(actor,'navigate',{x:target.x,y:target.y});let length=0,last=this.p(actor).position;for(const p of this.p(actor).motion.path){length+=geo.distance(last,p);last=p;}this.tick(now+Math.ceil(length/geo.WORLD.speed*1000)+1);assert.ok(geo.distance(this.p(actor).position,target)<.01,'actual route must arrive');},
  read(actor,id){this.act(actor,'investigate',{deviceId:id});return state.investigation.sessions[actor].deadlineAt;}
 };
}
const observations=(g,id)=>g.view(id).investigation.observations;
const frame=(g,id,camera)=>observations(g,id).at(-1).data.frames.find(f=>f.cameraId===camera);
function assertPrivacy(g,id){const v=g.view(id);if(v.phase!=='ended')assert.ok(v.players.every(p=>!('role'in p)));for(const p of v.players)for(const key of ['motion','knowledge','destination','tasks'])assert.equal(Object.hasOwn(p,key),false,key);assert.equal(Object.hasOwn(v,'replay'),false);assert.equal(v.events.some(e=>['device_session','device_observation'].includes(e.type)),false);return v;}

test('explicit immutable review pin verifies all30 raw Git blobs, while default stays current',async()=>{
 if(!process.env.BEACON_WORLD_INTEGRATION_REVIEW_PIN)return;
 assert.equal(process.env.BEACON_WORLD_INTEGRATION_REVIEW_PIN,'6daa2d50e4423c691475ae388c932b92df6c277a');
 const manifest=JSON.parse(await readFile(new URL('../integration-review-6daa2d5-manifest.json',root),'utf8'));assert.equal(manifest.pin,process.env.BEACON_WORLD_INTEGRATION_REVIEW_PIN);assert.equal(manifest.files.length,30);
 for(const entry of manifest.files)assert.equal(createHash('sha256').update(await readFile(new URL(entry.file,root))).digest('hex'),entry.sha256,entry.file);
});

test('real console access rejects remote/forged/moving proposals, dedup and restart preserve original read deadline',()=>{
 const g=game();assert.equal(g.act('p1','investigate',{deviceId:'security'},false).error.code,'UNAVAILABLE');
 assert.equal(g.act('p1','investigate',{deviceId:'security',position:device('security')},false).error.code,'INVALID_ACTION');
 g.act('p1','navigate',device('security'));assert.equal(g.act('p1','investigate',{deviceId:'security'},false).error.code,'UNAVAILABLE');g.tick(duration(geo.worldSpawn('p1'),device('security')));
 const action={id:'read:stable',type:'investigate',deviceId:'security'};g.submit('p1',action);const deadline=g.state.investigation.sessions.p1.deadlineAt;g.tick(g.now+100);g.state=json(g.state);const duplicate=g.submit('p1',action);assert.equal(duplicate.duplicate,true);assert.equal(g.state.investigation.sessions.p1.deadlineAt,deadline);
 assert.equal(g.view('p2').investigation.session,null);assert.deepEqual(observations(g,'p2'),[]);assert.deepEqual(observations(g,null),[]);g.tick(deadline);assert.equal(g.view('p1').investigation.session.status,'elapsed');assert.equal(observations(g,'p1').at(-1).at,deadline);assert.equal(validateInvestigationState(g.state),true);assertPrivacy(g,'p1');assertPrivacy(g,'p2');
});

test('zero cleanup preserves stationary read; actual steering cancels, cooldown and fresh retry remain authoritative',()=>{
 const g=game();g.travel('p1',device('security'));const first=g.read('p1','security'),start=g.now;g.input('p1',{seq:1,dx:0,dy:0},start+10);assert.equal(g.view('p1').investigation.session.status,'reading');
 g.input('p1',{seq:2,dx:-1,dy:0},start+20);assert.equal(g.view('p1').investigation.session.status,'failed');assert.equal(g.view('p1').investigation.session.reason,'movement');g.input('p1',{seq:3,dx:0,dy:0},start+21);g.tick(first);assert.deepEqual(observations(g,'p1'),[]);
 const second=g.read('p1','security');g.tick(second);assert.equal(observations(g,'p1').length,1);assert.equal(observations(g,'p1')[0].at,second);
});

test('late real tick samples moving target at device deadline, preserves immutable sample and JSON restart equivalence',()=>{
 const g=game();g.travel('p1',device('security'));g.travel('p2',{x:150,y:510});const deadline=g.read('p1','security');g.act('p2','navigate',{x:420,y:510});const saved=json(g.state);g.tick(deadline+1500);
 const sampled=frame(g,'p1','archive-camera').players.find(p=>p.id==='p2');assert.ok(sampled);assert.ok(Math.abs(sampled.position.x-330)<1e-6);assert.ok(Math.abs(g.p('p2').position.x-420)<1e-6);assert.equal(observations(g,'p1').at(-1).at,deadline);
 assert.deepEqual(engine.tick(saved,deadline+1500).state,g.state);const before=json(g.state);sampled.position.x=-999;assert.deepEqual(g.state,before);assert.equal(validateInvestigationState(g.state),true);
});

test('communications cancels an active read immediately and expiry restores actual access without a late sample',()=>{
 const g=game();g.travel('p1',device('security'));const deadline=g.read('p1','security');g.act('p6','systemSabotage',{kind:'communications',targetId:'beacon'},true,g.now+1);assert.equal(g.view('p1').investigation.session.reason,'communications');assert.equal(g.act('p1','investigate',{deviceId:'security'},false).error.code,'COMMUNICATIONS_DOWN');
 const expires=g.state.systems.communications.deadlineAt;g.tick(expires);assert.deepEqual(observations(g,'p1'),[]);assert.equal(g.state.systems.communications.active,false);assert.ok(g.view('p1').interactions.some(d=>d.type==='investigate'&&d.fields.deviceId==='security'&&d.enabled));const fresh=g.read('p1','security');assert.ok(fresh>deadline);g.tick(fresh);assert.equal(observations(g,'p1').length,1);
});

for(const kind of ['lights','door'])for(const durationMs of [1001,1000])test('camera '+kind+' masking and system/read exact tie at duration'+durationMs,()=>{
 const g=game({beaconRules:{[kind==='lights'?'lightsDurationMs':'doorDurationMs']:durationMs}});g.travel('p1',device('security'));g.travel('p2',kind==='lights'?{x:420,y:510}:{x:560,y:490});g.act('p6','systemSabotage',{kind,targetId:kind==='door'?'west-upper':'beacon'});const deadline=g.read('p1','security');g.tick(deadline);
 const present=frame(g,'p1','archive-camera').players.some(p=>p.id==='p2');assert.equal(present,durationMs===1000,'Mask holds before expiry; exact expiry is processed before sampling');assert.equal(observations(g,'p1').at(-1).at,deadline);for(const p of frame(g,'p1','archive-camera').players)assert.deepEqual(Object.keys(p).sort(),['id','position']);assertPrivacy(g,'p1');assert.deepEqual(observations(g,'p2'),[]);
});

test('real camera samples honor prop occlusion and cannot promote remote footage into eyewitness/death knowledge',()=>{
 const props=game();props.travel('p1',device('security'));props.travel('p2',{x:1180,y:1060});const done=props.read('p1','security');props.tick(done);assert.equal(frame(props,'p1','engine-camera').players.some(p=>p.id==='p2'),false,'Turbine masks a close target');
 const g=game();g.travel('p1',device('security'));g.travel('p2',{x:300,y:510});g.travel('p6',{x:330,y:510});const deadline=g.read('p1','security');g.tick(deadline);assert.ok(frame(g,'p1','archive-camera').players.some(p=>p.id==='p2'));assert.ok(frame(g,'p1','archive-camera').players.some(p=>p.id==='p6'));
 g.act('p6','eliminate',{targetId:'p2'});const view=assertPrivacy(g,'p1');assert.equal(view.players.find(p=>p.id==='p2').status,'alive');assert.equal(view.players.find(p=>p.id==='p2').position,null);assert.equal(view.events.some(e=>e.type==='witness'||e.type==='body'),false);assert.deepEqual(g.p('p1').knowledge.events.filter(e=>e.type==='witness'),[]);assert.equal(engine.getReplay(g.state),null);
});

test('actual owner vitals read discloses remote death only to owner, never remote coordinates or other sessions',()=>{
 const g=game();g.travel('p1',device('vitals'));g.travel('p2',{x:1450,y:960});g.travel('p6',{x:1430,y:960});g.act('p6','eliminate',{targetId:'p2'});assert.equal(g.view('p1').players.find(p=>p.id==='p2').status,'alive');assert.equal(g.view('p3').players.find(p=>p.id==='p2').status,'alive');
 const deadline=g.read('p1','vitals');g.tick(deadline);const owner=assertPrivacy(g,'p1'),other=assertPrivacy(g,'p3'),publicView=assertPrivacy(g,null);assert.equal(owner.players.find(p=>p.id==='p2').status,'dead');assert.equal(owner.players.find(p=>p.id==='p2').position,null);assert.equal(other.players.find(p=>p.id==='p2').status,'alive');assert.equal(publicView.players.find(p=>p.id==='p2').status,'alive');
 const sample=observations(g,'p1')[0];assert.equal(sample.at,deadline);assert.ok(sample.data.players.every(p=>Object.keys(p).sort().join(',')==='id,status'));assert.deepEqual(observations(g,'p3'),[]);assert.deepEqual(observations(g,null),[]);assert.equal(other.investigation.session,null);assert.equal(publicView.investigation.session,null);assert.ok(g.state.replay.filter(e=>e.type==='device_observation').every(e=>JSON.stringify(e.visibleTo)==='["p1"]'));
 const before=json(g.state);sample.data.players[0].status='tamper';assert.deepEqual(g.state,before);assert.equal(validateInvestigationState(g.state),true);
});

test('vent arrival on read deadline is sampled only after validated exit; frame contains no private route metadata',()=>{
 const g=game({beaconRules:{ventTravelMs:1000}});g.travel('p1',device('security'));g.travel('p6',{x:1450,y:550});const deadline=g.read('p1','security');g.act('p6','vent',{entryId:'lantern-hatch',exitId:'archive-hatch'});g.tick(deadline);
 const observed=frame(g,'p1','archive-camera').players.find(p=>p.id==='p6');assert.deepEqual(observed,{id:'p6',position:{x:150,y:550}});assert.equal(g.state.systems.transit.p6,undefined);assert.equal(g.view('p1').players.find(p=>p.id==='p6').position,null);assert.equal(g.view('p1').events.some(e=>e.type==='witness'||e.type==='vent_enter'||e.type==='vent_exit'),false);assert.equal(validateInvestigationState(g.state),true);
});

for(const tie of ['roam','maximum','critical'])test('real '+tie+' deadline precedes tied device read without invented sample',()=>{
 const arrive=duration(geo.worldSpawn('p1'),device('security')),deadline=10000,readMs=deadline-arrive;assert.ok(readMs>0);
 const g=game({config:{...(tie==='roam'?{roamDeadlineMs:deadline}:{}),...(tie==='maximum'?{maxMatchMs:deadline}:{}),...(tie==='critical'?{criticalDurationMs:readMs}:{})},beaconRules:{deviceReadMs:readMs}});g.travel('p1',device('security'));assert.equal(g.now,arrive);if(tie==='critical')g.act('p6','systemSabotage',{kind:'power',targetId:'beacon'});assert.equal(g.read('p1','security'),deadline);g.tick(deadline);
 assert.equal(g.state.investigation.sessions.p1.status,'failed');assert.equal(g.state.investigation.sessions.p1.reason,'phase');assert.deepEqual(observations(g,'p1'),[]);assert.equal(validateInvestigationState(g.state),true);
 if(tie==='roam')assert.equal(g.state.phase,'discussion');if(tie==='maximum'){assert.equal(g.state.phase,'paused');assert.equal(g.state.outcome,null);assert.equal(engine.getReplay(g.state),null);}if(tie==='critical'){assert.equal(g.state.phase,'ended');assert.equal(g.state.outcome.reason,'critical');assert.equal(g.state.outcome.at,deadline);assert.equal(engine.getReplay(g.state).some(e=>e.type==='device_observation'),false);}
});


test('occupancy is an owner-only bounded count sample, never identity or remote death knowledge',()=>{
 const g=game();g.travel('p1',device('occupancy'));g.travel('p2',{x:1450,y:960});g.travel('p6',{x:1430,y:960});g.act('p6','eliminate',{targetId:'p2'});const deadline=g.read('p1','occupancy');g.tick(deadline);
 const sample=observations(g,'p1')[0];assert.equal(sample.kind,'occupancy');assert.equal(sample.at,deadline);assert.equal(sample.data.rooms.length,6);assert.ok(sample.data.rooms.every(row=>Object.keys(row).sort().join(',')==='count,roomId'));assert.equal(sample.data.rooms.reduce((n,row)=>n+row.count,0),5);assert.equal(g.view('p1').players.find(p=>p.id==='p2').status,'alive');assert.equal(g.view('p1').events.some(e=>e.type==='witness'||e.type==='body'),false);assert.deepEqual(observations(g,'p3'),[]);assert.deepEqual(observations(g,null),[]);
});

test('actual death and validated vent transit cancel active reads and prohibit new device requests',()=>{
 const dead=game();dead.travel('p1',device('security'));const deadline=dead.read('p1','security');dead.act('p6','eliminate',{targetId:'p1'});assert.equal(dead.state.investigation.sessions.p1.reason,'dead');assert.equal(dead.act('p1','investigate',{deviceId:'security'},false).error.code,'PLAYER_DEAD');dead.tick(deadline);assert.deepEqual(observations(dead,'p1'),[]);
 const transit=game();transit.travel('p6',{x:150,y:530});transit.read('p6','occupancy');transit.act('p6','vent',{entryId:'archive-hatch',exitId:'lantern-hatch'});assert.equal(transit.state.investigation.sessions.p6.reason,'transit');assert.equal(transit.act('p6','investigate',{deviceId:'occupancy'},false).error.code,'IN_TRANSIT');assert.deepEqual(observations(transit,'p6'),[]);assert.equal(transit.view('p1').investigation.session,null);assert.equal(validateInvestigationState(transit.state),true);
});
