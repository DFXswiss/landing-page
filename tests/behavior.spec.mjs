import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { STATUS_NOTICES_URL, blockExternalNoise, openNav, stubStatusNotices } from './helpers.mjs';

const en = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url), 'utf8'));
const de = JSON.parse(readFileSync(new URL('../i18n/de.json', import.meta.url), 'utf8'));

const visibilityRestored = () => getComputedStyle(document.documentElement).visibility !== 'hidden';

const SECURITY_POST_URL = 'https://x.com/dfx_swiss/status/2122956475865677875';
const RESUMED_DE =
  'Alle DFX-Core-Funktionen sind wieder verfügbar. Kaufen und Verkaufen der beliebtesten Blockchains ist wieder vollständig in Betrieb.';
const RESUMED_EN =
  'All DFX core features are available again. Buying and selling on the most popular blockchains is fully operational again.';
const FINANCIAL_DE =
  'DFX kann den entstandenen Schaden aus der laufenden Geschäftstätigkeit finanzieren. DFX ist solvent, erwirtschaftet einen positiven Cashflow und befindet sich auch nach diesem Vorfall in einer finanziell gesunden Lage.';
const FINANCIAL_EN =
  'DFX is able to finance the damage incurred from its ongoing operating activities. DFX is solvent, generates a positive cash flow and remains in a sound financial position after this incident.';
const INCIDENT_SUPPORT_DE = 'Fragen: Support-Ticket erstellen';
const INCIDENT_SUPPORT_EN = 'Questions: Open a support ticket';
const INCIDENT_X_DE = 'Meldung von DFX vom 18. November 2026: DFX on X';
const INCIDENT_X_EN = 'DFX announcement of 18 November 2026: DFX on X';
const SUPPORT_HREF = 'https://app.dfx.swiss/support/tickets';

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
      await expect(german(page)).toContainText("etwas weniger als 50'000 CHF");
      await expect(english(page).locator('code')).toHaveCount(1);
      await expect(english(page).locator('code')).toHaveText(attackerAddress);
      await expect(english(page)).toContainText('slightly less than CHF 50,000');
      await expect(german(page)).toContainText(FINANCIAL_DE);
      await expect(english(page)).toContainText(FINANCIAL_EN);
      await expect(german(page)).toContainText(RESUMED_DE);
      await expect(german(page)).toContainText(INCIDENT_SUPPORT_DE);
      await expect(english(page)).toContainText(RESUMED_EN);
      await expect(english(page)).toContainText(INCIDENT_SUPPORT_EN);
      await expect(german(page)).toContainText(INCIDENT_X_DE);
      await expect(english(page)).toContainText(INCIDENT_X_EN);
      await expect(german(page).locator(`a[href="${SECURITY_POST_URL}"]`)).toHaveAttribute('target', '_blank');
      await expect(english(page).locator(`a[href="${SECURITY_POST_URL}"]`)).toHaveAttribute('target', '_blank');
      await expect(page.locator('a[href^="mailto:support@dfx.swiss"]')).toHaveCount(0);
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
      await expect(german(page).locator('h2')).toHaveCount(8);
      await expect(english(page).locator('h2')).toHaveText('Security incident of 18 November 2026');
      await expect(english(page).locator('h3')).toHaveCount(8);
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

    test('has no security popup, status notice bar or status notice script', async ({ page }) => {
      await page.goto('/security-incident.html');
      await page.waitForFunction(visibilityRestored);

      await expect(page.locator('.outage-popup')).toHaveCount(0);
      await expect(page.locator('.status-notice')).toHaveCount(0);
      const scripts = await page
        .locator('script[src]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src')));
      expect(scripts.some((src) => src.includes('status-notice.js'))).toBe(false);
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

  test.describe('status notice bar', () => {
    const notice = (page) => page.locator('.status-notice');
    const noticeItems = (page) => notice(page).locator('.status-notice__item');
    const incident = (overrides) => ({
      id: 1,
      title: 'Scheduled maintenance',
      active: true,
      pin: true,
      ...overrides,
    });

    test('with active notices on the status page the bar lists their titles above the navbar and links to the status page', async ({
      page,
    }) => {
      await stubStatusNotices(page, [
        incident({ id: 3, title: 'Bank connection interrupted' }),
        incident({ id: 2 }),
        incident({ id: 1, title: 'Resolved', active: false }),
      ]);
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);

      await expect(notice(page)).toBeVisible();
      await expect(notice(page)).toHaveAttribute('role', 'status');
      await expect(noticeItems(page)).toHaveText([
        'Bank connection interrupted',
        'Scheduled maintenance',
      ]);
      const link = notice(page).locator('.status-notice__link');
      await expect(link).toHaveText(en['notice.status_link']);
      await expect(link).toHaveAttribute('href', 'https://status.dfx.swiss/');
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(page.locator('html')).toHaveClass(/\bhas-status-notice\b/);

      // The fixed navbar must sit below the in-flow notice, not cover it.
      await expect
        .poll(async () => {
          const noticeBox = await notice(page).boundingBox();
          const navBox = await page.locator('.navbar').first().boundingBox();
          return navBox.y - (noticeBox.y + noticeBox.height);
        })
        .toBeCloseTo(0, 0);
    });

    test('a notice title is shown as text and never interpreted as markup', async ({ page }) => {
      const title = '<img src="x" onerror="window.__statusNoticeMarkup = true"><b>Maintenance</b>';
      await stubStatusNotices(page, [incident({ title })]);
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);

      await expect(noticeItems(page)).toHaveText([title]);
      await expect(notice(page).locator('img, b')).toHaveCount(0);
      expect(await page.evaluate(() => window.__statusNoticeMarkup)).toBeUndefined();
    });

    test('with the notice shown the open burger panel starts at the navbar bottom and its max-height is reduced by the notice height', async ({
      page,
    }) => {
      await stubStatusNotices(page, [incident()]);
      await page.setViewportSize({ width: 834, height: 1112 });
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);
      await expect(notice(page)).toBeVisible();

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
            const noticeEl = document.querySelector('.status-notice');
            const maxHeight = parseFloat(getComputedStyle(panel).maxHeight);
            const noticeHeight = noticeEl.getBoundingClientRect().height;
            return Math.abs(maxHeight - (window.innerHeight - 72 - noticeHeight));
          }),
        )
        .toBeLessThanOrEqual(1);
    });

    test('without an active notice the bar stays hidden and the navbar stays at the top', async ({
      page,
    }) => {
      await stubStatusNotices(page, [
        incident({ id: 2, title: 'Resolved', active: false }),
        incident({ id: 1, title: 'Unpinned', pin: false }),
      ]);
      const answered = page.waitForResponse(STATUS_NOTICES_URL);
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);
      await (await answered).finished();

      await expect(notice(page)).toBeHidden();
      await expect(noticeItems(page)).toHaveCount(0);
      await expect(page.locator('html')).not.toHaveClass(/\bhas-status-notice\b/);
      await expect
        .poll(async () => {
          const navBox = await page.locator('.navbar').first().boundingBox();
          return Math.abs(navBox.y);
        })
        .toBeLessThanOrEqual(1);
    });

    test('when the status page cannot be read the bar stays hidden and the failure is reported as a page error', async ({
      page,
    }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.route(STATUS_NOTICES_URL, (route) =>
        route.fulfill({
          status: 503,
          contentType: 'text/plain',
          headers: { 'access-control-allow-origin': '*' },
          body: '',
        }),
      );
      await page.goto('/?lang=en');
      await page.waitForFunction(visibilityRestored);

      await expect
        .poll(() => pageErrors)
        .toEqual(['status-notice: the status page answered with HTTP 503']);
      await expect(notice(page)).toBeHidden();
      await expect(page.locator('html')).not.toHaveClass(/\bhas-status-notice\b/);
    });
  });

  test.describe('security incident note', () => {
    const note = (page) => page.locator('.dk-incident');

    for (const [lang, strings] of [
      ['de', de],
      ['en', en],
    ]) {
      test(`the home page shows the note as plain text in ${lang} with one link to the security incident page`, async ({
        page,
      }) => {
        await page.goto(`/?lang=${lang}`);
        await page.waitForFunction(visibilityRestored);

        await expect(note(page).getByRole('heading', { level: 2 })).toHaveText(
          strings['incident.heading'],
        );
        await expect(note(page).locator('.dk-incident__text')).toHaveText([
          strings['incident.status'],
          strings['incident.warning'],
          strings['incident.customer_data'],
        ]);
        await expect(note(page).locator('.dk-incident__text--important')).toHaveText(
          strings['incident.warning'],
        );
        const more = note(page).locator('a');
        await expect(more).toHaveCount(1);
        await expect(more).toHaveText(strings['incident.more']);
        await expect(more).toHaveAttribute('href', 'security-incident.html');
        await expect(more).not.toHaveAttribute('target');
      });
    }

    test('the home page has no security popup and the note sits directly below the hero', async ({
      page,
    }) => {
      await page.goto('/');
      await page.waitForFunction(visibilityRestored);

      await expect(page.locator('.outage-popup')).toHaveCount(0);
      await expect(page.locator('.dk-hero + .dk-incident')).toHaveCount(1);
      await expect(note(page)).toBeVisible();
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
