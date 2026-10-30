import test from 'node:test';
import assert from 'node:assert/strict';
import {getMap} from '../shared/maps/index.mjs';
import {createMatch,applyAction,tick,getPlayerView} from '../server/engine/index.mjs';
import {validateSystemsState} from '../server/engine/systems/index.mjs';
const map={id:'beacon',version:2},m=getMap(map),g=m.geometry;
for(const kind of ['power','flood'])test('real Beacon 2 '+kind+' uses two distinct crew/routes/sites within the normal 75-second deadline',()=>{
 let state=createMatch({id:'quality-critical-'+kind,tactical:true,map,seed:3,now:100000,config:{sabotageCooldownMs:1}}),serial=0;
 const act=(actor,type,fields,now)=>{const r=applyAction(state,actor,{id:'quality:'+ ++serial,type,...fields},now);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;};
 const sab=state.players.find(p=>p.role==='saboteur'),crew=state.players.filter(p=>p.role==='crew').slice(0,2),sites=m.fixtures.repairs[kind];
 act(sab.id,'systemSabotage',{kind,targetId:'beacon'},100001);assert.equal(state.sabotage.deadlineAt,175001);
 for(let i=0;i<2;i++)act(crew[i].id,'navigate',sites[i].position,100002);
 const travel=crew.map(p=>{const actor=state.players.find(q=>q.id===p.id);let from=actor.position,total=0;for(const q of actor.motion.path){total+=g.distance(from,q);from=q;}return total/180*1000;});
 const arrived=100002+Math.ceil(Math.max(...travel))+1;assert.ok(arrived<175001);state=tick(state,arrived).state;
 // A real finalized active checkpoint, not a fabricated completed site, must restore and validate.
 state=JSON.parse(JSON.stringify(state));assert.equal(validateSystemsState(state),true);
 for(let i=0;i<2;i++){assert.deepEqual(state.players.find(p=>p.id===crew[i].id).position,sites[i].position);act(crew[i].id,'systemRepair',{systemId:kind,siteId:sites[i].id},arrived+i);if(i===0){assert.equal(state.sabotage.active,true);const denied=applyAction(state,crew[i].id,{id:'quality:second-site-same-crew',type:'systemRepair',systemId:kind,siteId:sites[1].id},arrived);assert.equal(denied.accepted,false);}}
 assert.equal(state.sabotage.active,false);assert.equal(state.sabotage.sites.filter(s=>s.repairedAt!==null).length,2);assert.equal(new Set(state.sabotage.sites.map(s=>s.repairedBy)).size,2);assert.equal(state.phase,'roam');assert.equal(validateSystemsState(state),true);
 for(const viewer of [null,...crew.map(p=>p.id)])for(const site of getPlayerView(state,viewer,arrived+1).systems.critical.sites)assert.equal(Object.hasOwn(site,'repairedBy'),false);
});
