// Single source of truth for the dev server port, the pages under test, the
// Playwright projects (viewports) and the visual matrix. Imported by
// playwright.config.mjs, scripts/dev-server.mjs, scripts/check-visual.mjs and
// every spec so the matrix is declared exactly once.

export const PORT = 4173;

// Public, indexed pages. Left out on purpose: analytics.html (internal dashboard)
// and dfx-services.html (excluded from the deploy and 301-redirected to /), since
// neither is served in production. Used by the smoke spec and as the base of the
// default visual views below.
export const PAGES = [
  '/',
  '/dfx-toolbox.html',
  '/dfx-taro-app.html',
  '/dfx-services-ag.html',
  '/faq.html',
  '/help.html',
];

// Viewports the visual suite renders. Desktop + a real tablet width (exercises the
// `@media (max-width: 1024px)` layer and the burger nav) + phone.
export const PROJECTS = ['desktop-chromium', 'tablet-chromium', 'mobile-safari'];

// Projects that render the burger / mobile navigation (desktop shows the full nav,
// so a "nav open" view is meaningless there).
export const NARROW_PROJECTS = ['tablet-chromium', 'mobile-safari'];

// Stable screenshot slug for a page path: '/' → 'home', '/faq.html' → 'faq'.
export function screenshotName(path) {
  const slug =
    path === '/'
      ? 'home'
      : path
          .replace(/^\//, '')
          .replace(/\.html$/, '')
          .replace(/\//g, '-');
  return `${slug}.png`;
}

function slugFor(path) {
  return screenshotName(path).replace(/\.png$/, '');
}

// The visual matrix. Each VIEW is one screenshot scenario:
//   slug     — baseline filename (without extension), unique across the matrix
//   path     — URL to load
//   lang     — optional ?lang to render in (default 'de', the authored language)
//   state    — optional interaction performed before the shot:
//              'faqOpen' | 'navOpen' | 'aiPopup'
//   projects — optional subset of PROJECTS this view applies to (default: all)
//
// Coverage = every public page at default load on all three viewports, one
// additional language per page (rotating en/fr/it for breadth), and the three
// interactive states the default-load shot can never capture.
export const VIEWS = [
  // 1) Default load (authored German), every page × every viewport.
  ...PAGES.map((path) => ({ slug: slugFor(path), path })),

  // 2) One additional language per page (rotating en/fr/it), every viewport.
  { slug: 'home-en', path: '/', lang: 'en' },
  { slug: 'dfx-toolbox-fr', path: '/dfx-toolbox.html', lang: 'fr' },
  { slug: 'dfx-taro-app-it', path: '/dfx-taro-app.html', lang: 'it' },
  { slug: 'dfx-services-ag-en', path: '/dfx-services-ag.html', lang: 'en' },
  { slug: 'faq-fr', path: '/faq.html', lang: 'fr' },
  { slug: 'help-it', path: '/help.html', lang: 'it' },

  // 3) Interactive states (a default-load shot can never capture these).
  { slug: 'faq-open', path: '/faq.html', state: 'faqOpen' },
  { slug: 'home-nav-open', path: '/', state: 'navOpen', projects: NARROW_PROJECTS },
  { slug: 'home-ai-popup', path: '/', state: 'aiPopup' },
];

// Projects a given view applies to.
export function projectsForView(view) {
  return view.projects ?? PROJECTS;
}

// Every (view, project) pair that should produce a baseline.
export function visualMatrix() {
  const pairs = [];
  for (const view of VIEWS) {
    for (const project of projectsForView(view)) {
      pairs.push({ view, project });
    }
  }
  return pairs;
}
