/** Audit available bodies even after navigation; only explicit obsolete CDP
 * body-read failures become recorded cancellations, never privacy successes. */
function unavailableBody(error){
 if(!['ProtocolError','TargetCloseError'].includes(error?.name))return false;
 return /^Protocol error \(Network\.getResponseBody\): (?:Target closed|Session closed|No resource with given identifier found)/.test(error.message)||error.name==='ProtocolError'&&/^Could not load response body for this request\./.test(error.message);
}
export function createPageBodyAudit(page,{isClosing=()=>false,onCanceled=()=>{}}={}){
 let generation=0,closing=false;const requests=new WeakMap();
 page.on('request',request=>requests.set(request,generation));
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())generation++;});
 return {
  markClosing(){closing=true;},
  async read(request,accept){
   const started=requests.get(request)??generation;let body;
   try{body=await request.response().json();}
   catch(error){
    if((closing||isClosing()||generation!==started)&&unavailableBody(error)){
     onCanceled({url:request.url(),generation:started,currentGeneration:generation,reason:closing||isClosing()?'consumer_closed':'navigation',error:String(error)});return false;
    }
    throw error;
   }
   // Assertions/parse failures must never be swallowed by the lifecycle fence.
   await accept(body);return true;
  }
 };
}
