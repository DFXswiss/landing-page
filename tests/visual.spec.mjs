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

      // Overlay states (AI popup, open burger nav) only exist on the home page,
      // whose viewport IS the autoplaying hero <video>; a masked full-page shot of
      // them would assert nothing. Screenshot the overlay ELEMENT instead: the open
      // nav panel is fully opaque, and the (translucent, backdrop-blurred) AI popup
      // has its hero <video> hidden in setup (see showAiPopup) — so neither shot
      // composites the video and no mask is needed. All other views shoot the full
      // page and mask the non-deterministic <canvas>/<video>.
      const OVERLAY_SELECTOR = {
        navOpen: '.dfx-dark-page .navbar .nav-menu',
        aiPopup: '.dk-ai-popup',
      };
      const overlaySelector = OVERLAY_SELECTOR[view.state];
      if (overlaySelector) {
        await expect(page.locator(overlaySelector)).toHaveScreenshot(`${view.slug}.png`);
      } else {
        await expect(page).toHaveScreenshot(`${view.slug}.png`, {
          fullPage: true,
          mask: [page.locator('canvas'), page.locator('video')],
        });
      }
    });
  }
});
