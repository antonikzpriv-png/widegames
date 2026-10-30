import {createCameraCards} from './camera-cards.mjs';
import {getMap} from '../../shared/maps/index.mjs';
import {dom,control,setText,restoreTrigger} from './dom.mjs';
import {clock} from './model.mjs';
import {descriptors,descriptorKey,viewKey,systemSummary,criticalText,observationText,sessionText,cooldownText,interactionLabel,fieldNotes,fieldNoteText,hatchTraces,hatchTraceText} from './beacon-model.mjs';

/** Persistent keyboard/touch controls for server-permitted beacon descriptors. */
export function createBeaconPanel({id,action,stop,feedback,change=()=>{},mapResolver=getMap}){
 const node=dom('section','lw-beacon'),toggle=control('Systems & evidence',()=>setOpen(!open),'lw-beacon-toggle'),pane=dom('section','lw-beacon-pane'),heading=dom('h2','','BEACON SYSTEMS'),summary=dom('p','lw-beacon-status'),cooldowns=dom('p','lw-beacon-cooldowns'),critical=dom('p','lw-beacon-critical'),transit=dom('p','lw-beacon-transit'),session=dom('p','lw-beacon-session'),controls=dom('div','lw-beacon-controls'),empty=dom('p'),observations=dom('ol','lw-beacon-observations'),notes=dom('ol','lw-beacon-notes'),notesHeading=dom('h3'),traces=dom('ol','lw-beacon-traces'),traceHeading=dom('h3'),close=control('Close systems',()=>setOpen(false),'lw-secondary');
 pane.id=`${id}-systems`;pane.hidden=true;pane.setAttribute('aria-label','Systems, devices and hatch routes');toggle.setAttribute('aria-controls',pane.id);toggle.setAttribute('aria-expanded','false');summary.setAttribute('role','status');session.setAttribute('role','status');observations.setAttribute('aria-label','Your sampled device observations');pane.append(heading,summary,cooldowns,critical,transit,session,controls,empty,dom('h3','','YOUR OBSERVATIONS'),dom('p','','Samples describe the recorded time. They are not live tracking.'),observations,notesHeading,notes,traceHeading,traces,close);node.append(toggle,pane);
 let room=null,options={},open=false,disposed=false,generation=0,busy=false,lastIdentity=null,lastContext=null,lastConnected=null,lastSignal=null;
 const cameraCards=createCameraCards({mapResolver});pane.append(cameraCards.node);
 const rows=new Map(),samples=new Map(),noteNodes=new Map(),traceNodes=new Map();
 notes.setAttribute('aria-label','Your field notes');traces.setAttribute('aria-label','Permitted historical hatch observations');
 function setOpen(value){open=value;pane.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(!open){generation++;restoreTrigger(toggle);}else{update(room,options);Promise.resolve(stop()).catch(()=>{});close.focus();}change();}
 pane.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);}});
 function current(h,key,origin){return !disposed&&!document.hidden&&!options.signal?.aborted&&(!options.isCurrent||options.isCurrent())&&generation===origin&&viewKey(room)===key&&room?.game?.phase==='roam'&&room.game.self?.alive&&!room.game.systems?.selfTransit&&!room.game.self?.transit&&descriptors(room.game).some(next=>descriptorKey(next)===descriptorKey(h)&&next.enabled===true);}
 async function send(id){
  const h=descriptors(room?.game).find(h=>h.id===id);if(!h||busy||options.pending)return;
  if(!options.connected){feedback('Reconnect before using beacon equipment.');return;}
  if(h.enabled!==true){feedback(h.reason||'This action is unavailable.');return;}
  const key=viewKey(room),origin=generation,fields={...h.fields};if(!current(h,key,origin))return;
  busy=true;update(room,options);
  try{await stop();if(!current(h,key,origin))return;await action(h.type,fields);}catch(error){if(current(h,key,origin)&&error?.name!=='AbortError')feedback(error?.message||'Beacon action failed. Try again.');}finally{busy=false;if(!disposed)update(room,options);}
 }
 function update(next,nextOptions={}){
  if(disposed)return;room=next;options=nextOptions;const game=room?.game,map=mapResolver(game?.map??room?.map),identity=JSON.stringify([room?.roomId,game?.matchId,map.id,map.version,game?.phase,game?.self?.id]);
  if(lastConnected!==options.connected||lastSignal!==options.signal){generation++;lastConnected=options.connected;lastSignal=options.signal;}
  const context=viewKey(room);if(lastContext!==context){generation++;lastContext=context;}
  if(lastIdentity!==identity){generation++;if(lastIdentity!==null){open=false;pane.hidden=true;toggle.setAttribute('aria-expanded','false');}lastIdentity=identity;samples.clear();observations.replaceChildren();noteNodes.clear();notes.replaceChildren();traceNodes.clear();traces.replaceChildren();}
  node.hidden=game?.beaconVersion!==1;if(node.hidden)return;
  setText(summary,systemSummary(game,options.now));setText(cooldowns,cooldownText(game,options.now));cooldowns.hidden=!cooldowns.textContent;setText(critical,game.sabotage?.active?`${clock(game.sabotage.deadlineAt,options.now)} remaining. ${criticalText(game,map)}`:'');critical.hidden=!game.sabotage?.active;
  const travel=game.systems?.selfTransit||game.self?.transit;transit.hidden=!travel;setText(transit,travel?`Hatch transit${travel.exitId?' to '+travel.exitId:''}${Number.isFinite(travel.deadlineAt)?' - '+clock(travel.deadlineAt,options.now)+' remaining':''}. Walking and equipment unavailable.`:'');
  setText(session,sessionText(game.investigation,options.now,map));
  const hints=descriptors(game),ids=new Set(hints.map(h=>h.id));
  for(const [id,row]of rows)if(!ids.has(id)){const focused=row.node.contains(document.activeElement);row.node.remove();rows.delete(id);if(focused&&open)restoreTrigger(close);}
  for(const h of hints){let row=rows.get(h.id);if(!row){const node=dom('div','lw-beacon-control'),button=control('',()=>send(h.id)),reason=dom('span');node.append(button,reason);controls.append(node);row={node,button,reason};rows.set(h.id,row);}setText(row.button,interactionLabel(h,game,map));row.button.dataset.beaconAction=h.type;row.button.dataset.interactionId=h.id;row.button.disabled=busy||!!options.pending;row.button.setAttribute('aria-disabled',String(h.enabled!==true||!options.connected||row.button.disabled));setText(row.reason,[h.roomId?`Location: ${h.roomId}.`:'',h.enabled===true?'':h.reason||'Unavailable'].filter(Boolean).join(' '));}
  empty.hidden=hints.length>0;setText(empty,!game.self?'Observing only. No private equipment access.':game.phase!=='roam'?'Equipment is unavailable during this phase.':'No permitted actions here. Approach a device, repair site or hatch.');
  for(const [index,sample]of (game.investigation?.observations||[]).entries()){const key=sample.id||`${sample.deviceId}:${sample.at}:${index}`;if(samples.has(key))continue;let text;try{text=observationText(sample,game.players,sample.map?mapResolver(sample.map):map);}catch{text='Observation map/version unavailable in this client.';}const li=dom('li','',text);observations.append(li);samples.set(key,li);}
  const sampleIds=new Set((game.investigation?.observations||[]).map((s,i)=>s.id||`${s.deviceId}:${s.at}:${i}`));for(const [key,li]of samples)if(!sampleIds.has(key)){li.remove();samples.delete(key);}
  cameraCards.update(room,options);
  const ownNotes=fieldNotes(game),localTraces=hatchTraces(game);
  setText(notesHeading,`YOUR FIELD NOTES (${ownNotes.length})`);setText(traceHeading,`HISTORICAL HATCH OBSERVATIONS (${localTraces.length})`);
  const syncHistory=(list,map,values,keyOf,textOf)=>{const ids=new Set();for(const value of values){const key=keyOf(value);ids.add(key);let li=map.get(key);if(!li){li=dom('li');map.set(key,li);list.append(li);}setText(li,textOf(value));}for(const [key,li]of map)if(!ids.has(key)){li.remove();map.delete(key);}};
  syncHistory(notes,noteNodes,ownNotes,n=>n.id||`${n.at}:${n.roomId}`,fieldNoteText);
  syncHistory(traces,traceNodes,localTraces,e=>e.id||`${e.type}:${e.playerId}:${e.at}`,e=>hatchTraceText(e,game.players));

 }
 return {node,update,suspend(){generation++;},show(interactionId){setOpen(true);if(interactionId)restoreTrigger(rows.get(interactionId)?.button);},close(){setOpen(false);},get open(){return open;},dispose(){disposed=true;generation++;cameraCards.dispose();node.remove();}};
}
