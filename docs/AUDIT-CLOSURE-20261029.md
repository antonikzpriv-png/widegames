# Follow-up audit closure

The five-agent follow-up started from saved integration revision `0842a0090f1cfd1ec43b898f16e8191e5b9c2497`. Every editor used a separate D: branch/worktree. The four original audit reports retain their observed failures and test limits; this receipt records subsequent corrections separately.

| Finding | Correction | Independent verification |
| --- | --- | --- |
| Interrupted initial spectator join strands the visible retry | `0045f764f4a7d42a55fb659c51549ffc6617b4fa` retries GET before joining and records only successful automatic joins | Reviewer receipt `4e7e626f3036ddead6902b2d9eaff195fc12fa79`: 19/19 VM/HTTP checks pass, no skips |
| Cancel elimination loses keyboard focus | Same UI fix restores the still-valid trigger and guards room ownership | Same independent review includes stale room/phase and disabled-target controls |
| Deferred old-room 401 can issue an obsolete join with the new controller | Same UI fix captures its own controller and checks ownership before fallback mutations | Same independent review includes obsolete/canceled opens and late join completion |
| Opaque PUBLIC_ORIGIN accepts Origin:null | `5c698b92c1c465830d5ad52f0383072536f12d14` validates HTTP(S) origins at configuration and direct server entry points before storage | Core receipt `de27b7a2b9dc4ac802a27f486d8f560ffd6bfe14`: 8/8 groups pass |
| Credential-bearing PUBLIC_ORIGIN reaches startup/error logs | Same origin fix rejects userinfo with sanitized setup errors and logs only canonical values | Same independent review includes the credential-bearing invalid-port error variant |
| Collected browser console errors did not fail qualification | Coordinator `698336ffb01773d40d5b00383fbe4f106aa63a0b` gates collected primary-page console errors at completion and after cleanup | Independent packaging follow-up pending; real combined browser run follows |

The origin findings require malformed server configuration; no default-origin bypass or real provider-key disclosure was demonstrated. The UI findings did not demonstrate cross-room private-data disclosure. Independent rule auditing found no new rule defect in its bounded ballot/deadline/trace controls.

The coordinator's production-only install check passed six actual startup, HTTP/WebSocket privacy and restart/idempotency cases. The integrated rules/privacy/terminal subset passed 20 tests. After the origin fix was integrated, 19 independent-origin, author-origin, foundation and terminal-AI tests passed together with no skips. Historical stale-401 negative controls remain pinned to the defective revision rather than requiring corrected current code to remain defective.

Frontend separately passed ten real Chrome boundary scenarios using the corrected UI bytes, including pre-delivery join failure, uncertain-success cookie recovery, existing human-seat preservation, active room switching and keyboard Cancel. Its receipt retains and explains a report-only backend comparison error; source manifests independently confirm the backend remained unchanged during that original run. The final integrated browser qualification is separate.

The reviewer's first closure attempt failed with the native connection error `Codex returned an invalid transport response. Reconnect before trying again.` The same assigned account retried successfully; neither identity substitution nor approval of a native permission request occurred.

The complete integrated offline run at `91d635f` passed **233 tests**, with **5 explicit opt-in skips**, zero failures/cancellations, across 238 registered tests and three suites (37.016s). All new current-runtime UI/origin assertions ran. The skipped production-only offline install probe was separately qualified by its author; the remaining optional historical/browser controls retain their explicit entry points. Normal preparation syntax-checked 52 JavaScript modules. Subsequent changes are the browser gate and source-monitoring driver, plus documentation; browser qualification follows those changes.

Final integrated browser verification is pending. No live/paid model calls, deployment, main creation/merge, signing or unrelated Calythe changes are part of this follow-up.
