import * as world from '../../shared/world.mjs';
import {ActorSamples,clamp,point,visibleBodies} from './model.mjs';
import {CHARACTERS} from '../../shared/contracts.mjs';

const names={bridge:'BRIDGE',archive:'ARCHIVE',lantern:'LANTERN',workshop:'WORKSHOP',galley:'GALLEY',engine:'ENGINE'};
const palettes={bridge:['#68b1bf','#9dd2cc'],archive:['#9d93c6','#c5badb'],lantern:['#e6b861','#f4d998'],workshop:['#83ae9c','#aec9aa'],galley:['#c88979','#e4b29b'],engine:['#8899b1','#b4c1ce']};
function round(ctx,x,y,w,h,r=10,fill,stroke='#152c3c',line=5){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
function circle(ctx,x,y,r,fill,stroke='#152c3c',line=4){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}}
function text(ctx,value,x,y,size=16,color='#163346'){ctx.font=`900 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(value,x,y);}
/** Original keeper: broad rain hood, round brass lamp and a split raincoat. */
export function drawKeeper(ctx,player,x,y,{scale=1,step=0,selected=false,ghost=false,label=true}={}){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=ghost?.5:1;
 if(selected){ctx.strokeStyle='#fdf0b2';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,9,25,13,0,0,Math.PI*2);ctx.stroke();}
 ctx.fillStyle='#102a3a66';ctx.beginPath();ctx.ellipse(0,12,22,9,0,0,Math.PI*2);ctx.fill();
 const bob=Math.sin(step)*2;
 round(ctx,-15,3+Math.sin(step)*3,12,13,4,'#203b50',undefined,3);round(ctx,3,3-Math.sin(step)*3,12,13,4,'#203b50',undefined,3);
 round(ctx,-23,-27+bob,12,27,6,player.color||'#edb66c');round(ctx,13,-27+bob,10,27,6,player.color||'#edb66c');
 ctx.beginPath();ctx.moveTo(-17,-26+bob);ctx.quadraticCurveTo(0,-40+bob,17,-26+bob);ctx.lineTo(22,7+bob);ctx.quadraticCurveTo(0,15+bob,-22,7+bob);ctx.closePath();ctx.fillStyle=player.color||'#edb66c';ctx.fill();ctx.lineWidth=4;ctx.strokeStyle='#152c3c';ctx.stroke();
 ctx.beginPath();ctx.moveTo(0,-15+bob);ctx.lineTo(0,8+bob);ctx.strokeStyle='#152c3c';ctx.lineWidth=3;ctx.stroke();
 circle(ctx,0,-35+bob,22,player.color||'#edb66c');
 round(ctx,-15,-40+bob,30,20,9,'#274958',undefined,4);
 ctx.fillStyle='#c4f2e8';ctx.beginPath();ctx.ellipse(5,-32+bob,8,5,-.15,0,Math.PI*2);ctx.fill();
 round(ctx,-12,-59+bob,24,8,3,player.color||'#edb66c',undefined,3);circle(ctx,0,-55+bob,5,'#fff0b3',undefined,2);
 circle(ctx,15,-7+bob,5,'#ffe299',undefined,2);
 if(label){text(ctx,(player.badge?`${player.name} #${player.badge}`:player.name)||'Keeper',0,36,14,'#102d3e');ctx.lineWidth=4;ctx.strokeStyle='#eff8e8';ctx.strokeText((player.badge?`${player.name} #${player.badge}`:player.name)||'Keeper',0,36);text(ctx,(player.badge?`${player.name} #${player.badge}`:player.name)||'Keeper',0,36,14,'#102d3e');}
 ctx.restore();
}
function decor(ctx,room){
 const {x,y,width:w,height:h,id}=room;
 // Wall-mounted equipment is illustration; only shared geometry defines collisions.
 if(id==='archive'){
  for(let shelf=0;shelf<3;shelf++){round(ctx,x+22+shelf*98,y+25,82,55,3,'#5a596f');for(let b=0;b<5;b++)round(ctx,x+29+shelf*98+b*13,y+34,9,32,1,['#e2b878','#90beb7','#d58e80'][b%3],null);}
  text(ctx,'TIDE RECORDS',x+w/2,y+h-27,11,'#514e6c');
 }else if(id==='bridge'){
  round(ctx,740,170,120,60,14,'#c9a674');round(ctx,751,178,98,42,7,'#416e80');ctx.strokeStyle='#afd8d1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(756,206);ctx.lineTo(784,185);ctx.lineTo(807,211);ctx.lineTo(841,186);ctx.stroke();
  for(let i=0;i<3;i++)round(ctx,x+28+i*115,y+24,96,39,6,'#345667');
 }else if(id==='lantern'){
  circle(ctx,x+95,y+100,54,'#b98742');circle(ctx,x+95,y+100,40,'#f7d984');circle(ctx,x+95,y+100,24,'#fff3bc');
  text(ctx,'STORM OPTICS',x+105,y+h-25,11,'#715422');
 }else if(id==='workshop'){
  round(ctx,x+25,y+25,190,44,6,'#68816c');for(let i=0;i<5;i++){ctx.strokeStyle='#d8dfc1';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x+44+i*35,y+36);ctx.lineTo(x+44+i*35,y+58);ctx.stroke();}round(ctx,x+28,y+h-58,84,34,6,'#c19b63');text(ctx,'RELAY BENCH',x+w/2,y+h-22,11,'#3e6059');
 }else if(id==='galley'){
  round(ctx,x+25,y+25,200,42,7,'#6b7d7b');for(let i=0;i<3;i++){circle(ctx,x+65+i*60,y+45,12,'#dce5cb');circle(ctx,x+65+i*60,y+45,6,'#6798a0',null);}round(ctx,x+22,y+h-62,85,36,5,'#ae7359');text(ctx,'FRESH WATER',x+w/2,y+h-24,11,'#704b43');
 }else if(id==='engine'){
  round(ctx,1220,990,100,50,12,'#445d76');for(let i=0;i<4;i++){ctx.strokeStyle='#9aafbf';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(1235+i*23,997);ctx.lineTo(1235+i*23,1033);ctx.stroke();}for(let i=0;i<3;i++)round(ctx,x+24+i*82,y+24,66,46,7,'#516a7c');text(ctx,'TURBINE HALL',x+w/2,y+h-23,11,'#425b70');
 }
}
/** Detail follows collider footprints, so illustrated furniture is never a hidden wall. */
function mapObstacle(ctx,prop,time,reduced){
 const {x,y,width:w,height:h}=prop,kind=prop.kind||'machine',color=prop.color||'#566b79';
 ctx.save();ctx.shadowColor='#09253788';ctx.shadowBlur=6;ctx.shadowOffsetY=6;round(ctx,x,y,w,h,Math.min(12,w/5,h/5),color,'#173144',4);ctx.restore();
 const cx=x+w/2,cy=y+h/2,pad=Math.min(12,w/6,h/6);
 if(['tank','turbine','generator','filters','furnace','telescope'].includes(kind)){
  const radius=Math.min(w,h)*.31;circle(ctx,cx,cy,radius,kind==='furnace'?'#f3b16c':'#9abfc0','#284857',3);circle(ctx,cx,cy,radius*.6,kind==='furnace'?'#ffdf9b':'#527b89',null);
  ctx.save();ctx.translate(cx,cy);ctx.rotate(reduced?0:time/3000);ctx.strokeStyle='#d8e5c9';ctx.lineWidth=3;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(radius*.8,0);ctx.stroke();}ctx.restore();
 }else if(['shelf','crates','crate','records','tools','kitchen'].includes(kind)){
  for(let col=0;col<3;col++)for(let row=0;row<2;row++)round(ctx,x+pad+col*(w-pad*2)/3,y+pad+row*(h-pad*2)/2,(w-pad*2)/3-4,(h-pad*2)/2-4,2,['#d9b887','#92b7aa','#baa6c5'][(row+col)%3],'#344f5a',2);
 }else if(kind==='planter'){
  for(let i=0;i<4;i++){const px=x+pad+(w-pad*2)*(i+.5)/4;circle(ctx,px,cy,Math.min(h*.3,13),'#7fa67a','#34594f',2);circle(ctx,px+4,cy-5,Math.min(h*.19,8),'#b6d398',null);}
 }else if(kind==='table'){
  round(ctx,x+pad,y+pad,w-pad*2,h-pad*2,5,'#b6cfbf','#527d7e',2);ctx.strokeStyle='#5c8e99';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+pad,cy);ctx.lineTo(x+w-pad,cy);ctx.moveTo(cx,y+pad);ctx.lineTo(cx,y+h-pad);ctx.stroke();
 }else {
  round(ctx,x+pad,y+pad,w-pad*2,Math.max(10,h*.35),4,'#244657','#142e3e',2);ctx.fillStyle='#c6e2b0';for(let i=0;i<4;i++)ctx.fillRect(x+pad+5+i*(w-pad*2-10)/4,y+h-pad-9,Math.max(3,w*.055),5);
 }
}
function mapDecor(ctx,item,time,reduced){
 if(!Number.isFinite(item.x)||!Number.isFinite(item.y))return;
 if(item.kind==='label'){text(ctx,String(item.text||''),item.x,item.y,Number.isFinite(item.size)?item.size:13,item.color||'#daf0d0');return;}
 if(item.kind==='lamps'){for(const [dx,dy]of [[0,0],[item.width||0,0],[0,item.height||0],[item.width||0,item.height||0]])mapDecor(ctx,{...item,kind:'lamp',x:item.x+dx,y:item.y+dy},time,reduced);return;}
 if(item.kind==='stripes'){ctx.save();ctx.strokeStyle=item.color||'#d3c89566';ctx.globalAlpha=.45;ctx.lineWidth=4;for(let x=0;x<(item.width||60);x+=24){ctx.beginPath();ctx.moveTo(item.x+x,item.y);ctx.lineTo(item.x+x+Math.min(item.height||30,24),item.y+(item.height||30));ctx.stroke();}ctx.restore();return;}
 if(['light','lamp'].includes(item.kind)){ctx.save();ctx.shadowColor=item.color||'#f0d69e';ctx.shadowBlur=reduced?8:10+Math.sin(time/600)*3;circle(ctx,item.x,item.y,5,item.color||'#f0d69e','#365968',2);ctx.restore();return;}
 if(item.kind==='stripe'){ctx.save();ctx.strokeStyle=item.color||'#d3c89566';ctx.lineWidth=3;ctx.setLineDash([12,10]);ctx.beginPath();ctx.moveTo(item.x,item.y);ctx.lineTo(item.x+(item.width||60),item.y+(item.height||0));ctx.stroke();ctx.restore();}
}
// Shared across the main world, minimap and replay: map illustration does not change
// with authoritative updates. Only actors, signals and station activity redraw.
const staticWorldBitmaps=new Map();
let fogBitmap=null;
const glowBitmaps=new Map();
function createBitmap(canvas,width,height){
 const bitmap=typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):canvas.ownerDocument?.createElement('canvas');
 if(!bitmap)return null;bitmap.width=width;bitmap.height=height;return bitmap;
}
function fogLayer(canvas,radius){
 if(fogBitmap?.width===radius*2)return fogBitmap;
 const bitmap=createBitmap(canvas,radius*2,radius*2),context=bitmap?.getContext('2d');if(!context)return null;
 const fog=context.createRadialGradient(radius,radius,radius*.35,radius,radius,radius);fog.addColorStop(0,'#091d3000');fog.addColorStop(.82,'#091d3038');fog.addColorStop(1,'#091d30e8');context.fillStyle=fog;context.fillRect(0,0,radius*2,radius*2);fogBitmap=bitmap;return bitmap;
}
function glowLayer(canvas,critical){
 const key=critical?'critical':'task';if(glowBitmaps.has(key))return glowBitmaps.get(key);
 const bitmap=createBitmap(canvas,128,128),context=bitmap?.getContext('2d');if(!context)return null;
 context.shadowColor=critical?'#ff6963':'#ffe895';context.shadowBlur=22;circle(context,64,64,31,critical?'#e87162':'#f3d98e',undefined,4);glowBitmaps.set(key,bitmap);return bitmap;
}
function paintStructure(ctx,geometry){
 const legacy=geometry.metadata?.id==='beacon'||!geometry.metadata?.id,corridors=geometry.WORLD_FLOORS.filter(f=>!f.center);
  // Structural silhouette beneath the painted floor.
  for(const floor of geometry.WORLD_FLOORS)round(ctx,floor.x-8,floor.y-8,floor.width+16,floor.height+16,13,'#142838','#091c2c',9);
  for(const floor of geometry.WORLD_FLOORS)if(!floor.center){round(ctx,floor.x,floor.y,floor.width,floor.height,6,'#719398','#1b3545',4);ctx.strokeStyle='#c1d5c02b';ctx.lineWidth=2;for(let x=floor.x+20;x<floor.x+floor.width;x+=32){ctx.beginPath();ctx.moveTo(x,floor.y+8);ctx.lineTo(x,floor.y+floor.height-8);ctx.stroke();}}
  for(const r of geometry.WORLD_ROOMS){
   const [wall,floor]=r.palette||palettes[r.id]||palettes.bridge;round(ctx,r.x,r.y,r.width,r.height,18,wall,'#102b3e',7);round(ctx,r.x+8,r.y+13,r.width-16,r.height-21,13,floor,'#ffffff55',3);
   ctx.save();ctx.beginPath();ctx.rect(r.x+12,r.y+16,r.width-24,r.height-30);ctx.clip();ctx.strokeStyle='#19344413';ctx.lineWidth=2;for(let x=r.x+30;x<r.x+r.width;x+=36){ctx.beginPath();ctx.moveTo(x,r.y+14);ctx.lineTo(x,r.y+r.height-8);ctx.stroke();}ctx.restore();
   const roomLabel=r.name?.toUpperCase()||names[r.id]||r.id.toUpperCase(),authoredLabel=(geometry.WORLD_DECOR||[]).some(item=>item.kind==='label'&&String(item.text).toUpperCase()===roomLabel);
   if(!authoredLabel)text(ctx,roomLabel,r.x+r.width/2,r.y+r.height-7,19,'#163346');
   if(legacy)decor(ctx,r);else if(r.description){const limit=Math.max(25,Math.floor((r.width-40)/6)),words=r.description.split(' ');let line='',lines=[];for(const word of words){if((line+' '+word).length>limit){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);for(const [i,line]of lines.slice(0,2).entries())text(ctx,line,r.x+r.width/2,r.y+28+i*14,11,'#254d5a');}

  }
  // Open thresholds exactly where shared corridor floors cross a room boundary.
  for(const r of geometry.WORLD_ROOMS)for(const f of corridors){
   const top=Math.max(r.y,f.y),bottom=Math.min(r.y+r.height,f.y+f.height),left=Math.max(r.x,f.x),right=Math.min(r.x+r.width,f.x+f.width);
   ctx.fillStyle='#8faba5';ctx.strokeStyle='#19374a';ctx.lineWidth=5;
   for(const edge of [r.x,r.x+r.width])if(f.x<edge&&f.x+f.width>edge&&bottom-top>30){ctx.fillRect(edge-7,top+3,14,bottom-top-6);ctx.beginPath();ctx.moveTo(edge-11,top+2);ctx.lineTo(edge+11,top+2);ctx.moveTo(edge-11,bottom-2);ctx.lineTo(edge+11,bottom-2);ctx.stroke();}
   for(const edge of [r.y,r.y+r.height])if(f.y<edge&&f.y+f.height>edge&&right-left>30){ctx.fillRect(left+3,edge-7,right-left-6,14);ctx.beginPath();ctx.moveTo(left+2,edge-11);ctx.lineTo(left+2,edge+11);ctx.moveTo(right-2,edge-11);ctx.lineTo(right-2,edge+11);ctx.stroke();}
  }
  if(!legacy){for(const prop of geometry.WORLD_OBSTACLES)mapObstacle(ctx,prop,0,true);for(const item of geometry.WORLD_DECOR||[])mapDecor(ctx,item,0,true);}
  circle(ctx,geometry.WORLD_BELL.x,geometry.WORLD_BELL.y,19,'#e1a34f');circle(ctx,geometry.WORLD_BELL.x,geometry.WORLD_BELL.y,9,'#fff0ba',undefined,2);
}
function staticWorld(canvas,geometry){
 const key=geometry.metadata?.id||'beacon';if(staticWorldBitmaps.has(key))return staticWorldBitmaps.get(key);
 // Three validated map IDs, bounded raster size: even the expanded maps do not
 // retain an unbounded full-resolution canvas for every scene or room.
 const scale=Math.min(1,2048/Math.max(geometry.WORLD.width,geometry.WORLD.height));
 const bitmap=createBitmap(canvas,Math.ceil(geometry.WORLD.width*scale),Math.ceil(geometry.WORLD.height*scale));if(!bitmap)return null;
 const context=bitmap.getContext('2d');if(!context)return null;
 context.scale(scale,scale);paintStructure(context,geometry);
 if(staticWorldBitmaps.size>=3)staticWorldBitmaps.delete(staticWorldBitmaps.keys().next().value);
 staticWorldBitmaps.set(key,bitmap);return bitmap;
}
export function createWorldScene(canvas,{reduced=false,playback=false}={}){
 const ctx=canvas.getContext('2d'),samples=new ActorSamples();
 let room=null,lastKey=null,geometry=world,camera={x:800,y:400},view={width:1,height:1,zoom:1,camera:null},stopped=false,lastDraw=null,paintedActors=[];
 function update(next,at){geometry=typeof world.getWorld==='function'?world.getWorld(next?.game?.mapId||next?.mapId||'beacon'):world;const key=`${next?.roomId}:${next?.game?.matchId}:${geometry.metadata?.id||'beacon'}`;if(key!==lastKey){samples.clear();lastKey=key;camera={...(next?.game?.self?.position||geometry.worldSpawn?.('p1')||{x:800,y:300})};lastDraw=null;paintedActors=[];}room=next;samples.update(room?.game,at);}
 function draw(time,{overview=false,follow:followId=null,camera:freeCamera=null,spectatorGhost=false}={}){
  if(stopped)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const dpr=Math.min(2,globalThis.devicePixelRatio||1),width=rect.width,height=rect.height;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const sea=ctx.createLinearGradient(0,0,width,height);sea.addColorStop(0,'#102f48');sea.addColorStop(1,'#244957');ctx.fillStyle=sea;ctx.fillRect(0,0,width,height);
  if(!reduced){ctx.strokeStyle='#93c2d01c';ctx.lineWidth=2;for(let i=0;i<45;i++){const x=(i*137+time*.014)% (width+80)-40,y=(i*83+time*.038)%(height+80)-40;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-12,y+27);ctx.stroke();}}
  const game=room?.game,lobby=!game,legacy=!geometry.metadata?.id||geometry.metadata.id==='beacon',mapCenter={x:geometry.WORLD.width/2,y:geometry.WORLD.height/2},lobbyCenter=legacy?{x:800,y:310}:geometry.WORLD_ROOMS.find(r=>r.id==='bridge')?.center||mapCenter,free=!game?.self&&point(freeCamera);
  const followed=game?.players?.find(p=>p.id===followId&&point(p.position));
  const followedId=followed?.id||game?.self?.id||game?.players?.find(p=>point(p.position)&&p.alive)?.id;
  const follow=(!playback&&samples.at(followedId,time,reduced))||followed?.position||game?.self?.position||mapCenter;
  const destination=free?{x:clamp(freeCamera.x,0,geometry.WORLD.width),y:clamp(freeCamera.y,0,geometry.WORLD.height)}:lobby?lobbyCenter:follow;
  // Follow the same interpolated sample as the keeper; damping is independent
  // of display refresh rate. A local ghost camera has no authoritative position.
  const elapsed=lastDraw===null?16.67:clamp(time-lastDraw,0,100),blend=1-Math.exp(-elapsed/95);lastDraw=time;
  camera=reduced||playback||free?destination:{x:camera.x+(destination.x-camera.x)*blend,y:camera.y+(destination.y-camera.y)*blend};
  const zoom=overview?Math.min((width-30)/geometry.WORLD.width,(height-30)/geometry.WORLD.height):lobby?Math.min(width/620,height/390):clamp(Math.min(width/650,height/650),.58,1.2);
  if(overview)camera=mapCenter;view={width,height,zoom,camera:{...camera}};
  if(canvas.dataset){canvas.dataset.cameraX=String(camera.x);canvas.dataset.cameraY=String(camera.y);canvas.dataset.cameraZoom=String(zoom);canvas.dataset.cameraMode=overview?'overview':free?'free':'follow';}
  ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
  const bitmap=staticWorld(canvas,geometry);if(bitmap){ctx.imageSmoothingEnabled=false;ctx.drawImage(bitmap,0,0,geometry.WORLD.width,geometry.WORLD.height);ctx.imageSmoothingEnabled=true;}else paintStructure(ctx,geometry);
  const lantern=geometry.WORLD_ROOMS.find(r=>r.id==='lantern');
  if(legacy&&lantern){ctx.save();ctx.translate(lantern.x+95,lantern.y+100);ctx.rotate(reduced?0:time/9000);ctx.fillStyle='#fff4ba66';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(90,-25);ctx.lineTo(90,25);ctx.closePath();ctx.fill();ctx.restore();}
  for(const r of geometry.WORLD_ROOMS){
   const station=geometry.WORLD_STATIONS[r.id],hasTask=game?.self?.tasks?.some(t=>!t.completed&&t.roomId===r.id)||playback&&game?.replayTaskRooms?.includes(r.id),critical=game?.sabotage?.active&&game.sabotage.roomId===r.id;
   if(!station)continue;
   if(hasTask||critical){
    const glow=glowLayer(canvas,critical);
    if(glow){const size=128*(reduced?1:1+Math.sin(time/250)*.045);ctx.drawImage(glow,station.x-size/2,station.y-size/2,size,size);}
    else {ctx.save();ctx.shadowColor=critical?'#ff6963':'#ffe895';ctx.shadowBlur=reduced?14:20+Math.sin(time/250)*7;circle(ctx,station.x,station.y,31,critical?'#e87162':'#f3d98e',undefined,4);ctx.restore();}
   }
   round(ctx,station.x-22,station.y-24,44,48,8,'#31586a');round(ctx,station.x-14,station.y-17,28,22,4,critical?'#ff8573':hasTask?'#ffeb9e':'#9dcaba',null);text(ctx,critical?'!':hasTask?'E':'·',station.x,station.y+1,18,'#224859');
  }
  for(const body of visibleBodies(game)){ctx.save();ctx.translate(body.position.x,body.position.y);ctx.rotate(-.25);const color=game.players.find(p=>p.id===body.playerId)?.color||'#d3b48b';round(ctx,-25,-10,48,24,12,color);round(ctx,-15,-8,20,13,5,'#274958',undefined,3);ctx.restore();text(ctx,'FALLEN',body.position.x,body.position.y+31,11,'#fbf1d5');}
  for(const effect of game?.effects||[]){const position=effect.kind==='echo'?effect.position:game.players.find(p=>p.id===effect.targetId)?.position;if(!point(position))continue;ctx.save();ctx.strokeStyle=effect.kind==='echo'?'#eaaaf0':'#a9f7e0';ctx.lineWidth=4;ctx.setLineDash(effect.kind==='echo'?[8,6]:[]);ctx.beginPath();ctx.arc(position.x,position.y,40,0,Math.PI*2);ctx.stroke();text(ctx,effect.kind==='echo'?'SIGNAL ECHO':'HARBOR WARD',position.x,position.y-48,12,'#fff4cc');ctx.restore();}
  const actors=lobby?(room?.seats||CHARACTERS).map((p,i)=>({...p,position:legacy?{x:690+(i%3)*110,y:280+Math.floor(i/3)*100}:geometry.worldSpawn(p.id),alive:true})):playback?(game?.players||[]).filter(p=>(p.alive||p.ghost)&&point(p.position)):Array.from(samples.samples.values(),s=>s.player);
  paintedActors=[];
  for(const player of actors.sort((a,b)=>a.position.y-b.position.y)){
   const p=lobby||playback?player.position:samples.at(player.id,time,reduced);if(!p)continue;
   paintedActors.push({id:player.id,position:{...p}});
   drawKeeper(ctx,player,p.x,p.y,{selected:player.id===(followId||game?.self?.id),step:!reduced&&player.moving&&(player.id===game?.self?.id||time-(samples.samples.get(player.id)?.at||0)<300)?time/95:0,scale:1.02,ghost:player.alive===false});
   if(playback&&game.replayRoles&&player.role)text(ctx,player.role.toUpperCase(),p.x,p.y+53,11,player.role==='saboteur'?'#ffb8a1':'#e3f4d2');
  }
  if(free&&spectatorGhost&&!overview){drawKeeper(ctx,{name:'You · observing',color:'#c7eef0'},camera.x,camera.y,{ghost:true,selected:true,step:reduced?0:time/190});}
  ctx.restore();
  if(!overview&&game?.self&&point(game.self.position)){
   const observed=samples.at(game.self.id,time,reduced)||game.self.position,sx=(observed.x-camera.x)*zoom+width/2,sy=(observed.y-camera.y)*zoom+height/2,vision=game.settings?.vision??geometry.WORLD.visibilityRadius,radius=vision*zoom;
   const fog=fogLayer(canvas,vision);
   if(fog){
    // The visibility mask is fixed in world units. Reuse its raster, preserving
    // the original alpha ramp; shade the surrounding screen with four rectangles.
    const left=clamp(sx-radius,0,width),right=clamp(sx+radius,0,width),top=clamp(sy-radius,0,height),bottom=clamp(sy+radius,0,height);
    ctx.fillStyle='#091d30e8';ctx.fillRect(0,0,width,top);ctx.fillRect(0,bottom,width,height-bottom);ctx.fillRect(0,top,left,bottom-top);ctx.fillRect(right,top,width-right,bottom-top);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(fog,sx-radius,sy-radius,radius*2,radius*2);ctx.imageSmoothingEnabled=true;
   }else {const gradient=ctx.createRadialGradient(sx,sy,radius*.35,sx,sy,radius);gradient.addColorStop(0,'#091d3000');gradient.addColorStop(.82,'#091d3038');gradient.addColorStop(1,'#091d30e8');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);}
  }
 }
 function screenToWorld(clientX,clientY){if(stopped||!view.camera||!Number.isFinite(clientX)||!Number.isFinite(clientY))return null;const r=canvas.getBoundingClientRect();return {x:(clientX-r.left-view.width/2)/view.zoom+view.camera.x,y:(clientY-r.top-view.height/2)/view.zoom+view.camera.y};}
 function worldToScreen(position){if(stopped||!view.camera||!point(position))return null;const r=canvas.getBoundingClientRect();return {x:(position.x-view.camera.x)*view.zoom+view.width/2+r.left,y:(position.y-view.camera.y)*view.zoom+view.height/2+r.top};}
 function pick(clientX,clientY){
  const target=screenToWorld(clientX,clientY),game=room?.game;if(!target||!game)return null;
  const rect=canvas.getBoundingClientRect();if(clientX<rect.left||clientY<rect.top||clientX>rect.left+rect.width||clientY>rect.top+rect.height)return null;
  // Picking inspects only what this scene has been given; no hidden coordinates
  // or final state is consulted. Match the displayed interpolated keeper.
  const padding=Math.max(4,6/view.zoom);
  for(const actor of [...paintedActors].reverse()){
   const player=game.players?.find(p=>p.id===actor.id);if(!player||!point(player.position)||!(player.alive||player.ghost))continue;
   if(Math.abs(target.x-actor.position.x)<=25+padding&&target.y>=actor.position.y-63-padding&&target.y<=actor.position.y+36+padding)return {type:'player',id:actor.id};
  }
  for(const body of visibleBodies(game))if(Math.hypot(target.x-body.position.x,target.y-body.position.y)<=32+padding)return {type:'body',id:body.bodyId,playerId:body.playerId};
  for(const effect of game.effects||[]){const position=effect.kind==='echo'?effect.position:game.players?.find(p=>p.id===effect.targetId)?.position;if(point(position)&&Math.hypot(target.x-position.x,target.y-position.y)<=42+padding)return {type:'effect',id:effect.id,kind:effect.kind};}
  for(const [roomId,station]of Object.entries(geometry.WORLD_STATIONS))if(Math.abs(target.x-station.x)<=24+padding&&Math.abs(target.y-station.y)<=26+padding)return {type:'station',id:station.id,roomId};
  if(Math.hypot(target.x-geometry.WORLD_BELL.x,target.y-geometry.WORLD_BELL.y)<=22+padding)return {type:'bell',id:'bell',roomId:'bridge'};
  for(const prop of geometry.WORLD_OBSTACLES)if(target.x>=prop.x&&target.x<=prop.x+prop.width&&target.y>=prop.y&&target.y<=prop.y+prop.height)return {type:'prop',id:prop.id,roomId:geometry.worldRoomAt(target)};
  for(const [index,item]of (geometry.WORLD_DECOR||[]).entries()){if(!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;const width=item.width||20,height=item.height||20;if(target.x>=item.x-10&&target.x<=item.x+width+10&&target.y>=item.y-10&&target.y<=item.y+height+10)return {type:'decor',id:item.id||`decor-${index}`,roomId:geometry.worldRoomAt(target),kind:item.kind};}
  const roomId=geometry.worldRoomAt(target);return roomId?{type:'room',id:roomId,roomId}:null;
 }
 return {update,draw,pick,screenToWorld,worldToScreen,getCamera(){return {...camera};},toWorld(clientX,clientY){return playback?null:screenToWorld(clientX,clientY);},dispose(){stopped=true;samples.clear();paintedActors=[];}};
}
