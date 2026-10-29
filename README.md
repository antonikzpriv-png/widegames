# Lantern Wake

An original web social-deduction game: six keepers maintain a drifting storm beacon; one is a hidden saboteur. Play one human with five AI characters or watch six AI characters. Demo bots require no credentials and are explicitly labeled.

Requires Node22.13+ (Node24 LTS recommended) and npm.

```sh
npm ci
npm start
```

Open http://localhost:3000. Configuration is server-side: copy `.env.example` to `.env`, edit locally, then run `node --env-file=.env server/main.mjs`. Never commit keys. `npm test` runs offline fixture tests; `npm run check` syntax-checks project modules. Detailed rules, AI setup, storage, deployment and verified workflows are documented as implementations are integrated. No voice, accounts, monetization or external assets required.

Initial repository was empty (no origin/main revision). Work is retained on the integration branch; no main creation or deployment is implied.
