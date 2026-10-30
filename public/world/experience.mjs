import {canViewAct} from '../../shared/features.mjs';
import {createLocalSound} from './sound.mjs';
import {getMap} from '../../shared/maps/index.mjs';
import {mapKey,equipmentOwner,roomName as mapRoomName} from './map-model.mjs';
import {createLobbyMapSelector} from './lobby-map.mjs';
import {CHARACTERS} from '../../shared/contracts.mjs';
import {aiLabel,clock,contexts,distance,point,roleLabel,taskKind,validTaskSession,visiblePlayers} from './model.mjs';
import {createWorldScene,drawKeeper} from './scene.mjs';
import {createWorldInput} from './input.mjs';
import {createTaskPuzzle} from './puzzles.mjs';
import {createCouncil,createResults} from './phases.mjs';
import {restoreTrigger,trapDialog} from './dom.mjs';
import {createBeaconPanel} from './beacon-panel.mjs';
import {knowledge,criticalText,hasActionDescriptor,viewKey} from './beacon-model.mjs';

const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn,className='')=>{const b=make('button',className,text);b.type='button';b.addEventListener('click',fn);return b;};
const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
let instance=0;

/** A safe-view-only game surface. The owner supplies networking and request IDs. */
export function createWorldExperience(host,callbacks,{mapResolver=getMap,motionFactory}={}){
 if(document.head&&!document.querySelector('link[data-beacon-style]')){const link=make('link');link.rel='stylesheet';link.href='/world/beacon.css';link.setAttribute('data-beacon-style','');document.head.append(link);}
 let mapError='',lastScope=null,actionGeneration=0,lastActionKey=null;
 const actionKey=view=>view?.game?.beaconVersion===1?viewKey(view):JSON.stringify([equipmentOwner(view),view?.game?.self?.ghost,view?.game?.self?.position,view?.game?.availableActions,view?.game?.self?.tasks]);
 let selectedMap=mapResolver(),world=selectedMap.geometry;
 const roomName=id=>mapRoomName(selectedMap,id);
 const uid=`lw-world-${++instance}`,shell=make('section','lw-world'),canvas=make('canvas','lw-world-canvas');
 shell.setAttribute('aria-label','Lantern Wake game');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Storm beacon world');canvas.tabIndex=0;
 const stage=make('div','lw-stage');stage.append(canvas);
 const top=make('header','lw-topbar'),brand=make('div','lw-brand','LANTERN WAKE'),mode=make('span','lw-ai'),status=make('span','lw-connection'),leave=button('Exit',()=>{input.stop();callbacks.leave();},'lw-exit');
 status.setAttribute('role','status');top.append(brand,mode,status,leave);
 const progress=make('div','lw-progress'),progressLabel=make('span','','CREW TASKS'),meter=make('progress'),progressCount=make('span');meter.max=1;meter.value=0;meter.setAttribute('aria-label','Crew tasks complete');progress.append(progressLabel,meter,progressCount);
 const assignment=make('aside','lw-assignment'),role=make('strong','lw-role'),location=make('span','lw-location'),taskList=make('ul','lw-tasks'),help=make('p','lw-help');assignment.append(role,location,taskList,help);
 const aiNotice=make('p','lw-ai-notice');assignment.append(aiNotice);
 const sound=createLocalSound({onError:message=>setFeedback(message)});stage.append(sound.node);
 const spectator=make('section','lw-spectator'),spectatorTitle=make('strong','','AI WATCH'),spectatorFollow=make('select'),spectatorOverview=button('Overview',()=>{spectatorWide=!spectatorWide;spectatorOverview.setAttribute('aria-pressed',String(spectatorWide));},'lw-secondary'),spectatorInfo=make('p'),spectatorClaim=make('p');
 spectatorFollow.setAttribute('aria-label','Follow a keeper');const automatic=make('option','','All keepers');automatic.value='';spectatorFollow.append(automatic);const spectatorOptions=new Map();spectatorFollow.addEventListener('change',()=>{spectatorWide=!spectatorFollow.value;spectatorOverview.setAttribute('aria-pressed',String(spectatorWide));});spectatorOverview.setAttribute('aria-pressed','true');spectator.append(spectatorTitle,spectatorFollow,spectatorOverview,spectatorInfo,spectatorClaim);stage.append(spectator);let spectatorWide=true;
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
 const mapPane=make('section','lw-map-pane'),mapHeading=make('h2','','Platform map'),mapCanvas=make('canvas','lw-mini-map');mapPane.hidden=true;mapPane.id=`${uid}-map`;mapToggle.setAttribute('aria-controls',mapPane.id);mapCanvas.setAttribute('role','img');mapCanvas.setAttribute('aria-label','Known platform layout and currently visible keepers');mapPane.append(mapHeading,mapCanvas,make('p','','Map shows only positions supplied by the server.'));
 const mapLegend=make('ol','lw-map-legend');mapLegend.setAttribute('aria-label','Map room key');mapPane.append(mapLegend);let legendKey=null;
 const lobby=make('section','lw-lobby'),lobbyTitle=make('h1','','KEEP THE LIGHT.'),lobbySub=make('p','','Keep the beacon alive. Hidden saboteurs may be aboard.'),roster=make('div','lw-lobby-roster'),start=button('Begin the watch',()=>request(()=>callbacks.start({deathPolicy:deathSelect.value,abilities:abilityToggle.checked})),'lw-primary');
 const lobbyRows=new Map(),lobbyMap=createLobbyMapSelector({id:uid,settings:callbacks.settings,change:()=>render()});
 const preset=make('div','lw-presets'),deathLabel=make('label','','After death '),deathSelect=make('select','lw-death-policy'),abilityLabel=make('label','',' Optional ability roles '),abilityToggle=make('input','lw-ability-preset');
 for(const [value,title]of [['transfer','Transfer tasks (classic)'],['ghost-tasks','Ghost tasks + fallen chat']]){const option=make('option','',title);option.value=value;deathSelect.append(option);}
 abilityToggle.type='checkbox';deathLabel.append(deathSelect);abilityLabel.append(abilityToggle);preset.append(deathLabel,abilityLabel,make('p','','Harbor Ward shields one nearby keeper. Signal Echo creates a labeled distraction. Factions stay secret.'));
 let presetRoom=null,ghostGeneration=0,ghostComposing=false,ghostSending=false;
 const lobbyNote=make('p','lw-lobby-note'),lobbyEyebrow=make('p','lw-eyebrow');lobby.append(lobbyEyebrow,lobbyTitle,lobbySub,roster,lobbyMap.node,preset,start,lobbyNote);
 const unavailable=make('section','lw-map-unavailable'),unavailableTitle=make('h2','','Map unavailable'),unavailableCopy=make('p');unavailableTitle.tabIndex=-1;unavailable.append(unavailableTitle,unavailableCopy);unavailable.hidden=true;stage.append(unavailable);
 const ghostChat=make('aside','lw-ghost-chat'),ghostTitle=make('h2','','FALLEN CHANNEL'),ghostMessages=make('ol'),ghostForm=make('form'),ghostInput=make('textarea'),ghostSend=make('button','','Send to fallen'),ghostHint=make('p','','Only fallen keepers receive this channel. 20 messages each per watch; 2 seconds between messages.');
 ghostInput.rows=2;ghostInput.maxLength=280;ghostInput.setAttribute('aria-label','Message to fallen keepers');ghostMessages.setAttribute('aria-live','polite');ghostMessages.setAttribute('aria-label','Private fallen messages');ghostSend.type='submit';ghostForm.append(ghostInput,ghostSend);ghostChat.append(ghostTitle,ghostMessages,ghostForm,ghostHint);ghostChat.hidden=true;const ghostRows=new Map();
 ghostInput.addEventListener('compositionstart',()=>ghostComposing=true);ghostInput.addEventListener('compositionend',()=>ghostComposing=false);
 ghostForm.addEventListener('submit',async event=>{event.preventDefault();const text=ghostInput.value.trim();if(ghostComposing||event.isComposing||ghostSending||document.hidden||!text||!room?.game?.availableActions?.includes('ghostSay'))return;const pin=ghostGeneration,key=actionKey(room),draft=ghostInput.value;ghostSending=true;try{await perform('ghostSay',{text});if(!disposed&&pin===ghostGeneration&&key===actionKey(room)&&!ghostComposing&&ghostInput.value===draft)ghostInput.value='';}catch(error){if(!disposed&&!document.hidden&&pin===ghostGeneration&&key===actionKey(room)&&error?.name!=='AbortError')setFeedback(error.message);}finally{ghostSending=false;}});
 const overlay=make('div','lw-scene-overlay');overlay.hidden=true;
 const roleScene=make('section','lw-role-scene');roleScene.hidden=true;roleScene.setAttribute('role','dialog');roleScene.setAttribute('aria-modal','true');roleScene.setAttribute('aria-labelledby',`${uid}-role-title`);
 const revealArt=make('canvas','lw-reveal-keeper');revealArt.width=240;revealArt.height=250;
 const revealTitle=make('h1');revealTitle.id=`${uid}-role-title`;const revealCopy=make('p'),revealClose=button('Enter the beacon',()=>{revealed.add(room.game.matchId);roleScene.hidden=true;render();canvas.focus();},'lw-primary');roleScene.append(make('p','lw-eyebrow','YOUR SECRET ASSIGNMENT'),revealArt,revealTitle,revealCopy,revealClose);
 stage.append(top,progress,assignment,critical,phaseClock,feedback,mapToggle,mapPane,joystick,actions,lobby,overlay,roleScene,ghostChat);shell.append(stage);host.append(shell);
 let puzzle=null,taskSession=null,confirmTarget=null,ejectionKey=null,previousPhase=null,navigationEpoch=0;
 const seenEjections=new Set();
 let beaconPanel=null;
 let room=null,options={now:Date.now(),connected:false,pending:false,feedback:''},disposed=false,localPending=0,lastRoom=null,raf=0,mapOpen=false,localFeedback='',lastFeedback='',lastRole=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),scene=createWorldScene(canvas,{reduced:reduced.matches,mapResolver,motionFactory}),mini=createWorldScene(mapCanvas,{reduced:true,mapResolver,motionFactory}),revealed=new Set();
 const input=createWorldInput({target:canvas,joystick,knob,getState:()=>({enabled:movementAllowed(),inputAllowed:room?.game?.phase==='roam'&&canViewAct(room?.game)&&!room?.game?.systems?.selfTransit&&!room?.game?.self?.transit,position:room?.game?.self?.position,inputSeq:room?.game?.self?.inputSeq||0}),onInput:value=>{scene.setIntent?.(value,performance.now());if(value.dx||value.dy)navigationEpoch++;return callbacks.input(value);},onClick:e=>{
  const target=scene.toWorld(e.clientX,e.clientY),position=room?.game?.self?.position,pin=room?.roomId,match=room?.game?.matchId,intent=++navigationEpoch;
  if(!world.findWorldPath(position,target)){setFeedback('That route is blocked. Choose a clear part of the deck.');return null;}
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
 function validElimination(){const g=room?.game;if(g?.beaconVersion===1)return g.phase==='roam'&&g.self?.alive&&g.self.role==='saboteur'&&!g.systems?.selfTransit&&!g.self.transit&&hasActionDescriptor(g,'eliminate',{targetId:confirmTarget});const target=g?.players?.find(p=>p.id===confirmTarget);return g?.phase==='roam'&&g.self?.alive&&g.self.role==='saboteur'&&target?.alive&&(g.beaconVersion!==1||knowledge(g,target)==='alive')&&point(target.position)&&distance(g.self.position,target.position)<=world.WORLD.killRadius&&g.availableActions?.includes('eliminate');}
 function closeConfirmation(restore=true){confirmTarget=null;render();if(restore)restoreTrigger(actionButtons.eliminate);}
 function closeTask(restore=true){const current=puzzle,hadFocus=current?.node.contains(document.activeElement);puzzle=null;taskSession=null;current?.dispose();render();if(restore){restoreTrigger(actionButtons.use);if(hadFocus&&document.activeElement===document.body&&!disposed&&!document.hidden&&room?.game?.phase==='roam'&&canViewAct(room.game)&&overlay.hidden&&roleScene.hidden)restoreTrigger(canvas);}}
 function openTask(task){
  taskSession={taskId:task.id,roomId:room.roomId,matchId:room.game.matchId,mapKey:mapKey(room.game.map??room.map),location:room.game.self.roomId,...(task.progress?{progressKey:JSON.stringify([task.progress.v,task.progress.kind,task.progress.target,task.progress.sequence,task.progress.pressure,task.progress.total])}:{}),...(task.kind==='station'?{challengeKey:JSON.stringify([task.challenge?.version,task.challenge?.kind,task.challenge?.puzzle])}:{})};
  puzzle=createTaskPuzzle({id:uid,task,kind:taskKind(task,room.game.self.tasks.indexOf(task)),onClose:()=>closeTask(),onSubmit:async stationInput=>{
   if(document.hidden)return;
   if(!validTaskSession(taskSession,room,world)){closeTask();setFeedback('Station closed: the task or your location changed.');return;}
   const current=puzzle,session=taskSession,taskId=session.taskId,submissionGeneration=actionGeneration,submissionKey=actionKey(room);
   const ownsEquipment=()=>!disposed&&puzzle===current&&taskSession===session&&validTaskSession(session,room,world);
   const ownsSubmission=()=>submissionGeneration===actionGeneration&&submissionKey===actionKey(room)&&ownsEquipment();
   current.setPending(true);
   try{
    const station=task.kind==='station',step=!station&&stationInput;
    const response=await perform(station?'taskInteract':step?'taskStep':'task',station?{taskId,interactionId:stationInput.interactionId,value:stationInput.value}:{taskId,...(step||{})});
    if(station||step){
     if(ownsSubmission()){const accepted=response?.room??response;if(accepted?.roomId===session.roomId&&accepted.game?.matchId===session.matchId&&mapKey(accepted.game.map??accepted.map)===session.mapKey)api.update(accepted,options);}
     if(ownsEquipment()){current.update?.(room.game.self.tasks.find(t=>t.id===taskId));current.setPending(false);}return;
    }
    if(ownsSubmission()){closeTask();setFeedback('Task submitted. The server confirms your progress.');}else if(ownsEquipment())current.setPending(false);
   }catch(error){
    if(!ownsSubmission()){if(ownsEquipment())current.setPending(false);return;}
    if(error?.name!=='AbortError'){setFeedback(error?.message||'Task could not be sent.');current.feedback?.(error?.message||'Input rejected.');}current.setPending(false);if(task.kind==='station')throw error;
   }
  }});input.stop();overlay.append(puzzle.node);render();puzzle.focus();
 }
 async function perform(type,fields){
  if(disposed||mapError||pending()||lobbyMap.pending||!options.connected)throw new Error('Wait for the connection or pending action.');
  localPending++;render();try{return await callbacks.action(type,fields);}finally{if(!disposed){localPending--;render();}}
 }
 function movementAllowed(){return !mapError&&!document.hidden&&canViewAct(room?.game)&&room.game.worldVersion===1&&room.game.phase==='roam'&&options.connected&&!pending()&&roleScene.hidden&&overlay.hidden&&!beaconPanel?.open&&!room.game.systems?.selfTransit&&!room.game.self?.transit;}
 function pending(){return options.pending||localPending>0;}
 function setFeedback(message){if(disposed)return;localFeedback=String(message||'');setText(feedback,localFeedback);}
 async function request(fn){if(disposed||mapError||pending()||lobbyMap.pending)return;const generation=actionGeneration,key=actionKey(room);localPending++;render();try{return await fn();}catch(error){if(!disposed&&!document.hidden&&generation===actionGeneration&&key===actionKey(room)&&error?.name!=='AbortError')setFeedback(error?.message||'The request failed. Try again.');}finally{if(!disposed){localPending--;render();}}}
 function toggleMap(){mapOpen=!mapOpen;mapPane.hidden=!mapOpen;mapToggle.setAttribute('aria-expanded',String(mapOpen));if(mapOpen){mini.update(room,performance.now());mini.draw(performance.now(),{overview:true});}}
 function activate(key){
  if(disposed||mapError||!room?.game||!roleScene.hidden||!overlay.hidden||beaconPanel?.open)return;
  const context=contexts(room.game,world)[key];if(!context)return;if(key==='protect'&&room.game.beaconVersion!==1)context.fields.targetId=wardTarget.value||room.game.self.id;
  if(!options.connected){setFeedback('Connection interrupted. Reconnect before acting.');return;}
  if(pending()||!context.enabled){setFeedback(pending()?'An action is still being sent.':context.hint);return;}
  input.stop();
  if(context.type==='beaconPanel'){beaconPanel?.show(context.descriptorId);return;}
  if(context.type==='task'){openTask(context.task);return;}
  if(context.type==='eliminate'){confirmTarget=context.fields.targetId;render();confirmNo.focus();return;}
  request(()=>callbacks.action(context.type,context.fields));
 }
 function render(){
  if(!room||disposed)return;const game=room.game,isLobby=!game,canWalk=game?.phase==='roam'&&canViewAct(game)&&!game.systems?.selfTransit&&!game.self?.transit;
  if(mapError){shell.dataset.critical=String(!!game?.sabotage?.active);canvas.hidden=true;unavailable.hidden=false;setText(unavailableCopy,mapError+' Exit and open a compatible watch.');lobby.hidden=assignment.hidden=progress.hidden=actions.hidden=joystick.hidden=mapToggle.hidden=mapPane.hidden=overlay.hidden=roleScene.hidden=true;critical.hidden=!game?.sabotage?.active;setText(criticalClock,clock(game?.sabotage?.deadlineAt,options.now));setText(criticalTitle,'CRITICAL ALERT');setText(criticalInfo,'The deadline continues; this client cannot render map equipment.');phaseClock.hidden=true;setText(mode,aiLabel(room.ai));if(beaconPanel)beaconPanel.node.hidden=true;setText(status,options.connected?'Connected':'Reconnecting');return;}
  canvas.hidden=false;unavailable.hidden=true;mapToggle.hidden=false;
  const keepers=room.game?.players||room.roster||CHARACTERS;
  for(const [id,row]of lobbyRows)if(!keepers.some(p=>p.id===id)){row.remove();lobbyRows.delete(id);}
  for(const p of keepers){let card=lobbyRows.get(p.id);if(!card){card=make('div','lw-seat');const avatar=make('canvas');avatar.width=80;avatar.height=94;card.append(avatar,make('span'));roster.append(card);lobbyRows.set(p.id,card);}const identity=JSON.stringify([p.name,p.color]);if(card.dataset.identity!==identity){const art=card.children[0].getContext('2d');art.clearRect(0,0,80,94);drawKeeper(art,p,40,64,{scale:1,label:false});setText(card.children[1],p.name);card.dataset.identity=identity;}}
  shell.dataset.phase=game?.phase||'lobby';lobby.hidden=!isLobby;assignment.hidden=isLobby;progress.hidden=isLobby;actions.hidden=isLobby||game.phase!=='roam'||!game.self?.alive;joystick.hidden=!movementAllowed();
  setText(mode,aiLabel(room.ai));setText(status,options.connected?'● Connected':'○ Reconnecting');status.dataset.connected=String(!!options.connected);
  const lastNotice=room.notices?.at(-1),noticeText=typeof lastNotice==='string'?lastNotice:lastNotice?.message||'';setText(aiNotice,noticeText);aiNotice.hidden=!noticeText;setText(lobbyNote,`${room.isHost?`You host this room. ${keepers.length} keepers are aboard.`:'You are observing. The host will begin the watch.'}${noticeText?' '+noticeText:''}`);start.disabled=!room.isHost||pending()||!options.connected||lobbyMap.pending;
  const nextLegend=JSON.stringify([selectedMap.id,selectedMap.version]);if(legendKey!==nextLegend){legendKey=nextLegend;mapLegend.replaceChildren(...selectedMap.roomLayout.map(r=>make('li','',r.name)));}
  lobbyMap.update(room,options);setText(mapHeading,`${selectedMap.name} map`);setText(lobbyEyebrow,`${selectedMap.id==='beacon'?'STORM BEACON':selectedMap.name.toUpperCase()} · KEEPER WATCH`);setText(revealClose,selectedMap.id==='beacon'?'Enter the beacon':`Enter ${selectedMap.name}`);
  for(const [id,node]of spectatorOptions)if(!keepers.some(p=>p.id===id)){node.remove();spectatorOptions.delete(id);}
  for(const p of keepers)if(!spectatorOptions.has(p.id)){const node=make('option','',p.name);node.value=p.id;spectatorOptions.set(p.id,node);spectatorFollow.append(node);}
  spectator.hidden=!game||!!game.self||game.phase==='ended';
  if(!spectator.hidden){setText(spectatorTitle,room.mode==='spectator'?'AI WATCH':'WATCH THE KEEPERS');const selected=game.players.find(p=>p.id===spectatorFollow.value),said=(game.events||[]).filter(e=>e.type==='said'&&(!selected||e.playerId===selected.id)).at(-1);setText(spectatorInfo,selected?`${selected.name} · ${game.beaconVersion===1?({alive:'on watch',dead:'fallen',unknown:'status unknown'})[knowledge(game,selected)]:selected.alive?'on watch':'fallen'} · ${point(selected.position)?roomName(selected.roomId):'location unavailable'}. Roles remain hidden.`:'Follow the keepers through tasks and council. Roles remain hidden until completion.');setText(spectatorClaim,said?`Public claim · ${game.players.find(p=>p.id===said.playerId)?.name||'Keeper'}: ${said.text}`:'No public claim recorded yet. Only server-permitted positions are shown; private reasoning is unavailable.');}

  if(isLobby){if(presetRoom!==room.roomId){presetRoom=room.roomId;deathSelect.value=room.features?.deathPolicy||'transfer';abilityToggle.checked=room.features?.abilities===true;}deathSelect.disabled=abilityToggle.disabled=!room.isHost||pending();}
  ghostChat.hidden=!game?.self?.ghost||['ended','paused'].includes(game?.phase);
  for(const message of game?.ghostChat||[]){if(ghostRows.has(message.id))continue;const item=make('li','',`${game.players.find(p=>p.id===message.playerId)?.name||'Fallen keeper'}: ${message.text}`);ghostRows.set(message.id,item);ghostMessages.append(item);}
  ghostSend.disabled=pending()||!options.connected||!game?.availableActions?.includes('ghostSay');
  setText(role,roleLabel(game));role.dataset.role=game?.self?.role||'spectator';setText(location,game?.self?`${game.self.alive?'':'Fallen · '}${roomName(game.self.roomId)}`:`Public observation · roles ${game?.phase==='ended'?'revealed':'hidden'}`);
  setText(help,game?.self?.ghost?'Ghost tasks: walk and use your remaining stations. Living keepers cannot see or hear you. Council, reports, repairs and abilities are unavailable.':canWalk?'WASD / arrows to walk · E use · R report · Q eliminate · M map':'Observe the watch · M map');
  const ability=game?.self?.ability;abilityInfo.hidden=!ability||!game.self.alive;wardTarget.hidden=ability?.type!=='ward'||!game?.self?.alive;
  setText(abilityInfo,ability?`${ability.type==='ward'?'Harbor Ward · one-hit shield, 8s, range 140':'Signal Echo · labeled distraction, 6s'} · ready in ${Math.max(0,Math.ceil((ability.readyAt-options.now)/1000))}s`:'');
  const targets=(game?.players||[]).filter(p=>(game.beaconVersion===1?knowledge(game,p)==='alive':p.alive)&&point(p.position)&&distance(game.self?.position,p.position)<=140);const targetIds=new Set(targets.map(p=>p.id));
  for(const [id,option]of targetOptions)if(!targetIds.has(id)){option.remove();targetOptions.delete(id);}
  for(const p of targets)if(!targetOptions.has(p.id)){const option=make('option','',p.name+(p.id===game.self.id?' (you)':''));option.value=p.id;targetOptions.set(p.id,option);wardTarget.append(option);}
  const tasks=game?.self?.tasks||[],ids=new Set(tasks.map(t=>t.id));
  for(const [id,node]of taskRows)if(!ids.has(id)){node.remove();taskRows.delete(id);}
  for(const task of tasks){let li=taskRows.get(task.id);if(!li){li=make('li');taskRows.set(task.id,li);taskList.append(li);}setText(li,`${task.completed?'✓':'◇'} ${task.label} · ${roomName(task.roomId)}`);li.dataset.complete=String(task.completed);}
  meter.max=game?.tasks?.total||1;meter.value=game?.tasks?.completed||0;setText(progressCount,`${game?.tasks?.completed||0} / ${game?.tasks?.total||0}`);
  critical.hidden=!game?.sabotage?.active;setText(criticalClock,clock(game?.sabotage?.deadlineAt,options.now));setText(criticalInfo,`${roomName(game?.sabotage?.roomId)} · ${game?.sabotage?.repairsCompleted||0}/${game?.sabotage?.repairsRequired||0} repairs · continues through council`);
  phaseClock.hidden=!game?.deadlineAt;setText(phaseClock,`${game?.phase==='roam'?'Watch':'Council'} ${clock(game?.deadlineAt,options.now)}`);
  const current=contexts(game,world);
  for(const [key,b]of Object.entries(actionButtons)){const c=current[key]||{enabled:false,label:key,hint:'Unavailable in this watch.'};b.hidden=key==='protect'?(!game?.self?.alive||game.self.ability?.type!=='ward'):key==='decoy'?(!game?.self?.alive||game.self.ability?.type!=='echo'):(game?.self?.ghost&&key!=='use')||(['eliminate','sabotage'].includes(key)&&game?.self?.role!=='saboteur');b.setAttribute('aria-disabled',String(!c.enabled||pending()||!options.connected));b.title=c.enabled?c.label:c.hint;b.setAttribute('aria-label',`${c.label}${key==='use'?' (E / Space)':key==='report'?' (R)':key==='eliminate'?' (Q)':''}`);}
  canvas.setAttribute('aria-label',isLobby?`${keepers.length} raincoat keepers gathered on ${selectedMap.id==='beacon'?'the storm beacon':selectedMap.name}.`:`${roomName(game?.self?.roomId)}. Visible keepers: ${visiblePlayers(game).map(p=>p.name).join(', ')||'none'}. ${canWalk?'Use keyboard or click the deck to walk.':'Observation only. Open the map to view the platform.'}`);
  if(puzzle&&!validTaskSession(taskSession,room,world)){const old=puzzle,stationFocus=old.node.className.split(' ').includes('lw-station-modal')&&old.node.contains(document.activeElement);puzzle=null;old.dispose();const completed=game?.matchId===taskSession?.matchId&&game?.self?.tasks?.some(task=>task.id===taskSession?.taskId&&task.completed);setFeedback(completed?'Task complete.':'Station closed: the watch state or your location changed.');taskSession=null;if(stationFocus&&completed&&game.phase==='roam'&&!document.hidden)canvas.focus();}
  if(puzzle?.update){const currentTask=game?.self?.tasks?.find(t=>t.id===taskSession?.taskId);if(currentTask)puzzle.update(currentTask,{pending:pending(),connected:options.connected});}
  if(confirmTarget&&!validElimination()){confirmTarget=null;setFeedback('That keeper is no longer in reach.');}
  if(game?.phase!=='roam')ejectionKey=null;
  const recentEjection=(game?.events||[]).filter(event=>event.type==='vote_result'&&event.ejectedId).at(-1);
  if(game?.phase==='roam'&&recentEjection){const key=`${game.matchId}:${recentEjection.id||recentEjection.at}:${recentEjection.ejectedId}`;if(!seenEjections.has(key)){seenEjections.add(key);ejectionKey=key;const player=game.players.find(p=>p.id===recentEjection.ejectedId);setText(ejectionTitle,`${player?.name||'A keeper'} WAS EJECTED.`);setText(ejectionCopy,player?.role?`Revealed role: ${player.role}.`:'The beacon has not revealed their role. Keep watching.');const art=ejectionArt.getContext('2d');art.clearRect(0,0,200,220);drawKeeper(art,player||{name:'Keeper'},100,160,{scale:2.2,label:false});}}
  const isCouncil=['discussion','voting'].includes(game?.phase);
  council.node.hidden=!isCouncil;results.node.hidden=game?.phase!=='ended';paused.hidden=game?.phase!=='paused';confirmation.hidden=!confirmTarget;ejection.hidden=!ejectionKey;
  if(isCouncil)council.update(game,options);else council.suspend?.();
  results.update(game,{roomId:room.roomId,ai:room.ai});
  if(confirmTarget){const target=game.players.find(p=>p.id===confirmTarget);setText(confirmTitle,`Eliminate ${target?.name||'keeper'}?`);setText(confirmCopy,'This action cannot be undone. The server checks your target and cooldown again.');confirmYes.disabled=pending()||!options.connected;}
  overlay.hidden=!(isCouncil||game?.phase==='ended'||game?.phase==='paused'||puzzle||confirmTarget||ejectionKey);
  shell.dataset.critical=String(!!game?.sabotage?.active);
  const showRole=game?.phase==='roam'&&game.self?.alive&&!revealed.has(game.matchId);
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
   beaconPanel=createBeaconPanel({id:uid,mapResolver,action:perform,stop:()=>input.stop({force:true}),feedback:setFeedback,change:()=>{input.sync();render();}});stage.append(beaconPanel.node);
  }
  if(beaconPanel){beaconPanel.update(room,{...options,pending:pending()});beaconPanel.node.hidden=game?.beaconVersion!==1||!roleScene.hidden||!!puzzle||!!confirmTarget;}
  if(game?.beaconVersion===1&&game.sabotage?.active){setText(criticalTitle,game.sabotage.kind==='flood'?'FLOOD WARNING':'BEACON POWER FAILURE');setText(criticalInfo,criticalText(game,selectedMap));}
  input.sync();
 }
 function frame(now){raf=0;if(disposed||document.hidden)return;scene.draw(now,{overview:!room?.game?.self&&!!room?.game&&spectatorWide,follow:!room?.game?.self?spectatorFollow.value:null});if(mapOpen)mini.draw(now,{overview:true});raf=requestAnimationFrame(frame);}
 function blur(){ghostGeneration++;council.suspend?.();scene.suspend?.();mini.suspend?.();navigationEpoch++;actionGeneration++;beaconPanel?.suspend();lobbyMap.suspend();sound.suspend();}
 window.addEventListener('blur',blur);
 function visibility(){ghostGeneration++;council.suspend?.();navigationEpoch++;actionGeneration++;beaconPanel?.suspend();lobbyMap.suspend();sound.suspend();if(document.hidden){scene.suspend?.();mini.suspend?.();cancelAnimationFrame(raf);raf=0;input.stop();}else if(!disposed&&!raf){scene.update(room,performance.now());mini.update(room,performance.now());scene.draw(performance.now());raf=requestAnimationFrame(frame);}}
 document.addEventListener('visibilitychange',visibility);if(!document.hidden)raf=requestAnimationFrame(frame);
 const api={update(next,nextOptions={}){
  if(disposed)return;let nextMap;
  try{nextMap=mapResolver(next.game?.map??next.map);}catch(error){navigationEpoch++;actionGeneration++;input.stop();puzzle?.dispose();puzzle=null;taskSession=null;confirmTarget=null;beaconPanel?.suspend();sound.suspend();room=next;options={...options,...nextOptions};mapError=error?.message||'Unsupported map/version.';render();unavailableTitle.focus();return;}
  const nextActionKey=actionKey(next);if(lastActionKey!==null&&lastActionKey!==nextActionKey)actionGeneration++;lastActionKey=nextActionKey;const scope=equipmentOwner(next);
  if(lastScope&&lastScope!==scope){ghostGeneration++;navigationEpoch++;input.stop();puzzle?.dispose();puzzle=null;taskSession=null;confirmTarget=null;beaconPanel?.suspend();}
  const changed=selectedMap.id!==nextMap.id||selectedMap.version!==nextMap.version;
  if(lastRoom&&(lastRoom!==next.roomId||changed||room?.game?.matchId!==next.game?.matchId||room?.game?.self?.id!==next.game?.self?.id)){ejectionKey=null;seenEjections.clear();revealed.clear();ghostRows.clear();ghostMessages.replaceChildren();ghostInput.value='';ghostGeneration++;spectatorFollow.value='';spectatorWide=true;localFeedback='';lastRole=null;}
  lastScope=scope;lastRoom=next.roomId;mapError='';selectedMap=nextMap;world=selectedMap.geometry;room=next;options={...options,...nextOptions};scene.update(room,performance.now());mini.update(room,performance.now());sound.update(room);render();
 },dispose(){if(disposed)return;input.dispose();disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);scene.dispose();mini.dispose();lobbyMap.dispose();sound.dispose();beaconPanel?.dispose();puzzle?.dispose();council.dispose?.();results.dispose();shell.remove();}};return api;
}
