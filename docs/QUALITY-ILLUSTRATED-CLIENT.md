# Illustrated client integration

Assigned foundation537bccfd9fe0f8d40e1ae5ca19a5c858d8e433f4 on codex/ship-quality-illustrated-client-20261030. Read AGENTS, ILLUSTRATED-INTEGRATION-CONTRACT and actualaa1f58c..668a867 client diff. All previous branches/worktrees remain preserved.

Initial exact-source red evidence: _artifacts/illustrated-client/foundation-red.log records66 checks,33 pass/33 fail/0 skip before edits, including the retained motion/model, illustrated identity/inspector, sprite-cache and forced-colors parser failures. No assertions were changed to turn these red cases green.

First milestone uses namespace-aware mapKey/mapIdentity in ownership, scene/sample references and equipment lifecycle. Legacy references remain {mapId,revision}; exact tactical Beacon2 is never substituted for illustrated six-room Beacon2. The scene paints main interior-art only for native geometry.metadata.revision2, with bounds-aware painting through the existing tile/overview caches. The quality fourteen-room art remains in its previous branch. Native polygon walls, not bounding rectangles, govern revised motion/sightline checks.

ActorSamples now delegates all profiles to one MotionTrack and one at-most8-entry received history per visible actor. Production ActorSamples/default scene use a100ms received clock, holding missing corners rather than repeatedly easing toward each packet. Direct MotionTrack callers retain the original configurable90ms compatibility timing; the same physical segment/prediction implementation serves both. Only old metadata-free mathematical fixtures permit geometry-free coordinates; an explicitly forced real scene and actual versioned/map/room views remain strict. The bare Cartesian fixture's historical140ms profile also uses this same history/track. Bounded100ms self-direction prediction, integer sequences/leases, phase/door/transit/privacy clears and deterministic observed camera are retained. No second interpolation tracker is added.

motion-green.log:43/43 pass with0 skips across world-movement-performance, world-ui-model, illustrated-actor-samples, quality-movement-presentation and quality-client-walking. Original assertions, including all four incoming movement positives and the model endpoint, are unchanged. motion-first.log preserves one geometry-free fixture failure before the minimal compatibility classification was corrected. css-inspector-first.log:36/36 pass,0 skip across the two retained council/fallen files and spectator-revision2. Their media parsers now explicitly handle forced-colors with normal false default; no accessibility stylesheet was removed and no geometry/focus assertion was weakened.

Replay revision binding and the remaining cached human fog/task-glow case are being completed separately. No Chrome/native server/providers/full-suite/main/push/deployment or production qualification is claimed. Root shared/engine/storage/config files are untouched.

## Final bounded closure

Milestone `5a00a398ac40b6b44dcb9a36183b5791f1422585` is integrated by coordinator `fb7f4bffa43b759fac2fa595c57e1d566a5a0e40`. The final composition fixture is an unchanged archive of that coordinator commit plus this worktree's complete `public/world/**` and `public/game.css` overlay. Every overlaid file byte-matches the tested candidate; it contains the actual delivered engine/replay revision handling, not API response mocks. Root/shared/server files were not edited.

Replay v1 now binds metadata/event/caller revisions to the legacy namespace, supports revision2 with no mapId, rejects contradictory/future revisions and passes native revision to the actual effect validator. Replay v2 continues using exact mapped metadata and its validated actor roster. Snapshot map selection uses the illustrated alias, never tactical Beacon2; old snapshots retain their original selection shape. The viewer forwards mapRevision. Equipment, scene and received-history owner keys include mapIdentity, including revision-only transitions.

The last scene case now passes with one bounded cached terrain viewport plus cached task/critical glow and fog sprites. Native illustrated art still uses exact polygon outlines through bounded logical tiles; tactical fourteen-room art remains in its prior rendering branch. Per-scene limits: tiles8MiB, terrain viewport4MiB (at most1024x1024), effect sprites0.75MiB (at most three256x256). Shared overview has at most two viewport textures and8MiB total. These are logical RGBA allocation budgets; the visible canvas, browser/GPU copies and framework memory are not included. Suspend releases transient/overview textures; dispose also clears tiles. Actor samples use the same single Core track and at most8 received entries.

Focused results (overlapping controls, not an independent aggregate count):

| Evidence under `_artifacts/illustrated-client/` | Results |
| --- | --- |
| `motion-green.log` |43/43, incoming four movement positives and model endpoint unchanged |
| `css-inspector-final.log` |38/38, forced-colors normal/active/none explicit; accessibility CSS retained |
| `sprites-first.log` |6/6 unchanged incoming scene assertions, also included below |
| `render-vm-first.log` |33/33 retained scene/render/Reviewer VM assertions |
| `illustrated-lifecycle-green.log` |14/14 new namespace, polygon/collider, legal task/council/replay, cache and equipment ABA controls |
| `retained-replay-privacy.log` |52/52 replay, observer labels, private inspection and stale/current task rejection controls |
| `composed-replay-controls-green.log` |37/37 large-map/metadata2/ghost station/exact Ward controls |
| `equipment-controls.log` |44/44 original station, CAPTCHA and lifecycle controls |
| `native-geometry-composed.log` |8/8 unchanged native geometry/motion;376 directed station routes/5424 waypoints |
| `moving-command-trace.log` |5/5 movement/render comparison and one-track controls |

The three new in-process engine workflows legally navigate, submit taskStep, call council, vote and reach real crew victories before reading generated replay metadata. No staged positions or invented outcomes are used in those new workflows. Existing historical replay fixtures retain their original staged limits.

The retained cache fixtures now check the requested tile/sprite/viewport budgets instead of assuming every buffer is a256px tile. Their bounded-memory and draw-reduction positives remain; legacy VM imports now supply real interior-art dependencies. Legacy map fixtures explicitly obtain revision1 coordinates rather than latest registry selection; original expected outcomes/positions are unchanged. Forced-colors parser changes preserve every prior layout assertion and add both normal and active semantics. No runtime accessibility style was removed.

Historical evidence remains: foundation33 failures, first mathematical compatibility failure, a new lifecycle fixture expectation failure, old-foundation authoritative engine3 failures, and composed legacy-fixture2 failures. The lifecycle fixture reused identical feedback across a deliberate map reset; it now supplies distinct returned-map feedback before rejecting old work. The2 legacy engine fixtures used latest revision2 coordinates for revision1 matches; explicit revision1 fixes that fixture error. The actual revised-engine composition passes unchanged incoming native route tests. None of these earlier red logs is relabeled as passing.

`moving-command-trace.json` compares the same supplied12-actor/40-update fixture (first10 warmup) against baseline scene `88b9646f1f577c1e12b2f2a10172aa51d5f9e38e`, using current shared helpers. Warm command counts:320x74048270->16650;390x84448360->16650;844x39047670->12840. Observed JS dispatch times were37.55->22.53ms,34.08->17.07ms,19.91->17.23ms respectively across that complete fixture. These single-run dispatch measurements are not FPS/GPU/native performance or walking qualification.

Reproduction: run the listed test files with `node --test`; the composed files use `ILLUSTRATED_CLIENT_ROOT`, `LATEST_MAIN_CLIENT_ROOT`, `QUALITY_CLIENT_REPLAY2_ROOT`, or `QUALITY_CLIENT_WARD_ROOT` pointing at the archive+UI fixture as appropriate. The unchanged native geometry files were copied into that fixture's ignored `tests/` directory solely to resolve its actual shared/engine imports. No skipped assertion or alternative validator was introduced.

Exact source and evidence SHA-256 manifest: `_artifacts/illustrated-client/final-source-manifest.json` (`497d5f784fb1617178549fc903f761fb1db2b58901412b7b504f347333e94776`). Selected final raw source hashes:

- `public/world/movement.mjs`: `bdfc0b309e2bf2b45abd2c7fe8fa7ea1bc04aa47ff05a038c601bcac61a3c8f8`
- `public/world/model.mjs`: `3e5833ee0e6e060e88205767f7daef46151fcb445f668a233b16e0f59b907b20`
- `public/world/scene.mjs`: `d5d3e931f66c25262b2dd7db0ab8b2b87f458e5055b49245649ff69570d4d168`
- `public/world/experience.mjs`: `6ceed2c950ca17ca7096a0f767a7a08f7e58abef541f0ab8bc428fe2432f5f4c`
- `public/world/replay-model.mjs`: `da92cd94451ba1f6ba8021042c313b6b240ff32f7f7aed3f17e857f297c6f2b5`
- `public/world/replay-viewer.mjs`: `35a969ae5fd7df2e1b1c40ec45add4c4dce677e0e5408d8124f023bfe8a56af4`

No Chrome, browser/server child processes, HTTP qualification, providers, full suite, main merge, push or deployment was performed. Native desktop/mobile pixels, touch, physical phone/OS keyboard, audio hardware and final combined qualification remain coordinator-owned. This is implementation/source verification, not independent approval. All prior worktrees and failed evidence remain preserved.
