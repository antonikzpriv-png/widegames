import {getMap} from '../shared/maps/index.mjs';
import {fail,requestId} from './rooms.mjs';
/** Map-only settings adapter for the existing serialized authenticated lobby. */
export function proposeMapSetting(data,identity,input){
 if(!identity?.host)fail(403,'HOST_REQUIRED','Only the host can change this map.');
 if(![3,4].includes(data.schema))fail(409,'SETTINGS_UNAVAILABLE','This saved lobby retains its original map and rules.');
 if(!input||Object.keys(input).length!==3||!['id','mapId','expectedRevision'].every(k=>Object.hasOwn(input,k))||!requestId(input.id)||typeof input.mapId!=='string'||input.mapId.length>64||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||input.expectedRevision>64)fail(400,'INVALID_SETTINGS','Send an ID, mapId and current expectedRevision.');
 const fingerprint=JSON.stringify([input.mapId,input.expectedRevision]),old=data.settings.requests.find(r=>r.id===input.id);
 if(old){if(old.fingerprint!==fingerprint)fail(409,'REQUEST_CONFLICT','This settings ID was used for different contents.');return {next:null,error:old.error??null,accepted:old.accepted};}
 if(data.state)fail(409,'ALREADY_STARTED','The map is fixed after the watch begins.');
 if(data.settings.requests.length>=64)fail(429,'SETTINGS_LIMIT','This lobby has reached its settings request limit. You can still start it.');
 let selected;try{selected=getMap(input.mapId);}catch{fail(400,'UNKNOWN_MAP','Choose an available map.');}
 const next=structuredClone(data),error=input.expectedRevision!==data.settings.revision?{code:'SETTINGS_CONFLICT',message:'The map settings changed. Use the latest lobby selection.'}:null;
 if(!error){next.map={id:selected.id,version:selected.version};next.settings.revision++;}
 next.settings.requests.push({id:input.id,fingerprint,accepted:!error,revision:next.settings.revision,...(error?{error}: {})});
 return {next,error,accepted:!error};
}
