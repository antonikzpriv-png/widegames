import * as legacy from '../world.mjs';
import {ROOM_LAYOUT} from '../contracts.mjs';
import {BEACON_DOORS,BEACON_VENTS,BEACON_REPAIRS,BEACON_DEVICES,BEACON_CAMERAS} from '../beacon.mjs';
import {deepFreeze} from './freeze.mjs';
import {STORMBREAK_ANNEX} from './stormbreak-annex.mjs';
import {BEACON_V2} from './beacon-v2.mjs';
export {deepFreeze};
export const DEFAULT_MAP_ID='beacon';
const fixtures=deepFreeze(structuredClone({doors:BEACON_DOORS,vents:BEACON_VENTS,repairs:BEACON_REPAIRS,devices:BEACON_DEVICES,cameras:BEACON_CAMERAS}));
const roomLayout=deepFreeze(structuredClone(ROOM_LAYOUT));
const beacon=deepFreeze({id:'beacon',version:1,name:'Lantern Beacon',description:'The original storm-beacon watch.',theme:'beacon',roomLayout,fixtures,geometry:{...legacy,ROOM_LAYOUT:roomLayout,WORLD_VIEWPOINT:{x:800,y:285},WORLD_SPAWN_ROOM:'bridge',fixtures}});
// Exact persisted identities are permanent; only string selection follows the latest catalog.
const versions=new Map([['beacon',new Map([[1,beacon],[2,BEACON_V2]])],['stormbreak-annex',new Map([[1,STORMBREAK_ANNEX]])]]);
const latest=new Map([['beacon',BEACON_V2],['stormbreak-annex',STORMBREAK_ANNEX]]);
export const MAP_CATALOG=deepFreeze([...latest.values()].map(({id,version,name,description,theme})=>({id,version,name,description,theme})));
export function getMap(reference){
 if(reference===undefined)return beacon;
 if(typeof reference==='string'){const map=latest.get(reference);if(map)return map;}
 else if(reference!==null&&typeof reference==='object'&&!Array.isArray(reference)&&Object.keys(reference).length===2&&Object.hasOwn(reference,'id')&&Object.hasOwn(reference,'version')){
  const map=versions.get(reference.id)?.get(reference.version);if(map)return map;
 }
 throw new TypeError('Unsupported map identity/version');
}
export function mapFor(value){return getMap(value?.map);}
