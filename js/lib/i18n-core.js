/**
 * Pure, side-effect-free language helpers shared by js/i18n.js.
 *
 * Loaded as a classic script *before* js/i18n.js so window.DfxI18nCore exists
 * when i18n.js runs. Kept free of DOM/network access so it can be unit-tested in
 * isolation with 100% coverage (see test/i18n-core.test.mjs); the DOM and fetch
 * glue stays in js/i18n.js and is covered by the Playwright functional suite.
 */
(function (global) {
  'use strict';

  // Resolve the active language from the candidates the page can offer, in
  // priority order: explicit ?lang= → stored choice → browser language → the
  // explicit default. A candidate only wins if it is in `supported`.
  function resolveLang(options) {
    var supported = options.supported;
    var browserLang = (options.navigatorLang || '').slice(0, 2);

    if (options.urlLang && supported.indexOf(options.urlLang) !== -1) {
      return options.urlLang;
    }
    if (options.storedLang && supported.indexOf(options.storedLang) !== -1) {
      return options.storedLang;
    }
    if (supported.indexOf(browserLang) !== -1) {
      return browserLang;
    }
    return options.defaultLang;
  }

  // Rewrite an app.dfx.swiss link so it carries the active language. Returns the
  // rewritten href, or null when the href is not a parsable URL (caller leaves
  // the original href untouched).
  function rewriteAppLink(href, lang) {
    try {
      var url = new URL(href);
      url.searchParams.set('lang', lang);
      return url.toString();
    } catch (e) {
      return null;
    }
  }

  // Rewrite the language segment of a docs.dfx.swiss link (.../docs.dfx.swiss/de/
  // → .../docs.dfx.swiss/<lang>/). Returns the href unchanged when it has no
  // language segment.
  function rewriteDocsLink(href, lang) {
    return href.replace(/docs\.dfx\.swiss\/[a-z]{2}\//, 'docs.dfx.swiss/' + lang + '/');
  }

  global.DfxI18nCore = {
    resolveLang: resolveLang,
    rewriteAppLink: rewriteAppLink,
    rewriteDocsLink: rewriteDocsLink,
  };
})(window);
