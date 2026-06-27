/**
 * streetmunch-custom.js — Street Munch Premium sayfa özel efektler
 * Stack: Lenis smooth scroll + GSAP scrub timeline + Custom cursor + Grain
 * Kurallar:
 *  - prefers-reduced-motion: tümü kapalı
 *  - gsap.matchMedia: parallax/cursor/scrub sadece desktop ≥768px
 *  - will-change sadece aktif animasyon boyunca
 */

(function () {
  'use strict';

  // ── Reduced motion guard ─────────────────────────────────────────────────
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  // ── Lenis smooth scroll init ─────────────────────────────────────────────
  function initLenis() {
    if (!window.Lenis) return;
    const lenis = new window.Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      smoothTouch: false,
      touchMultiplier: 1.5
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Sync Lenis with GSAP ScrollTrigger if available
    function syncGSAP() {
      if (window.gsap && window.ScrollTrigger) {
        lenis.on('scroll', window.ScrollTrigger.update);
        window.gsap.ticker.add(function (time) {
          lenis.raf(time * 1000);
        });
        window.gsap.ticker.lagSmoothing(0);
      }
    }

    if (window.gsap && window.ScrollTrigger) {
      syncGSAP();
    } else {
      var checkGSAP = setInterval(function () {
        if (window.gsap && window.ScrollTrigger) {
          clearInterval(checkGSAP);
          syncGSAP();
        }
      }, 40);
    }

    window.__smLenis = lenis;
    return lenis;
  }

  // ── Wait for GSAP ────────────────────────────────────────────────────────
  function waitForGSAP(cb) {
    if (window.gsap && window.ScrollTrigger) {
      cb();
    } else {
      var id = setInterval(function () {
        if (window.gsap && window.ScrollTrigger) {
          clearInterval(id);
          cb();
        }
      }, 40);
    }
  }

  // ── Vanilla split-text (karakter bazlı) ─────────────────────────────────
  function splitToChars(el) {
    if (!el) return [];
    var text = el.textContent;
    el.innerHTML = '';
    el.setAttribute('aria-label', text);
    return text.split('').map(function (ch) {
      var span = document.createElement('span');
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.style.cssText = 'display:inline-block;will-change:transform,opacity;';
      span.setAttribute('aria-hidden', 'true');
      el.appendChild(span);
      return span;
    });
  }

  // ── Magnetic button effect ───────────────────────────────────────────────
  function setupMagnetic(selector) {
    var btns = document.querySelectorAll(selector);
    btns.forEach(function (btn) {
      var strength = 0.35;
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = (e.clientX - cx) * strength;
        var dy = (e.clientY - cy) * strength;
        if (window.gsap) {
          window.gsap.to(btn, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
        }
      });
      btn.addEventListener('mouseleave', function () {
        if (window.gsap) {
          window.gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1,0.4)' });
        }
      });
    });
  }

  // ── Custom cursor ────────────────────────────────────────────────────────
  function setupCustomCursor() {
    var dot = document.querySelector('.sm-cursor-dot');
    var ring = document.querySelector('.sm-cursor-ring');
    if (!dot || !ring) return;

    var mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', function (e) {
      mx = e.clientX;
      my = e.clientY;
      if (window.gsap) {
        window.gsap.to(dot, { x: mx, y: my, duration: 0.08, ease: 'none' });
      }
    });

    (function ringRaf() {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      if (window.gsap) {
        window.gsap.set(ring, { x: rx, y: ry });
      }
      requestAnimationFrame(ringRaf);
    })();

    // Hover expand
    var interactives = document.querySelectorAll('a, button, .btn-primary, .btn-ghost, .gallery-item, .sm-menu-card');
    interactives.forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        if (window.gsap) {
          window.gsap.to(ring, { scale: 2.4, opacity: 0.6, duration: 0.3, ease: 'power2.out' });
          window.gsap.to(dot, { scale: 0.4, duration: 0.25 });
        }
      });
      el.addEventListener('mouseleave', function () {
        if (window.gsap) {
          window.gsap.to(ring, { scale: 1, opacity: 1, duration: 0.4, ease: 'elastic.out(1,0.5)' });
          window.gsap.to(dot, { scale: 1, duration: 0.3 });
        }
      });
    });

    // Hide default cursor on desktop
    document.documentElement.style.cursor = 'none';
  }

  // ── Hero cinematic load sequence ─────────────────────────────────────────
  function setupHeroSequence(gsap, ST) {
    var heroEl = document.querySelector('.sm-hero');
    if (!heroEl) return;

    var h1 = heroEl.querySelector('.sm-hero-h1');
    var tagline = heroEl.querySelector('.sm-hero-tagline');
    var ctaGroup = heroEl.querySelector('.sm-hero-ctas');
    var scrollHint = heroEl.querySelector('.sm-scroll-hint');
    var heroOverlay = heroEl.querySelector('.sm-hero-overlay');
    var heroBg = heroEl.querySelector('.sm-hero-bg');

    // Initial state: hero bg scale in
    if (heroBg) {
      gsap.set(heroBg, { scale: 1.08, opacity: 0 });
      gsap.to(heroBg, { scale: 1, opacity: 1, duration: 1.6, ease: 'power2.out', delay: 0.1 });
    }

    // Overlay: start darker then settle
    if (heroOverlay) {
      gsap.fromTo(heroOverlay, { opacity: 0.85 }, { opacity: 1, duration: 1.2, ease: 'none' });
    }

    // H1 split text reveal — chars stagger
    if (h1) {
      var chars = splitToChars(h1);
      gsap.fromTo(chars,
        { opacity: 0, y: 56, rotationX: -45, transformOrigin: 'top center' },
        {
          opacity: 1, y: 0, rotationX: 0,
          duration: 0.9,
          ease: 'power4.out',
          stagger: { amount: 0.55, from: 'start' },
          delay: 0.6
        }
      );
    }

    // Tagline fade-up
    if (tagline) {
      gsap.fromTo(tagline,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', delay: 1.1 }
      );
    }

    // CTA group
    if (ctaGroup) {
      gsap.fromTo(ctaGroup,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out', delay: 1.35 }
      );
    }

    // Scroll hint
    if (scrollHint) {
      gsap.fromTo(scrollHint,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'none', delay: 1.7 }
      );
      // Bounce loop
      gsap.to(scrollHint.querySelector('.sm-scroll-arrow'), {
        y: 8,
        duration: 0.9,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 2
      });
    }
  }

  // ── Hero parallax on scroll ──────────────────────────────────────────────
  function setupHeroParallax(gsap, ST) {
    var heroBg = document.querySelector('.sm-hero-bg');
    if (!heroBg) return;
    heroBg.style.willChange = 'transform';
    ST.create({
      trigger: '.sm-hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate: function (self) {
        gsap.set(heroBg, { y: self.progress * 160 });
      },
      onLeave: function () { heroBg.style.willChange = 'auto'; }
    });
  }

  // ── Story pinned section morph ───────────────────────────────────────────
  function setupStoryPin(gsap, ST) {
    var storyEl = document.querySelector('.sm-story');
    if (!storyEl) return;

    var words = storyEl.querySelectorAll('.sm-story-word');
    var storyLine = storyEl.querySelector('.sm-story-line');

    // Word-by-word reveal on scroll
    if (words.length) {
      words.forEach(function (word, i) {
        gsap.fromTo(word,
          { opacity: 0.12, color: 'rgba(255,255,255,0.12)' },
          {
            opacity: 1,
            color: '#fef3c7',
            duration: 0.4,
            ease: 'none',
            scrollTrigger: {
              trigger: storyEl,
              start: 'top 75%',
              end: 'bottom 60%',
              scrub: 0.5
            },
            delay: i * 0.04
          }
        );
      });
    }

    // Accent line grow
    if (storyLine) {
      gsap.fromTo(storyLine,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: storyEl,
            start: 'top 80%',
            toggleActions: 'play none none none'
          }
        }
      );
    }

    // Food icon float animations
    var icons = storyEl.querySelectorAll('.sm-float-icon');
    icons.forEach(function (icon, i) {
      gsap.to(icon, {
        y: -12 - i * 4,
        rotation: i % 2 === 0 ? 8 : -8,
        duration: 2 + i * 0.4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: i * 0.3
      });
    });
  }

  // ── Menu cards hover treatment ───────────────────────────────────────────
  function setupMenuCards(gsap) {
    var cards = document.querySelectorAll('.sm-menu-card');
    cards.forEach(function (card) {
      var img = card.querySelector('img');
      var overlay = card.querySelector('.sm-card-overlay');
      var info = card.querySelector('.sm-card-info');

      card.addEventListener('mouseenter', function () {
        if (img) gsap.to(img, { scale: 1.06, filter: 'saturate(1.3) contrast(1.05)', duration: 0.5, ease: 'power2.out' });
        if (overlay) gsap.to(overlay, { opacity: 1, duration: 0.3 });
        if (info) gsap.to(info, { y: 0, opacity: 1, duration: 0.35, ease: 'power2.out' });
      });
      card.addEventListener('mouseleave', function () {
        if (img) gsap.to(img, { scale: 1, filter: 'saturate(1) contrast(1)', duration: 0.5, ease: 'power2.out' });
        if (overlay) gsap.to(overlay, { opacity: 0.6, duration: 0.3 });
        if (info) gsap.to(info, { y: 8, opacity: 0.85, duration: 0.3 });
      });
    });
  }

  // ── Gallery masonry lightbox ─────────────────────────────────────────────
  function setupGallery(gsap, ST) {
    var items = document.querySelectorAll('.sm-gallery-item');

    // Stagger reveal
    if (items.length) {
      gsap.fromTo(items,
        { opacity: 0, scale: 0.92, y: 30 },
        {
          opacity: 1, scale: 1, y: 0,
          duration: 0.6,
          ease: 'power3.out',
          stagger: { amount: 0.5, from: 'random' },
          scrollTrigger: {
            trigger: '.sm-gallery',
            start: 'top 80%',
            toggleActions: 'play none none none'
          }
        }
      );
    }

    // Hover color tint
    items.forEach(function (item) {
      var tint = item.querySelector('.sm-gallery-tint');
      item.addEventListener('mouseenter', function () {
        if (tint) gsap.to(tint, { opacity: 1, duration: 0.3 });
      });
      item.addEventListener('mouseleave', function () {
        if (tint) gsap.to(tint, { opacity: 0, duration: 0.3 });
      });

      // Lightbox
      item.addEventListener('click', function () {
        var img = item.querySelector('img');
        if (!img) return;
        openLightbox(img.src, img.alt);
      });
    });
  }

  // ── Vanilla lightbox ─────────────────────────────────────────────────────
  function openLightbox(src, alt) {
    var existing = document.querySelector('.sm-lightbox');
    if (existing) existing.remove();

    var lb = document.createElement('div');
    lb.className = 'sm-lightbox';
    lb.innerHTML = '<div class="sm-lightbox-backdrop"></div>' +
      '<div class="sm-lightbox-inner">' +
        '<button class="sm-lightbox-close" aria-label="Kapat">&times;</button>' +
        '<img src="' + src + '" alt="' + (alt || '') + '">' +
      '</div>';
    document.body.appendChild(lb);

    requestAnimationFrame(function () {
      lb.classList.add('sm-lightbox--open');
    });

    function closeLb() {
      lb.classList.remove('sm-lightbox--open');
      setTimeout(function () { lb.remove(); }, 350);
    }

    lb.querySelector('.sm-lightbox-backdrop').addEventListener('click', closeLb);
    lb.querySelector('.sm-lightbox-close').addEventListener('click', closeLb);
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { closeLb(); document.removeEventListener('keydown', escHandler); }
    });
  }

  // ── Section reveals (general) ────────────────────────────────────────────
  function setupSectionReveals(gsap, ST) {
    // Section labels
    document.querySelectorAll('.sm-section-label').forEach(function (el) {
      gsap.fromTo(el,
        { opacity: 0, x: -20 },
        {
          opacity: 1, x: 0,
          duration: 0.5,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
        }
      );
    });

    // Section H2 headings
    document.querySelectorAll('.sm-section h2, .sm-section .sm-h2').forEach(function (el) {
      var chars = splitToChars(el);
      gsap.fromTo(chars,
        { opacity: 0, y: 32 },
        {
          opacity: 1, y: 0,
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.018,
          scrollTrigger: { trigger: el, start: 'top 84%', toggleActions: 'play none none none' }
        }
      );
    });

    // Generic fade-up elements
    document.querySelectorAll('[data-sm-reveal]').forEach(function (el) {
      var delay = parseFloat(el.getAttribute('data-sm-delay') || '0');
      gsap.fromTo(el,
        { opacity: 0, y: 24 },
        {
          opacity: 1, y: 0,
          duration: 0.6,
          ease: 'power2.out',
          delay: delay,
          scrollTrigger: { trigger: el, start: 'top 87%', toggleActions: 'play none none none' }
        }
      );
    });
  }

  // ── CTA footer big text reveal ───────────────────────────────────────────
  function setupCtaFooter(gsap, ST) {
    var ctaBig = document.querySelector('.sm-cta-big');
    if (!ctaBig) return;
    var chars = splitToChars(ctaBig);
    gsap.fromTo(chars,
      { opacity: 0, y: 48, rotationX: -35 },
      {
        opacity: 1, y: 0, rotationX: 0,
        duration: 1,
        ease: 'power4.out',
        stagger: { amount: 0.7 },
        scrollTrigger: { trigger: ctaBig, start: 'top 80%', toggleActions: 'play none none none' }
      }
    );
  }

  // ── WhatsApp button ripple on click ──────────────────────────────────────
  function setupRipple() {
    document.querySelectorAll('.btn-primary, .sm-wa-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var ripple = document.createElement('span');
        ripple.className = 'sm-ripple';
        var rect = btn.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height) * 2;
        ripple.style.cssText = 'position:absolute;border-radius:50%;pointer-events:none;' +
          'background:rgba(255,255,255,0.25);' +
          'width:' + size + 'px;height:' + size + 'px;' +
          'left:' + (e.clientX - rect.left - size / 2) + 'px;' +
          'top:' + (e.clientY - rect.top - size / 2) + 'px;' +
          'animation:smRipple 0.6s ease-out forwards;';
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);
        setTimeout(function () { ripple.remove(); }, 700);
      });
    });
  }

  // ── Nav scroll behavior ──────────────────────────────────────────────────
  function setupNav() {
    var nav = document.querySelector('.sm-nav');
    if (!nav) return;
    var lastY = 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      if (y > 80) {
        nav.classList.add('sm-nav--scrolled');
      } else {
        nav.classList.remove('sm-nav--scrolled');
      }
      lastY = y;
    }, { passive: true });
  }

  // ── Mobile fade-up fallback ──────────────────────────────────────────────
  function setupMobileReveals(gsap, ST) {
    var heroH1 = document.querySelector('.sm-hero-h1');
    if (heroH1) {
      gsap.fromTo(heroH1,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: 0.3 }
      );
    }
    var tagline = document.querySelector('.sm-hero-tagline');
    if (tagline) {
      gsap.fromTo(tagline,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.65 }
      );
    }
    var ctaGroup = document.querySelector('.sm-hero-ctas');
    if (ctaGroup) {
      gsap.fromTo(ctaGroup,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out', delay: 0.9 }
      );
    }

    document.querySelectorAll('.sm-section-label, [data-sm-reveal]').forEach(function (el) {
      gsap.fromTo(el,
        { opacity: 0, y: 18 },
        {
          opacity: 1, y: 0,
          duration: 0.55,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' }
        }
      );
    });
  }

  // ── Init sequence ────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    // Always init: nav, ripple, lenis
    setupNav();
    setupRipple();

    // Wait for Lenis CDN
    var lenisCheck = setInterval(function () {
      if (window.Lenis) {
        clearInterval(lenisCheck);
        initLenis();
      }
    }, 40);

    // Food icon float — works without GSAP via CSS
    // Lightbox inject styles
    injectLightboxStyles();

    waitForGSAP(function () {
      var gsap = window.gsap;
      var ST = window.ScrollTrigger;
      gsap.registerPlugin(ST);

      gsap.matchMedia().add({
        // Desktop ≥768px
        '(min-width: 768px)': function () {
          setupHeroSequence(gsap, ST);
          setupHeroParallax(gsap, ST);
          setupStoryPin(gsap, ST);
          setupMenuCards(gsap);
          setupGallery(gsap, ST);
          setupSectionReveals(gsap, ST);
          setupCtaFooter(gsap, ST);
          setupMagnetic('.btn-primary, .btn-ghost, .sm-wa-btn');
          setupCustomCursor();
        },
        // Mobile <768px
        '(max-width: 767px)': function () {
          setupMobileReveals(gsap, ST);
          setupGallery(gsap, ST);
          setupStoryPin(gsap, ST);
        }
      });
    });
  }

  // ── Lightbox styles injection ────────────────────────────────────────────
  function injectLightboxStyles() {
    if (document.getElementById('sm-lb-styles')) return;
    var style = document.createElement('style');
    style.id = 'sm-lb-styles';
    style.textContent = [
      '.sm-lightbox{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .35s ease;}',
      '.sm-lightbox--open{opacity:1;}',
      '.sm-lightbox-backdrop{position:absolute;inset:0;background:rgba(0,0,0,0.92);cursor:pointer;}',
      '.sm-lightbox-inner{position:relative;z-index:1;max-width:90vw;max-height:90vh;}',
      '.sm-lightbox-inner img{display:block;max-width:90vw;max-height:88vh;object-fit:contain;border:1px solid rgba(255,107,26,0.2);}',
      '.sm-lightbox-close{position:absolute;top:-40px;right:0;background:none;border:none;color:#fff;font-size:32px;cursor:pointer;line-height:1;padding:4px 8px;opacity:0.7;transition:opacity .2s;}',
      '.sm-lightbox-close:hover{opacity:1;}',
      '@keyframes smRipple{0%{transform:scale(0);opacity:1}100%{transform:scale(1);opacity:0}}'
    ].join('');
    document.head.appendChild(style);
  }

})();
