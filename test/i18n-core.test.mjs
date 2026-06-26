import { describe, expect, test } from 'vitest';

// Importing the classic script runs it against the jsdom window and exposes the
// helpers on window.DfxI18nCore without any side effects.
import '../js/lib/i18n-core.js';

const { resolveLang, rewriteAppLink, rewriteDocsLink } = window.DfxI18nCore;

const SUPPORTED = ['de', 'en', 'fr', 'it'];

function resolve(overrides) {
  return resolveLang({
    urlLang: null,
    storedLang: null,
    navigatorLang: '',
    supported: SUPPORTED,
    defaultLang: 'de',
    ...overrides,
  });
}

describe('resolveLang', () => {
  test('prefers a supported ?lang= over everything else', () => {
    expect(resolve({ urlLang: 'fr', storedLang: 'it', navigatorLang: 'en-US' })).toBe('fr');
  });

  test('ignores an unsupported ?lang= and falls through to the stored choice', () => {
    expect(resolve({ urlLang: 'pt', storedLang: 'it', navigatorLang: 'en-US' })).toBe('it');
  });

  test('uses the stored choice when there is no ?lang=', () => {
    expect(resolve({ storedLang: 'en', navigatorLang: 'fr-FR' })).toBe('en');
  });

  test('ignores an unsupported stored choice and falls through to the browser language', () => {
    expect(resolve({ storedLang: 'pt', navigatorLang: 'fr-FR' })).toBe('fr');
  });

  test('derives the two-letter browser language when nothing else matches', () => {
    expect(resolve({ navigatorLang: 'it-CH' })).toBe('it');
  });

  test('returns the explicit default for an unsupported browser language', () => {
    expect(resolve({ navigatorLang: 'pt-BR' })).toBe('de');
  });

  test('falls back to the explicit default when the browser language is empty', () => {
    expect(resolve({ navigatorLang: '' })).toBe('de');
  });
});

describe('rewriteAppLink', () => {
  test('sets the lang query param, preserving existing params', () => {
    expect(rewriteAppLink('https://app.dfx.swiss/?foo=1', 'fr')).toBe(
      'https://app.dfx.swiss/?foo=1&lang=fr',
    );
  });

  test('replaces an existing lang param', () => {
    expect(rewriteAppLink('https://app.dfx.swiss/?lang=de', 'it')).toBe(
      'https://app.dfx.swiss/?lang=it',
    );
  });

  test('returns null for a non-parsable href', () => {
    expect(rewriteAppLink('not a url', 'de')).toBeNull();
  });
});

describe('rewriteDocsLink', () => {
  test('swaps the language segment', () => {
    expect(rewriteDocsLink('https://docs.dfx.swiss/de/intro', 'fr')).toBe(
      'https://docs.dfx.swiss/fr/intro',
    );
  });

  test('leaves an href without a language segment unchanged', () => {
    expect(rewriteDocsLink('https://docs.dfx.swiss/intro', 'fr')).toBe(
      'https://docs.dfx.swiss/intro',
    );
  });
});
