# Audit regression integration

The fresh audit receipts refer to saved revision `0842a0090f1cfd1ec43b898f16e8191e5b9c2497`. They are historical observations, including their explicitly open findings, rather than blanket approval of later code.

The coordinator integrated the rules, privacy and production-only receipts. Twenty targeted engine, HTTP/WebSocket privacy, historical lifecycle and terminal-AI tests passed together. No paid or live model requests were made.

The stale-401 negative control now reads the immutable audited frontend from Git rather than requiring the current working frontend to remain broken. Its test name explicitly identifies the historical source. New positive regressions must exercise the corrected frontend separately. The HTTP privacy test creates its temporary files inside the checkout's ignored `_artifacts/test-temp`, preserving D: operation locally and portability to other checkout locations.

The terminal-AI regression runs against the current checkout by default, retaining its real HTTP victory/pause/restart and reservation assertions. Supplying `TRANSPORT_TERMINAL_ROOT` still enforces the original independent `9b31317c618ea12810a369edb84f87834f9218b9` source pin before and after the run. This permits future transport corrections without treating every source change as a behavioral regression; the original pinned receipt remains unchanged.

The UI recovery/focus/stale-owner and malformed-origin findings remain pending until their fixes and independent verification receipts are integrated. This document does not claim those findings are closed.
