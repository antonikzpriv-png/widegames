/** Original Lantern Wake geometry shared by drawing, navigation and authority. */
import {CHARACTERS} from './contracts.mjs';

export const WORLD=Object.freeze({version:1,width:1600,height:1200,speed:180,bodyRadius:14,visibilityRadius:360,interactionRadius:92,killRadius:70,reportRadius:130,inputLeaseMs:600,grid:28});
const rect=(id,x,y,width,height,center)=>Object.freeze({id,x,y,width,height,...(center?{center:Object.freeze(center)}:{})});
export const WORLD_ROOMS=Object.freeze([
 rect('bridge',600,90,400,280,{x:800,y:285}),
 rect('archive',80,380,360,260,{x:260,y:510}),
 rect('lantern',1160,380,360,260,{x:1340,y:510}),
 rect('workshop',600,600,400,260,{x:800,y:730}),
 rect('galley',80,840,360,240,{x:260,y:960}),
 rect('engine',1160,840,360,240,{x:1340,y:960})
]);
export const WORLD_FLOORS=Object.freeze([...WORLD_ROOMS,
 rect('spine',750,350,100,270),rect('west-upper',420,450,350,80),rect('east-upper',830,450,350,80),
 rect('west-lower',220,620,80,240),rect('east-lower',1300,620,80,240),
 rect('lower-spine',750,840,100,160),rect('west-bottom',420,920,350,80),rect('east-bottom',830,920,350,80)
]);
export const WORLD_OBSTACLES=Object.freeze([
 rect('chart-table',740,170,120,60),rect('turbine',1220,990,100,50)
]);
export const WORLD_STATIONS=Object.freeze(Object.fromEntries(WORLD_ROOMS.map(room=>[room.id,Object.freeze({x:room.x+room.width-70,y:room.y+room.height/2,id:`station-${room.id}`} )])));
export const WORLD_BELL=Object.freeze({x:800,y:205});
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;
const floor=p=>point(p)&&WORLD_FLOORS.some(r=>inside(p,r));
export function distance(a,b){return point(a)&&point(b)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;}
export function worldRoomAt(position){return WORLD_ROOMS.find(room=>point(position)&&inside(position,room))?.id??null;}
export function worldSpawn(playerId){
 const index=Math.max(0,CHARACTERS.findIndex(p=>p.id===playerId));
 return {x:728+(index%3)*72,y:272+Math.floor(index/3)*55};
}
export function isWalkable(position,radius=WORLD.bodyRadius){
 if(!point(position)||!Number.isFinite(radius)||radius<0||radius>100)return false;
 const diagonal=radius/Math.SQRT2;
 for(const [x,y] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius],[diagonal,diagonal],[-diagonal,diagonal],[diagonal,-diagonal],[-diagonal,-diagonal]]){
  if(!floor({x:position.x+x,y:position.y+y}))return false;
 }
 return !WORLD_OBSTACLES.some(r=>{
  const x=Math.max(r.x,Math.min(position.x,r.x+r.width)),y=Math.max(r.y,Math.min(position.y,r.y+r.height));
  return Math.hypot(position.x-x,position.y-y)<radius||(radius===0&&inside(position,r));
 });
}
function clearSegment(from,to,radius=WORLD.bodyRadius){
 if(!point(from)||!point(to))return false;
 const length=distance(from,to),steps=Math.max(1,Math.ceil(length/7));
 for(let i=0;i<=steps;i++)if(!isWalkable({x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps},radius))return false;
 return true;
}
export function canSeeWorldPoint(from,to){
 if(distance(from,to)>WORLD.visibilityRadius||!floor(from)||!floor(to))return false;
 const steps=Math.max(1,Math.ceil(distance(from,to)/7));
 for(let i=0;i<=steps;i++)if(!floor({x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps}))return false;
 return true;
}
export function moveWorldPoint(position,dx,dy,amount){
 if(!isWalkable(position)||![dx,dy,amount].every(Number.isFinite)||amount<0)return {...position};
 const magnitude=Math.hypot(dx,dy);if(!magnitude)return {...position};
 const scale=Math.max(1,magnitude),length=Math.min(amount,WORLD.width+WORLD.height),steps=Math.max(1,Math.ceil(length/6));
 const x=dx/scale*length/steps,y=dy/scale*length/steps;let current={...position};
 for(let i=0;i<steps;i++){
  const next={x:current.x+x,y:current.y+y};
  if(isWalkable(next)){current=next;continue;}
  const horizontal={x:current.x+x,y:current.y};if(isWalkable(horizontal))current=horizontal;
  const vertical={x:current.x,y:current.y+y};if(isWalkable(vertical))current=vertical;
 }
 return current;
}
/** A bounded grid route. Waypoints exclude the input start and end at the target. */
export function findWorldPath(start,target){
 if(!isWalkable(start)||!isWalkable(target))return null;
 if(distance(start,target)<.01)return [];
 if(clearSegment(start,target))return [{x:target.x,y:target.y}];
 const size=WORLD.grid,columns=Math.ceil(WORLD.width/size),rows=Math.ceil(WORLD.height/size);
 const toPoint=id=>({x:(id%columns)*size,y:Math.floor(id/columns)*size});
 const nodeFor=p=>{
  const candidates=[];const cx=Math.round(p.x/size),cy=Math.round(p.y/size);
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const x=cx+dx,y=cy+dy;if(x<0||x>=columns||y<0||y>=rows)continue;
   const id=y*columns+x,q=toPoint(id);if(isWalkable(q)&&clearSegment(p,q))candidates.push({id,d:distance(p,q)});
  }
  candidates.sort((a,b)=>a.d-b.d||a.id-b.id);return candidates[0]?.id;
 };
 const first=nodeFor(start),last=nodeFor(target);if(first===undefined||last===undefined)return null;
 const queue=[first],parents=new Map([[first,null]]),safe=new Map();let head=0;
 const walkable=id=>{if(!safe.has(id))safe.set(id,isWalkable(toPoint(id)));return safe.get(id);};
 while(head<queue.length&&!parents.has(last)){
  const id=queue[head++],x=id%columns,y=Math.floor(id/columns);
  for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=columns||ny<0||ny>=rows)continue;
   const next=ny*columns+nx;if(parents.has(next)||!walkable(next)||!clearSegment(toPoint(id),toPoint(next)))continue;
   parents.set(next,id);queue.push(next);
  }
 }
 if(!parents.has(last))return null;
 const raw=[];for(let id=last;id!==null;id=parents.get(id))raw.push(toPoint(id));raw.reverse();raw.push({x:target.x,y:target.y});
 // Greedy visibility compression preserves collision checks at every shortcut.
 const route=[];let origin=start,index=0;
 while(index<raw.length){let furthest=index;for(let next=index+1;next<raw.length;next++){if(clearSegment(origin,raw[next]))furthest=next;}
  if(distance(origin,raw[furthest])>.01)route.push(raw[furthest]);origin=raw[furthest];index=furthest+1;
 }
 return route;
}
