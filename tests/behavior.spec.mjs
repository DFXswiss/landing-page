import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { VISUAL_FIXED_TIME, blockExternalNoise, openNav } from './helpers.mjs';

const en = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url), 'utf8'));
const de = JSON.parse(readFileSync(new URL('../i18n/de.json', import.meta.url), 'utf8'));

const visibilityRestored = () => getComputedStyle(document.documentElement).visibility !== 'hidden';

const outagePopupDialog = (page) => page.locator('.outage-popup__dialog');

const SECURITY_POST_URL = 'https://x.com/dfx_swiss/status/2122956475865677875';
const SECURITY_TITLE_DE = 'DFX Sicherheitsupdate – Wichtiger Hinweis';
const SECURITY_TITLE_EN = 'DFX Security Update – Important Notice';
const SECURITY_WARNING_DE =
  'Bitte sende bis auf Weiteres keine Kryptowährungen an DFX-Einzahlungsadressen.';
const SECURITY_WARNING_EN =
  'Please do not send any cryptocurrency to DFX deposit addresses until further notice.';
const RESTART_DE =
  'Wir planen, den DFX-Service am Donnerstag, 19. November 2026, um 09:00 Uhr MEZ wieder in Betrieb zu nehmen.';
const RESTART_EN = 'We plan to resume the DFX service on Thursday, 19 November 2026, at 09:00 CET.';
const POPUP_SUPPORT_DE = 'Du kannst dich jederzeit per E-Mail an support@dfx.swiss wenden.';
const POPUP_SUPPORT_EN = 'You can contact us at any time at support@dfx.swiss.';
const INCIDENT_SUPPORT_DE = 'Kunden können sich jederzeit per E-Mail an support@dfx.swiss wenden.';
const INCIDENT_SUPPORT_EN = 'Customers can contact us at any time at support@dfx.swiss.';
const SUPPORT_HREF = 'mailto:support@dfx.swiss';

const SHOP_FILTERS = {
  activities: ['daily', 'within7Days', 'within30Days', 'olderThan30Days', 'none'],
  shopNames: ['SPAR'],
  techProviders: [
    {
      name: 'DFX.swiss',
      blockchains: ['Bitcoin'],
      assets: ['BTC'],
      pairs: [{ blockchain: 'Bitcoin', asset: 'BTC' }],
    },
  ],
};

const SHOP_PLACES = {
  places: [
    {
      id: 'npub1sampleplace000000000000000000000000000000000000000000000000',
      name: 'Sample',
      shopName: 'SPAR',
      activity: 'daily',
      country: 'CH',
      lat: 46.8,
      lon: 8.23,
      street: 'Bahnstrasse',
      houseNumber: '1',
      postalCode: '8001',
      city: 'Zurich',
      techProvider: 'DFX.swiss',
    },
    {
      id: 'npub1idleplace00000000000000000000000000000000000000000000000000',
      name: 'Idle Shop',
      shopName: 'SPAR',
      activity: 'olderThan30Days',
      country: 'CH',
      lat: 47.1,
      lon: 8.5,
      street: 'Nebenstrasse',
      houseNumber: '3',
      postalCode: '8003',
      city: 'Zurich',
      techProvider: 'DFX.swiss',
    },
  ],
};

const MAPLIBRE_JS = '/maplibre-gl@5.6.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS = '/maplibre-gl@5.6.1/dist/maplibre-gl.css';

const MAPLIBRE_STUB = [
  'window.maplibregl = {',
  '  Map: function () {',
  '    return {',
  '      addControl: function () {},',
  '      resize: function () {},',
  '      setCenter: function () {},',
  '      setZoom: function () {},',
  '      fitBounds: function () {},',
  '      remove: function () {},',
  '    };',
  '  },',
  '  NavigationControl: function () {},',
  '  Popup: function () {',
  '    this.setDOMContent = function () {',
  '      return this;',
  '    };',
  '  },',
  '  Marker: function () {',
  '    this.setLngLat = function () {',
  '      return this;',
  '    };',
  '    this.setPopup = function () {',
  '      return this;',
  '    };',
  '    this.addTo = function () {',
  '      return this;',
  '    };',
  '    this.remove = function () {};',
  '    this.getLngLat = function () {',
  '      return { lng: 0, lat: 0 };',
  '    };',
  '  },',
  '  LngLatBounds: function () {',
  '    this.extend = function () {};',
  '  },',
  '};',
].join('\n');

function isDevApiPath(url, pathname) {
  return url.hostname === 'dev-api.opencryptopay.io' && url.pathname === pathname;
}

function isUnpkgPath(url, pathname) {
  return url.hostname === 'unpkg.com' && url.pathname === pathname;
}

function fulfill(route, status, contentType, body) {
  return route.fulfill({
    status: status,
    contentType: contentType,
    body: body,
  });
}

async function stubShopMap(page) {
  await page.route(
    (url) => isDevApiPath(url, '/map/filters'),
    (route) => fulfill(route, 200, 'application/json', JSON.stringify(SHOP_FILTERS)),
  );
  await page.route(
    (url) => isDevApiPath(url, '/map/places'),
    (route) => fulfill(route, 200, 'application/json', JSON.stringify(SHOP_PLACES)),
  );
  await page.route(
    (url) => isUnpkgPath(url, MAPLIBRE_JS),
    (route) => fulfill(route, 200, 'text/javascript', MAPLIBRE_STUB),
  );
  await page.route(
    (url) => isUnpkgPath(url, MAPLIBRE_CSS),
    (route) => fulfill(route, 200, 'text/css', ''),
  );
  await page.route(
    (url) => url.hostname.includes('openfreemap'),
    (route) => fulfill(route, 200, 'text/plain', ''),
  );
}

test.describe('client behavior', () => {
  // The dropdown/menu wiring these checks exercise is desktop-shaped; run them on
  // one project. The visual + smoke suites still cover both viewports.
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-only behavior checks');
    // The outage notice bar depends on the wall clock, so the clock is pinned
    // after its end instant by default to keep the other checks independent of
    // the day the suite runs. This hook runs before every test body, so the
    // outage notice tests' own setFixedTime/install calls come later and win.
    await page.clock.setFixedTime(VISUAL_FIXED_TIME);
    // The security popup covers the home page on every load. Checks that do not
    // care about it get it closed with the close button whenever it blocks an
    // action or an assertion; the popup checks remove this handler again.
    await page.addLocatorHandler(outagePopupDialog(page), async () => {
      await page.locator('.outage-popup__close').click();
    });
    await blockExternalNoise(page);
  });

  test('i18n applies the requested language to content and <html lang>', async ({ page }) => {
    await page.goto('/?lang=en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await page.waitForFunction(visibilityRestored);
    await expect(page.locator('[data-i18n="hero.cta"]').first()).toHaveText(en['hero.cta']);
  });

  test('i18n rewrites app.dfx.swiss links to carry the active language', async ({ page }) => {
    await page.goto('/?lang=fr');
    await page.waitForFunction(visibilityRestored);
    await expect(page.locator('a[href*="app.dfx.swiss"]').first()).toHaveAttribute(
      'href',
      /[?&]lang=fr\b/,
    );
  });

  test('the language switcher navigates with the chosen ?lang=', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(visibilityRestored);
    // The switcher link lives in a dropdown; dispatch the click directly so the
    // test does not depend on the dropdown being open.
    await page.locator('.switcher_link[lang="en"]').first().dispatchEvent('click');
    await page.waitForURL(/[?&]lang=en\b/);
    expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
  });

  test('no analytics/attribution storage is written without a consent layer', async ({ page }) => {
    // The client tracking stack (clicktrack.js / sea-attribution.js) is intentionally
    // not shipped to production until a real consent layer + collector endpoint exist.
    // Guard that no persistent identifier or event log lands in storage on a plain visit.
    await page.goto('/');
    await page.waitForFunction(visibilityRestored);
    const keys = await page.evaluate(() => ({
      events: localStorage.getItem('dfx_ct_events_v1'),
      visitor: localStorage.getItem('dfx_ct_visitor_v1'),
      attribution:
        localStorage.getItem('dfx-sea-attribution') ||
        sessionStorage.getItem('dfx-sea-attribution'),
    }));
    expect(keys.events).toBeNull();
    expect(keys.visitor).toBeNull();
    expect(keys.attribution).toBeNull();
  });

  test.describe('security incident page', () => {
    const attackerAddress = '0x767e21D61C4Bfa67Ffc6AE5E5C1B6F36ab24dA81';
    const sections = (page) => page.locator('.incident-page__section');
    const german = (page) => page.locator('#de');
    const english = (page) => page.locator('#en');
    const jumpLinks = (page) => page.locator('.incident-page__jump a');

    test('shows the German h1, both sections in order, both amounts and the address in each section', async ({
      page,
    }) => {
      await page.goto('/security-incident.html');
      await page.waitForFunction(visibilityRestored);

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText('Sicherheitsvorfall vom 18. November 2026');
      await expect(sections(page)).toHaveCount(2);
      await expect(german(page)).toHaveAttribute('lang', 'de');
      await expect(english(page)).toHaveAttribute('lang', 'en');

      const [first, second] = await sections(page).evaluateAll((nodes) =>
        nodes.map((node) => ({ id: node.id, lang: node.lang })),
      );
      expect(first).toEqual({ id: 'de', lang: 'de' });
      expect(second).toEqual({ id: 'en', lang: 'en' });

      await expect(german(page).locator('code')).toHaveCount(1);
      await expect(german(page).locator('code')).toHaveText(attackerAddress);
      await expect(german(page)).toContainText("40'000 CHF");
      await expect(english(page).locator('code')).toHaveCount(1);
      await expect(english(page).locator('code')).toHaveText(attackerAddress);
      await expect(english(page)).toContainText('CHF 40,000');
      await expect(german(page)).toContainText(RESTART_DE);
      await expect(german(page)).toContainText(INCIDENT_SUPPORT_DE);
      await expect(english(page)).toContainText(RESTART_EN);
      await expect(english(page)).toContainText(INCIDENT_SUPPORT_EN);
      await expect(german(page)).not.toContainText(
        'In den nächsten Stunden schalten wir zuerst den Support wieder ein, danach die Kaufoption und anschliessend die Verkaufsoption.',
      );
      await expect(english(page)).not.toContainText(
        'Over the next few hours we will first switch support back on, then the buy option and after that the sell option.',
      );
      await expect(german(page).locator(`a[href="${SUPPORT_HREF}"]`)).toHaveCount(1);
      await expect(english(page).locator(`a[href="${SUPPORT_HREF}"]`)).toHaveCount(1);

      const color = (locator) => locator.evaluate((node) => getComputedStyle(node).color);
      const supportLinkColor = await color(german(page).locator(`a[href="${SUPPORT_HREF}"]`));
      const jumpLinkColor = await color(jumpLinks(page).filter({ hasText: 'Deutsch' }));
      expect(supportLinkColor).toBe(jumpLinkColor);
      expect(supportLinkColor).not.toBe('rgb(0, 0, 238)');

      await expect(german(page).locator('h1')).toHaveCount(1);
      await expect(german(page).locator('h2')).toHaveCount(6);
      await expect(english(page).locator('h2')).toHaveText('Security incident of 18 November 2026');
      await expect(english(page).locator('h3')).toHaveCount(6);
    });

    test('keeps both language sections visible regardless of the site language', async ({
      page,
    }) => {
      for (const lang of ['de', 'en', 'fr']) {
        await page.goto(`/security-incident.html?lang=${lang}`);
        await page.waitForFunction(visibilityRestored);
        await expect(german(page)).toBeVisible();
        await expect(english(page)).toBeVisible();
        await expect(german(page).locator('h1')).toHaveText(
          'Sicherheitsvorfall vom 18. November 2026',
        );
        await expect(english(page).locator('h2')).toHaveText(
          'Security incident of 18 November 2026',
        );
      }
    });

    test('the jump links scroll to the German and English sections below the fixed navbar', async ({
      page,
    }) => {
      await page.goto('/security-incident.html');
      await page.waitForFunction(visibilityRestored);

      await expect(jumpLinks(page)).toHaveText(['Deutsch', 'English']);
      await expect(jumpLinks(page).first()).toHaveAttribute('href', '#de');
      await expect(jumpLinks(page).nth(1)).toHaveAttribute('href', '#en');

      for (const [name, sectionId] of [
        ['English', 'en'],
        ['Deutsch', 'de'],
      ]) {
        await jumpLinks(page).filter({ hasText: name }).click();
        await expect(page).toHaveURL(new RegExp(`#${sectionId}$`));
        await expect
          .poll(() =>
            page.evaluate((id) => {
              const heading = document.querySelector(`#${id} > :first-child`);
              const navbar = document.querySelector('.navbar');
              return heading.getBoundingClientRect().top - navbar.getBoundingClientRect().bottom;
            }, sectionId),
          )
          .toBeGreaterThanOrEqual(0);
      }
    });

    test('has no security popup, outage bar or outage script', async ({ page }) => {
      await page.goto('/security-incident.html');
      await page.waitForFunction(visibilityRestored);

      await expect(page.locator('.outage-popup')).toHaveCount(0);
      await expect(page.locator('.outage-notice')).toHaveCount(0);
      const scripts = await page
        .locator('script[src]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src')));
      expect(scripts.some((src) => src.includes('outage-notice.js'))).toBe(false);
    });

    test('the homepage popup details link points to the security incident page', async ({
      page,
    }) => {
      await page.removeLocatorHandler(outagePopupDialog(page));
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);

      const details = page.locator('.outage-popup__more', {
        hasText: 'Mehr Infos / More info',
      });
      await expect(details).toHaveAttribute('href', 'security-incident.html');
      await expect(details).not.toHaveAttribute('target');
      await expect(details).toHaveText('Mehr Infos / More info');
    });
  });

  test('at 1100px the desktop login is hidden and the burger is visible; the dark-theme nav panel is visible after open and in-range resize; at 1400px it has no dk-open and the desktop login is visible with a login href and a label', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto('/');
    await page.waitForFunction(visibilityRestored);

    const menuButton = page.locator('.dfx-dark-page .menu-button').first();
    const navPanel = page.locator('.dfx-dark-page .navbar .nav-menu');
    const desktopLogin = page.locator('.nav-button--secondary.hide-tablet');
    await expect(desktopLogin).not.toBeVisible();
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(navPanel).toBeVisible();

    await page.evaluate(() => {
      window.__navResizeSeen = false;
      window.addEventListener('resize', () => {
        window.__navResizeSeen = true;
      });
    });
    await page.setViewportSize({ width: 1050, height: 800 });
    await page.waitForFunction(() => window.__navResizeSeen === true);
    await expect(navPanel).toBeVisible();

    await page.setViewportSize({ width: 1400, height: 800 });
    await expect(navPanel).not.toContainClass('dk-open');
    await expect(desktopLogin).toBeVisible();
    await expect(desktopLogin).toHaveAttribute('href', /app\.dfx\.swiss\/login/);
    await expect(desktopLogin).toHaveText(/\S/);
  });

  test.describe('outage notice bar', () => {
    const notice = (page) => page.locator('.outage-notice');

    test('before the end instant the notice is shown above the navbar in the active language', async ({
      page,
    }) => {
      await page.clock.setFixedTime(new Date('2026-11-19T08:00:00.000+01:00'));
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);

      await expect(notice(page)).toBeVisible();
      await expect(notice(page)).toHaveAttribute('role', 'status');
      await expect(notice(page)).toHaveText(en['notice.outage']);

      // The fixed navbar must sit below the in-flow notice, not cover it.
      await expect
        .poll(async () => {
          const noticeBox = await notice(page).boundingBox();
          const navBox = await page.locator('.navbar').first().boundingBox();
          return navBox.y - (noticeBox.y + noticeBox.height);
        })
        .toBeCloseTo(0, 0);
    });

    test('with the notice shown the open burger panel starts at the navbar bottom and its max-height is reduced by the notice height', async ({
      page,
    }) => {
      await page.clock.setFixedTime(new Date('2026-11-19T08:00:00.000+01:00'));
      await page.setViewportSize({ width: 834, height: 1112 });
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);
      await expect(notice(page)).toBeVisible();

      // The locator handler closes the popup, whose backdrop would otherwise
      // intercept the click on the burger button.
      await openNav(page);

      const navbar = page.locator('.dfx-dark-page .navbar').first();
      const navPanel = page.locator('.dfx-dark-page .navbar .nav-menu');

      // The panel is positioned relative to the navbar (its containing block),
      // so it must not be shifted by the notice offset a second time.
      await expect
        .poll(async () => {
          const navBox = await navbar.boundingBox();
          const panelBox = await navPanel.boundingBox();
          return Math.abs(panelBox.y - (navBox.y + navBox.height));
        })
        .toBeLessThanOrEqual(1);

      // The panel keeps its existing full-viewport min-height, so only its
      // max-height has to shrink by the notice height on top of the 72px navbar.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const panel = document.querySelector('.dfx-dark-page .navbar .nav-menu');
            const noticeEl = document.querySelector('.outage-notice');
            const maxHeight = parseFloat(getComputedStyle(panel).maxHeight);
            const noticeHeight = noticeEl.getBoundingClientRect().height;
            return Math.abs(maxHeight - (window.innerHeight - 72 - noticeHeight));
          }),
        )
        .toBeLessThanOrEqual(1);
    });

    test('a visibilitychange event before the end instant reschedules the timer so the notice hides itself at the end instant', async ({
      page,
    }) => {
      await page.clock.install({ time: new Date('2026-11-19T08:00:00.000+01:00') });
      // The installed clock keeps running in real time; pause it so a slow page
      // load cannot move the time on before the visibility check.
      await page.clock.pauseAt(new Date('2026-11-19T08:00:01.000+01:00'));
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);
      await expect(notice(page)).toBeVisible();

      // setSystemTime moves Date without firing or shifting timers, like a timer
      // that lost time while the device slept: the initial timer is still about
      // an hour away, so only a timer rescheduled by the event can fire in time.
      await page.clock.setSystemTime(new Date('2026-11-19T08:59:59.000+01:00'));
      await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.clock.fastForward(2000);

      await expect(notice(page)).toBeHidden();
      await expect(page.locator('html')).not.toHaveClass(/\bhas-outage-notice\b/);
    });

    for (const [eventName, target] of [
      ['visibilitychange', 'document'],
      ['pageshow', 'window'],
    ]) {
      test(`a ${eventName} event after the end instant hides the notice without waiting for the timer`, async ({
        page,
      }) => {
        await page.clock.setFixedTime(new Date('2026-11-19T08:00:00.000+01:00'));
        await page.goto('/?lang=en');
        await page.waitForFunction(visibilityRestored);
        await expect(notice(page)).toBeVisible();

        // The pending timer still has an hour to go, so only the event can hide
        // the notice here.
        await page.clock.setFixedTime(new Date('2026-11-19T09:00:00.000+01:00'));
        await page.evaluate(
          ([name, targetName]) => {
            const eventTarget = targetName === 'document' ? document : window;
            eventTarget.dispatchEvent(new Event(name));
          },
          [eventName, target],
        );

        await expect(notice(page)).toBeHidden();
        await expect(page.locator('html')).not.toHaveClass(/\bhas-outage-notice\b/);
        await expect
          .poll(async () => {
            const navBox = await page.locator('.navbar').first().boundingBox();
            return Math.abs(navBox.y);
          })
          .toBeLessThanOrEqual(1);
      });
    }

    for (const instant of ['2026-11-19T09:00:00.000+01:00', '2026-11-19T09:00:00.001+01:00']) {
      test(`at/after the end instant (${instant}) the notice stays hidden`, async ({ page }) => {
        await page.clock.setFixedTime(new Date(instant));
        await page.goto('/?lang=en');
        await page.waitForFunction(visibilityRestored);
        await page.waitForFunction(() => window.DfxOutageNotice !== undefined);

        await expect(notice(page)).toHaveText(en['notice.outage']);
        await expect(notice(page)).toBeHidden();
        await expect(page.locator('html')).not.toHaveClass(/\bhas-outage-notice\b/);
      });
    }
  });

  test.describe('security popup', () => {
    // These checks open and close the popup themselves.
    test.beforeEach(async ({ page }) => {
      await page.removeLocatorHandler(outagePopupDialog(page));
    });

    const notice = (page) => page.locator('.outage-notice');
    const popup = (page) => page.locator('.outage-popup');
    const popupSectionDe = (page) => page.locator('.outage-popup__section[lang="de"]');
    const popupSectionEn = (page) => page.locator('.outage-popup__section[lang="en"]');
    const popupTitleDe = (page) => page.locator('#outage-popup-title-de');
    const popupTitleEn = (page) => page.locator('#outage-popup-title-en');
    const popupImportantDe = (page) =>
      popupSectionDe(page).locator('.outage-popup__text--important');
    const popupImportantEn = (page) =>
      popupSectionEn(page).locator('.outage-popup__text--important');
    const popupMore = (page) => page.locator('.outage-popup__more');
    const popupSource = (page) =>
      page.locator('.outage-popup__source a[href^="https://x.com/dfx_swiss/status/"]');
    const popupClose = (page) => page.locator('.outage-popup__close');
    const popupTextDe = (page) => popupSectionDe(page).locator('.outage-popup__text');
    const popupTextEn = (page) => popupSectionEn(page).locator('.outage-popup__text');
    const popupMailtoDe = (page) => popupSectionDe(page).locator(`a[href="${SUPPORT_HREF}"]`);
    const popupMailtoEn = (page) => popupSectionEn(page).locator(`a[href="${SUPPORT_HREF}"]`);

    for (const [instant, barVisible] of [
      ['2026-11-19T08:00:00.000+01:00', true],
      ['2026-11-19T10:00:00.000+01:00', false],
    ]) {
      test(`at ${instant} the popup shows the security notice with the dialog box focused and the bar is ${barVisible ? 'visible' : 'hidden'}`, async ({
        page,
      }) => {
        await page.clock.setFixedTime(new Date(instant));
        await page.goto('/?lang=en');
        await page.waitForFunction(visibilityRestored);

        await expect(popup(page)).toBeVisible();
        await expect(outagePopupDialog(page)).toHaveAttribute(
          'aria-labelledby',
          'outage-popup-title-de outage-popup-title-en',
        );
        await expect(page.getByRole('dialog', { name: SECURITY_TITLE_DE })).toBeVisible();
        await expect(page.getByRole('dialog', { name: SECURITY_TITLE_EN })).toBeVisible();
        await expect(popupTitleDe(page)).toHaveText(SECURITY_TITLE_DE);
        await expect(popupTitleEn(page)).toHaveText(SECURITY_TITLE_EN);
        await expect(popupImportantDe(page)).toContainText(SECURITY_WARNING_DE);
        await expect(popupImportantEn(page)).toContainText(SECURITY_WARNING_EN);
        await expect(popupTextDe(page)).toHaveCount(8);
        await expect(popupTextEn(page)).toHaveCount(8);
        await expect(popupTextDe(page).nth(5)).toHaveText(RESTART_DE);
        await expect(popupTextDe(page).nth(6)).toHaveText(POPUP_SUPPORT_DE);
        await expect(popupTextEn(page).nth(5)).toHaveText(RESTART_EN);
        await expect(popupTextEn(page).nth(6)).toHaveText(POPUP_SUPPORT_EN);
        await expect(popupMailtoDe(page)).toHaveCount(1);
        await expect(popupMailtoDe(page)).toHaveText('support@dfx.swiss');
        await expect(popupMailtoEn(page)).toHaveCount(1);
        await expect(popupMailtoEn(page)).toHaveText('support@dfx.swiss');
        await expect(popupMore(page)).toHaveText('Mehr Infos / More info');
        await expect(popupMore(page)).toHaveCount(1);
        await expect(popupMore(page)).toHaveAttribute('href', 'security-incident.html');
        await expect(popupMore(page)).not.toHaveAttribute('target');
        await expect(popupSource(page)).toHaveText('DFX on X');
        await expect(popupSource(page)).toHaveAttribute('href', SECURITY_POST_URL);
        await expect(popupSource(page)).toHaveAttribute('target', '_blank');
        await expect(popupSource(page)).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(popupClose(page)).toHaveAccessibleName('Schliessen / Close');
        await expect(outagePopupDialog(page).locator('a')).toHaveCount(4);
        await expect(outagePopupDialog(page)).toBeFocused();
        if (barVisible) {
          await expect(notice(page)).toBeVisible();
        } else {
          await expect(notice(page)).toBeHidden();
        }
      });
    }

    test('the notice bar and popup dialog use DFX blue with white text', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-11-19T08:00:00.000+01:00'));
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);

      await expect(notice(page)).toBeVisible();
      await expect(notice(page)).toHaveCSS('background-color', 'rgb(18, 67, 112)');
      await expect(notice(page)).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(outagePopupDialog(page)).toHaveCSS('background-color', 'rgb(18, 67, 112)');
      await expect(outagePopupDialog(page)).toHaveCSS('color', 'rgb(255, 255, 255)');
    });

    test('the popup shows the same German and English text for ?lang=de, ?lang=en and ?lang=fr', async ({
      page,
    }) => {
      const texts = [];
      for (const lang of ['de', 'en', 'fr']) {
        await page.goto(`/?lang=${lang}`);
        await page.waitForFunction(visibilityRestored);
        expect((await outagePopupDialog(page).getAttribute('lang')) ?? '').toBe('');
        await expect(popupSectionDe(page)).toHaveAttribute('lang', 'de');
        await expect(popupSectionEn(page)).toHaveAttribute('lang', 'en');
        await expect(popupTitleDe(page)).toHaveText(SECURITY_TITLE_DE);
        await expect(popupTitleEn(page)).toHaveText(SECURITY_TITLE_EN);
        await expect(popupImportantDe(page)).toContainText(SECURITY_WARNING_DE);
        await expect(popupImportantEn(page)).toContainText(SECURITY_WARNING_EN);
        texts.push(await outagePopupDialog(page).textContent());
      }
      expect(texts[0]).toBe(texts[1]);
      expect(texts[1]).toBe(texts[2]);
    });

    test('at 1440x900 the popup shows the sections side by side, fully inside the viewport and centred horizontally', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);
      await expect(popup(page)).toBeVisible();

      const deBox = await popupSectionDe(page).boundingBox();
      const enBox = await popupSectionEn(page).boundingBox();
      expect(deBox.x + deBox.width).toBeLessThanOrEqual(enBox.x);

      // The backdrop is position: fixed with inset: 0, so it spans the viewport
      // without its scrollbars (clientWidth/clientHeight).
      const placement = await outagePopupDialog(page).evaluate((dialog) => {
        const box = dialog.getBoundingClientRect();
        const viewport = document.documentElement;
        return {
          centreOffset: Math.abs(box.left + box.width / 2 - viewport.clientWidth / 2),
          inside:
            box.left >= 0 &&
            box.top >= 0 &&
            box.right <= viewport.clientWidth &&
            box.bottom <= viewport.clientHeight,
        };
      });
      expect(placement.centreOffset).toBeLessThanOrEqual(2);
      expect(placement.inside).toBe(true);
    });

    test('at 320x568 the popup box fits the viewport and the more-info button can be scrolled into view', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);
      await expect(popup(page)).toBeVisible();

      const box = await outagePopupDialog(page).boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(568);

      await popupMore(page).scrollIntoViewIfNeeded();
      await expect(popupMore(page)).toBeInViewport();
      await popupClose(page).click();

      await expect(popup(page)).toBeHidden();
    });

    test('at 320x568 the popup stacks German above English and opens at its beginning with the German heading in view', async ({
      page,
    }) => {
      await page.clock.setFixedTime(new Date('2026-11-19T08:00:00.000+01:00'));
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);
      await expect(popup(page)).toBeVisible();
      await expect(outagePopupDialog(page)).toBeFocused();

      // Focusing must not scroll the box towards the more-info button at its end.
      expect(await outagePopupDialog(page).evaluate((dialog) => dialog.scrollTop)).toBe(0);

      const deBox = await popupSectionDe(page).boundingBox();
      const enBox = await popupSectionEn(page).boundingBox();
      expect(deBox.y + deBox.height).toBeLessThanOrEqual(enBox.y);

      const titleDeBox = await popupTitleDe(page).boundingBox();
      expect(titleDeBox.y).toBeGreaterThanOrEqual(0);
      expect(titleDeBox.y + titleDeBox.height).toBeLessThanOrEqual(568);

      await popupClose(page).scrollIntoViewIfNeeded();
      await expect(popupClose(page)).toBeInViewport();
      await popupClose(page).click();

      await expect(popup(page)).toBeHidden();
    });

    for (const [trigger, close] of [
      [
        'a click on the Schliessen / Close button',
        async (page) => {
          await expect(popupClose(page)).toHaveAccessibleName('Schliessen / Close');
          await popupClose(page).click();
        },
      ],
      [
        'a click on the backdrop outside the dialog box',
        (page) => popup(page).click({ position: { x: 5, y: 5 } }),
      ],
      ['the Escape key', (page) => page.keyboard.press('Escape')],
    ]) {
      test(`${trigger} closes the popup for this page load, the bar stays visible and a reload shows it again`, async ({
        page,
      }) => {
        await page.clock.setFixedTime(new Date('2026-11-19T08:00:00.000+01:00'));
        await page.goto('/?lang=en');
        await page.waitForFunction(visibilityRestored);
        await expect(popup(page)).toBeVisible();
        await expect(outagePopupDialog(page)).toBeFocused();

        await close(page);

        await expect(popup(page)).toBeHidden();
        await expect(notice(page)).toBeVisible();

        // A re-check of the bar's time rule must not bring the closed popup back.
        await page.evaluate(() => {
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('pageshow'));
        });
        await expect(popup(page)).toBeHidden();
        await expect(notice(page)).toBeVisible();

        // Nothing is stored: the next page load shows the popup again.
        await page.reload();
        await page.waitForFunction(visibilityRestored);
        await expect(popup(page)).toBeVisible();
      });
    }

    test('the more-info button sits below both language sections and navigates to the incident page', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);
      await expect(popup(page)).toBeVisible();

      const deBox = await popupSectionDe(page).boundingBox();
      const enBox = await popupSectionEn(page).boundingBox();
      const moreBox = await popupMore(page).boundingBox();
      expect(deBox.y + deBox.height).toBeLessThanOrEqual(moreBox.y);
      expect(enBox.y + enBox.height).toBeLessThanOrEqual(moreBox.y);

      await popupMore(page).click();
      await expect(page).toHaveURL(/security-incident(?:\.html)?$/);
    });

    test('in a tab opened before the end instant the bar hides itself at the end instant, the navbar returns to the top and the open popup stays open', async ({
      page,
    }) => {
      await page.clock.install({ time: new Date('2026-11-19T08:59:59.000+01:00') });
      // The installed clock keeps running in real time; pause it so a slow page
      // load cannot reach the end instant before the visibility check.
      await page.clock.pauseAt(new Date('2026-11-19T08:59:59.500+01:00'));
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);
      await expect(notice(page)).toBeVisible();
      await expect(popup(page)).toBeVisible();

      await page.clock.fastForward(2000);

      await expect(notice(page)).toBeHidden();
      await expect(page.locator('html')).not.toHaveClass(/\bhas-outage-notice\b/);
      await expect
        .poll(async () => {
          const navBox = await page.locator('.navbar').first().boundingBox();
          return Math.abs(navBox.y);
        })
        .toBeLessThanOrEqual(1);
      await expect(popup(page)).toBeVisible();
      await expect(outagePopupDialog(page)).toBeFocused();
    });
  });

  test.describe('shop map', () => {
    test.use({ locale: 'de-DE' });

    test('the shop map lists DFX places, switches to the table, filters daily activity, and downloads stores.csv', async ({
      page,
    }) => {
      await stubShopMap(page);
      await page.goto('/');

      const status = page.locator('#dfx-places-status');
      const table = page.locator('#dfx-places-table');
      await expect(table).toContainText('Sample');
      await expect(status).toBeHidden();

      const filters = page.locator('.dfx-places-map-filters');
      const mapButton = filters.getByRole('button', { name: de['map.view_map'], exact: true });
      const tableButton = filters.getByRole('button', { name: de['map.view_table'], exact: true });
      await expect(mapButton).toHaveText(de['map.view_map']);
      await expect(mapButton).toHaveAttribute('aria-pressed', 'true');
      await expect(tableButton).toHaveText(de['map.view_table']);

      await tableButton.click();
      await expect(page.locator('#dfx-places-table-wrap')).toBeVisible();
      await expect(page.locator('#dfx-places-map-wrap')).toBeHidden();
      await expect(table).toContainText('Sample');
      await expect(table).not.toContainText('Gift Shop');
      await expect(table).toContainText('Idle Shop');
      await expect(table).toContainText(de['map.activity_idle']);

      const activity = filters.locator('.dfx-places-symbol-filter').filter({
        has: page.locator('.dfx-places-tech-provider-label', {
          hasText: new RegExp(`^${de['map.filter_activity']}$`),
        }),
      });
      await expect(activity.locator('.dfx-places-tech-provider-label')).toHaveText(
        de['map.filter_activity'],
      );
      await activity.locator('button.dfx-places-symbol-filter-value').click();
      const dailyOption = activity.locator('[role="option"]', {
        hasText: new RegExp(`^${de['map.activity_daily']}$`),
      });
      await expect(dailyOption).toBeVisible();
      await expect(dailyOption).toHaveText(de['map.activity_daily']);
      await dailyOption.click();
      await expect(table).toContainText('Sample');
      await expect(table).toContainText(de['map.activity_daily']);
      await expect(table).not.toContainText('Idle Shop');

      const csvButton = page.locator('#dfx-places-table-wrap .dfx-places-stores-csv');
      await expect(csvButton).toHaveText(de['map.csv']);
      const downloadPromise = page.waitForEvent('download');
      await csvButton.click();
      expect((await downloadPromise).suggestedFilename()).toBe('stores.csv');
    });

    test('a failed places response shows the load error and removes the filters', async ({
      page,
    }) => {
      await stubShopMap(page);
      await page.route(
        (url) => isDevApiPath(url, '/map/places'),
        (route) => fulfill(route, 500, 'application/json', ''),
      );
      await page.goto('/');
      await expect(page.locator('#dfx-places-status')).toHaveText(de['map.load_error']);
      await expect(page.locator('.dfx-places-map-filters')).toHaveCount(0);
    });

    test('a places payload without a places array shows the load error', async ({ page }) => {
      await stubShopMap(page);
      await page.route(
        (url) => isDevApiPath(url, '/map/places'),
        (route) => fulfill(route, 200, 'application/json', '{}'),
      );
      await page.goto('/');
      const status = page.locator('#dfx-places-status');
      await expect(status).toHaveText(de['map.load_error']);
      await expect(status).not.toHaveText(de['map.empty']);
    });

    test('an empty places list shows the empty state and no table rows', async ({ page }) => {
      await stubShopMap(page);
      await page.route(
        (url) => isDevApiPath(url, '/map/places'),
        (route) => fulfill(route, 200, 'application/json', '{"places":[]}'),
      );
      await page.goto('/');
      await expect(page.locator('#dfx-places-status')).toHaveText(de['map.empty']);
      await expect(page.locator('#dfx-places-table tbody tr')).toHaveCount(0);
    });

    test('a failed filters response shows the load error and does not list shops', async ({
      page,
    }) => {
      await stubShopMap(page);
      await page.route(
        (url) => isDevApiPath(url, '/map/filters'),
        (route) => fulfill(route, 500, 'application/json', ''),
      );
      await page.goto('/');
      await expect(page.locator('#dfx-places-status')).toHaveText(de['map.load_error']);
      await expect(page.locator('.dfx-places-map-filters')).toHaveCount(0);
      await expect(page.locator('#dfx-places-table')).not.toContainText('Sample');
    });

    test('a failed map library opens the table with shops and the load error', async ({ page }) => {
      await stubShopMap(page);
      await page.route(
        (url) => isUnpkgPath(url, MAPLIBRE_JS),
        (route) => fulfill(route, 500, 'text/javascript', ''),
      );
      await page.goto('/');
      await expect(page.locator('#dfx-places-table-wrap')).toBeVisible();
      await expect(page.locator('#dfx-places-map-wrap')).toBeHidden();
      await expect(
        page.getByRole('button', { name: de['map.view_table'], exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.getByRole('button', { name: de['map.view_map'], exact: true }),
      ).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#dfx-places-table')).toContainText('Sample');
      await expect(page.locator('#dfx-places-status')).toHaveText(de['map.load_error']);
    });

    test('a failed dictionary shows the load error and does not mount shop filters', async ({
      page,
    }) => {
      await stubShopMap(page);
      await page.route(
        (url) => url.pathname.endsWith('/i18n/de.json'),
        (route) => fulfill(route, 500, 'application/json', ''),
      );
      await page.goto('/');
      await expect(page.locator('#dfx-places-status')).toHaveText('map.load_error');
      await expect(page.locator('.dfx-places-map-filters')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('map.filter_name');
    });
  });
});
