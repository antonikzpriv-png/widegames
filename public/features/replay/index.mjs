/** Reserved Group2 UI model. Always pass a permitted engine/room view. */
export function replayPanelModel(room){const g=room?.game;return {ended:g?.phase==='ended',canLoad:g?.phase==='ended'};}

