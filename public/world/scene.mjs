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
export function createWorldScene(canvas,{reduced=false,mapResolver=getMap,motionFactory}={}){
 const ctx=canvas.getContext('2d'),samples=motionFactory?motionFactory({mapResolver}):new ActorSamples({mapResolver,world:true});let map=mapResolver(),world=map.geometry;let room=null,lastKey=null,camera={x:800,y:400},view={width:1,height:1,zoom:1},stopped=false,lastOwner=null,lastAt=-Infinity,lastVersion=-1;
 const cameraTrack=new ObservedCamera();
 const cache=createStaticLayer({paint:paintEnvironment,makeCanvas:(w,h)=>{if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);return canvas.ownerDocument?.createElement?.('canvas')||globalThis.document?.createElement?.('canvas');}});
 function update(next,at){
  const nextMap=mapResolver(next?.game?.map??next?.map),game=next?.game;
  const owner=JSON.stringify([next?.roomId,game?.matchId,nextMap.id,nextMap.version,game?.self?.id]);
  if(owner===lastOwner&&(at<lastAt||Number.isFinite(game?.version)&&game.version<lastVersion))return;
  const key=JSON.stringify([owner,game?.phase,game?.self?.alive,!!(game?.self?.transit||game?.systems?.selfTransit),game?.vision?.mode]);
  map=nextMap;world=map.geometry;
  const target=!game?{x:world.WORLD_VIEWPOINT.x,y:world.WORLD_VIEWPOINT.y+25}:(visionFrame(game,map)?.origin||game?.self?.position||world.WORLD_VIEWPOINT);
  if(key!==lastKey){samples.clear();cameraTrack.reset(target,at);lastKey=key;}else cameraTrack.update(target,at);
  lastOwner=owner;lastAt=at;lastVersion=Number.isFinite(game?.version)?game.version:-1;
  room=next;samples.update(game,at);
 }

 function draw(time,{overview=false}={}){
  if(stopped)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const dpr=Math.min(2,globalThis.devicePixelRatio||1),width=rect.width,height=rect.height;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const sea=ctx.createLinearGradient(0,0,width,height);sea.addColorStop(0,map.id==='beacon'?'#102f48':'#172f46');sea.addColorStop(1,map.id==='beacon'?'#244957':'#3e6067');ctx.fillStyle=sea;ctx.fillRect(0,0,width,height);
  if(!reduced){ctx.strokeStyle='#93c2d01c';ctx.lineWidth=2;for(let i=0;i<45;i++){const x=(i*137+time*.014)% (width+80)-40,y=(i*83+time*.038)%(height+80)-40;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-12,y+27);ctx.stroke();}}
  const game=room?.game,lobby=!game;
  const vision=visionFrame(game,map);
  camera=cameraTrack.at(time,reduced)||{...world.WORLD_VIEWPOINT};

  const zoom=overview?Math.min((width-30)/world.WORLD.width,(height-30)/world.WORLD.height):lobby?Math.min(width/620,height/390):clamp(Math.min(width/650,height/650),.64,1.28);
  if(overview)camera={x:world.WORLD.width/2,y:world.WORLD.height/2};view={width,height,zoom,camera:{...camera}};
  ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
  const bounds=viewportBounds(camera,width,height,zoom,0);
  if(overview)paintEnvironment(ctx,map,bounds);else cache.draw(ctx,map,bounds);
  drawRoomLabels(ctx,map,bounds,{overview,zoom});
  for(const r of world.WORLD_ROOMS){const station=world.WORLD_STATIONS[r.id];if(!station||!intersects({x:station.x-40,y:station.y-40,width:80,height:80},bounds))continue;
   const task=game?.self?.tasks?.find(t=>!t.completed&&t.roomId===r.id),critical=game?.beaconVersion!==1&&game?.sabotage?.active&&game.sabotage.roomId===r.id;
   const kind=task?.challenge?.kind||map.taskKinds?.[r.id]||({bridge:'circuit',workshop:'circuit',lantern:'signal',engine:'alignment',archive:'sequence',galley:'manifolds'})[r.id]||'glyphs';
   drawStation(ctx,station,kind,{active:!!task,critical,time,reduced});
  }
  drawBeaconFixtures(ctx,game,map);
  circle(ctx,world.WORLD_BELL.x,world.WORLD_BELL.y,19,'#e1a34f');circle(ctx,world.WORLD_BELL.x,world.WORLD_BELL.y,9,'#fff0ba',undefined,2);
  for(const body of visibleBodies(game)){ctx.save();ctx.translate(body.position.x,body.position.y);ctx.rotate(-.25);const color=game.players.find(p=>p.id===body.playerId)?.color||'#d3b48b';round(ctx,-25,-10,48,24,12,color);round(ctx,-15,-8,20,13,5,'#274958',undefined,3);ctx.restore();text(ctx,'FALLEN',body.position.x,body.position.y+31,11,'#fbf1d5');}
  const actors=lobby?(room?.roster||CHARACTERS).map((p,i,list)=>({...p,position:{x:world.WORLD_VIEWPOINT.x+((i%Math.ceil(Math.sqrt(list.length)))-(Math.ceil(Math.sqrt(list.length))-1)/2)*100,y:world.WORLD_VIEWPOINT.y-45+Math.floor(i/Math.ceil(Math.sqrt(list.length)))*95},alive:true})):Array.from(samples.samples.values(),s=>s.player);
  for(const player of actors.sort((a,b)=>a.position.y-b.position.y)){
   const p=lobby?player.position:samples.at(player.id,time,reduced);if(!p)continue;
   drawKeeper(ctx,player,p.x,p.y,{selected:player.id===game?.self?.id,step:!reduced&&player.moving&&(player.id===game?.self?.id||time-(samples.samples.get(player.id)?.at||0)<300)?time/95:0,scale:1.02});
  }
  drawForeground(ctx,map,bounds);
  ctx.restore();
  if(!overview&&((vision&&!vision.ended)||game?.beaconVersion!==1&&game?.self&&point(game.self.position))){
   const origin=vision?.origin||game.self.position,sx=(origin.x-camera.x)*zoom+width/2,sy=(origin.y-camera.y)*zoom+height/2,radius=Math.max(.01,(vision?vision.radius:world.WORLD.visibilityRadius)*zoom);
   const fog=ctx.createRadialGradient(sx,sy,radius*.35,sx,sy,radius);fog.addColorStop(0,'#091d3000');fog.addColorStop(.82,'#091d3038');fog.addColorStop(1,'#091d30e8');ctx.fillStyle=fog;ctx.fillRect(0,0,width,height);
  }
 }
 return {update,draw,setIntent(input,at){return samples.setIntent?.(input,at)||false;},suspend(){samples.clear();cameraTrack.clear();lastKey=null;},toWorld(clientX,clientY){const r=canvas.getBoundingClientRect();return {x:(clientX-r.left-view.width/2)/view.zoom+view.camera.x,y:(clientY-r.top-view.height/2)/view.zoom+view.camera.y};},stats(){return cache.stats();},dispose(){stopped=true;samples.clear();cameraTrack.clear();cache.dispose();}};
}
