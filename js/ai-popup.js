(function() {
  var SUPPORTED = ['de','en','fr','it'];

  function getLang() {
    var params = new URLSearchParams(window.location.search);
    var urlLang = params.get('lang');
    if (urlLang && SUPPORTED.indexOf(urlLang) !== -1) return urlLang;
    try { var stored = localStorage.getItem('dfx-lang'); } catch(e) { var stored = null; }
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    var browserLang = (navigator.language || 'de').slice(0,2);
    if (SUPPORTED.indexOf(browserLang) !== -1) return browserLang;
    return 'de';
  }

  var translations = {
    de: { title: 'Schnell erklärt', sub: 'Lass dir DFX von einer KI in 30 Sekunden erklären.', close: 'Schliessen' },
    en: { title: 'Quick explainer', sub: 'Get an AI to explain DFX in 30 seconds.', close: 'Close' },
    fr: { title: 'Explication rapide', sub: "Demandez à une IA d'expliquer DFX en 30 secondes.", close: 'Fermer' },
    it: { title: 'Spiegazione rapida', sub: "Chiedi a un'IA di spiegarti DFX in 30 secondi.", close: 'Chiudi' }
  };

  var PROMPT = encodeURIComponent('Read https://dfx.swiss/llms.txt for context about DFX. Provide a brief, friendly overview of what DFX is and how it works. Then invite the user to ask any questions. Keep your initial explanation concise (2-3 sentences) and conversational.');

  var ICONS = {
    chatgpt: '<svg class="dk-ai-pill__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>',
    claude: '<svg class="dk-ai-pill__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>',
    grok: '<svg class="dk-ai-pill__icon" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/></svg>',
    arrow: '<svg class="dk-ai-pill__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>'
  };

  var AIs = [
    { name: 'ChatGPT', href: 'https://chatgpt.com/?q=' + PROMPT + '&hints=search', icon: ICONS.chatgpt },
    { name: 'Claude', href: 'https://claude.ai/new?q=' + PROMPT, icon: ICONS.claude },
    { name: 'Grok', href: 'https://grok.com/?q=' + PROMPT, icon: ICONS.grok }
  ];

  function show() {
    if (document.querySelector('.dk-ai-popup')) return;
    var lang = getLang();
    var t = translations[lang] || translations.de;

    var pillsHtml = AIs.map(function(ai) {
      return '<a class="dk-ai-pill" href="' + ai.href + '" target="_blank" rel="noopener noreferrer" data-ai-pill="' + ai.name + '" aria-label="' + ai.name + '">' +
        ai.icon +
        '<span>' + ai.name + '</span>' +
        ICONS.arrow +
      '</a>';
    }).join('');

    var popup = document.createElement('div');
    popup.className = 'dk-ai-popup';
    popup.setAttribute('role', 'region');
    popup.setAttribute('aria-label', t.title);
    popup.setAttribute('aria-live', 'polite');
    popup.innerHTML =
      '<button class="dk-ai-popup__close" aria-label="' + t.close + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '<p class="dk-ai-popup__title">' + t.title + '</p>' +
      '<p class="dk-ai-popup__sub">' + t.sub + '</p>' +
      '<div class="dk-ai-popup__pills">' + pillsHtml + '</div>';

    document.body.appendChild(popup);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        popup.classList.add('is-visible');
      });
    });

    // Focus management for a non-modal, auto-appearing notice: we do NOT steal
    // focus on appear (that would violate WCAG 2.4.3/3.2.1 for an unsolicited
    // popup). We remember the previously focused element, keep Tab contained
    // once the user actually enters the popup, and restore focus on close.
    var lastFocused = document.activeElement;

    function focusables() {
      return Array.prototype.slice.call(
        popup.querySelectorAll('a[href], button:not([disabled])')
      );
    }

    function close() {
      popup.classList.remove('is-visible');
      setTimeout(function() { if (popup.parentNode) popup.remove(); }, 400);
      document.removeEventListener('keydown', onKey);
      // Only return focus if it currently sits inside the popup, so we never
      // yank focus away from wherever the user has since moved.
      if (popup.contains(document.activeElement) && lastFocused && lastFocused.focus) {
        lastFocused.focus();
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab' || !popup.contains(document.activeElement)) return;
      // Contained tab cycle — engages only once focus is inside the popup.
      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    popup.querySelector('.dk-ai-popup__close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
  }

  var SEEN_KEY = 'dfx-ai-popup-seen';

  function alreadySeen() {
    try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }

  function markSeen() {
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (alreadySeen()) return;
    setTimeout(function() {
      markSeen();
      show();
    }, 5000);
  });
})();
