#!/usr/bin/env node
/**
 * Static-site completeness gate for the DFX landing page.
 *
 * Fails closed (exit 1) on any structural defect a contributor could ship
 * without noticing on a no-build static site:
 *   - invalid JSON (i18n dictionaries, ai-index.json) or JSON-LD
 *   - i18n dictionaries that drift out of key parity across de/en/fr/it
 *   - a `data-i18n` key used in HTML that is missing from any language
 *   - an internal link / asset reference that does not resolve to a file
 *   - a sitemap <loc> that does not resolve, or a public page missing from it
 *   - a public page without a valid same-origin canonical, or a malformed
 *     canonical/og:url, or a missing/invalid <html lang>
 *
 * Unused i18n keys are reported as warnings (they do not fail the build).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);
const read = (file) => readFileSync(join(root, file), 'utf8');

const LANGS = ['de', 'en', 'fr', 'it'];
// Pages excluded from the public-page invariants (sitemap, canonical) but still
// JSON-LD/link checked:
//   - analytics.html: internal, non-indexed dashboard
//   - dfx-services.html: deprecated legacy ramp page, 301-redirected to / (the
//     homepage is now the "DFX Ramp" landing); kept for history, not indexed.
const INTERNAL_PAGES = new Set(['analytics.html', 'dfx-services.html']);

const htmlFiles = readdirSync(root)
  .filter((file) => extname(file) === '.html')
  .sort();
const publicPages = htmlFiles.filter((file) => !INTERNAL_PAGES.has(file));

// --- origin -----------------------------------------------------------------
// Derive the canonical origin from index.html instead of hard-coding it, so the
// gate follows the site if the domain ever moves.
function extractCanonical(html) {
  const link = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i);
  if (!link) return null;
  const href = link[0].match(/\bhref=["']([^"']+)["']/i);
  return href ? href[1] : null;
}
function extractOgUrl(html) {
  const meta = html.match(/<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/i);
  if (!meta) return null;
  const content = meta[0].match(/\bcontent=["']([^"']+)["']/i);
  return content ? content[1] : null;
}

const indexCanonical = extractCanonical(read('index.html')) || extractOgUrl(read('index.html'));
if (!indexCanonical) {
  fail('index.html: no canonical or og:url to derive the site origin from');
}
const ORIGIN = indexCanonical ? new URL(indexCanonical).origin : null;

// --- path resolution (mirrors scripts/dev-server.mjs / Cloudflare Pages) -----
function resolvesToFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.split('#')[0].split('?')[0]);
  } catch {
    return false;
  }
  let rel = decoded.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  let target = join(root, rel);
  if (!target.startsWith(root)) return false;
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, 'index.html');
  }
  return existsSync(target) && statSync(target).isFile();
}

// --- 1. JSON validity + load dictionaries -----------------------------------
const dicts = {};
for (const lang of LANGS) {
  const file = `i18n/${lang}.json`;
  try {
    dicts[lang] = JSON.parse(read(file));
  } catch (error) {
    fail(`${file}: invalid JSON — ${error.message}`);
  }
}
try {
  JSON.parse(read('ai-index.json'));
} catch (error) {
  fail(`ai-index.json: invalid JSON — ${error.message}`);
}

// --- 2. JSON-LD validity -----------------------------------------------------
for (const file of htmlFiles) {
  const html = read(file);
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    try {
      JSON.parse(block[1].trim());
    } catch (error) {
      fail(`${file}: invalid JSON-LD — ${error.message}`);
    }
  }
}

// --- 3. i18n key parity ------------------------------------------------------
if (LANGS.every((lang) => dicts[lang])) {
  const reference = new Set(Object.keys(dicts.de));
  for (const lang of LANGS) {
    if (lang === 'de') continue;
    const keys = new Set(Object.keys(dicts[lang]));
    for (const key of reference) {
      if (!keys.has(key)) fail(`i18n: key "${key}" present in de but missing in ${lang}`);
    }
    for (const key of keys) {
      if (!reference.has(key)) fail(`i18n: key "${key}" present in ${lang} but missing in de`);
    }
  }
}

// --- 4. every used data-i18n key exists in every language --------------------
const usedKeys = new Set();
for (const file of htmlFiles) {
  for (const match of read(file).matchAll(/data-i18n(?:-html)?=["']([^"']+)["']/g)) {
    usedKeys.add(match[1]);
  }
}
for (const key of usedKeys) {
  for (const lang of LANGS) {
    if (dicts[lang] && !(key in dicts[lang])) {
      fail(`i18n: data-i18n key "${key}" is missing from ${lang}.json`);
    }
  }
}

// --- 5. internal links / asset references resolve ----------------------------
// A same-origin path is valid if it maps to a file OR matches a _redirects rule
// (Cloudflare Pages serves those as 301s, not 404s).
function loadRedirectMatchers() {
  if (!existsSync(join(root, '_redirects'))) return [];
  const matchers = [];
  for (const line of read('_redirects').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const source = trimmed.split(/\s+/)[0];
    if (!source.startsWith('/')) continue;
    const pattern = source
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex metachars (keeps * : /)
      .replace(/:[A-Za-z0-9_]+/g, '[^/]+') // :placeholder → one path segment
      .replace(/\*/g, '.*'); // splat → rest of path
    matchers.push(new RegExp(`^${pattern}$`));
  }
  return matchers;
}
const redirectMatchers = loadRedirectMatchers();
const isRedirected = (pathname) => redirectMatchers.some((re) => re.test(pathname));

function checkReference(file, value) {
  const raw = value.trim();
  if (!raw) return;
  if (/^(mailto:|tel:|javascript:|data:|#)/i.test(raw)) return;
  if (/^\/\//.test(raw)) return; // protocol-relative → external CDN

  let pathname;
  if (/^https?:\/\//i.test(raw)) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      fail(`${file}: unparsable URL "${raw}"`);
      return;
    }
    if (url.origin !== ORIGIN) return; // external
    pathname = url.pathname;
  } else {
    pathname = ('/' + raw.replace(/^\.?\//, '')).split('#')[0].split('?')[0];
  }

  if (!resolvesToFile(pathname) && !isRedirected(pathname)) {
    fail(`${file}: internal link does not resolve — "${raw}"`);
  }
}
for (const file of htmlFiles) {
  for (const match of read(file).matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    checkReference(file, match[1]);
  }
}

// --- 5b. js/i18n.js depends on js/lib/i18n-core.js loading first -------------
// i18n.js calls window.DfxI18nCore synchronously; if a page loads i18n.js without
// the core (or after it), the script throws before it can hide/translate. Guard
// the coupling so a new page can't ship the bug unnoticed.
for (const file of htmlFiles) {
  const html = read(file);
  const i18nIndex = html.indexOf('js/i18n.js');
  if (i18nIndex === -1) continue;
  const coreIndex = html.indexOf('js/lib/i18n-core.js');
  if (coreIndex === -1) {
    fail(`${file}: loads js/i18n.js but never loads its dependency js/lib/i18n-core.js`);
  } else if (coreIndex > i18nIndex) {
    fail(`${file}: js/lib/i18n-core.js must be loaded before js/i18n.js`);
  }
}

// --- 6. sitemap consistency --------------------------------------------------
const sitemap = read('sitemap.xml');
const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
for (const loc of sitemapPaths) {
  let url;
  try {
    url = new URL(loc);
  } catch {
    fail(`sitemap.xml: unparsable <loc> "${loc}"`);
    continue;
  }
  if (url.origin !== ORIGIN) {
    fail(`sitemap.xml: <loc> "${loc}" is not on the site origin ${ORIGIN}`);
    continue;
  }
  if (!resolvesToFile(url.pathname)) {
    fail(`sitemap.xml: <loc> "${loc}" does not resolve to a file`);
  }
}
const sitemapPathnames = new Set(
  sitemapPaths.map((loc) => {
    try {
      return new URL(loc).pathname;
    } catch {
      return loc;
    }
  }),
);
for (const page of publicPages) {
  const expected = page === 'index.html' ? '/' : `/${page}`;
  if (!sitemapPathnames.has(expected)) {
    fail(`sitemap.xml: public page "${page}" (${expected}) is not listed`);
  }
}

// --- 7. per-page canonical / og:url / lang ----------------------------------
function checkAbsoluteSameOrigin(file, label, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${file}: ${label} "${value}" is not an absolute URL`);
    return;
  }
  if (url.protocol !== 'https:') fail(`${file}: ${label} "${value}" is not https`);
  if (url.origin !== ORIGIN) fail(`${file}: ${label} "${value}" is not on ${ORIGIN}`);
}
for (const page of publicPages) {
  const html = read(page);

  const langMatch = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i);
  if (!langMatch) {
    fail(`${page}: <html> has no lang attribute`);
  } else if (!LANGS.includes(langMatch[1])) {
    fail(`${page}: <html lang="${langMatch[1]}"> is not one of ${LANGS.join(', ')}`);
  }

  const canonical = extractCanonical(html);
  if (!canonical) {
    fail(`${page}: missing <link rel="canonical">`);
  } else {
    checkAbsoluteSameOrigin(page, 'canonical', canonical);
  }

  const ogUrl = extractOgUrl(html);
  if (ogUrl) checkAbsoluteSameOrigin(page, 'og:url', ogUrl);
}

// --- 8. unused i18n keys (warning only) -------------------------------------
// Keys consumed by js/i18n.js directly rather than through a data-i18n element.
const JS_CONSUMED_KEYS = new Set(['meta.title', 'meta.description']);
if (dicts.de) {
  for (const key of Object.keys(dicts.de)) {
    if (!usedKeys.has(key) && !JS_CONSUMED_KEYS.has(key)) {
      warn(`unused i18n key (defined but never referenced): "${key}"`);
    }
  }
}

// --- report ------------------------------------------------------------------
for (const message of warnings) console.warn(`warning  ${message}`);
if (errors.length > 0) {
  for (const message of errors) console.error(`error    ${message}`);
  console.error(`\ncheck-site: ${errors.length} error(s) across ${htmlFiles.length} HTML files.`);
  process.exit(1);
}
console.log(
  `check-site: OK — ${htmlFiles.length} HTML files, ${LANGS.length} languages, ` +
    `${usedKeys.size} i18n keys in use, ${sitemapPaths.length} sitemap entries` +
    (warnings.length ? `, ${warnings.length} warning(s)` : '') +
    '.',
);
