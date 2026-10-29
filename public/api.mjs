export class ApiError extends Error{
 constructor(message,status,code){super(message);this.status=status;this.code=code;}
}
export async function request(path,{method='GET',body,signal,keepalive=false,timeoutMs=15000}={}){
 const timeout=new AbortController();
 const deadline=setTimeout(()=>timeout.abort(new DOMException('The request timed out. Please retry.','TimeoutError')),Math.max(100,Math.min(15000,timeoutMs)));
 const combined=signal?AbortSignal.any([signal,timeout.signal]):timeout.signal;
 try{
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',keepalive,signal:combined,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  let data;
  try{data=await response.json();}
  catch{if(combined.aborted)throw combined.reason;throw new ApiError('The beacon returned an unreadable response.',response.ok?undefined:response.status,'RESPONSE');}
  if(!response.ok)throw new ApiError(typeof data?.error?.message==='string'?data.error.message:'The request could not be completed.',response.status,data?.error?.code);
  return data;
 }finally{clearTimeout(deadline);}
}
export function roomPath(id,suffix=''){return `/api/rooms/${encodeURIComponent(id)}${suffix}`;}
export function actionEnvelope(type,fields={}){return {...fields,type,id:crypto.randomUUID()};}
export function roomFrom(data){
 const room=data?.room||data;
 if(!room||typeof room.roomId!=='string')throw new Error('The room response is incomplete.');
 return room;
}
export function roomIdFromPath(path){return /^\/r\/([A-Za-z0-9_-]{1,100})\/?$/.exec(path)?.[1]||null;}
