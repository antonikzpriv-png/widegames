# Expanded station puzzles

Expanded maps assign twelve tasks to each of the five crew keepers, for sixty required tasks. Every keeper receives all eleven puzzle types before the seeded distribution begins repeating types. The original beacon retains its original task count and station-derived five puzzle types. Map names, routes and station locations come from the selected match's own map data; no global geometry is switched between rooms.

The six additional station types are original CAPTCHA-style game puzzles. They run locally with native accessible controls and server-confirmed semantic inputs; they do not contact an external CAPTCHA service or require a credential.

| Puzzle | Player action | Confirmed steps |
| --- | --- | --- |
| Symbol grid (`glyphs`) | Select every tile matching a named symbol, then submit the selection | 3 generated grids |
| Signal count (`count`) | Count occurrences of the requested symbol in a nine-tile board | 2 generated boards |
| Dispatch order (`order`) | Select four numbered cards in ascending order | 4 cards |
| Antenna rotation (`rotate`) | Turn the shown antenna to north with an aligned/left/right/half-turn choice | 3 directions |
| Odd signal (`oddity`) | Select the one tile different from the other eight | 2 boards |
| Access code (`code`) | Type the displayed six-character code | 1 transcription |

Symbol boards always contain at least one requested symbol and one distractor. Odd-signal boards contain exactly eight matching symbols and one different symbol. Dispatch cards are distinct and retain the same values while each card is confirmed. Codes use uppercase letters and digits with ambiguous `0/O` and `1/I` omitted. The controls expose text labels alongside the symbols, so solving does not depend on color alone. Wrong answers preserve accepted progress and return the existing task protocol's bounded feedback.

## Versioned task compatibility

Original tasks without `task.kind` still use the exact original station-derived version-1 challenge. Their generated parameters, stored progress and diagnostic behavior do not change. Tasks on expanded maps explicitly declare one of the eleven supported `task.kind` values. Their challenge uses `v:2`, including when selecting an original puzzle type independently of station room ID. The version-2 progress object has the same exact keys as version 1:

```js
{v,kind,target,sequence,pressure,total,index,readyAt}
```

`target`, `sequence` and `pressure` remain bounded deterministic challenge parameters derived from the server-created task ID. A browser-safe pure helper, `captchaChallenge(progress)` in `shared/captcha.mjs`, derives presentation tiles, cards, orientation or code from those parameters. It returns display data rather than a privileged solved flag. The engine independently derives the required semantic input through `taskInput(task)`; demo bots use that same helper only with their permitted own-task view.

The existing `taskStep {id,type,taskId,step,input}` envelope remains unchanged: `step` is an integer from 0 to 4 and `input` is a string of at most 40 characters. A glyph answer is the ascending comma-separated selected tile indexes; count and order answers are decimal strings; rotation answers are `aligned`, `left`, `right` or `half`; odd-signal answers are zero-based tile indexes; code answers are the exact uppercase transcription. All new puzzles fit within four steps. The ordinary completion action still rejects until all required steps are confirmed. Duplicate actions remain inert and changed payloads under an existing request ID conflict.

Stored progress validation checks the task kind/version, exact field set, immutable generated parameters, bounded stage and timer rules. Unknown explicit kinds must be rejected even before a task has stored progress. The world server continues enforcing actor/faction ownership, ghost eligibility, distance, phase and cooldown; declaring a kind does not grant task authority. Original repair diagnostics retain their 1,500 ms wait and interruption rules. Captcha stages do not invent additional real-time timers.

## Engine qualification

`node --test tests/captcha-task-engine.test.mjs` verifies all six new kinds over forty deterministic task IDs each, including board invariants, display variation, answer derivation independent of the engine helper, wrong/stale input, immutable metadata, valid completed stages and schema rejection. Each new type also completes through the actual engine with direct-finish rejection, action idempotency/conflicts, JSON and store validation, defensive private views and a real final-task crew victory. The suite separately pins the original version-1 challenge formula and all five original kinds. Browser and map integration qualification is recorded with the expanded-map work.
