import {getMap} from '../../shared/maps/index.mjs';
import {dom,setText} from './dom.mjs';
import {drawKeeper} from './scene.mjs';
import {finitePoint} from './beacon-model.mjs';
import {roomName,mapKey} from './map-model.mjs';
const LIMIT=8;
export function cameraCardsModel(room,{mapResolver=getMap,connected=true}={}){
 const g=room?.game;if(!g?.self)return {cards:[],total:0};const cards=[];
 for(const sample of g.investigation?.observations||[]){
  if(sample.kind!=='cameras'||!Number.isFinite(sample.at)||!Array.isArray(sample.data?.frames))continue;
  const date=new Date(sample.at);if(!Number.isFinite(date.getTime()))continue;
  // New samples identify their owner/map. Legacy owner views already enforce this.
  if(sample.provenance&&(sample.provenance.type!=='device'||sample.provenance.ownerId!==g.self.id))continue;
  for(const frame of sample.data.frames){
   if(!frame||typeof frame.cameraId!=='string')continue;
   let map;try{map=mapResolver(sample.map??g.map??room.map);}catch{cards.push({key:`${sample.id}:${frame.cameraId}`,at:sample.at,stamp:date.toISOString(),unavailable:'Sample map/version is unsupported.'});continue;}
   const camera=map.fixtures.cameras.find(c=>c.id===frame.cameraId);if(!camera)continue;
   const device=g.investigation?.devices?.find(d=>d.id===sample.deviceId),deviceName=map.fixtures.devices.find(d=>d.id===sample.deviceId)?.label||sample.deviceId||'Camera console';
   const players=(frame.players||[]).filter(p=>typeof p.id==='string'&&finitePoint(p.position)).map(p=>{const identity=g.players?.find(k=>k.id===p.id);return {id:p.id,name:identity?.name||'Unidentified keeper',color:identity?.color||'#c8b18a',position:{x:p.position.x,y:p.position.y}};});
   const field=frame.field&&finitePoint(frame.field.origin)&&Number.isFinite(frame.field.radius)&&frame.field.radius>0?{origin:{...frame.field.origin},radius:frame.field.radius,facingRad:frame.field.facingRad,fovRad:frame.field.fovRad}:null;
   cards.push({key:`${sample.id||sample.at}:${frame.cameraId}`,at:sample.at,stamp:date.toISOString(),map,camera,players,field,limited:frame.limited===true,source:deviceName,availability:!connected?'Reconnect for current console availability.':device?device.available?'Console available now':`Console unavailable now: ${device.reason||'access unavailable'}`:`Console: ${g.investigation?.status||'availability unknown'}`,unavailable:frame.status==='unavailable'?'Frame unavailable at sampling time.':null});
  }
 }
 cards.sort((a,b)=>b.at-a.at);return {cards:cards.slice(0,LIMIT),total:cards.length};
}
export function drawCameraCard(canvas,card){
 const ctx=canvas.getContext('2d');if(!ctx||card.unavailable)return;const width=canvas.width=320,height=canvas.height=190,g=card.map.geometry,origin=card.field?.origin||card.camera.position;
 const room=g.WORLD_ROOMS.find(r=>r.id===card.camera.roomId),points=[origin,...card.players.map(p=>p.position)];
 let minX=room?.x??origin.x-120,maxX=room?room.x+room.width:origin.x+120,minY=room?.y??origin.y-100,maxY=room?room.y+room.height:origin.y+100;
 for(const p of points){minX=Math.min(minX,p.x-25);maxX=Math.max(maxX,p.x+25);minY=Math.min(minY,p.y-30);maxY=Math.max(maxY,p.y+30);}
 if(card.field){minX=Math.min(minX,origin.x-card.field.radius);maxX=Math.max(maxX,origin.x+card.field.radius);minY=Math.min(minY,origin.y-card.field.radius);maxY=Math.max(maxY,origin.y+card.field.radius);}
 const scale=Math.min((width-20)/(maxX-minX),(height-20)/(maxY-minY));ctx.clearRect(0,0,width,height);ctx.fillStyle='#152e42';ctx.fillRect(0,0,width,height);ctx.save();ctx.translate(width/2,height/2);ctx.scale(scale,scale);ctx.translate(-(minX+maxX)/2,-(minY+maxY)/2);
 for(const floor of g.WORLD_FLOORS){ctx.fillStyle='#6c929b';ctx.strokeStyle='#233e50';ctx.lineWidth=3;ctx.fillRect(floor.x,floor.y,floor.width,floor.height);ctx.strokeRect(floor.x,floor.y,floor.width,floor.height);}
 if(card.field){ctx.fillStyle='#e5d69830';ctx.strokeStyle='#e5d698';ctx.lineWidth=2/scale;ctx.beginPath();const fov=card.field.fovRad??Math.PI*2,facing=card.field.facingRad??0;if(fov<Math.PI*2)ctx.moveTo(origin.x,origin.y);ctx.arc(origin.x,origin.y,card.field.radius,facing-fov/2,facing+fov/2);ctx.closePath();ctx.fill();ctx.stroke();}
 for(const p of card.players)drawKeeper(ctx,p,p.position.x,p.position.y,{scale:.7,label:false});
 ctx.fillStyle='#f2d389';ctx.beginPath();ctx.arc(origin.x,origin.y,6/scale,0,Math.PI*2);ctx.fill();ctx.restore();
}
export function createCameraCards({mapResolver=getMap}={}){
 const node=dom('section','lw-camera-cards'),heading=dom('h3','','DATED CAMERA FRAMES'),limit=dom('p'),cards=dom('div');node.append(heading,limit,cards);const entries=new Map();let owner=null;
 return {node,update(room,options={}){const key=JSON.stringify([room?.roomId,room?.game?.matchId,mapKey(room?.game?.map??room?.map),room?.game?.self?.id]);if(key!==owner){owner=key;entries.clear();cards.replaceChildren();}
  const model=cameraCardsModel(room,{mapResolver,connected:options.connected!==false});node.hidden=!model.total;setText(limit,`Showing ${model.cards.length} of ${model.total} supplied frames. Older frames remain in the observation log. These are saved samples, not a live feed.`);const ids=new Set();
  for(const card of model.cards){ids.add(card.key);let entry=entries.get(card.key);if(!entry){const section=dom('article','lw-camera-card'),title=dom('h4'),stamp=dom('p'),availability=dom('p'),canvas=dom('canvas','lw-camera-feed'),summary=dom('p');canvas.setAttribute('role','img');section.append(title,stamp,availability,canvas,summary);cards.append(section);entry={section,title,stamp,availability,canvas,summary};entries.set(card.key,entry);}
   setText(entry.title,card.map?`${card.map.name} - ${roomName(card.map,card.camera.roomId)}`:'Unsupported sample map');setText(entry.stamp,`${card.stamp}${card.source?' | Source: '+card.source:''}`);setText(entry.availability,card.availability||'');
   const text=card.unavailable||`${card.players.length} recorded positions${card.limited?' (limited sample; additional keepers omitted)':''}. ${card.players.map(p=>p.name).join(', ')||'No keepers recorded'}. ${card.field?'Sampled field radius '+card.field.radius+'.':'Legacy sample: field boundary not supplied.'}`;setText(entry.summary,text);entry.canvas.setAttribute('aria-label',`${card.stamp}. Historical camera frame. ${text}`);entry.canvas.hidden=!!card.unavailable;
   const signature=JSON.stringify([card.map?.id,card.map?.version,card.field,card.players,card.unavailable]);if(entry.signature!==signature){entry.signature=signature;drawCameraCard(entry.canvas,card);}
  }
  for(const [id,entry]of entries)if(!ids.has(id)){entry.section.remove();entries.delete(id);}
 },dispose(){entries.clear();node.remove();}};
}
