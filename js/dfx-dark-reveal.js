(function() {
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var parent = el.closest('.dk-pillars, .dk-stats');
        var delay = parent
          ? Array.from(parent.querySelectorAll('.dk-reveal')).indexOf(el) * 100
          : 0;
        setTimeout(function() {
          el.classList.add('is-visible');
        }, delay);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.15 });

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.dk-reveal').forEach(function(el) {
      observer.observe(el);
    });

    // How-it-works sequential animation — restarts every scroll
    var howtoSection = document.querySelector('.dk-howto');
    if (howtoSection) {
      var howtoTimers = [];
      function resetHowto() {
        howtoTimers.forEach(function(t) { clearTimeout(t); });
        howtoTimers = [];
        howtoSection.querySelectorAll('.dk-step__number').forEach(function(n) { n.classList.remove('is-filled'); });
        howtoSection.querySelectorAll('.dk-step__arrow').forEach(function(a) { a.classList.remove('is-filled'); });
        // Reset dots by cloning to restart animation
        howtoSection.querySelectorAll('.dk-step__arrow-dot').forEach(function(d) {
          var clone = d.cloneNode(true);
          d.parentNode.replaceChild(clone, d);
        });
      }
      function playHowto() {
        var steps = howtoSection.querySelectorAll('.dk-step');
        var arrows = howtoSection.querySelectorAll('.dk-step__arrow');
        howtoTimers.push(setTimeout(function() {
          if (steps[0]) steps[0].querySelector('.dk-step__number').classList.add('is-filled');
        }, 300));
        howtoTimers.push(setTimeout(function() {
          if (arrows[0]) arrows[0].classList.add('is-filled');
        }, 700));
        howtoTimers.push(setTimeout(function() {
          if (steps[1]) steps[1].querySelector('.dk-step__number').classList.add('is-filled');
        }, 1200));
        howtoTimers.push(setTimeout(function() {
          if (arrows[1]) arrows[1].classList.add('is-filled');
        }, 1600));
        howtoTimers.push(setTimeout(function() {
          if (steps[2]) steps[2].querySelector('.dk-step__number').classList.add('is-filled');
        }, 2100));
      }
      var howtoObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            resetHowto();
            playHowto();
          } else {
            resetHowto();
          }
        });
      }, { threshold: 0.3 });
      howtoObserver.observe(howtoSection);
    }

    // FAQ accordion toggle — works on all FAQ sections
    // Inline `!important` so the toggle always wins over any stylesheet rule
    // (incl. the collapsed `max-height:0`), regardless of cascade/specificity.
    function closeAccordion(acc) {
      acc.classList.remove('is-open');
      var ans = acc.querySelector('.faq_answer');
      if (ans) ans.style.setProperty('max-height', '0px', 'important');
    }
    function openAccordion(acc) {
      acc.classList.add('is-open');
      var ans = acc.querySelector('.faq_answer');
      if (!ans) return;
      // Measure true content height unclipped, then animate 0 -> exact height
      // (no magic cap, no truncation, adapts to any answer length / language).
      ans.style.setProperty('max-height', 'none', 'important');
      var target = ans.scrollHeight;
      ans.style.setProperty('max-height', '0px', 'important');
      ans.getBoundingClientRect(); // force reflow so the transition runs
      ans.style.setProperty('max-height', target + 'px', 'important');
    }

    document.querySelectorAll('.dfx-dark-page .faq_question').forEach(function(q) {
      q.addEventListener('click', function() {
        var accordion = q.closest('.faq_accordion');
        var wasOpen = accordion.classList.contains('is-open');
        // close all in same section
        var section = q.closest('section');
        if (section) {
          section.querySelectorAll('.faq_accordion').forEach(closeAccordion);
        }
        // toggle clicked
        if (!wasOpen) {
          openAccordion(accordion);
        }
      });
    });

    // Keep any open answer correctly sized on viewport resize / reflow.
    var faqResizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(faqResizeTimer);
      faqResizeTimer = setTimeout(function() {
        document.querySelectorAll('.dfx-dark-page .faq_accordion.is-open .faq_answer').forEach(function(ans) {
          ans.style.setProperty('max-height', 'none', 'important');
          var h = ans.scrollHeight;
          ans.style.setProperty('max-height', h + 'px', 'important');
        });
      }, 150);
    });

    // Mobile nav: custom burger toggle (Webflow's collapse menu isn't wired on
    // the dark theme, so the button did nothing). Toggles `.dk-open`.
    var navBtn = document.querySelector('.dfx-dark-page .menu-button');
    var navMenu = document.querySelector('.dfx-dark-page .navbar .nav-menu');
    if (navBtn && navMenu) {
      navBtn.setAttribute('role', 'button');
      navBtn.setAttribute('tabindex', '0');
      navBtn.setAttribute('aria-label', 'Menu');
      navBtn.setAttribute('aria-expanded', 'false');
      var closeNav = function() {
        navMenu.classList.remove('dk-open');
        navBtn.classList.remove('dk-open');
        navBtn.setAttribute('aria-expanded', 'false');
      };
      var navbar = navBtn.closest('.navbar');
      var toggleNav = function(e) {
        e.preventDefault();
        e.stopPropagation();
        var open = !navMenu.classList.contains('dk-open');
        if (open && navbar) {
          // make sure the navbar is revealed, then anchor the panel to its bottom edge
          navbar.classList.remove('nav-hidden');
          navMenu.style.top = Math.round(navbar.getBoundingClientRect().bottom) + 'px';
        }
        navMenu.classList.toggle('dk-open', open);
        navBtn.classList.toggle('dk-open', open);
        navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      navBtn.addEventListener('click', toggleNav);
      navBtn.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') toggleNav(e);
      });
      navMenu.querySelectorAll('a').forEach(function(a) {
        a.addEventListener('click', closeNav);
      });
      document.addEventListener('click', function(e) {
        if (navMenu.classList.contains('dk-open') && !navMenu.contains(e.target) && !navBtn.contains(e.target)) closeNav();
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeNav();
      });
      window.addEventListener('resize', function() {
        if (window.innerWidth > 991) closeNav();
      });
    }

    // Auto-hide the navbar when scrolling down, reveal it when scrolling up.
    var navbarEl = document.querySelector('.navbar');
    if (navbarEl) {
      var lastY = window.scrollY;
      var ticking = false;
      var DELTA = 6;
      var TOP_ZONE = 120;
      var update = function() {
        var y = window.scrollY;
        var menuOpen = document.querySelector('.dfx-dark-page .nav-menu.dk-open');
        if (y <= TOP_ZONE || menuOpen) {
          navbarEl.classList.remove('nav-hidden');
        } else if (y > lastY + DELTA) {
          navbarEl.classList.add('nav-hidden');      // scrolling down
        } else if (y < lastY - DELTA) {
          navbarEl.classList.remove('nav-hidden');   // scrolling up
        }
        lastY = y;
        ticking = false;
      };
      window.addEventListener('scroll', function() {
        if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
      }, { passive: true });
    }
  });
})();
