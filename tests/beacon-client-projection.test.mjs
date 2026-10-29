import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as geometry from '../shared/world.mjs';
import {DEFAULT_BEACON_RULES,BEACON_DEVICES,BEACON_REPAIRS} from '../shared/beacon.mjs';
import {descriptors,observationText,sessionText,criticalSites,interactionLabel} from '../public/world/beacon-model.mjs';

// Real owner-module actions/projections, explicitly positioned unit actors and
// legacy geometry-backed context. Not HTTP/full-engine/Chrome qualification.
const local=new URL('../',import.meta.url);
const root=key=>process.env[key]?pathToFileURL(resolve(process.env[key])+'/'):local;
const investigationRoot=root('BEACON_CLIENT_INVESTIGATION_ROOT'),systemsRoot=root('BEACON_CLIENT_SYSTEMS_ROOT');
const ready=(base,file)=>existsSync(new URL(file,base));
const investigationReady=ready(investigationRoot,'server/engine/investigation/data.mjs'),systemsReady=ready(systemsRoot,'server/engine/systems/model.mjs');
const invFiles=['server/engine/investigation/index.mjs','server/engine/investigation/data.mjs','shared/beacon.mjs','shared/contracts.mjs'];
const sysFiles=['server/engine/systems/index.mjs','server/engine/systems/model.mjs','shared/beacon.mjs','shared/contracts.mjs','shared/world.mjs'];
const capture=(base,files)=>Object.fromEntries(files.map(file=>[file,readFileSync(new URL(file,base))]));
const hashes=files=>Object.fromEntries(Object.entries(files).map(([file,data])=>[file,createHash('sha256').update(data).digest('hex')]));
const fingerprints=(base,files)=>hashes(capture(base,files));
const invSources=investigationReady?capture(investigationRoot,invFiles):null,sysSources=systemsReady?capture(systemsRoot,sysFiles):null;
const invBefore=invSources?hashes(invSources):null,sysBefore=sysSources?hashes(sysSources):null;
const investigation=investigationReady?await import(new URL('server/engine/investigation/index.mjs',investigationRoot)):null;
const systems=systemsReady?await import(new URL('server/engine/systems/index.mjs',systemsRoot)):null;
function state(){return {schemaVersion:3,beaconVersion:1,worldVersion:1,phase:'roam',updatedAt:1000,sabotage:null,beaconRules:{...DEFAULT_BEACON_RULES,deviceReadMs:20,deviceCooldownMs:5},players:[
 {id:'keeper-77',name:'Mira',role:'crew',alive:true,roomId:'bridge',position:{x:930,y:310},cooldowns:{sabotageAt:0},motion:{path:[],destination:null,manual:false,leaseUntil:0}},
 {id:'keeper-88',name:'Sable',role:'saboteur',alive:true,roomId:'archive',position:{x:260,y:510},cooldowns:{sabotageAt:0},motion:{path:[],destination:null,manual:false,leaseUntil:0}},
 {id:'keeper-99',name:'Finch',role:'crew',alive:false,roomId:'engine',position:{x:1340,y:960},cooldowns:{sabotageAt:0},motion:{path:[],destination:null,manual:false,leaseUntil:0}}
 ]};}
const ctx={record(){},publicEvent(){},geometry,sees:(s,p,q)=>geometry.canSeeWorldPoint(p.position,q),nearby:(s,p,q,range=92)=>geometry.distance(p.position,q)<=range,stop(s,p){p.motion={...p.motion,path:[],destination:null,manual:false};}};
for(const device of BEACON_DEVICES)test(`real investigation projection: ${device.kind} is useful historical UI text`,{skip:!investigationReady&&'Foundation stub; integrate owner or set BEACON_CLIENT_INVESTIGATION_ROOT'},()=>{
 const s=state(),actor=s.players[0];actor.roomId=device.roomId;actor.position={...device.position};s.systems={lights:{active:false},communications:{active:false},transit:{}};investigation.initializeInvestigation(s,1000);
 assert.equal(investigation.validateInvestigationAction(s,actor,{type:'investigate',deviceId:device.id},1000,ctx),null);assert.equal(investigation.applyInvestigationAction(s,actor,{type:'investigate',deviceId:device.id},1000,ctx),true);
 let view=investigation.getInvestigationView(s,actor.id,1000,ctx);assert.equal(view.session.status,'reading');assert.match(sessionText(view,1000),/Reading/);assert(descriptors({beaconVersion:1,interactions:investigation.investigationActionHints(s,actor,1000,ctx)}).some(h=>h.type==='deviceCancel'));
 s.updatedAt=1020;assert.equal(investigation.advanceInvestigation(s,1020,ctx),true);view=investigation.getInvestigationView(s,actor.id,1020,ctx);assert.equal(view.session.status,'elapsed');assert.match(sessionText(view,1020),/Read complete/);assert.doesNotMatch(sessionText(view,1020),/Reading/);assert.equal(view.observations.length,1);
 const text=observationText(view.observations[0],s.players);assert.match(text,/Sample at.*Historical/i);assert.doesNotMatch(text,/details unavailable|\{|role|saboteur/);if(device.kind==='vitals'){assert.match(text,/Finch: dead/);assert.doesNotMatch(text,/engine/);}if(device.kind==='cameras')assert.match(text,/archive: Sable/);if(device.kind==='occupancy')assert.match(text,/archive: 2/);
 assert.deepEqual(investigation.getInvestigationView(s,null,1020,ctx).observations,[]);assert.deepEqual(invBefore,fingerprints(investigationRoot,invFiles),'investigation source changed during projection checks');
});
test('real terminal cancellation/failure is never mislabeled as an active read',{skip:!investigationReady&&'Foundation stub; integrate investigation owner'},()=>{
 const s=state(),actor=s.players[0];s.systems={lights:{active:false},communications:{active:false},transit:{}};investigation.initializeInvestigation(s,1000);investigation.applyInvestigationAction(s,actor,{type:'investigate',deviceId:'security'},1000,ctx);assert.equal(investigation.applyInvestigationAction(s,actor,{type:'deviceCancel'},1001,ctx),true);s.updatedAt=1001;const view=investigation.getInvestigationView(s,actor.id,1001,ctx);assert.equal(view.session.status,'failed');assert.match(sessionText(view,1001),/Read failed.*cancelled by you/);assert.doesNotMatch(sessionText(view,1001),/Reading/);assert.deepEqual(view.observations,[]);assert.deepEqual(invBefore,fingerprints(investigationRoot,invFiles));
});
test('real systems projection retains two critical sites and exact repair proposals',{skip:!systemsReady&&'Foundation stub; integrate owner or set BEACON_CLIENT_SYSTEMS_ROOT'},()=>{
 const s=state(),saboteur=s.players[1],actor=s.players[0];systems.initializeSystems(s,1000);const action={type:'systemSabotage',kind:'flood',targetId:'beacon'};assert.equal(systems.validateSystemAction(s,saboteur,action,1000,ctx),null);assert.equal(systems.applySystemAction(s,saboteur,action,1000,ctx),true);
 actor.position={...BEACON_REPAIRS.flood[0].position};actor.roomId=BEACON_REPAIRS.flood[0].roomId;const hints=systems.systemActionHints(s,actor,1000,ctx),repair=descriptors({beaconVersion:1,interactions:hints}).find(h=>h.type==='systemRepair'&&h.fields.systemId==='flood');assert(repair);assert.equal(systems.applySystemAction(s,actor,{type:repair.type,...repair.fields},1000,ctx),true);
 const view=systems.getSystemsView(s,actor.id),game={beaconVersion:1,systems:view,sabotage:view.critical};const sites=criticalSites(game);assert.equal(sites.length,2);assert.equal(sites[0].completed,true);assert.equal(sites[1].completed,false);assert(!Object.hasOwn(sites[0],'repairedBy'));assert.equal(view.selfTransit,null);
 const doors=systems.systemActionHints(s,saboteur,1000,ctx).filter(h=>h.type==='systemSabotage'&&h.fields.kind==='door');assert(doors.length>1);assert.equal(new Set(doors.map(interactionLabel)).size,doors.length,'door labels must distinguish actual permitted targets');assert.deepEqual(sysBefore,fingerprints(systemsRoot,sysFiles),'systems source changed during projection checks');
});

after(()=>{
 if(investigationReady)assert.deepEqual(invBefore,fingerprints(investigationRoot,invFiles),'investigation changed during run');
 if(systemsReady)assert.deepEqual(sysBefore,fingerprints(systemsRoot,sysFiles),'systems changed during run');
 if(process.env.BEACON_CLIENT_PROJECTION_SNAPSHOT_DIR)for(const [name,files]of [['investigation',invSources],['systems',sysSources]])for(const [file,data]of Object.entries(files||{})){const target=resolve(process.env.BEACON_CLIENT_PROJECTION_SNAPSHOT_DIR,name,file);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,data);}
 if(process.env.BEACON_CLIENT_PROJECTION_RECEIPT)writeFileSync(process.env.BEACON_CLIENT_PROJECTION_RECEIPT,JSON.stringify({investigation:{root:investigationRoot.href,ready:investigationReady,sha256:invBefore},systems:{root:systemsRoot.href,ready:systemsReady,sha256:sysBefore},sourceStable:true,limits:'Actual module projections with explicitly positioned unit actors and geometry-backed context; no HTTP/full-engine/Chrome qualification.'},null,2)+'\n');
});
