import {dom,control,setText,restoreTrigger} from './dom.mjs';
import {clock} from './model.mjs';
import {descriptors,descriptorKey,viewKey,systemSummary,criticalText,observationText} from './beacon-model.mjs';

/** Persistent keyboard/touch controls for server-permitted beacon descriptors. */
export function createBeaconPanel({id,action,stop,feedback,change=()=>{}}){
 const node=dom('section','lw-beacon'),toggle=control('Systems & evidence',()=>setOpen(!open),'lw-beacon-toggle'),pane=dom('section','lw-beacon-pane'),heading=dom('h2','','BEACON SYSTEMS'),summary=dom('p','lw-beacon-status'),critical=dom('p','lw-beacon-critical'),transit=dom('p','lw-beacon-transit'),session=dom('p','lw-beacon-session'),controls=dom('div','lw-beacon-controls'),empty=dom('p'),observations=dom('ol','lw-beacon-observations'),close=control('Close systems',()=>setOpen(false),'lw-secondary');
 pane.id=`${id}-systems`;pane.hidden=true;pane.setAttribute('aria-label','Systems, devices and hatch routes');toggle.setAttribute('aria-controls',pane.id);toggle.setAttribute('aria-expanded','false');summary.setAttribute('role','status');session.setAttribute('role','status');observations.setAttribute('aria-label','Your sampled device observations');pane.append(heading,summary,critical,transit,session,controls,empty,dom('h3','','YOUR OBSERVATIONS'),dom('p','','Samples describe the recorded time. They are not live tracking.'),observations,close);node.append(toggle,pane);
 let room=null,options={},open=false,disposed=false,generation=0,busy=false,lastIdentity=null;
 const rows=new Map(),samples=new Map();
 function setOpen(value){open=value;pane.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(!open){generation++;restoreTrigger(toggle);}else{update(room,options);Promise.resolve(stop()).catch(()=>{});close.focus();}change();}
 pane.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);}});
 function current(h,key,origin){return !disposed&&!document.hidden&&generation===origin&&viewKey(room)===key&&room?.game?.phase==='roam'&&room.game.self?.alive&&!room.game.systems?.selfTransit&&descriptors(room.game).some(next=>descriptorKey(next)===descriptorKey(h)&&next.enabled===true);}
 async function send(id){
  const h=descriptors(room?.game).find(h=>h.id===id);if(!h||busy||options.pending)return;
  if(!options.connected){feedback('Reconnect before using beacon equipment.');return;}
  if(h.enabled!==true){feedback(h.reason||'This action is unavailable.');return;}
  const key=viewKey(room),origin=generation,fields={...h.fields};if(!current(h,key,origin))return;
  busy=true;update(room,options);
  try{await stop();if(!current(h,key,origin))return;await action(h.type,fields);}catch(error){if(current(h,key,origin)&&error?.name!=='AbortError')feedback(error?.message||'Beacon action failed. Try again.');}finally{busy=false;if(!disposed)update(room,options);}
 }
 function update(next,nextOptions={}){
  if(disposed)return;room=next;options=nextOptions;const game=room?.game,identity=JSON.stringify([room?.roomId,game?.matchId,game?.phase,game?.self?.id]);
  if(lastIdentity!==identity){generation++;if(lastIdentity!==null){open=false;pane.hidden=true;toggle.setAttribute('aria-expanded','false');}lastIdentity=identity;samples.clear();observations.replaceChildren();}
  node.hidden=game?.beaconVersion!==1;if(node.hidden)return;
  setText(summary,systemSummary(game));setText(critical,game.sabotage?.active?`${clock(game.sabotage.deadlineAt,options.now)} remaining. ${criticalText(game)}`:'');critical.hidden=!game.sabotage?.active;
  const travel=game.systems?.selfTransit;transit.hidden=!travel;setText(transit,travel?`Hatch transit${travel.exitId?' to '+travel.exitId:''}${Number.isFinite(travel.deadlineAt)?' - '+clock(travel.deadlineAt,options.now)+' remaining':''}. Walking and equipment unavailable.`:'');
  const read=game.investigation?.session;setText(session,read?`Reading ${read.deviceId||'terminal'}${Number.isFinite(read.deadlineAt)?' - '+clock(read.deadlineAt,options.now)+' remaining':''}. Stay at the device. Movement, council or communications loss can cancel the read.`:`Devices: ${game.investigation?.status||'status unavailable'}.`);
  const hints=descriptors(game),ids=new Set(hints.map(h=>h.id));
  for(const [id,row]of rows)if(!ids.has(id)){const focused=row.node.contains(document.activeElement);row.node.remove();rows.delete(id);if(focused&&open)restoreTrigger(close);}
  for(const h of hints){let row=rows.get(h.id);if(!row){const node=dom('div','lw-beacon-control'),button=control('',()=>send(h.id)),reason=dom('span');node.append(button,reason);controls.append(node);row={node,button,reason};rows.set(h.id,row);}setText(row.button,h.label||h.type);row.button.dataset.beaconAction=h.type;row.button.dataset.interactionId=h.id;row.button.disabled=busy||!!options.pending;row.button.setAttribute('aria-disabled',String(h.enabled!==true||!options.connected||row.button.disabled));setText(row.reason,h.enabled===true?'':h.reason||'Unavailable');}
  empty.hidden=hints.length>0;setText(empty,!game.self?'Observing only. No private equipment access.':game.phase!=='roam'?'Equipment is unavailable during this phase.':'No permitted actions here. Approach a device, repair site or hatch.');
  for(const [index,sample]of (game.investigation?.observations||[]).entries()){const key=sample.id||`${sample.deviceId}:${sample.at}:${index}`;if(samples.has(key))continue;const li=dom('li','',observationText(sample,game.players));observations.append(li);samples.set(key,li);}
  const sampleIds=new Set((game.investigation?.observations||[]).map((s,i)=>s.id||`${s.deviceId}:${s.at}:${i}`));for(const [key,li]of samples)if(!sampleIds.has(key)){li.remove();samples.delete(key);}
 }
 return {node,update,suspend(){generation++;},close(){setOpen(false);},get open(){return open;},dispose(){disposed=true;generation++;node.remove();}};
}
