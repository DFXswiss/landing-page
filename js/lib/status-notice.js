/**
 * Pure, side-effect-free logic for the home page status notice.
 *
 * Loaded as a classic script *before* js/status-notice.js so
 * window.DfxStatusNotice exists when the DOM script runs. Kept free of DOM and
 * network access so it can be unit-tested in isolation with 100% coverage (see
 * test/status-notice.test.mjs); the DOM glue stays in js/status-notice.js and
 * is covered by the Playwright functional suite.
 */
(function (global) {
  'use strict';

  var STATUS_PAGE_URL = 'https://status.dfx.swiss/';
  var INCIDENTS_URL = 'https://status.dfx.swiss/api/status-page/dfx/incident-history';

  // The titles of the notices the status page currently shows at its top, in
  // the order the status page lists them. A notice is shown there while it is
  // both active and pinned; a resolved or unpinned one is history only.
  function activeNoticeTitles(payload) {
    if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
      throw new Error('status-notice: the status page did not answer with ok');
    }
    if (!Array.isArray(payload.incidents)) {
      throw new Error('status-notice: the status page answer has no incidents list');
    }
    return payload.incidents
      .filter(function (incident) {
        return incident.active === true && incident.pin === true;
      })
      .map(function (incident) {
        if (typeof incident.title !== 'string' || incident.title.trim() === '') {
          throw new Error('status-notice: an active notice has no title');
        }
        return incident.title.trim();
      });
  }

  global.DfxStatusNotice = {
    STATUS_PAGE_URL: STATUS_PAGE_URL,
    INCIDENTS_URL: INCIDENTS_URL,
    activeNoticeTitles: activeNoticeTitles,
  };
})(window);
