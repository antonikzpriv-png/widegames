import * as legacy from '../world.mjs';
import {ROOM_LAYOUT} from '../contracts.mjs';
import {BEACON_DOORS,BEACON_VENTS,BEACON_REPAIRS,BEACON_DEVICES,BEACON_CAMERAS} from '../beacon.mjs';
import {deepFreeze} from './freeze.mjs';
import {STORMBREAK_ANNEX} from './stormbreak-annex.mjs';
import {BEACON_V2} from './beacon-tactical-v2.mjs';
export {deepFreeze};
export const DEFAULT_MAP_ID='beacon';
const fixtures=deepFreeze(structuredClone({doors:BEACON_DOORS,vents:BEACON_VENTS,repairs:BEACON_REPAIRS,devices:BEACON_DEVICES,cameras:BEACON_CAMERAS}));
const roomLayout=deepFreeze(structuredClone(ROOM_LAYOUT));
const beacon=deepFreeze({id:'beacon',version:1,name:'Lantern Beacon',description:'The original storm-beacon watch.',theme:'beacon',roomLayout,fixtures,geometry:{...legacy,ROOM_LAYOUT:roomLayout,WORLD_VIEWPOINT:{x:800,y:285},WORLD_SPAWN_ROOM:'bridge',fixtures}});
// Tactical versions and legacy world2 revisions are distinct permanent namespaces.
const legacyMaps=new Map();
const emptyFixtures=deepFreeze({doors:[],vents:[],repairs:{},devices:[],cameras:[]});
export function getLegacyMap(mapId='beacon',revision=1){
 if(typeof mapId!=='string'||!['beacon','storm-foundry','tidal-observatory'].includes(mapId)||(revision!==1&&revision!==2))throw new TypeError('Unsupported legacy map identity/revision');
 if(mapId==='beacon'&&revision===1)return beacon;
 const key=mapId+':'+revision;if(!legacyMaps.has(key)){
  const base=legacy.getWorld(mapId,revision),layout=deepFreeze(structuredClone(base.ROOM_LAYOUT));
  const id=mapId==='beacon'?'beacon-illustrated':mapId;
  const geometry=Object.freeze({...base,ROOM_LAYOUT:layout,WORLD_VIEWPOINT:base.worldSpawn('p1'),WORLD_SPAWN_ROOM:'bridge',fixtures:emptyFixtures});
  legacyMaps.set(key,deepFreeze({id,version:revision,name:mapId==='beacon'?'Illustrated Lantern Wake':base.metadata.name,description:base.metadata.description,theme:id,tactical:false,taskProtocol:'taskStep',legacyMapId:mapId,legacyRevision:revision,namespaceKey:'world2:'+key,reference:{mapId,revision},tasksPerCrew:base.metadata.tasksPerCrew,metadata:base.metadata,roomLayout:layout,fixtures:emptyFixtures,geometry}));
 }
 return legacyMaps.get(key);
}
const versions=new Map([['beacon',new Map([[1,beacon],[2,BEACON_V2]])],['stormbreak-annex',new Map([[1,STORMBREAK_ANNEX]])]]);
for(const id of ['storm-foundry','tidal-observatory'])versions.set(id,new Map([[1,getLegacyMap(id,1)],[2,getLegacyMap(id,2)]]));
versions.set('beacon-illustrated',new Map([[2,getLegacyMap('beacon',2)]]));
const latest=new Map([['beacon',BEACON_V2],['stormbreak-annex',STORMBREAK_ANNEX],['storm-foundry',getLegacyMap('storm-foundry',2)],['tidal-observatory',getLegacyMap('tidal-observatory',2)],['beacon-illustrated',getLegacyMap('beacon',2)]]);
export const MAP_CATALOG=deepFreeze([...latest.values()].map(({id,version,name,description,theme,tactical=true,taskProtocol='station'})=>({id,version,name,description,theme,tactical,taskProtocol})));
export const TACTICAL_MAP_CATALOG=deepFreeze(MAP_CATALOG.filter(map=>map.tactical));
export const PUBLIC_MAP_CATALOG=deepFreeze(MAP_CATALOG.map(({id,version,name,description,theme})=>({id,version,name,description,theme})));
export function getMap(reference){
 if(reference===undefined)return beacon;
 if(typeof reference==='string'){const map=latest.get(reference);if(map)return map;}
 else if(reference!==null&&typeof reference==='object'&&!Array.isArray(reference)&&Object.keys(reference).length===2){
  if(Object.hasOwn(reference,'mapId')&&Object.hasOwn(reference,'revision'))return getLegacyMap(reference.mapId,reference.revision);
  if(Object.hasOwn(reference,'id')&&Object.hasOwn(reference,'version')){const map=versions.get(reference.id)?.get(reference.version);if(map)return map;}
 }
 throw new TypeError('Unsupported map identity/version');
}
export function mapIdentity(reference){const map=reference?.geometry?reference:getMap(reference);return map.namespaceKey??'tactical:'+map.id+':'+map.version;}
export function mapFor(value){
 if(value?.map!==undefined){const map=getMap(value.map);
  if(value.mapId!==undefined&&value.mapId!==(map.legacyMapId??map.id)&&value.mapId!==map.id)throw new TypeError('Conflicting map identities');
  if(value.mapRevision!==undefined&&mapIdentity(getLegacyMap(value.mapId??map.legacyMapId??map.id,value.mapRevision))!==mapIdentity(map))throw new TypeError('Conflicting map namespaces');
  return map;
 }
 return value?.mapId!==undefined||value?.mapRevision!==undefined?getLegacyMap(value.mapId??'beacon',value.mapRevision??1):beacon;
}
