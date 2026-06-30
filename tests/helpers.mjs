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
export async function installVisualDeterminism(page) {
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
    const isNoise = NOISE_HOSTS.some((pattern) => pattern.test(host));
    const isAnimationLib = /(^|\.)jsdelivr\.net$/.test(host) && pathname.endsWith('.js');
    if (isNoise || isAnimationLib) {
      return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
    }
    return route.continue();
  });

  await page.addInitScript(() => {
    try {
      localStorage.setItem('dfx-lang', 'de');
    } catch {
      /* storage unavailable */
    }
    try {
      sessionStorage.setItem('dfx-ai-popup-seen', '1');
    } catch {
      /* storage unavailable */
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
  });
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
