import {containsShape,distanceToSegment} from '../../shared/maps/shape-geometry.mjs';
import {mapReference} from './map-model.mjs';
import {getMap,mapIdentity} from '../../shared/maps/index.mjs';
const point=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y),copy=p=>({x:p.x,y:p.y}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;
function intersects(a,b,r){let low=0,high=1;for(const axis of ['x','y']){const size=axis==='x'?'width':'height',delta=b[axis]-a[axis];if(Math.abs(delta)<1e-12){if(a[axis]<r[axis]||a[axis]>r[axis]+r[size])return false;}else{let first=(r[axis]-a[axis])/delta,last=(r[axis]+r[size]-a[axis])/delta;if(first>last)[first,last]=[last,first];low=Math.max(low,first);high=Math.min(high,last);if(low>high)return false;}}return true;}
/** Redacted-view presentation only. Never submits actions or accepts authoritative positions. */
export class MotionTrack{
 constructor(options={}){
  this.interpolateMs=Number.isFinite(options.interpolationMs)?clamp(options.interpolationMs,0,140):90;
  this.predictMs=Number.isFinite(options.predictionMs)?clamp(options.predictionMs,0,120):100;
  this.timelineDelayMs=Number.isFinite(options.timelineDelayMs)?clamp(options.timelineDelayMs,0,140):null;this.allowRawFixtures=options.allowRawFixtures===true;this.resolveMap=options.mapResolver??getMap;this.samples=new Map();this.clear();
 }
 clear(){this.samples.clear();this.context=null;this.intent=null;this.map=null;this.speed=null;this.doors=[];this.vision=null;this.selfId=null;this.active=false;this.version=-1;this.receivedAt=-Infinity;this.inputSeq=0;this.owner=null;this.reveal=false;this.rawFixture=false;this.fixtureEase=false;}
 walk(p){const g=this.map?.geometry;if(!g||!point(p)||!g.isWalkable(p))return false;return !this.doors.some(r=>{const x=Math.max(r.x,Math.min(p.x,r.x+r.width)),y=Math.max(r.y,Math.min(p.y,r.y+r.height));return Math.hypot(p.x-x,p.y-y)<g.WORLD.bodyRadius||inside(p,r);});}
 segment(a,b){
  if(!this.walk(a)||!this.walk(b))return this.rawFixture&&point(a)&&point(b);
  const g=this.map.geometry,r=g.WORLD.bodyRadius,d=r/Math.SQRT2,x=b.x-a.x,y=b.y-a.y;
  function interval(p,rect,strict=false){let low=0,high=1;for(const [v,delta,min,size] of [[p.x,x,rect.x,rect.width],[p.y,y,rect.y,rect.height]]){if(Math.abs(delta)<1e-12){if(strict?v<=min||v>=min+size:v<min||v>min+size)return null;}else{let first=(min-v)/delta,last=(min+size-v)/delta;if(first>last)[first,last]=[last,first];low=Math.max(low,first);high=Math.min(high,last);if(strict?low>=high:low>high)return null;}}return [low,high];}
  if(g.metadata?.revision===2){
   if(!Array.isArray(g.WORLD_WALLS))return false;
   const route={a,b},cross=(u,v)=>u.x*v.y-u.y*v.x;
   for(const wall of g.WORLD_WALLS){
    const u={x:b.x-a.x,y:b.y-a.y},v={x:wall.b.x-wall.a.x,y:wall.b.y-wall.a.y},q={x:wall.a.x-a.x,y:wall.a.y-a.y},den=cross(u,v);
    if(Math.abs(den)>1e-12){const t=cross(q,v)/den,s=cross(q,u)/den;if(t>=0&&t<=1&&s>=0&&s<=1)return false;}
    if(Math.min(distanceToSegment(a,wall),distanceToSegment(b,wall),distanceToSegment(wall.a,route),distanceToSegment(wall.b,route))<r-1e-7)return false;
   }
  }else{
  const floors=g.WORLD_FLOORS.filter(f=>f.x<=Math.max(a.x,b.x)+r&&f.x+f.width>=Math.min(a.x,b.x)-r&&f.y<=Math.max(a.y,b.y)+r&&f.y+f.height>=Math.min(a.y,b.y)-r);
  for(const [ox,oy] of [[0,0],[r,0],[-r,0],[0,r],[0,-r],[d,d],[-d,d],[d,-d],[-d,-d]]){const ranges=floors.map(f=>interval({x:a.x+ox,y:a.y+oy},f)).filter(Boolean).sort((a,b)=>a[0]-b[0]);let covered=0;for(const [low,high] of ranges){if(low>covered+1e-12)break;covered=Math.max(covered,high);}if(covered<1-1e-9)return false;}
  }
  for(const rect of [...g.WORLD_OBSTACLES,...this.doors]){
   for(const box of [{x:rect.x-r,y:rect.y,width:rect.width+2*r,height:rect.height},{x:rect.x,y:rect.y-r,width:rect.width,height:rect.height+2*r}]){const span=interval(a,box,true);if(span&&span[0]<1-1e-9)return false;}
   const speed=x*x+y*y;if(!speed)continue;
   for(const cx of [rect.x,rect.x+rect.width])for(const cy of [rect.y,rect.y+rect.height]){const px=a.x-cx,py=a.y-cy,dot=px*x+py*y,disc=dot*dot-speed*(px*px+py*py-r*r);if(disc<=0||dot>=0)continue;const hit=(-dot-Math.sqrt(disc))/speed;if(hit>=-1e-9&&hit<1-1e-9)return false;}
  }
  return true;
 }
 permitted(p){
  if(!point(p))return false;if(this.reveal)return true;
  const v=this.vision,g=this.map?.geometry;if(!point(v?.origin)||!Number.isFinite(v.radius))return true;
  if(distance(v.origin,p)>v.radius+.00001)return false;
  if([...g.WORLD_OBSTACLES,...this.doors].some(r=>intersects(v.origin,p,r)))return false;
  const n=Math.max(1,Math.ceil(distance(v.origin,p)/4));for(let i=0;i<=n;i++)if(!g.WORLD_FLOORS.some(r=>(g.metadata?.revision===2?containsShape:inside)({x:v.origin.x+(p.x-v.origin.x)*i/n,y:v.origin.y+(p.y-v.origin.y)*i/n},r)))return false;return true;
 }
 update(game,at){
  if(!game||!Number.isFinite(at)||!Array.isArray(game.players)){this.clear();return;}
  let map;try{map=this.resolveMap(mapReference({game}));}catch{this.clear();return;}
  const doorIds=(game.systems?.doors??[]).filter(d=>d.closed===true).map(d=>d.id).sort();
  const transit=!!(game.systems?.selfTransit||game.self?.transit),key=JSON.stringify([game.matchId,mapIdentity(map),game.phase,game.self?.id,game.self?.alive,transit,game.vision?.mode,game.vision?.radius,game.vision?.lights,doorIds]);
  const owner=JSON.stringify([game.matchId,mapIdentity(map),game.self?.id]);
  if(this.owner===owner&&(at<this.receivedAt||Number.isFinite(game.version)&&game.version<this.version))return;
  if(this.context!==key){this.clear();this.context=key;}
  this.owner=owner;this.map=map;this.speed=Number.isFinite(game.settings?.speed)&&game.settings.speed>=90&&game.settings.speed<=300?game.settings.speed:map.geometry.WORLD.speed;this.doors=(map.fixtures?.doors??[]).filter(d=>doorIds.includes(d.id));this.reveal=game.phase==='ended';this.rawFixture=this.allowRawFixtures&&game.map===undefined&&game.mapId===undefined&&game.mapRevision===undefined&&game.beaconVersion===undefined&&!Number.isFinite(game.version)&&!Array.isArray(game.rooms);this.fixtureEase=this.rawFixture&&!game.phase&&!game.self;
  this.vision=game.vision?{...game.vision,origin:point(game.vision.origin)?copy(game.vision.origin):null}:null;
  this.selfId=game.self?.id??null;this.active=game.phase==='roam'&&game.self?.alive===true&&!transit;
  this.inputSeq=game.self?.inputSeq??0;this.receivedAt=at;this.version=Number.isFinite(game.version)?game.version:this.version;
  if(!this.active||this.intent&&(this.inputSeq>this.intent.seq||this.inputSeq===this.intent.seq&&!game.self.moving))this.intent=null;
  const seen=new Set();
  for(const p of game.players){
   if(typeof p.id!=='string'||p.alive!==true||game.beaconVersion===1&&p.status!=='alive'||!point(p.position)||(!this.rawFixture&&!this.walk(p.position))||!this.permitted(p.position)||p.id===this.selfId&&transit)continue;
   seen.add(p.id);const old=this.samples.get(p.id),prior=old?this.at(p.id,at):null,to=copy(p.position);
   const player={id:p.id,name:p.name,color:p.color,...(/^(?:[1-9]|1[0-5])$/.test(String(p.badge))?{badge:String(p.badge)}:{}),alive:true,status:p.status,roomId:p.roomId,position:copy(to),moving:p.id===this.selfId?!!game.self.moving:!!old&&distance(old.to,to)>.001};
   if(this.reveal&&['crew','saboteur'].includes(p.role))player.role=p.role;
   if(old&&distance(old.to,to)<.001){old.receivedAt=at;old.player=player;continue;}
   const history=old?.history??[];
   if(old&&history.length&&old.receivedAt>history.at(-1).at)history.push({at:old.receivedAt,position:copy(old.to),interpolate:true});
   const replace=history.length&&at<=history.at(-1).at,previous=history.at(replace?-2:-1)?.position;
   const entry={at,position:copy(to),interpolate:!previous||this.segment(previous,to)};
   if(replace)history[history.length-1]=entry;else history.push(entry);while(history.length>8)history.shift();
   const from=prior&&this.segment(prior,to)&&this.permitted(prior)?prior:to;
   this.samples.set(p.id,{history,from:copy(from),to,at,receivedAt:at,player});
   if(p.id===this.selfId&&this.intent&&(this.intent.dx||this.intent.dy)){this.intent.origin=copy(to);this.intent.at=at;}
  }
  for(const id of this.samples.keys())if(!seen.has(id))this.samples.delete(id);
  if(!this.samples.has(this.selfId))this.intent=null;
 }
 setIntent(input,at){
  if(!this.active||!Number.isFinite(at)||at<this.receivedAt||!input||Array.isArray(input)||Object.keys(input).some(k=>!['seq','dx','dy'].includes(k))||!Number.isSafeInteger(input.seq)||input.seq<=Math.max(this.inputSeq,this.intent?.seq??0)||![input.dx,input.dy].every(v=>Number.isInteger(v)&&v>=-1&&v<=1))return false;
  const origin=this.at(this.selfId,at);if(!origin)return false;
  this.intent={...input,origin:copy(origin),at,expires:at+Math.min(600,this.map.geometry.WORLD.inputLeaseMs)};return true;
 }
 at(id,time,reduced=false){
  const s=this.samples.get(id);if(!s||!Number.isFinite(time))return null;
  if(reduced)return this.permitted(s.to)?copy(s.to):null;
  if(id===this.selfId&&this.intent&&this.active){
   const intent=this.intent;if(!intent.dx&&!intent.dy)return this.walk(intent.origin)?copy(intent.origin):copy(s.to);
   const ms=Math.max(0,Math.min(time,intent.expires,this.receivedAt+this.predictMs)-intent.at),norm=Math.hypot(intent.dx,intent.dy),amount=ms*this.speed/1000,n=Math.max(1,Math.ceil(amount/2));let p=copy(intent.origin);
   for(let i=0;i<n;i++){const next={x:p.x+intent.dx/norm*amount/n,y:p.y+intent.dy/norm*amount/n};if(this.segment(p,next)){p=next;continue;}const x={x:next.x,y:p.y};if(this.segment(p,x))p=x;const y={x:p.x,y:next.y};if(this.segment(p,y))p=y;}
   // Self prediction is bounded to known walkable geometry. It does not reveal
   // another actor or extend their visible lifetime.
   return this.walk(p)?p:copy(s.to);
  }
  if(this.timelineDelayMs!==null&&!this.fixtureEase){
   const history=s.history,timeAt=time-this.timelineDelayMs;
   if(!history?.length||timeAt>=history.at(-1).at)return this.permitted(s.to)?copy(s.to):null;
   if(timeAt<=history[0].at)return this.permitted(history[0].position)?copy(history[0].position):copy(s.to);
   for(let i=1;i<history.length;i++){const from=history[i-1],to=history[i];if(timeAt>to.at)continue;
    if(!to.interpolate)return this.permitted(from.position)?copy(from.position):copy(s.to);
    const t=clamp((timeAt-from.at)/(to.at-from.at),0,1),p={x:from.position.x+(to.position.x-from.position.x)*t,y:from.position.y+(to.position.y-from.position.y)*t};
    return this.segment(from.position,p)&&this.permitted(p)?p:copy(to.position);
   }
  }
  const duration=this.fixtureEase?140:this.interpolateMs,t=duration?clamp((time-s.at)/duration,0,1):1,p={x:s.from.x+(s.to.x-s.from.x)*t,y:s.from.y+(s.to.y-s.from.y)*t};
  return this.segment(s.from,p)&&this.permitted(p)?p:this.permitted(s.to)?copy(s.to):null;
 }
}
