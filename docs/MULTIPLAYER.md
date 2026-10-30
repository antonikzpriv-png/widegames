# Multiplayer lobbies and rematches

This contract extends the audited `90bb6e8` walking-world baseline and integrates main `fa7aaa0` (authoritative task puzzles, ghost tasks and optional abilities). Historical owner allocations, Windows workspace paths, fixed-six-only statements, and the original empty-remote status in older notes are historical. Development uses the current Cloud checkout and existing Node ESM/native HTTP/WebSocket stack. No deployment or paid provider call is needed.

## Playing together

Choose **PLAY AS A KEEPER** to host with a human seat, or **WATCH THE AI** to host as a spectator. Defaults remain six keepers, one saboteur, three tasks per crew, and the existing timings. Copy the room invitation or enter its 12-character code through **Join friends**. Joining a link initially creates a spectator identity; **Claim a keeper** claims an available seat. Unclaimed seats become AI at start. The same HttpOnly room cookie restores a human's seat on reload.

Each keeper has a stable actor ID (`p1`–`p15`), public persona, name and raincoat color. Names contain 1–24 visible normalized characters. Names may repeat; numbered badges remain distinct in lobby, world labels, elimination controls, council/chat, ability targets, results and attributed replays. Humans can edit their own name and color before starting. Hosts can remove other lobby occupants. During a match, **Manage crew** opens authenticated access-revocation controls; the seat remains reserved and idle. Everyone with a human seat must ready up; spectators never block start. The host's initial seat is ready by default. Profile edits unready that human; applying settings unreadies guests and readies the seated host.

Host controls are validated on the server. Capacity is 4–15, saboteurs 1–3, and saboteurs must be fewer than crew (`2 * saboteurs < capacity`): two saboteurs need at least five keepers; three need at least seven. Occupied seats cannot be removed by lowering capacity. Task quantity, movement speed, vision, initial and subsequent elimination cooldowns, task/sabotage/emergency cooldowns, critical countdown, discussion/voting time, emergency allowance, sabotage and emergency-bell options are configurable. The precise bounds/units are in `shared/lobby.mjs`; the UI shows seconds for millisecond fields. The host can also choose classic task transfer or ghost tasks with private fallen chat, and optional Harbor Ward / Signal Echo abilities. These presets apply to every supported capacity and survive rematches. There is one ward owner among crew and one echo owner among saboteurs; abilities do not change factions. Applying presets also resets guest readiness. Unsaved settings survive background room updates and are applied before starting; guests must ready again after any settings change.

Start locks the roster, human ownership and all gameplay settings. Settings live on that match, not on shared `WORLD`, geometry, module globals, or another room. Spawn points retain the original six positions and add nine walkable points at least two body radii apart. Static map geometry remains shared. Movement continues to use server time, collision checks, diagonal normalization and input leases.

## Ownership and privacy

All human inputs and actions derive their actor from the current authenticated identity inside the room mutation queue. A cookie cannot select another player by supplying an actor field. Seat claims, readiness, profiles, settings, member controls, start and rematch all use that same queue. Claims cannot oversubscribe or give one seat to multiple identities.

Sockets retain only an identity digest as a lookup key. Every projection looks up the current identity and seat again; reassignment changes that socket's projection, and revocation closes it. Host member revocation is also available during a match through the authenticated API. A revoked or disconnected active seat stays reserved and idle, never silently becoming AI. There is no active-match takeover policy. New visitors can only spectate after start; lobby claims and settings are rejected while active. A rematch permits new claims again.

Only a saboteur's private `self.teammates` lists fellow saboteur IDs. It includes no extra positions. Crew and spectator payloads do not contain this list; public player roles stay hidden until the end. The AI receives its actor's same safe view plus public persona only. Dynamic local policies and Anthropic snapshots support all 15 actors; only actors whose persisted `human` flag is false are scheduled. No strategic-planning feature is required.

Crew win when every saboteur is ejected or all crew tasks are complete. Saboteurs win at living parity or an expired critical countdown. Saboteurs cannot eliminate teammates. Ejecting only one of several saboteurs does not declare crew victory. Existing tie, skip, abstention, task-transfer and deadline rules continue to apply.

## Rematch lifecycle

After an ended or maximum-duration paused watch, the host can choose **Rematch with this crew**. The room ID, invitation, profiles, settings and non-revoked human seats remain. Guests must ready again. A fresh logical generation returns the group to the lobby. Starting creates a new opaque role assignment, match ID, version sequence, action receipts, input sequences and per-match AI context. The first match retains `state.id === room.id`; subsequent match IDs are `${room.id}_g${generation}`. Storage validates that relationship explicitly.

New envelopes carry `generation`; actions and input also carry `matchId`. Generation is checked when the queued mutation executes. Historical/first-generation envelopes without it remain compatible; after a rematch it is required. Old start IDs, action retries, input packets and frames cannot affect a new generation. The browser accepts a newer-generation lobby even after an active game and accepts the new match's lower version. It disposes world/input/puzzle/replay controllers and resets local drafts/retries. Older-generation frames and lower revisions are ignored.

Each AI decision captures its match ID, work token and abort controller. Rematch aborts the old controller, clears scheduling, and creates fresh work ownership. Reservation callbacks recheck the generation before committing context, before reserving deployment funds, and after the reservation completes. Late provider responses/proposals cannot commit into the new match, and a stale worker cannot clear or block a new worker. Aborted requests do not refund uncertain spending.

The deployment-day budget ledger is never reset by rematch. Completed-watch replay tails are retained privately with their revealed player roster: at most three watches, 2,000 events per watch, 1 MB of events per watch and 2 MB total archive JSON. Oldest watches/events are removed first to keep these bounds. The current match still retains up to 12,000 replay records. Archived replays require a current room identity and are accessible through **Completed watch replays** in the lobby. Paused watches have no completed replay. Archives, roles, identities, AI memory and budget files remain under private `DATA_DIR`; static serving cannot expose them.

## API additions

All POST routes require the configured Origin and JSON. Room routes require the room cookie except create/join; standard rate and body limits still apply. Authenticated seated humans share address-level counters at weight `1 / current non-revoked human seats`, so a group behind one network address can move normally. Individual movement remains capped at 600/minute, discrete writes at 60/minute; unauthenticated and spectator requests keep full address weight. A single human's existing overall 600/minute address ceiling is preserved. Responses are the current safe room envelope, with `generation`, monotonic room `revision`, public `settings`, `seats`, readiness, invitation code and archive metadata. No token hashes or AI memory are included.

| Route | JSON / behavior |
| --- | --- |
| `POST /api/invitations` | `{code}` resolves an invitation to a room ID; never supplies a seat identity. |
| `POST /api/rooms/:id/join` | `{}` remains spectator-only; `{intent:'play', name?}` claims in the lobby, spectates after start. An existing cookie retains its identity. |
| `POST .../seat` | `{seatId:'auto' | 'pN' | null, name?, generation}` claims/switches/releases one's lobby seat. |
| `POST .../profile` | `{name?, color?, generation}` edits one's own seated lobby profile. |
| `POST .../ready` | `{ready:boolean, generation}` changes one's own readiness. |
| `POST .../settings` | `{settings?:partialSettings, features?:{deathPolicy,abilities}, generation}` is host-only and lobby-only. |
| `POST .../members` | `{seatId, operation:'release' | 'revoke', generation}` is host-only; release is lobby-only. Hosts cannot remove themselves this way. |
| `POST .../start` | `{id, generation, features?}` is host-only; requires every human ready and retains start idempotency. |
| `POST .../rematch` | `{id, generation}` is host-only and terminal-only; repeats of the same transition remain idempotent. |
| `POST .../input` | `{seq,dx,dy,generation,matchId}` controls only the current authenticated human. |
| `POST .../action` | Existing action envelope plus `{generation,matchId}`; metadata is checked and stripped before engine validation. |
| `GET .../replay` | Current ended replay; `X-Match-ID` selects a retained completed watch. |

## Persistence compatibility

Room container schema 1 continues to load without rewriting, deletion, migration or quarantine of valid historical data. Both legacy engine schema 1 and world engine schema 2 retain their original behavior. New configurable rooms use room container schema 2; their engine retains schema 1/2 according to legacy/world mode and carries a validated settings snapshot. The programmatic server constructor without `worldMode:true` and the `createRoom` fixture helper retain legacy defaults. Explicit lobby controls or a rematch can transition a historical lobby/group to the new container deliberately.

New container validation checks settings and ratios, sequential unique actor IDs, public profiles, distinct identity digests/seat ownership, host/readiness/revocation, match/generation correspondence, human ownership, faction counts, tasks, receipts, bounded timelines and archives. Existing world motion, lease, body and walkability checks still run on save and restore, including `p10`–`p15` bodies. Existing exclusive writer locks, atomic private writes, and invalid-file handling remain intact.

## Development and verification

Use Node 24 LTS (minimum 22.13), then `npm ci`, `npm run check` and `npm test`. New tests cover 4/6/15 persistence, concurrent joins/start, per-human ownership, AI exclusion, HTTP/WS role privacy, re-resolved and revoked sockets, reconnects, multi-saboteur wins, private archived replays, stale work and budget continuity. The client tests execute the actual lifecycle functions with deferred responses and verify generation/reset behavior.

Run browser checks sequentially:

```sh
CHROME_PATH=/usr/bin/chromium npm run test:browser
CHROME_PATH=/workspace/.cloud-setup/bin/chromium-cloud LW_WORLD_BROWSER=1 node --test tests/world-ui-browser.test.mjs
CHROME_PATH=/usr/bin/chromium npm run test:multiplayer-browser
CHROME_PATH=/usr/bin/chromium npm run test:features:browser
```

Use the cloud Chromium launcher for the independent world UI suite because its launcher otherwise requires a SUID sandbox unavailable in this container. The npm browser scripts already pass the required container flag. CI uses its existing Chrome installation. The multiplayer driver uses three isolated cookie contexts (two humans plus spectator), real HTTP/WS, a controlled clock, and explicitly labelled local idle AI. Legal fixture AI council votes finish the real engine match; it does not fabricate winners. It verifies settings, names, claims/readiness, movement ownership, reconnect, spectator privacy, a complete multi-saboteur watch, archived replay and rematch role reveal. No paid calls occur. Reports/screenshots are generated under ignored `_artifacts/multiplayer-browser-*/`; selected screenshots are retained in `docs/screenshots/multiplayer/`.

Observed counts, exact commands and retained screenshots are in [Multiplayer qualification](MULTIPLAYER-VERIFICATION.md).
