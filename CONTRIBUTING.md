# Contributing

The DFX landing page is a static HTML site (a Webflow export plus hand-written
CSS/JS). There is **no build step** for the site itself — the dev dependencies
exist only for formatting and the quality gates below.

## Setup

- **Node 22** (`engines.node >= 22`)
- **Docker** — only for the visual regression gate

```bash
npm install
npm run serve   # preview at http://127.0.0.1:4173 (Cloudflare-Pages-like routing)
```

The `origin` remote must point at `DFXswiss/landing-page`, not a personal fork —
pushes go straight to upstream, there is no fork workflow.

## What you may edit

- HTML content (copy, sections, structure) in `*.html`
- Your own CSS in `css/dfx-dark-theme.css` or new stylesheets
- Your own JS in `js/` (the pure, reusable logic belongs in `js/lib/`)
- i18n in `i18n/{de,en,fr,it}.json` — **keep all four languages in sync**, never
  just one (`npm run check:site` fails on missing translations or key drift)
- SEO/meta tags, schema/JSON-LD, `robots.txt`, `sitemap.xml`, `llms.txt`
- Store images under `images/` locally; do not hot-link external CDN URLs

## What not to touch

- The Webflow runtime: existing `data-wf-*` attributes, `css/webflow.css`,
  `js/webflow.js` (cleanup is tracked separately as issue #108 — only there)
- `.github/workflows/*`, DNS, Cloudflare, server config, tokens, GitHub secrets

## Code style

- **No silent fallbacks**: no `?? default`, no `|| default`, no empty `catch`,
  no default parameters that paper over a missing value — fail loudly or ask.
- **Comments only for non-obvious constraints/workarounds**; prefer
  self-explanatory code.
- **One task per change** — no speculative features or drive-by refactors.

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

## Before every push

- Run **`npm run check`** — it must be green (these are required CI checks).
- For intentional layout/design changes, regenerate the baselines in the
  container (`npm run e2e:docker:update`) and commit the updated PNGs.
- Sanity-check the page locally (`npm run serve`): main + sub-pages load,
  DE/EN/FR/IT switching works, mobile view, no console errors.

## Branch & deploy flow

Content edits flow through the `joshua` branch (an editor workspace):

- Push to `joshua` → preview deploy to `joshua.dfx.swiss`, and an auto PR
  `joshua → develop` is opened/updated. **Never push directly to `develop` or
  `main`.**
- `develop` → `dev.dfx.swiss`, and an auto release PR `develop → main` is opened.
- `main` → production (`dfx.swiss`).

Open PRs as **drafts**; the maintainer reviews and merges. Keep `joshua` in sync
with `develop` (`git merge origin/develop`) before larger changes.
