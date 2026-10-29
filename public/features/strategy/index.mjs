/** Reserved Group2 UI model. Always pass a permitted engine/room view. */
export function strategyPanelModel(room){const g=room?.game;return {self:g?.self?.id??null,navigation:g?.self?.destination??null};}

