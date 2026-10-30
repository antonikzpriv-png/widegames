/** Engine states are bounded serializable records. Copy their plain data directly
 * so movement ticks do not pay structuredClone's generic object cost for every
 * historical event. Never share mutable history with the caller. Exotic inputs
 * retain structuredClone semantics through the fallback.
 */
const generic=Symbol('generic copy');
export function copyState(state){
 const seen=new WeakMap();
 function copy(value){
  if(value===null)return value;
  if(typeof value==='function'||typeof value==='symbol')throw generic;
  if(typeof value!=='object')return value;
  if(seen.has(value))return seen.get(value);
  const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
  if(prototype!==(array?Array.prototype:Object.prototype)&&prototype!==null)throw generic;
  const result=array?new Array(value.length):{};seen.set(value,result);
  for(const key of Object.keys(value)){
   const item=copy(value[key]);
   if(key==='__proto__')Object.defineProperty(result,key,{value:item,enumerable:true,writable:true,configurable:true});
   else result[key]=item;
  }
  return result;
 }
 try{return copy(state);}catch(error){if(error!==generic)throw error;return structuredClone(state);}
}
