# DFX Landing Page

Static website for [dfx.swiss](https://dfx.swiss).

## Languages

German (default), English, French and Italian — switched at runtime via
`i18n/{de,en,fr,it}.json` (`?lang=` / language switcher), no separate pages.

## Tech stack

Pure HTML + CSS (a Webflow export plus hand-written CSS/JS) — **no build step**
for the site. The dev dependencies exist only for formatting and the test gates.

## Development

Requires Node 22 and (for the visual gate) Docker.

```bash
npm install
npm run serve   # preview at http://127.0.0.1:4173
npm run check   # formatting + HTML validity + site completeness + unit coverage
npm run e2e:docker   # visual regression (pinned container)
```

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the editing workflow, the full gate
reference, and how to regenerate visual baselines.

## Deployment

Deployed to Cloudflare Pages via GitHub Actions:

- Push to `develop` → `dev.dfx.swiss` (+ auto release PR to `main`)
- Merge to `main` → production (`dfx.swiss`)
- Push to `joshua` → preview (`joshua.dfx.swiss`)
