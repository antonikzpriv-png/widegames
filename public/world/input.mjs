/** Input leases contain direction only; the server remains the movement authority. */
export function createWorldInput({target,joystick,knob,getState,onInput,onClick,onShortcut,onError=()=>{},clock=()=>performance.now(),win=window,doc=document}){
 let sequence=0,keys=new Set(),stick=null,route=[],lastSent=-Infinity,lastVector={dx:0,dy:0},disposed=false,timer=null,pointer=null;
 const typing=e=>e.target?.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"]');
 const moving=()=>{const state=getState();return !disposed&&!doc.hidden&&state.enabled;};
 const send=(dx,dy,force=false)=>{
  if(disposed&&!force)return;
  const now=clock();if(!force&&dx===lastVector.dx&&dy===lastVector.dy&&(!dx&&!dy||now-lastSent<190))return;
  lastVector={dx,dy};lastSent=now;
  sequence=Math.max(sequence,getState().inputSeq||0)+1;
  try{Promise.resolve(onInput({seq:sequence,dx,dy})).catch(error=>onError(error));}catch(error){onError(error);}
 };
 const stop=()=>{keys.clear();stick=null;route=[];pointer=null;if(knob)knob.style.transform='translate(0px,0px)';send(0,0,true);};
 const vector=()=>{
  if(!moving())return {dx:0,dy:0};
  let dx=0,dy=0;
  if(keys.has('a')||keys.has('arrowleft'))dx--;
  if(keys.has('d')||keys.has('arrowright'))dx++;
  if(keys.has('w')||keys.has('arrowup'))dy--;
  if(keys.has('s')||keys.has('arrowdown'))dy++;
  if(stick){dx=stick.dx;dy=stick.dy;}
  if(!dx&&!dy&&route.length){const pos=getState().position;if(pos){while(route.length&&Math.hypot(route[0].x-pos.x,route[0].y-pos.y)<12)route.shift();if(route.length){dx=route[0].x-pos.x;dy=route[0].y-pos.y;}}}
  const length=Math.hypot(dx,dy);return length?{dx:dx/length,dy:dy/length}:{dx:0,dy:0};
 };
 const tick=()=>{if(!moving()){if(lastVector.dx||lastVector.dy)stop();return;}const {dx,dy}=vector();send(dx,dy);};
 const keydown=e=>{
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||typing(e))return;
  const key=e.key.toLowerCase();
  if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)&&moving()){
   e.preventDefault();route=[];keys.add(key);tick();
  }else if(!e.repeat&&['e',' ','q','r','m'].includes(key)){
   // Space retains native activation for focused controls.
   if(key===' '&&e.target?.closest?.('button,a,summary'))return;
   e.preventDefault();if(key!=='m')stop();onShortcut(key);
  }
 };
 const keyup=e=>{const key=e.key.toLowerCase();if(keys.delete(key)){e.preventDefault();tick();}};
 const visibility=()=>{if(doc.hidden)stop();};
 const click=e=>{if(!moving()||e.button!==0)return;const path=onClick(e);if(path){keys.clear();stick=null;route=path;tick();}};
 const stickMove=e=>{if(e.pointerId!==pointer)return;const r=joystick.getBoundingClientRect();const x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,length=Math.hypot(x,y),scale=Math.min(38,length)/(length||1);stick=length<9?{dx:0,dy:0}:{dx:x/length,dy:y/length};knob.style.transform=`translate(${x*scale}px,${y*scale}px)`;tick();};
 const stickDown=e=>{if(!moving())return;e.preventDefault();pointer=e.pointerId;route=[];keys.clear();joystick.setPointerCapture(e.pointerId);stickMove(e);};
 const stickEnd=e=>{if(e.pointerId===pointer)stop();};
 win.addEventListener('keydown',keydown);win.addEventListener('keyup',keyup);win.addEventListener('blur',stop);doc.addEventListener('visibilitychange',visibility);
 target.addEventListener('click',click);joystick.addEventListener('pointerdown',stickDown);joystick.addEventListener('pointermove',stickMove);joystick.addEventListener('pointerup',stickEnd);joystick.addEventListener('pointercancel',stickEnd);joystick.addEventListener('lostpointercapture',stickEnd);
 timer=win.setInterval(tick,50);
 return {stop,sync(){sequence=Math.max(sequence,getState().inputSeq||0);if(!moving()&&(lastVector.dx||lastVector.dy))stop();},dispose(){if(disposed)return;stop();disposed=true;win.clearInterval(timer);win.removeEventListener('keydown',keydown);win.removeEventListener('keyup',keyup);win.removeEventListener('blur',stop);doc.removeEventListener('visibilitychange',visibility);target.removeEventListener('click',click);joystick.removeEventListener('pointerdown',stickDown);joystick.removeEventListener('pointermove',stickMove);joystick.removeEventListener('pointerup',stickEnd);joystick.removeEventListener('pointercancel',stickEnd);joystick.removeEventListener('lostpointercapture',stickEnd);}};
}
