// Single source of truth for the dev server port, the pages under test, and the
// Playwright projects. Imported by playwright.config.mjs, scripts/dev-server.mjs
// and every spec so the matrix is declared exactly once.

export const PORT = 4173;

// Public, indexed pages. Left out on purpose: analytics.html (internal dashboard)
// and dfx-services.html (excluded from the deploy and 301-redirected to /), since
// neither is served in production.
export const PAGES = [
  '/',
  '/dfx-toolbox.html',
  '/dfx-taro-app.html',
  '/dfx-services-ag.html',
  '/faq.html',
  '/help.html',
];

export const PROJECTS = ['desktop-chromium', 'mobile-safari'];

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
