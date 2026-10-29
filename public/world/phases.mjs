import {dom,control,setText} from './dom.mjs';
import {drawKeeper} from './scene.mjs';
import {clock} from './model.mjs';
import {replayEvents,outcomeText} from '../presentation.mjs';
import {worldReplayText as readableReplay} from './replay.mjs';
const nameOf=(game,id)=>game.players.find(p=>p.id===id)?.name||id||'The watch';
function avatar(player,size=64){const canvas=dom('canvas','lw-avatar');canvas.width=size;canvas.height=size;canvas.setAttribute('aria-hidden','true');drawKeeper(canvas.getContext('2d'),player,size/2,size*.72,{scale:size/90,label:false,ghost:player.alive===false});return canvas;}

export function createCouncil({id,action,feedback,pending}){
 let game=null,lastMeeting=null,composing=false,sending=false,lastSubmitted=null;
 const node=dom('section','lw-council'),heading=dom('h1'),reason=dom('p','lw-council-reason'),timer=dom('span','lw-council-clock'),transition=dom('p','lw-meeting-transition'),roster=dom('div','lw-council-roster'),messages=dom('ol','lw-chat-log'),form=dom('form','lw-chat-form'),label=dom('label','','What did you see?'),chat=dom('textarea'),send=dom('button','lw-primary','Send message'),hint=dom('p','lw-council-hint'),skip=control('Skip ejection',()=>vote('skip'),'lw-secondary'),ballots=dom('p','lw-ballot-status'),rules=dom('p','lw-vote-rules','A unique highest vote ejects a keeper. Ties or a winning skip keep everyone aboard. Missed votes abstain.');
 node.setAttribute('aria-labelledby',`${id}-council-title`);heading.id=`${id}-council-title`;timer.setAttribute('role','timer');timer.setAttribute('aria-label','Council time remaining');transition.setAttribute('role','status');messages.setAttribute('aria-label','Council messages');messages.setAttribute('aria-live','polite');messages.setAttribute('aria-relevant','additions');label.htmlFor=`${id}-chat`;chat.id=`${id}-chat`;chat.name='message';chat.rows=2;chat.maxLength=280;chat.placeholder='Your observations, not your private thoughts…';send.type='submit';
 const header=dom('header','lw-council-heading'),chatPane=dom('div','lw-chat-pane'),rosterPane=dom('div','lw-roster-pane'),columns=dom('div','lw-council-columns');header.append(heading,timer);form.append(label,chat,send,hint);rosterPane.append(roster,skip,ballots,rules);chatPane.append(messages,form);columns.append(rosterPane,chatPane);node.append(transition,header,reason,columns);
 const players=new Map(),messageNodes=new Map();
 chat.addEventListener('compositionstart',()=>composing=true);chat.addEventListener('compositionend',()=>{composing=false;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(composing||event.isComposing||sending||pending()||game?.phase!=='discussion'||!game.self?.alive||!game.availableActions?.includes('say'))return;
  const text=chat.value.trim();if(!text)return;const meeting=game.meeting?.id,originDraft=chat.value;sending=true;lastSubmitted=originDraft;send.disabled=true;
  try{await action('say',{text});if(game?.meeting?.id===meeting&&chat.value===originDraft&&!composing)chat.value='';}catch(error){feedback(error?.message||'Message not sent. Your draft is preserved.');}finally{sending=false;send.disabled=pending()||game?.phase!=='discussion'||!game.availableActions?.includes('say');}
 });
 async function vote(targetId){if(pending()||!game?.self?.alive||game.phase!=='voting'||!game.availableActions?.includes('vote')||game.meeting?.votes?.some(v=>v.playerId===game.self.id))return;try{await action('vote',{targetId});}catch(error){feedback(error?.message||'Vote could not be sent.');}}
 return {node,chat,update(next,{now}){
  game=next;const meeting=game.meeting||{},discussion=game.phase==='discussion',votes=meeting.votes||[],eligible=meeting.eligibleVoters||[],canVote=game.self?.alive&&game.availableActions?.includes('vote')&&!pending()&&!votes.some(v=>v.playerId===game.self.id);
  if(lastMeeting!==meeting.id){lastMeeting=meeting.id;chat.value='';messageNodes.clear();messages.replaceChildren();lastSubmitted=null;transition.classList.remove('lw-arrived');void transition.offsetWidth;transition.classList.add('lw-arrived');}
  setText(transition,meeting.reason==='report'?'FALLEN KEEPER REPORTED':meeting.reason==='timeout'?'WATCH COUNCIL':'EMERGENCY BELL');
  setText(heading,discussion?'WHO CAN WE TRUST?':'MAKE YOUR CALL.');setText(timer,clock(game.deadlineAt||meeting.deadlineAt,now));setText(reason,meeting.reason==='report'?`${nameOf(game,meeting.calledBy)} reported a fallen keeper.`:meeting.reason==='timeout'?'The watch deadline brought everyone to council.':`${nameOf(game,meeting.calledBy)} rang the emergency bell.`);
  const ids=new Set(game.players.map(p=>p.id));for(const [id,entry]of players)if(!ids.has(id)){entry.node.remove();players.delete(id);}
  for(const player of game.players){
   let entry=players.get(player.id);if(!entry){const row=dom('div','lw-council-keeper'),icon=avatar(player),name=dom('strong','',player.name),state=dom('span','lw-vote-cast'),voteButton=control('Vote',()=>vote(player.id),'lw-vote-button'),info=dom('div','lw-roster-name');info.append(name,state);row.append(icon,info,voteButton);roster.append(row);entry={node:row,name,state,voteButton};players.set(player.id,entry);}
   entry.node.dataset.alive=String(player.alive);setText(entry.name,`${player.name}${player.badge?` #${player.badge}`:''}${player.id===game.self?.id?' (you)':''}`);setText(entry.state,!player.alive?'Fallen':votes.some(v=>v.playerId===player.id)?'Vote recorded':discussion?'On watch':'Choosing…');entry.voteButton.hidden=discussion;entry.voteButton.disabled=!canVote||!eligible.includes(player.id);entry.voteButton.setAttribute('data-vote-target',player.id);entry.voteButton.setAttribute('aria-label',`Vote to eject ${player.name}${player.badge?` #${player.badge}`:''}`);
  }
  const atEnd=messages.scrollHeight-messages.scrollTop-messages.clientHeight<55;
  for(const message of meeting.messages||[]){if(messageNodes.has(message.id))continue;const row=dom('li'),name=dom('strong','',nameOf(game,message.playerId)),body=dom('p','',message.text);row.append(name,body);messages.append(row);messageNodes.set(message.id,row);if(message.playerId===game.self?.id&&lastSubmitted&&message.text===lastSubmitted.trim()&&chat.value===lastSubmitted&&!composing){chat.value='';lastSubmitted=null;}}
  if(atEnd)messages.scrollTop=messages.scrollHeight;
  form.hidden=!discussion||!game.self?.alive;send.disabled=sending||pending()||!game.availableActions?.includes('say');chat.readOnly=!game.availableActions?.includes('say');
  setText(hint,!game.availableActions?.includes('say')?'Council message limit reached. Your draft stays here.':'Up to 280 characters. Messages are limited per council.');
  skip.hidden=discussion;skip.disabled=!canVote;rules.hidden=discussion;
  setText(ballots,discussion?!game.self?'Spectating: listen to the council.':!game.self.alive?'Fallen keepers can listen.':'Discuss what you actually observed.':`${votes.length}/${eligible.length} votes recorded. ${!game.self?'Spectators cannot vote.':!game.self.alive?'Fallen keepers cannot vote.':votes.some(v=>v.playerId===game.self.id)?'Your vote is final.':'Choose a keeper or skip.'}`);
 },focus(){if(!form.hidden&&!chat.readOnly)chat.focus();else heading.focus();}};
}

export function createResults({id,loadReplay,feedback,isCurrent}){
 let game=null,replay=null,index=0,loading=false,generation=0;
 const node=dom('section','lw-results'),eyebrow=dom('p','lw-eyebrow','THE TRUTH COMES ASHORE'),heading=dom('h1'),reason=dom('p'),roster=dom('div','lw-results-roster'),load=control('Open the role-revealed replay',async()=>{
  if(loading||game?.phase!=='ended')return;const pin=game.matchId,current=++generation;loading=true;load.disabled=true;
  try{const response=await loadReplay();if(!isCurrent(pin)||current!==generation)return;replay=replayEvents(response);index=0;replayPane.hidden=false;load.hidden=true;log.replaceChildren(...replay.map(e=>dom('li','',readableReplay(e,game))));showStep();range.focus();}catch(error){if(isCurrent(pin))feedback(error?.message||'Replay could not be loaded. Try again.');}finally{loading=false;load.disabled=false;}
 },'lw-primary'),replayPane=dom('div','lw-replay'),range=dom('input'),rangeLabel=dom('label'),eventText=dom('p','lw-replay-event'),prev=control('Previous event',()=>{index=Math.max(0,index-1);showStep();}),next=control('Next event',()=>{index=Math.min((replay?.length||1)-1,index+1);showStep();}),details=dom('details','lw-replay-log'),summary=dom('summary','','Read the complete attributed log'),log=dom('ol');
 range.type='range';range.min=0;range.max=0;range.value=0;range.id=`${id}-replay`;rangeLabel.htmlFor=range.id;range.addEventListener('input',()=>{index=Number(range.value);showStep();});eventText.setAttribute('aria-live','polite');const controls=dom('div','lw-replay-controls');controls.append(prev,next);details.append(summary,log);replayPane.append(dom('h2','','ROLE-REVEALED REPLAY'),rangeLabel,range,eventText,controls,details);replayPane.hidden=true;node.append(eyebrow,heading,reason,roster,load,replayPane);
 function showStep(){range.max=Math.max(0,(replay?.length||0)-1);range.value=index;setText(rangeLabel,`Event ${replay?.length?index+1:0} of ${replay?.length||0}`);setText(eventText,replay?.[index]?readableReplay(replay[index],game):'No recorded events.');prev.disabled=index<=0;next.disabled=index>=(replay?.length||0)-1;}
 let rendered=null;
 return {node,update(nextGame){game=nextGame;if(rendered===game.matchId)return;rendered=game.matchId;replay=null;generation++;index=0;load.hidden=false;replayPane.hidden=true;setText(heading,game.outcome?.winner==='crew'?'THE LIGHT LIVES ON.':'THE LIGHT WENT OUT.');node.dataset.winner=game.outcome?.winner||'unknown';setText(reason,outcomeText(game.outcome?.reason));roster.replaceChildren(...game.players.map(p=>{const card=dom('div','lw-revealed-keeper');card.append(avatar({...p,alive:true},90),dom('strong','',p.badge?`${p.name} #${p.badge}`:p.name),dom('span',p.role==='saboteur'?'lw-revealed-saboteur':'',p.role||'Role not supplied'));return card;}));},dispose(){generation++;}};
}
