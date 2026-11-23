(function () {
  'use strict';

  var lib = window.DfxStatusNotice;
  if (!lib) {
    throw new Error('status-notice: window.DfxStatusNotice is missing');
  }
  var notice = document.querySelector('.status-notice');
  if (!notice) {
    throw new Error('status-notice: the .status-notice element is missing');
  }
  var list = notice.querySelector('.status-notice__list');
  if (!list) {
    throw new Error('status-notice: the .status-notice__list element is missing');
  }

  var root = document.documentElement;

  // The bar mirrors the notices the status page shows at its top. Without an
  // active notice, and when the status page cannot be read, the bar stays
  // hidden; a failed read is not caught, so it surfaces in the console.
  window
    .fetch(lib.INCIDENTS_URL)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('status-notice: the status page answered with HTTP ' + response.status);
      }
      return response.json();
    })
    .then(function (payload) {
      showBar(lib.activeNoticeTitles(payload));
    });

  function showBar(titles) {
    if (titles.length === 0) {
      return;
    }

    // textContent only: the titles come from another origin and are never
    // interpreted as markup.
    titles.forEach(function (title) {
      var item = document.createElement('li');
      item.className = 'status-notice__item';
      item.textContent = title;
      list.appendChild(item);
    });

    notice.removeAttribute('hidden');
    root.classList.add('has-status-notice');

    // The navbar is position: fixed at top 0, so it would cover the in-flow
    // notice. Shift it down by the part of the notice that is still on screen;
    // the offset shrinks to 0 as the notice scrolls away.
    var ticking = false;
    function syncOffset() {
      ticking = false;
      var visible = Math.max(0, notice.getBoundingClientRect().bottom);
      root.style.setProperty('--status-notice-offset', visible + 'px');
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
    new ResizeObserver(scheduleSync).observe(notice);
  }
})();
