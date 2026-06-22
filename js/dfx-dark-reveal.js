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
  });
})();
