import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getMap} from '../shared/maps/index.mjs';
import {descriptors,interactionLabel} from '../public/world/beacon-model.mjs';
const maps=process.env.TACTICAL_CLIENT_MAP_ROOT?await import(pathToFileURL(resolve(process.env.TACTICAL_CLIENT_MAP_ROOT,'shared/maps/index.mjs'))):{getMap};

// Pure helper/cascade boundaries; native pointer hit-testing remains manager QA.
test('interactionLabel remains a one-argument callback including Array.map extra arguments',()=>{
 const map=getMap(),doors=map.fixtures.doors.slice(0,2);
 assert.equal(doors.length,2);
 const game={beaconVersion:1,interactions:doors.map((d,i)=>({id:'door-'+i,type:'systemSabotage',fields:{kind:'door',targetId:d.id},enabled:true,label:'Disrupt door'}))};
 const hints=descriptors(game),labels=hints.map(interactionLabel);
 assert.deepEqual(labels,hints.map(h=>interactionLabel(h)));
 assert.equal(new Set(labels).size,2);
 for(const [index,door]of doors.entries()){assert(labels[index].includes(door.id));assert(labels[index].includes(door.roomId));}
 assert.equal(interactionLabel({type:'investigate',fields:{deviceId:'security'},label:'Read cameras'}),'Read cameras');
});

test('interactionLabel accepts explicit immutable map descriptors and game map references',()=>{
 for(const item of maps.TACTICAL_MAP_CATALOG||[{id:'beacon'}]){
  const map=maps.getMap(item.id),door=map.fixtures.doors[0],h={type:'systemSabotage',fields:{kind:'door',targetId:door.id},label:'Close door'};
  const expected=`Close door: ${door.id} (${door.roomId})`;
  assert.equal(interactionLabel(h,map),expected);
  assert.equal(interactionLabel(h,{},map),expected);
  // The own foundation may not yet have the Annex registry. The explicit
  // descriptor above always uses the real Core registry when supplied.
  if(map.id==='beacon')assert.equal(interactionLabel(h,{map:{id:map.id,version:map.version}}),expected);
  const hatch=map.fixtures.vents[0],vent={type:'vent',fields:{exitId:hatch.id},label:'Hatch to '+hatch.roomId};
  assert.equal(interactionLabel(vent,map),map.id==='beacon'?vent.label:'Hatch to '+map.roomLayout.find(r=>r.id===hatch.roomId).name);
 }
});

test('mute control paints above the real council backdrop and retains a touch-sized target',()=>{
 const rootCss=readFileSync(new URL('../public/game.css',import.meta.url),'utf8'),css=readFileSync(new URL('../public/world/beacon.css',import.meta.url),'utf8');
 const rule=(text,selector)=>text.split('}').find(s=>s.slice(0,s.indexOf('{')).split(',').some(part=>part.trim()===selector))?.split('{').at(-1);
 const sound=rule(css,'.lw-world .lw-sound-toggle'),overlay=rule(rootCss,'.lw-scene-overlay');
 assert(sound&&overlay,'actual control and overlay rules must be available');
 const number=(body,key)=>Number(body.match(new RegExp('(?:^|;)'+key+':([0-9]+)'))?.[1]);
 assert(number(sound,'z-index')>number(overlay,'z-index'),'council backdrop must not intercept mute clicks');
 assert(number(sound,'min-height')>=44,'mute remains touch sized');
});
