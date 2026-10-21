// Shared helpers for the Playwright suite. Filename has no `spec`/`test` suffix
// so Playwright does not pick it up as a test file.

// Third-party widgets/iframes whose content is non-deterministic (live Trustpilot
// reviews, Google Maps tiles, YouTube embeds). They are fulfilled with an empty
// 200 so they neither render variable pixels nor produce an error page. First
// party assets and the deterministic CDN libs (jQuery, Webflow) are left intact.
const NOISE_HOSTS = [
  /(^|\.)trustpilot\.com$/,
  /(^|\.)google\.com$/,
  /(^|\.)gstatic\.com$/,
  /(^|\.)googleapis\.com$/,
  /(^|\.)youtube\.com$/,
  /(^|\.)youtube-nocookie\.com$/,
  /(^|\.)ytimg\.com$/,
];

// Homepage map fixtures. The route matches host and path; query strings are ignored.
const MAP_FILTERS_FIXTURE = {
  activities: ['daily', 'within7Days', 'within30Days', 'olderThan30Days', 'none'],
  countries: ['CH'],
  shopNames: ['SPAR', 'others'],
  techProviders: [
    {
      name: 'DFX.swiss',
      blockchains: ['Bitcoin'],
      assets: ['BTC'],
      pairs: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
    },
    {
      name: '21.gifts',
      blockchains: ['Liquid'],
      assets: ['L-BTC'],
      pairs: [{ blockchain: 'Liquid', asset: 'L-BTC' }],
    },
  ],
};

const MAP_PLACES_FIXTURE = {
  places: [
    {
      id: 'npub1sampleplace000000000000000000000000000000000000000000000000',
      name: 'Sample',
      techProvider: 'DFX.swiss',
      country: 'CH',
      shopName: 'SPAR',
      activity: 'daily',
      lat: 46.8,
      lon: 8.23,
      street: 'Bahnstrasse',
      houseNumber: '1',
      postalCode: '8001',
      city: 'Zurich',
    },
    {
      id: 'npub1giftplace00000000000000000000000000000000000000000000000000',
      name: 'Gift Shop',
      techProvider: '21.gifts',
      country: 'CH',
      shopName: 'others',
      activity: 'daily',
      lat: 47.37,
      lon: 8.54,
      street: 'Other',
      houseNumber: '2',
      postalCode: '8002',
      city: 'Zurich',
    },
  ],
};

export async function blockExternalNoise(page) {
  await page.route('**/*', (route) => {
    let host = '';
    try {
      host = new URL(route.request().url()).hostname;
    } catch {
      return route.continue();
    }
    if (NOISE_HOSTS.some((pattern) => pattern.test(host))) {
      return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
    }
    return route.continue();
  });
}

// Visual-only setup. Runs before any page script. On top of blocking the noisy
// widgets it also blocks the animation libraries' JS (Splide / GSAP from
// jsdelivr) and stands in a chainable no-op for their globals, so their inline
// init runs without throwing and without animating — a JS-driven carousel or
// scroll tween never settles between two screenshots otherwise. It also pins the
// language, suppresses the timed AI popup, and makes IntersectionObserver fire
// once, immediately, for every element so the scroll-reveal and how-it-works
// sequence reach a single stable end state instead of depending on scroll.
export async function installVisualDeterminism(page, { allowAiPopup = false } = {}) {
  // Pin reduced-motion so CSS/JS animations (hero pulses, the BTC Taro
  // auto-play carousel, the how-it-works sequence) settle to a single stable
  // end state instead of being captured mid-frame.
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.route('**/*', (route) => {
    let host = '';
    let pathname = '';
    try {
      const url = new URL(route.request().url());
      host = url.hostname;
      pathname = url.pathname;
    } catch {
      return route.continue();
    }
    if (host.includes('openfreemap')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: '' });
    }
    if (host === 'dev-api.opencryptopay.io' || host === 'api.opencryptopay.io') {
      if (pathname === '/map/filters') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MAP_FILTERS_FIXTURE),
        });
      }
      if (pathname === '/map/places') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MAP_PLACES_FIXTURE),
        });
      }
    }
    const isNoise = NOISE_HOSTS.some((pattern) => pattern.test(host));
    const isAnimationLib = /(^|\.)jsdelivr\.net$/.test(host) && pathname.endsWith('.js');
    if (isNoise || isAnimationLib) {
      return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
    }
    return route.continue();
  });

  await page.addInitScript(
    (opts) => {
      try {
        localStorage.setItem('dfx-lang', 'de');
      } catch {
        /* storage unavailable */
      }
      // The timed AI popup is suppressed by default so it never appears mid-shot;
      // the dedicated ai-popup view opts back in via { allowAiPopup: true }.
      if (!opts.allowAiPopup) {
        try {
          sessionStorage.setItem('dfx-ai-popup-seen', '1');
        } catch {
          /* storage unavailable */
        }
      }

      // Chainable no-op for the (now un-loaded) animation libraries so inline
      // `new Splide(...).mount()` / `gsap.timeline()...` neither throw nor animate.
      const noop = new Proxy(function () {}, {
        get: () => noop,
        apply: () => noop,
        construct: () => noop,
      });
      window.Splide = noop;
      window.gsap = noop;
      window.ScrollTrigger = noop;
      window.MotionPathPlugin = noop;

      class ImmediateIntersectionObserver {
        constructor(callback) {
          this._callback = callback;
        }
        observe(element) {
          this._callback([{ target: element, isIntersecting: true, intersectionRatio: 1 }], this);
        }
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
      window.IntersectionObserver = ImmediateIntersectionObserver;
    },
    { allowAiPopup },
  );
}

// --- interactive-state setups for the visual matrix --------------------------
// Each is run after settle(), just before the screenshot, and waits for the
// resulting state to be in the DOM so the shot is deterministic.

// Open the first FAQ accordion (covers the expanded answer + its links, which
// the default collapsed shot never shows).
export async function openFirstFaq(page) {
  await page.locator('.dfx-dark-page .faq_question').first().click();
  await page.waitForSelector('.dfx-dark-page .faq_accordion.is-open .faq_answer', {
    state: 'visible',
  });
  await page.waitForTimeout(400);
}

// Open the burger / mobile navigation (only meaningful on the narrow viewports).
export async function openNav(page) {
  await page.locator('.dfx-dark-page .menu-button').first().click();
  await page.waitForSelector('.dfx-dark-page .navbar .nav-menu.dk-open', { state: 'visible' });
  await page.waitForTimeout(200);
}

// Wait for the timed AI popup to auto-appear (requires installVisualDeterminism
// with { allowAiPopup: true }; it fires ~5s after DOMContentLoaded). The popup is
// translucent + backdrop-blurred and sits over the autoplaying hero <video>, so
// hide that video before the element shot — otherwise this would be the one
// screenshot that composites a (non-deterministic) video frame with no mask.
export async function showAiPopup(page) {
  await page.waitForSelector('.dk-ai-popup.is-visible', { state: 'visible', timeout: 15_000 });
  await page.evaluate(() => {
    document
      .querySelectorAll('.dk-hero__video, .dk-hero__video video')
      .forEach((el) => (el.style.visibility = 'hidden'));
  });
  await page.waitForTimeout(300);
}

// Waits until the page has reached a stable visual state: media paused, every
// reveal element shown, lazy images eagerly loaded, fonts ready, translations
// applied (i18n un-hides the page), and the how-it-works timers (~2.1s) elapsed.
export async function settle(page) {
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach((video) => {
      try {
        video.pause();
        video.currentTime = 0;
      } catch {
        /* not seekable */
      }
    });
    document
      .querySelectorAll('.dk-reveal, .sa-reveal')
      .forEach((element) => element.classList.add('is-visible'));
    document
      .querySelectorAll('img[loading="lazy"]')
      .forEach((image) => image.setAttribute('loading', 'eager'));
  });

  // Scroll the full height once to force any remaining lazy assets to load.
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 200));
    window.scrollTo(0, 0);
  });

  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).visibility !== 'hidden',
  );
  await page.waitForTimeout(2500);
}
