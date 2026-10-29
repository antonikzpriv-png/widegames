export class ApiError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code;}}
export async function request(path,{method='GET',body,signal}={}){
 const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 let data;try{data=await response.json();}catch{throw new ApiError('The beacon returned an unreadable response.',response.status,'RESPONSE');}
 if(!response.ok)throw new ApiError(data.error?.message||'The request could not be completed.',response.status,data.error?.code);
 return data;
}
export function roomPath(id,suffix=''){return `/api/rooms/${encodeURIComponent(id)}${suffix}`;}
export function actionEnvelope(type,fields={}){return {...fields,type,id:crypto.randomUUID()};}
export function roomFrom(data){const room=data.room||data;if(!room||typeof room.roomId!=='string')throw new Error('The room response is incomplete.');return room;}
export function roomIdFromPath(path){return /^\/r\/([A-Za-z0-9_-]{1,100})\/?$/.exec(path)?.[1]||null;}
