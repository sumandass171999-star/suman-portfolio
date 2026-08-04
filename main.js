(function () {
  'use strict';

  const TOTAL_FRAMES = 208;
  const FRAME_PREFIX = 'frames/ezgif-frame-';
  const FRAME_EXT = '.jpg';

  const images = [];
  let loadedCount = 0;
  let currentFrameIndex = 0;
  let pendingFrameIndex = null;
  let isTicking = false;

  let isAutoplayActive = true;
  let autoplayTween = null;

  const canvas = document.getElementById('hero-canvas') || document.getElementById('intro-frame-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
  }

  const loaderOverlay = document.getElementById('loader') || document.getElementById('intro-loader');
  const loaderText = document.getElementById('loader-text') || document.getElementById('intro-loader-text');
  const loaderBar = document.getElementById('loader-bar') || document.getElementById('intro-loader-bar');

  function getFramePath(index) {
    const paddedNum = String(index).padStart(3, '0');
    return `${FRAME_PREFIX}${paddedNum}${FRAME_EXT}`;
  }

  // Preload all 208 frame images
  function preloadImages() {
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.loading = 'eager';
      img.src = getFramePath(i);

      img.onload = () => handleImageLoad();
      img.onerror = () => {
        const altImg = new Image();
        altImg.loading = 'eager';
        altImg.src = `ezgif-frame-${String(i).padStart(3, '0')}.jpg`;
        altImg.onload = () => {
          images[i - 1] = altImg;
          handleImageLoad();
        };
        altImg.onerror = () => handleImageLoad();
      };

      images.push(img);
    }
  }

  function handleImageLoad() {
    loadedCount++;
    const progress = Math.min(Math.floor((loadedCount / TOTAL_FRAMES) * 100), 100);

    if (loaderText) loaderText.textContent = `LOADING ${progress}%`;
    if (loaderBar) loaderBar.style.width = `${progress}%`;

    if (loadedCount >= TOTAL_FRAMES) {
      onAllFramesLoaded();
    }
  }

  function onAllFramesLoaded() {
    // Hide loader overlay
    if (loaderOverlay) {
      loaderOverlay.style.opacity = '0';
      setTimeout(() => {
        loaderOverlay.style.display = 'none';
        loaderOverlay.classList.add('hidden');
      }, 700);
    }

    // Initialize Canvas & ScrollTrigger
    initApp();
  }

  // Render frame on Canvas with responsive aspect-cover (desktop) and aspect-contain (mobile) scaling
  function renderFrame(index) {
    const targetIndex = Math.min(Math.max(Math.round(index), 0), TOTAL_FRAMES - 1);
    const img = images[targetIndex];

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

    const isMobile = window.innerWidth <= 768 || canvasRatio < 1.0;

    if (isMobile) {
      // Mobile-specific aspect-contain scaling: keep entire frame visible without cropping
      drawWidth = canvasWidth;
      drawHeight = canvasWidth / imgRatio;

      if (drawHeight > canvasHeight) {
        drawHeight = canvasHeight;
        drawWidth = canvasHeight * imgRatio;
      }

      offsetX = (canvasWidth - drawWidth) / 2;
      offsetY = (canvasHeight - drawHeight) / 2;
    } else {
      // Desktop aspect-cover scaling (unchanged visual behavior for desktop)
      if (canvasRatio > imgRatio) {
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imgRatio;
        offsetX = 0;
        offsetY = (canvasHeight - drawHeight) / 2;
      } else {
        drawWidth = canvasHeight * imgRatio;
        drawHeight = canvasHeight;
        offsetX = (canvasWidth - drawWidth) / 2;
        offsetY = 0;
      }
    }

    // Solid dark fill background to avoid alpha blending/ghosting artifacts
    ctx.fillStyle = '#030b12';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    currentFrameIndex = targetIndex;
  }

  // RequestAnimationFrame throttled frame scheduler
  function scheduleRender(index) {
    const targetIndex = Math.min(Math.max(Math.round(index), 0), TOTAL_FRAMES - 1);
    if (targetIndex === currentFrameIndex && pendingFrameIndex === null) return;

    pendingFrameIndex = targetIndex;
    if (!isTicking) {
      isTicking = true;
      requestAnimationFrame(() => {
        if (pendingFrameIndex !== null) {
          renderFrame(pendingFrameIndex);
          pendingFrameIndex = null;
        }
        isTicking = false;
      });
    }
  }

  // Handle High-DPI canvas resizing (optimized DPR for mobile performance)
  function resizeCanvas() {
    const isMobile = window.innerWidth <= 768;
    const dprCap = isMobile ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    renderFrame(currentFrameIndex);
  }

  // Immediately stop autoplay when user scrolls or interacts
  function stopAutoplay() {
    if (isAutoplayActive) {
      isAutoplayActive = false;
      if (autoplayTween) {
        autoplayTween.kill();
        autoplayTween = null;
      }
    }
  }

  function initApp() {
    // Canvas sizing setup
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    // Render initial 1st frame (0% scroll)
    renderFrame(0);

    // Register GSAP ScrollTrigger
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);

      const frameState = { frame: 0 };
      const scrollTriggerEl = document.querySelector('.scroll-container');

      if (scrollTriggerEl) {
        gsap.to(frameState, {
          frame: TOTAL_FRAMES - 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '.scroll-container',
            start: 'top top',
            end: 'bottom bottom',
            scrub: true,
            onUpdate: () => {
              scheduleRender(frameState.frame);
            }
          }
        });
      }

      // Hero Section Parallax & Stagger Reveal
      const heroSection = document.getElementById('hero-section');
      if (heroSection) {
        const heroElements = document.querySelectorAll('.hero-reveal-element');
        if (heroElements.length > 0) {
          gsap.fromTo(heroElements,
            { y: 40, opacity: 0, scale: 0.97 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              duration: 1.0,
              stagger: 0.12,
              ease: 'power3.out',
              clearProps: 'transform,opacity',
              scrollTrigger: {
                trigger: '#hero-section',
                start: 'top 85%',
                toggleActions: 'play none none none'
              }
            }
          );
        }

        const textContainer = document.getElementById('hero-text-container');
        const cardContainer = document.getElementById('hero-card-container');
        const badge1 = document.querySelector('.hero-parallax-badge-1');
        const badge2 = document.querySelector('.hero-parallax-badge-2');
        const ambientGlow = document.querySelector('.hero-ambient-glow');

        const heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: '#hero-section',
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
            invalidateOnRefresh: true
          }
        });

        if (textContainer) heroTl.to(textContainer, { y: -50, opacity: 0.85, ease: 'none' }, 0);
        if (cardContainer) heroTl.to(cardContainer, { y: 35, scale: 0.96, opacity: 0.9, ease: 'none' }, 0);
        if (badge1) heroTl.to(badge1, { y: -40, x: -10, ease: 'none' }, 0);
        if (badge2) heroTl.to(badge2, { y: 30, x: 10, ease: 'none' }, 0);
        if (ambientGlow) heroTl.to(ambientGlow, { opacity: 0, scale: 0.6, ease: 'none' }, 0);
      }

      ScrollTrigger.refresh();
    }

    // Passive event listeners for user input
    window.addEventListener('wheel', stopAutoplay, { passive: true });
    window.addEventListener('touchmove', stopAutoplay, { passive: true });
    window.addEventListener('pointerdown', stopAutoplay, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab'].includes(e.key)) {
        stopAutoplay();
      }
    }, { passive: true });
  }

  // Prevent scroll jump on reload to start at top (frame 1)
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  // Start preloading
  preloadImages();
})();
