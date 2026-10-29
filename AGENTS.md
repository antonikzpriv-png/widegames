# Lantern Wake workflow

Build the integrated playable game in widegames. Do not touch Calythe or prior projects. Source, worktrees, temp, dependencies and artifacts live under D:/Widegames-work. Preserve every existing branch/worktree. The remote is initially empty: no origin/main revision exists. Work on the assigned codex branch; do not create/change main or deploy.

Node ESM, ws, native HTTP and plain browser modules. Shared contracts belong to the coordinator. Engine owns server/engine/**; AI owns server/ai/**; frontend owns public/**; rooms/transport owns server/rooms.mjs, server/transport.mjs, server/store.mjs. Each owns uniquely prefixed tests and docs. Root/config/shared/static/launch files belong to the coordinator. Do not change another owner's files; request contract changes explicitly.

Read docs/CONTRACT.md before editing. Models propose actions; only the engine mutates game state. Never give AI or clients full hidden state. Private reasoning and provider keys are never client payloads. Spectators see only redacted state until the end. No live/paid provider calls in tests without explicit user authorization. Demo mode must be labeled. Commit bounded changes, report exact commands and real failures. The coordinator integrates and independently verifies each commit.
