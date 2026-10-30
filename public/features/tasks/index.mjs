/** Reserved Group2 UI model. Always pass a permitted engine/room view. */
export function tasksPanelModel(room){const g=room?.game;return {tasks:g?.self?.tasks??[],total:g?.tasks??null};}

