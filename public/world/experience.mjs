import * as world from '../../shared/world.mjs';
import {createMemberControls} from '../members.mjs';
import {createLobbyPanel} from '../lobby.mjs';
import {keeperLabel,nameOf} from '../presentation.mjs';
import {CHARACTERS} from '../../shared/contracts.mjs';
import {aiLabel,clock,contexts,distance,point,roleLabel,taskKind,validTaskSession,visiblePlayers} from './model.mjs';
import {createWorldScene,drawKeeper} from './scene.mjs';
import {createWorldInput} from './input.mjs';
import {createTaskPuzzle} from './puzzles.mjs';
import {createCouncil,createResults} from './phases.mjs';
import {restoreTrigger,trapDialog} from './dom.mjs';

const roomName=id=>({bridge:'Bridge',archive:'Archive',lantern:'Lantern',workshop:'Workshop',galley:'Galley',engine:'Engine'})[id]||'At sea';
const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn,className='')=>{const b=make('button',className,text);b.type='button';b.addEventListener('click',fn);return b;};
const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
let instance=0;

/** A safe-view-only game surface. The owner supplies networking and request IDs. */
export function createWorldExperience(host,callbacks){
 let geometry=world;
 const mapCatalog=Array.isArray(world.MAPS)?world.MAPS:[{id:'beacon',name:'Storm Beacon',description:'The original six-room storm beacon.',width:1600,height:1200,tasksPerCrew:3,roomCount:6}];
 const locationName=id=>geometry.ROOM_LAYOUT?.find(r=>r.id===id)?.name||room?.game?.rooms?.find(r=>r.id===id)?.name||roomName(id);
 const uid=`lw-world-${++instance}`,shell=make('section','lw-world'),canvas=make('canvas','lw-world-canvas');
 shell.setAttribute('aria-label','Lantern Wake game');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Storm beacon world');canvas.tabIndex=0;
 const stage=make('div','lw-stage');stage.append(canvas);
 const top=make('header','lw-topbar'),brand=make('div','lw-brand','LANTERN WAKE'),mode=make('span','lw-ai'),status=make('span','lw-connection'),leave=button('Exit',()=>{input.stop();callbacks.leave();},'lw-exit');
 const mapName=make('span','lw-map-name');brand.append(mapName);
 status.setAttribute('role','status');top.append(brand,mode,status,leave);
 const progress=make('div','lw-progress'),progressLabel=make('span','','CREW TASKS'),meter=make('progress'),progressCount=make('span');meter.max=1;meter.value=0;meter.setAttribute('aria-label','Crew tasks complete');progress.append(progressLabel,meter,progressCount);
 const assignment=make('aside','lw-assignment'),role=make('strong','lw-role'),location=make('span','lw-location'),taskList=make('ul','lw-tasks'),help=make('p','lw-help');assignment.append(role,location,taskList,help);
 const aiNotice=make('p','lw-ai-notice');assignment.append(aiNotice);
 const spectator=make('section','lw-spectator'),spectatorTitle=make('strong','','AI WATCH'),spectatorFollow=make('select'),spectatorOverview=button('Overview',()=>{spectatorWide=!spectatorWide;spectatorOverview.setAttribute('aria-pressed',String(spectatorWide));},'lw-secondary'),spectatorInfo=make('p'),spectatorClaim=make('p');
 let spectatorRoster='';spectatorFollow.setAttribute('aria-label','Follow a keeper');const automatic=make('option','','All keepers');automatic.value='';spectatorFollow.append(automatic);for(const p of CHARACTERS){const option=make('option','',p.name);option.value=p.id;spectatorFollow.append(option);}spectatorFollow.addEventListener('change',()=>{spectatorWide=!spectatorFollow.value;spectatorOverview.setAttribute('aria-pressed',String(spectatorWide));});spectatorOverview.setAttribute('aria-pressed','true');spectator.append(spectatorTitle,spectatorFollow,spectatorOverview,spectatorInfo,spectatorClaim);stage.append(spectator);let spectatorWide=true;
 const abilityInfo=make('p','lw-ability-info'),wardTarget=make('select','lw-ward-target');wardTarget.setAttribute('aria-label','Harbor Ward target');assignment.append(abilityInfo,wardTarget);const targetOptions=new Map();
 const taskRows=new Map();
 const critical=make('div','lw-critical');critical.hidden=true;critical.setAttribute('role','region');critical.setAttribute('aria-label','Critical countdown');
 const criticalTitle=make('strong','','BEACON FAILURE'),criticalClock=make('span','lw-critical-clock'),criticalInfo=make('span');criticalClock.setAttribute('role','timer');criticalClock.setAttribute('aria-label','Critical time remaining');critical.append(criticalTitle,criticalClock,criticalInfo);
 const phaseClock=make('span','lw-phase-clock');phaseClock.setAttribute('role','timer');phaseClock.setAttribute('aria-label','Phase time remaining');
 const feedback=make('p','lw-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const actions=make('nav','lw-actions');actions.setAttribute('aria-label','Context actions');const actionButtons={};
 for(const [key,title,hotkey,icon] of [['protect','WARD','','◇'],['decoy','ECHO','','◎'],['use','USE','E','\u2699\ufe0e'],['report','REPORT','R','!'],['eliminate','ELIMINATE','Q','×'],['sabotage','SABOTAGE','','\u26a1\ufe0e']]){
  const b=button('',()=>activate(key),`lw-action lw-action-${key}`),symbol=make('span','lw-action-icon',icon),label=make('span','lw-action-label',title),kbd=make('kbd','',hotkey);b.append(symbol,label,kbd);b.dataset.worldAction=key;actions.append(b);actionButtons[key]=b;
 }
 const joystick=make('div','lw-joystick'),knob=make('div','lw-joystick-knob');joystick.append(knob);joystick.setAttribute('aria-hidden','true');
 const mapToggle=button('Map  M',()=>toggleMap(),'lw-map-toggle');mapToggle.setAttribute('aria-expanded','false');
 const mapPane=make('section','lw-map-pane'),mapHeading=make('h2','','Platform map'),mapCanvas=make('canvas','lw-mini-map');mapPane.hidden=true;mapPane.id=`${uid}-map`;mapToggle.setAttribute('aria-controls',mapPane.id);mapCanvas.setAttribute('role','img');mapCanvas.setAttribute('aria-label','Known platform layout and currently visible keepers');const mapRoomList=make('ul','lw-map-room-list');mapRoomList.setAttribute('aria-label','Map rooms');let listedMap=null;mapPane.append(mapHeading,mapCanvas,make('p','','Map shows only positions supplied by the server.'),mapRoomList);
 const lobby=make('section','lw-lobby'),lobbyTitle=make('h1','','KEEP THE LIGHT.'),lobbySub=make('p','','Six keepers. One hidden saboteur. A storm that won’t wait.'),roster=make('div','lw-lobby-roster'),start=button('Begin the watch',()=>request(()=>callbacks.start({deathPolicy:deathSelect.value,abilities:abilityToggle.checked},mapSelect.value||'beacon')),'lw-primary');
 for(const p of CHARACTERS){const card=make('div','lw-seat'),avatar=make('canvas');avatar.width=80;avatar.height=94;drawKeeper(avatar.getContext('2d'),p,40,64,{scale:1,label:false});card.append(avatar,make('span','',p.name));roster.append(card);}
 const mapLabel=make('label','lw-map-label','Choose a map '),mapSelect=make('select','lw-map-select'),mapDescription=make('p','lw-map-description');mapSelect.setAttribute('aria-label','Choose a map');
 for(const entry of mapCatalog){const option=make('option','',entry.name);option.value=entry.id;mapSelect.append(option);}mapSelect.value='beacon';mapLabel.append(mapSelect);
 mapSelect.addEventListener('change',()=>{if(!room?.game){selectGeometry(mapSelect.value);scene.update({...room,mapId:mapSelect.value},performance.now());mini.update({...room,mapId:mapSelect.value},performance.now());render();}});
 const preset=make('div','lw-presets'),deathLabel=make('label','','After death '),deathSelect=make('select','lw-death-policy'),abilityLabel=make('label','',' Optional ability roles '),abilityToggle=make('input','lw-ability-preset');
 for(const [value,title]of [['transfer','Transfer tasks (classic)'],['ghost-tasks','Ghost tasks + fallen chat']]){const option=make('option','',title);option.value=value;deathSelect.append(option);}
 abilityToggle.type='checkbox';deathLabel.append(deathSelect);abilityLabel.append(abilityToggle);preset.append(mapLabel,mapDescription,deathLabel,abilityLabel,make('p','','Harbor Ward shields one nearby keeper. Signal Echo creates a labeled distraction. Factions stay secret.'));
 let presetRoom=null;
 const lobbyNote=make('p','lw-lobby-note');lobby.append(make('p','lw-eyebrow','STORM BEACON · SIX KEEPER WATCH'),lobbyTitle,lobbySub,roster,preset,start,lobbyNote);
 let lobbyPanel=null,memberControls=null;
 const rematch=button('Rematch with this crew',()=>request(()=>callbacks.rematch()),'lw-secondary');rematch.hidden=true;
 const ghostChat=make('aside','lw-ghost-chat'),ghostTitle=make('h2','','FALLEN CHANNEL'),ghostMessages=make('ol'),ghostForm=make('form'),ghostInput=make('textarea'),ghostSend=make('button','','Send to fallen'),ghostHint=make('p','','Only fallen keepers receive this channel. 20 messages each per watch; 2 seconds between messages.');
 ghostInput.rows=2;ghostInput.maxLength=280;ghostInput.setAttribute('aria-label','Message to fallen keepers');ghostMessages.setAttribute('aria-live','polite');ghostMessages.setAttribute('aria-label','Private fallen messages');ghostSend.type='submit';ghostForm.append(ghostInput,ghostSend);ghostChat.append(ghostTitle,ghostMessages,ghostForm,ghostHint);ghostChat.hidden=true;const ghostRows=new Map();
 ghostForm.addEventListener('submit',async event=>{event.preventDefault();const text=ghostInput.value.trim();if(!text||!room?.game?.availableActions?.includes('ghostSay'))return;const pin=room.roomId;try{await perform('ghostSay',{text});if(room?.roomId===pin&&ghostInput.value.trim()===text)ghostInput.value='';}catch(error){setFeedback(error.message);}});
 const overlay=make('div','lw-scene-overlay');overlay.hidden=true;
 const roleScene=make('section','lw-role-scene');roleScene.hidden=true;roleScene.setAttribute('role','dialog');roleScene.setAttribute('aria-modal','true');roleScene.setAttribute('aria-labelledby',`${uid}-role-title`);
 const revealArt=make('canvas','lw-reveal-keeper');revealArt.width=240;revealArt.height=250;
 const revealTitle=make('h1');revealTitle.id=`${uid}-role-title`;const revealCopy=make('p'),revealClose=button('Enter the beacon',()=>{revealed.add(room.game.matchId);roleScene.hidden=true;render();canvas.focus();},'lw-primary');roleScene.append(make('p','lw-eyebrow','YOUR SECRET ASSIGNMENT'),revealArt,revealTitle,revealCopy,revealClose);
 top.append(rematch);
 stage.append(top,progress,assignment,critical,phaseClock,feedback,mapToggle,mapPane,joystick,actions,lobby,overlay,roleScene,ghostChat);shell.append(stage);host.append(shell);
 let puzzle=null,taskSession=null,confirmTarget=null,ejectionKey=null,previousPhase=null,navigationEpoch=0;
 const seenEjections=new Set();
 let room=null,options={now:Date.now(),connected:false,pending:false,feedback:''},disposed=false,localPending=0,lastRoom=null,raf=0,mapOpen=false,localFeedback='',lastFeedback='',lastRole=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),scene=createWorldScene(canvas,{reduced:reduced.matches}),mini=createWorldScene(mapCanvas,{reduced:true}),revealed=new Set();
 const input=createWorldInput({target:canvas,joystick,knob,getState:()=>({enabled:movementAllowed(),inputAllowed:room?.game?.phase==='roam'&&(room?.game?.self?.alive||room?.game?.self?.ghost),position:room?.game?.self?.position,inputSeq:room?.game?.self?.inputSeq||0}),onInput:value=>{if(value.dx||value.dy)navigationEpoch++;return callbacks.input(value);},onClick:e=>{
  const target=scene.toWorld(e.clientX,e.clientY),position=room?.game?.self?.position,pin=room?.roomId,match=room?.game?.matchId,intent=++navigationEpoch;
  if(!geometry.findWorldPath(position,target)){setFeedback('That route is blocked. Choose a clear part of the deck.');return null;}
  // Acknowledged stop precedes navigation so a late zero cannot cancel the new route.
  input.stop().then(()=>{if(!disposed&&intent===navigationEpoch&&room?.roomId===pin&&room?.game?.matchId===match&&movementAllowed())return perform('navigate',{x:target.x,y:target.y});}).catch(error=>{if(!disposed&&error?.name!=='AbortError')setFeedback(error?.message||'The walking route could not be sent.');});return null;
 },onShortcut:key=>{if(key==='m')toggleMap();else activate(({e:'use',' ':'use',q:'eliminate',r:'report'})[key]);},onError:error=>{if(!disposed&&!document.hidden&&options.connected&&error?.name!=='AbortError')setFeedback(error?.message||'Movement could not be sent. Reconnect and try again.');}});
 const council=createCouncil({id:uid,action:perform,feedback:setFeedback,pending});
 const results=createResults({id:uid,loadReplay:request=>callbacks.loadReplay(request),feedback:setFeedback,isCurrent:matchId=>!disposed&&room?.game?.phase==='ended'&&room.game.matchId===matchId});
 const confirmation=make('section','lw-confirm'),confirmTitle=make('h2','','Eliminate keeper?'),confirmCopy=make('p'),confirmYes=button('Confirm elimination',async()=>{if(!validElimination()){closeConfirmation();setFeedback('That keeper is no longer in reach.');return;}const targetId=confirmTarget;closeConfirmation(false);await request(()=>callbacks.action('eliminate',{targetId}));},'lw-danger'),confirmNo=button('Cancel',()=>closeConfirmation(),'lw-secondary');
 confirmation.setAttribute('role','dialog');confirmation.setAttribute('aria-modal','true');confirmation.setAttribute('aria-labelledby',uid+'-confirm');confirmTitle.id=uid+'-confirm';confirmation.append(make('p','lw-eyebrow','SABOTEUR ACTION'),confirmTitle,confirmCopy,confirmYes,confirmNo);
 const ejection=make('section','lw-ejection'),ejectionArt=make('canvas','lw-ejection-art'),ejectionTitle=make('h1'),ejectionCopy=make('p'),ejectionClose=button('Return to watch',()=>{ejectionKey=null;render();canvas.focus();},'lw-primary');ejectionArt.width=200;ejectionArt.height=220;ejection.append(make('p','lw-eyebrow','COUNCIL DECISION'),ejectionArt,ejectionTitle,ejectionCopy,ejectionClose);
 const paused=make('section','lw-paused');paused.append(make('p','lw-eyebrow','WATCH PAUSED'),make('h1','','THE STORM HOLDS.'),make('p','','The maximum match duration was reached. The server paused this watch without declaring a winner. You can exit at any time.'));
 for(const pane of [council.node,results.node,confirmation,ejection,paused]){pane.hidden=true;overlay.append(pane);}
 roleScene.addEventListener('keydown',event=>{if(event.key==='Escape'){revealed.add(room.game.matchId);render();canvas.focus();}else trapDialog(roleScene,event);});
 confirmation.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeConfirmation();}else trapDialog(confirmation,event);});
 function validElimination(){const g=room?.game,target=g?.players?.find(p=>p.id===confirmTarget);return g?.phase==='roam'&&g.self?.alive&&g.self.role==='saboteur'&&target?.alive&&!g.self.teammates?.includes(target.id)&&point(target.position)&&distance(g.self.position,target.position)<=geometry.WORLD.killRadius&&g.availableActions?.includes('eliminate');}
 function closeConfirmation(restore=true){confirmTarget=null;render();if(restore)restoreTrigger(actionButtons.eliminate);}
 function closeTask(restore=true){const current=puzzle;puzzle=null;taskSession=null;current?.dispose();render();if(restore)restoreTrigger(actionButtons.use);}
 function openTask(task){
  taskSession={taskId:task.id,roomId:room.roomId,matchId:room.game.matchId,location:room.game.self.roomId};
  puzzle=createTaskPuzzle({id:uid,task,getServerNow:()=>options.now,kind:taskKind(task,room.game.self.tasks.indexOf(task)),onClose:()=>closeTask(),onSubmit:async step=>{
   if(!validTaskSession(taskSession,room,geometry)){closeTask();setFeedback('Station closed: the task or your location changed.');return;}
   const current=puzzle,session=taskSession,taskId=session.taskId;
   const ownsSubmission=()=>!disposed&&puzzle===current&&taskSession===session&&validTaskSession(session,room,geometry);
   current.setPending(true);
   try{
    await perform(step?'taskStep':'task',{taskId,...(step||{})});
    if(ownsSubmission()){if(!step){closeTask();setFeedback('Task submitted.');}else {current.update?.(room.game.self.tasks.find(t=>t.id===taskId));current.setPending(false);}}
   }catch(error){
    if(!ownsSubmission())return;
    setFeedback(error?.message||'Task could not be sent.');current.feedback?.(error?.message||'Input rejected.');current.setPending(false);
   }
  }});input.stop();overlay.append(puzzle.node);render();puzzle.focus();
 }
 async function perform(type,fields){
  if(disposed||pending()||!options.connected)throw new Error('Wait for the connection or pending action.');
  localPending++;render();try{return await callbacks.action(type,fields);}finally{if(!disposed){localPending--;render();}}
 }
 function movementAllowed(){return !document.hidden&&!!(room?.game?.self?.alive||room?.game?.self?.ghost)&&room.game.worldVersion===1&&room.game.phase==='roam'&&options.connected&&!pending()&&roleScene.hidden&&overlay.hidden&&!memberControls?.open;}
 function pending(){return options.pending||localPending>0;}
 function setFeedback(message){if(disposed)return;localFeedback=String(message||'');setText(feedback,localFeedback);}
 async function request(fn){if(disposed||pending())return;localPending++;render();try{return await fn();}catch(error){if(!disposed)setFeedback(error?.message||'The request failed. Try again.');}finally{if(!disposed){localPending--;render();}}}
 function toggleMap(){mapOpen=!mapOpen;mapPane.hidden=!mapOpen;mapToggle.setAttribute('aria-expanded',String(mapOpen));if(mapOpen){mini.update(room.game?room:{...room,mapId:mapSelect.value||room.mapId||'beacon'},performance.now());mini.draw(performance.now(),{overview:true});}}
 function activate(key){
  if(disposed||!room?.game||!roleScene.hidden||!overlay.hidden)return;
  const context=contexts(room.game,geometry)[key];if(!context)return;if(key==='protect')context.fields.targetId=wardTarget.value||room.game.self.id;
  if(!options.connected){setFeedback('Connection interrupted. Reconnect before acting.');return;}
  if(pending()||!context.enabled){setFeedback(pending()?'An action is still being sent.':context.hint);return;}
  input.stop();
  if(context.type==='task'){openTask(context.task);return;}
  if(context.type==='eliminate'){confirmTarget=context.fields.targetId;render();confirmNo.focus();return;}
  request(()=>callbacks.action(context.type,context.fields));
 }
 function selectGeometry(mapId){geometry=typeof world.getWorld==='function'?world.getWorld(mapId||'beacon'):world;}
 function render(){
  if(!room||disposed)return;const game=room.game,isLobby=!game,canWalk=game?.phase==='roam'&&(game.self?.alive||game.self?.ghost);
  if(!isLobby&&room.settings&&callbacks.lobby&&room.isHost){if(!memberControls){memberControls=createMemberControls({id:uid,mutate:callbacks.lobby,report:setFeedback,onOpen:()=>input.stop()});top.append(memberControls.trigger);stage.append(memberControls.panel);}memberControls.update(room,options);}
  mapToggle.hidden=isLobby;mapPane.hidden=isLobby||!mapOpen;
  const followPlayers=game?.players||room.seats||CHARACTERS,followRoster=JSON.stringify(followPlayers.map(p=>[p.id,p.name,p.badge]));if(followRoster!==spectatorRoster){spectatorRoster=followRoster;const selected=spectatorFollow.value;spectatorFollow.replaceChildren(automatic,...followPlayers.map(p=>{const option=make('option','',keeperLabel(p));option.value=p.id;return option;}));spectatorFollow.value=followPlayers.some(p=>p.id===selected)?selected:'';}
  spectator.hidden=!game||!!game.self||game.phase==='ended';
  if(!spectator.hidden){setText(spectatorTitle,room.mode==='spectator'?'AI WATCH':'WATCH THE KEEPERS');const selected=game.players.find(p=>p.id===spectatorFollow.value),said=(game.events||[]).filter(e=>e.type==='said'&&(!selected||e.playerId===selected.id)).at(-1);setText(spectatorInfo,selected?`${selected.name} · ${selected.alive?'on watch':'fallen'} · ${locationName(selected.roomId)}. Roles remain hidden.`:'Follow the keepers through tasks and council. Roles remain hidden until completion.');setText(spectatorClaim,said?`Public claim · ${game.players.find(p=>p.id===said.playerId)?.name||'Keeper'}: ${said.text}`:'No public claim recorded yet. Movement is public; private reasoning is unavailable.');}

  shell.dataset.phase=game?.phase||'lobby';lobby.hidden=!isLobby;assignment.hidden=isLobby;progress.hidden=isLobby;actions.hidden=isLobby||game.phase!=='roam'||!(game.self?.alive||game.self?.ghost);joystick.hidden=!movementAllowed();
  if(isLobby&&room.settings&&callbacks.lobby){if(!lobbyPanel)lobbyPanel=createLobbyPanel({host:lobby,mutate:callbacks.lobby,archive:callbacks.archive,start:()=>request(()=>callbacks.start()),report:setFeedback});lobbyPanel.update(room,options);}
  rematch.hidden=!room.isHost||!['ended','paused'].includes(game?.phase)||!callbacks.rematch;rematch.disabled=pending()||!options.connected;
  setText(mode,aiLabel(room.ai));setText(status,options.connected?'● Connected':'○ Reconnecting');status.dataset.connected=String(!!options.connected);
  const lastNotice=room.notices?.at(-1),noticeText=typeof lastNotice==='string'?lastNotice:lastNotice?.message||'';setText(aiNotice,noticeText);aiNotice.hidden=!noticeText;setText(lobbyNote,`${room.isHost?'You host this room. All six keepers are aboard.':'You are observing. The host will begin the watch.'}${noticeText?' '+noticeText:''}`);start.disabled=!room.isHost||pending()||!options.connected;
  if(isLobby){if(presetRoom!==room.roomId){presetRoom=room.roomId;deathSelect.value=room.features?.deathPolicy||'transfer';abilityToggle.checked=room.features?.abilities===true;mapSelect.value=room.mapId||'beacon';selectGeometry(mapSelect.value);}deathSelect.disabled=abilityToggle.disabled=mapSelect.disabled=!room.isHost||pending();}
  const mapMeta=geometry.metadata||mapCatalog.find(entry=>entry.id===(game?.mapId||mapSelect.value))||mapCatalog[0];
  shell.dataset.map=mapMeta.id;setText(mapName,mapMeta.name);setText(mapHeading,`${mapMeta.name} · platform map`);setText(mapDescription,`${mapMeta.description} ${mapMeta.roomCount} rooms · ${mapMeta.width} × ${mapMeta.height} deck · ${mapMeta.tasksPerCrew*5} crew assignments.`);
  if(listedMap!==mapMeta.id){listedMap=mapMeta.id;mapRoomList.textContent='';mapRoomList.append(...(geometry.ROOM_LAYOUT||game?.rooms||[]).map(entry=>make('li','',entry.name)));}
  ghostChat.hidden=!game?.self?.ghost||['ended','paused'].includes(game?.phase);
  for(const message of game?.ghostChat||[]){if(ghostRows.has(message.id))continue;const item=make('li','',`${nameOf(game,message.playerId)}: ${message.text}`);ghostRows.set(message.id,item);ghostMessages.append(item);}
  ghostSend.disabled=pending()||!options.connected||!game?.availableActions?.includes('ghostSay');
  setText(role,roleLabel(game)+(game?.self?.teammates?.length?' · Teammates: '+game.self.teammates.map(id=>{const p=game.players.find(p=>p.id===id);return `${p?.name||id} #${id.slice(1)}`;}).join(', '):''));role.dataset.role=game?.self?.role||'spectator';setText(location,game?.self?`${game.self.alive?'':'Fallen · '}${locationName(game.self.roomId)}`:`Public observation · roles ${game?.phase==='ended'?'revealed':'hidden'}`);
  setText(help,game?.self?.ghost?'Ghost tasks: walk and use your remaining stations. Living keepers cannot see or hear you. Council, reports, repairs and abilities are unavailable.':canWalk?'WASD / arrows to walk · E use · R report · Q eliminate · M map':'Observe the watch · M map');
  const ability=game?.self?.ability;abilityInfo.hidden=!ability||!game.self.alive;wardTarget.hidden=ability?.type!=='ward'||!game?.self?.alive;
  setText(abilityInfo,ability?`${ability.type==='ward'?'Harbor Ward · one-hit shield, 8s, range 140':'Signal Echo · labeled distraction, 6s'} · ready in ${Math.max(0,Math.ceil((ability.readyAt-options.now)/1000))}s`:'');
  const targets=(game?.players||[]).filter(p=>p.alive&&point(p.position)&&distance(game.self?.position,p.position)<=140);const targetIds=new Set(targets.map(p=>p.id));
  for(const [id,option]of targetOptions)if(!targetIds.has(id)){option.remove();targetOptions.delete(id);}
  for(const p of targets)if(!targetOptions.has(p.id)){const option=make('option','',p.name+(p.badge?` #${p.badge}`:'')+(p.id===game.self.id?' (you)':''));option.value=p.id;targetOptions.set(p.id,option);wardTarget.append(option);}
  const tasks=game?.self?.tasks||[],ids=new Set(tasks.map(t=>t.id));
  for(const [id,node]of taskRows)if(!ids.has(id)){node.remove();taskRows.delete(id);}
  for(const task of tasks){let li=taskRows.get(task.id);if(!li){li=make('li');taskRows.set(task.id,li);taskList.append(li);}setText(li,`${task.completed?'✓':'◇'} ${task.label} · ${locationName(task.roomId)}`);li.dataset.complete=String(task.completed);}
  meter.max=game?.tasks?.total||1;meter.value=game?.tasks?.completed||0;setText(progressCount,`${game?.tasks?.completed||0} / ${game?.tasks?.total||0}`);
  critical.hidden=!game?.sabotage?.active;setText(criticalClock,clock(game?.sabotage?.deadlineAt,options.now));setText(criticalInfo,`${locationName(game?.sabotage?.roomId)} · ${game?.sabotage?.repairsCompleted||0}/${game?.sabotage?.repairsRequired||0} repairs · continues through council`);
  phaseClock.hidden=!game?.deadlineAt;setText(phaseClock,`${game?.phase==='roam'?'Watch':'Council'} ${clock(game?.deadlineAt,options.now)}`);
  const current=contexts(game,geometry);
  for(const [key,b]of Object.entries(actionButtons)){const c=current[key];b.hidden=key==='protect'?(!game?.self?.alive||game.self.ability?.type!=='ward'):key==='decoy'?(!game?.self?.alive||game.self.ability?.type!=='echo'):(game?.self?.ghost&&key!=='use')||(['eliminate','sabotage'].includes(key)&&game?.self?.role!=='saboteur');b.setAttribute('aria-disabled',String(!c.enabled||pending()||!options.connected));b.title=c.enabled?c.label:c.hint;b.setAttribute('aria-label',`${c.label}${key==='use'?' (E / Space)':key==='report'?' (R)':key==='eliminate'?' (Q)':''}`);}
  canvas.setAttribute('aria-label',isLobby?`${room.seats?.length||6} raincoat keepers gathered on the storm beacon.`:`${locationName(game?.self?.roomId)}. Visible keepers: ${visiblePlayers(game).map(p=>p.badge?`${p.name} #${p.badge}`:p.name).join(', ')||'none'}. ${canWalk?'Use keyboard or click the deck to walk.':'Observation only. Open the map to view the platform.'}`);
  puzzle?.update?.(game?.self?.tasks?.find(t=>t.id===taskSession?.taskId));
  if(puzzle&&!validTaskSession(taskSession,room,geometry)){const old=puzzle;puzzle=null;old.dispose();const completed=game?.matchId===taskSession?.matchId&&game?.self?.tasks?.some(task=>task.id===taskSession?.taskId&&task.completed);setFeedback(completed?'Task complete.':'Station closed: the watch state or your location changed.');taskSession=null;}
  if(confirmTarget&&!validElimination()){confirmTarget=null;setFeedback('That keeper is no longer in reach.');}
  if(game?.phase!=='roam')ejectionKey=null;
  const recentEjection=(game?.events||[]).filter(event=>event.type==='vote_result'&&event.ejectedId).at(-1);
  if(game?.phase==='roam'&&recentEjection){const key=`${game.matchId}:${recentEjection.id||recentEjection.at}:${recentEjection.ejectedId}`;if(!seenEjections.has(key)){seenEjections.add(key);ejectionKey=key;const player=game.players.find(p=>p.id===recentEjection.ejectedId);setText(ejectionTitle,`${keeperLabel(player)||'A keeper'} WAS EJECTED.`);setText(ejectionCopy,player?.role?`Revealed role: ${player.role}.`:'The beacon has not revealed their role. Keep watching.');const art=ejectionArt.getContext('2d');art.clearRect(0,0,200,220);drawKeeper(art,player||CHARACTERS[0],100,160,{scale:2.2,label:false});}}
  const isCouncil=['discussion','voting'].includes(game?.phase);
  council.node.hidden=!isCouncil;results.node.hidden=game?.phase!=='ended';paused.hidden=game?.phase!=='paused';confirmation.hidden=!confirmTarget;ejection.hidden=!ejectionKey;
  if(isCouncil)council.update(game,options);
  results.update(game,{roomId:room.roomId,ai:room.ai});
  if(confirmTarget){const target=game.players.find(p=>p.id===confirmTarget);setText(confirmTitle,`Eliminate ${keeperLabel(target)||'keeper'}?`);setText(confirmCopy,'This action cannot be undone. The server checks your target and cooldown again.');confirmYes.disabled=pending()||!options.connected;}
  overlay.hidden=!(isCouncil||game?.phase==='ended'||game?.phase==='paused'||puzzle||confirmTarget||ejectionKey);
  shell.dataset.critical=String(!!game?.sabotage?.active);
  const showRole=game?.phase==='roam'&&game.self?.alive&&!revealed.has(game.matchId);
  roleScene.hidden=!showRole;
  if(showRole&&lastRole!==game.matchId){lastRole=game.matchId;setText(revealTitle,`YOU ARE ${game.self.role==='saboteur'?(game.settings?.saboteurs>1?'A SABOTEUR':'THE SABOTEUR'):'CREW'}`);setText(revealCopy,game.self.role==='saboteur'?'Hide in the rain. Sabotage the beacon, mislead the council, and outlast the crew.':'Keep the beacon alive. Complete your stations, report fallen keepers, and find the saboteur.');roleScene.dataset.role=game.self.role;const art=revealArt.getContext('2d');art.clearRect(0,0,240,250);drawKeeper(art,game.players.find(p=>p.id===game.self.id)||CHARACTERS[0],120,180,{scale:2.6,label:false});revealClose.focus();}
  if(!showRole)roleScene.hidden=true;
  if(options.feedback&&options.feedback!==lastFeedback){lastFeedback=options.feedback;localFeedback=String(options.feedback);}
  setText(feedback,localFeedback||room.notices?.at(-1)?.message||'');
  joystick.hidden=!movementAllowed();
  if(isCouncil&&previousPhase!==game.phase&&game.phase==='discussion')council.focus();
  if(ejectionKey&&previousPhase==='voting')ejectionClose.focus();
  previousPhase=game?.phase;
  input.sync();
 }
 function frame(now){raf=0;if(disposed||document.hidden)return;scene.draw(now,{overview:!room?.game?.self&&!!room?.game&&spectatorWide,follow:!room?.game?.self?spectatorFollow.value:null});if(mapOpen)mini.draw(now,{overview:true});raf=requestAnimationFrame(frame);}
 function blur(){navigationEpoch++;}
 window.addEventListener('blur',blur);
 function visibility(){navigationEpoch++;if(document.hidden){cancelAnimationFrame(raf);raf=0;input.stop();}else if(!disposed&&!raf){scene.draw(performance.now());raf=requestAnimationFrame(frame);}}
 document.addEventListener('visibilitychange',visibility);if(!document.hidden)raf=requestAnimationFrame(frame);
 return {update(next,nextOptions={}){if(disposed)return;if(lastRoom&&lastRoom!==next.roomId){input.stop();puzzle?.dispose();puzzle=null;taskSession=null;confirmTarget=null;ejectionKey=null;seenEjections.clear();revealed.clear();ghostRows.clear();ghostMessages.replaceChildren();ghostInput.value='';localFeedback='';lastRole=null;spectatorFollow.value='';spectatorWide=true;}lastRoom=next.roomId;room=next;selectGeometry(room.game?.mapId||(presetRoom===room.roomId?mapSelect.value:room.mapId)||'beacon');options={...options,...nextOptions};const displayRoom=room.game?room:{...room,mapId:(presetRoom===room.roomId?mapSelect.value:room.mapId)||'beacon'};scene.update(displayRoom,performance.now());mini.update(displayRoom,performance.now());render();},dispose(){if(disposed)return;input.dispose();disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);scene.dispose();mini.dispose();puzzle?.dispose();memberControls?.dispose();results.dispose();shell.remove();}};
}
