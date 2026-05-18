(function () {
  'use strict';

  var VERSION = '2.0.0';
  var EVENTS_KEY = 'dfx_ct_events_v1';
  var SESSION_KEY = 'dfx_ct_session_v1';
  var VISITOR_KEY = 'dfx_ct_visitor_v1';
  var ATTR_KEY = 'dfx-sea-attribution';
  var DEAD_KEY = 'dfx_ct_beacon_dead';
  var DEAD_UNTIL_KEY = 'dfx_ct_beacon_dead_until';
  var MAX_EVENTS = 2500;
  var SESSION_TIMEOUT = 30 * 60 * 1000;
  var BEACON_ENDPOINT = '/api/track';
  var BEACON_RETRY_COOLDOWN = 5 * 60 * 1000;
  var START_TIME = Date.now();
  var seq = 0;
  var pageVisibleAt = Date.now();
  var engagedMs = 0;
  var maxScroll = 0;
  var scrollMarks = { 25: false, 50: false, 75: false, 90: false, 100: false };
  var lastActivityAt = Date.now();
  var rageClicks = [];
  var storedWebVitals = { cls: 0 };

  function nowIso() {
    return new Date().toISOString();
  }

  function safeGet(storage, key) {
    try { return storage.getItem(key); } catch (e) { return null; }
  }

  function safeSet(storage, key, value) {
    try { storage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function safeRemove(storage, key) {
    try { storage.removeItem(key); } catch (e) {}
  }

  function parseJson(value, fallback) {
    if (!value) return fallback;
    try { return JSON.parse(value); } catch (e) { return fallback; }
  }

  function randomId(prefix) {
    var id = '';
    if (window.crypto && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = String(Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
    }
    return prefix + '_' + id.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function clean(value, limit) {
    if (value === undefined || value === null) return '';
    return String(value).replace(/\s+/g, ' ').replace(/[<>]/g, '').trim().slice(0, limit || 240);
  }

  function pathOnly(url) {
    try {
      var parsed = new URL(url, window.location.href);
      return parsed.pathname + parsed.search;
    } catch (e) {
      return clean(url, 240);
    }
  }

  function readAttribution() {
    var current = {};
    var params = new URLSearchParams(window.location.search);
    [
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
    ].forEach(function (key) {
      var value = clean(params.get(key), 180);
      if (value) current[key] = value;
    });

    if (Object.keys(current).length) return current;
    return parseJson(safeGet(sessionStorage, ATTR_KEY) || safeGet(localStorage, ATTR_KEY), {}) || {};
  }

  function readConsent() {
    var stored = safeGet(localStorage, 'dfx-cookies-accepted');
    if (stored === 'true') return 'accepted';
    if (stored === 'declined') return 'declined';
    return 'unknown';
  }

  function storageAllowed() {
    return readConsent() !== 'declined';
  }

  function remoteAllowed() {
    var deadUntil = Number(safeGet(localStorage, DEAD_UNTIL_KEY) || 0);
    return readConsent() !== 'declined' && Date.now() > deadUntil;
  }

  function getVisitorId() {
    var existing = safeGet(localStorage, VISITOR_KEY);
    if (existing) return existing;
    var id = randomId('v');
    safeSet(localStorage, VISITOR_KEY, id);
    return id;
  }

  function getSession() {
    var raw = safeGet(sessionStorage, SESSION_KEY) || safeGet(localStorage, SESSION_KEY);
    var session = parseJson(raw, null);
    var current = Date.now();

    if (!session || !session.id || !session.lastSeen || current - session.lastSeen > SESSION_TIMEOUT) {
      session = {
        id: randomId('s'),
        startedAt: nowIso(),
        firstPath: window.location.pathname + window.location.search,
        landingReferrer: clean(document.referrer, 500)
      };
      trackSoon('session_start', {
        firstPath: session.firstPath,
        landingReferrer: session.landingReferrer
      });
    }

    session.lastSeen = current;
    var serialized = JSON.stringify(session);
    safeSet(sessionStorage, SESSION_KEY, serialized);
    safeSet(localStorage, SESSION_KEY, serialized);
    return session;
  }

  function readEvents() {
    var events = parseJson(safeGet(localStorage, EVENTS_KEY), []);
    return Array.isArray(events) ? events : [];
  }

  function writeEvents(events) {
    if (!storageAllowed()) return;
    var trimmed = events.slice(Math.max(0, events.length - MAX_EVENTS));
    if (safeSet(localStorage, EVENTS_KEY, JSON.stringify(trimmed))) return;
    trimmed = trimmed.slice(Math.max(0, trimmed.length - 500));
    safeSet(localStorage, EVENTS_KEY, JSON.stringify(trimmed));
  }

  function baseEvent(type) {
    var session = getSession();
    return {
      schema: 'dfx.analytics.event.v2',
      version: VERSION,
      id: randomId('e'),
      seq: ++seq,
      type: type,
      ts: nowIso(),
      time: Date.now(),
      visitorId: getVisitorId(),
      sessionId: session.id,
      sessionStartedAt: session.startedAt,
      path: window.location.pathname,
      page: window.location.pathname + window.location.search,
      url: window.location.href,
      title: clean(document.title, 180),
      referrer: clean(document.referrer, 500),
      lang: document.documentElement.lang || navigator.language || '',
      consent: readConsent(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio || 1
      },
      screen: {
        width: window.screen ? screen.width : 0,
        height: window.screen ? screen.height : 0
      },
      attribution: readAttribution()
    };
  }

  function sendBeacon(event) {
    if (!remoteAllowed()) return;
    var payload = JSON.stringify(event);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(BEACON_ENDPOINT, new Blob([payload], { type: 'application/json' }))) return;
    } catch (e) {}
    try {
      fetch(BEACON_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        credentials: 'same-origin'
      }).catch(function () {
        safeSet(localStorage, DEAD_KEY, '1');
        safeSet(localStorage, DEAD_UNTIL_KEY, String(Date.now() + BEACON_RETRY_COOLDOWN));
      });
    } catch (e) {
      safeSet(localStorage, DEAD_KEY, '1');
      safeSet(localStorage, DEAD_UNTIL_KEY, String(Date.now() + BEACON_RETRY_COOLDOWN));
    }
  }

  function track(type, properties) {
    if (!type) return null;
    var event = baseEvent(clean(type, 80));
    event.properties = properties || {};
    event.engagedMs = Math.round(engagedMs);
    event.maxScroll = Math.round(maxScroll);

    if (storageAllowed()) {
      var events = readEvents();
      events.push(event);
      writeEvents(events);
    }

    sendBeacon(event);

    try {
      window.dispatchEvent(new CustomEvent('dfx:analytics', { detail: event }));
    } catch (e) {}

    return event;
  }

  function trackSoon(type, properties) {
    setTimeout(function () { track(type, properties); }, 0);
  }

  function elementLabel(element) {
    if (!element) return '';
    return clean(
      element.getAttribute('data-analytics-label') ||
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.innerText ||
      element.textContent ||
      element.id ||
      element.className ||
      element.tagName,
      180
    );
  }

  function elementMeta(element) {
    if (!element) return {};
    var anchor = element.closest ? element.closest('a[href]') : null;
    var button = element.closest ? element.closest('button, [role="button"], input[type="submit"], input[type="button"]') : null;
    var target = anchor || button || element;
    var href = anchor ? anchor.href : '';
    var url = null;
    try { url = href ? new URL(href, window.location.href) : null; } catch (e) {}

    return {
      tag: clean(target.tagName || '', 20).toLowerCase(),
      id: clean(target.id, 80),
      classes: clean(target.className, 160),
      label: elementLabel(target),
      href: href ? clean(href, 500) : '',
      targetPath: href ? pathOnly(href) : '',
      outbound: Boolean(url && url.origin !== window.location.origin && url.protocol.indexOf('http') === 0),
      download: Boolean(anchor && anchor.hasAttribute('download')),
      conversion: clean(target.getAttribute('data-sea-conversion') || conversionName(url, target), 80),
      section: nearestSection(target)
    };
  }

  function nearestSection(element) {
    var node = element;
    while (node && node !== document.body) {
      if (node.id) return clean('#' + node.id, 100);
      var label = node.getAttribute && (node.getAttribute('data-section') || node.getAttribute('aria-label'));
      if (label) return clean(label, 100);
      node = node.parentElement;
    }
    return '';
  }

  function conversionName(url, element) {
    if (!url) return '';
    if (url.protocol === 'mailto:') return 'email';
    if (url.hostname === 'app.dfx.swiss') return 'app';
    if (url.hostname === 'docs.dfx.swiss') return 'docs';
    if (url.hostname.indexOf('dfx.swiss') !== -1 && /\/(buy|sell|swap|app)/.test(url.pathname)) return 'trade';
    if (element && /start|buy|sell|swap|get|app|wallet|contact|support/i.test(elementLabel(element))) return 'cta';
    return '';
  }

  function bindClicks() {
    document.addEventListener('click', function (event) {
      lastActivityAt = Date.now();
      var target = event.target && event.target.closest ? event.target.closest('a, button, [role="button"], input, select, textarea, [data-analytics-label]') : null;
      if (!target) return;

      var meta = elementMeta(target);
      var type = 'click';
      if (meta.conversion) type = 'conversion_click';
      else if (meta.outbound) type = 'outbound_click';
      else if (meta.download) type = 'download_click';
      else if (meta.href && meta.href.indexOf('#') > -1) type = 'anchor_click';

      track(type, meta);
      detectRageClick(event, meta);
    }, true);
  }

  function detectRageClick(event, meta) {
    var current = Date.now();
    rageClicks = rageClicks.filter(function (item) { return current - item.time < 1500; });
    rageClicks.push({ time: current, x: event.clientX, y: event.clientY });
    if (rageClicks.length < 4) return;

    var first = rageClicks[0];
    var close = rageClicks.every(function (item) {
      return Math.abs(item.x - first.x) < 40 && Math.abs(item.y - first.y) < 40;
    });
    if (close) {
      track('rage_click', meta);
      rageClicks = [];
    }
  }

  function bindForms() {
    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') return;
      track('form_submit', {
        id: clean(form.id, 80),
        name: clean(form.getAttribute('name'), 80),
        action: clean(form.getAttribute('action') || window.location.href, 500),
        method: clean(form.getAttribute('method') || 'get', 20).toLowerCase(),
        fields: Array.prototype.slice.call(form.elements || []).map(function (field) {
          return clean(field.name || field.id || field.type || field.tagName, 80);
        }).filter(Boolean).slice(0, 40)
      });
    }, true);
  }

  function bindScroll() {
    var ticking = false;
    window.addEventListener('scroll', function () {
      lastActivityAt = Date.now();
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var doc = document.documentElement;
        var body = document.body;
        var height = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          doc.clientHeight,
          doc.scrollHeight,
          doc.offsetHeight
        ) - window.innerHeight;
        var pct = height > 0 ? Math.min(100, Math.max(0, window.scrollY / height * 100)) : 100;
        maxScroll = Math.max(maxScroll, pct);
        Object.keys(scrollMarks).forEach(function (mark) {
          var threshold = Number(mark);
          if (!scrollMarks[mark] && pct >= threshold) {
            scrollMarks[mark] = true;
            track('scroll_depth', { depth: threshold });
          }
        });
      });
    }, { passive: true });
  }

  function bindEngagement() {
    function tick() {
      var current = Date.now();
      if (!document.hidden && current - lastActivityAt < 30000) {
        engagedMs += current - pageVisibleAt;
      }
      pageVisibleAt = current;
    }

    setInterval(tick, 5000);
    document.addEventListener('visibilitychange', function () {
      tick();
      track(document.hidden ? 'page_hidden' : 'page_visible', {
        engagedMs: Math.round(engagedMs),
        maxScroll: Math.round(maxScroll)
      });
    });
    window.addEventListener('beforeunload', function () {
      tick();
      track('page_exit', {
        engagedMs: Math.round(engagedMs),
        maxScroll: Math.round(maxScroll),
        durationMs: Date.now() - START_TIME
      });
    });
  }

  function bindErrors() {
    window.addEventListener('error', function (event) {
      var target = event.target;
      if (target && target !== window && (target.src || target.href)) {
        track('asset_error', {
          tag: clean(target.tagName, 20).toLowerCase(),
          source: clean(target.src || target.href, 500)
        });
        return;
      }
      track('js_error', {
        message: clean(event.message, 300),
        filename: clean(event.filename, 300),
        line: event.lineno || 0,
        column: event.colno || 0
      });
    }, true);

    window.addEventListener('unhandledrejection', function (event) {
      track('promise_rejection', {
        reason: clean(event.reason && (event.reason.message || event.reason), 300)
      });
    });
  }

  function bindPerformance() {
    window.addEventListener('load', function () {
      setTimeout(function () {
        var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        if (nav) {
          track('performance_navigation', {
            dnsMs: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            connectMs: Math.round(nav.connectEnd - nav.connectStart),
            ttfbMs: Math.round(nav.responseStart - nav.requestStart),
            domReadyMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            loadMs: Math.round(nav.loadEventEnd - nav.startTime),
            transferSize: nav.transferSize || 0
          });
        }

        var paint = {};
        if (performance.getEntriesByType) {
          performance.getEntriesByType('paint').forEach(function (entry) {
            paint[entry.name.replace(/-/g, '_') + 'Ms'] = Math.round(entry.startTime);
          });
        }
        if (Object.keys(paint).length) track('performance_paint', paint);
      }, 0);
    });

    if (!('PerformanceObserver' in window)) return;

    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          track('web_vital_lcp', {
            valueMs: Math.round(entry.startTime),
            element: clean(entry.element && elementLabel(entry.element), 120)
          });
        });
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}

    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          if (entry.hadRecentInput) return;
          storedWebVitals.cls += entry.value;
          track('web_vital_cls', { value: Number(storedWebVitals.cls.toFixed(4)) });
        });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}

    try {
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          track('web_vital_inp', {
            valueMs: Math.round(entry.duration || 0),
            interactionId: entry.interactionId || 0,
            name: clean(entry.name, 80)
          });
        });
      }).observe({ type: 'event', buffered: true, durationThreshold: 120 });
    } catch (e) {}
  }

  function bindCopyAndSelection() {
    document.addEventListener('copy', function () {
      track('copy', {
        selectionLength: clean(String(window.getSelection ? window.getSelection().toString().length : 0), 20)
      });
    });
  }

  function bindSeaClicks() {
    window.addEventListener('dfx:sea-click', function (event) {
      track('sea_conversion', event.detail || {});
    });
  }

  function init() {
    if (window.DFX_CT && window.DFX_CT.version) return;

    window.DFX_CT = {
      version: VERSION,
      track: track,
      events: readEvents,
      clear: function () {
        safeRemove(localStorage, EVENTS_KEY);
        safeRemove(localStorage, SESSION_KEY);
        safeRemove(sessionStorage, SESSION_KEY);
      },
      consent: readConsent
    };

    bindClicks();
    bindForms();
    bindScroll();
    bindEngagement();
    bindErrors();
    bindPerformance();
    bindCopyAndSelection();
    bindSeaClicks();

    track('page_view', {
      firstPath: window.location.pathname + window.location.search,
      hash: clean(window.location.hash, 120),
      userAgentFamily: /Chrome/.test(navigator.userAgent) ? 'Chrome' : /Safari/.test(navigator.userAgent) ? 'Safari' : /Firefox/.test(navigator.userAgent) ? 'Firefox' : 'Other'
    });
    track('consent_state', { state: readConsent() });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
