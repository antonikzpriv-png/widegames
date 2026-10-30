import {element as h,button} from './ui.mjs';
import * as world from '../shared/world.mjs';
import {createWaitingRoomScene} from './waiting-room-scene.mjs';
import {createPregameCustomization,normalisePregameDraft} from './pregame-customization.mjs';

// Pre-flight choices belong to this browser session until the server creates a
// room. They never mutate shared defaults, another room, or a running match.
let launchDraft=normalisePregameDraft(),mounted=null;
const snapshot=()=>structuredClone(launchDraft);

/** The launch room is an illustrated, interactive lobby, before role assignment. */
export function harbor(options){
 if(mounted?.node.isConnected){mounted.update(options);return mounted.node;}
 let callbacks=options;
 const header=h('header',{class:'launch-header'},h('div',{},h('h1',{},'LANTERN ',h('span',{},'WAKE')),h('p',{},'STORM BEACON / CREW ASSEMBLY')),h('span',{class:'launch-room-status'},'WAITING FOR DEPARTURE'));
 const summary=h('p',{class:'launch-selection-summary','aria-live':'polite'}),bottom=h('div',{class:'launch-bottom'});
 const node=h('section',{class:'harbor launch-bay','aria-label':'Lantern Wake waiting room'},header);
 function choose(mode,draft=launchDraft){launchDraft=normalisePregameDraft(draft);return callbacks.create(mode,snapshot());}
 const customization=createPregameCustomization({id:'launch',value:snapshot(),onChange:next=>{launchDraft=normalisePregameDraft(next);refresh();},onChooseMode:choose});
 const scene=createWaitingRoomScene({profile:launchDraft.profile,onSettings:trigger=>customization.open('settings',trigger),onWardrobe:trigger=>customization.open('wardrobe',trigger)});
 const play=button('PLAY AS A KEEPER',()=>choose('human'),{class:'harbor-play','data-focus':'create-human','data-launch-play':''});
 play.append(h('small',{},'Play with friends and AI'));
 const watch=button('WATCH THE AI',()=>choose('spectator'),{class:'harbor-watch','data-focus':'create-spectator','data-launch-watch':''});
 watch.append(h('small',{},'Observe a full AI watch'));
 const resume=button('Resume your watch',()=>callbacks.resume?.(),{class:'launch-resume','data-launch-resume':''});
 const join=h('form',{class:'harbor-join'}),code=h('input',{'aria-label':'Invitation code',placeholder:'Invitation code',maxlength:12,autocomplete:'off',spellcheck:'false','data-focus':'invite-code'}),joinButton=h('button',{type:'submit'},'Join friends');
 join.onsubmit=event=>{event.preventDefault();if(!callbacks.pending)callbacks.joinInvitation(code.value);};join.append(code,joinButton);
 bottom.append(summary,h('div',{class:'harbor-actions'},play,watch),join,resume,h('p',{class:'launch-demo'},'Use the left computer to configure your watch. Open the right wardrobe to change your keeper. Demo AI needs no account or provider key.'));
 node.append(scene.node,bottom,customization.node);
 function refresh(){const draft=launchDraft,map=world.MAPS?.find(m=>m.id===draft.mapId),count=draft.settings.saboteurs;summary.replaceChildren(h('strong',{},map?.name||'Lantern Wake'),` · ${draft.settings.capacity} keepers · ${count} saboteur${count===1?'':'s'} · ${draft.settings.tasksPerCrew} tasks / crew`);scene.update(draft.profile,{pending:callbacks.pending});resume.hidden=!callbacks.resume;resume.disabled=!!callbacks.pending;for(const b of [play,watch,joinButton])b.disabled=!!callbacks.pending;code.disabled=!!callbacks.pending;customization.update(snapshot(),{pending:!!callbacks.pending});}
 mounted={node,update(next){callbacks=next;refresh();}};refresh();return node;
}
