# World AI implementation and separate review

## Navigation milestone

Base: `d5eed65eb4737ceccab594c6dad911ff9033d2ba`, branch `codex/lantern-world-reviewer-20261029`. This is an explicit AI implementation assignment. AI checks below are author self-checks; they do not independently approve my AI. Other owners' committed engine/transport/frontend source will be reviewed separately after it exists.

Schema1 room bots retain their existing policy. A safe view with `worldVersion:1` selects a local world policy. It uses the actor's own position/moving/destination, public map/stations/bell and currently visible player/body positions. It never receives engine state. Task/repair/report/eliminate/meeting proposals check world proximity as well as engine action hints. Navigation remains a server-validated `navigate {x,y}` proposal; the server owns movement, collision and time. Stable path lengths from public geometry choose work, and station patrols have character offsets. The bell's table is solid, so its approach point must be reachable within interaction range.

Normal travel produces wait proposals until arrival; no per-frame provider work or repeated normal route reset. A current visible body or an urgent repair can interrupt a route; a saboteur may chase a currently visible target. No last-known hidden actor coordinate is stored or pursued. A local repair contribution marker persists in the private actor memory, keyed by that sabotage's deadline; a new critical event is eligible again. All proposals still pass engine validation. Existing persona speech, firsthand/heuristic distinction, match/actor isolation, cancellations, reservations, council adapter and conservative budgets retain their semantics. Demo stays labeled; live stays explicitly hybrid: local navigation, model council. No budget was raised.

### Initial offline fixture receipt

Shared geometry source: committed `6f6f7c0` (full hash in follow-up receipt). Shared geometry has not been imported into this worktree; only ignored `_artifacts/world-ai-shared-overlay` contains copies of current owned AI plus `git show 6f6f7c0:shared/{contracts,world}.mjs`. No other owner's source was changed. This overlay is explicitly a contract fixture, not Core engine qualification. The test defaults to current checkout source; `WORLD_AI_SOURCE_ROOT` only supplies an explicit qualification overlay. Missing integration fails rather than skips.

```
$env:TEMP='D:/Widegames-work/temp'
$env:TMP=$env:TEMP
$env:npm_config_cache='D:/Widegames-work/npm-cache'
$env:WORLD_AI_SOURCE_ROOT=(Join-Path (Get-Location) '_artifacts/world-ai-shared-overlay')
node --test tests/world-ai-policy.test.mjs
```

Result: **14 passed, zero failed/skipped**. Controls cover deterministic safe-point selection, real shared path geometry, same-room out-of-range work, arrival/cooldown waiting, visible body approach/report, hidden/malformed/occluded body positions, repair interruption/contribution restart, visible pursuit/kill range, hidden metadata getters, ignored forged state argument, reachable bell approach, invalid own position, abort, zero LIVE roam fetch/reservations, mocked council fetch after reservation, exhausted restored budget, distinct persona/witness memories and schema1 task/BFS compatibility. Provider response and safe views are labeled fixtures. No paid/live call, Chrome, deployment or hosted-CI claim.

Pending: exact committed Core engine full seeded all-AI and idle-human world runs, then independent source review of other owners' integrated changes. No invented winner or fixture mutation substitutes for actual engine outcomes.
