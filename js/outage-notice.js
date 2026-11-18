(function () {
  'use strict';

  var lib = window.DfxOutageNotice;
  if (!lib) {
    throw new Error('outage-notice: window.DfxOutageNotice is missing');
  }
  var notice = document.querySelector('.outage-notice');
  if (!notice) {
    throw new Error('outage-notice: the .outage-notice element is missing');
  }

  var now = new Date();
  if (!lib.isOutageNoticeActive(now)) {
    return;
  }

  var root = document.documentElement;
  notice.removeAttribute('hidden');
  root.classList.add('has-outage-notice');

  // The navbar is position: fixed at top 0, so it would cover the in-flow
  // notice. Shift it down by the part of the notice that is still on screen;
  // the offset shrinks to 0 as the notice scrolls away.
  var ticking = false;
  var expired = false;
  function syncOffset() {
    ticking = false;
    // A frame requested before expiry must not re-apply the offset afterwards.
    if (expired) {
      return;
    }
    var visible = Math.max(0, notice.getBoundingClientRect().bottom);
    root.style.setProperty('--outage-notice-offset', visible + 'px');
  }
  function scheduleSync() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(syncOffset);
    }
  }

  syncOffset();
  window.addEventListener('scroll', scheduleSync, { passive: true });
  // Re-measure when the text wraps differently (viewport width, translation).
  var resizeObserver = new ResizeObserver(scheduleSync);
  resizeObserver.observe(notice);

  // A tab opened before the end instant hides the notice on its own at the end
  // instant and restores the initial state, without a reload. A timer is
  // paused or stretched while the document is frozen (back/forward cache,
  // frozen background tab, device asleep), so syncNotice() runs when the timer
  // fires and on every visibilitychange (device woken, tab shown again) and
  // pageshow (page restored from the back/forward cache). On every call it
  // clears the pending timer and re-reads the wall clock: once the end instant
  // is reached it calls expire(); otherwise it schedules one new timer for the
  // time remaining from that reading. Exactly one timer is pending while the
  // notice is shown, and none after expire().
  var timer = null;
  function expire() {
    expired = true;
    window.removeEventListener('scroll', scheduleSync);
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', syncNotice);
    window.removeEventListener('pageshow', syncNotice);
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    notice.setAttribute('hidden', '');
    root.classList.remove('has-outage-notice');
    root.style.removeProperty('--outage-notice-offset');
  }
  function syncNotice() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    var current = new Date();
    if (!lib.isOutageNoticeActive(current)) {
      expire();
      return;
    }
    timer = window.setTimeout(syncNotice, lib.millisecondsUntilOutageNoticeEnd(current));
  }

  document.addEventListener('visibilitychange', syncNotice);
  window.addEventListener('pageshow', syncNotice);
  timer = window.setTimeout(syncNotice, lib.millisecondsUntilOutageNoticeEnd(now));
})();
