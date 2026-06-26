# Contributing

The DFX landing page is a static HTML site (a Webflow export plus hand-written
CSS/JS). There is **no build step** for the site itself — the dev dependencies
exist only for formatting and the quality gates below.

Day-to-day editing guidance for content/AI agents lives in
[AGENTS.md](AGENTS.md). This file documents the test and CI gates.

## Setup

- **Node 22** (`engines.node >= 22`)
- **Docker** — only for the visual regression gate

```bash
npm install
npm run serve   # preview at http://127.0.0.1:4173 (Cloudflare-Pages-like routing)
```

## Quality gates

Every pull request must pass the gates below; CI runs them as **required status
checks**, so a PR that breaks any one of them cannot be merged.

| Gate              | Command                 | What it enforces                                                                                                                                      |
| ----------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting        | `npm run format:check`  | Prettier formatting of the maintained code (the Webflow export and vendored assets are ignored)                                                       |
| HTML validity     | `npm run validate:html` | Valid markup on every page                                                                                                                            |
| Site completeness | `npm run check:site`    | i18n key parity across de/en/fr/it, every `data-i18n` key translated, valid JSON/JSON-LD, internal links, sitemap, per-page `lang`/canonical/`og:url` |
| Unit coverage     | `npm run test:coverage` | 100% line/branch/function/statement coverage of the extracted browser logic (`js/lib/**`)                                                             |
| Visual regression | `npm run e2e:docker`    | Full-page screenshot of every page × viewport matches its committed baseline, then `check:visual`                                                     |

`npm run check` runs the first four locally in one go. The visual gate runs in a
pinned container (see below).

### CI

- **Quality** (`.github/workflows/quality.yml`) — the first four gates.
- **Screenshots** (`.github/workflows/visual.yml`) — the visual gate, in the
  pinned Playwright container.

Both run on every pull request and on pushes to `develop`/`main`.

## Browser JS and unit coverage

The shipped browser scripts in `js/` are classic, DOM-coupled IIFEs. Rather than
chase 100% coverage through the DOM, the **pure** logic is extracted into
`js/lib/` (side-effect free, exposed on a `window.*` global) and unit-tested to
100% with Vitest + jsdom. Everything else — i18n application, the language
switcher, the AI popup, scroll-reveal, click tracking — is covered end-to-end by
the Playwright functional suite (`tests/behavior.spec.mjs`).

If you add a file under `js/lib/`, it must reach 100% coverage or the Quality
gate fails (the threshold reports every matched file, tested or not).

## Visual regression & baselines

Screenshots are only reproducible when they render against the exact browsers the
baselines were generated with. Therefore:

- Baselines are generated and compared **inside the pinned container**
  (`mcr.microsoft.com/playwright:v<version>-noble`).
- `@playwright/test` is pinned to an **exact** version equal to that image tag. A
  guard step in `visual.yml` reads the tag back from the workflow and fails the
  build if the two drift apart.
- **Never** generate baselines on macOS/Windows — they would not match the Linux
  CI render.

```bash
npm run e2e:docker          # run the suite + compare against baselines + check:visual
npm run e2e:docker:update   # regenerate baselines after an intentional UI change
```

When you intentionally change the look of a page, run `e2e:docker:update` and
commit the updated PNGs under `tests/__screenshots__/`.

`<canvas>` and `<video>` elements are masked in the screenshots (they render
non-deterministic pixels); the rest of each page is byte-compared.

### Bumping Playwright

Bump the `@playwright/test` pin in `package.json` **and** the `image:` tag in
`.github/workflows/visual.yml` together (same version), then regenerate the
baselines in the container. The guard step enforces that they stay in lockstep.

## Branch flow

- Content edits flow through the `joshua` branch, which auto-opens a PR to
  `develop` (see [AGENTS.md](AGENTS.md)).
- `develop` deploys to `dev.dfx.swiss` and auto-opens a release PR to `main`.
- `main` deploys to `dfx.swiss`.
- Open PRs as drafts; the maintainer reviews and merges.
