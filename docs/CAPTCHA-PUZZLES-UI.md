# Original CAPTCHA-style equipment puzzles

These are local game puzzles, generated from the seated player's permitted task challenge. They do not contact a CAPTCHA provider, require a service key, or claim to stop automation. The server validates each semantic `taskStep`; clicking a client control never advances confirmed progress or grants completion.

| Equipment | Player interaction | Native controls |
| --- | --- | --- |
| Symbol survey (`glyphs`) | Mark every tile matching the named symbol, correct the selection, then send the complete set | Nine toggle buttons with symbol/name labels and `aria-pressed`, explicit Send tile selection |
| Signal inventory (`count`) | Count matching symbols in a nine-tile panel | Readable symbol/name tiles and number buttons 0–9 |
| Cargo manifest (`order`) | Select the smallest remaining cargo tag | Four generated number buttons; acknowledged tags remain marked and disabled |
| Direction alignment (`rotate`) | Turn an arrow to face north | Large direction arrow, readable heading, keep/left/right/half-turn buttons |
| Anomaly scan (`oddity`) | Select the only tile unlike the other eight | Nine labeled symbol/name buttons |
| Signal transcription (`code`) | Read and enter a six-character code | Unambiguous displayed characters, linked text-input label, Enter or Check code |

Symbols always have names, so color or vision alone is not needed to interpret the tile. Buttons keep ordinary keyboard and touch behavior. The code field preserves a rejected draft, accepts lower-case transcription by normalizing it to upper-case, and does not submit a composing Enter event. The dialog retains Escape, focus trapping, and server-confirmed focus restoration. Responsive grid/card styles are in `public/world/captcha.css`.

Pending requests disable controls, including controls replaced by a new snapshot while the request is still finishing. A callback retained from an older progress stage cannot submit against a newer stage. The old station puzzles and synthetic views without progress retain their original presentation.

`tests/captcha-puzzle-ui.test.mjs` uses a controlled DOM fixture and the real generated challenges to check all six semantic input paths, authoritative acknowledgment/completion, pending guards, stale callbacks, selection correction, readable labels, code-draft/composition behavior, ordered-stage disablement, Escape, and focus trapping. It is a unit qualification; the separate browser driver exercises actual browser controls, HTTP validation, maps and screenshots.
