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

  test('scroll-reveal marks elements visible once they enter the viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(visibilityRestored);
    const reveal = page.locator('.dk-reveal').first();
    await reveal.scrollIntoViewIfNeeded();
    await expect(reveal).toHaveClass(/is-visible/);
  });

  test('clicktrack records analytics events in localStorage', async ({ page }) => {
    await page.goto('/');
    await expect
      .poll(() =>
        page.evaluate(() => {
          try {
            return JSON.parse(localStorage.getItem('dfx_ct_events_v1') || '[]').length;
          } catch {
            return 0;
          }
        }),
      )
      .toBeGreaterThan(0);
  });
});
