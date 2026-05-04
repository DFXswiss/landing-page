(function() {
  if (localStorage.getItem('dfx-cookies-accepted')) return;

  document.addEventListener('DOMContentLoaded', function() {
    var banner = document.createElement('div');
    banner.className = 'dk-cookie';
    banner.innerHTML =
      '<div class="dk-cookie__inner">' +
        '<p class="dk-cookie__text">Diese Website verwendet Cookies, um die bestmögliche Funktionalität zu gewährleisten. ' +
        '<a href="https://docs.dfx.swiss/de/privacy.html" target="_blank" class="dk-cookie__link">Datenschutzrichtlinien</a></p>' +
        '<div class="dk-cookie__buttons">' +
          '<button class="dk-cookie__btn dk-cookie__btn--accept" onclick="acceptCookies()">Akzeptieren</button>' +
          '<button class="dk-cookie__btn dk-cookie__btn--decline" onclick="declineCookies()">Ablehnen</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        banner.classList.add('is-visible');
      });
    });
  });

  window.acceptCookies = function() {
    localStorage.setItem('dfx-cookies-accepted', 'true');
    closeBanner();
  };

  window.declineCookies = function() {
    localStorage.setItem('dfx-cookies-accepted', 'declined');
    closeBanner();
  };

  function closeBanner() {
    var banner = document.querySelector('.dk-cookie');
    if (banner) {
      banner.classList.remove('is-visible');
      setTimeout(function() { banner.remove(); }, 400);
    }
  }
})();
