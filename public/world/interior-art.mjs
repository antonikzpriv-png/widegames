/** Original, locally drawn cutaway artwork. Every solid prop uses its shared collider footprint. */
const INK='#17252d',METAL='#a3b2b3';
const layers=new WeakMap();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function tint(hex,other,amount){
 const rgb=value=>{const raw=String(value||'').replace('#',''),s=raw.length===3?raw.split('').map(c=>c+c).join(''):raw;return /^[a-f\d]{6}$/i.test(s)?[0,2,4].map(i=>parseInt(s.slice(i,i+2),16)):[96,116,121];};
 const a=rgb(hex),b=rgb(other);return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*amount).toString(16).padStart(2,'0')).join('');
}
function box(c,x,y,w,h,fill,stroke=INK,line=3,r=3){c.beginPath();c.roundRect(x,y,Math.max(.1,w),Math.max(.1,h),Math.max(0,Math.min(r,w/2,h/2)));if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}}
function line(c,points,color=INK,width=3){if(points.length<2)return;c.beginPath();c.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))c.lineTo(p.x,p.y);c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.stroke();}
function ellipse(c,x,y,rx,ry,fill,stroke=INK,width=3){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function polygon(c,points,fill,stroke=INK,width=3){if(!points.length)return;c.beginPath();c.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))c.lineTo(p.x,p.y);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
const outline=r=>r.outline?.length?r.outline:[{x:r.x,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x+r.width,y:r.y+r.height},{x:r.x,y:r.y+r.height}];
function contains(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
const cross=(a,b)=>a.x*b.y-a.y*b.x;
/** Split polygon edges at all floor intersections, then retain exposed boundary intervals only. */
function exposedEdges(floors){
 const polygons=floors.map(outline),edges=polygons.flatMap(points=>points.map((a,i)=>({a,b:points[(i+1)%points.length]}))),result=[];
 const floor=p=>polygons.some(poly=>contains(p,poly));
 for(const edge of edges){
  const a=edge.a,d={x:edge.b.x-a.x,y:edge.b.y-a.y},length=Math.hypot(d.x,d.y);if(length<.01)continue;
  const cuts=[0,1];
  for(const other of edges){const e={x:other.b.x-other.a.x,y:other.b.y-other.a.y},q={x:other.a.x-a.x,y:other.a.y-a.y},den=cross(d,e);
   if(Math.abs(den)>.00001){const t=cross(q,e)/den,u=cross(q,d)/den;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}
   else if(Math.abs(cross(q,d))<.001)for(const p of [other.a,other.b]){const t=((p.x-a.x)*d.x+(p.y-a.y)*d.y)/(length*length);if(t>0&&t<1)cuts.push(t);}
  }
  cuts.sort((x,y)=>x-y);
  for(let i=1;i<cuts.length;i++){const from=cuts[i-1],to=cuts[i];if((to-from)*length<.5)continue;const t=(from+to)/2,m={x:a.x+d.x*t,y:a.y+d.y*t},n={x:-d.y/length,y:d.x/length};if(floor({x:m.x+n.x,y:m.y+n.y})===floor({x:m.x-n.x,y:m.y-n.y}))continue;result.push({a:{x:a.x+d.x*from,y:a.y+d.y*from},b:{x:a.x+d.x*to,y:a.y+d.y*to}});}
 }
 return result;
}
function floorPaint(c,r,corridor=false){
 const points=outline(r),base=corridor?'#6c7c80':tint(r.palette?.[1]||'#a8b8b2','#59646a',.33),theme=r.theme||r.id;
 polygon(c,points,base,null);c.save();polygon(c,points,null,null);c.clip();
 const tile=/galley|medical|kitchen|refectory/.test(theme)?30:/archive|cargo/.test(theme)?48:40;
 for(let y=r.y;y<r.y+r.height;y+=tile)for(let x=r.x;x<r.x+r.width;x+=tile){
  if((Math.round((x-r.x)/tile)+Math.round((y-r.y)/tile))%2===0){c.fillStyle=corridor?'#e0e4da09':'#edf2de10';c.fillRect(x,y,tile,tile);}
  c.strokeStyle='#213d4324';c.lineWidth=1;c.strokeRect(x+.5,y+.5,tile,tile);
 }
 if(corridor){
  const horizontal=r.width>=r.height,cx=r.x+r.width/2,cy=r.y+r.height/2;
  c.setLineDash([13,12]);line(c,horizontal?[{x:r.x+12,y:cy},{x:r.x+r.width-12,y:cy}]:[{x:cx,y:r.y+12},{x:cx,y:r.y+r.height-12}],'#c6d2b749',2);c.setLineDash([]);
  if(horizontal)for(let x=r.x+20;x<r.x+r.width;x+=70){line(c,[{x,y:r.y+7},{x,y:r.y+r.height-7}],'#2d454b55',3);line(c,[{x:x+3,y:r.y+8},{x:x+3,y:r.y+r.height-8}],'#d5ded03b',1);}
  else for(let y=r.y+20;y<r.y+r.height;y+=70){line(c,[{x:r.x+7,y},{x:r.x+r.width-7,y}],'#2d454b55',3);line(c,[{x:r.x+8,y:y+3},{x:r.x+r.width-8,y:y+3}],'#d5ded03b',1);}
 }else {
  // Painted inset trim and service conduits are flat floor markings, never hidden colliders.
  c.globalAlpha=.25;polygon(c,points,null,tint(base,'#f0dfad',.6),13);c.globalAlpha=1;
  if(/engine|furnace|foundry|dynamo|casting|ballast|intake/.test(theme)){
   for(let x=r.x+22;x<r.x+r.width;x+=92){box(c,x,r.y+20,46,8,'#263e4440',null,0,0);box(c,x,r.y+r.height-29,46,8,'#263e4440',null,0,0);}
  }
  if(/lantern|orrery|sonar|observatory/.test(theme)){c.save();c.globalAlpha=.15;ellipse(c,r.center.x,r.center.y,Math.min(r.width,r.height)*.38,Math.min(r.width,r.height)*.38,null,'#f0dfa1',2);ellipse(c,r.center.x,r.center.y,Math.min(r.width,r.height)*.3,Math.min(r.width,r.height)*.3,null,'#f0dfa1',2);c.restore();}
 }
 c.restore();
}
function screw(c,x,y){ellipse(c,x,y,1.7,1.7,'#b7c1bd',INK,1);line(c,[{x:x-1,y},{x:x+1,y}],'#53646b',.8);}
function panel(c,x,y,w,h,color='#d7edb2'){box(c,x,y,w,h,'#172f3a',INK,2,2);box(c,x+3,y+3,w-6,h-6,color,null,0,1);}
function gauge(c,x,y,r=10,color='#e6e2c4'){ellipse(c,x,y,r,r,color,INK,2);line(c,[{x,y},{x:x+r*.45,y:y-r*.45}],'#c27155',2);ellipse(c,x,y,2,2,INK,null);}
function buttons(c,y=81,start=16,end=84){for(let x=start,i=0;x<=end;x+=12,i++)box(c,x,y,6,5,['#d9b968','#9bbf96','#c17862'][i%3],INK,1,1);}
function warning(c,x,y,w,h){c.save();box(c,x,y,w,h,'#dbc66a',INK,2,1);c.beginPath();c.rect(x,y,w,h);c.clip();for(let i=-h;i<w+h;i+=13)line(c,[{x:x+i,y:y+h},{x:x+i+h,y}],'#34404a',6);c.restore();}
function monitor(c,x,y,w,h,kind='wave'){
 panel(c,x,y,w,h,'#3f7781');c.save();c.beginPath();c.rect(x+3,y+3,w-6,h-6);c.clip();c.strokeStyle='#94c3b332';c.lineWidth=1;for(let dx=6;dx<w;dx+=8){c.beginPath();c.moveTo(x+dx,y+3);c.lineTo(x+dx,y+h-3);c.stroke();}for(let dy=6;dy<h;dy+=8){c.beginPath();c.moveTo(x+3,y+dy);c.lineTo(x+w-3,y+dy);c.stroke();}
 if(kind==='radar'){ellipse(c,x+w/2,y+h/2,w*.31,h*.31,null,'#b8d9b9',1);ellipse(c,x+w/2,y+h/2,w*.17,h*.17,null,'#b8d9b9',1);line(c,[{x:x+w/2,y:y+h/2},{x:x+w*.76,y:y+h*.19}],'#e4f7c4',2);ellipse(c,x+w*.68,y+h*.37,2,2,'#f7e8a5',null);}
 else{const points=Array.from({length:12},(_,i)=>({x:x+4+(w-8)*i/11,y:y+h*.55+Math.sin(i*1.7)*h*.19}));line(c,points,'#d0e7b5',1.8);}
 c.restore();
}
/** A deliberately varied, hand-drawn equipment vocabulary; no decorative box stands in for every machine. */
function equipment(c,prop){
 const {x,y,width:w,height:h}=prop;if(!(w>0&&h>0))return;const kind=prop.kind||'console',color=prop.color||'#6c8490',dark=tint(color,INK,.35),light=tint(color,'#e6e5cf',.35);
 c.save();c.translate(x,y);c.scale(w/100,h/100);
 box(c,3,6,96,94,'#10202955',null,0,6);box(c,0,0,100,96,color,INK,4,6);box(c,4,4,92,84,light,INK,1.5,4);box(c,5,84,90,10,dark,null,0,1);
 if(['reactor','generator','dynamo'].includes(kind)){
  box(c,13,10,74,71,'#344f5a',INK,3,10);ellipse(c,50,45,30,31,'#668b8f',INK,3);ellipse(c,50,45,21,23,'#273c49',INK,2);ellipse(c,50,45,11,16,'#b5e1c8','#e3f4c7',2);for(const [dx,dy]of [[0,-30],[29,0],[0,29],[-29,0]])box(c,45+dx,40+dy,10,10,'#e0b96c',INK,2,1);gauge(c,19,77,7);gauge(c,79,77,7);buttons(c,86,37,61);
 }else if(['turbine','engine'].includes(kind)){
  box(c,12,17,75,57,'#5d7880',INK,3,15);for(let i=0;i<6;i++)box(c,23+i*9,18,4,56,'#aec2bf',INK,1,1);ellipse(c,16,45,12,27,'#344d59',INK,3);ellipse(c,16,45,7,19,'#91b8b3',INK,2);line(c,[{x:7,y:82},{x:7,y:72},{x:83,y:72},{x:83,y:83}],'#364b56',7);gauge(c,82,19,9);warning(c,29,80,39,9);
 }else if(['furnace','forge'].includes(kind)){
  box(c,13,10,74,70,'#55606a',INK,3,7);box(c,21,26,58,43,'#302e36',INK,3,9);box(c,28,35,44,28,'#d17748','#6e3b36',3,6);polygon(c,[{x:34,y:61},{x:41,y:44},{x:48,y:53},{x:57,y:37},{x:66,y:61}],'#f3c85f',null);for(let i=0;i<5;i++)line(c,[{x:29+i*10,y:28},{x:29+i*10,y:68}],'#303d46',3);gauge(c,23,15,6);gauge(c,76,15,6);warning(c,13,81,74,10);
 }else if(['gantry','winch','crane'].includes(kind)){
  box(c,8,10,13,76,'#546471',INK,3,1);box(c,79,10,13,76,'#546471',INK,3,1);box(c,10,12,80,18,'#a4a183',INK,3,2);warning(c,23,17,53,8);line(c,[{x:50,y:30},{x:50,y:55}],'#2f454f',4);ellipse(c,50,63,11,10,null,INK,5);box(c,31,72,39,13,'#9f8862',INK,3,1);for(let i=0;i<3;i++)line(c,[{x:35+i*13,y:74},{x:35+i*13,y:82}],'#645b4b',2);
 }else if(['orrery','telescope','scope','optics'].includes(kind)){
  if(kind==='orrery'){
   ellipse(c,50,46,36,34,'#394c5d',INK,3);for(const r of [12,23,31])ellipse(c,50,46,r,r*.88,null,'#c7b36c',2);line(c,[{x:23,y:26},{x:76,y:66}],'#c7b36c',2);line(c,[{x:25,y:68},{x:76,y:25}],'#c7b36c',2);ellipse(c,50,46,9,9,'#e0bc69',INK,2);ellipse(c,75,29,5,5,'#9dc6be',INK,1.5);ellipse(c,31,66,4,4,'#cf8c6a',INK,1.5);gauge(c,19,84,6);buttons(c,84,34,82);
  }else{
   ellipse(c,48,60,26,20,'#48596b',INK,3);ellipse(c,48,60,15,11,'#9bacac',INK,2);polygon(c,[{x:17,y:38},{x:29,y:13},{x:80,y:37},{x:68,y:61}],'#98b9b6',INK,4);line(c,[{x:29,y:19},{x:74,y:40}],'#d1dfca',4);ellipse(c,23,27,10,15,'#284657',INK,3);ellipse(c,23,27,5,9,'#82bbc0',null);box(c,35,78,28,9,'#b6a98e',INK,2,2);
  }
 }else if(['prism','spectrum','lens'].includes(kind)){
  box(c,11,12,78,67,'#4a5f6b',INK,3,4);polygon(c,[{x:51,y:19},{x:77,y:65},{x:26,y:65}],'#a4d3d4',INK,3);polygon(c,[{x:51,y:19},{x:51,y:62},{x:29,y:62}],'#b7dae4',null);line(c,[{x:8,y:45},{x:36,y:45}],'#e8d796',4);for(const [i,col]of ['#e0b46f','#9bc2a1','#91bfd1'].entries())line(c,[{x:65,y:45},{x:93,y:33+i*14}],col,3);buttons(c,85);
 }else if(['pump','filter','filters','tank','ballast','intake'].includes(kind)){
  if(kind==='pump'){
   line(c,[{x:9,y:64},{x:24,y:64},{x:24,y:29},{x:74,y:29},{x:74,y:67},{x:91,y:67}],'#344e5a',15);line(c,[{x:9,y:64},{x:24,y:64},{x:24,y:29},{x:74,y:29},{x:74,y:67},{x:91,y:67}],'#9eb6b6',8);ellipse(c,50,48,22,23,'#688d93',INK,3);gauge(c,50,48,15);box(c,34,77,34,10,'#526873',INK,2,1);
  }else{
   for(const px of kind==='tank'?[50]:[29,71]){box(c,px-17,16,34,58,'#759898',INK,3,14);ellipse(c,px,19,17,9,'#b1c7bf',INK,2);ellipse(c,px,68,17,8,'#54737b',INK,2);line(c,[{x:px-13,y:29},{x:px-13,y:59}],'#c6d4c6',3);gauge(c,px,43,9);box(c,px-9,77,18,8,'#394f5b',INK,2,1);}line(c,[{x:17,y:10},{x:83,y:10}],'#445e68',6);buttons(c,87,22,75);
  }
 }else if(['coil','capacitor'].includes(kind)){
  box(c,13,18,74,60,'#3c5362',INK,3,5);for(let i=0;i<7;i++)ellipse(c,26+i*8,46,7,27,i%2?'#b49874':'#dab988',INK,1.5);box(c,10,28,12,35,'#6f8d91',INK,2,3);box(c,78,28,12,35,'#6f8d91',INK,2,3);warning(c,27,84,46,7);
 }else if(kind==='chair'){
  box(c,20,17,60,21,'#516a77',INK,3,7);box(c,21,40,58,33,'#8ca3a1',INK,3,9);box(c,12,37,13,34,'#567580',INK,2,4);box(c,75,37,13,34,'#567580',INK,2,4);line(c,[{x:33,y:77},{x:33,y:85}],'#344a57',5);line(c,[{x:67,y:77},{x:67,y:85}],'#344a57',5);
 }else if(['shelf','records','books','locker','cabinet'].includes(kind)){
  box(c,9,10,82,72,kind==='locker'?'#79939a':'#665f63',INK,3,2);
  if(kind==='cabinet'){for(let row=0;row<3;row++){box(c,15,16+row*20,70,16,'#a8b3a4',INK,1.5,1);box(c,41,21+row*20,18,4,'#51656a',INK,1,1);box(c,21,20+row*20,12,7,'#ded8b3',null,0,0);}}
  else if(kind==='locker'){for(let x=14;x<85;x+=25){box(c,x,15,20,61,'#abb8ad',INK,1.5,1);for(let y=20;y<35;y+=5)line(c,[{x:x+4,y},{x:x+16,y}],'#465d62',1.5);box(c,x+14,43,3,10,'#40515c',null,0,1);}}
  else for(let row=0;row<3;row++){for(let col=0;col<7;col++){const bx=14+col*10,by=15+row*22;box(c,bx,by+(col%3),7,15-(col%3),['#c5a66b','#8aa9aa','#be8e79','#b3b4a0'][(col+row)%4],INK,1,0);line(c,[{x:bx+2,y:by+5},{x:bx+5,y:by+5}],'#e4d9b4',1);}line(c,[{x:12,y:34+row*22},{x:88,y:34+row*22}],'#a88d74',3);}
 }else if(['crate','crates','cargo'].includes(kind)){
  box(c,10,10,80,73,'#ad946f',INK,3,2);box(c,17,17,66,57,'#c4af82','#756b57',2,1);line(c,[{x:17,y:17},{x:83,y:74}],'#766b56',5);line(c,[{x:83,y:17},{x:17,y:74}],'#766b56',5);box(c,40,33,20,21,'#e2d5a4',INK,1,1);for(const [px,py]of [[15,15],[85,15],[15,79],[85,79]])screw(c,px,py);
 }else if(['plant','planter','hydroponic','conservatory'].includes(kind)){
  box(c,10,14,80,64,'#4a6f69',INK,3,6);box(c,16,20,68,50,'#293f41',INK,2,3);
  for(let i=0;i<4;i++){const px=25+(i%2)*45,py=30+Math.floor(i/2)*28;ellipse(c,px,py,12,10,'#608f73',INK,1.5);ellipse(c,px-5,py-5,9,5,'#a0b782','#405e51',1);ellipse(c,px+7,py-3,7,7,'#789f75','#405e51',1);line(c,[{x:px,y:py+3},{x:px+1,y:py-9}],'#bdc789',1.5);}
  if(kind==='hydroponic'){line(c,[{x:6,y:7},{x:94,y:7}],'#c4d7cf',6);box(c,21,3,58,7,'#cce1b4',INK,1,2);}buttons(c,84,16,84);
 }else if(['cafeteria','table','chart','charts','navigation','drawing'].includes(kind)){
  if(kind==='cafeteria'){for(const [px,py]of [[4,36],[78,36],[38,2],[38,72]])box(c,px,py,19,21,'#859895',INK,2,5);ellipse(c,50,47,32,32,'#6c9ba3',INK,3);ellipse(c,50,45,29,27,'#92b9b8',INK,1.5);for(const [px,py]of [[38,37],[64,42],[49,60]])ellipse(c,px,py,5,5,'#d5ddc3',INK,1);}
  else{box(c,8,12,84,65,'#9a9279',INK,3,5);box(c,14,18,72,51,kind==='chart'?'#47818b':'#b5c6b3',INK,2,2);if(kind==='chart'){for(let i=0;i<5;i++)line(c,[{x:20+i*13,y:24},{x:20+i*13,y:63}],'#b9d3ba55',1);line(c,[{x:20,y:58},{x:35,y:40},{x:47,y:53},{x:66,y:29},{x:78,y:37}],'#dce7b3',2);ellipse(c,63,47,10,10,null,'#e5cd82',1.5);}else{box(c,23,27,25,29,'#e3dcc0','#7a928b',1,1);line(c,[{x:27,y:34},{x:41,y:34}],'#778d8c',1);line(c,[{x:27,y:40},{x:39,y:40}],'#778d8c',1);ellipse(c,68,46,7,7,'#d5dbc3',INK,1.5);}}
 }else if(['kitchen','galley','sink'].includes(kind)){
  box(c,9,13,82,62,'#8da4a1',INK,3,3);box(c,14,18,34,48,'#b8c7be',INK,2,3);box(c,18,22,26,35,'#4c737d',INK,2,5);line(c,[{x:29,y:21},{x:29,y:14},{x:40,y:14},{x:40,y:29}],'#d6dfcc',4);for(const [px,py]of [[64,31],[80,31],[64,53],[80,53]]){ellipse(c,px,py,7,8,'#3e525a',INK,1.5);ellipse(c,px,py,3,4,'#c1bc97',null);}buttons(c,82,23,82);
 }else if(['tools','workbench','workshop'].includes(kind)){
  box(c,9,12,82,62,'#b19a73',INK,3,3);box(c,14,18,72,12,'#516a68',INK,2,1);for(let i=0;i<4;i++){const px=25+i*17;line(c,[{x:px,y:38},{x:px-6,y:61}],['#779fa3','#b2b8a2','#7f929e','#b4b8b3'][i],5);ellipse(c,px+1,37,5,5,null,'#2d454c',2);}box(c,16,80,28,8,'#586e6c',INK,2,1);box(c,55,80,28,8,'#586e6c',INK,2,1);
 }else if(['medical','bed'].includes(kind)){
  box(c,17,9,66,75,'#afc4bb',INK,3,6);box(c,23,16,54,20,'#e6e2c9',INK,2,5);box(c,23,39,54,37,'#79a9ad',INK,2,3);box(c,43,48,14,22,'#d7e5ca',null,0,1);box(c,38,53,24,12,'#d7e5ca',null,0,1);line(c,[{x:10,y:24},{x:10,y:70}],'#b7c9c2',5);line(c,[{x:90,y:24},{x:90,y:70}],'#b7c9c2',5);
 }else if(['server','radio','signal'].includes(kind)){
  box(c,11,9,78,74,'#354f60',INK,3,3);for(let row=0;row<4;row++){box(c,17,15+row*16,66,12,'#728d94',INK,1.5,1);for(let col=0;col<6;col++)box(c,22+col*7,19+row*16,3,5,col%3?'#bdc9a1':'#d2ad74',null,0,0);line(c,[{x:69,y:19+row*16},{x:78,y:19+row*16}],'#293f4d',2);}buttons(c,87,31,67);
 }else if(kind==='sonar'){
  monitor(c,12,9,76,62,'radar');box(c,25,76,50,11,'#728d97',INK,2,2);for(let i=0;i<4;i++)gauge(c,31+i*13,82,4,'#dbd5b4');
 }else {
  monitor(c,12,11,76,51,kind==='console'?'wave':'radar');box(c,13,68,74,17,'#708b94',INK,2,2);for(let i=0;i<7;i++){box(c,19+i*8,73,4,4,'#bcccb8',INK,1,0);box(c,19+i*8,79,4,3,'#344e5d',null,0,0);}gauge(c,83,77,6);
 }
 for(const [px,py]of [[6,7],[94,7],[6,89],[94,89]])screw(c,px,py);
 if(prop.label){c.font='700 5px system-ui,sans-serif';c.textAlign='center';c.fillStyle='#e4e2c7';c.fillText(prop.label,50,92,75);}
 c.restore();
}
function detail(c,item){
 if(!Number.isFinite(item.x)||!Number.isFinite(item.y))return;
 const {x,y}=item,w=item.width??70,h=item.height??22,color=item.color||'#a3b7b4',kind=item.kind;
 if(kind==='light'||kind==='lamp'||kind==='lamps')return;
 c.save();
 if(kind==='label'){c.font=`700 ${item.size||13}px system-ui,sans-serif`;c.textAlign='center';c.fillStyle=item.color||'#dfddbf';c.fillText(String(item.text||''),x,y);}
 else if(kind==='circle'){ellipse(c,x,y,item.radius||35,item.radius||35,null,color,item.lineWidth||2);}
 else if(['pipe','cable','railing'].includes(kind)){
  const points=item.points?.length?item.points:[{x,y},{x:x+w,y:y+h}];
  if(kind==='pipe'){line(c,points,INK,11);line(c,points,color,7);line(c,points,tint(color,'#e9eddb',.4),2);for(const p of points){ellipse(c,p.x,p.y,5,5,'#829b9e',INK,1.5);ellipse(c,p.x,p.y,2,2,'#d4dfcf',null);}}
  else if(kind==='cable'){line(c,points,'#182d37',5);c.setLineDash([8,4]);line(c,points,color,3);c.setLineDash([]);}
  else{line(c,points,INK,5);line(c,points,color,2);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(a.x-b.x,a.y-b.y),steps=Math.max(1,Math.floor(length/22));for(let j=0;j<=steps;j++){const px=a.x+(b.x-a.x)*j/steps,py=a.y+(b.y-a.y)*j/steps;line(c,[{x:px-4,y:py-4},{x:px+4,y:py+4}],INK,4);}}}
 }else {
  if(item.rotation){c.translate(x+w/2,y+h/2);c.rotate(item.rotation*Math.PI/180);c.translate(-x-w/2,-y-h/2);}
  if(kind==='window'){
   box(c,x,y,w,h,'#253d4b',INK,4,2);box(c,x+4,y+4,w-8,h-8,'#619ba8','#c0d6d0',1,1);c.save();c.beginPath();c.rect(x+4,y+4,w-8,h-8);c.clip();for(let dx=-h;dx<w;dx+=35)line(c,[{x:x+dx,y:y+h},{x:x+dx+h,y}],'#c7e6dc60',5);c.restore();for(let dx=30;dx<w-10;dx+=38)line(c,[{x:x+dx,y:y+2},{x:x+dx,y:y+h-2}],INK,3);
  }else if(kind==='vent'||kind==='grate'){
   box(c,x,y,w,h,'#4b646c',INK,2,2);for(let dx=5;dx<w-3;dx+=7)line(c,[{x:x+dx,y:y+4},{x:x+dx,y:y+h-4}],'#203b45',2);for(const p of [[x+3,y+3],[x+w-3,y+h-3]])screw(c,...p);
  }else if(kind==='poster'){
   box(c,x,y,w,h,'#e0d7af','#4d6061',1,1);polygon(c,[{x:x+w*.5,y:y+h*.18},{x:x+w*.82,y:y+h*.68},{x:x+w*.18,y:y+h*.68}],'#caa367','#6a6352',1);line(c,[{x:x+w*.5,y:y+h*.33},{x:x+w*.5,y:y+h*.49}],'#4a514b',2);ellipse(c,x+w*.5,y+h*.58,1.3,1.3,'#4a514b',null);line(c,[{x:x+w*.2,y:y+h*.81},{x:x+w*.8,y:y+h*.81}],'#6b7567',1);
  }else if(['stripe','stripes','hazard'].includes(kind)){
   if(kind==='stripe'){c.setLineDash([14,10]);line(c,[{x,y},{x:x+w,y:y+h}],color,3);c.setLineDash([]);}
   else warning(c,x,y,Math.max(1,w),Math.max(5,h));
  }else if(kind==='hatch'){
   box(c,x,y,w,h,'#70868a',INK,3,4);box(c,x+6,y+6,w-12,h-12,null,'#a4b7ae',2,1);ellipse(c,x+w/2,y+h/2,Math.min(w,h)*.23,Math.min(w,h)*.23,null,INK,3);
  }
 }
 c.restore();
}
function walls(c,edges){
 c.save();c.shadowColor='#020b1199';c.shadowBlur=8;c.shadowOffsetY=10;
 for(const e of edges)line(c,[e.a,e.b],'#111c25',24);c.restore();
 for(const e of edges){line(c,[e.a,e.b],METAL,13);line(c,[{x:e.a.x,y:e.a.y+2},{x:e.b.x,y:e.b.y+2}],'#546a73',7);line(c,[{x:e.a.x,y:e.a.y-3},{x:e.b.x,y:e.b.y-3}],'#d4d9cb',2);const length=Math.hypot(e.a.x-e.b.x,e.a.y-e.b.y);for(let t=18;t<length-12;t+=62){const x=e.a.x+(e.b.x-e.a.x)*t/length,y=e.a.y+(e.b.y-e.a.y)*t/length;screw(c,x,y);}}
}
function paint(c,geometry){
 const rooms=geometry.WORLD_ROOMS,floors=geometry.WORLD_FLOORS,corridors=floors.filter(f=>!f.center),edges=geometry.WORLD_WALLS||exposedEdges(floors);
 c.save();c.lineJoin='round';
 // The joined outer rim reads as a single vessel rather than independent room cards.
 c.shadowColor='#02090c';c.shadowBlur=18;c.shadowOffsetY=9;for(const f of floors)polygon(c,outline(f),'#172a34','#071116',27);c.restore();
 for(const f of corridors)floorPaint(c,f,true);for(const r of rooms)floorPaint(c,r);
 walls(c,edges);
 const identities=new Set(rooms.flatMap(r=>[(r.name||'').toUpperCase(),r.id.toUpperCase()]));
 for(const item of geometry.WORLD_DECOR||[])if(item.kind!=='label'||!identities.has(String(item.text).toUpperCase()))detail(c,item);
 for(const prop of geometry.WORLD_OBSTACLES)equipment(c,prop);
}
/** Static art is shared between live/replay scenes; positions, tasks and hidden state never enter this cache. */
export function drawInterior(c,geometry,{cache=true}={}){
 if(!cache){paint(c,geometry);return;}
 let layer=layers.get(geometry);
 if(layer===undefined){
  const canvas=globalThis.document?.createElement?.('canvas')||null,ctx=canvas?.getContext?.('2d');
  if(ctx){canvas.width=geometry.WORLD.width;canvas.height=geometry.WORLD.height;paint(ctx,geometry);layer=canvas;}else layer=null;
  layers.set(geometry,layer);
 }
 if(layer)c.drawImage(layer,0,0);else paint(c,geometry);
}
/** Room names remain legible in the complete deck view without covering room-specific machinery. */
export function drawInteriorLabels(c,geometry,zoom=1){
 for(const r of geometry.WORLD_ROOMS){
  const label=(r.name||r.id).toUpperCase(),authored=(geometry.WORLD_DECOR||[]).find(d=>d.kind==='label'&&String(d.text).toUpperCase()===label),p=r.labelPosition||authored||{x:r.center.x,y:r.y+r.height-36},size=clamp(11/zoom,18,30);
  c.save();c.font=`800 ${size}px system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.lineWidth=3.5;c.strokeStyle='#162731';c.fillStyle='#f0eed5';c.strokeText(label,p.x,p.y,r.width-28);c.fillText(label,p.x,p.y,r.width-28);c.restore();
 }
}
export function drawInteriorLights(c,geometry,time,reduced){
 for(const item of geometry.WORLD_DECOR||[]){
  if(!['light','lamp','lamps'].includes(item.kind))continue;const points=item.kind==='lamps'?[{x:item.x,y:item.y},{x:item.x+(item.width||0),y:item.y},{x:item.x,y:item.y+(item.height||0)},{x:item.x+(item.width||0),y:item.y+(item.height||0)}]:[item];
  for(const p of points){c.save();c.shadowColor=item.color||'#d8e5ba';c.shadowBlur=reduced?7:9+Math.sin(time/1200)*2;box(c,p.x-7,p.y-3,14,6,item.color||'#d8e5ba','#253e48',1,2);c.restore();}
 }
}
