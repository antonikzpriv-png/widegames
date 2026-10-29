import {getMap} from '../../shared/maps/index.mjs';
import {finitePoint,criticalSites,descriptors} from './beacon-model.mjs';

/** Cosmetic fog only. The server has already removed unobservable entities. */
export function visionFrame(game,map=getMap(game?.map)){
 if(game?.beaconVersion!==1)return null;
 const origin=finitePoint(game.vision?.origin)?game.vision.origin:finitePoint(game.vision?.position)?game.vision.position:finitePoint(game.self?.position)?game.self.position:map.geometry.WORLD_VIEWPOINT;
 const radius=Number.isFinite(game.vision?.radius)&&game.vision.radius>=0?game.vision.radius:0;
 return {origin:{...origin},radius,ended:game.phase==='ended'};
}
export function doorShapes(game,map=getMap(game?.map)){
 return map.fixtures.doors.map(fixture=>{const status=game?.systems?.doors?.find(door=>door.id===fixture.id);return {...fixture,closed:typeof status?.closed==='boolean'?status.closed:null,deadlineAt:status?.deadlineAt};});
}
function label(ctx,value,x,y,size=11){ctx.font=`800 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.strokeStyle='#f4f0d9';ctx.lineWidth=3;ctx.strokeText(value,x,y);ctx.fillStyle='#163448';ctx.fillText(value,x,y);}
function plate(ctx,x,y,color){ctx.fillStyle=color;ctx.strokeStyle='#17384a';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x-15,y-14,30,28,6);ctx.fill();ctx.stroke();}
export function drawBeaconFixtures(ctx,game,map=getMap(game?.map)){
 if(game?.beaconVersion!==1)return;
 for(const door of doorShapes(game,map)){
  ctx.save();ctx.fillStyle=door.closed===true?'#bc7465':door.closed===false?'#87b4a4':'#a9aa9b';ctx.strokeStyle='#19384a';ctx.lineWidth=3;ctx.setLineDash(door.closed===null?[5,4]:[]);
  if(door.closed===true){ctx.fillRect(door.x,door.y,door.width,door.height);ctx.strokeRect(door.x,door.y,door.width,door.height);ctx.beginPath();ctx.moveTo(door.x+3,door.y+3);ctx.lineTo(door.x+door.width-3,door.y+door.height-3);ctx.moveTo(door.x+door.width-3,door.y+3);ctx.lineTo(door.x+3,door.y+door.height-3);ctx.stroke();}
  else{ctx.strokeRect(door.x,door.y,door.width,door.height);}
  label(ctx,door.closed===true?'CLOSED':door.closed===false?'OPEN':'UNKNOWN',door.x+door.width/2,door.y-8,10);ctx.restore();
 }
 for(const hatch of map.fixtures.vents){
  const permitted=descriptors(game).some(h=>h.type==='vent'&&h.enabled&&h.fields.entryId===hatch.id);
  ctx.save();plate(ctx,hatch.position.x,hatch.position.y,permitted?'#edd18b':'#889a9e');ctx.strokeStyle='#17384a';ctx.lineWidth=2;for(const offset of [-7,0,7]){ctx.beginPath();ctx.moveTo(hatch.position.x-9,hatch.position.y+offset);ctx.lineTo(hatch.position.x+9,hatch.position.y+offset);ctx.stroke();}label(ctx,'HATCH',hatch.position.x,hatch.position.y+29);ctx.restore();
 }
 const active=criticalSites(game,map);
 for(const [systemId,sites]of Object.entries(map.fixtures.repairs))for(const site of sites){
  const progress=active.find(s=>s.id===site.id),lit=!!progress&&game.sabotage?.active;
  ctx.save();plate(ctx,site.position.x,site.position.y,lit?'#edac7e':'#bdcbb1');ctx.strokeStyle='#18394a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(site.position.x-6,site.position.y-6);ctx.lineTo(site.position.x+6,site.position.y+6);ctx.moveTo(site.position.x+6,site.position.y-6);ctx.lineTo(site.position.x-6,site.position.y+6);ctx.stroke();label(ctx,`${systemId.toUpperCase()}${progress?.completed===true?' OK':lit?' !':''}`,site.position.x,site.position.y+29,10);ctx.restore();
 }
 for(const device of map.fixtures.devices){ctx.save();plate(ctx,device.position.x,device.position.y,game.systems?.communications?.active?'#9ba6aa':'#b2dcd4');ctx.fillStyle='#31586a';ctx.fillRect(device.position.x-9,device.position.y-8,18,12);label(ctx,device.kind==='cameras'?'CAMERAS':device.kind.toUpperCase(),device.position.x,device.position.y+29);ctx.restore();}
}
