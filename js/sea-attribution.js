(function() {
  var ATTR_KEY = 'dfx-sea-attribution';
  var PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'gclid',
    'gbraid',
    'wbraid',
    'msclkid',
    'fbclid',
    'ttclid',
    'li_fat_id'
  ];
  var INTERNAL_PATH_RE = /^(\/)?(index|dfx-services|dfx-toolbox|dfx-taro-app|dfx-services-ag|faq|help)\.html$/;

  function clean(value) {
    if (!value) return '';
    return String(value).replace(/[<>]/g, '').slice(0, 180);
  }

  function readUrlAttribution() {
    var params = new URLSearchParams(window.location.search);
    var attribution = {};
    PARAMS.forEach(function(key) {
      var value = clean(params.get(key));
      if (value) attribution[key] = value;
    });
    if (!Object.keys(attribution).length) return null;
    attribution.landing_page = clean(window.location.pathname + window.location.search);
    attribution.landing_referrer = clean(document.referrer);
    attribution.captured_at = new Date().toISOString();
    return attribution;
  }

  function readStoredAttribution() {
    try {
      var raw = sessionStorage.getItem(ATTR_KEY) || localStorage.getItem(ATTR_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function storeAttribution(attribution) {
    if (!attribution) return;
    var raw = JSON.stringify(attribution);
    try { sessionStorage.setItem(ATTR_KEY, raw); } catch (e) {}
    try { localStorage.setItem(ATTR_KEY, raw); } catch (e) {}
  }

  function getAttribution() {
    var current = readUrlAttribution();
    if (current) {
      storeAttribution(current);
      return current;
    }
    return readStoredAttribution();
  }

  function appendAttribution(url, attribution) {
    PARAMS.forEach(function(key) {
      if (attribution[key] && !url.searchParams.has(key)) {
        url.searchParams.set(key, attribution[key]);
      }
    });
    if (!url.searchParams.has('ref')) {
      url.searchParams.set('ref', 'dfx_landing');
    }
  }

  function isInternalLandingLink(url) {
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === '/' || url.pathname === '') return true;
    return INTERNAL_PATH_RE.test(url.pathname.replace(/^\//, ''));
  }

  function isConversionLink(url) {
    if (url.protocol === 'mailto:') return true;
    if (url.hostname === 'app.dfx.swiss') return true;
    if (url.hostname === 'dfx.swiss' && url.pathname.indexOf('/app') === 0) return true;
    return false;
  }

  function labelFor(anchor, url) {
    if (url.protocol === 'mailto:') return 'lead_email';
    if (url.hostname === 'app.dfx.swiss' && url.pathname.indexOf('/support') === 0) return 'support';
    if (url.pathname.indexOf('/buy') === 0) return 'buy';
    if (url.pathname.indexOf('/sell') === 0) return 'sell';
    if (url.pathname.indexOf('/swap') === 0) return 'swap';
    if (url.pathname.indexOf('/app/btc') === 0) return 'btc_taro';
    return anchor.classList.contains('nav-button') ? 'nav_start' : 'start';
  }

  function updateLinks(attribution) {
    if (!attribution) return;
    document.querySelectorAll('a[href]').forEach(function(anchor) {
      var href = anchor.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      var url;
      try { url = new URL(href, window.location.href); } catch (e) { return; }
      if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'mailto:') return;

      if ((isInternalLandingLink(url) || isConversionLink(url)) && url.protocol !== 'mailto:') {
        appendAttribution(url, attribution);
        anchor.setAttribute('href', url.toString());
      }

      if (isConversionLink(url)) {
        anchor.setAttribute('data-sea-conversion', labelFor(anchor, url));
      }
    });
  }

  function bindConversionEvents(attribution) {
    document.addEventListener('click', function(event) {
      var anchor = event.target.closest ? event.target.closest('a[data-sea-conversion]') : null;
      if (!anchor) return;
      var payload = {
        event: 'dfx_sea_click',
        conversion_type: anchor.getAttribute('data-sea-conversion'),
        conversion_url: anchor.href,
        page_path: window.location.pathname,
        utm_source: attribution && attribution.utm_source,
        utm_medium: attribution && attribution.utm_medium,
        utm_campaign: attribution && attribution.utm_campaign,
        gclid: attribution && attribution.gclid,
        gbraid: attribution && attribution.gbraid,
        wbraid: attribution && attribution.wbraid,
        msclkid: attribution && attribution.msclkid
      };
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(payload);
      try {
        window.dispatchEvent(new CustomEvent('dfx:sea-click', { detail: payload }));
      } catch (e) {}
    }, true);
  }

  document.addEventListener('DOMContentLoaded', function() {
    var attribution = getAttribution();
    window.dfxSeaAttribution = attribution || null;
    updateLinks(attribution);
    bindConversionEvents(attribution);
  });
})();
