# Independent engine integration review

Reviewed exact coordinator commit `01c26bef48447c60bf1cfa7f145b75440afc5157` against parent `0babb0ed4c7767d55fa5339ea204ac187bd3e020`. Separately audited committed, integrated AI at `414e77fca2c79e239cf60630b134adfd6b062acd`.

The engine worktree remains based on `19aa06d0199c0ee3fb752248ab4bb43d1bd68a30`. No production source was modified or cherry-picked for this review. Exact Git archives were materialized only under `D:/Widegames-work/temp`; their only dependency link points at the already installed coordinator/node_modules. Neither the coordinator nor other worker source was edited. All HTTP tests use loopback and temporary data directories. No browser or paid/live provider was used.

## Findings for the manager

Historical exact-pin findings. The AI witness/persona corrections and subsequent privacy closure are qualified in [AI closure](ENGINE-AI-CLOSURE.md) and [final privacy review](ENGINE-FINAL-PRIVACY.md).

**Medium: direct eyewitness evidence can lose to accumulated inferred suspicion.** At AI revision 414e77f, `server/ai/demo.mjs:73` records a real witness event as suspicion score 3. Proximity inference at line 84 can independently reach the same score for an innocent keeper. `suspect()` at line 39 resolves equal scores by ascending player ID, with no distinction for eyewitness evidence. The actual killer can therefore lose the tie to an innocent keeper even though the actor directly saw the elimination.

The independent test `characterize witness counterexample: inferred suspicion ties direct evidence and chooses innocent` is a complete legal-action reproduction using only engine safe views for the AI observation policy:

1. Use the deterministic fixture with p6 saboteur, p2 observer, and p1 innocent. p6 moves from Bridge to Archive. Observe p2's safe view.
2. p3 moves to Archive and is eliminated at time 5. p2 stays on Bridge; its next safe view increments suspicion for prior nearby survivors, including innocent p1.
3. p4 follows and is eliminated at time 12. The next p2 observation increments p1's score again.
4. p6 returns to Bridge at time 13; p2 observes. p6 eliminates p5 at time 19, in front of p2 and p1. The safe view contains an actual `witness` event naming p6.
5. Observation sets p6 to score 3, while another proximity update raises p1 to score 3. p2 reports p5's body and the engine advances to voting.
6. The real demo candidates function proposes a vote for innocent p1, ahead of directly witnessed p6. Only two crew and the saboteur remain, so such an ejection can decide the match incorrectly from the witness's own evidence.

Recommended owner correction: retain explicit witnessed eliminators separately, prioritize living direct eyewitness targets before inferred scores, and preserve that distinction in dialogue and the live prompt. The current live prompt in `server/ai/anthropic.mjs:23` receives suspicion numbers and local observation snapshots, so it also loses the distinction between direct proof and an equally scored inference. This is an evidence-quality defect, not a hidden-state leak. The review test deliberately asserts the observed defect as a characterization; it is not an approval test claiming the behavior is correct. Replace that assertion with a p6 expectation when the owner fixes it.

**Low: demo dialogue does not implement the individual character personas.** All five crew in an initial Bridge discussion produce exactly the same first line when they have the same task count. Demo templates in `server/ai/demo.mjs:48` distinguish role, room, task count and discussion turn, but never use the character's persona. Canonical personas are present and distinct in all six live prompts; the separate no-network prompt control confirms this. If persona-distinct behavior is required in demo, the AI owner should supply character-specific phrasing. This limitation does not prevent games from finishing.

No additional correctness finding was identified in the targeted 01c26be engine/transport changes. No production fix was made by this reviewer.

## Exact 01c26be source review

- Engine request validation now accepts the same bounded colon namespace as rooms/transport. Existing browser UUIDs remain valid, and malformed/oversized IDs still reject.
- The retained-request lookup occurs before the 2,048-entry limit. Original accepted and denied requests therefore remain replayable as inert duplicates after saturation; changed contents conflict. Only genuinely new IDs receive REQUEST_LIMIT, with no eviction and no world mutation.
- HTTP denial handling compares returned engine version, commits changed state, broadcasts, and only then returns the safe error. This covers a denied action that also advances a missed deadline.
- AI scheduling selects the earliest due living actor among eligible AI seats instead of the first due character. Equal initial deadlines preserve character order; actors already served acquire later deadlines and cannot indefinitely crowd out p5/p6.
- AI application assigns the returned engine state on both acceptance and denial, then commits it together with private AI context.
- The coordinator's added tests and rules clarification match these changes. The exact requested snapshot predates later opaque-task-ID and untallied-pause-ballot hardening; those later changes are present in the separately audited AI integration snapshot.

## Independent controls and results

`tests/engine-integration-review.test.mjs` imports the exact archived engine and real transport. Only model decisions are stubbed; real room/authentication, HTTP routing, engine rules, disk store, close and restart execute.

| Control | Parent 0babb0e | Fixed 01c26be |
| --- | --- | --- |
| Colon AI ID acceptance, duplicate/conflict and JSON restoration | fails INVALID_ACTION | passes |
| First movement replay after 300 subsequent requests | fails: old ID loses idempotency | passes, stays on Bridge |
| Exact 2,048 cap, new-ID denial, old success/denial/conflict and other-actor isolation | fails: history retains only 256 | passes |
| HTTP colon identity compatibility | fails HTTP 409 | passes HTTP 200 |
| Denied action advances roam deadline, saves before HTTP error, survives restart | fails: disk still roam | passes: disk discussion plus retained denial |
| Scheduler with 500 ms logical decision duration and 1,800 ms interval | fails: first six include only p1-p4 | passes: every actor exactly three turns in first 18 |
| AI rule denial and private context saved together; context absent from safe HTTP view | fails: no retained denial | passes |

All seven controls failed on the parent as expected, and all seven passed on the fixed commit. The complete 2,048 boundary uses real actions rather than constructing a prefilled ledger. Identity-free IDs are deliberately used in cap, persistence and fairness controls so those failures cannot be explained by the separate colon bug.

`tests/engine-ai-review.test.mjs` ran five independent controls against 414e77f:

- Direct witnesses select the real killer when no competing inference has saturated; a remote observer receives no invented witness evidence.
- The legal-action eyewitness counterexample above is reproduced and characterized.
- All six live prompt system messages contain the correct canonical persona; player payloads contain no other role/private tasks/replay.
- The shared demo dialogue limitation above is reproduced and characterized.
- Twelve new seeded matches (seeds 101 through 112), with one serial actor every 100 ms and frozen safe views, finish through real engine outcomes. Every proposed action is accepted; movement, task, elimination, report, discussion, voting, sabotage and repair all occur. Demo views remain unchanged and a global fetch guard ensures no provider calls.

Result: five controls pass, including the two explicitly characterized shortcomings. Passing characterization tests must not be interpreted as resolving the findings.

## Reproduction and retained output

Set the environment before any Node tests:

```powershell
$env:TEMP='D:/Widegames-work/temp'
$env:TMP='D:/Widegames-work/temp'
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:ENGINE_REVIEW_ROOT='D:/Widegames-work/temp/engine-review-01c26be'
node --test tests/engine-integration-review.test.mjs
$env:ENGINE_REVIEW_ROOT='D:/Widegames-work/temp/engine-review-01c26be-parent'
node --test tests/engine-integration-review.test.mjs # expected nonzero negative control
Remove-Item Env:ENGINE_REVIEW_ROOT
$env:ENGINE_AI_REVIEW_ROOT='D:/Widegames-work/temp/engine-review-ai-414e77f'
node --test tests/engine-ai-review.test.mjs
Remove-Item Env:ENGINE_AI_REVIEW_ROOT
node --test tests/engine*.test.mjs
node scripts/check.mjs
```

The root variables can point at any separately materialized exact Git archive. Missing review variables skip the two optional review suites without importing or requiring other owners' source. The ordinary engine suite remains unchanged: 30 tests pass. Syntax checking passes for all 12 local modules. The original 19aa06d tests are preserved, including that historical branch's 256-entry expectation; coordinator already updated its production expectation separately.

Parent negative-control output is retained at `D:/Widegames-work/temp/engine-review-parent-results.txt`; positive output is at `D:/Widegames-work/temp/engine-review-fixed-results.txt`. The final fixed run passed 7/7 in 17.37 seconds. AI controls passed 5/5 in 2.71 seconds. A combined evidence command ended nonzero only after all checks passed because `rg` is unavailable on this host; `Select-String` successfully supplied the source line references instead. There were no unexplained rule or service failures.

Limits: reviewed revisions are pinned above; later commits require their own requalification. Live provider behavior, browser UX and deployment are outside this bounded review. Native HTTP coverage does not claim browser or WebSocket end-to-end coverage. The lifetime request cap deliberately exhausts an actor's ability to submit new IDs, while retaining prior IDs safely; this availability tradeoff is explicit and tested.
