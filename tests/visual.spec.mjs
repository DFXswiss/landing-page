import { expect, test } from '@playwright/test';
import { PAGES, screenshotName } from './pages.mjs';
import { installVisualDeterminism, settle } from './helpers.mjs';

test.describe('visual regression', () => {
  for (const path of PAGES) {
    test(`full-page screenshot matches baseline: ${path}`, async ({ page }) => {
      await installVisualDeterminism(page);
      await page.goto(path, { waitUntil: 'load' });
      await settle(page);
      // <canvas> (the animated hub diagram) and <video> render non-deterministic
      // pixels; mask them so the rest of the page is still byte-compared.
      await expect(page).toHaveScreenshot(screenshotName(path), {
        fullPage: true,
        mask: [page.locator('canvas'), page.locator('video')],
      });
    });
  }
});
