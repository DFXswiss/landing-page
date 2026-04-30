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

    // FAQ accordion toggle
    document.querySelectorAll('.dk-faq-section .faq_question').forEach(function(q) {
      q.addEventListener('click', function() {
        var accordion = q.closest('.faq_accordion');
        var wasOpen = accordion.classList.contains('is-open');
        // close all
        document.querySelectorAll('.dk-faq-section .faq_accordion').forEach(function(a) {
          a.classList.remove('is-open');
        });
        // toggle clicked
        if (!wasOpen) {
          accordion.classList.add('is-open');
        }
      });
    });
  });
})();
