(function() {
  if (localStorage.getItem('dfx-cookies-accepted')) return;

  var SUPPORTED = ['de','en','fr','it'];

  function getLang() {
    var params = new URLSearchParams(window.location.search);
    var urlLang = params.get('lang');
    if (urlLang && SUPPORTED.indexOf(urlLang) !== -1) return urlLang;
    try { var stored = localStorage.getItem('dfx-lang'); } catch(e) { var stored = null; }
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    var browserLang = navigator.language.slice(0,2);
    if (SUPPORTED.indexOf(browserLang) !== -1) return browserLang;
    return 'de';
  }

  var translations = {
    de: {
      text: 'Diese Website verwendet Cookies, um die bestm\u00f6gliche Funktionalit\u00e4t zu gew\u00e4hrleisten.',
      link: 'Datenschutzrichtlinien',
      accept: 'Akzeptieren',
      decline: 'Ablehnen'
    },
    en: {
      text: 'This website uses cookies to ensure the best possible functionality.',
      link: 'Privacy Policy',
      accept: 'Accept',
      decline: 'Decline'
    },
    fr: {
      text: 'Ce site utilise des cookies pour garantir la meilleure fonctionnalit\u00e9 possible.',
      link: 'Politique de confidentialit\u00e9',
      accept: 'Accepter',
      decline: 'Refuser'
    },
    it: {
      text: 'Questo sito utilizza i cookie per garantire la migliore funzionalit\u00e0 possibile.',
      link: 'Informativa sulla privacy',
      accept: 'Accetta',
      decline: 'Rifiuta'
    }
  };

  document.addEventListener('DOMContentLoaded', function() {
    var lang = getLang();
    var t = translations[lang];

    var banner = document.createElement('div');
    banner.className = 'dk-cookie';
    banner.innerHTML =
      '<div class="dk-cookie__inner">' +
        '<p class="dk-cookie__text">' + t.text + ' ' +
        '<a href="https://docs.dfx.swiss/' + lang + '/privacy.html" target="_blank" class="dk-cookie__link">' + t.link + '</a></p>' +
        '<div class="dk-cookie__buttons">' +
          '<button class="dk-cookie__btn dk-cookie__btn--accept" onclick="acceptCookies()">' + t.accept + '</button>' +
          '<button class="dk-cookie__btn dk-cookie__btn--decline" onclick="declineCookies()">' + t.decline + '</button>' +
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
