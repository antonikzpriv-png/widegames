import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=process.env.LATEST_SPECTATOR_CLIENT_ROOT?pathToFileURL(resolve(process.env.LATEST_SPECTATOR_CLIENT_ROOT)+'/'):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const {spectatorInspection}=await import(new URL('server/spectator.mjs',root));
const {observerGame,describeSpectatorSelection}=await import(new URL('public/world/spectator.mjs',root));
const {getMap}=await import(new URL('shared/maps/index.mjs',root));
const files=['server/engine/index.mjs','server/spectator.mjs','shared/maps/index.mjs','public/world/experience.mjs','public/world/model.mjs','public/world/scene.mjs','public/world/spectator.mjs'];
const hash=file=>createHash('sha256').update(readFileSync(new URL(file,root))).digest('hex'),pins=Object.fromEntries(files.map(f=>[f,hash(f)]));
after(()=>{for(const [file,pin]of Object.entries(pins))assert.equal(hash(file),pin,'runtime changed during component check: '+file);});
// Actual committed engine/projection modules. Constructor fixtures, no HTTP/WS,
// no fake API responses, autonomous outcomes, providers or native browser claim.
const options={mode:'spectator',seatId:null,identity:{host:true,seatId:null},now:1000};
function state(id='beacon'){return ['storm-foundry','tidal-observatory'].includes(id)?engine.createMatch({id:'projection-'+id,mode:'spectator',world:true,mapId:id,seed:'source-client',now:1000}):engine.createMatch({id:'projection-'+id,mode:'spectator',tactical:true,stationTasks:true,map:{id,version:id==='beacon'?2:1},roster:Array.from({length:4},(_,i)=>({id:'keeper_'+i,name:'Keeper '+i,color:'#aabbcc',persona:'Keeper'})),humanPlayerIds:[],features:{deathPolicy:'ghost-tasks',abilities:true},seed:'source-client',now:1000});}
for(const id of ['beacon','stormbreak-annex','storm-foundry','tidal-observatory'])test(`actual ${id} host-only inspection feeds mapped UI without player/public role leakage`,()=>{const s=state(id),inspection=spectatorInspection(s,options);assert(inspection);const pub=engine.getPlayerView(s,null,1000),owner={...pub,inspection};assert.equal(pub.inspection,undefined);assert(pub.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'tasks')));const crew=s.players.find(p=>p.role==='crew'),d=describeSpectatorSelection(owner,{type:'player',id:crew.id});assert.match(d.description,/private owner/i);assert.deepEqual(d.facts.find(([key])=>key==='Role'),['Role','crew']);assert.match(JSON.stringify(d),new RegExp(crew.tasks[0].label));assert.match(JSON.stringify(d),/confirmed steps/);const publicDescription=JSON.stringify(describeSpectatorSelection(pub,{type:'player',id:crew.id}));assert.doesNotMatch(publicDescription,/confirmed steps|Private owner observatory/);assert(observerGame(owner).players.some(p=>p.position));const map=getMap(id);assert.match(JSON.stringify(describeSpectatorSelection(owner,{type:'station',id:map.geometry.WORLD_STATIONS[crew.tasks[0].roomId].id||'station-'+crew.tasks[0].roomId})),new RegExp(crew.tasks[0].label));});
test('actual server projector denies public visitors and human/player-seat identities before client consumption',()=>{const s=state();for(const variant of [{identity:{host:false,seatId:null}},{identity:{host:true,seatId:'keeper_0'},seatId:'keeper_0'},{identity:undefined}])assert.equal(spectatorInspection(s,{...options,...variant}),null);assert.equal(spectatorInspection({...s,mode:'human'},options),null);const p=engine.getPlayerView(s,s.players[0].id,1000);assert.equal(p.inspection,undefined);assert.equal(describeSpectatorSelection(p,{type:'player',id:s.players[0].id}),null);});
