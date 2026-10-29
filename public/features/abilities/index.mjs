/** Reserved Group2 UI model. Always pass a permitted engine/room view. */
export function abilitiesPanelModel(room){const g=room?.game;return {notes:g?.abilities?.notes??[],actions:(g?.interactions??[]).filter(a=>a.type==='ability')};}

