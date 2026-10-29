export function element(tag,attrs={},...children){
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
  if(value==null||value===false)continue;
  if(key==='class')node.className=value;
  else if(key.startsWith('on')){node._uiHandlers??={};node._uiHandlers[key.slice(2)]=value;node.addEventListener(key.slice(2),value);}
  else if(key==='disabled'||key==='hidden')node[key]=Boolean(value);
  else node.setAttribute(key,String(value));
 }
 for(const child of children.flat(Infinity))if(child!=null)node.append(child instanceof Node?child:document.createTextNode(String(child)));
 return node;
}
export const button=(label,onClick,attrs={})=>element('button',{type:'button',onclick:onClick,...attrs},label);
export function phaseLabel(phase){return ({lobby:'At anchor',roam:'On watch',discussion:'Council · Discussion',voting:'Council · Vote',ended:'Watch ended',paused:'Watch paused'})[phase]||phase;}
export function secondsUntil(deadline,now){return Math.max(0,Math.ceil((deadline-now)/1000));}
export function clockText(seconds){return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}

/** Preserve interactive nodes across live snapshots rather than detaching them. */
export function syncChildren(parent,source){
 const key=node=>node.nodeType===1?(node.getAttribute('data-focus')||node.id||null):null;
 const compatible=(a,b)=>a&&a.nodeType===b.nodeType&&(a.nodeType!==1||(a.tagName===b.tagName&&key(a)===key(b)));
 const wanted=[...source.childNodes];
 for(let index=0;index<wanted.length;index++){
  const next=wanted[index];let current=parent.childNodes[index];
  if(!compatible(current,next)){
   const match=key(next)?[...parent.childNodes].slice(index).find(candidate=>compatible(candidate,next)):null;
   if(match){parent.insertBefore(match,current||null);current=match;}
   else{parent.insertBefore(next,current||null);continue;}
  }
  if(current.nodeType===3){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;continue;}
  if(current.nodeType!==1)continue;
  for(const attribute of [...current.attributes])if(!next.hasAttribute(attribute.name)&&!(current.tagName==='DETAILS'&&attribute.name==='open'))current.removeAttribute(attribute.name);
  for(const attribute of [...next.attributes])if(current.getAttribute(attribute.name)!==attribute.value)current.setAttribute(attribute.name,attribute.value);
  for(const [event,handler]of Object.entries(current._uiHandlers||{}))current.removeEventListener(event,handler);
  current._uiHandlers=next._uiHandlers||{};
  for(const [event,handler]of Object.entries(current._uiHandlers))current.addEventListener(event,handler);
  if(['INPUT','TEXTAREA','SELECT'].includes(current.tagName)&&!current._uiComposing&&current.value!==next.value)current.value=next.value;
  syncChildren(current,next);
 }
 while(parent.childNodes.length>wanted.length)parent.lastChild.remove();
}
