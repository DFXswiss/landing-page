(function() {
  var SUPPORTED = ['de','en','fr','it'];

  function getLang() {
    var params = new URLSearchParams(window.location.search);
    var urlLang = params.get('lang');
    if (urlLang && SUPPORTED.indexOf(urlLang) !== -1) return urlLang;
    try { var stored = localStorage.getItem('dfx-lang'); } catch(e) { var stored = null; }
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    var browserLang = navigator.language.slice(0,2);
    if (SUPPORTED.indexOf(browserLang) !== -1) return browserLang;
    return 'de';
  }

  var lang = getLang();
  try { localStorage.setItem('dfx-lang', lang); } catch(e) {}
  document.documentElement.lang = lang;

  // Hide content until translations are applied (prevents FOUC for non-German users)
  if (lang !== 'de') {
    document.documentElement.style.visibility = 'hidden';
  }

  // Determine base path for i18n files (works from root or subdirectory)
  var scripts = document.getElementsByTagName('script');
  var basePath = '';
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].getAttribute('src');
    if (src && src.indexOf('i18n.js') !== -1) {
      basePath = src.replace(/js\/i18n\.js.*$/, '');
      break;
    }
  }

  // Update app.dfx.swiss links to include current language
  function updateAppLinks() {
    var links = document.querySelectorAll('a[href*="app.dfx.swiss"]');
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      try {
        var url = new URL(href);
        url.searchParams.set('lang', lang);
        link.setAttribute('href', url.toString());
      } catch(e) {
        // ignore malformed URLs
      }
    });
  }

  // Update docs.dfx.swiss footer links to match current language
  function updateDocsLinks() {
    var links = document.querySelectorAll('a[href*="docs.dfx.swiss"]');
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      link.setAttribute('href', href.replace(/docs\.dfx\.swiss\/[a-z]{2}\//, 'docs.dfx.swiss/' + lang + '/'));
    });
  }

  function applyTranslations(translations) {
    // Replace textContent for data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (translations[key] !== undefined) {
        el.textContent = translations[key];
      }
    });

    // Replace innerHTML for data-i18n-html elements
    document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-html');
      if (translations[key] !== undefined) {
        el.innerHTML = translations[key];
      }
    });

    // Update document title
    if (translations['meta.title']) {
      document.title = translations['meta.title'];
    }

    // Update meta description
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && translations['meta.description']) {
      metaDesc.setAttribute('content', translations['meta.description']);
    }

    // Update og:title
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && translations['meta.title']) {
      ogTitle.setAttribute('content', translations['meta.title']);
    }

    // Update og:description
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && translations['meta.description']) {
      ogDesc.setAttribute('content', translations['meta.description']);
    }

    // Update twitter:title
    var twTitle = document.querySelector('meta[property="twitter:title"]');
    if (twTitle && translations['meta.title']) {
      twTitle.setAttribute('content', translations['meta.title']);
    }

    // Update twitter:description
    var twDesc = document.querySelector('meta[property="twitter:description"]');
    if (twDesc && translations['meta.description']) {
      twDesc.setAttribute('content', translations['meta.description']);
    }

    // Update links
    updateAppLinks();
    updateDocsLinks();

    // Show content after translations are applied
    document.documentElement.style.visibility = '';
  }

  // Start fetch early, but apply only after DOM is ready
  var translationPromise = fetch(basePath + 'i18n/' + lang + '.json')
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });

  function onReady(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  translationPromise
    .then(function(translations) {
      onReady(function() { applyTranslations(translations); });
    })
    .catch(function(err) {
      console.warn('i18n: failed to load translations, falling back to German.', err);
      onReady(function() { document.documentElement.style.visibility = ''; });
    });

  // Language switcher and active state
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.switcher_link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var newLang = this.getAttribute('lang');
        if (SUPPORTED.indexOf(newLang) === -1) return;
        try { localStorage.setItem('dfx-lang', newLang); } catch(e) {}
        var url = new URL(window.location);
        url.searchParams.set('lang', newLang);
        window.location.href = url.toString();
      });
    });

    // Highlight active language in switcher
    document.querySelectorAll('.switcher_link').forEach(function(link) {
      if (link.getAttribute('lang') === lang) {
        link.classList.add('is-active');
      }
    });
  });
})();
