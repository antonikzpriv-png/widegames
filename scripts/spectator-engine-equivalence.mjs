/** Reproduce the 720-transaction audit from the repository root.
 * Prepare reference source first:
 *   mkdir -p /tmp/movement-main-reference
 *   git archive 41b4c6e2ddfce65882ac635c6dc5b7e4cf1fc4ef server/engine shared | tar -x -C /tmp/movement-main-reference
 * Then run:
 *   node scripts/spectator-engine-equivalence.mjs
 * Override the extracted source root with SPECTATOR_EQUIVALENCE_BASELINE_ROOT.
 */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as current from '../server/engine/index.mjs';
import {getWorld} from '../shared/world.mjs';
const baseline=await import(pathToFileURL(resolve(process.env.SPECTATOR_EQUIVALENCE_BASELINE_ROOT||'/tmp/movement-main-reference','server/engine/index.mjs')));
let states=0;
for(const mapId of ['beacon','storm-foundry','tidal-observatory'])for(const mode of ['human','spectator'])for(const features of [undefined,{deathPolicy:'ghost-tasks',abilities:true}]){
 const opts={id:'equivalence-'+states,seed:'same-fixture',now:0,world:true,mapId,mode,features,config:{roamDeadlineMs:1000,discussionMs:1200,votingMs:1000,maxMatchMs:6000}};
 let old=baseline.createMatch(opts),next=current.createMatch(opts),now=0,seq=0;assert.deepEqual(next,old);
 for(let step=0;step<60;step++){
  now+=83+step%5;let a,b;
  if(step%5===0){const input={seq:++seq,dx:step%2?1:0,dy:step%2?0:1};a=baseline.applyInput(old,'p1',input,now);b=current.applyInput(next,'p1',input,now);}
  else if(step%5===1){const station=getWorld(mapId).WORLD_STATIONS[step%2?'archive':'bridge'],action={id:'nav-'+step,type:'navigate',x:station.x,y:station.y};a=baseline.applyAction(old,'p2',action,now);b=current.applyAction(next,'p2',action,now);}
  else if(step%5===2){const action={id:'wait-'+step,type:'wait'};a=baseline.applyAction(old,'p3',action,now);b=current.applyAction(next,'p3',action,now);}
  else{a=baseline.tick(old,now);b=current.tick(next,now);}
  assert.deepEqual(b,a,`${mapId}/${mode}/features=${!!features}/step${step}`);old=a.state;next=b.state;states++;
 }
}
console.log(JSON.stringify({baseline:'41b4c6e2ddfce65882ac635c6dc5b7e4cf1fc4ef',comparedTransactions:states,maps:3,modes:2,featurePresets:2,result:'identical engine states/events/receipts'}));
