import {ROOM_LAYOUT,CHARACTERS} from '../shared/contracts.mjs';
import {element as h,button,phaseLabel,secondsUntil,clockText,syncChildren} from './ui.mjs';
import {request,roomPath,actionEnvelope,roomFrom,roomIdFromPath} from './api.mjs';
import {watchPanel,taskPanel,criticalPanel,councilPanel,timelinePanel,resultsPanel,timer} from './panels.mjs';
import {replayEvents,aiNotice,aiLabel} from './presentation.mjs';

const main=document.querySelector('#main');
const feedback=document.querySelector('#feedback');
let room=null,roomId=null,controller=null,socket=null,poll=null;
let epoch=0,pending=false,offset=0,connected=false,connectionIssue=false;
let draft='',draftMeeting=null,confirmTarget=null,replay=null,replayIndex=0,retry=null;
const attemptedJoins=new Set();

function tell(message,error=false){
 connectionIssue=false;
 feedback.replaceChildren(...(message?[h('span',{},message)]:[]));
 feedback.classList.toggle('error',error);
 if(retry)feedback.append(button('Retry same request',()=>retry?.(),{class:'quiet'}));
}
function connectionFailure(message){tell(message,true);connectionIssue=true;}
function persistId(id){
 try{if(id)sessionStorage.setItem('lantern-room',id);else sessionStorage.removeItem('lantern-room');}catch{}
}
function stop(){
 const uncertain=Boolean(retry);
 epoch++;
 controller?.abort();controller=null;
 clearTimeout(poll);poll=null;
 connected=false;pending=false;retry=null;
 if(uncertain)connectionFailure('Resynchronizing the room. Check its current state before acting again.');
 if(socket){socket.onclose=null;socket.onerror=null;socket.close();socket=null;}
}
async function busy(fn){
 if(pending)return;
 const current=epoch,focus=saveFocus();
 pending=true;render();
 try{await fn();}
 catch(error){if(current===epoch&&error.name!=='AbortError')tell(error.message,true);}
 finally{if(current===epoch){const lostFocus=document.activeElement===document.body;pending=false;render();if(lostFocus)restoreFocus(focus);}}
}
function accept(data){
 const next=roomFrom(data);
 if(roomId&&next.roomId!==roomId)return;
 if(room?.game&&!next.game)return;
 if(room?.game&&next.game&&(next.game.version<room.game.version||(next.game.version===room.game.version&&next.game.serverNow<room.game.serverNow)))return;
 room=next;
 if(connectionIssue)tell('Connection restored.');
 if(room.game?.serverNow)offset=room.game.serverNow-Date.now();
 const meeting=room.game?.meeting?.id;
 if(meeting!==draftMeeting){draft='';draftMeeting=meeting;}
 render();
}
async function create(mode){
 stop();controller=new AbortController();
 await busy(async()=>{
  const current=epoch;
  const data=await request('/api/rooms',{method:'POST',body:{mode},signal:controller.signal});
  if(current!==epoch)return;
  await openRoom(roomFrom(data).roomId,data);
  tell(mode==='human'?'Your crew seat is ready.':'Spectator room ready.');
 });
}
async function openRoom(id,initial){
 const changed=id!==roomId;
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
 const current=epoch,id=roomId;
 await busy(async()=>{
  try{
   const data=await request(roomPath(id,suffix),{method:'POST',body,signal:controller.signal});
   if(current!==epoch)return;
   retry=null;accept(data);onSuccess?.();
  }catch(error){
   if(current!==epoch||error.name==='AbortError')return;
   if(error.status==null||error.status>=500){retry=()=>mutation(suffix,body,onSuccess);tell('The request could not be confirmed. Retry keeps the same request ID so an accepted action cannot run twice.',true);}
   else{retry=null;tell(error.message,true);}
  }
 });
}
function start(){return mutation('/start',{id:crypto.randomUUID()},()=>tell('The watch has begun.'));}
function act(type,fields={}){
 return mutation('/action',actionEnvelope(type,fields),()=>{
  if(type==='say')draft='';
  confirmTarget=null;
  tell(({move:'You moved to the next room.',task:'Task complete.',repair:'Repair contribution received.',vote:'Your vote is recorded.',say:'Message sent.',report:'Report received.',meeting:'Emergency bell rung.',sabotage:'Critical sabotage triggered.',eliminate:'Elimination received.'})[type]||'Action received.');
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
 return h('section',{class:'hero'},h('div',{},h('p',{class:'eyebrow'},'A storm beacon. Six keepers. One saboteur.'),h('h1',{},'Keep the light.',h('br'),'Question the quiet.'),h('p',{},'The storm has cut us off. Walk the decks, keep the beacon alive, and decide which familiar face is hiding a different purpose.'),h('div',{class:'actions'},button('Join the crew',()=>create('human'),{class:'primary',disabled:pending,'data-focus':'create-human'}),button('Watch the keepers',()=>create('spectator'),{disabled:pending,'data-focus':'create-spectator'})),h('p',{class:'muted'},'Play one keeper with five AI companions, or watch six AI keepers. No account needed.')),h('div',{class:'panel'},h('div',{class:'panel-title'},h('h2',{},'The drifting beacon'),h('span',{class:'tag'},'06 rooms')),deck(null),h('div',{class:'deck-caption'},h('span',{},'LANTERN WAKE'),h('span',{},'NORTH / STORMWARD'))));
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
 const saved=saveFocus(),output=h('div');
 const announcement=document.querySelector('#phase-status'),phase=room?.game?.phase||room?.phase;
 const phaseText=phase?phaseLabel(phase):'';if(announcement.textContent!==phaseText)announcement.textContent=phaseText;
 if(!roomId){output.append(landing());syncChildren(main,output);restoreFocus(saved);return;}
 if(!room){output.append(h('div',{class:'loading'},h('h1',{},'Finding the beacon…'),h('p',{},'Connecting to your room.'),button('Retry connection',()=>openRoom(roomId),{'data-focus':'reconnect'}),button('Back to harbor',home)));syncChildren(main,output);restoreFocus(saved);return;}
 const game=room.game,now=Date.now()+offset,current=epoch;
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
window.addEventListener('pagehide',stop);
window.addEventListener('pageshow',event=>{if(event.persisted&&roomId)openRoom(roomId);});
window.addEventListener('popstate',()=>{const id=roomIdFromPath(location.pathname);if(id)openRoom(id);else{stop();room=roomId=null;render();}});
const initial=roomIdFromPath(location.pathname);
if(initial)openRoom(initial);
else{
 let remembered;try{remembered=sessionStorage.getItem('lantern-room');}catch{}
 if(remembered&&/^[A-Za-z0-9_-]{1,100}$/.test(remembered))openRoom(remembered);else render();
}
setInterval(()=>{for(const item of document.querySelectorAll('[data-deadline]'))item.textContent=clockText(secondsUntil(Number(item.dataset.deadline),Date.now()+offset));},500);
