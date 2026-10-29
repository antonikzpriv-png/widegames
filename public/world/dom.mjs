/** Focus handling is scoped to each visual scene, including modal keyboard loops. */
export function trapDialog(dialog,event){
 if(event.key!=='Tab')return;
 const nodes=[...dialog.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')].filter(node=>!node.disabled&&!node.hidden&&node.getAttribute('tabindex')!=='-1'&&node.getClientRects().length);
 if(!nodes.length){event.preventDefault();dialog.focus();return;}
 const first=nodes[0],last=nodes.at(-1),current=dialog.ownerDocument.activeElement;
 if(event.shiftKey&&(current===first||!dialog.contains(current))){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&(current===last||!dialog.contains(current))){event.preventDefault();first.focus();}
}
export function restoreTrigger(trigger){
 if(trigger?.isConnected&&!trigger.hidden&&!trigger.disabled&&trigger.getAttribute('aria-disabled')!=='true'&&trigger.getClientRects().length)trigger.focus();
}
export const dom=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
export function control(text,onClick,className='lw-secondary'){const node=dom('button',className,text);node.type='button';node.addEventListener('click',onClick);return node;}
export function setText(node,text){if(node.textContent!==text)node.textContent=text;}
