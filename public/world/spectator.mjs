import {keeperLabel} from '../presentation.mjs';
import {getMap} from '../../shared/maps/index.mjs';
import {mapReference} from './map-model.mjs';
import {knowledge} from './beacon-model.mjs';

const directions=new Map([['w',[0,-1]],['arrowup',[0,-1]],['s',[0,1]],['arrowdown',[0,1]],['a',[-1,0]],['arrowleft',[-1,0]],['d',[1,0]],['arrowright',[1,0]]]);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const point=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y);
const title=value=>String(value||'Unknown').replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};

/** Local camera controls. This controller has no network or gameplay callbacks. */
export function createSpectatorInput({target,joystick,knob,getState,onMove,onClick,win=window,doc=document}){
 let disposed=false,lastFrame=null,pointer=null,stick=null;const keys=new Set();
 const enabled=()=>!disposed&&!doc.hidden&&getState().enabled;
 const typing=event=>event.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"],.lw-inspector');
 function stop(){keys.clear();stick=null;pointer=null;lastFrame=null;if(knob)knob.style.transform='translate(0px,0px)';}
 function keydown(event){const key=event.key.toLowerCase();if(!directions.has(key)||event.defaultPrevented||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||typing(event)||!enabled())return;event.preventDefault();keys.add(key);}
 function keyup(event){if(keys.delete(event.key.toLowerCase()))event.preventDefault();}
 function click(event){if(enabled()&&event.button===0)onClick(event);}
 function stickMove(event){if(pointer!==event.pointerId||!enabled())return;const rect=joystick.getBoundingClientRect(),x=event.clientX-rect.left-rect.width/2,y=event.clientY-rect.top-rect.height/2,length=Math.hypot(x,y);stick=length<9?{dx:0,dy:0}:{dx:x/length,dy:y/length};if(knob)knob.style.transform=`translate(${x/(length||1)*Math.min(38,length)}px,${y/(length||1)*Math.min(38,length)}px)`;}
 function stickDown(event){if(!enabled())return;event.preventDefault();pointer=event.pointerId;keys.clear();joystick.setPointerCapture?.(pointer);stickMove(event);}
 function stickEnd(event){if(pointer===event.pointerId)stop();}
 function visibility(){if(doc.hidden)stop();}
 win.addEventListener('keydown',keydown);win.addEventListener('keyup',keyup);win.addEventListener('blur',stop);doc.addEventListener('visibilitychange',visibility);target.addEventListener('click',click);
 joystick?.addEventListener('pointerdown',stickDown);joystick?.addEventListener('pointermove',stickMove);for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick?.addEventListener(type,stickEnd);
 return {stop,step(now){if(!enabled()){stop();return;}const elapsed=lastFrame===null?0:clamp(now-lastFrame,0,50);lastFrame=now;let dx=0,dy=0;for(const key of keys){const vector=directions.get(key);dx+=vector[0];dy+=vector[1];}if(stick){dx=stick.dx;dy=stick.dy;}const length=Math.hypot(dx,dy);if(length&&elapsed)onMove({dx:dx/length,dy:dy/length},elapsed);},dispose(){if(disposed)return;stop();disposed=true;win.removeEventListener('keydown',keydown);win.removeEventListener('keyup',keyup);win.removeEventListener('blur',stop);doc.removeEventListener('visibilitychange',visibility);target.removeEventListener('click',click);joystick?.removeEventListener('pointerdown',stickDown);joystick?.removeEventListener('pointermove',stickMove);for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick?.removeEventListener(type,stickEnd);}};
}

/** Narrow observer data only; a human-room observer falls back to its safe public view. */
export function observerAgents(game){return !game?.self&&game?.inspection?.mode==='all-ai-observer'&&game.inspection.matchId===game.matchId&&Array.isArray(game.inspection.agents)?game.inspection.agents:[];}

/** A local drawing projection of an explicitly supplied owner inspection. No
 * request, credential, hidden engine state or inferred unseen death is read. */
export function observerGame(game){
 const agents=observerAgents(game);if(!agents.length)return game;
 const byId=new Map(agents.map(a=>[a.id,a]));
 return {...game,vision:null,players:(game.players||[]).map(p=>{const a=byId.get(p.id);return a?{...p,alive:a.alive,ghost:a.ghost===true,status:a.alive===true?'alive':a.alive===false?'dead':'unknown',roomId:a.roomId,position:point(a.position)?{x:a.position.x,y:a.position.y}:null,moving:a.moving===true,...(['crew','saboteur'].includes(a.role)?{role:a.role}:{})}:p;})};
}

/** Pure descriptions also power keyboard object selection; no raw model context is read. */
export function describeSpectatorSelection(game,selection){
 if(!game||game.self||!selection)return null;
 let map;try{map=getMap(mapReference({game}));}catch{return null;}const geometry=map.geometry;
 const roomName=id=>map.roomLayout?.find(room=>room.id===id)?.name||game.rooms?.find(room=>room.id===id)?.name||geometry.WORLD_ROOMS.find(room=>room.id===id)?.name||(geometry.WORLD_ROOMS.some(room=>room.id===id)?title(id):'In transit');
 const agents=observerAgents(game),player=game.players?.find(p=>p.id===selection.id),agent=agents.find(p=>p.id===selection.id),facts=[],sections=[];
 const result={title:'World object',description:'Read-only observation.',facts,sections};
 if(selection.type==='player'){
  if(!player)return null;result.title=keeperLabel(player);const current=agent||player;if(point(current.position))result.followId=player.id;
  result.description=agent?'Private owner observatory - omniscient all-AI inspection. These fields are server-supplied; agents keep their own permitted views.':'Public observer details. Private owner inspection is unavailable. Only this server-permitted feed is shown; private roles and tasks remain hidden.';
  facts.push(['Role',agent?.role||player.role||'Hidden'],['Status',current.ghost?'Fallen ghost':(agent?(current.alive===true?'On watch':current.alive===false?'Fallen':'Status unknown'):({alive:'On watch',dead:'Fallen',unknown:'Status unknown'})[knowledge(game,player)])],['Location',point(current.position)?roomName(current.roomId):'Location unavailable']);
  if(point(current.position))facts.push(['Position',`${current.position.x.toFixed(1)}, ${current.position.y.toFixed(1)}`]);
  if(agent){
   if(agent.ability)facts.push(['Ability',title(agent.ability.type)]);
   const readiness=at=>Number.isFinite(game.serverNow)?at<=game.serverNow?'Ready':`${Math.ceil((at-game.serverNow)/1000)}s remaining`:`Ready at ${at}`;
   const cooldownNames={moveAt:'Room route',taskAt:'Task equipment',killAt:'Elimination',sabotageAt:'Sabotage',meetingAt:'Emergency bell'};
   const cooldowns=Object.entries(agent.cooldowns||{}).filter(([key,at])=>Object.hasOwn(cooldownNames,key)&&Number.isFinite(at)).map(([key,at])=>`${cooldownNames[key]} · ${readiness(at)}`);
   if(agent.ability&&Number.isFinite(agent.ability.readyAt))cooldowns.push(`${title(agent.ability.type)} · ${readiness(agent.ability.readyAt)}`);
   if(cooldowns.length)sections.push({title:'Cooldowns',lines:cooldowns});
   if(Number.isInteger(agent.meetingsRemaining))facts.push(['Emergency calls left',String(agent.meetingsRemaining)]);
   if(point(agent.destination))facts.push(['Recorded destination',`${agent.destination.x.toFixed(1)}, ${agent.destination.y.toFixed(1)}`]);
   const activity=agent.activity;
   if(Number.isFinite(game.inspection?.updatedAt))facts.push(['Inspection snapshot at',String(game.inspection.updatedAt)]);
   sections.push({title:'Current activity',lines:[activity?.label||'No current activity recorded.',activity?.source==='recorded-action'?'Source: accepted recorded action.':'Source: recorded state.',"Private thoughts are unavailable. Activity is not a statement of the agent’s reasoning."]});
   const plan=agent.plan;
   sections.push({title:'Selected plan (recorded controller state)',lines:plan?[plan.label||'Recorded plan',`Recorded at ${plan.recordedAt} · valid until ${plan.expiresAt}`,plan.notice||'Last selected plan; may no longer be current. This is not private thoughts.']:['No selected plan recorded.']});
   if(agent.tasks?.length)sections.push({title:'Tasks',lines:agent.tasks.map(task=>`${task.completed?'Complete':'Pending'} · ${task.label} · ${roomName(task.roomId)}${task.progress?` · ${task.progress.index}/${task.progress.total} confirmed steps`:''}`)});
   if(agent.recentActions?.length)sections.push({title:'Recent recorded actions',lines:agent.recentActions.slice(0,6).reverse().map(action=>`${action.at} · ${action.label||title(action.type)}`)});
  }else sections.push({title:'Current activity',lines:['Detailed activity is unavailable in this public spectator view.']});
  const claims=agent?.claims||(game.events||[]).filter(event=>event.type==='said'&&event.playerId===player.id).slice(-3).map(event=>({at:event.at,text:event.text||event.action?.text}));
  if(claims.length)sections.push({title:'Public claims',lines:claims.filter(claim=>typeof claim.text==='string').map(claim=>`${claim.at} · ${claim.text}`)});
  return result;
 }
 if(selection.type==='station'){
  const id=selection.roomId||Object.keys(geometry.WORLD_STATIONS).find(id=>geometry.WORLD_STATIONS[id].id===selection.id)||selection.id.replace(/^station-/,''),station=geometry.WORLD_STATIONS[id];if(!station)return null;result.title=`${roomName(id)} station`;result.description='Task equipment. Observing cannot solve or submit tasks.';
  const tasks=agents.flatMap(p=>(p.tasks||[]).filter(task=>task.roomId===id).map(task=>`${game.players.find(q=>q.id===p.id)?.name||p.id} · ${task.label} · ${task.completed?'complete':'pending'}`));
  facts.push(['Room',roomName(id)],['Position',`${station.x}, ${station.y}`]);
  if(game.sabotage?.active&&game.sabotage.roomId===id)facts.push(['Critical repairs',`${game.sabotage.repairsCompleted}/${game.sabotage.repairsRequired}`]);
  sections.push({title:'Assigned tasks',lines:tasks.length?tasks:['No task assignments available in this observer view.']});return result;
 }
 if(selection.type==='room'){
  const room=geometry.WORLD_ROOMS.find(p=>p.id===selection.id);if(!room)return null;result.title=roomName(room.id);result.description=`A room of ${geometry.metadata?.name||'the storm beacon'}.`;
  const occupants=(observerGame(game).players||[]).filter(p=>p.roomId===room.id&&point(p.position));facts.push(['Visible keepers',occupants.map(p=>p.name).join(', ')||'None'],['Task station',`${geometry.WORLD_STATIONS[room.id].x}, ${geometry.WORLD_STATIONS[room.id].y}`]);return result;
 }
 if(selection.type==='bell'){result.title='Emergency bell';const bellRoom=roomName(geometry.worldRoomAt(geometry.WORLD_BELL));result.description=`Living keepers can call council from ${bellRoom}. Observers cannot ring the bell.`;facts.push(['Location',bellRoom],['Council',game.meeting?title(game.phase):'Not in session']);return result;}
 if(selection.type==='body'){
  const event=(game.events||[]).find(event=>event.type==='body'&&(event.bodyId===selection.id||event.id===selection.id));if(!event||!point(event.position))return null;const id=event.playerId;result.title=`${game.players.find(p=>p.id===id)?.name||'Fallen keeper'} · body`;result.description='A recorded fallen keeper. The body stays at its recorded position.';if(event?.at!==undefined)facts.push(['Recorded at',String(event.at)]);return result;
 }
 if(selection.type==='effect'){
  const effect=(game.effects||[]).find(effect=>effect.id===selection.id);if(!effect)return null;result.title=effect.kind==='ward'?'Harbor Ward':'Signal Echo';result.description='A visible ability effect. An effect does not establish its issuer’s faction.';facts.push(['Type',title(effect.kind)]);if(Number.isFinite(effect.expiresAt))facts.push(['Recorded expiry',String(effect.expiresAt)]);return result;
 }
 if(selection.type==='decor'){const detail=(geometry.WORLD_DECOR||[]).find((item,index)=>(item.id||`decor-${index}`)===selection.id);if(!detail)return null;result.title=detail.text||title(detail.id||detail.kind);result.description='A visible map detail. Inspection does not interact with the match.';facts.push(['Type',title(detail.kind)],['Location',roomName(geometry.worldRoomAt(detail))]);return result;}
 if(selection.type==='obstacle'||selection.type==='prop'){const prop=geometry.WORLD_OBSTACLES.find(p=>p.id===selection.id);if(!prop)return null;result.title=prop.label||title(prop.id);result.description='Fixed beacon furniture. Spectator ghosts pass freely through walls and furniture.';facts.push(['Equipment',title(prop.kind||'furniture')],['Position',`${prop.x}, ${prop.y}`],['Footprint',`${prop.width} × ${prop.height}`]);const room=geometry.worldRoomAt({x:prop.x+prop.width/2,y:prop.y+prop.height/2});if(room)facts.push(['Room',roomName(room)]);return result;}
 return null;
}

export function createSpectatorInspector({onFollow,onClose}){
 const node=element('aside','lw-inspector'),head=element('header','lw-inspector-head'),heading=element('h2'),close=element('button','lw-inspector-close','×'),summary=element('p','lw-inspector-summary'),follow=element('button','lw-inspector-follow','Follow this keeper'),facts=element('dl','lw-inspector-facts'),sections=element('div','lw-inspector-sections');
 node.hidden=true;node.setAttribute('aria-label','World inspector');close.type=follow.type='button';close.setAttribute('aria-label','Close inspector');head.append(heading,close);node.append(head,summary,follow,facts,sections);
 let current=null,signature='',disposed=false;const shut=()=>{if(!disposed)onClose();};close.addEventListener('click',shut);node.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();shut();}});follow.addEventListener('click',()=>{if(!disposed&&current?.followId)onFollow(current.followId);});
 return {node,focus(){if(!disposed&&!node.hidden)close.focus();},update(game,selection){if(disposed)return;const next=describeSpectatorSelection(game,selection),key=JSON.stringify(next);if(signature===key)return;signature=key;current=next;node.hidden=!next;node.dataset.selection=selection?`${selection.type}:${selection.id}`:'';if(!next){heading.textContent=summary.textContent='';facts.replaceChildren();sections.replaceChildren();return;}heading.textContent=next.title;summary.textContent=next.description;follow.hidden=!next.followId;facts.replaceChildren();for(const [term,value]of next.facts)facts.append(element('dt','',term),element('dd','',value));sections.replaceChildren();for(const section of next.sections){const box=element('section','lw-inspector-section'),list=element('ul','lw-inspector-list');box.append(element('h3','',section.title),list);for(const line of section.lines)list.append(element('li','',line));sections.append(box);}},reset(){current=null;signature='';node.hidden=true;heading.textContent=summary.textContent='';facts.replaceChildren();sections.replaceChildren();},dispose(){disposed=true;current=null;node.remove();}};
}
