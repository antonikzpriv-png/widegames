# Coordinator production-install audit

Source pin:0842a0090f1cfd1ec43b898f16e8191e5b9c2497. This audit uses its own D: checkout and changes no game runtime. The four parallel audits cover rules, public privacy, browser interaction, and provider/configuration boundaries separately.

`npm ci --omit=dev --ignore-scripts --no-audit --no-fund` installed the single production dependency. A real local server then passed six checks:

- Startup works without the development Puppeteer driver installed.
- The actual health endpoint responds.
- Cookie-authenticated human room creation, start and movement succeed.
- The actual WebSocket authenticates the same human and omits every other player's role.
- Closing and reopening the real service restores the original cookie/seat and committed movement.
- Reusing the persisted movement request remains an inert duplicate after restart.

No HTTP or storage implementation was mocked; only explicitly configured credential-free demo AI was enabled. No live/paid provider calls or Chrome session occurred. The server and socket were closed. Evidence remains under this checkout's uniquely created ignored `_artifacts/production-only-*` directory. Model secrets, cookie tokens and private views were not printed in the report.

No defect was found in this bounded production-dependency/startup/restart probe. This does not qualify a Docker image, hosted deployment, filesystem power loss or the entire parallel audit pass. Persistence source review and any new findings remain separate from these six observed checks.
