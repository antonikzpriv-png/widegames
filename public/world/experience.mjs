import * as world from '../../shared/world.mjs';
import {CHARACTERS} from '../../shared/contracts.mjs';
import {aiLabel,clock,contexts,point,roleLabel,visiblePlayers} from './model.mjs';
import {createWorldScene,drawKeeper} from './scene.mjs';
import {createWorldInput} from './input.mjs';

const roomName=id=>({bridge:'Bridge',archive:'Archive',lantern:'Lantern',workshop:'Workshop',galley:'Galley',engine:'Engine'})[id]||'At sea';
const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn,className='')=>{const b=make('button',className,text);b.type='button';b.addEventListener('click',fn);return b;};
const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
let instance=0;

/** A safe-view-only game surface. The owner supplies networking and request IDs. */
export function createWorldExperience(host,callbacks){
 const uid=`lw-world-${++instance}`,shell=make('section','lw-world'),canvas=make('canvas','lw-world-canvas');
 shell.setAttribute('aria-label','Lantern Wake game');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Storm beacon world');canvas.tabIndex=0;
 const stage=make('div','lw-stage');stage.append(canvas);
 const top=make('header','lw-topbar'),brand=make('div','lw-brand','LANTERN WAKE'),mode=make('span','lw-ai'),status=make('span','lw-connection'),leave=button('Exit',()=>{input.stop();callbacks.leave();},'lw-exit');
 status.setAttribute('role','status');top.append(brand,mode,status,leave);
 const progress=make('div','lw-progress'),progressLabel=make('span','','CREW TASKS'),meter=make('progress'),progressCount=make('span');meter.max=1;meter.value=0;meter.setAttribute('aria-label','Crew tasks complete');progress.append(progressLabel,meter,progressCount);
 const assignment=make('aside','lw-assignment'),role=make('strong','lw-role'),location=make('span','lw-location'),taskList=make('ul','lw-tasks'),help=make('p','lw-help','WASD / arrows to walk · E use · R report · Q eliminate · M map');assignment.append(role,location,taskList,help);
 const taskRows=new Map();
 const critical=make('div','lw-critical');critical.hidden=true;critical.setAttribute('role','region');critical.setAttribute('aria-label','Critical countdown');
 const criticalTitle=make('strong','','BEACON FAILURE'),criticalClock=make('span','lw-critical-clock'),criticalInfo=make('span');criticalClock.setAttribute('role','timer');criticalClock.setAttribute('aria-label','Critical time remaining');critical.append(criticalTitle,criticalClock,criticalInfo);
 const phaseClock=make('span','lw-phase-clock');phaseClock.setAttribute('role','timer');phaseClock.setAttribute('aria-label','Phase time remaining');
 const feedback=make('p','lw-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const actions=make('nav','lw-actions');actions.setAttribute('aria-label','Context actions');const actionButtons={};
 for(const [key,title,hotkey,icon] of [['use','USE','E','✦'],['report','REPORT','R','!'],['eliminate','ELIMINATE','Q','×'],['sabotage','SABOTAGE','','ϟ']]){
  const b=button('',()=>activate(key),`lw-action lw-action-${key}`),symbol=make('span','lw-action-icon',icon),label=make('span','lw-action-label',title),kbd=make('kbd','',hotkey);b.append(symbol,label,kbd);b.dataset.worldAction=key;actions.append(b);actionButtons[key]=b;
 }
 const joystick=make('div','lw-joystick'),knob=make('div','lw-joystick-knob');joystick.append(knob);joystick.setAttribute('aria-hidden','true');
 const mapToggle=button('Map  M',()=>toggleMap(),'lw-map-toggle');mapToggle.setAttribute('aria-expanded','false');
 const mapPane=make('section','lw-map-pane'),mapHeading=make('h2','','Platform map'),mapCanvas=make('canvas','lw-mini-map');mapPane.hidden=true;mapPane.id=`${uid}-map`;mapToggle.setAttribute('aria-controls',mapPane.id);mapCanvas.setAttribute('role','img');mapCanvas.setAttribute('aria-label','Known platform layout and currently visible keepers');mapPane.append(mapHeading,mapCanvas,make('p','','Map shows only positions supplied by the server.'));
 const lobby=make('section','lw-lobby'),lobbyTitle=make('h1','','KEEP THE LIGHT.'),lobbySub=make('p','','Six keepers. One hidden saboteur. A storm that won’t wait.'),roster=make('div','lw-lobby-roster'),start=button('Begin the watch',()=>request(()=>callbacks.start()),'lw-primary');
 for(const p of CHARACTERS){const card=make('div','lw-seat'),avatar=make('canvas');avatar.width=80;avatar.height=94;drawKeeper(avatar.getContext('2d'),p,40,64,{scale:1,label:false});card.append(avatar,make('span','',p.name));roster.append(card);}
 const lobbyNote=make('p','lw-lobby-note');lobby.append(make('p','lw-eyebrow','STORM BEACON · SIX KEEPER WATCH'),lobbyTitle,lobbySub,roster,start,lobbyNote);
 const overlay=make('div','lw-scene-overlay');overlay.hidden=true;
 const roleScene=make('section','lw-role-scene');roleScene.hidden=true;roleScene.setAttribute('role','dialog');roleScene.setAttribute('aria-modal','true');roleScene.setAttribute('aria-labelledby',`${uid}-role-title`);
 const revealArt=make('canvas','lw-reveal-keeper');revealArt.width=240;revealArt.height=250;
 const revealTitle=make('h1');revealTitle.id=`${uid}-role-title`;const revealCopy=make('p'),revealClose=button('Enter the beacon',()=>{revealed.add(room.game.matchId);roleScene.hidden=true;render();canvas.focus();},'lw-primary');roleScene.append(make('p','lw-eyebrow','YOUR SECRET ASSIGNMENT'),revealArt,revealTitle,revealCopy,revealClose);
 stage.append(top,progress,assignment,critical,phaseClock,feedback,mapToggle,mapPane,joystick,actions,lobby,overlay,roleScene);shell.append(stage);host.append(shell);
 let room=null,options={now:Date.now(),connected:false,pending:false,feedback:''},disposed=false,localPending=0,lastRoom=null,raf=0,mapOpen=false,localFeedback='',lastFeedback='',lastRole=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),scene=createWorldScene(canvas,{reduced:reduced.matches}),mini=createWorldScene(mapCanvas,{reduced:true}),revealed=new Set();
 const input=createWorldInput({target:canvas,joystick,knob,getState:()=>({enabled:movementAllowed(),position:room?.game?.self?.position,inputSeq:room?.game?.self?.inputSeq||0}),onInput:value=>callbacks.input(value),onClick:e=>{const target=scene.toWorld(e.clientX,e.clientY),position=room?.game?.self?.position;const path=world.findWorldPath(position,target);if(!path)setFeedback('That route is blocked. Choose a clear part of the deck.');return path;},onShortcut:key=>{if(key==='m')toggleMap();else activate(({e:'use',' ':'use',q:'eliminate',r:'report'})[key]);},onError:error=>setFeedback(error?.message||'Movement could not be sent. Reconnect and try again.')});
 function movementAllowed(){return !!room?.game?.self?.alive&&room.game.worldVersion===1&&room.game.phase==='roam'&&options.connected&&!pending()&&roleScene.hidden&&overlay.hidden;}
 function pending(){return options.pending||localPending>0;}
 function setFeedback(message){localFeedback=String(message||'');setText(feedback,localFeedback);}
 async function request(fn){if(disposed||pending())return;localPending++;render();try{return await fn();}catch(error){if(!disposed)setFeedback(error?.message||'The request failed. Try again.');}finally{if(!disposed){localPending--;render();}}}
 function toggleMap(){mapOpen=!mapOpen;mapPane.hidden=!mapOpen;mapToggle.setAttribute('aria-expanded',String(mapOpen));if(mapOpen){mini.update(room,performance.now());mini.draw(performance.now(),{overview:true});}}
 function activate(key){
  if(disposed||!room?.game||!roleScene.hidden||!overlay.hidden)return;
  const context=contexts(room.game,world)[key];if(!context)return;
  if(!options.connected){setFeedback('Connection interrupted. Reconnect before acting.');return;}
  if(pending()||!context.enabled){setFeedback(pending()?'An action is still being sent.':context.hint);return;}
  input.stop();
  if(context.type==='task'){setFeedback(`${context.label}: station ready.`);return;}
  request(()=>callbacks.action(context.type,context.fields));
 }
 function render(){
  if(!room||disposed)return;const game=room.game,isLobby=!game;
  shell.dataset.phase=game?.phase||'lobby';lobby.hidden=!isLobby;assignment.hidden=isLobby;progress.hidden=isLobby;actions.hidden=isLobby||game.phase!=='roam'||!game.self?.alive;joystick.hidden=!movementAllowed();
  setText(mode,aiLabel(room.ai));setText(status,options.connected?'● Connected':'○ Reconnecting');status.dataset.connected=String(!!options.connected);
  setText(lobbyNote,room.isHost?'You host this room. All six keepers are aboard.':'You are observing. The host will begin the watch.');start.disabled=!room.isHost||pending()||!options.connected;
  setText(role,roleLabel(game));role.dataset.role=game?.self?.role||'spectator';setText(location,game?.self?`${game.self.alive?'':'Fallen · '}${roomName(game.self.roomId)}`:'Public observation · roles hidden');
  const tasks=game?.self?.tasks||[],ids=new Set(tasks.map(t=>t.id));
  for(const [id,node]of taskRows)if(!ids.has(id)){node.remove();taskRows.delete(id);}
  for(const task of tasks){let li=taskRows.get(task.id);if(!li){li=make('li');taskRows.set(task.id,li);taskList.append(li);}setText(li,`${task.completed?'✓':'◇'} ${task.label} · ${roomName(task.roomId)}`);li.dataset.complete=String(task.completed);}
  meter.max=game?.tasks?.total||1;meter.value=game?.tasks?.completed||0;setText(progressCount,`${game?.tasks?.completed||0} / ${game?.tasks?.total||0}`);
  critical.hidden=!game?.sabotage?.active;setText(criticalClock,clock(game?.sabotage?.deadlineAt,options.now));setText(criticalInfo,`${roomName(game?.sabotage?.roomId)} · ${game?.sabotage?.repairsCompleted||0}/${game?.sabotage?.repairsRequired||0} repairs · continues through council`);
  phaseClock.hidden=!game?.deadlineAt;setText(phaseClock,`${game?.phase==='roam'?'Watch':'Council'} ${clock(game?.deadlineAt,options.now)}`);
  const current=contexts(game,world);
  for(const [key,b]of Object.entries(actionButtons)){const c=current[key];b.hidden=['eliminate','sabotage'].includes(key)&&game?.self?.role!=='saboteur';b.setAttribute('aria-disabled',String(!c.enabled||pending()||!options.connected));b.title=c.enabled?c.label:c.hint;b.setAttribute('aria-label',`${c.label}${key==='use'?' (E / Space)':key==='report'?' (R)':key==='eliminate'?' (Q)':''}`);}
  canvas.setAttribute('aria-label',isLobby?'Six raincoat keepers gathered on the storm beacon.':`${roomName(game?.self?.roomId)}. Visible keepers: ${visiblePlayers(game).map(p=>p.name).join(', ')||'none'}. Use keyboard or click the deck to walk.`);
  const showRole=game?.phase==='roam'&&game.self&&!revealed.has(game.matchId);
  roleScene.hidden=!showRole;
  if(showRole&&lastRole!==game.matchId){lastRole=game.matchId;setText(revealTitle,`YOU ARE ${game.self.role==='saboteur'?'THE SABOTEUR':'CREW'}`);setText(revealCopy,game.self.role==='saboteur'?'Hide in the rain. Sabotage the beacon, mislead the council, and outlast the crew.':'Keep the beacon alive. Complete your stations, report fallen keepers, and find the saboteur.');roleScene.dataset.role=game.self.role;const art=revealArt.getContext('2d');art.clearRect(0,0,240,250);drawKeeper(art,game.players.find(p=>p.id===game.self.id)||CHARACTERS[0],120,180,{scale:2.6,label:false});revealClose.focus();}
  if(!showRole)roleScene.hidden=true;
  if(options.feedback&&options.feedback!==lastFeedback){lastFeedback=options.feedback;localFeedback=String(options.feedback);}
  setText(feedback,localFeedback||room.notices?.at(-1)?.message||'');
  input.sync();
 }
 function frame(now){if(disposed||document.hidden)return;scene.draw(now);if(mapOpen)mini.draw(now,{overview:true});raf=requestAnimationFrame(frame);}
 function visibility(){if(document.hidden){cancelAnimationFrame(raf);input.stop();}else if(!disposed){scene.draw(performance.now());raf=requestAnimationFrame(frame);}}
 document.addEventListener('visibilitychange',visibility);raf=requestAnimationFrame(frame);
 return {update(next,nextOptions={}){if(disposed)return;if(lastRoom&&lastRoom!==next.roomId){input.stop();revealed.clear();localFeedback='';lastRole=null;}lastRoom=next.roomId;room=next;options={...options,...nextOptions};scene.update(room,performance.now());mini.update(room,performance.now());render();},dispose(){if(disposed)return;input.dispose();disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);scene.dispose();mini.dispose();shell.remove();}};
}
