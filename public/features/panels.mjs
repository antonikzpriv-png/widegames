/** Trusted UI extensions receive only the same safe view used by the core UI. */
export function createPanelRegistry(host,{onError=()=>{}}={}){
 const entries=new Map();let owner=null,controller=new AbortController(),epoch=0,disposed=false;
 const invalidate=()=>{controller.abort();controller=new AbortController();epoch++;};
 const visibility=()=>{if(document.hidden)invalidate();};document.addEventListener('visibilitychange',visibility);
 return {register({id,node,update,dispose=()=>{}}){if(disposed||!/^[-a-z0-9]+$/.test(id)||entries.has(id)||!node||typeof update!=='function')throw new TypeError('Invalid panel registration');host.append(node);entries.set(id,{node,update,dispose});return ()=>{const p=entries.get(id);if(p){p.dispose();p.node.remove();entries.delete(id);}};},update(view,options={}){if(disposed)return;const next=view?.roomId+':'+(view?.game?.matchId??'lobby');if(next!==owner){invalidate();owner=next;}if(document.hidden)return;const generation=epoch,signal=controller.signal,isCurrent=()=>!disposed&&!signal.aborted&&generation===epoch;for(const panel of entries.values())try{Promise.resolve(panel.update(view,{...options,signal,isCurrent})).catch(e=>{if(isCurrent())onError(e);});}catch(e){if(isCurrent())onError(e);}},dispose(){if(disposed)return;disposed=true;invalidate();document.removeEventListener('visibilitychange',visibility);for(const p of entries.values()){p.dispose();p.node.remove();}entries.clear();}};
}

