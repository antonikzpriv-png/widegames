import * as world from '../../shared/world.mjs';
import {CHARACTERS} from '../../shared/contracts.mjs';
import {aiLabel,clock,contexts,distance,point,roleLabel,taskKind,validTaskSession,visiblePlayers} from './model.mjs';
import {createWorldScene,drawKeeper} from './scene.mjs';
import {createWorldInput} from './input.mjs';
import {createTaskPuzzle} from './puzzles.mjs';
import {createCouncil,createResults} from './phases.mjs';
import {restoreTrigger,trapDialog} from './dom.mjs';
import {createBeaconPanel} from './beacon-panel.mjs';
import {knowledge,criticalText} from './beacon-model.mjs';

const roomName=id=>({bridge:'Bridge',archive:'Archive',lantern:'Lantern',workshop:'Workshop',galley:'Galley',engine:'Engine'})[id]||'At sea';
const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn,className='')=>{const b=make('button',className,text);b.type='button';b.addEventListener('click',fn);return b;};
const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
let instance=0;

/** A safe-view-only game surface. The owner supplies networking and request IDs. */
export function createWorldExperience(host,callbacks){
 if(document.head&&!document.querySelector('link[data-beacon-style]')){const link=make('link');link.rel='stylesheet';link.href='/world/beacon.css';link.setAttribute('data-beacon-style','');document.head.append(link);}
 const uid=`lw-world-${++instance}`,shell=make('section','lw-world'),canvas=make('canvas','lw-world-canvas');
 shell.setAttribute('aria-label','Lantern Wake game');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Storm beacon world');canvas.tabIndex=0;
 const stage=make('div','lw-stage');stage.append(canvas);
 const top=make('header','lw-topbar'),brand=make('div','lw-brand','LANTERN WAKE'),mode=make('span','lw-ai'),status=make('span','lw-connection'),leave=button('Exit',()=>{input.stop();callbacks.leave();},'lw-exit');
 status.setAttribute('role','status');top.append(brand,mode,status,leave);
 const progress=make('div','lw-progress'),progressLabel=make('span','','CREW TASKS'),meter=make('progress'),progressCount=make('span');meter.max=1;meter.value=0;meter.setAttribute('aria-label','Crew tasks complete');progress.append(progressLabel,meter,progressCount);
 const assignment=make('aside','lw-assignment'),role=make('strong','lw-role'),location=make('span','lw-location'),taskList=make('ul','lw-tasks'),help=make('p','lw-help');assignment.append(role,location,taskList,help);
 const aiNotice=make('p','lw-ai-notice');assignment.append(aiNotice);
 const taskRows=new Map();
 const critical=make('div','lw-critical');critical.hidden=true;critical.setAttribute('role','region');critical.setAttribute('aria-label','Critical countdown');
 const criticalTitle=make('strong','','BEACON FAILURE'),criticalClock=make('span','lw-critical-clock'),criticalInfo=make('span');criticalClock.setAttribute('role','timer');criticalClock.setAttribute('aria-label','Critical time remaining');critical.append(criticalTitle,criticalClock,criticalInfo);
 const phaseClock=make('span','lw-phase-clock');phaseClock.setAttribute('role','timer');phaseClock.setAttribute('aria-label','Phase time remaining');
 const feedback=make('p','lw-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const actions=make('nav','lw-actions');actions.setAttribute('aria-label','Context actions');const actionButtons={};
 for(const [key,title,hotkey,icon] of [['use','USE','E','\u2699\ufe0e'],['report','REPORT','R','!'],['eliminate','ELIMINATE','Q','×'],['sabotage','SABOTAGE','','\u26a1\ufe0e']]){
  const b=button('',()=>activate(key),`lw-action lw-action-${key}`),symbol=make('span','lw-action-icon',icon),label=make('span','lw-action-label',title),kbd=make('kbd','',hotkey);b.append(symbol,label,kbd);b.dataset.worldAction=key;actions.append(b);actionButtons[key]=b;
 }
 const joystick=make('div','lw-joystick'),knob=make('div','lw-joystick-knob');joystick.append(knob);joystick.setAttribute('aria-hidden','true');
 const mapToggle=button('Map  M',()=>toggleMap(),'lw-map-toggle');mapToggle.setAttribute('aria-expanded','false');
 const mapPane=make('section','lw-map-pane'),mapHeading=make('h2','','Platform map'),mapCanvas=make('canvas','lw-mini-map');mapPane.hidden=true;mapPane.id=`${uid}-map`;mapToggle.setAttribute('aria-controls',mapPane.id);mapCanvas.setAttribute('role','img');mapCanvas.setAttribute('aria-label','Known platform layout and currently visible keepers');mapPane.append(mapHeading,mapCanvas,make('p','','Map shows only positions supplied by the server.'));
 const lobby=make('section','lw-lobby'),lobbyTitle=make('h1','','KEEP THE LIGHT.'),lobbySub=make('p','','Keep the beacon alive. Hidden saboteurs may be aboard.'),roster=make('div','lw-lobby-roster'),start=button('Begin the watch',()=>request(()=>callbacks.start()),'lw-primary');
 const lobbyRows=new Map();
 const lobbyNote=make('p','lw-lobby-note');lobby.append(make('p','lw-eyebrow','STORM BEACON · KEEPER WATCH'),lobbyTitle,lobbySub,roster,start,lobbyNote);
 const overlay=make('div','lw-scene-overlay');overlay.hidden=true;
 const roleScene=make('section','lw-role-scene');roleScene.hidden=true;roleScene.setAttribute('role','dialog');roleScene.setAttribute('aria-modal','true');roleScene.setAttribute('aria-labelledby',`${uid}-role-title`);
 const revealArt=make('canvas','lw-reveal-keeper');revealArt.width=240;revealArt.height=250;
 const revealTitle=make('h1');revealTitle.id=`${uid}-role-title`;const revealCopy=make('p'),revealClose=button('Enter the beacon',()=>{revealed.add(room.game.matchId);roleScene.hidden=true;render();canvas.focus();},'lw-primary');roleScene.append(make('p','lw-eyebrow','YOUR SECRET ASSIGNMENT'),revealArt,revealTitle,revealCopy,revealClose);
 stage.append(top,progress,assignment,critical,phaseClock,feedback,mapToggle,mapPane,joystick,actions,lobby,overlay,roleScene);shell.append(stage);host.append(shell);
 let puzzle=null,taskSession=null,confirmTarget=null,ejectionKey=null,previousPhase=null,navigationEpoch=0;
 const seenEjections=new Set();
 let beaconPanel=null;
 let room=null,options={now:Date.now(),connected:false,pending:false,feedback:''},disposed=false,localPending=0,lastRoom=null,raf=0,mapOpen=false,localFeedback='',lastFeedback='',lastRole=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),scene=createWorldScene(canvas,{reduced:reduced.matches}),mini=createWorldScene(mapCanvas,{reduced:true}),revealed=new Set();
 const input=createWorldInput({target:canvas,joystick,knob,getState:()=>({enabled:movementAllowed(),inputAllowed:room?.game?.phase==='roam'&&room?.game?.self?.alive&&!room?.game?.systems?.selfTransit&&!room?.game?.self?.transit,position:room?.game?.self?.position,inputSeq:room?.game?.self?.inputSeq||0}),onInput:value=>{if(value.dx||value.dy)navigationEpoch++;return callbacks.input(value);},onClick:e=>{
  const target=scene.toWorld(e.clientX,e.clientY),position=room?.game?.self?.position,pin=room?.roomId,match=room?.game?.matchId,intent=++navigationEpoch;
  if(!world.findWorldPath(position,target)){setFeedback('That route is blocked. Choose a clear part of the deck.');return null;}
  // Acknowledged stop precedes navigation so a late zero cannot cancel the new route.
  input.stop().then(()=>{if(!disposed&&intent===navigationEpoch&&room?.roomId===pin&&room?.game?.matchId===match&&movementAllowed())return perform('navigate',{x:target.x,y:target.y});}).catch(error=>{if(!disposed&&error?.name!=='AbortError')setFeedback(error?.message||'The walking route could not be sent.');});return null;
 },onShortcut:key=>{if(key==='m')toggleMap();else activate(({e:'use',' ':'use',q:'eliminate',r:'report'})[key]);},onError:error=>{if(!disposed&&!document.hidden&&options.connected&&error?.name!=='AbortError')setFeedback(error?.message||'Movement could not be sent. Reconnect and try again.');}});
 const council=createCouncil({id:uid,action:perform,feedback:setFeedback,pending});
 const results=createResults({id:uid,loadReplay:()=>callbacks.loadReplay(),feedback:setFeedback,isCurrent:matchId=>!disposed&&room?.game?.phase==='ended'&&room.game.matchId===matchId});
 const confirmation=make('section','lw-confirm'),confirmTitle=make('h2','','Eliminate keeper?'),confirmCopy=make('p'),confirmYes=button('Confirm elimination',async()=>{if(!validElimination()){closeConfirmation();setFeedback('That keeper is no longer in reach.');return;}const targetId=confirmTarget;closeConfirmation(false);await request(()=>callbacks.action('eliminate',{targetId}));},'lw-danger'),confirmNo=button('Cancel',()=>closeConfirmation(),'lw-secondary');
 confirmation.setAttribute('role','dialog');confirmation.setAttribute('aria-modal','true');confirmation.setAttribute('aria-labelledby',uid+'-confirm');confirmTitle.id=uid+'-confirm';confirmation.append(make('p','lw-eyebrow','SABOTEUR ACTION'),confirmTitle,confirmCopy,confirmYes,confirmNo);
 const ejection=make('section','lw-ejection'),ejectionArt=make('canvas','lw-ejection-art'),ejectionTitle=make('h1'),ejectionCopy=make('p'),ejectionClose=button('Return to watch',()=>{ejectionKey=null;render();canvas.focus();},'lw-primary');ejectionArt.width=200;ejectionArt.height=220;ejection.append(make('p','lw-eyebrow','COUNCIL DECISION'),ejectionArt,ejectionTitle,ejectionCopy,ejectionClose);
 const paused=make('section','lw-paused');paused.append(make('p','lw-eyebrow','WATCH PAUSED'),make('h1','','THE STORM HOLDS.'),make('p','','The maximum match duration was reached. The server paused this watch without declaring a winner. You can exit at any time.'));
 for(const pane of [council.node,results.node,confirmation,ejection,paused]){pane.hidden=true;overlay.append(pane);}
 roleScene.addEventListener('keydown',event=>{if(event.key==='Escape'){revealed.add(room.game.matchId);render();canvas.focus();}else trapDialog(roleScene,event);});
 confirmation.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeConfirmation();}else trapDialog(confirmation,event);});
 function validElimination(){const g=room?.game,target=g?.players?.find(p=>p.id===confirmTarget);return g?.phase==='roam'&&g.self?.alive&&g.self.role==='saboteur'&&target?.alive&&(g.beaconVersion!==1||knowledge(g,target)==='alive')&&point(target.position)&&distance(g.self.position,target.position)<=world.WORLD.killRadius&&g.availableActions?.includes('eliminate');}
 function closeConfirmation(restore=true){confirmTarget=null;render();if(restore)restoreTrigger(actionButtons.eliminate);}
 function closeTask(restore=true){const current=puzzle;puzzle=null;taskSession=null;current?.dispose();render();if(restore)restoreTrigger(actionButtons.use);}
 function openTask(task){
  taskSession={taskId:task.id,roomId:room.roomId,matchId:room.game.matchId,location:room.game.self.roomId};
  puzzle=createTaskPuzzle({id:uid,task,kind:taskKind(task,room.game.self.tasks.indexOf(task)),onClose:()=>closeTask(),onSubmit:async()=>{
   if(!validTaskSession(taskSession,room,world)){closeTask();setFeedback('Station closed: the task or your location changed.');return;}
   const current=puzzle,session=taskSession,taskId=session.taskId;
   const ownsSubmission=()=>!disposed&&puzzle===current&&taskSession===session&&validTaskSession(session,room,world);
   current.setPending(true);
   try{
    await perform('task',{taskId});
    if(ownsSubmission()){closeTask();setFeedback('Task submitted. The server confirms your progress.');}
   }catch(error){
    if(!ownsSubmission())return;
    setFeedback(error?.message||'Task could not be sent.');current.setPending(false);
   }
  }});input.stop();overlay.append(puzzle.node);render();puzzle.focus();
 }
 async function perform(type,fields){
  if(disposed||pending()||!options.connected)throw new Error('Wait for the connection or pending action.');
  localPending++;render();try{return await callbacks.action(type,fields);}finally{if(!disposed){localPending--;render();}}
 }
 function movementAllowed(){return !document.hidden&&!!room?.game?.self?.alive&&room.game.worldVersion===1&&room.game.phase==='roam'&&options.connected&&!pending()&&roleScene.hidden&&overlay.hidden&&!beaconPanel?.open&&!room.game.systems?.selfTransit&&!room.game.self?.transit;}
 function pending(){return options.pending||localPending>0;}
 function setFeedback(message){if(disposed)return;localFeedback=String(message||'');setText(feedback,localFeedback);}
 async function request(fn){if(disposed||pending())return;localPending++;render();try{return await fn();}catch(error){if(!disposed)setFeedback(error?.message||'The request failed. Try again.');}finally{if(!disposed){localPending--;render();}}}
 function toggleMap(){mapOpen=!mapOpen;mapPane.hidden=!mapOpen;mapToggle.setAttribute('aria-expanded',String(mapOpen));if(mapOpen){mini.update(room,performance.now());mini.draw(performance.now(),{overview:true});}}
 function activate(key){
  if(disposed||!room?.game||!roleScene.hidden||!overlay.hidden||beaconPanel?.open)return;
  const context=contexts(room.game,world)[key];if(!context)return;
  if(!options.connected){setFeedback('Connection interrupted. Reconnect before acting.');return;}
  if(pending()||!context.enabled){setFeedback(pending()?'An action is still being sent.':context.hint);return;}
  input.stop();
  if(context.type==='beaconPanel'){beaconPanel?.show(context.descriptorId);return;}
  if(context.type==='task'){openTask(context.task);return;}
  if(context.type==='eliminate'){confirmTarget=context.fields.targetId;render();confirmNo.focus();return;}
  request(()=>callbacks.action(context.type,context.fields));
 }
 function render(){
  if(!room||disposed)return;const game=room.game,isLobby=!game,canWalk=game?.phase==='roam'&&game.self?.alive&&!game.systems?.selfTransit&&!game.self?.transit;
  const keepers=room.game?.players||room.roster||CHARACTERS;
  for(const [id,row]of lobbyRows)if(!keepers.some(p=>p.id===id)){row.remove();lobbyRows.delete(id);}
  for(const p of keepers){let card=lobbyRows.get(p.id);if(!card){card=make('div','lw-seat');const avatar=make('canvas');avatar.width=80;avatar.height=94;card.append(avatar,make('span'));roster.append(card);lobbyRows.set(p.id,card);}const identity=JSON.stringify([p.name,p.color]);if(card.dataset.identity!==identity){const art=card.children[0].getContext('2d');art.clearRect(0,0,80,94);drawKeeper(art,p,40,64,{scale:1,label:false});setText(card.children[1],p.name);card.dataset.identity=identity;}}
  shell.dataset.phase=game?.phase||'lobby';lobby.hidden=!isLobby;assignment.hidden=isLobby;progress.hidden=isLobby;actions.hidden=isLobby||game.phase!=='roam'||!game.self?.alive;joystick.hidden=!movementAllowed();
  setText(mode,aiLabel(room.ai));setText(status,options.connected?'● Connected':'○ Reconnecting');status.dataset.connected=String(!!options.connected);
  const lastNotice=room.notices?.at(-1),noticeText=typeof lastNotice==='string'?lastNotice:lastNotice?.message||'';setText(aiNotice,noticeText);aiNotice.hidden=!noticeText;setText(lobbyNote,`${room.isHost?`You host this room. ${keepers.length} keepers are aboard.`:'You are observing. The host will begin the watch.'}${noticeText?' '+noticeText:''}`);start.disabled=!room.isHost||pending()||!options.connected;
  setText(role,roleLabel(game));role.dataset.role=game?.self?.role||'spectator';setText(location,game?.self?`${game.self.alive?'':'Fallen · '}${roomName(game.self.roomId)}`:`Public observation · roles ${game?.phase==='ended'?'revealed':'hidden'}`);
  setText(help,canWalk?'WASD / arrows to walk · E use · R report · Q eliminate · M map':'Observe the watch · M map');
  const tasks=game?.self?.tasks||[],ids=new Set(tasks.map(t=>t.id));
  for(const [id,node]of taskRows)if(!ids.has(id)){node.remove();taskRows.delete(id);}
  for(const task of tasks){let li=taskRows.get(task.id);if(!li){li=make('li');taskRows.set(task.id,li);taskList.append(li);}setText(li,`${task.completed?'✓':'◇'} ${task.label} · ${roomName(task.roomId)}`);li.dataset.complete=String(task.completed);}
  meter.max=game?.tasks?.total||1;meter.value=game?.tasks?.completed||0;setText(progressCount,`${game?.tasks?.completed||0} / ${game?.tasks?.total||0}`);
  critical.hidden=!game?.sabotage?.active;setText(criticalClock,clock(game?.sabotage?.deadlineAt,options.now));setText(criticalInfo,`${roomName(game?.sabotage?.roomId)} · ${game?.sabotage?.repairsCompleted||0}/${game?.sabotage?.repairsRequired||0} repairs · continues through council`);
  phaseClock.hidden=!game?.deadlineAt;setText(phaseClock,`${game?.phase==='roam'?'Watch':'Council'} ${clock(game?.deadlineAt,options.now)}`);
  const current=contexts(game,world);
  for(const [key,b]of Object.entries(actionButtons)){const c=current[key];b.hidden=['eliminate','sabotage'].includes(key)&&game?.self?.role!=='saboteur';b.setAttribute('aria-disabled',String(!c.enabled||pending()||!options.connected));b.title=c.enabled?c.label:c.hint;b.setAttribute('aria-label',`${c.label}${key==='use'?' (E / Space)':key==='report'?' (R)':key==='eliminate'?' (Q)':''}`);}
  canvas.setAttribute('aria-label',isLobby?`${keepers.length} raincoat keepers gathered on the storm beacon.`:`${roomName(game?.self?.roomId)}. Visible keepers: ${visiblePlayers(game).map(p=>p.name).join(', ')||'none'}. ${canWalk?'Use keyboard or click the deck to walk.':'Observation only. Open the map to view the platform.'}`);
  if(puzzle&&!validTaskSession(taskSession,room,world)){const old=puzzle;puzzle=null;old.dispose();const completed=game?.matchId===taskSession?.matchId&&game?.self?.tasks?.some(task=>task.id===taskSession?.taskId&&task.completed);setFeedback(completed?'Task complete.':'Station closed: the watch state or your location changed.');taskSession=null;}
  if(confirmTarget&&!validElimination()){confirmTarget=null;setFeedback('That keeper is no longer in reach.');}
  if(game?.phase!=='roam')ejectionKey=null;
  const recentEjection=(game?.events||[]).filter(event=>event.type==='vote_result'&&event.ejectedId).at(-1);
  if(game?.phase==='roam'&&recentEjection){const key=`${game.matchId}:${recentEjection.id||recentEjection.at}:${recentEjection.ejectedId}`;if(!seenEjections.has(key)){seenEjections.add(key);ejectionKey=key;const player=game.players.find(p=>p.id===recentEjection.ejectedId);setText(ejectionTitle,`${player?.name||'A keeper'} WAS EJECTED.`);setText(ejectionCopy,player?.role?`Revealed role: ${player.role}.`:'The beacon has not revealed their role. Keep watching.');const art=ejectionArt.getContext('2d');art.clearRect(0,0,200,220);drawKeeper(art,player||{name:'Keeper'},100,160,{scale:2.2,label:false});}}
  const isCouncil=['discussion','voting'].includes(game?.phase);
  council.node.hidden=!isCouncil;results.node.hidden=game?.phase!=='ended';paused.hidden=game?.phase!=='paused';confirmation.hidden=!confirmTarget;ejection.hidden=!ejectionKey;
  if(isCouncil)council.update(game,options);
  if(game?.phase==='ended')results.update(game);
  if(confirmTarget){const target=game.players.find(p=>p.id===confirmTarget);setText(confirmTitle,`Eliminate ${target?.name||'keeper'}?`);setText(confirmCopy,'This action cannot be undone. The server checks your target and cooldown again.');confirmYes.disabled=pending()||!options.connected;}
  overlay.hidden=!(isCouncil||game?.phase==='ended'||game?.phase==='paused'||puzzle||confirmTarget||ejectionKey);
  shell.dataset.critical=String(!!game?.sabotage?.active);
  const showRole=game?.phase==='roam'&&game.self&&!revealed.has(game.matchId);
  roleScene.hidden=!showRole;
  if(showRole&&lastRole!==game.matchId){lastRole=game.matchId;setText(revealTitle,`YOU ARE ${game.self.role==='saboteur'?'THE SABOTEUR':'CREW'}`);setText(revealCopy,game.self.role==='saboteur'?'Hide in the rain. Sabotage the beacon, mislead the council, and outlast the crew.':'Keep the beacon alive. Complete your stations, report fallen keepers, and find the saboteur.');roleScene.dataset.role=game.self.role;const art=revealArt.getContext('2d');art.clearRect(0,0,240,250);drawKeeper(art,game.players.find(p=>p.id===game.self.id)||game.self,120,180,{scale:2.6,label:false});revealClose.focus();}
  if(!showRole)roleScene.hidden=true;
  if(options.feedback&&options.feedback!==lastFeedback){lastFeedback=options.feedback;localFeedback=String(options.feedback);}
  setText(feedback,localFeedback||room.notices?.at(-1)?.message||'');
  joystick.hidden=!movementAllowed();
  if(isCouncil&&previousPhase!==game.phase&&game.phase==='discussion')council.focus();
  if(ejectionKey&&previousPhase==='voting')ejectionClose.focus();
  previousPhase=game?.phase;
  if(game?.beaconVersion===1&&!beaconPanel){
   beaconPanel=createBeaconPanel({id:uid,action:perform,stop:()=>input.stop({force:true}),feedback:setFeedback,change:()=>{input.sync();render();}});stage.append(beaconPanel.node);
  }
  if(beaconPanel){beaconPanel.update(room,{...options,pending:pending()});beaconPanel.node.hidden=game?.beaconVersion!==1||!roleScene.hidden||!!puzzle||!!confirmTarget;}
  if(game?.beaconVersion===1&&game.sabotage?.active){setText(criticalTitle,game.sabotage.kind==='flood'?'FLOOD WARNING':'BEACON POWER FAILURE');setText(criticalInfo,criticalText(game));}
  input.sync();
 }
 function frame(now){raf=0;if(disposed||document.hidden)return;scene.draw(now);if(mapOpen)mini.draw(now,{overview:true});raf=requestAnimationFrame(frame);}
 function blur(){navigationEpoch++;beaconPanel?.suspend();}
 window.addEventListener('blur',blur);
 function visibility(){navigationEpoch++;beaconPanel?.suspend();if(document.hidden){cancelAnimationFrame(raf);raf=0;input.stop();}else if(!disposed&&!raf){scene.draw(performance.now());raf=requestAnimationFrame(frame);}}
 document.addEventListener('visibilitychange',visibility);if(!document.hidden)raf=requestAnimationFrame(frame);
 return {update(next,nextOptions={}){if(disposed)return;if(lastRoom&&lastRoom!==next.roomId){input.stop();puzzle?.dispose();puzzle=null;taskSession=null;confirmTarget=null;ejectionKey=null;seenEjections.clear();revealed.clear();localFeedback='';lastRole=null;}lastRoom=next.roomId;room=next;options={...options,...nextOptions};scene.update(room,performance.now());mini.update(room,performance.now());render();},dispose(){if(disposed)return;input.dispose();disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);scene.dispose();mini.dispose();beaconPanel?.dispose();puzzle?.dispose();results.dispose();shell.remove();}};
}
