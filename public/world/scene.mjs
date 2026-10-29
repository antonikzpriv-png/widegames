import * as world from '../../shared/world.mjs';
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
function decor(ctx,room,time,reduced){
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
  ctx.save();ctx.translate(x+95,y+100);ctx.rotate(reduced?0:time/9000);ctx.fillStyle='#fff4ba66';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(90,-25);ctx.lineTo(90,25);ctx.closePath();ctx.fill();ctx.restore();text(ctx,'STORM OPTICS',x+105,y+h-25,11,'#715422');
 }else if(id==='workshop'){
  round(ctx,x+25,y+25,190,44,6,'#68816c');for(let i=0;i<5;i++){ctx.strokeStyle='#d8dfc1';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x+44+i*35,y+36);ctx.lineTo(x+44+i*35,y+58);ctx.stroke();}round(ctx,x+28,y+h-58,84,34,6,'#c19b63');text(ctx,'RELAY BENCH',x+w/2,y+h-22,11,'#3e6059');
 }else if(id==='galley'){
  round(ctx,x+25,y+25,200,42,7,'#6b7d7b');for(let i=0;i<3;i++){circle(ctx,x+65+i*60,y+45,12,'#dce5cb');circle(ctx,x+65+i*60,y+45,6,'#6798a0',null);}round(ctx,x+22,y+h-62,85,36,5,'#ae7359');text(ctx,'FRESH WATER',x+w/2,y+h-24,11,'#704b43');
 }else if(id==='engine'){
  round(ctx,1220,990,100,50,12,'#445d76');for(let i=0;i<4;i++){ctx.strokeStyle='#9aafbf';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(1235+i*23,997);ctx.lineTo(1235+i*23,1033);ctx.stroke();}for(let i=0;i<3;i++)round(ctx,x+24+i*82,y+24,66,46,7,'#516a7c');text(ctx,'TURBINE HALL',x+w/2,y+h-23,11,'#425b70');
 }
}
export function createWorldScene(canvas,{reduced=false}={}){
 const ctx=canvas.getContext('2d'),samples=new ActorSamples();let room=null,lastKey=null,camera={x:800,y:400},view={width:1,height:1,zoom:1},stopped=false;
 function update(next,at){const key=`${next?.roomId}:${next?.game?.matchId}`;if(key!==lastKey){samples.clear();lastKey=key;camera={...(visionFrame(next?.game)?.origin||next?.game?.self?.position||{x:800,y:300})};}room=next;samples.update(room?.game,at);}
 function draw(time,{overview=false}={}){
  if(stopped)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const dpr=Math.min(2,globalThis.devicePixelRatio||1),width=rect.width,height=rect.height;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const sea=ctx.createLinearGradient(0,0,width,height);sea.addColorStop(0,'#102f48');sea.addColorStop(1,'#244957');ctx.fillStyle=sea;ctx.fillRect(0,0,width,height);
  if(!reduced){ctx.strokeStyle='#93c2d01c';ctx.lineWidth=2;for(let i=0;i<45;i++){const x=(i*137+time*.014)% (width+80)-40,y=(i*83+time*.038)%(height+80)-40;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-12,y+27);ctx.stroke();}}
  const game=room?.game,lobby=!game;
  const vision=visionFrame(game),follow=vision?.origin||game?.self?.position||samples.at(game?.players?.find(p=>point(p.position)&&p.alive)?.id,time,reduced)||{x:800,y:590};
  // Camera moves only toward an observed position; hidden actors have no samples.
  const destination=lobby?{x:800,y:310}:follow;camera=reduced?destination:{x:camera.x+(destination.x-camera.x)*.14,y:camera.y+(destination.y-camera.y)*.14};
  const zoom=overview?Math.min((width-30)/world.WORLD.width,(height-30)/world.WORLD.height):lobby?Math.min(width/620,height/390):clamp(Math.min(width/650,height/650),.58,1.2);
  if(overview)camera={x:800,y:600};view={width,height,zoom,camera:{...camera}};
  ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
  // Structural silhouette beneath the painted floor.
  for(const floor of world.WORLD_FLOORS)round(ctx,floor.x-8,floor.y-8,floor.width+16,floor.height+16,13,'#142838','#091c2c',9);
  for(const floor of world.WORLD_FLOORS)if(!floor.center){round(ctx,floor.x,floor.y,floor.width,floor.height,6,'#719398','#1b3545',4);ctx.strokeStyle='#c1d5c02b';ctx.lineWidth=2;for(let x=floor.x+20;x<floor.x+floor.width;x+=32){ctx.beginPath();ctx.moveTo(x,floor.y+8);ctx.lineTo(x,floor.y+floor.height-8);ctx.stroke();}}
  for(const r of world.WORLD_ROOMS){
   const [wall,floor]=palettes[r.id]||palettes.bridge;round(ctx,r.x,r.y,r.width,r.height,18,wall,'#102b3e',7);round(ctx,r.x+8,r.y+13,r.width-16,r.height-21,13,floor,'#ffffff55',3);
   ctx.save();ctx.beginPath();ctx.rect(r.x+12,r.y+16,r.width-24,r.height-30);ctx.clip();ctx.strokeStyle='#19344413';ctx.lineWidth=2;for(let x=r.x+30;x<r.x+r.width;x+=36){ctx.beginPath();ctx.moveTo(x,r.y+14);ctx.lineTo(x,r.y+r.height-8);ctx.stroke();}ctx.restore();
   text(ctx,names[r.id],r.x+r.width/2,r.y+r.height-7,19,'#163346');decor(ctx,r,time,reduced);
   const station=world.WORLD_STATIONS[r.id],hasTask=game?.self?.tasks?.some(t=>!t.completed&&t.roomId===r.id),critical=game?.beaconVersion!==1&&game?.sabotage?.active&&game.sabotage.roomId===r.id;
   if(hasTask||critical){ctx.save();ctx.shadowColor=critical?'#ff6963':'#ffe895';ctx.shadowBlur=reduced?14:20+Math.sin(time/250)*7;circle(ctx,station.x,station.y,31,critical?'#e87162':'#f3d98e',undefined,4);ctx.restore();}
   round(ctx,station.x-22,station.y-24,44,48,8,'#31586a');round(ctx,station.x-14,station.y-17,28,22,4,critical?'#ff8573':hasTask?'#ffeb9e':'#9dcaba',null);text(ctx,critical?'!':hasTask?'E':'·',station.x,station.y+1,18,'#224859');
  }
  // Open thresholds exactly where shared corridor floors cross a room boundary.
  for(const r of world.WORLD_ROOMS)for(const f of world.WORLD_FLOORS.filter(f=>!f.center)){
   const top=Math.max(r.y,f.y),bottom=Math.min(r.y+r.height,f.y+f.height),left=Math.max(r.x,f.x),right=Math.min(r.x+r.width,f.x+f.width);
   ctx.fillStyle='#8faba5';ctx.strokeStyle='#19374a';ctx.lineWidth=5;
   for(const edge of [r.x,r.x+r.width])if(f.x<edge&&f.x+f.width>edge&&bottom-top>30){ctx.fillRect(edge-7,top+3,14,bottom-top-6);ctx.beginPath();ctx.moveTo(edge-11,top+2);ctx.lineTo(edge+11,top+2);ctx.moveTo(edge-11,bottom-2);ctx.lineTo(edge+11,bottom-2);ctx.stroke();}
   for(const edge of [r.y,r.y+r.height])if(f.y<edge&&f.y+f.height>edge&&right-left>30){ctx.fillRect(left+3,edge-7,right-left-6,14);ctx.beginPath();ctx.moveTo(left+2,edge-11);ctx.lineTo(left+2,edge+11);ctx.moveTo(right-2,edge-11);ctx.lineTo(right-2,edge+11);ctx.stroke();}
  }
  drawBeaconFixtures(ctx,game);
  circle(ctx,world.WORLD_BELL.x,world.WORLD_BELL.y,19,'#e1a34f');circle(ctx,world.WORLD_BELL.x,world.WORLD_BELL.y,9,'#fff0ba',undefined,2);
  for(const body of visibleBodies(game)){ctx.save();ctx.translate(body.position.x,body.position.y);ctx.rotate(-.25);const color=game.players.find(p=>p.id===body.playerId)?.color||'#d3b48b';round(ctx,-25,-10,48,24,12,color);round(ctx,-15,-8,20,13,5,'#274958',undefined,3);ctx.restore();text(ctx,'FALLEN',body.position.x,body.position.y+31,11,'#fbf1d5');}
  const actors=lobby?(room?.roster||CHARACTERS).map((p,i,list)=>({...p,position:{x:800+((i%Math.ceil(Math.sqrt(list.length)))-(Math.ceil(Math.sqrt(list.length))-1)/2)*100,y:240+Math.floor(i/Math.ceil(Math.sqrt(list.length)))*95},alive:true})):Array.from(samples.samples.values(),s=>s.player);
  for(const player of actors.sort((a,b)=>a.position.y-b.position.y)){
   const p=lobby?player.position:samples.at(player.id,time,reduced);if(!p)continue;
   drawKeeper(ctx,player,p.x,p.y,{selected:player.id===game?.self?.id,step:!reduced&&player.moving&&(player.id===game?.self?.id||time-(samples.samples.get(player.id)?.at||0)<300)?time/95:0,scale:1.02});
  }
  ctx.restore();
  if(!overview&&((vision&&!vision.ended)||game?.beaconVersion!==1&&game?.self&&point(game.self.position))){
   const origin=vision?.origin||game.self.position,sx=(origin.x-camera.x)*zoom+width/2,sy=(origin.y-camera.y)*zoom+height/2,radius=Math.max(.01,(vision?vision.radius:world.WORLD.visibilityRadius)*zoom);
   const fog=ctx.createRadialGradient(sx,sy,radius*.35,sx,sy,radius);fog.addColorStop(0,'#091d3000');fog.addColorStop(.82,'#091d3038');fog.addColorStop(1,'#091d30e8');ctx.fillStyle=fog;ctx.fillRect(0,0,width,height);
  }
 }
 return {update,draw,toWorld(clientX,clientY){const r=canvas.getBoundingClientRect();return {x:(clientX-r.left-view.width/2)/view.zoom+view.camera.x,y:(clientY-r.top-view.height/2)/view.zoom+view.camera.y};},dispose(){stopped=true;samples.clear();}};
}
