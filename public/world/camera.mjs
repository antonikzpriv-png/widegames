/** Time-based easing, bounded after a suspended tab. Does not predict actors. */
export function followCamera(current,target,elapsed,reduced=false){
 if(reduced)return {...target};
 const alpha=1-Math.exp(-Math.max(0,Math.min(100,elapsed))/100);
 return {x:current.x+(target.x-current.x)*alpha,y:current.y+(target.y-current.y)*alpha};
}
export const viewportBounds=(camera,width,height,zoom,padding=80)=>({x:camera.x-width/(2*zoom)-padding,y:camera.y-height/(2*zoom)-padding,width:width/zoom+padding*2,height:height/zoom+padding*2});
export const intersects=(a,b,padding=0)=>a.x-padding<b.x+b.width&&a.x+a.width+padding>b.x&&a.y-padding<b.y+b.height&&a.y+a.height+padding>b.y;

/** Snapshot-anchored easing: draws evaluate a curve and never integrate it.
 * Targets are authoritative observed origins, independent of actor prediction. */
export class ObservedCamera{
 constructor({responseMs=100,snapDistance=600}={}){this.responseMs=responseMs;this.snapDistance=snapDistance;this.clear();}
 clear(){this.anchor=null;this.target=null;this.time=null;}
 reset(point,at){this.anchor={...point};this.target={...point};this.time=at;}
 at(at,reduced=false){
  if(!this.target)return null;if(reduced)return {...this.target};
  const decay=Math.exp(-Math.max(0,at-this.time)/this.responseMs);
  return {x:this.target.x+(this.anchor.x-this.target.x)*decay,y:this.target.y+(this.anchor.y-this.target.y)*decay};
 }
 update(point,at){
  if(!this.target){this.reset(point,at);return;}if(at<this.time)return;
  const current=this.at(at);if(Math.hypot(point.x-current.x,point.y-current.y)>this.snapDistance){this.reset(point,at);return;}
  this.anchor=current;this.target={...point};this.time=at;
 }
}
