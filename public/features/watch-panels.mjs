import {createPanelRegistry} from './panels.mjs';
import {tasksPanelModel} from './tasks/index.mjs';
import {strategyPanelModel} from './strategy/index.mjs';
import {lobbiesPanelModel} from './lobbies/index.mjs';
import {abilitiesPanelModel} from './abilities/index.mjs';
import {replayPanelModel} from './replay/index.mjs';
/** Baseline registered panel improves nonvisual access without another navigation window. */
export function createWatchPanels(host){
 const panels=createPanelRegistry(host),node=document.createElement('section');node.className='sr-only';node.setAttribute('aria-label','Watch summary');
 panels.register({id:'watch-summary',node,update(room,{isCurrent}){
  const tasks=tasksPanelModel(room),strategy=strategyPanelModel(room),lobby=lobbiesPanelModel(room),abilities=abilitiesPanelModel(room),replay=replayPanelModel(room);
  const text=`${lobby.roster.length} keepers. ${tasks.tasks.filter(t=>!t.completed).length} own tasks remaining. ${strategy.navigation?'Walking to selected destination.':'No selected walking route.'} ${abilities.notes.length} private field notes. ${replay.canLoad?'Ended replay available.':'Replay remains locked.'}`;
  if(isCurrent()&&node.textContent!==text)node.textContent=text;
 }});return panels;
}
