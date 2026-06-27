/**
 * restoran-motion.js — Kalkan Info restoran detay sayfaları motion katmanı
 * Stack: GSAP 3 + ScrollTrigger + Motion One (fallback)
 * Toplam CDN: ~104KB (GSAP 40KB + Motion One 4KB + Lottie 60KB) — cache hit sonrası 0
 *
 * Kurallar:
 *  - prefers-reduced-motion: tüm animasyonlar kapalı
 *  - gsap.matchMedia: mobilde parallax ve scrub kapalı
 *  - Lottie: viewport dışında pause
 *  - will-change sadece aktif animasyon süresince
 */

(function () {
  'use strict';

  // ─── Reduced motion guard ────────────────────────────────────────────────
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  // ─── Wait for GSAP ───────────────────────────────────────────────────────
  function waitForGSAP(cb) {
    if (window.gsap && window.ScrollTrigger) {
      cb();
    } else {
      const id = setInterval(function () {
        if (window.gsap && window.ScrollTrigger) {
          clearInterval(id);
          cb();
        }
      }, 40);
    }
  }

  waitForGSAP(init);

  function init() {
    const gsap = window.gsap;
    const ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);

    // ─── Grain overlay ──────────────────────────────────────────────────────
    injectGrain();

    // ─── Hero setup ─────────────────────────────────────────────────────────
    const heroEl = document.querySelector('header#top');
    const heroImg = heroEl && heroEl.querySelector('img.hero-img');
    const heroH1 = heroEl && heroEl.querySelector('h1');
    const heroSub = heroEl && heroEl.querySelector('[data-i="hero_sub"]');
    const heroCtas = heroEl && heroEl.querySelectorAll('.btn-primary, .btn-ghost');
    const scrollHint = heroEl && heroEl.querySelector('.absolute.bottom-8');

    // Lottie accent widget
    injectLottie(heroEl);

    gsap.matchMedia().add({
      // ── Desktop (≥768px): full experience ──────────────────────────────
      '(min-width: 768px)': function () {
        // Hero parallax — img moves slower than scroll
        if (heroImg) {
          heroImg.style.willChange = 'transform';
          ST.create({
            trigger: heroEl,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
            onUpdate: function (self) {
              gsap.set(heroImg, { y: self.progress * 120 });
            },
            onLeaveBack: function () {
              heroImg.style.willChange = 'auto';
            }
          });
        }

        // Hero title split-text reveal
        if (heroH1) {
          const chars = splitChars(heroH1);
          gsap.fromTo(chars,
            { opacity: 0, y: 24, rotationX: -30 },
            {
              opacity: 1, y: 0, rotationX: 0,
              duration: 0.7,
              ease: 'power3.out',
              stagger: 0.032,
              delay: 0.15
            }
          );
        }

        // Hero subtitle + CTAs stagger fade-up
        const heroRevealEls = [heroSub, ...(heroCtas || []), scrollHint].filter(Boolean);
        if (heroRevealEls.length) {
          gsap.fromTo(heroRevealEls,
            { opacity: 0, y: 18 },
            {
              opacity: 1, y: 0,
              duration: 0.65,
              ease: 'power2.out',
              stagger: 0.1,
              delay: 0.55
            }
          );
        }

        // Section label reveal on scroll
        document.querySelectorAll('.section-label').forEach(function (el) {
          gsap.fromTo(el,
            { opacity: 0, x: -24 },
            {
              opacity: 1, x: 0,
              duration: 0.55,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: el,
                start: 'top 88%',
                toggleActions: 'play none none none'
              }
            }
          );
        });

        // Section headings (h2) scroll reveal
        document.querySelectorAll('section h2').forEach(function (el) {
          gsap.fromTo(el,
            { opacity: 0, y: 40 },
            {
              opacity: 1, y: 0,
              duration: 0.65,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: el,
                start: 'top 85%',
                toggleActions: 'play none none none'
              }
            }
          );
        });

        // Body paragraphs + pills stagger
        document.querySelectorAll('section p[data-i], section .flex.flex-wrap.gap-3').forEach(function (el) {
          gsap.fromTo(el,
            { opacity: 0, y: 20 },
            {
              opacity: 1, y: 0,
              duration: 0.55,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: el,
                start: 'top 88%',
                toggleActions: 'play none none none'
              }
            }
          );
        });

        // Gallery items stagger
        const galleryItems = document.querySelectorAll('.gallery-item');
        if (galleryItems.length) {
          gsap.fromTo(galleryItems,
            { opacity: 0, scale: 0.95 },
            {
              opacity: 1, scale: 1,
              duration: 0.5,
              ease: 'power2.out',
              stagger: 0.06,
              scrollTrigger: {
                trigger: galleryItems[0].parentElement,
                start: 'top 82%',
                toggleActions: 'play none none none'
              }
            }
          );
        }

        // Review cards stagger
        const reviewCards = document.querySelectorAll('.review-card, [class*="review"] > div');
        if (reviewCards.length) {
          gsap.fromTo(reviewCards,
            { opacity: 0, y: 28 },
            {
              opacity: 1, y: 0,
              duration: 0.5,
              ease: 'power2.out',
              stagger: 0.08,
              scrollTrigger: {
                trigger: reviewCards[0].parentElement,
                start: 'top 84%',
                toggleActions: 'play none none none'
              }
            }
          );
        }

        // Menu section items stagger
        const menuSections = document.querySelectorAll('.menu-section');
        if (menuSections.length) {
          gsap.fromTo(menuSections,
            { opacity: 0, y: 22 },
            {
              opacity: 1, y: 0,
              duration: 0.45,
              ease: 'power2.out',
              stagger: 0.05,
              scrollTrigger: {
                trigger: menuSections[0].parentElement,
                start: 'top 82%',
                toggleActions: 'play none none none'
              }
            }
          );
        }

        // About image parallax
        const aboutImg = document.querySelector('#about .aspect-\\[4\\/5\\] img');
        if (aboutImg) {
          aboutImg.style.willChange = 'transform';
          ST.create({
            trigger: '#about',
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.8,
            onUpdate: function (self) {
              gsap.set(aboutImg, { y: (self.progress - 0.5) * -50 });
            }
          });
        }

        // Magnetic CTA buttons — desktop only
        setupMagneticButtons();
      },

      // ── Mobile (<768px): reduced experience ────────────────────────────
      '(max-width: 767px)': function () {
        // Hero title: simple fade (no split-text on mobile)
        if (heroH1) {
          gsap.fromTo(heroH1,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', delay: 0.1 }
          );
        }

        const mobileReveal = [heroSub, ...(heroCtas || [])].filter(Boolean);
        if (mobileReveal.length) {
          gsap.fromTo(mobileReveal,
            { opacity: 0, y: 14 },
            {
              opacity: 1, y: 0,
              duration: 0.55,
              ease: 'power2.out',
              stagger: 0.08,
              delay: 0.3
            }
          );
        }

        // Headings reveal (no scrub on mobile)
        document.querySelectorAll('section h2').forEach(function (el) {
          gsap.fromTo(el,
            { opacity: 0, y: 28 },
            {
              opacity: 1, y: 0,
              duration: 0.6,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: el,
                start: 'top 90%',
                toggleActions: 'play none none none'
              }
            }
          );
        });
      }
    });

    // ─── Gallery image treatment ─────────────────────────────────────────
    setupGalleryTreatment();

    // ─── Lottie IntersectionObserver ────────────────────────────────────
    setupLottieObserver();

    // ─── Nav scroll opacity (augment existing handler if present) ────────
    setupNavScroll();
  }

  // ─── Split text into char spans ──────────────────────────────────────────
  function splitChars(el) {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split('').map(function (ch) {
      return '<span aria-hidden="true" style="display:inline-block;white-space:pre">' + ch + '</span>';
    }).join('');
    return el.querySelectorAll('span');
  }

  // ─── SVG grain overlay ───────────────────────────────────────────────────
  function injectGrain() {
    const hero = document.querySelector('header#top');
    if (!hero || hero.querySelector('.grain-overlay')) return;

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('xmlns', svgNs);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:3',
      'opacity:0.038',
      'mix-blend-mode:overlay'
    ].join(';');
    svg.classList.add('grain-overlay');
    svg.setAttribute('aria-hidden', 'true');

    svg.innerHTML = [
      '<filter id="kif-grain">',
      '  <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch"/>',
      '  <feColorMatrix type="saturate" values="0"/>',
      '</filter>',
      '<rect width="100%" height="100%" filter="url(#kif-grain)"/>'
    ].join('');

    hero.appendChild(svg);
  }

  // ─── Lottie food widget ──────────────────────────────────────────────────
  function injectLottie(heroEl) {
    if (!heroEl) return;

    // Check if lottie-player is available
    if (!customElements.get('lottie-player')) return;

    const wrap = document.createElement('div');
    wrap.className = 'lottie-hero-widget';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = [
      'position:absolute',
      'bottom:32px',
      'right:32px',
      'z-index:10',
      'width:72px',
      'height:72px',
      'opacity:0.82',
      'pointer-events:none'
    ].join(';');

    // Inline minimal SVG animation as fallback — steam rising from a cup
    // (avoids relying on external Lottie JSON URL availability)
    wrap.innerHTML = [
      '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
      '  <style>',
      '    @keyframes steam1{0%,100%{transform:translateY(0) scaleX(1);opacity:.7}50%{transform:translateY(-10px) scaleX(1.2);opacity:.2}}',
      '    @keyframes steam2{0%,100%{transform:translateY(0) scaleX(1);opacity:.5}50%{transform:translateY(-12px) scaleX(0.8);opacity:.15}}',
      '    @keyframes steam3{0%,100%{transform:translateY(0) scaleX(1);opacity:.6}50%{transform:translateY(-9px) scaleX(1.1);opacity:.1}}',
      '    .s1{animation:steam1 2.8s ease-in-out infinite}',
      '    .s2{animation:steam2 2.2s ease-in-out infinite .4s}',
      '    .s3{animation:steam3 3.1s ease-in-out infinite .8s}',
      '  </style>',
      '  <!-- Steam wisps -->',
      '  <path class="s1" d="M28 26 Q26 20 28 14 Q30 8 28 4" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.8" stroke-linecap="round"/>',
      '  <path class="s2" d="M36 24 Q34 18 36 12 Q38 6 36 2" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.8" stroke-linecap="round"/>',
      '  <path class="s3" d="M44 26 Q42 20 44 14 Q46 8 44 4" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.8" stroke-linecap="round"/>',
      '  <!-- Cup body -->',
      '  <path d="M18 32 h36 l-4 22 H22 Z" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.6" stroke-linejoin="round"/>',
      '  <!-- Handle -->',
      '  <path d="M54 36 Q64 36 64 43 Q64 50 54 50" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.6" stroke-linecap="round"/>',
      '  <!-- Saucer -->',
      '  <path d="M14 54 Q36 60 58 54" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.4" stroke-linecap="round"/>',
      '</svg>'
    ].join('');

    heroEl.appendChild(wrap);

    // Fade in with GSAP
    if (window.gsap) {
      window.gsap.fromTo(wrap,
        { opacity: 0, y: 10 },
        { opacity: 0.82, y: 0, duration: 1.2, ease: 'power2.out', delay: 1.0 }
      );
    }
  }

  // ─── Gallery image treatment ─────────────────────────────────────────────
  function setupGalleryTreatment() {
    document.querySelectorAll('.gallery-item img').forEach(function (img) {
      img.style.cssText += ';filter:saturate(1.05) contrast(1.05);transition:transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94),filter 0.4s ease;';
      img.parentElement.addEventListener('mouseenter', function () {
        img.style.filter = 'saturate(1.15) contrast(1.08)';
      });
      img.parentElement.addEventListener('mouseleave', function () {
        img.style.filter = 'saturate(1.05) contrast(1.05)';
      });
    });
  }

  // ─── Magnetic CTA buttons ────────────────────────────────────────────────
  function setupMagneticButtons() {
    document.querySelectorAll('.btn-primary, .btn-ghost').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        btn.style.transform = 'translate(' + (dx * 8) + 'px, ' + (dy * 6) + 'px)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });
  }

  // ─── Lottie pause when out of viewport ──────────────────────────────────
  function setupLottieObserver() {
    const players = document.querySelectorAll('lottie-player');
    if (!players.length) return;

    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.play && entry.target.play();
        } else {
          entry.target.pause && entry.target.pause();
        }
      });
    }, { threshold: 0.1 });

    players.forEach(function (p) { obs.observe(p); });
  }

  // ─── Nav scroll augment ───────────────────────────────────────────────────
  function setupNavScroll() {
    // The template already has a scroll handler; we enhance it with smooth
    // opacity on the nav logo and links for dramatic depth.
    const nav = document.querySelector('nav');
    if (!nav) return;

    // Subtle scale-up on nav logo when scrolled back to top
    const logo = nav.querySelector('.font-display');
    if (!logo || !window.gsap) return;

    let lastY = 0;
    window.addEventListener('scroll', function () {
      const y = window.scrollY;
      if (y < 20 && lastY >= 20) {
        window.gsap.to(logo, { scale: 1.05, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 });
      }
      lastY = y;
    }, { passive: true });
  }

})();
