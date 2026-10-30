/** Trusted UI extensions receive safe views; update signals cancel obsolete async rendering. */
export function createPanelRegistry(host,{onError=()=>{}}={}){
 const entries=new Map();let controller=new AbortController(),epoch=0,disposed=false;
 const invalidate=()=>{controller.abort();controller=new AbortController();epoch++;};
 const visibility=()=>{if(document.hidden)invalidate();};document.addEventListener('visibilitychange',visibility);
 return {
  register({id,node,update,dispose=()=>{}}){
   if(disposed||!/^[-a-z0-9]+$/.test(id)||entries.has(id)||!node||typeof update!=='function')throw new TypeError('Invalid panel registration');
   const entry={node,update,dispose,abort:new AbortController()};host.append(node);entries.set(id,entry);
   return ()=>{if(entries.get(id)!==entry)return;entry.abort.abort();entry.dispose();entry.node.remove();entries.delete(id);};
  },
  update(view,options={}){
   if(disposed)return;invalidate();if(document.hidden)return;
   const generation=epoch;
   for(const [id,panel]of entries){
    const signal=AbortSignal.any([controller.signal,panel.abort.signal]);
    const isCurrent=()=>!disposed&&!signal.aborted&&generation===epoch&&entries.get(id)===panel;
    try{Promise.resolve(panel.update(view,{...options,signal,isCurrent})).catch(error=>{if(isCurrent())onError(error);});}catch(error){if(isCurrent())onError(error);}
   }
  },
  dispose(){if(disposed)return;disposed=true;invalidate();document.removeEventListener('visibilitychange',visibility);for(const p of entries.values()){p.abort.abort();p.dispose();p.node.remove();}entries.clear();}
 };
}
