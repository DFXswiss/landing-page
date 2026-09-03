import { resolve } from 'node:path';
import { URL as NodeURL, fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import {
  findMatchingRule,
  loadRedirectMatchers,
  loadRedirectRules,
} from '../scripts/lib/redirects.mjs';

// The jsdom test environment shadows the global `URL` with one that resolves
// relative to jsdom's default document location, not this file — so the
// file:// URL class is imported explicitly (aliased to avoid colliding with
// the ambient global) rather than relying on the global.
const root = resolve(fileURLToPath(new NodeURL('..', import.meta.url)));
const matchers = loadRedirectMatchers(root);
const isRedirected = (pathname) => matchers.some((re) => re.test(pathname));

describe('_redirects: /app entry points', () => {
  test('matches /app/services/ — the trailing-slash form real referral links use', () => {
    expect(isRedirected('/app/services/')).toBe(true);
  });

  test('matches /app/services — the canonical form without a trailing slash', () => {
    expect(isRedirected('/app/services')).toBe(true);
  });

  test('matches /app/ on its own', () => {
    expect(isRedirected('/app/')).toBe(true);
  });

  test('does not match an asset path nested under /app/services/', () => {
    expect(isRedirected('/app/services/css/webflow.css')).toBe(false);
  });

  test('redirects /app/services/ to https://api.dfx.swiss/v1/app/:rest with status 301', () => {
    const rule = findMatchingRule(root, '/app/services/');
    expect(rule.target).toBe('https://api.dfx.swiss/v1/app/:rest');
    expect(rule.status).toBe(301);
  });

  test('redirects /app/ to https://api.dfx.swiss/v1/app with status 301', () => {
    const rule = findMatchingRule(root, '/app/');
    expect(rule.target).toBe('https://api.dfx.swiss/v1/app');
    expect(rule.status).toBe(301);
  });
});

describe('_redirects: target placeholders', () => {
  test('every :placeholder used in a rule target is declared in that rule’s own source', () => {
    const rules = loadRedirectRules(root);
    // Guard against the parser silently regressing to an empty/no-op result —
    // without this, an empty `rules` (or one with no target placeholders at
    // all) would make the loop below a no-op and the test would pass without
    // ever asserting anything.
    expect(rules.length).toBeGreaterThan(0);

    let placeholdersChecked = 0;
    for (const rule of rules) {
      const sourcePlaceholders = new Set(
        [...rule.source.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]),
      );
      const targetPlaceholders = [...rule.target.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
      for (const placeholder of targetPlaceholders) {
        placeholdersChecked += 1;
        expect(
          sourcePlaceholders.has(placeholder),
          `rule "${rule.source} -> ${rule.target}" uses :${placeholder} in its target, ` +
            `but the source only declares [${[...sourcePlaceholders].join(', ')}]`,
        ).toBe(true);
      }
    }
    expect(placeholdersChecked).toBeGreaterThan(0);
  });
});
