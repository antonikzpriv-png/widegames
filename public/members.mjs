import {trapDialog,restoreTrigger} from './world/dom.mjs';
const dom=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
/** Host controls consume public seat metadata, never assignments or identity digests. */
export function createMemberControls({id,mutate,report,onOpen}){
 let room,open=false,disabled=false,rendered='';
 const trigger=dom('button','Manage crew','lw-secondary');trigger.type='button';trigger.setAttribute('aria-expanded','false');
 const panel=dom('section',undefined,'lw-member-controls'),box=dom('div',undefined,'lw-member-box'),heading=dom('h2','Crew controls'),note=dom('p','Revoking access disconnects that player. Their active seat stays idle until the next lobby; no AI or visitor takes over.'),roster=dom('ul'),close=dom('button','Close crew controls','lw-secondary');
 heading.id=id+'-members';panel.id=id+'-member-panel';trigger.setAttribute('aria-controls',panel.id);panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby',heading.id);panel.hidden=true;box.append(heading,note,roster,close);panel.append(box);close.type='button';
 function setOpen(value){open=value;panel.hidden=!value;trigger.setAttribute('aria-expanded',String(value));if(value){onOpen();close.focus();}else restoreTrigger(trigger);}
 trigger.onclick=()=>setOpen(!open);close.onclick=()=>setOpen(false);panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);}else trapDialog(panel,event);});
 return {trigger,panel,get open(){return open;},update(next,{pending=false,connected=true}={}){
  room=next;disabled=pending||!connected;trigger.hidden=!room.isHost||!room.game||['ended','paused'].includes(room.game.phase);trigger.disabled=disabled;if(trigger.hidden&&open){open=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');}
  const key=JSON.stringify([room.seats,disabled]);if(key===rendered)return;rendered=key;
  roster.replaceChildren(...room.seats.map(seat=>{const row=dom('li'),name=dom('strong',`${seat.name} #${seat.badge}`),status=dom('span',seat.revoked?'Access revoked · seat idle':seat.host?'Host':seat.human?'Human keeper':'AI keeper');row.append(name,status);
   if(seat.human&&!seat.host&&!seat.revoked){const revoke=dom('button',`Revoke #${seat.badge}`,'lw-secondary');revoke.type='button';revoke.disabled=disabled;revoke.onclick=async()=>{try{await mutate('/members',{seatId:seat.id,operation:'revoke'});report(`Access revoked for ${seat.name} #${seat.badge}. The seat remains idle.`);}catch(error){if(error.name!=='AbortError')report(error.message);}finally{if(open)close.focus();}};row.append(revoke);}return row;}));
 },dispose(){open=false;trigger.remove();panel.remove();}};
}
