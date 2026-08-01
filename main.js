(function () {
  'use strict';

  const TOTAL_FRAMES = 208;
  const FRAME_PREFIX = 'frames/ezgif-frame-';
  const FRAME_EXT = '.jpg';

  const images = [];
  let loadedCount = 0;
  let currentFrameIndex = 0;
  let animationFrameId = null;

  let isAutoplayActive = true;
  let autoplayTween = null;

  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  const loaderOverlay = document.getElementById('loader');
  const loaderText = document.getElementById('loader-text');
  const loaderBar = document.getElementById('loader-bar');

  function getFramePath(index) {
    const paddedNum = String(index).padStart(3, '0');
    return `${FRAME_PREFIX}${paddedNum}${FRAME_EXT}`;
  }

  // Preload all 208 frame images
  function preloadImages() {
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFramePath(i);

      img.onload = () => handleImageLoad();
      img.onerror = () => handleImageLoad(); // Continue even if error occurs

      images.push(img);
    }
  }

  function handleImageLoad() {
    loadedCount++;
    const progress = Math.min(Math.floor((loadedCount / TOTAL_FRAMES) * 100), 100);

    if (loaderText) loaderText.textContent = `Loading ${progress}%`;
    if (loaderBar) loaderBar.style.width = `${progress}%`;

    if (loadedCount >= TOTAL_FRAMES) {
      onAllFramesLoaded();
    }
  }

  function onAllFramesLoaded() {
    // Hide loader overlay
    if (loaderOverlay) {
      loaderOverlay.classList.add('hidden');
    }

    // Initialize Canvas & ScrollTrigger
    initApp();
  }

  // Render frame on Canvas with responsive aspect-cover scaling
  function renderFrame(index) {
    const targetIndex = Math.min(Math.max(Math.round(index), 0), TOTAL_FRAMES - 1);
    const img = images[targetIndex];

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

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

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    currentFrameIndex = targetIndex;
  }

  // Handle High-DPI canvas resizing
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

      gsap.to(frameState, {
        frame: TOTAL_FRAMES - 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.scroll-container',
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          onUpdate: (self) => {
            const targetFrameIndex = Math.round(frameState.frame);
            if (targetFrameIndex !== currentFrameIndex) {
              if (animationFrameId) cancelAnimationFrame(animationFrameId);
              animationFrameId = requestAnimationFrame(() => {
                renderFrame(targetFrameIndex);
              });
            }
          }
        }
      });

      // Refresh ScrollTrigger to ensure correct scroll bounds calculation
      ScrollTrigger.refresh();

      // Listen for user input events to immediately cancel autoplay on user scroll
      window.addEventListener('wheel', stopAutoplay, { passive: true });
      window.addEventListener('touchmove', stopAutoplay, { passive: true });
      window.addEventListener('pointerdown', stopAutoplay, { passive: true });
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab'].includes(e.key)) {
          stopAutoplay();
        }
      }, { passive: true });

      // Start initial single autoplay pass from Frame 1 to last frame
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const scrollObj = { y: 0 };

      autoplayTween = gsap.to(scrollObj, {
        y: maxScroll,
        duration: 4.5,
        ease: 'power1.inOut',
        onUpdate: () => {
          if (isAutoplayActive) {
            window.scrollTo(0, scrollObj.y);
          }
        },
        onComplete: () => {
          stopAutoplay();
        }
      });
    }
  }

  // Prevent scroll jump on reload to start at top (frame 1)
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  // Start preloading
  preloadImages();
})();
