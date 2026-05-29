import { expect, test } from '@playwright/test';

const pages = [
  '/',
  '/dfx-services.html',
  '/dfx-toolbox.html',
  '/dfx-taro-app.html',
  '/dfx-services-ag.html',
  '/faq.html',
  '/help.html'
];

test.describe('static site smoke checks', () => {
  for (const path of pages) {
    test(`${path} loads without obvious layout overflow`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.ok()).toBeTruthy();

      await expect(page.locator('body')).toBeVisible();

      const title = await page.title();
      expect(title.trim().length).toBeGreaterThan(0);

      const overflow = await page.evaluate(() => {
        const documentWidth = document.documentElement.scrollWidth;
        const viewportWidth = document.documentElement.clientWidth;
        return documentWidth - viewportWidth;
      });

      expect(overflow).toBeLessThanOrEqual(2);
    });
  }
});
