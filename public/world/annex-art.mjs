/** Original copper-and-slate Annex art. Props follow actual immutable colliders. */
const colors=[['#658eaa','#aecbd3'],['#829eb2','#c5d4d4'],['#67a49a','#b8d4c4'],['#bb8d73','#ddbf9a'],['#86aaa3','#c5ddd1'],['#878ba4','#b6bbcb'],['#b29979','#deceb0'],['#8f8db1','#c6c2dd']];
export const annexPalette=index=>colors[index%colors.length];
export function drawAnnexDecor(ctx,room,time,reduced,map){
 ctx.save();ctx.strokeStyle='#b57d4e';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(room.x+18,room.y+22);ctx.lineTo(room.x+room.width-18,room.y+22);ctx.lineTo(room.x+room.width-18,room.y+68);ctx.stroke();
 for(let x=room.x+30;x<room.x+room.width-25;x+=52){ctx.fillStyle='#e5d8aa';ctx.beginPath();ctx.arc(x,room.y+22,4,0,Math.PI*2);ctx.fill();}
 for(const prop of map.geometry.WORLD_OBSTACLES.filter(p=>p.x>=room.x&&p.x<room.x+room.width&&p.y>=room.y&&p.y<room.y+room.height)){
  const {x,y,width:w,height:h}=prop;ctx.fillStyle=room.id==='clinic'?'#d5e4d4':room.id==='canteen'?'#a98258':'#49697a';ctx.strokeStyle='#183447';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(x,y,w,h,7);ctx.fill();ctx.stroke();
  if(room.id==='observatory'){ctx.save();ctx.translate(x+w/2,y+h/2);if(!reduced)ctx.rotate(time/13000);for(const radius of [h*.42,h*.28,h*.1]){ctx.strokeStyle='#dfbf7c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();}ctx.restore();}
  else if(room.id==='clinic'){ctx.fillStyle='#a3554d';ctx.fillRect(x+w/2-3,y+8,6,h-16);ctx.fillRect(x+15,y+h/2-3,w-30,6);}
  else if(room.id==='signal'){for(let i=0;i<4;i++){ctx.fillStyle=['#e2b966','#bd7867','#81b6ba','#e8ddad'][i];ctx.beginPath();ctx.moveTo(x+12+i*24,y+8);ctx.lineTo(x+28+i*24,y+8);ctx.lineTo(x+20+i*24,y+h-7);ctx.closePath();ctx.fill();}}
  else{ctx.strokeStyle='#c7cfb7';ctx.lineWidth=3;for(let line=x+12;line<x+w-8;line+=18){ctx.beginPath();ctx.moveTo(line,y+8);ctx.lineTo(line,y+h-8);ctx.stroke();}}
 }
 ctx.restore();
}
