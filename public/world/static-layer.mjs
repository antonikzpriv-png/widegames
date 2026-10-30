import {intersects} from './camera.mjs';
/** Per-scene LRU. Logical-resolution tiles, never a full-world DPR2 bitmap. */
export function createStaticLayer({paint,makeCanvas,tileSize=256,maxTiles=32}={}){
 const entries=new Map();let identity=null,builds=0,hits=0,disposed=false;
 const release=entry=>{entry.canvas.width=entry.canvas.height=0;};
 function clear(){for(const entry of entries.values())release(entry);entries.clear();}
 return {draw(ctx,map,bounds){
  if(disposed)return;const key=map;if(identity!==key){clear();identity=key;}
  const world={x:-32,y:-32,width:map.geometry.WORLD.width+64,height:map.geometry.WORLD.height+64};if(!intersects(bounds,world))return;
  const x0=Math.floor(Math.max(world.x,bounds.x)/tileSize),x1=Math.floor(Math.min(world.x+world.width,bounds.x+bounds.width)/tileSize),y0=Math.floor(Math.max(world.y,bounds.y)/tileSize),y1=Math.floor(Math.min(world.y+world.height,bounds.y+bounds.height)/tileSize);
  if((x1-x0+1)*(y1-y0+1)>maxTiles){paint(ctx,map,bounds);return;}
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const id=x+':'+y;let entry=entries.get(id);
   if(entry){hits++;entries.delete(id);entries.set(id,entry);}else{
    const canvas=makeCanvas?.(tileSize,tileSize);const context=canvas?.getContext?.('2d');
    if(!context){paint(ctx,map,bounds);return;}
    canvas.width=canvas.height=tileSize;context.translate(-x*tileSize,-y*tileSize);paint(context,map,{x:x*tileSize,y:y*tileSize,width:tileSize,height:tileSize});entry={canvas};entries.set(id,entry);builds++;
    while(entries.size>maxTiles){const oldest=entries.keys().next().value;release(entries.get(oldest));entries.delete(oldest);}
   }
   ctx.drawImage(entry.canvas,x*tileSize,y*tileSize,tileSize,tileSize);
  }
 },clear,stats(){return {tiles:entries.size,bytes:entries.size*tileSize*tileSize*4,builds,hits,maxBytes:maxTiles*tileSize*tileSize*4};},dispose(){disposed=true;clear();identity=null;}};
}
