/**
 * Pure, side-effect-free timing logic for the home page outage notice.
 *
 * Loaded as a classic script *before* js/outage-notice.js so
 * window.DfxOutageNotice exists when the DOM script runs. Kept free of DOM
 * access so it can be unit-tested in isolation with 100% coverage (see
 * test/outage-notice.test.mjs); the DOM glue stays in js/outage-notice.js and
 * is covered by the Playwright functional suite.
 */
(function (global) {
  'use strict';

  // The notice disappears on its own at this instant, so no second deployment
  // is needed to remove it.
  var OUTAGE_NOTICE_END = new Date('2027-01-01T00:00:00+01:00');

  function isOutageNoticeActive(now) {
    return now.getTime() < OUTAGE_NOTICE_END.getTime();
  }

  // Delay for hiding the notice in a tab that was opened before the end
  // instant; zero or negative once the end instant has been reached.
  function millisecondsUntilOutageNoticeEnd(now) {
    return OUTAGE_NOTICE_END.getTime() - now.getTime();
  }

  global.DfxOutageNotice = {
    OUTAGE_NOTICE_END: OUTAGE_NOTICE_END,
    isOutageNoticeActive: isOutageNoticeActive,
    millisecondsUntilOutageNoticeEnd: millisecondsUntilOutageNoticeEnd,
  };
})(window);
