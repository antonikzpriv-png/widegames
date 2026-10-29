import {CHARACTERS} from '../shared/contracts.mjs';
import {element as h,button} from './ui.mjs';
import {drawKeeper} from './world/scene.mjs';

/** The harbor is a menu. Match state and role assignment begin on the server. */
export function harbor({create,pending,joinInvitation}){
 const keepers=h('div',{class:'harbor-keepers','aria-label':'The six keepers'});
 for(const player of CHARACTERS){
  const portrait=document.createElement('canvas');portrait.width=128;portrait.height=150;portrait.setAttribute('aria-hidden','true');
  drawKeeper(portrait.getContext('2d'),player,64,105,{scale:1.4,label:false});
  keepers.append(h('div',{class:'harbor-keeper'},portrait,h('span',{},player.name)));
 }
 const join=h('form',{class:'harbor-join'}),code=h('input',{'aria-label':'Invitation code',placeholder:'Invitation code',maxlength:12,'data-focus':'invite-code'});join.onsubmit=event=>{event.preventDefault();joinInvitation(code.value);};join.append(code,h('button',{type:'submit',disabled:pending},'Join friends'));
 return h('section',{class:'harbor'},
  h('div',{class:'harbor-weather','aria-hidden':'true'}),
  h('p',{class:'harbor-kicker'},'A STORM BEACON. YOUR CREW. HIDDEN SABOTEURS.'),
  h('h1',{},'LANTERN',h('span',{},'WAKE')),
  h('p',{class:'harbor-intro'},'Walk the decks. Keep the light alive. Watch who follows you.'),
  keepers,join,
  h('div',{class:'harbor-actions'},
   button('PLAY AS A KEEPER',()=>create('human'),{class:'harbor-play',disabled:pending,'data-focus':'create-human'}),
   button('WATCH THE AI',()=>create('spectator'),{class:'harbor-watch',disabled:pending,'data-focus':'create-spectator'})),
  h('p',{class:'harbor-controls'},'WASD / arrows to walk',h('span',{},'E use station'),h('span',{},'R report'),h('span',{},'Touch controls available')),
  h('p',{class:'harbor-demo'},'Credential-free demo keepers available. Live hybrid council is configured by the host.')
 );
}
