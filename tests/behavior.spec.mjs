import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { blockExternalNoise } from './helpers.mjs';

const en = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url), 'utf8'));
const de = JSON.parse(readFileSync(new URL('../i18n/de.json', import.meta.url), 'utf8'));

const visibilityRestored = () => getComputedStyle(document.documentElement).visibility !== 'hidden';

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
