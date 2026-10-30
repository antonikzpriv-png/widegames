/** Time-based easing, bounded after a suspended tab. Does not predict actors. */
export function followCamera(current,target,elapsed,reduced=false){
 if(reduced)return {...target};
 const alpha=1-Math.exp(-Math.max(0,Math.min(100,elapsed))/100);
 return {x:current.x+(target.x-current.x)*alpha,y:current.y+(target.y-current.y)*alpha};
}
export const viewportBounds=(camera,width,height,zoom,padding=80)=>({x:camera.x-width/(2*zoom)-padding,y:camera.y-height/(2*zoom)-padding,width:width/zoom+padding*2,height:height/zoom+padding*2});
export const intersects=(a,b,padding=0)=>a.x-padding<b.x+b.width&&a.x+a.width+padding>b.x&&a.y-padding<b.y+b.height&&a.y+a.height+padding>b.y;
