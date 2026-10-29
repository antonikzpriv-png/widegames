# Independent world AI review ? 2026-10-29

Bounded AI qualification passes: nine groups, including eight complete additional-seed matches under unmodified default rules. A separate active engine chronology regression fails. This receipt does not approve Core's own engine or imply complete integration/browser approval. No runtime files changed in this assignment.

## Exact sources and isolation

Assigned checkout: D:/Widegames-work/world-core-20261029, branch codex/lantern-world-core-20261029, starting HEAD2370c6b9965f672724f6fbb166a740a27f4bb3a0. Only tests/world-core-ai-review*.test.mjs and this document are edited.

| Component | Committed source |
| --- | --- |
| Reviewer AI | 3a40eaaa5b470d0c745e109fa7a5dd877ff72129 |
| Original AI milestone | 84a9973cef5367adeac68eb7395c3f6983710009 |
| Core engine | aa471eb209c2c58a8d95ad9fa855ff01ebae83a2 |
| Shared geometry and contracts | eb64cc8fc6f9a024c0fe6c84dabf384e897819fe |
| Integrated engine/AI inspection | c68396318ba2df0c9608f1e9fa624f5a0a593476 |
| Later replay consumer inspection | 7093c2f501aecd877ffa324d8d7c95d1387cc81a |

Actual diffs and source were read from the Reviewer and coordinator checkouts without edits. Reviewer84a9973..3a40eaa has no AI runtime diff. The three changed AI blobs remain index6c9171cb0384c5c0bb8da2548e5e0a1a4fc56595, demo77118cce2ddb3d0b6e579365a14c765d50b35bfe, world2e762375cdb4c80d4fb6f5c2d5fe3beb94f76498. Provider adapter379283d22ab7450647bf7bfa96e937961b742574 is unchanged. Geometry bloba2bc61a0320e6033feb8956e59884399d0a34d06. c683963 contains identical engine, geometry and AI blobs; subsequent manager7093c2f has no changes to those runtime paths versus c683963.

The executable composite is _artifacts/world-core-ai-pin inside this checkout, assembled only from these Git commits. Raw git show output is written with Node execFileSync buffers, preserving canonical blob bytes; the explicit pin test checks all eight imported source blobs. Windows git archive initially exported CRLF and failed the byte-identity check. That is retained setup evidence, not a product failure; recreating the snapshot from raw Git blobs made exact checks pass. No runtime content was patched in the snapshot. This explicit composite pin is not a claim that its old shared contracts represent every current coordinator contract. Core handles navigate explicitly in schema2 and filters it from schema1 hints.

Normal integrated tests import the current checkout, without skipping missing modules. WORLD_CORE_AI_REVIEW_ROOT explicitly selects an archived/composite source. WORLD_CORE_AI_REVIEW_EXACT_PIN=1 additionally requires these historical blobs; it is not an ordinary future-code freeze. The isolated owner checkout lacks coordinator-owned shared/world.mjs, so the explicit archived-root command is required here. No hidden state is attached to AI or model arguments; role inspection is solely fixture setup or the external test oracle.

## Source review and independent controls

AI worldCandidates uses only the actor's position/destination, public stations/bell/map, visible player positions and current visible body events. It emits at most one world candidate. Existing destination equality suppresses repeat routes. Urgent body and critical repair logic can interrupt less urgent travel; travel normally yields wait. Shared findWorldPath bounds its fixed map grid and returns tested public floor waypoints. Engine validates the chosen destination and independently finds the route. Steering leases and movement remain authoritative server state, independent of AI action IDs.

Controller decide computes candidates from the safe view and returns locally for all roam phases, before makeRequest, reservation or send. Only discussion/voting can enter the provider branch. The adapter strips all player coordinates and hidden/private player metadata from the council request, offers bounded action indices, rejects extra response fields, and can substitute public speech only. Engine applyAction remains the mutation/win authority. Coordinator c683963's scheduler constructs the snapshot with getPlayerView, passes public CHARACTERS, applies the eventual proposal with applyAction, and persists result.state even when denied. No model sets an outcome or bypasses the engine through that integration path. This is source inspection plus bounded execution, not adversarial verification of every live provider response.

New tests use actual engine APIs and actual geometry. Staged fixtures choose a deterministic seed with p6 saboteur, then use accepted navigation/tick/action sequences; they never teleport or edit hidden state. Targeted fixture cooldowns are legally shortened for setup and the roam deadline enlarged; the eight full matches use all engine rule defaults.

- Real crew route: immutable frozen safe view, physical partial progress, serialized state/context, recreated controller, same-ID action retry without route reset, same-time decision suppression after restoration, wait during travel, actual arrival and own station task completion.
- Critical repair: interrupt two existing routes, target actual Engine station, wait without resetting that route, arrive and contribute once each; no new repair after that actor's contribution. Public repair events expose neither actor nor coordinates.
- Body/report/council: real witnessed elimination; body coordinate and death time are taken from the safe local event. At180 units the AI cannot report and navigates toward it. After400ms actual movement it reports inside130, stops movement in discussion, preserves witness memory over state/context JSON restoration, says actual firsthand evidence and votes for the killer. A real deadline tallies that vote into an ejection win. A locally constructed council request contains no position/destination and does retain the actor's authorized witness.
- Hidden actors: crew are moved physically out of sight. Saboteur view has null remote positions; hidden metadata getters and an extraneous raw-state proxy throw if read. AI proposes legal scheduled sabotage without looking through them. Spectator has public physical positions, no roles, and no acting self.
- Live-configured roaming uses a dummy fixture credential with fetch mocked to throw and a reservation callback that would fail. Thirty real decisions produce exactly one route and29 walking waits: zero fetches, reservations or calls. No actual provider requests are made.
- Bell correction: usable WORLD_BELL=(800,250) is walkable, while actual chart-table point(800,205) is solid. The engine permits a witnessed crew emergency at the reachable bell after report/council and post-council cooldown. The initial independent fixture checked immediately at cooldown start; advancing two additional milliseconds corrected setup, preserving the actual legal-meeting assertion. Reviewer's old isWalkable(WORLD_BELL)===false assertion is properly replaced by an actual solid-table control; navigation legality was not weakened.
- Every full match checks frozen safe views and null unseen positions against an external oracle; other players never carry tasks/role/motion/input/destination before reveal. State/context are serialized during an active route after16s, controller recreated, and resumed movement compared with uninterrupted tick. Human p1 never receives an action or changes position in idle-human fixtures. Ended state remains unchanged under later tick; role reveal is available only after the real terminal result.

## Default-rules match receipts

Decision interval1800ms; simulation tick600ms; maximum horizon900000ms after start. These are bounded engine/controller simulations, not real transport scheduling or browser cadence. Seeds2/17/29/47 deliberately differ from Reviewer's1/7/11/19. No rejected proposal in any match; no paid/mock council call was needed. All matches restarted from JSON during active movement and had walking waits.

| Mode | Seed | Result | Outcome at, ms | Actions | Routes | Walking waits |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| all AI | 2 | crew/tasks | 82000 | 122 | 30 | 48 |
| all AI | 17 | crew/tasks | 22600 | 75 | 20 | 34 |
| all AI | 29 | crew/tasks | 20800 | 72 | 19 | 36 |
| all AI | 47 | crew/tasks | 19000 | 62 | 19 | 24 |
| idle human | 2 | saboteur/parity | 190000 | 136 | 33 | 43 |
| idle human | 17 | crew/tasks | 89200 | 130 | 31 | 52 |
| idle human | 29 | saboteur/parity | 193600 | 162 | 39 | 45 |
| idle human | 47 | crew/tasks | 159400 | 191 | 56 | 72 |

The slower seed2 all-AI and all idle-human cases exercise elimination, sabotage, repair, report, discussion and votes. Other all-AI seeds finish tasks before initial sabotage cooldown. These samples demonstrate genuine rule-based completions, not guaranteed duration, all possible seeds or entertainment quality.

## Separate open engine defect: exported motion replay runs backward

Reproduced against Coreaa471eb, geometryeb64cc8, also matching c683963/7093c2f engine blobs. It is an engine export-order issue, not an AI-policy failure. No runtime fix is made or self-approved here.

Minimal legal sequence: create world at0; p1 applyInput({seq:1,dx:-1,dy:0}) at0; p2 navigate to(818,272) at0; tick1000. p1 lease expires at600; p2's18-unit route arrives at100. world-runtime settle appends per player, producing motion r4 at600 followed by r5 at100. Complete an actual emergency/ejection win and getReplay returns that same reversed pair. Pre-end replay remains correctly blocked and the players' actual positions/times are correct.

The active positive tests/world-core-ai-review-chronology.test.mjs asserts exported events are chronological and **fails** on this pin (one failure, no skips). It includes explicit100/600 controls and a legal ejection rather than reading a fabricated ended state. The failure is not marked TODO or turned into a passing characterization. Suggested bounded correction: sort the cloned ended replay by time with stable equal-time order; preserve IDs/internal append sequencing and the pre-end guard. Coordinator should independently choose/verify the fix.

Read-only replay consumer evidence: manager7093c2f public/presentation.mjs replayEvents returns the input array unchanged; public/world/phases.mjs createResults uses that order for its complete log and Previous/Next controls. Thus advancing replay steps can move backward in recorded world time. No hidden attribution leak or incorrect winner was found from this defect.

## Commands and actual results

All commands run in D:/Widegames-work/world-core-20261029. No other checkout edits, full historical suite repeats, Chrome, paid requests, main operations, push or deployment.

~~~powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:WORLD_CORE_AI_REVIEW_ROOT=(Join-Path (Get-Location) '_artifacts/world-core-ai-pin')
$env:WORLD_CORE_AI_REVIEW_EXACT_PIN='1'
Remove-Item Env:WORLD_ENGINE_GEOMETRY_MODULE -ErrorAction SilentlyContinue
node --test tests/world-core-ai-review.test.mjs
node --test tests/world-core-ai-review-chronology.test.mjs
node --test --test-name-pattern='actual crew route' tests/world-core-ai-review.test.mjs
node --test --test-name-pattern='explicit source pin' tests/world-core-ai-review.test.mjs
node --check tests/world-core-ai-review.test.mjs
node --check tests/world-core-ai-review-chronology.test.mjs
git diff --check
~~~

Initial AI invocation:7 passed/2 failed, both setup assertions described above; evidence _artifacts/world-core-ai-initial.txt preserved. Corrected AI invocation:9 passed/0 failed/0 skipped,15.75s, _artifacts/world-core-ai-qualified.txt. Subsequently strengthened same-time restored-controller suppression: focused1/1 passes in _artifacts/world-core-ai-restart-throttle.txt. Final expanded eight-blob pin check is separately run. Chronology:0 passed/1 failed/0 skipped,0.22s, _artifacts/world-core-ai-chronology-defect.txt. Do not describe this combined receipt as all green.

Limits: synchronous propose/apply in match simulations; transport persistence/races, process restart, renderer/input/browser behavior and live provider responses are outside these executable controls. JSON restart equivalence is covered; filesystem durability is not. Shortened targeted fixture cooldowns are not production timings. Safe historical eyewitness positions are authorized private observations and intentionally remain available to that witness; remote unseen current actor positions are withheld. Prior closed integration findings are historical and not reopened by this receipt.
