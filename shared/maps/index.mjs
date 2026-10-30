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
// Expanded maps retain current-main's world2/taskStep protocol and geometry.
const expanded=['storm-foundry','tidal-observatory'].map(id=>{
 const base=legacy.getWorld(id),roomLayout=deepFreeze(structuredClone(base.ROOM_LAYOUT));
 const fixtures=deepFreeze({doors:[],vents:[],repairs:{},devices:[],cameras:[]});
 const geometry=Object.freeze({...base,ROOM_LAYOUT:roomLayout,WORLD_VIEWPOINT:base.worldSpawn('p1'),WORLD_SPAWN_ROOM:'bridge',fixtures});
 return deepFreeze({id,version:1,name:base.metadata.name,description:base.metadata.description,theme:id,tactical:false,taskProtocol:'taskStep',tasksPerCrew:base.metadata.tasksPerCrew,metadata:base.metadata,roomLayout,fixtures,geometry});
});
const versions=new Map([['beacon',new Map([[1,beacon],[2,BEACON_V2]])],['stormbreak-annex',new Map([[1,STORMBREAK_ANNEX]])]]);
for(const map of expanded)versions.set(map.id,new Map([[map.version,map]]));
const latest=new Map([['beacon',BEACON_V2],['stormbreak-annex',STORMBREAK_ANNEX],...expanded.map(map=>[map.id,map])]);
export const MAP_CATALOG=deepFreeze([...latest.values()].map(({id,version,name,description,theme,tactical=true,taskProtocol='station'})=>({id,version,name,description,theme,tactical,taskProtocol})));
export const TACTICAL_MAP_CATALOG=deepFreeze(MAP_CATALOG.filter(map=>map.tactical));
export const PUBLIC_MAP_CATALOG=deepFreeze(MAP_CATALOG.map(({id,version,name,description,theme})=>({id,version,name,description,theme})));
export function getMap(reference){
 if(reference===undefined)return beacon;
 if(typeof reference==='string'){const map=latest.get(reference);if(map)return map;}
 else if(reference!==null&&typeof reference==='object'&&!Array.isArray(reference)&&Object.keys(reference).length===2&&Object.hasOwn(reference,'id')&&Object.hasOwn(reference,'version')){
  const map=versions.get(reference.id)?.get(reference.version);if(map)return map;
 }
 throw new TypeError('Unsupported map identity/version');
}
export function mapFor(value){const map=getMap(value?.map!==undefined?value.map:value?.mapId!==undefined?{id:value.mapId,version:1}:undefined);if(value?.map!==undefined&&value?.mapId!==undefined&&getMap(value.mapId).id!==map.id)throw new TypeError('Conflicting map identities');return map;}
