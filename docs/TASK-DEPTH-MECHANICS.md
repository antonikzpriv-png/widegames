# Tactical integration note

Current main’s authored station challenges remain available. Configured tactical watches blend these stations with the modern catalogue described below; walking/illustrated watches use the modern catalogue. Equipment-only excludes native glyph inspection as well as modern CAPTCHA tasks, mixed mode includes all supported equipment and CAPTCHA, and CAPTCHA-only uses the 13 modern families. Historical matches retain their recorded assignment protocol and progress.

# Detailed task mechanics

New configurable world matches use task edition 3, with 25 task families: 12 equipment panels and 13 readable CAPTCHA-style game puzzles. The host can choose `equipment`, `mixed` or `captcha` through the task mix setting. This is game content, not an external CAPTCHA provider or an authentication/security mechanism. Challenges are generated deterministically from server-created task IDs, so a reconnect shows the same equipment and confirmed progress. Different task identities provide different wire permutations, targets, codes, patterns, gauge values and classifications.

The interaction vocabulary draws on familiar social-deduction tasks: matching wires, increasingly long memory rounds, plotting a course, centering steering, priming red shield cells, diverting power and traveling to a distinct station to accept it, timed data transfer, inspecting incubated samples and clearing debris. Artwork, labels and challenge parameters are original Lantern Wake content. [Research and source-access notes](TASK-REFERENCE-RESEARCH.md) distinguish retrievable evidence from prior knowledge; the Cloud proxy denied the requested Among Us wiki pages at the time of this implementation.

| Family | Actual semantic interaction | Confirmed steps |
| --- | --- | --- |
| Wiring | Match four symbol-labeled cables to shuffled right sockets. Symbols and numbers supplement color. | 4 |
| Radio tuning | Adjust the frequency slider and lock the generated carrier value. | 1 |
| Memory record | Watch/replay a signal, then repeat prefixes of one, two, three and four symbols. Each complete round is one server step. | 4 |
| Reservoir pressure | Set the correct flow direction, then transfer the amount required to equalize both gauges. | 2 |
| Fuse repair | Isolate power, replace fuse, start diagnostic, then verify after the server wait. | 4 |
| Signal glyphs | Select every tile matching the requested symbol; submit the complete selection. | 3 rounds |
| Signal count | Count a specified symbol among distractors, then choose the counted number. | 2 rounds |
| Cargo order | Select four shuffled numbered tags in ascending order. | 4 |
| Direction signal | Apply the turn needed to orient an arrow north. | 3 rounds |
| Anomaly | Find the unique symbol among eight identical distractors. | 2 rounds |
| Authentication code | Read and enter a generated six-character code without ambiguous look-alike characters. | 1 |
| Course plotting | Connect four numbered/identified waypoints on a navigation chart in order. | 4 |
| Steering | Center the horizontal and vertical instrument axes on their generated target values. | 2 |
| Shield grid | Identify and activate the red cells of each defense circuit. | 2 rounds |
| Power routing | Raise the requested circuit channel to full power; the server routes the job to a distinct station on the current map. Travel there to accept the supply. | 2 at different stations |
| Data transfer | Connect the link, wait for the actual transfer deadline, then verify the recorded checksum. | 3 |
| Culture samples | Start incubation, wait for the actual incubation deadline, then identify the anomalous vial. | 3 |
| Intake filter | Extract each labeled debris object from the intake. | 3 |
| Matching pair | Find the only duplicated token pair among otherwise different symbols. | 2 rounds |
| Cargo arithmetic | Solve bounded generated addition/subtraction checks from four candidate values. | 2 rounds |
| Gauge comparison | Select the instrument with the greatest numeric reading. | 2 rounds |
| Pattern completion | Identify the missing symbol in a repeating three-symbol cycle. | 3 rounds |
| Waveform match | Compare three traces with a reference and choose the identical waveform. | 2 rounds |
| Material sorting | Place a named recovered object into its correct metal, glass, organic or polymer bin. | 3 |
| Checkpoint path | Follow adjacent navigation grid checkpoints from the marked start to the endpoint. | 4 |

## Authority, timing and lifecycle

The engine accepts the existing bounded `taskStep {taskId,step,input}` action. An expected step and a correct semantic input are both required. Wrong inputs never advance confirmed progress. Duplicate action IDs retain their original result; changed retries conflict through the existing action receipt protocol. The last semantic step does not itself complete the task: the existing final `task` action still checks ownership, proximity, phase and cooldown before updating aggregate completion or victory.

The server waits 1,500 ms for repair diagnostics, 2,500 ms for a data transfer and 3,000 ms for sample incubation. These intentionally compressed Lantern Wake timings keep the demo responsive; they do not claim to reproduce Among Us task durations exactly. A client animation or elapsed browser clock cannot satisfy these timers. `taskWaitUntil(task)` supplies the same wait hint to local AI; the engine independently authorizes every step against server time. Local and strategic bots submit the same semantic task inputs as humans, with no paid-provider dependency.

Movement or a meeting interrupts a running repair diagnostic, retaining its isolation/fuse steps but requiring diagnostic restart. A running data transfer restarts from connection after interruption. Sample incubation intentionally continues while the player leaves to do other work; returning after its deadline still requires the incubation and anomaly-confirmation actions at the owning station. Terminal phases reject task inputs. Classic death transfers the same task IDs/edition/progress to living crew; the optional ghost-task policy retains them with the fallen owner. Neither policy invents or discards completed work.

Power diversion changes the existing task's destination while retaining its ID, kind, edition and confirmed stage. The destination is deterministically selected by the server from other stations on that map; no client may choose it. Acceptance at the original station is rejected. The destination and updated label survive a disk restart, and a private `task_routed` replay event reconstructs that change without moving the actor or exposing another keeper's task.

Only the task owner's permitted `self.tasks` contains challenge parameters and confirmed task progress. Other players and spectators receive aggregate task counts. Server progress, input receipts and bounded private postgame replay data survive persistence and rematches retain the existing generation fences.

## Compatibility

Historical station-derived challenges remain version 1 with their exact original fields and targets. Historical explicitly typed challenges remain version 2, including three-wire tasks. No saved task is silently rewritten into edition 3. Newly generated configurable world tasks store `{kind,edition:3}` and derive progress with `v:3`; its exact progress keys remain `{v,kind,target,sequence,pressure,total,index,readyAt}`. Strict validation checks canonical generated parameters, family totals, index/completion consistency and timer bounds on save/reload. Unknown editions or a v3-only kind without edition 3 are rejected.

The original exported `TASK_KINDS` list remains the 11 version-1/version-2 families for compatible callers. `ALL_TASK_KINDS` and shared `TASK_ORDER` list all 25 current families. `TASK_CATALOG`/`TASK_LENGTHS` carry the display metadata and version-3 totals. The descriptive `durationClass` marks short interactions or longer staged workflows; no shared/common task-assignment taxonomy is implied. Programmatic matches without configurable settings retain historical behavior. The internal test option `taskEdition:1` can pin old fixture semantics; it is not accepted from an arbitrary client action.

Implementation coverage lives in `tests/task-depth-engine.test.mjs` and `tests/task-depth-power-routing.test.mjs` (real travel between stations and save/reload on all three maps); independent authority, persistence, timing and actual browser interaction coverage is reported separately by the integrated qualification.
