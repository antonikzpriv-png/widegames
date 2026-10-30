/** Polygon floors used by the illustrated layouts. No current-map mutable state. */
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const epsilon=1e-7;
export function shapeOutline(shape){
 return shape.outline||[{x:shape.x,y:shape.y},{x:shape.x+shape.width,y:shape.y},{x:shape.x+shape.width,y:shape.y+shape.height},{x:shape.x,y:shape.y+shape.height}];
}
export function containsShape(point,shape){
 if(point.x<shape.x-epsilon||point.y<shape.y-epsilon||point.x>shape.x+shape.width+epsilon||point.y>shape.y+shape.height+epsilon)return false;
 if(!shape.outline)return true;
 let inside=false;
 const vertices=shape.outline;
 for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
  const a=vertices[j],b=vertices[i],ab=minus(b,a),ap=minus(point,a);
  if(Math.abs(cross(ab,ap))<epsilon&&point.x>=Math.min(a.x,b.x)-epsilon&&point.x<=Math.max(a.x,b.x)+epsilon&&point.y>=Math.min(a.y,b.y)-epsilon&&point.y<=Math.max(a.y,b.y)+epsilon)return true;
  if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
function intersections(a,b,c,d){
 const r=minus(b,a),s=minus(d,c),q=minus(c,a),denominator=cross(r,s);
 if(Math.abs(denominator)>epsilon){const t=cross(q,s)/denominator,u=cross(q,r)/denominator;return t>=-epsilon&&t<=1+epsilon&&u>=-epsilon&&u<=1+epsilon?[Math.max(0,Math.min(1,t))]:[];}
 if(Math.abs(cross(q,r))>epsilon)return [];
 const length=r.x*r.x+r.y*r.y;if(!length)return [];
 return [c,d].map(p=>((p.x-a.x)*r.x+(p.y-a.y)*r.y)/length).filter(t=>t>=0&&t<=1);
}
/** Split overlapping floor edges and keep only exposed union boundaries. */
export function floorBoundary(floors){
 const edges=floors.flatMap(shape=>{const vertices=shapeOutline(shape);return vertices.map((a,i)=>({a,b:vertices[(i+1)%vertices.length]}));});
 const inside=p=>floors.some(shape=>containsShape(p,shape)),walls=[],seen=new Set();
 for(const {a,b}of edges){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
  const cuts=[0,1,...edges.flatMap(other=>intersections(a,b,other.a,other.b))].sort((x,y)=>x-y).filter((v,i,all)=>!i||v-all[i-1]>epsilon);
  for(let i=1;i<cuts.length;i++){
   const lo=cuts[i-1],hi=cuts[i],mid=(lo+hi)/2,x=a.x+dx*mid,y=a.y+dy*mid,nx=-dy/length*.01,ny=dx/length*.01;
   if(inside({x:x+nx,y:y+ny})===inside({x:x-nx,y:y-ny}))continue;
   const start={x:a.x+dx*lo,y:a.y+dy*lo},end={x:a.x+dx*hi,y:a.y+dy*hi};
   const coordinates=[start,end].map(p=>`${p.x.toFixed(5)},${p.y.toFixed(5)}`).sort().join(':');if(seen.has(coordinates))continue;seen.add(coordinates);
   walls.push(Object.freeze({a:Object.freeze(start),b:Object.freeze(end)}));
  }
 }
 return Object.freeze(walls);
}
export function distanceToSegment(point,{a,b}){
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length)):0;
 return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
}
