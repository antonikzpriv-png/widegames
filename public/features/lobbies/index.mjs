/** Reserved Group2 UI model. Always pass a permitted engine/room view. */
export function lobbiesPanelModel(room){const g=room?.game;return {roster:room?.roster??g?.players??[],isHost:!!room?.isHost};}

