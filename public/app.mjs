import {ROOM_LAYOUT,CHARACTERS} from '../shared/contracts.mjs';
import {element as h,button,phaseLabel,secondsUntil,clockText,syncChildren} from './ui.mjs';
import {request,roomPath,actionEnvelope,roomFrom,roomIdFromPath} from './api.mjs';
import {watchPanel,taskPanel,criticalPanel,councilPanel,timelinePanel,resultsPanel,timer} from './panels.mjs';
import {replayEvents,aiNotice,aiLabel} from './presentation.mjs';
import {createWorldExperience} from './world/experience.mjs';
import {worldInputEnvelope} from './world-input-envelope.mjs';
import {harbor} from './harbor.mjs';
import {createWatchPanels} from './features/watch-panels.mjs';

const main=document.querySelector('#main');
const feedback=document.querySelector('#feedback');
let room=null,roomId=null,controller=null,socket=null,poll=null;
let epoch=0,pending=false,offset=0,connected=false,networkReady=false,connectionIssue=false;
let draft='',draftMeeting=null,confirmTarget=null,replay=null,replayIndex=0,retry=null,retryContext=null;
const attemptedJoins=new Set();
let featurePanels=null;
let worldExperience=null,worldSession=null,lastInputFailure=0,worldActionGeneration=0;

function beaconContextKey(game){
 if(game?.beaconVersion!==1)return null;
 const self=game.self;
 return JSON.stringify([game.map,game.preset,self?.position,self?.roomId,self?.alive,self?.transit,game.systems?.selfTransit,game.investigation?.session,game.vision?.radius,self?.tasks?.map(t=>[t.id,t.completed,t.progress,t.challenge?.progress]),game.interactions?.map(h=>[h.id,h.type,h.fields,h.enabled])]);
}
function captureActionContext(body){
 const game=room?.game,self=game?.self;if(!game?.worldVersion||!body.type)return null;
 return {generation:worldActionGeneration,matchId:game.matchId,phase:game.phase,type:body.type,actor:self?.id,location:self?.roomId,position:self?.position?{...self.position}:null,taskId:body.taskId,knownTask:self?.tasks?.some(task=>task.id===body.taskId),beacon:beaconContextKey(game)};
}
function actionContextCurrent(context){
 if(!context)return true;
 if(context.scope==='settings')return context.generation===worldActionGeneration&&roomId===context.roomId&&!room?.game&&room?.isHost&&room.settingsRevision===context.revision;
 const game=room?.game,self=game?.self;
 if(context.generation!==worldActionGeneration||game?.matchId!==context.matchId||game.phase!==context.phase||self?.id!==context.actor||!self?.alive)return false;
 if(context.beacon!==null&&context.beacon!==beaconContextKey(game))return false;
 if(['task','taskInteract'].includes(context.type)){
  if(self.roomId!==context.location)return false;
  if(context.position&&self.position&&Math.hypot(self.position.x-context.position.x,self.position.y-context.position.y)>.1)return false;
  if(context.knownTask&&!self.tasks?.some(task=>task.id===context.taskId&&!task.completed))return false;
 }
 return true;
}
function stopWorldMovement(){
 const owner=worldSession,game=room?.game;
 if(!owner||owner.id!==roomId||!game?.worldVersion||!game.self?.alive||game.phase!=='roam')return;
 const seq=Math.max(owner.wireSeq||0,game.self.inputSeq||0)+1;if(!Number.isSafeInteger(seq))return;
 owner.wireSeq=seq;owner.lastVector={dx:0,dy:0};
 // This final stop must outlive the controller we are about to abort. It is
 // scoped to the old room cookie, bounded, and never accepts a stale response.
 request(roomPath(owner.id,'/input'),{method:'POST',body:{seq,dx:0,dy:0},keepalive:true,timeoutMs:1500}).catch(()=>{});
}
function releaseWorld(){
 stopWorldMovement();
 const instance=worldExperience,owner=worldSession,panels=featurePanels;worldExperience=null;featurePanels=null;
 try{panels?.dispose();instance?.dispose();}finally{if(worldSession===owner)worldSession=null;}
}
function ownsWorld(owner){return worldSession===owner&&roomId===owner.id&&!document.hidden&&controller&&!controller.signal.aborted;}
async function worldInput(owner,input){
 if(!ownsWorld(owner))throw new DOMException('The room changed.','AbortError');
 let packet=worldInputEnvelope(input);const game=room?.game;
 if(!game?.self?.alive||game.phase!=='roam'){
  if(!packet.dx&&!packet.dy)return room; // The authority already freezes non-roam motion.
  throw new DOMException('Movement requires an active watch.','AbortError');
 }
 if((packet.dx||packet.dy)&&!networkReady)throw new DOMException('Resynchronizing the connection before moving.','AbortError');
 if(!packet.dx&&!packet.dy&&!owner.lastVector?.dx&&!owner.lastVector?.dy&&!game.self.moving)return room;
 if(packet.seq<(owner.clientSeq||0))throw new DOMException('A newer control intent exists.','AbortError');
 if(packet.seq===owner.clientSeq){
  if(packet.dx!==owner.lastPacket.dx||packet.dy!==owner.lastPacket.dy)throw new TypeError('Movement sequence already used.');
  packet=owner.lastPacket;
 }else{
  const clientSeq=packet.seq;packet={...packet,seq:Math.max(clientSeq,(owner.wireSeq||0)+1,(game.self.inputSeq||0)+1)};
  if(!Number.isSafeInteger(packet.seq))throw new TypeError('Movement sequence exhausted. Start a new watch.');
  owner.clientSeq=clientSeq;owner.wireSeq=packet.seq;owner.lastPacket=packet;
 }
 owner.lastVector={dx:packet.dx,dy:packet.dy};
 const current=epoch,id=roomId,opened=controller;
 try{
  const data=await request(roomPath(id,'/input'),{method:'POST',body:packet,signal:opened.signal});
  if(!ownsWorld(owner)||current!==epoch||controller!==opened)throw new DOMException('The room changed.','AbortError');
  accept(data);return data;
 }catch(error){
  if(ownsWorld(owner)&&current===epoch&&error.name!=='AbortError'){
   const unavailable=error.status==null||error.status>=500;
   if(unavailable){networkReady=false;connectionIssue=true;}
   if(Date.now()-lastInputFailure>5000){lastInputFailure=Date.now();if(unavailable)connectionFailure(error.message);else tell(error.message,true);}
   if(unavailable)render();
  }
  throw error;
 }
}
async function worldMutation(owner,suffix,body){
 if(!ownsWorld(owner))throw new DOMException('The room changed.','AbortError');
 const result=await mutation(suffix,body);
 if(!ownsWorld(owner))throw new DOMException('The room changed.','AbortError');
 if(result?.stale)throw new DOMException('The action context changed.','AbortError');
 if(!result?.ok)throw new Error(result?.error||'Wait for the current action to finish.');
 return result.data;
}
async function worldReplay(owner){
 if(!ownsWorld(owner))throw new DOMException('The room changed.','AbortError');
 const current=epoch,opened=controller;
 const data=await request(roomPath(owner.id,'/replay'),{signal:opened.signal});
 if(!ownsWorld(owner)||current!==epoch||controller!==opened)throw new DOMException('The room changed.','AbortError');
 return data;
}
function renderWorld(){
 if(!worldExperience){
  const host=h('div',{id:'world-host'}),owner={id:roomId};main.replaceChildren(host);worldSession=owner;
  worldExperience=createWorldExperience(host,{
   action:(type,fields={})=>worldMutation(owner,'/action',actionEnvelope(type,fields)),
   input:input=>worldInput(owner,input),start:()=>worldMutation(owner,'/start',{id:crypto.randomUUID()}),
   settings:mapId=>{if(!ownsWorld(owner)||room?.game||!room?.isHost||!networkReady)return Promise.reject(new DOMException('Map settings are unavailable.','AbortError'));return worldMutation(owner,'/settings',{id:crypto.randomUUID(),mapId,expectedRevision:room.settingsRevision});},
   leave:()=>{if(worldSession===owner)home();},loadReplay:()=>worldReplay(owner)
  });
 }
 if(room?.game?.beaconVersion===1){if(!featurePanels)featurePanels=createWatchPanels(document.querySelector('#world-host'));featurePanels.update(room);}
 worldExperience.update(room,{now:Date.now()+offset,connected:networkReady,pending,feedback:feedback.textContent});
}

function tell(message,error=false){
 connectionIssue=false;
 feedback.replaceChildren(...(message?[h('span',{},message)]:[]));
 feedback.classList.toggle('error',error);
 feedback.setAttribute?.('data-retry',String(Boolean(retry)));
 if(retry){
  const retained=retry,current=epoch,id=roomId;
  feedback.append(button('Retry same request',()=>{if(current===epoch&&roomId===id&&retry===retained&&actionContextCurrent(retryContext))return retained();},{class:'quiet'}));
 }
}
function connectionFailure(message){tell(message,true);connectionIssue=true;networkReady=false;}
function persistId(id){
 try{if(id)sessionStorage.setItem('lantern-room',id);else sessionStorage.removeItem('lantern-room');}catch{}
}
function stop(){
 stopWorldMovement();
 const uncertain=Boolean(retry);
 epoch++;
 controller?.abort();controller=null;
 clearTimeout(poll);poll=null;
 connected=false;networkReady=false;pending=false;retry=null;retryContext=null;
 if(uncertain)connectionFailure('Resynchronizing the room. Check its current state before acting again.');
 if(socket){socket.onclose=null;socket.onerror=null;socket.close();socket=null;}
}
async function busy(fn){
 if(pending)return {ok:false,error:'Wait for the current action to finish.'};
 const current=epoch,focus=saveFocus();
 pending=true;render();
 try{return await fn();}
 catch(error){if(current===epoch&&error.name!=='AbortError')tell(error.message,true);return {ok:false,error:error.message};}
 finally{if(current===epoch){const lostFocus=document.activeElement===document.body;pending=false;render();if(lostFocus)restoreFocus(focus);}}
}
function accept(data){
 const next=roomFrom(data);
 if(roomId&&next.roomId!==roomId)return;
 if(room?.game&&!next.game)return;
 if(!room?.game&&!next.game&&Number.isSafeInteger(room?.settingsRevision)&&(!Number.isSafeInteger(next.settingsRevision)||next.settingsRevision<room.settingsRevision))return;
 if(room?.game&&next.game&&(next.game.version<room.game.version||(next.game.version===room.game.version&&next.game.serverNow<room.game.serverNow)))return;
 if(room?.settingsRevision!==next.settingsRevision||JSON.stringify(room?.map)!==JSON.stringify(next.map)||room?.game?.matchId!==next.game?.matchId||room?.game?.phase!==next.game?.phase||room?.game?.self?.id!==next.game?.self?.id||beaconContextKey(room?.game)!==beaconContextKey(next.game))worldActionGeneration++;
 room=next;
 networkReady=true;
 if(retryContext&&!actionContextCurrent(retryContext)){retry=null;retryContext=null;tell('Current watch state synchronized.');}
 if(connectionIssue)tell('Connection restored.');
 if(room.game?.serverNow)offset=room.game.serverNow-Date.now();
 const meeting=room.game?.meeting?.id;
 if(meeting!==draftMeeting){draft='';draftMeeting=meeting;}
 render();
}
async function create(mode){
 releaseWorld();
 stop();controller=new AbortController();
 await busy(async()=>{
  const current=epoch;
  const data=await request('/api/rooms',{method:'POST',body:{mode},signal:controller.signal});
  if(current!==epoch)return;
  await openRoom(roomFrom(data).roomId,data);
  tell(mode==='human'?'Your crew seat is ready.':'Spectator room ready.');
 });
}
async function openRoom(id,initial,{remembered=false}={}){
 const changed=id!==roomId;
 if(changed)releaseWorld();
 stop();roomId=id;
 if(changed){room=null;replay=null;replayIndex=0;draft='';draftMeeting=null;confirmTarget=null;}
 persistId(id);
 history.replaceState(null,'',`/r/${encodeURIComponent(id)}`);
 const current=epoch,opened=new AbortController();
 controller=opened;render();
 const ownsOpen=()=>current===epoch&&roomId===id&&controller===opened&&!opened.signal.aborted;
 try{
  if(initial)accept(initial);
  else{
   let data;
   try{data=await request(roomPath(id),{signal:opened.signal});}
   catch(error){
    if(!ownsOpen())return;
    if(error.status!==401||attemptedJoins.has(id))throw error;
    // A retry must recheck cookies before another POST, including uncertain success.
    data=await request(roomPath(id,'/join'),{method:'POST',body:{},signal:opened.signal});
    if(!ownsOpen())return;
    attemptedJoins.add(id);
   }
   if(!ownsOpen())return;
   accept(data);
  }
  if(ownsOpen())connect(current);
 }catch(error){
  if(ownsOpen()&&error.name!=='AbortError'){
   if(remembered&&error.status===404){home();tell('Your previous watch is unavailable. Start a new watch.');return;}
   if([401,403,404].includes(error.status))tell(error.message,true);
   else{connectionFailure(error.message);schedulePoll(current);}
   render();
  }
 }
}
function schedulePoll(current,delay=2000){
 clearTimeout(poll);
 if(current!==epoch||document.hidden||['ended','paused'].includes(room?.game?.phase))return;
 poll=setTimeout(async()=>{
  try{
   const data=await request(roomPath(roomId),{signal:controller.signal});
   if(current!==epoch)return;
   accept(data);schedulePoll(current);
  }catch(error){
   if(current!==epoch||error.name==='AbortError')return;
   if([401,403,404].includes(error.status)){tell(`${error.message} Reopen your original browser to recover its seat.`,true);return;}
   connectionFailure(`Connection interrupted. Retrying: ${error.message}`);
   schedulePoll(current,Math.min(delay*2,30000));
  }
 },delay);
}
function connect(current){
 if(document.hidden||['ended','paused'].includes(room?.game?.phase))return;
 schedulePoll(current);
 try{
  const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}${roomPath(roomId,'/socket')}`);
  socket=ws;
  ws.onopen=()=>{if(current===epoch){connected=true;render();}};
  ws.onmessage=event=>{
   if(current!==epoch)return;
   try{const data=JSON.parse(event.data);if(data.type==='state')accept(data.room);else if(data.type==='error')tell(data.error?.message||'Connection error.',true);}
   catch{connectionFailure('Unreadable connection update. Resynchronizing.');}
  };
  ws.onclose=()=>{if(current===epoch){socket=null;connected=false;schedulePoll(current);render();}};
  ws.onerror=()=>ws.close();
 }catch{schedulePoll(current);}
}
async function mutation(suffix,body,onSuccess){
 const current=epoch,id=roomId,context=suffix==='/action'?captureActionContext(body):suffix==='/settings'?{scope:'settings',generation:worldActionGeneration,roomId,revision:body.expectedRevision}:null;
 return busy(async()=>{
  try{
   const data=await request(roomPath(id,suffix),{method:'POST',body,signal:controller.signal});
   if(current!==epoch)return {ok:false,error:'The room changed.'};
   const stillCurrent=!context||actionContextCurrent(context);
   retry=null;retryContext=null;accept(data);if(!stillCurrent)return {ok:true,stale:true,data};
   if(onSuccess)onSuccess();else tell('Action confirmed.');
   return {ok:true,data};
  }catch(error){
   if(current!==epoch||error.name==='AbortError')return;
   if(context&&!actionContextCurrent(context))return {ok:false,stale:true,error:'The action context changed.'};
   if(error.status==null||error.status>=500){retryContext=context;retry=()=>mutation(suffix,body,onSuccess);tell('The request could not be confirmed. Retry keeps the same request ID so an accepted action cannot run twice.',true);}
   else{retry=null;retryContext=null;tell(error.message,true);}
   return {ok:false,error:error.message};
  }
 });
}
function start(){return mutation('/start',{id:crypto.randomUUID()},()=>tell('The watch has begun.'));}
function act(type,fields={}){
 return mutation('/action',actionEnvelope(type,fields),()=>{
  if(type==='say')draft='';
  confirmTarget=null;
  tell(({move:'You moved to the next room.',task:room?.game?.self?.tasks?.find(t=>t.id===fields.taskId)?.kind==='station'?'Station access confirmed.':'Task complete.',repair:'Repair contribution received.',vote:'Your vote is recorded.',say:'Message sent.',report:'Report received.',meeting:'Emergency bell rung.',sabotage:'Critical sabotage triggered.',eliminate:'Elimination received.'})[type]||'Action received.');
 });
}
async function loadReplay(){
 const current=epoch;
 await busy(async()=>{
  const data=await request(roomPath(roomId,'/replay'),{signal:controller.signal});
  if(current!==epoch)return;
  replay=replayEvents(data);replayIndex=0;tell('Full replay loaded. Roles and actions are now revealed.');
 });
}
function home(){
 releaseWorld();
 stop();room=roomId=null;replay=null;draft='';confirmTarget=null;
 persistId(null);history.pushState(null,'','/');tell('');render();
}
function canMove(game,target){
 return !pending&&game?.phase==='roam'&&game.self?.alive&&game.availableActions?.includes('move')&&ROOM_LAYOUT.find(r=>r.id===game.self.roomId)?.neighbors.includes(target);
}
function deck(game){
 const wrapper=h('div',{class:'deck','aria-label':'Beacon deck. Rooms and observed keeper positions.'});
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');
 for(const location of ROOM_LAYOUT)for(const neighborId of location.neighbors){
  if(location.id>neighborId)continue;
  const neighbor=ROOM_LAYOUT.find(r=>r.id===neighborId),line=document.createElementNS(svg.namespaceURI,'line');
  for(const [key,val]of Object.entries({x1:location.x,y1:location.y,x2:neighbor.x,y2:neighbor.y}))line.setAttribute(key,val);
  svg.append(line);
 }
 wrapper.append(svg);
 for(const location of ROOM_LAYOUT){
  const occupants=(game?.players||[]).filter(p=>p.roomId===location.id&&p.alive);
  const current=game?.self?.roomId===location.id;
  const movable=canMove(game,location.id);
  const b=button(location.name,()=>{if(movable)act('move',{roomId:location.id});else tell(`${location.name}: ${location.description}${game?.self?' Move only to a connected room when your movement cooldown is ready.':''}`);},{class:`room${current?' current':''}`,'aria-label':`${location.name}. ${location.description}${current?' You are here.':''}${occupants.length?` Observed: ${occupants.map(p=>p.name).join(', ')}.`:''}`,'data-focus':`room-${location.id}`,'data-room':location.id,'aria-disabled':String(!movable)});
  b.replaceChildren(h('strong',{},location.name),h('span',{class:'occupants'},occupants.length?occupants.map(p=>p.name).join(' · '):'—'));
  b.style.left=`${location.x}%`;b.style.top=`${location.y}%`;wrapper.append(b);
 }
 return wrapper;
}
function crew(game){
 return h('ul',{class:'crew-list'},(game?.players||CHARACTERS).map(p=>h('li',{},h('span',{class:'avatar','aria-hidden':'true'},p.name[0]),h('span',{class:'crew-name'},p.name,h('small',{},p.alive===false?'Fallen':p.id===room?.seatId?'You · human keeper':room?.mode==='human'&&p.id==='p1'?'Human keeper':'AI keeper')),p.role?h('span',{class:'tag'},p.role):null)));
}
function modeTag(){
 const ai=room?.ai;
 return h('span',{class:`tag ${ai?.mode==='live'?'':'demo'}`},aiLabel(ai));
}
function landing(){
 return harbor({create,pending});
}
function setConfirmation(value,returnTo,current){
 if(current!==epoch)return;
 confirmTarget=value;render();
 if(returnTo){
  const key=`eliminate-${returnTo}`;
  const trigger=[...main.querySelectorAll('[data-focus]')].find(node=>node.getAttribute('data-focus')===key);
  if(trigger?.isConnected&&!trigger.disabled)trigger.focus({preventScroll:true});
 }
}
function saveFocus(){
 const active=document.activeElement;
 return {key:active?.getAttribute('data-focus'),start:active?.selectionStart,end:active?.selectionEnd,scroll:main.querySelector('.dialogue')?.scrollTop};
}
function restoreFocus(saved){
 if(saved.key){const target=[...main.querySelectorAll('[data-focus]')].find(node=>node.getAttribute('data-focus')===saved.key);if(target&&target!==document.activeElement){target.focus({preventScroll:true});if(target.setSelectionRange&&typeof saved.start==='number'&&target.type!=='range')target.setSelectionRange(saved.start,saved.end);}}
 const log=main.querySelector('.dialogue');if(log&&saved.scroll!=null)log.scrollTop=saved.scroll;
}
function render(){
 const announcement=document.querySelector('#phase-status'),phase=room?.game?.phase||room?.phase;
 const phaseText=phase?phaseLabel(phase):'';if(announcement.textContent!==phaseText)announcement.textContent=phaseText;
 const inWorld=Boolean(roomId&&room&&(!room.game||room.game.worldVersion));
 document.body.classList.toggle('world-mode',inWorld);
 if(inWorld){
  const help=document.querySelector('#rules');if(help)help.hidden=true;
  const toggle=document.querySelector('#rules-toggle');toggle?.setAttribute('aria-expanded','false');
  renderWorld();return;
 }
 if(worldExperience)releaseWorld();
 const saved=saveFocus(),output=h('div');
 if(!roomId){output.append(landing());syncChildren(main,output);restoreFocus(saved);return;}
 if(!room){output.append(h('div',{class:'loading'},h('h1',{},'Finding the beacon…'),h('p',{},'Connecting to your room.'),button('Retry connection',()=>openRoom(roomId),{'data-focus':'reconnect'}),button('Back to harbor',home)));syncChildren(main,output);restoreFocus(saved);return;}
 const game=room.game,now=Date.now()+offset,current=epoch;
 if(game&&!game.worldVersion)output.append(h('p',{class:'notice'},'This earlier watch keeps its original board and replay. Exit to start a new walking-world watch.'));
 output.append(h('div',{id:'watch-heading',class:'game-heading'},h('div',{},h('p',{class:'eyebrow'},phaseLabel(game?.phase||room.phase)),h('h1',{},game?.phase==='ended'?'The watch has ended.':game?'The watch is yours.':'All keepers aboard.'),h('span',{class:'connection'},room.seatId?'Your crew seat · ':'Spectating · ',room.roomId,connected?' · Connected':' · Polling connection')),h('div',{class:'actions'},modeTag(),button('Copy room link',async()=>{try{await navigator.clipboard.writeText(location.href);tell('Room link copied. Visitors join as spectators.');}catch{tell(`Share this address: ${location.href}`);}},{'data-focus':'copy-link'}),button('Leave room',home,{'data-focus':'leave-room'}))));
 for(const notice of room.notices||[])output.append(h('p',{class:'notice'},typeof notice==='string'?notice:notice.message||'AI mode changed.'));
 if(room.ai?.limitReason&&!(room.notices||[]).length)output.append(h('p',{class:'notice'},aiNotice(room.ai.limitReason)));
 if(game?.sabotage?.active)output.append(criticalPanel(game,now));
 if(game?.deadlineAt)output.append(h('div',{id:'phase-clock',class:'phase-note'},h('span',{},game.phase==='roam'?'Next council in':'Phase ends in'),timer(game.deadlineAt,now)));
 const council=game&&['discussion','voting'].includes(game.phase);
 const grid=h('div',{id:'game-layout',class:`game-grid${council?' council-layout':''}${!game?' lobby-layout':''}`});
 const options={pending,act,now,draft,setDraft:value=>{draft=value;},confirmTarget,setConfirm:(value,returnTo)=>setConfirmation(value,returnTo,current)};
 const left=h('div',{class:'stack'});
 if(game)left.append(watchPanel(game,options));
 left.append(h('section',{class:'panel crew-panel'},h('h2',{},'The six keepers'),crew(game)));grid.append(left);
 if(council)grid.append(councilPanel(game,options));
 else grid.append(h('section',{class:'panel deck-panel'},h('div',{class:'panel-title'},h('h2',{},'Beacon deck'),h('span',{class:'tag'},'Observed positions')),deck(game),h('p',{class:'empty'},game?.self?game.phase==='ended'?'The final deck positions are shown above.':'Choose a connected room to move. Only nearby keepers are visible.':'Observe the public deck. Private roles stay hidden.')));
 const right=h('div',{class:'stack'});
 if(game){
  for(const panel of [taskPanel(game,options),timelinePanel(game)])if(panel)right.append(panel);
  const results=resultsPanel(game,{replay,loadReplay,replayIndex,setReplayIndex:value=>{replayIndex=Math.max(0,Math.min(replay.length-1,value));render();},pending});
  if(results)grid.prepend(results);
 }else right.append(h('section',{class:'panel'},h('h2',{},'Ready to cast off?'),h('p',{class:'muted'},room.seatId?'You play Iona. Five AI keepers join your watch. Your role is assigned when the match starts.':'Six AI keepers are ready. You observe their public actions and council.'),room.isHost?button('Start the watch',start,{class:'primary',disabled:pending,'data-focus':'start'}):h('p',{},'Waiting for the host to start.')));
 grid.append(right);output.append(grid);syncChildren(main,output);restoreFocus(saved);
}
const rulesToggle=document.querySelector('#rules-toggle'),rules=document.querySelector('#rules');
function closeRules(){rules.hidden=true;rulesToggle.setAttribute('aria-expanded','false');rulesToggle.focus();}
rulesToggle.onclick=()=>{rules.hidden=!rules.hidden;rulesToggle.setAttribute('aria-expanded',String(!rules.hidden));};
document.querySelector('#rules-close').onclick=closeRules;
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!rules.hidden)closeRules();});
document.addEventListener('visibilitychange',()=>{if(!roomId)return;if(document.hidden)stop();else openRoom(roomId);});
document.querySelector('.wordmark').onclick=event=>{event.preventDefault();home();};
window.addEventListener('pagehide',()=>{releaseWorld();stop();});
window.addEventListener('pageshow',event=>{if(event.persisted&&roomId)openRoom(roomId);});
window.addEventListener('popstate',()=>{const id=roomIdFromPath(location.pathname);if(id)openRoom(id);else{releaseWorld();stop();room=roomId=null;render();}});
const initial=roomIdFromPath(location.pathname);
if(initial)openRoom(initial);
else{
 let remembered;try{remembered=sessionStorage.getItem('lantern-room');}catch{}
 if(remembered&&/^[A-Za-z0-9_-]{1,100}$/.test(remembered))openRoom(remembered,undefined,{remembered:true});else render();
}
setInterval(()=>{if(document.hidden)return;if(worldExperience&&room)worldExperience.update(room,{now:Date.now()+offset,connected:networkReady,pending,feedback:feedback.textContent});for(const item of document.querySelectorAll('[data-deadline]'))item.textContent=clockText(secondsUntil(Number(item.dataset.deadline),Date.now()+offset));},500);
