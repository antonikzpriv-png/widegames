import {dom,control,setText} from './dom.mjs';
import {createWorldScene} from './scene.mjs';
import {createReplayModel,createReplayClock,restoreReplayTime} from './replay-model.mjs';
import {worldReplayText} from './replay.mjs';
import {aiNotice} from '../presentation.mjs';
import {replaySequenceOf} from '../../shared/replay.mjs';

export function recordedAiText(ai){
 if(!ai)return 'AI mode and usage were not recorded for this history.';
 const mode=ai.mode==='live'&&ai.strategy==='strategic'?'STRATEGIC · model plans / local execution':({demo:'DEMO · local keepers',live:'HYBRID · live council / local navigation',hybrid:'HYBRID · recorded provider and local policy',strategic:'STRATEGIC · recorded strategy'})[ai.mode]||'AI mode not recorded';
 const fallback=ai.limitReason&&ai.limitReason!=='demo_configured'?` Fallback: ${aiNotice(ai.limitReason)}`:'';
 const usage=['calls','tokens','costUsd'].filter(k=>Number.isFinite(ai[k])&&ai[k]>=0).map(k=>`${k==='costUsd'?'USD reserved ceiling':k==='tokens'?'tokens reserved ceiling':'calls reserved'}: ${ai[k]}`).join(' · ');
 return `${mode}${ai.strategy&&!['demo','hybrid','strategic'].includes(ai.strategy)?` · ${String(ai.strategy).slice(0,160)}`:''}.${fallback} ${usage||'Usage counters unavailable.'} Completion totals only; conservative reservations are not provider invoices.`;
}
export function createSpatialReplay(host,response,{game,roomId}={}){
 const model=createReplayModel(response,{matchId:game.matchId,roomId,players:game.players,mapId:game.mapId,mapRevision:game.mapRevision??1});
 let disposed=false,selected='',perspective='',overview=true,roles=true,index=0,eventLimit=Infinity,lastPaint=-Infinity,snapshot;
 const canvas=dom('canvas','lw-replay-canvas'),coverage=dom('p','lw-replay-coverage',model.coverage.description),limits=dom('p','lw-replay-limits','Recorded routes use map geometry. Manual movement and missing routes use held recorded samples; travel between samples is unknown. Unrecognized events stay in the log; their spatial effects may be unavailable.'),usage=dom('p','lw-replay-usage',recordedAiText(response.ai)),toolbar=dom('div','lw-replay-toolbar'),play=control('Play',togglePlayback),speed=dom('select'),follow=dom('select'),view=dom('select'),overviewButton=control('Overview',()=>{overview=!overview;overviewButton.setAttribute('aria-pressed',String(overview));paint(clock.time);}),rolesButton=control('Postgame roles',()=>{roles=!roles;rolesButton.setAttribute('aria-pressed',String(roles));paint(clock.time);}),range=dom('input'),seek=dom('input','lw-replay-seek'),label=dom('label'),eventText=dom('p','lw-replay-event'),timeText=dom('p','lw-replay-time'),history=dom('div','lw-replay-history'),ballots=dom('p','lw-replay-ballots'),bookmarks=dom('select'),details=dom('details','lw-replay-log'),log=dom('ol'),controls=dom('div','lw-replay-controls');
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Recorded ${model.mapName} positions. Playback does not control the game.`);
 const scene=createWorldScene(canvas,{playback:true,reduced:true});
 const clock=createReplayClock({...model.coverage,onFrame:time=>{if(time-lastPaint>=70||time<lastPaint||time>=model.coverage.through){lastPaint=time;paint(time);}setText(play,clock.playing&&time<model.coverage.through?'Pause':'Play');}});
 for(const value of [.25,.5,1,2,4]){const o=dom('option','',`${value}×`);o.value=value;o.selected=value===1;speed.append(o);}speed.setAttribute('aria-label','Playback speed');speed.addEventListener('change',()=>clock.setSpeed(Number(speed.value)));
 const all=dom('option','','Overview camera');all.value='';follow.append(all);follow.setAttribute('aria-label','Follow keeper');
 const omniscient=dom('option','','Postgame overview');omniscient.value='';view.append(omniscient);view.setAttribute('aria-label','Historical character perspective');
 for(const p of game.players){for(const select of [follow,view]){const option=dom('option','',p.name);option.value=p.id;select.append(option);}}
 follow.addEventListener('change',()=>{selected=follow.value;overview=!selected;overviewButton.setAttribute('aria-pressed',String(overview));paint(clock.time);});view.addEventListener('change',()=>{perspective=view.value;paint(clock.time);});
 overviewButton.setAttribute('aria-pressed','true');rolesButton.setAttribute('aria-pressed','true');rolesButton.title='Final revealed roles for postgame analysis; not what characters knew at this time.';
 toolbar.append(play,speed,follow,view,overviewButton,rolesButton);
 range.type='range';range.step='1';range.id='spatial-replay-'+game.matchId;label.htmlFor=range.id;
 const first=Math.max(0,model.events.findIndex(e=>e.at>=model.coverage.from&&(!model.metadata?.anchor||(replaySequenceOf(e)??-1)>=model.metadata.anchor.sequence)));range.min=String(first);range.max=String(Math.max(first,model.events.length-1));index=first;eventLimit=first;
 function seekIndex(value){const target=Math.max(first,Math.min(model.events.length-1,value));eventLimit=target;clock.pause();const e=model.events[target];clock.seek(e?.at??model.coverage.from);paint(clock.time);setText(play,'Play');}
 function togglePlayback(){
  if(clock.playing){clock.pause();paint(clock.time);}
  else{
   const finishTie=clock.time>=model.coverage.through&&eventLimit<model.events.length-1;
   eventLimit=Infinity;lastPaint=-Infinity;
   if(finishTie)paint(clock.time);
   else{if(clock.time>=model.coverage.through)clock.seek(model.coverage.from);clock.play();}
  }
  setText(play,clock.playing?'Pause':'Play');
 }
 seek.type='range';seek.min=String(model.coverage.from);seek.max=String(model.coverage.through);seek.step='any';seek.setAttribute('aria-label','Seek recorded time');seek.addEventListener('input',()=>{eventLimit=Infinity;clock.pause();clock.seek(restoreReplayTime(Number(seek.value),model.events));paint(clock.time);setText(play,'Play');});
 range.addEventListener('input',()=>seekIndex(Number(range.value)));eventText.setAttribute('aria-live','polite');
 const prev=control('Previous event',()=>seekIndex(index-1)),next=control('Next event',()=>seekIndex(index+1));controls.append(prev,next);
 bookmarks.setAttribute('aria-label','Event bookmarks');const empty=dom('option','','Jump to a recorded event');empty.value='';bookmarks.append(empty);
 for(let i=0;i<model.events.length;i++){
  const e=model.events[i],text=worldReplayText(e,game),li=dom('li','',`${i<first?'Outside spatial coverage · ':''}${e.at} · ${text}`);log.append(li);
  if(i>=first&&(['meeting','voting','vote_result','ejected','witness','ended'].includes(e.type)||['task','sabotage','repair','say','report'].includes(e.action?.type))){const o=dom('option','',`${e.at} · ${text.slice(0,110)}`);o.value=i;bookmarks.append(o);}
 }
 bookmarks.addEventListener('change',()=>{if(bookmarks.value!=='')seekIndex(Number(bookmarks.value));});
 details.append(dom('summary','','Read the complete attributed log'),log);
 host.append(dom('h2','','SPATIAL · ROLE-REVEALED REPLAY'),coverage,limits,usage,toolbar,canvas,label,range,dom('label','','Recorded time'),seek,timeText,eventText,controls,bookmarks,ballots,history,details);
 function paint(time,limit=eventLimit){
  if(disposed)return;snapshot=model.at(time,limit);
  if(limit===Infinity){index=first;for(let i=first;i<model.events.length&&model.events[i].at<=time;i++)index=i;}else index=limit;
  const e=model.events[index];range.value=String(index);seek.value=String(time);setText(label,`Event ${model.events.length?index+1:0} of ${model.events.length}`);setText(eventText,e?worldReplayText(e,game):'No recorded events.');setText(timeText,`Recorded timestamp ${time} · ${snapshot.phase}`);host.dataset.replayTime=String(time);host.dataset.replayPhase=snapshot.phase;
  prev.disabled=index<=first;next.disabled=index>=model.events.length-1;
  const perspectiveState=perspective?model.perspective(snapshot,perspective):null;
  const drawGame={...snapshot,replayRoles:roles,replayFollow:selected,players:snapshot.players.map(p=>({...p,position:perspectiveState&&!perspectiveState.visible.includes(p.id)?null:p.position,role:roles?snapshot.roles[p.id]:null})),events:perspectiveState?snapshot.events.filter(b=>perspectiveState.bodies.includes(b.id)):snapshot.events};
  scene.update({roomId:roomId??response.roomId,game:drawGame},time);scene.draw(time,{overview,follow:selected});
  setText(ballots,`Postgame ballot overlay · ${(snapshot.meeting?.votes||[]).map(v=>`${name(v.playerId)} → ${v.targetId==='skip'?'skip':name(v.targetId)}`).join('; ')||'No ballots recorded yet.'} Final roles shown here do not imply earlier knowledge.`);
  history.replaceChildren();
  if(perspectiveState){history.append(dom('h3','',`${name(perspective)} · historical perspective`),dom('p','',perspectiveState.label),dom('p','',`Own recorded role: ${perspectiveState.ownRole||'unavailable'}. Recorded elimination observations: ${perspectiveState.observations.length}. Earlier observations may be absent in partial histories.`));for(const o of perspectiveState.observations.slice(-6))history.append(dom('p','',`Recorded observation at ${o.at}: ${worldReplayText(o,game)}`));}
  history.append(dom('h3','','Public claims and recorded context'),dom('p','','Analysis keeps public claims, captured observations and reconstructed visibility separate. No automatic truth verdict.'));
  for(const {claim,evidence,label:comparison} of model.claims(snapshot,perspective||undefined)){const row=dom('section','lw-replay-claim');row.append(dom('strong','',`Public claim at ${claim.at} · ${name(claim.playerId)}`),dom('p','',claim.action.text),dom('small','',comparison));for(const event of evidence)row.append(dom('p','',`Recorded event at ${event.at}: ${worldReplayText(event,game)}`));history.append(row);}
  const activity=snapshot.activity.slice(-4);if(activity.length){history.append(dom('h3','','Recorded activity'));for(const event of activity)history.append(dom('p','',`${event.at} · ${worldReplayText(event,game)}`));}
 }
 function name(id){return game.players.find(p=>p.id===id)?.name||id||'unknown';}
 const visibility=()=>{if(document.hidden){clock.pause();setText(play,'Play');}};
 document.addEventListener('visibilitychange',visibility);clock.seek(model.coverage.from);paint(model.coverage.from,first);
 const refresh=()=>paint(clock.time);globalThis.addEventListener?.('resize',refresh);
 return {model,clock,range,refresh,pause(){clock.pause();setText(play,'Play');},dispose(){if(disposed)return;disposed=true;clock.dispose();scene.dispose();globalThis.removeEventListener?.('resize',refresh);document.removeEventListener('visibilitychange',visibility);host.replaceChildren();}};
}
