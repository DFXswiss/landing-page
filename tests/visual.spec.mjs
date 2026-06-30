import { expect, test } from '@playwright/test';
import { VIEWS, projectsForView } from './pages.mjs';
import {
  installVisualDeterminism,
  settle,
  openFirstFaq,
  openNav,
  showAiPopup,
} from './helpers.mjs';

const STATE_SETUP = {
  faqOpen: openFirstFaq,
  navOpen: openNav,
  aiPopup: showAiPopup,
};

function urlFor(view) {
  if (!view.lang || view.lang === 'de') return view.path;
  return view.path + (view.path.includes('?') ? '&' : '?') + 'lang=' + view.lang;
}

test.describe('visual regression', () => {
  for (const view of VIEWS) {
    test(`${view.slug}`, async ({ page }, testInfo) => {
      test.skip(
        !projectsForView(view).includes(testInfo.project.name),
        `view "${view.slug}" does not apply to ${testInfo.project.name}`,
      );

      await installVisualDeterminism(page, { allowAiPopup: view.state === 'aiPopup' });
      await page.goto(urlFor(view), { waitUntil: 'load' });
      await settle(page);

      if (view.state) {
        await STATE_SETUP[view.state](page);
      }

      // <canvas> (the animated hub diagram) and <video> render non-deterministic
      // pixels; mask them so the rest of the page is still byte-compared. Overlay
      // states (the fixed AI popup, the burger nav panel) are captured at viewport
      // size — a full-page stitch would duplicate/misplace fixed elements.
      const isOverlay = view.state === 'navOpen' || view.state === 'aiPopup';
      await expect(page).toHaveScreenshot(`${view.slug}.png`, {
        fullPage: !isOverlay,
        mask: [page.locator('canvas'), page.locator('video')],
      });
    });
  }
});
