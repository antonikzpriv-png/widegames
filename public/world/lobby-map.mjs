import {dom,setText} from './dom.mjs';
import {mapKey} from './map-model.mjs';
/** Server selection is displayed verbatim; only root sends/authenticates settings. */
export function createLobbyMapSelector({id,settings,change=()=>{}}){
 const node=dom('section','lw-lobby-map'),label=dom('label','','Watch location'),select=dom('select','lw-map-select'),description=dom('p'),status=dom('p','lw-map-settings-status');
 select.id=`${id}-map-selection`;label.htmlFor=select.id;status.id=`${id}-map-settings-status`;status.setAttribute('role','status');status.setAttribute('aria-live','polite');select.setAttribute('aria-describedby',status.id);node.append(label,select,description,status);
 const entries=new Map();let room=null,options={},busy=false,disposed=false,generation=0,owner=null,message='';
 const key=()=>JSON.stringify([room?.roomId,room?.game?.matchId,!!room?.game,room?.isHost,room?.settingsRevision,mapKey(room?.map),options.connected]);
 const current=(origin,pin)=>!disposed&&!document.hidden&&origin===generation&&pin===key()&&!room?.game&&room?.isHost&&options.connected;
 select.addEventListener('change',async()=>{
  const requested=select.value,offered=room?.availableMaps?.find(m=>m.id===requested);select.value=room?.map?.id||'';
  if(disposed||busy||options.pending||room?.game||!room?.isHost||!options.connected||typeof settings!=='function'||!offered||requested===room.map?.id)return;
  const origin=generation,pin=key();busy=true;message=`Saving ${offered.name||offered.id} selection...`;update(room,options);change();
  try{await settings(requested);if(current(origin,pin))message='Map request sent. Waiting for server confirmation.';}
  catch(error){if(current(origin,pin)&&error?.name!=='AbortError')message=error?.message||'Map selection failed. Try again.';}
  finally{busy=false;if(!disposed){update(room,options);change();}}
 });
 function update(next,nextOptions={}){
  if(disposed)return;room=next;options=nextOptions;const nextOwner=key();if(owner!==nextOwner){generation++;owner=nextOwner;message='';}
  const maps=Array.isArray(room?.availableMaps)?room.availableMaps:[];node.hidden=!!room?.game||!maps.length;
  const ids=new Set(maps.map(m=>m.id));for(const [id,option]of entries)if(!ids.has(id)){option.remove();entries.delete(id);}
  for(const map of maps){let option=entries.get(map.id);if(!option){option=dom('option');option.value=map.id;entries.set(map.id,option);select.append(option);}setText(option,map.name||map.id);}
  select.value=room?.map?.id||'';const selected=maps.find(m=>m.id===room?.map?.id);setText(description,selected?.description||'');
  select.disabled=busy||!!options.pending||!room?.isHost||!!room?.game||!options.connected||typeof settings!=='function';
  const reason=!room?.isHost?'Only the host can choose a map before the watch.':!options.connected?'Reconnect before changing the map.':typeof settings!=='function'?'Map selection is unavailable in this client.':busy?message||'Saving map selection...':message||`Selected map: ${selected?.name||room?.map?.id||'unavailable'}.`;
  setText(status,reason);
 }
 return {node,update,get pending(){return busy;},suspend(){generation++;message='';},dispose(){disposed=true;generation++;node.remove();}};
}
