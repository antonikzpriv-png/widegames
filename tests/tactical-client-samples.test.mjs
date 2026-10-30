import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {cameraCardsModel} from '../public/world/camera-cards.mjs';

// Real engine/read/tick/owner projection, with an explicitly repositioned stationary
// unit actor. Not HTTP/browser/AI-match qualification; no provider is constructed.
const root=process.env.TACTICAL_CLIENT_RUNTIME_ROOT?pathToFileURL(resolve(process.env.TACTICAL_CLIENT_RUNTIME_ROOT)+'/'):new URL('../',import.meta.url);
function capture(dir){const files={};for(const entry of readdirSync(new URL(dir,root),{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())Object.assign(files,capture(file));else if(file.endsWith('.mjs'))files[file]=readFileSync(new URL(file,root));}return files;}
const sources=Object.assign({},...['server/engine','server/features','shared'].map(capture)),hash=values=>Object.fromEntries(Object.entries(values).map(([f,b])=>[f,createHash('sha256').update(b).digest('hex')]));
const engine=await import(new URL('server/engine/index.mjs',root)),registry=await import(new URL('shared/maps/index.mjs',root));
const ready=/tactical/.test(engine.createMatch.toString());
for(const id of ['beacon','stormbreak-annex'])test(`${id} actual owner camera sample renders map/field/time/provenance without live actor substitution`,{skip:!ready&&!process.env.TACTICAL_CLIENT_RUNTIME_ROOT&&'Foundation schema4 runtime absent; set TACTICAL_CLIENT_RUNTIME_ROOT'},()=>{
 const map=registry.getMap(id),now=100000,actorId='human-custom',roster=Array.from({length:8},(_,i)=>({id:i===7?actorId:'keeper-'+i,name:'Keeper '+i,color:'#aabbcc'}));
 let state=engine.createMatch({id:'camera-fixture-'+id,mode:'human',world:true,systems:true,tactical:true,map:{id:map.id,version:map.version},roster,humanPlayerIds:[actorId],now,seed:'tactical-client-'+id,beaconRules:{deviceReadMs:20}});assert.equal(state.schemaVersion,4,'An explicitly supplied runtime must implement schema4');
 const device=map.fixtures.devices.find(d=>d.kind==='cameras'),actor=state.players.find(p=>p.id===actorId);actor.position={...device.position};actor.roomId=device.roomId;actor.motion={...actor.motion,path:[],destination:null,manual:false,dx:0,dy:0};
 const result=engine.applyAction(state,actorId,{id:'camera-read-1',type:'investigate',deviceId:device.id},now);assert.equal(result.accepted,true,result.error?.message);state=engine.tick(result.state,now+20).state;const view=engine.getPlayerView(state,actorId,now+20),sample=view.investigation.observations.at(-1);assert(sample);assert.deepEqual(sample.map,{id:map.id,version:map.version});assert.deepEqual(sample.provenance,{type:'device',ownerId:actorId});assert.equal(sample.at,now+20);
 const room={roomId:'fixture-room',map:sample.map,game:view},model=cameraCardsModel(room,{mapResolver:registry.getMap});assert.equal(model.total,map.fixtures.cameras.length);for(const card of model.cards){assert.equal(card.map.id,id);assert.equal(card.at,sample.at);assert(card.field);const frame=sample.data.frames.find(f=>f.cameraId===card.camera.id);assert.deepEqual(card.players.map(p=>({id:p.id,position:p.position})),frame.players);}
 const before=model.cards.map(c=>c.players.map(p=>({id:p.id,position:p.position})));view.players.forEach(p=>{p.position={x:1790,y:1390};p.role='DO NOT DRAW';});assert.deepEqual(cameraCardsModel(room,{mapResolver:registry.getMap}).cards.map(c=>c.players.map(p=>({id:p.id,position:p.position}))),before);
 const spectator=engine.getPlayerView(state,null,now+20);assert.equal(cameraCardsModel({roomId:'fixture-room',game:spectator},{mapResolver:registry.getMap}).total,0);
});
after(()=>{assert.deepEqual(hash(Object.assign({},...['server/engine','server/features','shared'].map(capture))),hash(sources),'Runtime source changed during camera checks');if(process.env.TACTICAL_CLIENT_SAMPLE_RECEIPT)writeFileSync(process.env.TACTICAL_CLIENT_SAMPLE_RECEIPT,JSON.stringify({root:root.href,sha256:hash(sources),sourceStable:true,limits:'Explicitly positioned real-engine camera read/projection only; no HTTP/browser/provider.'},null,2)+'\n');});
