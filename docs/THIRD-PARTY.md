# Dependencies and provenance

The game code, setting, HTML/CSS and lantern SVG were authored for widegames. No donor game/server or external font/media asset was copied.

- Production realtime dependency: `ws`8.22.0, MIT, [upstream releases](https://github.com/websockets/ws/releases). Its upstream license is retained by npm under the installed package and included in the production container dependency installation.
- Development browser driver: `puppeteer-core`25.16.0, Apache-2.0, [upstream project](https://github.com/puppeteer/puppeteer). It uses a separately installed browser; no Chrome executable is bundled with the game.
- All direct/transitive versions and integrity values are locked in `package-lock.json`. Runtime Node/browser installations retain their own distribution terms.
- Optional live model uses the official Anthropic Messages API and requires the operator's authorized credentials/billing. This integration does not supply API access or provider rights. No provider key or private model reasoning is part of game assets, screenshots or repository reports.

See [AI](AI.md) for exact supported model, conservative pricing assumptions and primary API references, and [verification](VERIFICATION.md) for what was actually tested.
