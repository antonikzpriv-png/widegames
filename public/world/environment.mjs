import {intersects} from './camera.mjs';
const colors={bridge:['#467e91','#9ccbc7'],archive:['#69658e','#c4bed6'],lantern:['#b08042','#e9d39b'],workshop:['#557968','#bad0ad'],galley:['#9d6d57','#e1b79a'],engine:['#52687d','#a6bbc8']};
Object.assign(colors,{'chartwork':['#427b91','#a9ccc6'],'tidal-brass':['#8b784e','#d9cb9f'],'sea-glass':['#4f8880','#b5d5b9'],'paper-copper':['#8b6859','#ddc8aa'],'linen-teal':['#5c8b8b','#d0ded0'],'signal-violet':['#73638f','#c7beda'],'amber-lens':['#ac8048','#ead6a2'],'pressure-blue':['#4d7296','#b6cddb'],'tool-ochre':['#988048','#d8ca95'],'canvas-rust':['#956b57','#d5b7a3'],'turbine-red':['#94605b','#d7b5a4'],'rope-slate':['#677887','#c3cbcc'],'warm-enamel':['#9b795a','#e5cfac'],'water-jade':['#4f8577','#bad4c2']});
const fallback=['#526f7c','#b4c6c1'];
const box=(ctx,x,y,w,h,color,r=6,stroke='#183548',line=3)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.lineWidth=line;ctx.strokeStyle=stroke;ctx.stroke();}};
const line=(ctx,x,y,xx,yy,color,width=2)=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
const circle=(ctx,x,y,r,color,stroke='#183548')=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
const plans=new WeakMap();
/** Only metadata solids matching actual colliders get raised furniture. */
export function environmentPlan(map){
 if(plans.has(map))return plans.get(map);
 const g=map.geometry,rooms=new Set(g.WORLD_ROOMS.map(r=>r.id)),corridors=g.WORLD_FLOORS.filter(f=>!rooms.has(f.id)),obstacles=g.WORLD_OBSTACLES||[];
 const same=(a,b)=>['x','y','width','height'].every(k=>a[k]===b[k]);
 const props=[],used=new Set();
 for(const room of g.WORLD_ROOMS){
  for(const prop of map.art?.rooms?.[room.id]?.props||[]){if(!['x','y','width','height'].every(k=>Number.isFinite(prop[k]))||prop.width<=0||prop.height<=0)continue;
   const obstacle=obstacles.find(o=>same(o,prop));if(prop.solid===true&&!obstacle)continue;
   if(obstacle)used.add(obstacle);props.push({...prop,roomId:room.id,solid:!!obstacle});
  }
 }
 for(const [index,obstacle]of obstacles.entries())if(!used.has(obstacle)){const room=g.WORLD_ROOMS.find(r=>intersects(r,obstacle));props.push({...obstacle,roomId:room?.id,solid:true,kind:['console','locker','pump','bench','fan'][index%5]});}
 const thresholds=[];
 for(const r of g.WORLD_ROOMS)for(const f of corridors){const top=Math.max(r.y,f.y),bottom=Math.min(r.y+r.height,f.y+f.height),left=Math.max(r.x,f.x),right=Math.min(r.x+r.width,f.x+f.width);
  for(const x of [r.x,r.x+r.width])if(f.x<x&&f.x+f.width>x&&bottom-top>30)thresholds.push({x:x-7,y:top+3,width:14,height:bottom-top-6});
  for(const y of [r.y,r.y+r.height])if(f.y<y&&f.y+f.height>y&&right-left>30)thresholds.push({x:left+3,y:y-7,width:right-left-6,height:14});
 }
 const plan={corridors,props,thresholds};plans.set(map,plan);return plan;
}
function furniture(ctx,p){
 const {x,y,width:w,height:h}=p;
 if(!p.solid){
  if(p.kind==='window'){box(ctx,x,y,w,h,'#284b60',3,'#ced5b5',2);for(let i=1;i<4;i++)line(ctx,x+w*i/4,y+1,x+w*i/4,y+h-1,'#7eb7ba',2);}
  else if(p.kind==='pipe'){line(ctx,x,y+h/2,x+w,y+h/2,'#a59571',Math.min(5,h));for(let i=0;i<3;i++)line(ctx,x+w*i/3,y,x+w*i/3,y+h,'#d2bd8f',2);}
  else{ctx.save();ctx.globalAlpha=.45;ctx.strokeStyle='#355b65';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);ctx.restore();}return;
 }
 box(ctx,x+4,y+7,w,h,'#122c3f55',6,null);box(ctx,x,y,w,h,'#4a6973');box(ctx,x+3,y+3,w-6,Math.max(8,h-10),'#789394',4,'#b8ccc2',1);
 if(p.kind==='console'||p.kind==='window'){
  box(ctx,x+8,y+7,Math.max(4,w-16),Math.max(4,h-17),'#254b60',4,'#183548',2);
  for(let i=1;i<=3;i++)line(ctx,x+10,y+7+(h-17)*i/4,x+w-10,y+7+(h-17)*i/4,'#a7d3c344');
  line(ctx,x+w*.2,y+h*.5,x+w*.42,y+h*.3,'#b7e9dc',2);line(ctx,x+w*.42,y+h*.3,x+w*.65,y+h*.6,'#b7e9dc',2);
 }else if(p.kind==='pump'||p.kind==='fan'){
  const r=Math.min(w,h)*.34,cx=x+w/2,cy=y+h/2;circle(ctx,cx,cy,r,'#254b60');
  for(let i=0;i<4;i++){const a=i*Math.PI/2;line(ctx,cx+Math.cos(a)*r*.2,cy+Math.sin(a)*r*.2,cx+Math.cos(a+.5)*r*.85,cy+Math.sin(a+.5)*r*.85,'#afc9bd',5);}circle(ctx,cx,cy,r*.22,'#e9c17c');
 }else if(p.kind==='plant'){
  box(ctx,x+5,y+h*.55,w-10,h*.4,'#a67c56',5);for(let i=0;i<5;i++){const cx=x+w*(i+1)/6;line(ctx,cx,y+h*.75,cx-6,y+10,'#426c52',3);ctx.fillStyle=i%2?'#729c69':'#4f8061';ctx.beginPath();ctx.ellipse(cx-7,y+h*.35,9,h*.25,-.5,0,Math.PI*2);ctx.fill();}
 }else if(p.kind==='crate'){line(ctx,x+5,y+5,x+w-5,y+h-5,'#445f63',5);line(ctx,x+w-5,y+5,x+5,y+h-5,'#b8b38d',5);}
 else if(p.kind==='pipe'){line(ctx,x+8,y+h/2,x+w-8,y+h/2,'#c2b58b',Math.min(12,h/2));}
 else{for(let i=0;i<Math.min(8,Math.floor(w/24));i++)line(ctx,x+12+i*24,y+10,x+12+i*24,y+h-12,'#c3d0b6',3);}
 for(const [cx,cy]of [[x+5,y+5],[x+w-5,y+5],[x+5,y+h-5],[x+w-5,y+h-5]])circle(ctx,cx,cy,1.5,'#d3dfcc',null);
}
export function paintEnvironment(ctx,map,bounds){
 const g=map.geometry,plan=environmentPlan(map);
 for(const f of g.WORLD_FLOORS)if(intersects(f,bounds,24))box(ctx,f.x-9,f.y-6,f.width+18,f.height+24,'#091c2b',12,'#0b2131',6);
 for(const f of plan.corridors)if(intersects(f,bounds,12)){
  box(ctx,f.x,f.y,f.width,f.height,'#789a9b',5,'#244451',3);
  ctx.save();ctx.beginPath();ctx.rect(f.x+3,f.y+3,f.width-6,f.height-6);ctx.clip();
  if(f.width>f.height){for(let x=f.x+20;x<f.x+f.width;x+=36)line(ctx,x,f.y+8,x,f.y+f.height-8,'#26495845');line(ctx,f.x+6,f.y+10,f.x+f.width-6,f.y+10,'#d9dec799');}
  else{for(let y=f.y+20;y<f.y+f.height;y+=36)line(ctx,f.x+8,y,f.x+f.width-8,y,'#26495845');line(ctx,f.x+10,f.y+6,f.x+10,f.y+f.height-6,'#d9dec799');}ctx.restore();
 }
 for(const [index,r]of g.WORLD_ROOMS.entries())if(intersects(r,bounds,24)){
  const theme=map.art?.rooms?.[r.id]?.theme||r.id,[wall,floor]=colors[theme]||colors[r.id]||(map.id==='stormbreak-annex'?['#536e78','#b3c1c4']:fallback);
  box(ctx,r.x,r.y,r.width,r.height,wall,16,'#153349',6);box(ctx,r.x+8,r.y+12,r.width-16,r.height-20,floor,10,'#e8edda88',2);
  ctx.save();ctx.beginPath();ctx.rect(r.x+12,r.y+16,r.width-24,r.height-30);ctx.clip();
  ctx.strokeStyle='#1c3a4c1f';ctx.lineWidth=1;
  for(let x=r.x+28;x<r.x+r.width;x+=40)line(ctx,x,r.y+12,x,r.y+r.height,'#23465022');
  for(let y=r.y+24;y<r.y+r.height;y+=64)line(ctx,r.x,y,r.x+r.width,y,'#23465016');
  const light=ctx.createRadialGradient(r.x+r.width*.5,r.y+r.height*.25,1,r.x+r.width*.5,r.y+r.height*.25,Math.max(r.width,r.height));light.addColorStop(0,'#fff3c43a');light.addColorStop(1,'#18394c20');ctx.fillStyle=light;ctx.fillRect(r.x,r.y,r.width,r.height);ctx.restore();
  // Wall utilities are shallow trim within the actual perimeter, not colliders.
  line(ctx,r.x+22,r.y+6,r.x+r.width-22,r.y+6,'#dcc899',4);for(let x=r.x+28;x<r.x+r.width-16;x+=64)circle(ctx,x,r.y+6,2,'#f6e1ad',null);
  if(index%2===0){line(ctx,r.x+r.width-8,r.y+24,r.x+r.width-8,r.y+r.height*.5,'#9d8065',5);}
 }
 for(const p of plan.props)if(intersects(p,bounds,12))furniture(ctx,p);
 for(const t of plan.thresholds)if(intersects(t,bounds,8)){ctx.fillStyle='#92b3ad';ctx.fillRect(t.x,t.y,t.width,t.height);ctx.strokeStyle='#274858';ctx.lineWidth=3;ctx.strokeRect(t.x,t.y,t.width,t.height);}
 for(const d of map.fixtures.doors)if(intersects(d,bounds,20)){
  const horizontal=d.width>d.height;for(const sign of [0,1]){const x=horizontal?d.x+sign*d.width-5:d.x-4,y=horizontal?d.y-4:d.y+sign*d.height-5;box(ctx,x,y,horizontal?10:d.width+8,horizontal?d.height+8:10,'#d5b77c',3,'#1c3a4b',2);}
 }
}
export function drawRoomLabels(ctx,map,bounds,{overview=false,zoom=1}={}){
 for(const r of map.geometry.WORLD_ROOMS)if(overview||intersects(r,bounds)){
  const name=overview?String(map.roomLayout.findIndex(room=>room.id===r.id)+1):(map.roomLayout.find(room=>room.id===r.id)?.name||r.id);ctx.font=`900 ${overview?Math.max(18,11/zoom):18}px system-ui,sans-serif`;ctx.textAlign='center';ctx.strokeStyle='#eef0d3c0';ctx.lineWidth=4;ctx.strokeText(name.toUpperCase(),r.x+r.width/2,r.y+r.height-18);ctx.fillStyle='#244452';ctx.fillText(name.toUpperCase(),r.x+r.width/2,r.y+r.height-18);
 }
}
export function drawStation(ctx,position,kind,{active=false,critical=false,time=0,reduced=false}={}){
 const {x,y}=position,color=critical?'#e9997b':active?'#f1d181':'#aecfc5';
 ctx.save();ctx.translate(x,y);if(active||critical){ctx.strokeStyle=critical?'#ffb59a':'#fff0b9';ctx.lineWidth=3;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(0,0,32+(reduced?0:Math.sin(time/300)*2),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
 box(ctx,-24,-23,48,48,'#183b51',8,'#112a3b',3);box(ctx,-18,-17,36,30,color,4,null);ctx.strokeStyle='#284e60';ctx.fillStyle='#284e60';ctx.lineWidth=2;
 if(kind==='signal'){ctx.beginPath();for(let i=0;i<=30;i++){const yy=Math.sin(i*.35)*7;if(i===0)ctx.moveTo(i-15,yy-2);else ctx.lineTo(i-15,yy-2);}ctx.stroke();}
 else if(kind==='sequence'){for(let i=0;i<3;i++)box(ctx,-12+i*9,-9,6,6+i*3,'#31576b',1,null);}
 else if(kind==='glyphs'){for(const [i,j]of [[-1,-1],[1,-1],[-1,1],[1,1]])circle(ctx,i*7,j*6-2,3,'#31576b',null);}
 else if(kind==='alignment'){circle(ctx,0,-2,10,color);line(ctx,-10,-2,10,-2,'#31576b');line(ctx,0,-12,0,8,'#31576b');}
 else if(kind==='manifolds'){for(let i=-1;i<=1;i++){line(ctx,i*10,-12,i*10,7,'#31576b');circle(ctx,i*10,-4,3,'#31576b',null);}}
 else{for(let i=-1;i<=1;i++){line(ctx,-12,i*7-2,12,-i*7-2,'#31576b');circle(ctx,-12,i*7-2,2,'#31576b',null);}}
 line(ctx,-12,17,12,17,'#a9c8be',3);ctx.restore();
}
export function drawForeground(ctx,map,bounds){
 const plan=environmentPlan(map);
 for(const r of map.geometry.WORLD_ROOMS)if(intersects(r,bounds,20)){
  const cuts=plan.thresholds.filter(t=>t.width>t.height&&Math.abs(t.y+7-(r.y+r.height))<1).map(t=>[t.x-4,t.x+t.width+4]).sort((a,b)=>a[0]-b[0]);let from=r.x+12;
  for(const [a,b]of [...cuts,[r.x+r.width-12,r.x+r.width]]){if(a>from)box(ctx,from,r.y+r.height+2,a-from,7,'#173447',2,null);from=Math.max(from,b);}
 }
}
