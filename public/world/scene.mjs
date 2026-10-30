import {drawInterior,drawInteriorLabels,drawInteriorLights} from './interior-art.mjs';
import {observerAgents,observerGame} from './spectator.mjs';
import {mapReference,mapKey} from './map-model.mjs';
import {ObservedCamera,viewportBounds,intersects} from './camera.mjs';
import {createStaticLayer} from './static-layer.mjs';
import {paintEnvironment,drawRoomLabels,drawStation,drawForeground} from './environment.mjs';
import {getMap} from '../../shared/maps/index.mjs';
import {ActorSamples,clamp,point,visibleBodies} from './model.mjs';
import {CHARACTERS} from '../../shared/contracts.mjs';
import {visionFrame,drawBeaconFixtures} from './beacon-scene.mjs';

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
 if(label){text(ctx,player.name||'Keeper',0,36,14,'#102d3e');ctx.lineWidth=4;ctx.strokeStyle='#eff8e8';ctx.strokeText(player.name||'Keeper',0,36);text(ctx,player.name||'Keeper',0,36,14,'#102d3e');}
 ctx.restore();
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
// Expanded world2 maps have no tactical fixtures. Their authored static art
// shares the bounded quality tile cache rather than allocating a whole-map bitmap.
function paintSceneEnvironment(ctx,map,bounds){
 if(map.geometry.metadata?.revision===2){drawInterior(ctx,map.geometry,{cache:false,bounds});return;}
 paintEnvironment(ctx,map,bounds);
 if(!['storm-foundry','tidal-observatory'].includes(map.id))return;
 for(const r of map.geometry.WORLD_ROOMS)if(intersects(r,bounds)&&r.palette){ctx.save();ctx.globalAlpha=.18;ctx.fillStyle=r.palette[1];ctx.fillRect(r.x+12,r.y+16,r.width-24,r.height-30);ctx.restore();}
 for(const prop of map.geometry.WORLD_OBSTACLES)if(intersects(prop,bounds,16))mapObstacle(ctx,prop,0,true);
 for(const item of map.geometry.WORLD_DECOR||[])if(intersects({x:item.x-100,y:item.y-32,width:(item.width||0)+200,height:(item.height||0)+64},bounds))mapDecor(ctx,item,0,true);
}
// At most two shared viewport-sized static overview textures (8MiB total).
// They contain only public map art, never actors, roles, claims or server state.
const overviewLayers=new Set(),overviewLimit=2;
function acquireOverview(canvas,map,bounds,width,height){
 for(const entry of overviewLayers)if(entry.map===map&&entry.width===width&&entry.height===height){entry.users++;return entry;}
 if(overviewLayers.size>=overviewLimit)return null;
 const w=Math.min(1024,Math.ceil(width)),h=Math.min(1024,Math.ceil(height));
 const image=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):canvas.ownerDocument?.createElement?.('canvas');
 const ctx=image?.getContext?.('2d');if(!ctx)return null;image.width=w;image.height=h;
 ctx.setTransform(w/bounds.width,0,0,h/bounds.height,-bounds.x*w/bounds.width,-bounds.y*h/bounds.height);paintSceneEnvironment(ctx,map,bounds);
 const entry={map,width,height,image,users:1,bytes:w*h*4};overviewLayers.add(entry);return entry;
}
function releaseOverview(entry){if(entry&&--entry.users===0){overviewLayers.delete(entry);entry.image.width=entry.image.height=0;}}
export function createWorldScene(canvas,{reduced=false,playback=false,mapResolver=getMap,motionFactory}={}){
 const ctx=canvas.getContext('2d'),samples=motionFactory?motionFactory({mapResolver,timelineDelayMs:100}):new ActorSamples({mapResolver,world:true});let map=mapResolver(),world=map.geometry;let room=null,lastKey=null,camera={x:800,y:400},view={width:1,height:1,zoom:1},stopped=false,lastOwner=null,lastAt=-Infinity,lastVersion=-1,paintedActors=[],overviewLayer=null,terrainLayer=null,fogLayer=null;
 const cameraTrack=new ObservedCamera();
 const cache=createStaticLayer({paint:paintSceneEnvironment,makeCanvas:(w,h)=>{if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);return canvas.ownerDocument?.createElement?.('canvas')||globalThis.document?.createElement?.('canvas');}});
 const glows=new Map();
 function raster(w,h){const image=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):canvas.ownerDocument?.createElement?.('canvas')||globalThis.document?.createElement?.('canvas');const context=image?.getContext?.('2d');if(!context)return null;image.width=w;image.height=h;return {image,context,bytes:w*h*4};}
 function release(layer){if(layer)layer.image.width=layer.image.height=0;}
 function clearTransient(){release(terrainLayer);terrainLayer=null;release(fogLayer);fogLayer=null;for(const layer of glows.values())release(layer);glows.clear();}
 function terrain(bounds){
  if(terrainLayer&&(terrainLayer.map!==map||bounds.x<terrainLayer.bounds.x||bounds.y<terrainLayer.bounds.y||bounds.x+bounds.width>terrainLayer.bounds.x+terrainLayer.bounds.width||bounds.y+bounds.height>terrainLayer.bounds.y+terrainLayer.bounds.height)){release(terrainLayer);terrainLayer=null;}
  if(!terrainLayer){const b={x:Math.floor(bounds.x/128)*128-64,y:Math.floor(bounds.y/128)*128-64,width:Math.ceil((bounds.width+256)/128)*128,height:Math.ceil((bounds.height+256)/128)*128},scale=Math.min(1,1024/b.width,1024/b.height),layer=raster(Math.ceil(b.width*scale),Math.ceil(b.height*scale));
   if(layer){layer.context.setTransform(layer.image.width/b.width,0,0,layer.image.height/b.height,-b.x*layer.image.width/b.width,-b.y*layer.image.height/b.height);cache.draw(layer.context,map,b);terrainLayer={...layer,map,bounds:b};}
  }
  if(terrainLayer){const b=terrainLayer.bounds;ctx.drawImage(terrainLayer.image,b.x,b.y,b.width,b.height);}else cache.draw(ctx,map,bounds);
 }
 function glow(critical){
  const key=!!critical;if(glows.has(key))return glows.get(key).image;const layer=raster(256,256);if(!layer)return null;
  const c=layer.context;c.shadowColor=critical?'#ff6963':'#ffe895';c.shadowBlur=44;circle(c,128,128,62,critical?'#e87162':'#f3d98e',undefined,8);glows.set(key,layer);return layer.image;
 }
 function fog(radius){
  if(fogLayer?.radius===radius)return fogLayer.image;release(fogLayer);fogLayer=null;const layer=raster(256,256);if(!layer)return null;
  const c=layer.context;c.setTransform(256/(radius*2),0,0,256/(radius*2),0,0);const gradient=c.createRadialGradient(radius,radius,radius*.35,radius,radius,radius);gradient.addColorStop(0,'#091d3000');gradient.addColorStop(.82,'#091d3038');gradient.addColorStop(1,'#091d30e8');c.fillStyle=gradient;c.fillRect(0,0,radius*2,radius*2);fogLayer={...layer,radius};return layer.image;
 }
 function update(next,at){
  const nextMap=mapResolver(mapReference(next)),game=observerGame(next?.game);
  const owner=JSON.stringify([next?.roomId,game?.matchId,mapKey(nextMap),game?.self?.id]);
  if(!playback&&owner===lastOwner&&(at<lastAt||Number.isFinite(game?.version)&&game.version<lastVersion))return;
  const key=JSON.stringify([owner,game?.phase,game?.self?.alive,!!(game?.self?.transit||game?.systems?.selfTransit),game?.vision?.mode,observerAgents(game).length>0]);
  map=nextMap;world=map.geometry;
  const target=!game?{x:world.WORLD_VIEWPOINT.x,y:world.WORLD_VIEWPOINT.y+25}:(visionFrame(game,map)?.origin||game?.self?.position||world.WORLD_VIEWPOINT);
  if(key!==lastKey){paintedActors=[];samples.clear();cameraTrack.reset(target,at);lastKey=key;}else cameraTrack.update(target,at);
  lastOwner=owner;lastAt=at;lastVersion=Number.isFinite(game?.version)?game.version:-1;
  room=next;samples.update(game?{...game,map:map.reference??{id:map.id,version:map.version}}:game,at);
 }

 function draw(time,{overview=false,follow:followId=null,camera:freeCamera=null,spectatorGhost=false}={}){
  if(stopped)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const dpr=Math.min(2,globalThis.devicePixelRatio||1),width=rect.width,height=rect.height;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const sea=ctx.createLinearGradient(0,0,width,height);sea.addColorStop(0,map.id==='beacon'?'#102f48':'#172f46');sea.addColorStop(1,map.id==='beacon'?'#244957':'#3e6067');ctx.fillStyle=sea;ctx.fillRect(0,0,width,height);
  if(!reduced){ctx.strokeStyle='#93c2d01c';ctx.lineWidth=2;for(let i=0;i<45;i++){const x=(i*137+time*.014)% (width+80)-40,y=(i*83+time*.038)%(height+80)-40;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-12,y+27);ctx.stroke();}}
  const game=observerGame(room?.game),lobby=!game;
  const vision=observerAgents(game).length?null:visionFrame(game,map);
  const followed=game?.players?.find(p=>p.id===followId&&point(p.position));
  const free=!game?.self&&point(freeCamera);camera=free?{x:clamp(freeCamera.x,0,world.WORLD.width),y:clamp(freeCamera.y,0,world.WORLD.height)}:(playback||!game?.self)&&followed?{...(playback?followed.position:samples.at(followed.id,time,reduced)||followed.position)}:cameraTrack.at(time,reduced)||{...world.WORLD_VIEWPOINT};

  const zoom=overview?Math.min((width-30)/world.WORLD.width,(height-30)/world.WORLD.height):lobby?Math.min(width/620,height/390):clamp(Math.min(width/650,height/650),.64,1.28);
  if(overview)camera={x:world.WORLD.width/2,y:world.WORLD.height/2};view={width,height,zoom,camera:{...camera}};if(canvas.dataset){canvas.dataset.cameraX=String(camera.x);canvas.dataset.cameraY=String(camera.y);canvas.dataset.cameraZoom=String(zoom);canvas.dataset.cameraMode=overview?'overview':free?'free':'follow';}
  ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
  const bounds=viewportBounds(camera,width,height,zoom,0);
  if(overview){
   release(terrainLayer);terrainLayer=null;
   if(overviewLayer&&(overviewLayer.map!==map||overviewLayer.width!==width||overviewLayer.height!==height)){releaseOverview(overviewLayer);overviewLayer=null;}
   overviewLayer??=acquireOverview(canvas,map,bounds,width,height);
   if(overviewLayer)ctx.drawImage(overviewLayer.image,bounds.x,bounds.y,bounds.width,bounds.height);else paintSceneEnvironment(ctx,map,bounds);
  }else{releaseOverview(overviewLayer);overviewLayer=null;terrain(bounds);}
  if(world.metadata?.revision===2){drawInteriorLights(ctx,world,time,reduced);drawInteriorLabels(ctx,world,zoom);}else drawRoomLabels(ctx,map,bounds,{overview,zoom});
  for(const r of world.WORLD_ROOMS){const station=world.WORLD_STATIONS[r.id];if(!station||!intersects({x:station.x-40,y:station.y-40,width:80,height:80},bounds))continue;
   const task=game?.self?.tasks?.find(t=>!t.completed&&t.roomId===r.id)||(playback&&game?.replayTaskRooms?.includes(r.id)?{kind:'recorded'}:null),critical=game?.beaconVersion!==1&&game?.sabotage?.active&&game.sabotage.roomId===r.id;
   const kind=task?.challenge?.kind||map.taskKinds?.[r.id]||({bridge:'circuit',workshop:'circuit',lantern:'signal',engine:'alignment',archive:'sequence',galley:'manifolds'})[r.id]||'glyphs';
   if(task||critical){const image=glow(critical),size=128*(reduced?1:1+Math.sin(time/250)*.045);if(image)ctx.drawImage(image,station.x-size/2,station.y-size/2,size,size);}
   drawStation(ctx,station,kind,{active:!!task,critical,time,reduced});
  }
  drawBeaconFixtures(ctx,game,map);
  circle(ctx,world.WORLD_BELL.x,world.WORLD_BELL.y,19,'#e1a34f');circle(ctx,world.WORLD_BELL.x,world.WORLD_BELL.y,9,'#fff0ba',undefined,2);
  for(const body of visibleBodies(game)){ctx.save();ctx.translate(body.position.x,body.position.y);ctx.rotate(-.25);const color=game.players.find(p=>p.id===body.playerId)?.color||'#d3b48b';round(ctx,-25,-10,48,24,12,color);round(ctx,-15,-8,20,13,5,'#274958',undefined,3);ctx.restore();text(ctx,'FALLEN',body.position.x,body.position.y+31,11,'#fbf1d5');}
  for(const effect of game?.effects||[]){const position=effect.kind==='echo'?effect.position:game.players.find(p=>p.id===effect.targetId)?.position;if(!point(position))continue;ctx.save();ctx.strokeStyle=effect.kind==='echo'?'#eaaaf0':'#a9f7e0';ctx.lineWidth=4;ctx.setLineDash(effect.kind==='echo'?[8,6]:[]);ctx.beginPath();ctx.arc(position.x,position.y,40,0,Math.PI*2);ctx.stroke();text(ctx,effect.kind==='echo'?'SIGNAL ECHO':'HARBOR WARD',position.x,position.y-48,12,'#fff4cc');ctx.restore();}
  const actors=lobby?(room?.roster||CHARACTERS).map((p,i,list)=>({...p,position:{x:world.WORLD_VIEWPOINT.x+((i%Math.ceil(Math.sqrt(list.length)))-(Math.ceil(Math.sqrt(list.length))-1)/2)*100,y:world.WORLD_VIEWPOINT.y-45+Math.floor(i/Math.ceil(Math.sqrt(list.length)))*95},alive:true})):playback?(game?.players||[]).filter(p=>(p.alive||p.ghost)&&point(p.position)):Array.from(samples.samples.values(),s=>s.player);
  paintedActors=[];
  for(const player of actors.sort((a,b)=>a.position.y-b.position.y)){
   const p=lobby||playback?player.position:samples.at(player.id,time,reduced);if(!p||!intersects({x:p.x-50,y:p.y-70,width:100,height:125},bounds))continue;
   paintedActors.push({id:player.id,position:{...p}});
   drawKeeper(ctx,player,p.x,p.y,{selected:player.id===(followId||game?.self?.id),step:!reduced&&player.moving&&(player.id===game?.self?.id||time-(samples.samples.get(player.id)?.at||0)<300)?time/95:0,scale:1.02,ghost:player.alive===false});
   if(playback&&game.replayRoles&&player.role)text(ctx,player.role.toUpperCase(),p.x,p.y+53,11,player.role==='saboteur'?'#ffb8a1':'#e3f4d2');
  }
  if(free&&spectatorGhost&&!overview)drawKeeper(ctx,{name:'Local observer',color:'#c7eef0'},camera.x,camera.y,{ghost:true,selected:true,step:reduced?0:time/190});
  if(world.metadata?.revision!==2)drawForeground(ctx,map,bounds);
  ctx.restore();
  if(!overview&&((vision&&!vision.ended)||game?.beaconVersion!==1&&game?.self&&point(game.self.position))){
   const origin=vision?.origin||game.self.position,sx=(origin.x-camera.x)*zoom+width/2,sy=(origin.y-camera.y)*zoom+height/2,worldRadius=Math.max(.01,vision?vision.radius:world.WORLD.visibilityRadius),radius=worldRadius*zoom,image=fog(worldRadius);
   if(image){const left=clamp(sx-radius,0,width),right=clamp(sx+radius,0,width),top=clamp(sy-radius,0,height),bottom=clamp(sy+radius,0,height);ctx.fillStyle='#091d30e8';ctx.fillRect(0,0,width,top);ctx.fillRect(0,bottom,width,height-bottom);ctx.fillRect(0,top,left,bottom-top);ctx.fillRect(right,top,width-right,bottom-top);ctx.drawImage(image,sx-radius,sy-radius,radius*2,radius*2);}
   else{const gradient=ctx.createRadialGradient(sx,sy,radius*.35,sx,sy,radius);gradient.addColorStop(0,'#091d3000');gradient.addColorStop(.82,'#091d3038');gradient.addColorStop(1,'#091d30e8');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);}

  }
 }
 function screenToWorld(clientX,clientY){if(stopped||!view.camera||!Number.isFinite(clientX)||!Number.isFinite(clientY))return null;const r=canvas.getBoundingClientRect();return {x:(clientX-r.left-view.width/2)/view.zoom+view.camera.x,y:(clientY-r.top-view.height/2)/view.zoom+view.camera.y};}
 function worldToScreen(position){if(stopped||!view.camera||!point(position))return null;const r=canvas.getBoundingClientRect();return {x:(position.x-view.camera.x)*view.zoom+view.width/2+r.left,y:(position.y-view.camera.y)*view.zoom+view.height/2+r.top};}
 function pick(clientX,clientY){
  const target=screenToWorld(clientX,clientY),game=observerGame(room?.game);if(!target||!game)return null;
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
  for(const [roomId,station]of Object.entries(world.WORLD_STATIONS))if(Math.abs(target.x-station.x)<=24+padding&&Math.abs(target.y-station.y)<=26+padding)return {type:'station',id:station.id||`station-${roomId}`,roomId};
  if(Math.hypot(target.x-world.WORLD_BELL.x,target.y-world.WORLD_BELL.y)<=22+padding)return {type:'bell',id:'bell',roomId:'bridge'};
  for(const prop of world.WORLD_OBSTACLES)if(target.x>=prop.x&&target.x<=prop.x+prop.width&&target.y>=prop.y&&target.y<=prop.y+prop.height)return {type:'prop',id:prop.id,roomId:world.worldRoomAt(target)};
  for(const [index,item]of (world.WORLD_DECOR||[]).entries()){if(!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;const width=item.width||20,height=item.height||20;if(target.x>=item.x-10&&target.x<=item.x+width+10&&target.y>=item.y-10&&target.y<=item.y+height+10)return {type:'decor',id:item.id||`decor-${index}`,roomId:world.worldRoomAt(target),kind:item.kind};}
  const roomId=world.worldRoomAt(target);return roomId?{type:'room',id:roomId,roomId}:null;
 }
 return {update,draw,pick,screenToWorld,worldToScreen,getCamera(){return {...(view.camera||cameraTrack.at(lastAt,true)||world.WORLD_VIEWPOINT)};},setIntent(input,at){return samples.setIntent?.(input,at)||false;},suspend(){clearTransient();releaseOverview(overviewLayer);overviewLayer=null;paintedActors=[];samples.clear();cameraTrack.clear();lastKey=null;},toWorld(clientX,clientY){if(playback)return null;const r=canvas.getBoundingClientRect();return {x:(clientX-r.left-view.width/2)/view.zoom+view.camera.x,y:(clientY-r.top-view.height/2)/view.zoom+view.camera.y};},stats(){return {...cache.stats(),terrainViewportBytes:terrainLayer?.bytes||0,effectBytes:(fogLayer?.bytes||0)+[...glows.values()].reduce((n,l)=>n+l.bytes,0),maxTerrainViewportBytes:4*1024*1024,maxEffectBytes:3*256*256*4,overviewBytes:overviewLayer?.bytes||0,overviewSharedBytes:[...overviewLayers].reduce((n,e)=>n+e.bytes,0),maxOverviewBytes:8*1024*1024};},dispose(){stopped=true;clearTransient();releaseOverview(overviewLayer);overviewLayer=null;paintedActors=[];samples.clear();cameraTrack.clear();cache.dispose();}};
}
