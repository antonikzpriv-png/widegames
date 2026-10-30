import {control,setText} from './dom.mjs';
import {equipmentOwner,mapKey} from './map-model.mjs';
/** Optional, local, gesture-enabled synthesized cues. Starts muted per instance. */
export function createLocalSound({win=window,doc=document,onError=()=>{}}={}){
 let enabled=false,context=null,disposed=false,generation=0,owner=null,previous=null,busy=false,watch=null,resuming=false;const voices=new Set();
 const node=control('Sound: off',async()=>{if(busy||disposed)return;if(enabled){enabled=false;generation++;stop();context?.suspend?.().catch?.(()=>{});paint();return;}
  const pin=generation;busy=true;paint();try{const Audio=win.AudioContext||win.webkitAudioContext;if(!Audio)throw Error('Local synthesized sound is unavailable in this browser.');context||=new Audio();await context.resume();if(disposed||doc.hidden||pin!==generation)return;enabled=true;}catch(error){if(!disposed&&pin===generation)onError(error?.message||'Sound could not be enabled.');}finally{busy=false;if(!disposed)paint();}
 },'lw-sound-toggle');
 function paint(){setText(node,enabled?'Sound: on':'Sound: off');node.setAttribute('aria-pressed',String(enabled));node.setAttribute('aria-label',enabled?'Mute local game sounds':'Enable optional local game sounds');node.disabled=busy;}
 function stop(){for(const voice of voices){try{voice.osc.stop();voice.osc.disconnect();voice.gain.disconnect();}catch{}}voices.clear();}
 function cue(kind){if(!enabled||disposed||doc.hidden||!context||context.state==='suspended')return;const notes=kind==='ended'?[392,494,587]:kind==='critical'?[220,277]:kind==='discussion'?[330,440]:[392];
  try{const at=context.currentTime;for(const [index,frequency]of notes.entries()){const osc=context.createOscillator(),gain=context.createGain(),start=at+index*.14;osc.type='sine';osc.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.025,start+.02);gain.gain.linearRampToValueAtTime(0,start+.12);osc.connect(gain);gain.connect(context.destination);const voice={osc,gain};voices.add(voice);osc.onended=()=>{voices.delete(voice);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+.13);}}catch{enabled=false;generation++;stop();paint();onError('Local sound stopped. Game controls remain available.');}
 }
 paint();
 return {node,get enabled(){return enabled;},update(room){const nextOwner=equipmentOwner(room),g=room?.game,nextWatch=JSON.stringify([room?.roomId,g?.matchId,mapKey(g?.map??room?.map),g?.self?.id]),next=g?{phase:g.phase,critical:!!g.sabotage?.active}:null;if(watch!==nextWatch){watch=nextWatch;previous=null;}if(owner!==nextOwner){generation++;owner=nextOwner;stop();}if(enabled&&!doc.hidden&&context?.state==='suspended'&&!resuming){const pin=generation;resuming=true;Promise.resolve(context.resume()).catch(()=>{if(pin===generation&&!disposed){enabled=false;paint();onError('Sound paused. Enable it again to resume local cues.');}}).finally(()=>{resuming=false;});}
  if(previous&&next&&enabled&&!doc.hidden){if(next.phase!==previous.phase&&['discussion','voting','ended'].includes(next.phase))cue(next.phase);else if(next.critical&&!previous.critical)cue('critical');}previous=next;
 },suspend(){generation++;stop();context?.suspend?.().catch?.(()=>{});},dispose(){if(disposed)return;disposed=true;enabled=false;generation++;stop();context?.close?.().catch?.(()=>{});node.remove();}};
}
