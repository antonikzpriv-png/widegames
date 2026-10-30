import {SETTING_FIELDS,PERSONAS} from '../shared/lobby.mjs';
import {worldReplayText} from './world/replay.mjs';
import {drawKeeper} from './world/scene.mjs';
const dom=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const labels={capacity:'Keeper capacity',saboteurs:'Saboteurs',tasksPerCrew:'Tasks per crew',speed:'Walking speed',vision:'Vision radius',taskCooldownMs:'Task cooldown (seconds)',killCooldownMs:'Elimination cooldown (seconds)',initialKillCooldownMs:'First elimination delay (seconds)',sabotageCooldownMs:'Sabotage cooldown (seconds)',criticalDurationMs:'Critical countdown (seconds)',meetingCooldownMs:'Emergency cooldown (seconds)',discussionMs:'Discussion (seconds)',votingMs:'Voting (seconds)',meetingsPerPlayer:'Emergencies per keeper',sabotageEnabled:'Enable sabotage',emergencyMeetingsEnabled:'Enable emergency bell'};
/** Persistent controls preserve typing and focus across frequent room updates. */
export function createLobbyPanel({host,mutate,start,report,archive}){
 let room,disabled=false,rosterKey='',archiveKey='',settingsDirty=false,settingsEdit=0;const controls=new Map();
 const title=dom('h1','YOUR CREW. YOUR WATCH.'),intro=dom('p','Invite friends, claim a keeper, then ready up. AI fills every unclaimed seat.'),invitation=dom('p',undefined,'lw-invitation');
 const copy=dom('button','Copy invitation','lw-secondary');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);report('Invitation copied. Friends can claim a lobby seat.');}catch{report(`Share ${location.href}`);}};
 const roster=dom('div',undefined,'lw-lobby-roster'),profile=dom('form',undefined,'lw-lobby-profile');
 const name=dom('input');name.name='playerName';name.maxLength=24;name.autocomplete='nickname';name.setAttribute('aria-label','Your keeper name');
 const color=dom('select');color.setAttribute('aria-label','Raincoat color');for(const [i,p]of PERSONAS.entries()){const o=dom('option',`Raincoat ${i+1}`);o.value=p.color;color.append(o);}
 const save=dom('button','Save appearance','lw-secondary');save.type='submit';profile.append(name,color,save);profile.onsubmit=e=>{e.preventDefault();send('/profile',{name:name.value,color:color.value});};
 const actions=dom('div',undefined,'lw-lobby-actions');
 const claim=dom('button','Claim a keeper','lw-primary'),release=dom('button','Become spectator','lw-secondary'),ready=dom('button','Ready','lw-secondary');
 for(const b of [claim,release,ready]){b.type='button';actions.append(b);}
 claim.onclick=()=>send('/seat',{seatId:'auto'});release.onclick=()=>send('/seat',{seatId:null});ready.onclick=()=>send('/ready',{ready:!room.ready});
 const settings=dom('form',undefined,'lw-lobby-settings'),legend=dom('h2','Watch settings'),fields=dom('div',undefined,'lw-settings-grid');settings.append(legend,fields);
 for(const [key,range]of Object.entries(SETTING_FIELDS)){
  const label=dom('label',labels[key]),input=dom('input');input.name=key;input.type=range==='boolean'?'checkbox':'number';const seconds=key.endsWith('Ms');
  if(range!=='boolean'){input.min=range[0]/(seconds?1000:1);input.max=range[1]/(seconds?1000:1);input.step=range[2]/(seconds?1000:1);}
  label.append(input);fields.append(label);controls.set(key,input);
 }
 const settingsState=dom('p',undefined,'lw-settings-state');settingsState.setAttribute('aria-live','polite');
 for(const input of controls.values())for(const event of ['input','change'])input.addEventListener(event,()=>{settingsDirty=true;settingsEdit++;settingsState.textContent='Unsaved changes';});
 const apply=dom('button','Apply settings','lw-secondary');apply.type='submit';settings.append(settingsState,apply);settings.onsubmit=async e=>{e.preventDefault();const edit=settingsEdit,result=await send('/settings',{settings:Object.fromEntries([...controls].map(([key,input])=>[key,input.type==='checkbox'?input.checked:Number(input.value)*(key.endsWith('Ms')?1000:1)]))});if(result&&edit===settingsEdit){settingsDirty=false;settingsState.textContent='Settings applied';}};
 const begin=dom('button','Begin the watch','lw-primary');begin.type='button';begin.dataset.lobbyStart='';begin.onclick=()=>start();
 const note=dom('p',undefined,'lw-lobby-note'),past=dom('details',undefined,'lw-lobby-archives'),pastList=dom('div'),pastLog=dom('ol',undefined,'lw-archive-log');past.append(dom('summary','Completed watch replays'),pastList,pastLog);host.replaceChildren(title,intro,invitation,copy,roster,profile,actions,begin,settings,note,past);
 async function send(route,body){try{return await mutate(route,body);}catch(error){report(error.message);}}
 return {update(next,{pending=false,connected=true}={}){
  room=next;disabled=pending||!connected;const self=room.seats.find(p=>p.id===room.seatId);
  invitation.textContent=`Invitation ${room.inviteCode} · Watch ${room.generation} · ${room.settings.capacity} keepers / ${room.settings.saboteurs} saboteur${room.settings.saboteurs===1?'':'s'}`;
  claim.hidden=!!self;release.hidden=!self;ready.hidden=!self;profile.hidden=!self;ready.textContent=room.ready?'Not ready':'Ready';
  for(const b of [claim,release,ready,save,apply])b.disabled=disabled;
  if(self&&document.activeElement!==name&&name.dataset.seat!==self.id){name.value=self.name;color.value=self.color;name.dataset.seat=self.id;}
  for(const [key,input]of controls){input.disabled=!room.isHost||disabled;if(!settingsDirty&&!settings.contains(document.activeElement)){if(input.type==='checkbox')input.checked=room.settings[key];else input.value=room.settings[key]/(key.endsWith('Ms')?1000:1);}}
  apply.hidden=!room.isHost;begin.hidden=!room.isHost;begin.disabled=disabled||room.seats.some(p=>p.human&&!p.ready);
  note.textContent=room.isHost?'Every human must be ready. Applying settings resets readiness. Unclaimed seats use demo or configured hybrid AI.':'Your room cookie keeps your seat on reconnect. New visitors can only spectate after the watch begins.';
  past.hidden=!room.archives?.length;const archiveVersion=JSON.stringify(room.archives);if(archiveVersion!==archiveKey){archiveKey=archiveVersion;pastLog.replaceChildren();pastList.replaceChildren(...(room.archives||[]).map(a=>{const b=dom('button',`Replay watch ${a.generation}`,'lw-secondary');b.type='button';b.onclick=async()=>{if(disabled)return;b.disabled=true;try{const result=await archive(a.matchId);pastLog.replaceChildren(...result.replay.map(event=>dom('li',worldReplayText(event,{phase:'ended',players:result.players}))));}catch(error){report(error.message);}finally{b.disabled=false;}};return b;}));}
  const key=JSON.stringify([room.seats,room.isHost,room.seatId,disabled]);if(key!==rosterKey){rosterKey=key;roster.replaceChildren(...room.seats.map(p=>{
   const card=dom('div',undefined,'lw-seat'),portrait=dom('canvas');portrait.width=80;portrait.height=94;portrait.setAttribute('aria-hidden','true');drawKeeper(portrait.getContext('2d'),p,40,64,{label:false});
   card.append(portrait,dom('strong',`${p.name} · #${p.badge}`),dom('span',p.human?`${p.id===room.seatId?'You · ':''}${p.revoked?'Access revoked':p.ready?'Ready':'Not ready'}${p.host?' · Host':''}`:'AI keeper'));
   if(room.isHost&&p.human&&!p.host){const kick=dom('button',`Remove #${p.badge}`,'lw-secondary');kick.type='button';kick.disabled=disabled;kick.onclick=()=>send('/members',{seatId:p.id,operation:'release'});card.append(kick);}return card;
  }));}
 }};
}
