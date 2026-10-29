import {element as h,button,clockText,secondsUntil} from './ui.mjs';
import {canAct,localBodies,localTargets,nameOf,roomName,eventText,outcomeText} from './presentation.mjs';
export function timer(deadline,now,label='Time remaining'){
 return h('span',{class:'timer',role:'timer','aria-label':label,'data-deadline':deadline},clockText(secondsUntil(deadline,now)));
}
export function watchPanel(game,{pending,act,now,confirmTarget,setConfirm}){
 const self=game.self;
 const pane=h('section',{class:'panel watch-panel'},h('p',{class:'eyebrow'},self?'Your assignment':'Public observation'),h('h2',{},self?self.role==='saboteur'?'You are the saboteur.':'You are crew.':'You are a spectator.'),h('p',{class:'muted'},self?self.alive?self.role==='saboteur'?'Blend in, sabotage the beacon, and reach parity with the crew.':'Complete your tasks, repair the beacon, and identify the saboteur.':'You have fallen. You can keep watching, but can no longer act. Unfinished crew tasks are reassigned.':'Follow the keepers without a private role. Their roles are revealed after the match.'));
 if(game.tasks)pane.append(h('div',{class:'panel-title'},h('span',{},'Crew tasks'),h('strong',{},`${game.tasks.completed} / ${game.tasks.total}`)),h('progress',{class:'task-progress',value:game.tasks.completed,max:game.tasks.total||1,'aria-label':'Crew tasks complete'}));
 if(game.phase==='paused')pane.append(h('p',{class:'notice'},'The maximum watch duration was reached. The server paused the match without declaring a winner.'));
 if(!self||!self.alive||game.phase!=='roam')return pane;
 pane.append(h('p',{class:'location'},'You are in ',h('strong',{},roomName(self.roomId))));
 for(const body of localBodies(game))pane.append(button(`Report ${nameOf(game,body.playerId)}`,()=>act('report',{bodyId:body.bodyId}),{class:'danger',disabled:!canAct(game,'report',pending),'data-focus':`report-${body.bodyId}`}));
 if(game.sabotage?.active)pane.append(button('Help repair critical system',()=>act('repair'),{disabled:!canAct(game,'repair',pending),'data-focus':'repair'}));
 if(self.role==='saboteur'){
  pane.append(h('div',{class:'control-row'},button('Trigger critical sabotage',()=>act('sabotage'),{class:'danger',disabled:!canAct(game,'sabotage',pending),'data-focus':'sabotage'}),cooldown(self.cooldowns?.sabotageAt,now,'Sabotage')));
  for(const target of localTargets(game)){
   if(confirmTarget===target.id)pane.append(h('div',{class:'confirm'},h('p',{},`Eliminate ${target.name}? This cannot be undone.`),h('div',{class:'actions'},button('Confirm elimination',()=>{setConfirm(null);act('eliminate',{targetId:target.id});},{class:'danger',disabled:!canAct(game,'eliminate',pending),'data-focus':`eliminate-${target.id}`}),button('Cancel',()=>setConfirm(null)))));
   else pane.append(button(`Eliminate ${target.name}…`,()=>setConfirm(target.id),{class:'danger',disabled:!canAct(game,'eliminate',pending),'data-focus':`eliminate-${target.id}`}));
  }
  pane.append(cooldown(self.cooldowns?.killAt,now,'Elimination'));
 }
 pane.append(h('div',{class:'control-row'},button(`Ring emergency bell (${self.meetingsRemaining} left)`,()=>act('meeting'),{disabled:!canAct(game,'meeting',pending),'data-focus':'meeting'}),h('small',{},'Bridge only · unavailable during sabotage'),cooldown(self.cooldowns?.meetingAt,now,'Emergency bell')));
 return pane;
}
function cooldown(deadline,now,label){return deadline>now?h('small',{class:'cooldown'},`${label} ready in `,timer(deadline,now,`${label} cooldown`)):null;}
export function taskPanel(game,{pending,act}){
 const tasks=game.self?.tasks;
 if(!tasks?.length)return null;
 return h('section',{class:'panel'},h('h2',{},'Your tasks'),h('ul',{class:'task-list'},tasks.map(task=>h('li',{},h('div',{},h('strong',{},task.label),h('small',{},roomName(task.roomId),task.completed?' · Complete':'')),!task.completed?button('Complete',()=>act('task',{taskId:task.id}),{disabled:task.roomId!==game.self.roomId||!canAct(game,'task',pending),'aria-label':`Complete ${task.label}`,'data-focus':`task-${task.id}`}):h('span',{'aria-label':'Completed'},'✓')))));
}
export function criticalPanel(game,now){
 const critical=game.sabotage;if(!critical?.active)return null;
 return h('section',{class:'panel critical',role:'region','aria-label':'Critical sabotage'},h('div',{class:'panel-title'},h('h2',{},'Critical system failing'),timer(critical.deadlineAt,now,'Critical system time remaining')),h('p',{},`Repair in ${roomName(critical.roomId)} · ${critical.repairsCompleted} / ${critical.repairsRequired} keepers contributed.`),h('small',{},'The critical countdown continues during council.'));
}
export function councilPanel(game,{pending,act,now,draft,setDraft}){
 if(!['discussion','voting'].includes(game.phase))return null;
 const meeting=game.meeting||{},isDiscussion=game.phase==='discussion',votes=meeting.votes||[];
 const pane=h('section',{class:'panel council','aria-label':isDiscussion?'Council discussion':'Council voting'},h('div',{class:'panel-title'},h('h2',{},isDiscussion?'Council discussion':'Cast your vote'),game.deadlineAt?timer(game.deadlineAt,now):null),h('p',{class:'muted'},meeting.reason==='report'?`${nameOf(game,meeting.calledBy)} reported a fallen keeper.`:meeting.reason==='timeout'?'The watch timer called everyone to council.':`${nameOf(game,meeting.calledBy)} called an emergency council.`));
 const log=h('ol',{class:'dialogue','aria-label':'Council messages'});
 for(const message of meeting.messages||[])log.append(h('li',{},h('strong',{},nameOf(game,message.playerId)),h('p',{},message.text)));
 if(!log.children.length)log.append(h('li',{class:'empty'},'The council is quiet. Share what you witnessed.'));
 pane.append(log);
 if(isDiscussion&&game.self?.alive){
  const id='council-message',input=h('textarea',{id,name:'message',maxlength:280,rows:3,placeholder:'What did you see?','data-focus':'council-message',disabled:!canAct(game,'say',pending),oninput:event=>setDraft(event.target.value)});input.value=draft;
  pane.append(h('form',{onsubmit:event=>{event.preventDefault();const text=event.currentTarget.elements.namedItem('message').value.trim();if(!text)return;act('say',{text});}},h('label',{for:id},'Your message'),input,h('div',{class:'panel-title'},h('small',{},'Up to 280 characters · limited messages per council'),h('button',{type:'submit',class:'primary',disabled:!canAct(game,'say',pending),'data-focus':'send-message'},'Send message'))));
 }else if(isDiscussion)pane.append(h('p',{class:'empty'},'Listen to the council. Only living keepers can speak.'));
 else{
  pane.append(h('p',{class:'muted'},'A unique highest vote ejects a keeper. Ties, no votes, or a winning skip leave everyone aboard. Missed votes abstain. Your choice is final; targets remain hidden until tally.'));
  const voted=votes.some(v=>v.playerId===game.self?.id);
  const choices=h('div',{class:'vote-options'});
  for(const player of game.players.filter(p=>(meeting.eligibleVoters||[]).includes(p.id)))choices.append(button(player.name,()=>act('vote',{targetId:player.id}),{disabled:voted||!canAct(game,'vote',pending),'data-focus':`vote-${player.id}`,'aria-label':`Vote to eject ${player.name}`}));
  choices.append(button('Skip ejection',()=>act('vote',{targetId:'skip'}),{class:'quiet',disabled:voted||!canAct(game,'vote',pending),'data-focus':'vote-skip'}));pane.append(choices,h('p',{class:'vote-status',role:'status'},voted?'Your vote is recorded.':!game.self?'Spectators cannot vote.':!game.self.alive?'Fallen keepers cannot vote.':'Choose a keeper or skip.'),h('p',{class:'muted'},`${votes.length} / ${(meeting.eligibleVoters||[]).length} votes cast`));
 }
 return pane;
}
export function timelinePanel(game){
 const events=(game.events||[]).filter(e=>e.type!=='said').slice(-12).reverse();
 return h('section',{class:'panel'},h('h2',{},'Watch log'),h('ol',{class:'timeline'},events.length?events.map(event=>h('li',{},h('span',{},eventText(event,game)))):h('li',{class:'empty'},'The watch is quiet.')));
}
export function resultsPanel(game,{replay,loadReplay,replayIndex,setReplayIndex,pending}){
 if(game.phase!=='ended')return null;
 const pane=h('section',{class:'panel results'},h('p',{class:'eyebrow'},'The truth comes ashore'),h('h2',{},game.outcome?.winner==='crew'?'The crew kept the light.':'The saboteur prevailed.'),h('p',{},outcomeText(game.outcome?.reason)),h('ul',{class:'revealed'},game.players.map(player=>h('li',{},h('strong',{},player.name),h('span',{class:`tag ${player.role==='saboteur'?'demo':''}`},player.role||'Unknown')))));
 if(!replay)pane.append(button('Load full replay',loadReplay,{class:'primary',disabled:pending,'data-focus':'load-replay'}));
 else{
  const current=replay[replayIndex],range=h('input',{type:'range',id:'replay-step',min:0,max:Math.max(0,replay.length-1),value:replayIndex,'data-focus':'replay-step',oninput:event=>setReplayIndex(Number(event.target.value))});
  pane.append(h('h3',{},'Role-revealed replay'),h('p',{class:'muted'},'Recorded events and attributed actions from this match.'),h('label',{for:'replay-step'},`Event ${replay.length?replayIndex+1:0} of ${replay.length}`),range,h('p',{class:'replay-event','aria-live':'polite'},current?eventText(current,game):'No recorded events.'),h('div',{class:'actions'},button('Previous',()=>setReplayIndex(replayIndex-1),{disabled:replayIndex<=0,'data-focus':'replay-prev'}),button('Next',()=>setReplayIndex(replayIndex+1),{disabled:replayIndex>=replay.length-1,'data-focus':'replay-next'})),h('details',{},h('summary',{},'Read the complete replay'),h('ol',{class:'timeline replay-log'},replay.map(event=>h('li',{},eventText(event,game))))));
 }
 return pane;
}
