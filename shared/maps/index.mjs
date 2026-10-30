import * as legacy from '../world.mjs';
import {ROOM_LAYOUT} from '../contracts.mjs';
import {BEACON_DOORS,BEACON_VENTS,BEACON_REPAIRS,BEACON_DEVICES,BEACON_CAMERAS} from '../beacon.mjs';
import {deepFreeze} from './freeze.mjs';
import {STORMBREAK_ANNEX} from './stormbreak-annex.mjs';
export {deepFreeze};
export const DEFAULT_MAP_ID='beacon';
const fixtures=deepFreeze(structuredClone({doors:BEACON_DOORS,vents:BEACON_VENTS,repairs:BEACON_REPAIRS,devices:BEACON_DEVICES,cameras:BEACON_CAMERAS}));
const roomLayout=deepFreeze(structuredClone(ROOM_LAYOUT));
const beacon=deepFreeze({id:'beacon',version:1,name:'Lantern Beacon',description:'The original storm-beacon watch.',theme:'beacon',roomLayout,fixtures,geometry:{...legacy,ROOM_LAYOUT:roomLayout,WORLD_VIEWPOINT:{x:800,y:285},WORLD_SPAWN_ROOM:'bridge',fixtures}});
const registry=new Map([[beacon.id,beacon],[STORMBREAK_ANNEX.id,STORMBREAK_ANNEX]]);
export const MAP_CATALOG=deepFreeze([...registry.values()].map(({id,version,name,description,theme})=>({id,version,name,description,theme})));
export function getMap(reference){const id=reference===undefined?DEFAULT_MAP_ID:typeof reference==='string'?reference:reference?.id;const map=registry.get(id);if(!map||(typeof reference==='object'&&reference!==null&&(Object.keys(reference).some(k=>!['id','version'].includes(k))||reference.version!==map.version)))throw new TypeError('Unsupported map identity/version');return map;}
export function mapFor(value){return getMap(value?.map);}
