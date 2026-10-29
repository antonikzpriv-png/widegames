export function element(tag,attrs={},...children){
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
  if(value==null||value===false)continue;
  if(key==='class')node.className=value;
  else if(key.startsWith('on'))node.addEventListener(key.slice(2),value);
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
