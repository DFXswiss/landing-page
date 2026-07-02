import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { blockExternalNoise } from './helpers.mjs';

const en = JSON.parse(readFileSync(new URL('../i18n/en.json', import.meta.url), 'utf8'));

const visibilityRestored = () => getComputedStyle(document.documentElement).visibility !== 'hidden';

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
});
