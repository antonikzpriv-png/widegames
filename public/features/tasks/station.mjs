import {dom,control,setText,trapDialog} from '../../world/dom.mjs';
import {isStationTask} from '../../../shared/station-contract.mjs';
const glyph=Object.fromEntries(Object.entries({beacon:0x25c7,wave:0x224b,star:0x2606,bolt:0x03df,anchor:0x2693,sun:0x2600}).map(([k,v])=>[k,String.fromCodePoint(v)]));
const directions=['North','East','South','West'];
const identity=task=>JSON.stringify([task?.id,task?.challenge?.version,task?.challenge?.kind,task?.challenge?.puzzle]);
/** Only server-projected progress changes confirmed state. No solved flag. */
export function createStationPuzzle({task,onSubmit,onClose,id}){
 let current=task,closed=false,revoked=false,busy=false,externalPending=false,connected=true,selected=null,generation=0,message='',progressKey=null,lastFocus=null;
 const signature=identity(task),challenge=task.challenge,kind=challenge?.kind;
 const node=dom('section','lw-task-modal lw-station-modal');node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-labelledby',id+'-station-title');node.tabIndex=-1;
 const top=dom('div','lw-modal-title'),close=control('Close station',()=>{if(!closed)onClose();},'lw-close'),title=dom('h2','',task.label);title.id=id+'-station-title';top.append(dom('p','lw-eyebrow','FIELD STATION'),close);
 const copy=dom('p','lw-task-instruction'),area=dom('div','lw-station-equipment'),status=dom('p','lw-puzzle-status'),meter=dom('progress','lw-station-progress'),caption=dom('p','lw-station-caption','Only confirmed server inputs restore the station. Closing, leaving or council revokes this equipment.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');meter.setAttribute('aria-label','Server-confirmed station progress');node.append(top,title,copy,area,meter,status,caption);
 const controls=[],paintControls=[];
 const values=()=>current?.challenge?.progress?.values||[];
 const add=(parent,text,handler,label)=>{const button=control(text,handler,'lw-station-control');if(label)button.setAttribute('aria-label',label);controls.push(button);parent.append(button);return button;};
 const symbol=name=>`${glyph[name]||''} ${name}`;
 function paint(){
  const v=values(),complete=!!current.completed,disabled=closed||revoked||busy||externalPending||!connected||complete;
  for(const button of controls)button.disabled=disabled;
  for(const draw of paintControls)draw(v,disabled);
  const total=kind==='circuit'?challenge.puzzle.left.length:kind==='signal'?1:kind==='sequence'?challenge.puzzle.order.length:kind==='alignment'?challenge.puzzle.dials.length:kind==='manifolds'?challenge.puzzle.valves.length:(challenge.puzzle.tiles.filter(t=>t.symbol===challenge.puzzle.target).length+1);
  meter.max=total;meter.value=kind==='glyphs'?v.filter(token=>challenge.puzzle.tiles.some(t=>t.id===token&&t.symbol===challenge.puzzle.target)).length+(v.includes('verified')?1:0):v.length;
  if(lastFocus&&!disabled){const active=document.activeElement;if(active===document.body||active===lastFocus){const next=lastFocus.disabled?controls.find(c=>!c.disabled):lastFocus;if(next?.isConnected)next.focus();}lastFocus=null;}
  setText(status,message||(complete?'Station restored. Server confirmed.':!connected?'Reconnect before using this station.':busy||externalPending?'Awaiting server confirmation.':`${meter.value} of ${total} inputs confirmed.`));
 }
 async function send(interactionId,value){
  if(closed||revoked||document.hidden||busy||externalPending||!connected||current.completed)return;
  const origin=generation;lastFocus=node.contains(document.activeElement)?document.activeElement:null;busy=true;message='';paint();
  try{await onSubmit({interactionId,value:String(value)});}catch(error){if(!closed&&origin===generation&&error?.name!=='AbortError')message=error?.message||'Input was not confirmed. Try again.';}
  finally{busy=false;if(!closed)paint();}
 }
 node.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(!closed)onClose();}else trapDialog(node,event);});
 const p=challenge?.puzzle;
 if(!isStationTask(task)||!p||!Array.isArray(challenge.progress?.values)){
  copy.textContent='This station challenge version is unavailable. Close the equipment and reconnect with a compatible client.';area.hidden=meter.hidden=true;
  return {node,focus(){close.focus();},setPending(){},update(){return false;},dispose(){closed=true;generation++;node.remove();}};
 }
 if(kind==='circuit'){
  copy.textContent='Connect matching symbols. Choose a left cable, then the right socket with the same name and shape. Color is not required.';
  const left=dom('div','lw-station-column'),right=dom('div','lw-station-column');area.className+=' lw-station-circuit';area.append(left,right);
  for(const cable of p.left){const button=add(left,symbol(cable.symbol),()=>{selected=cable.id;message=`${cable.symbol} cable selected. Choose its matching right socket.`;paint();},'Cable '+cable.symbol);paintControls.push((v,disabled)=>{button.disabled=disabled||v.some(t=>t.startsWith(cable.id+':'));button.setAttribute('aria-pressed',String(selected===cable.id));});}
  for(const socket of p.right){const button=add(right,symbol(socket.symbol),()=>{if(!selected){message='Choose a left cable first.';paint();return;}send('connect',selected+':'+socket.id);},'Socket '+socket.symbol);paintControls.push((v,disabled)=>{button.disabled=disabled||v.some(t=>t.endsWith(':'+socket.id));});}
 }else if(kind==='signal'){
  copy.textContent=`Calibrate the receiver to ${p.target} ${p.unit}. Use the slider or arrow keys, then transmit the displayed value.`;
  const label=dom('label','','Frequency'),slider=dom('input','lw-station-slider'),output=dom('output','lw-station-value');slider.type='range';slider.min=p.min;slider.max=p.max;slider.step=1;slider.value=p.min;slider.id=id+'-station-signal';label.htmlFor=slider.id;output.htmlFor=slider.id;
  const display=()=>setText(output,`${slider.value} ${p.unit} / target ${p.target}`);slider.addEventListener('input',display);display();area.append(label,output,slider);controls.push(slider);add(area,'Transmit frequency',()=>send('tune',slider.value));
 }else if(kind==='sequence'){
  copy.textContent='Restore the storm record in the displayed order. Each step is confirmed by the station.';area.append(dom('p','lw-station-order',p.order.join(' > ')));const grid=dom('div','lw-station-grid');area.append(grid);
  for(const choice of p.choices){const button=add(grid,choice,()=>send('press',choice),'Record tile '+choice);paintControls.push(v=>{button.dataset.confirmed=String(v.includes(choice));});}
 }else if(kind==='glyphs'){
  copy.textContent=`Select every ${p.target} tile, then verify the selection. Tap a tile to select or clear it, then verify your choices.`;
  const grid=dom('div','lw-station-grid lw-station-glyphs');area.append(grid);
  for(const tile of p.tiles){const button=add(grid,symbol(tile.symbol),()=>send('toggle',tile.id),`Inspection tile ${Number(tile.id.slice(1))+1}: ${tile.symbol}`);paintControls.push(v=>{button.setAttribute('aria-pressed',String(v.includes(tile.id)));});}
  add(area,'Verify selected glyphs',()=>send('submit','verify'));
 }else if(kind==='alignment'){
  copy.textContent='Align each rotor with its displayed compass target. Select a direction, then lock that rotor.';area.className+=' lw-station-rotors';
  for(const dial of p.dials){const card=dom('div','lw-station-rotor'),label=dom('label','',`Rotor ${Number(dial.id.slice(1))+1} - target ${directions[dial.target]}`),select=dom('select','lw-station-direction');select.id=id+'-'+dial.id;label.htmlFor=select.id;for(const [index,name]of directions.entries()){const option=dom('option','',name);option.value=index;select.append(option);}select.value=dial.start;card.append(label,select);controls.push(select);const lock=add(card,'Lock rotor',()=>send('align',dial.id+':'+select.value),'Lock rotor '+(Number(dial.id.slice(1))+1));paintControls.push((v,disabled)=>{const confirmed=v.some(t=>t.startsWith(dial.id+':'));select.disabled=lock.disabled=disabled||confirmed;card.dataset.confirmed=String(confirmed);});area.append(card);}
 }else if(kind==='manifolds'){
  copy.textContent='Open the numbered pressure valves from lowest to highest. A valve locks only after server confirmation.';const grid=dom('div','lw-station-grid');area.append(grid);
  for(const valve of p.valves){const button=add(grid,'Valve '+valve.value,()=>send('open',valve.id),'Pressure valve '+valve.value);paintControls.push((v,disabled)=>{button.disabled=disabled||v.includes(valve.id);button.dataset.confirmed=String(v.includes(valve.id));});}
 }
 const api={node,focus(){close.focus();},setPending(value){externalPending=!!value;if(!closed)paint();},update(next,options={}){
  if(closed)return false;if(revoked)return false;if(identity(next)!==signature){revoked=true;generation++;controls.forEach(b=>b.disabled=true);setText(status,'Station challenge changed. Close and reopen this equipment.');return false;}
  const key=JSON.stringify(next.challenge.progress);if(progressKey!==null&&key!==progressKey){generation++;message='';if(kind==='circuit'&&next.challenge.progress.values.some(t=>t.startsWith(selected+':')))selected=null;}progressKey=key;current=next;if(options.pending!==undefined)externalPending=!!options.pending;if(options.connected!==undefined)connected=!!options.connected;paint();return true;
 },dispose(){closed=true;generation++;node.remove();}};api.update(task);return api;
}
