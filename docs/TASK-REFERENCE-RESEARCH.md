# Task reference research and design notes

Research date: 2026-10-30 (Europe/Warsaw). The user supplied an Among Us waiting-room image as a spatial reference and asked that tasks follow the interaction style described by the Among Us Wiki. Lantern Wake keeps its original characters, artwork, place names and interface assets.

## Source access and limits

The requested wiki could **not be retrieved from this Cloud environment**. Normal HTTPS requests through the configured proxy to both:

- <https://among-us.fandom.com/wiki/Tasks>
- <https://among-us.wiki/wiki/Tasks>

returned `curl: (56) CONNECT tunnel failed, response 403`, with `HTTP/1.1 403 Forbidden`, on 2026-10-30. No page body was returned. The active Cloud policy is restricted to its existing package-manager/Git domains. No proxy, DNS, TLS or route bypass was attempted. These are attempted reference URLs, not successfully retrieved sources, and no current wiki text is quoted or claimed as verified.

The interaction descriptions below are **prior-knowledge design references awaiting direct wiki verification**. Their individual reference links identify the intended wiki articles for later checking; they are not evidence of a successful fetch. Exact map-specific task lists, counts, timings, speed tolerances, platform differences and current-game exceptions must not be inferred from this note.

## Mechanics to carry into the game

Task panels should represent a small physical or logical job with a visible beginning, intermediate state and completion. A task is distinct from a room visit. A map can assign different jobs to different equipment. A task may require several actions in one panel or separate work stages, and the task list/progress bar should represent confirmed work. Recognition, sequence, timing, spatial alignment, tracing and data entry should feel different from one another.

In the familiar reference game, task categories include common, short and long work, and impostors can imitate work without completing crew objectives. Ghost task behavior is a rules choice that must remain explicit. Lantern Wake already has its own host-configurable tasks, classic transfer versus ghost-task presets, safe spectator views and server-owned progress; those established rules remain its contract rather than silently changing to an unverified external rule.

| Familiar reference interaction | Intended wiki article, not retrieved | Original Lantern Wake adaptation |
| --- | --- | --- |
| Connect matching wires to shuffled opposite terminals; symbols supplement color. | [Fix Wiring](https://among-us.fandom.com/wiki/Fix_Wiring) | Show cable housings, left/right sockets, visibly traced completed paths and a selected loose cable. Each submitted connection identifies its endpoints. Preserve older three-connection challenges. |
| Watch a displayed sequence and reproduce it, with feedback after each correct input. | [Start Reactor](https://among-us.fandom.com/wiki/Start_Reactor) | A storm-memory console with separate playback and entry indicators, numbered pads, saved confirmed progress and explicit error/retry feedback. Avoid an inaccessible color-only sequence. |
| Adjust controls until an instrument aligns with a target. | [Align Engine Output](https://among-us.fandom.com/wiki/Align_Engine_Output), [Stabilize Steering](https://among-us.fandom.com/wiki/Stabilize_Steering) | Crosshair/axis and frequency alignment work; expose current and target values through native keyboard-operable controls. The server checks actual submitted alignment. |
| Plot a route through a displayed set of points. | [Chart Course](https://among-us.fandom.com/wiki/Chart_Course) | A beacon navigation plot with numbered waypoints, an actual route overlay and ordered point submissions. Distinct from ordinary character navigation. |
| Stop or align a moving instrument in its permitted region. | [Calibrate Distributor](https://among-us.fandom.com/wiki/Calibrate_Distributor) | A local instrument with readable gauges and controls; any enforced timing uses server-owned time. Frame rate or local animation alone must not grant completion. |
| Move an item through a reader, with visible acceptance/rejection feedback. | [Swipe Card](https://among-us.fandom.com/wiki/Swipe_Card), [Scan Boarding Pass](https://among-us.fandom.com/wiki/Scan_Boarding_Pass) | A harbor identity scanner with a card/reader and an accessible alternative input. Do not imply an exact speed/tolerance copied from the reference without verifying it. |
| Transfer data while a visible process completes; progress must be comprehensible. | [Download Data](https://among-us.fandom.com/wiki/Download_Data) | Data-burst segments, transfer meter and an authoritative start/wait/confirm sequence. Reconnects and interruptions follow documented game rules. |
| Divert power and then accept it at the relevant equipment. | [Divert Power](https://among-us.fandom.com/wiki/Divert_Power) | Breaker and receiving-node controls, clear stage labels and saved work. A future two-location variant needs actual server-tracked location stages rather than a decorative second screen. |
| Clear or sort objects in a physical receptacle. | [Empty Garbage](https://among-us.fandom.com/wiki/Empty_Garbage), [Clean O2 Filter](https://among-us.fandom.com/wiki/Clean_O2_Filter) | Debris sorting/filter tasks with distinguishable pieces, remaining-count feedback, pointer and button/keyboard interaction. |
| Fill a container and deliver/refill in stages. | [Fuel Engines](https://among-us.fandom.com/wiki/Fuel_Engines) | Fuel/pressure equipment with visible fluid levels, valves and staged confirmations. Real delivery stages require server/location validation. |

These are mechanics references, not a claim to reproduce Among Us exactly. In particular, Lantern Wake's CAPTCHA-style work is original gameplay and is not asserted to be an Among Us task category.

## Detailed CAPTCHA variety

The incoming expanded-map implementation already supplies six deterministic, original CAPTCHA families: glyph selection, symbol counting, numeric order, orientation, oddity selection and code transcription. Keep these working, then add families that ask meaningfully different questions instead of reskinning the same button grid:

- **Glyph selection:** identify every target symbol in a varied grid, with toggled selections, a target legend, a count and an explicit submit action.
- **Counting:** count a named shape among clear distractors; show a scene and a keypad or labeled numeric entry, with no visual ambiguity caused by tiny decoration.
- **Order:** select shuffled numbered plaques from smallest to largest, with a visible accepted path and remaining steps.
- **Orientation:** rotate or choose the correction for a marked instrument; keep the north marker and object direction distinguishable.
- **Oddity:** identify the single piece that differs in shape or marking; never use color as the only difference.
- **Code:** transcribe a readable generated transmission code; group characters, distinguish similar glyphs and provide a native text field. This is a fictional radio console, not an attempt to defeat a real anti-bot service.
- **Pair matching:** match two halves with the same symbol or serial, combining spatial search with explicit endpoint labels.
- **Pattern completion:** choose the missing item in a repeated symbolic pattern, with more than one useful distractor.
- **Checksum/arithmetic:** compute a small bounded operation from instrument values, using a clear equation and keypad.
- **Color/shape conjunction:** select objects matching both a named shape and a marking; the same information must be available as text.
- **Path tracing:** visit displayed nodes in a constrained order with a drawn path and undo/restart controls when locally needed.
- **Sorting:** place labeled objects in their matching category bins, with keyboard-operable choices equivalent to any drag interface.

A richer panel should explain what to do, display its challenge, represent local interaction state, distinguish server-confirmed work from a pending request, and make rejection actionable. Detailed artwork must improve comprehension rather than hide controls or required information.

## Acceptance criteria for implementation and verification

1. Every new family has a server-derived deterministic challenge, a semantic input validator, an AI-safe local input path and strict persisted-progress validation. A browser `solved` flag never grants completion.
2. Old task versions retain their existing challenge lengths/parameters and saved progress. Adding variety must not invalidate or silently reset valid checkpoints.
3. Wrong input, duplicate request, reused request ID with different content, early timer confirmation, another actor's task, wrong location, death policy, council and old rematch generation are exercised at the authority boundary.
4. Pointer, keyboard and touch users can perform equivalent work. Controls have readable labels, sufficient target sizes, visible selection/focus, symbolic alternatives to color, useful progress and status feedback. Motion respects reduced-motion preferences.
5. In-flight updates retain the current valid panel; a changed actor/task/match/location disposes it. A late response cannot advance, reopen or overwrite feedback in a different task or rematch.
6. A real browser verifies every implemented family with the actual server, captures representative desktop/mobile panels, and records failures rather than treating decorative artwork as proof of correct mechanics.

## Waiting-room image mapping

The provided screenshot establishes a compact, enclosed waiting room with a rear door, seats along the sides, a gridded metal floor and a keeper in the center. The requested Lantern Wake layout puts an interactive computer on a small gray table on the left and a wardrobe on the right. Both must be real, labeled controls with clear hover/focus/use states and keyboard/touch access. The initial screen also needs working **play with AI**, **watch AI** and invitation paths. Opening the computer or wardrobe must preserve locally edited preferences, and starting a server room must carry those preferences into its validated lobby/profile controls.
