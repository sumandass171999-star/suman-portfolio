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
        ScrollTrigger.refresh();
      }
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

/* ==========================================================================
   New 3D Interactive Wireframe Globe Component (Three.js / WebGL)
   ========================================================================== */
function startNewGlobeComponent() {
  const heroSection = document.getElementById("hero-section");
  const container = document.getElementById("new-globe-container") || document.getElementById("hero-card-container");
  const canvas = document.getElementById("new-globe-canvas") || document.getElementById("hero-globe-canvas");

  if (!heroSection || !container || !canvas) return;

  if (typeof THREE === "undefined") {
    setTimeout(startNewGlobeComponent, 50);
    return;
  }

  const PROJECTS = [
    { src: 'images/krishna.jpg', title: 'Lord Krishna Divine Artwork', subtitle: 'Visual Storytelling • Digital Painting' },
    { src: 'images/lagan poster.jpg', title: 'Lagaan Movie Poster Key Art', subtitle: 'Movie Poster • Key Art Design' },
    { src: 'images/movie poster.jpg', title: 'Action Movie Poster', subtitle: 'Key Art • Visual Arts' },
    { src: 'images/poster of father.jpg', title: 'Tribute Portrait Artwork', subtitle: 'Digital Painting • Visual Design' },
    { src: 'images/vr advertising.jpg', title: 'VR Brand Experience', subtitle: 'Creative Direction • VR Experience' },
    { src: 'images/ocean miracle.jpg', title: 'Ocean Miracle Art', subtitle: 'Concept Art • Environment Design' },
    { src: 'images/ra yatttra.jpg', title: 'Rath Yatra Cultural Art', subtitle: 'Key Art • Visual Storytelling' }
  ];

  let scene, camera, renderer, globeGroup, orbitRingsGroup, particlesGroup;
  let tileMeshes = [];
  let isIntersecting = false;
  let animFrameId = null;

  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };
  let velX = 0.0016;
  let velY = 0;

  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerCurrentX = 0;
  let pointerCurrentY = 0;

  const raycaster = new THREE.Raycaster();
  const mouseVector = new THREE.Vector2();
  let hoveredMesh = null;
  let dragDistance = 0;

  const textureLoader = new THREE.TextureLoader();

  // Eagerly preload artwork textures so quads render images instantly without white card artifacts
  const loadedTextures = PROJECTS.map(p => {
    const tex = textureLoader.load(p.src);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
  });

  function initNewGlobe() {
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    updateCameraDistance();

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Core Group
    globeGroup = new THREE.Group();
    globeGroup.rotation.x = 0.2;
    scene.add(globeGroup);

    // 1. Dark Core & Crisp Thin Cyan Wireframe Earth (~40% Larger: Radius 94)
    // MeshBasicMaterial has ZERO specular reflection glare, eliminating center bright white/cyan spots
    const sphereRadius = 94;
    const coreGeo = new THREE.SphereGeometry(sphereRadius * 0.88, 52, 52);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      wireframe: true,
      transparent: true,
      opacity: 0.38
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    globeGroup.add(coreMesh);

    // Solid inner dark core (hides back wireframe lines for clean 3D depth)
    const innerGeo = new THREE.SphereGeometry(sphereRadius * 0.87, 40, 40);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x030914, transparent: true, opacity: 0.88 });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    globeGroup.add(innerMesh);

    // 2. Orbiting Floating Project Artwork Panels with Natural Aspect Ratios & Direct Texture Mapping
    const totalTiles = 21;
    const phiStep = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < totalTiles; i++) {
      const project = PROJECTS[i % PROJECTS.length];
      const tex = loadedTextures[i % PROJECTS.length];

      const y = 1 - (i / (totalTiles - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phiStep * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      const pos = new THREE.Vector3(x, y, z).multiplyScalar(sphereRadius * 1.06);

      // Preserve natural aspect ratio (portrait vs landscape)
      const isLandscape = project.src.includes('ocean') || project.src.includes('vr');
      const aspect = isLandscape ? 1.5 : 0.72;
      const tileH = 17;
      const tileW = tileH * aspect;

      const planeGeo = new THREE.PlaneGeometry(tileW, tileH);
      const planeMat = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthTest: true,
        depthWrite: true
      });

      const tileMesh = new THREE.Mesh(planeGeo, planeMat);
      tileMesh.position.copy(pos);
      tileMesh.lookAt(pos.clone().multiplyScalar(2));

      tileMesh.userData = {
        project: project,
        originalScale: new THREE.Vector3(1, 1, 1),
        targetScale: new THREE.Vector3(1, 1, 1)
      };

      globeGroup.add(tileMesh);
      tileMeshes.push(tileMesh);
    }

    // 3. Subtle & Thinner Orbital Rings (Reduced size & opacity dominance)
    orbitRingsGroup = new THREE.Group();
    const ringConfigs = [
      { r: sphereRadius * 1.15, rotX: Math.PI / 3, rotY: 0, color: 0x00d4ff, opacity: 0.16 },
      { r: sphereRadius * 1.28, rotX: -Math.PI / 4, rotY: Math.PI / 6, color: 0x38bdf8, opacity: 0.12 },
      { r: sphereRadius * 1.42, rotX: Math.PI / 6, rotY: -Math.PI / 3, color: 0x0284c7, opacity: 0.08 }
    ];

    ringConfigs.forEach(cfg => {
      const ringGeo = new THREE.TorusGeometry(cfg.r, 0.3, 12, 90);
      const ringMat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: cfg.opacity, depthWrite: true, depthTest: true });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = cfg.rotX;
      ringMesh.rotation.y = cfg.rotY;
      orbitRingsGroup.add(ringMesh);
    });

    globeGroup.add(orbitRingsGroup);

    // 4. Floating Dust Field Particles
    particlesGroup = new THREE.Group();
    const particleCount = 140;
    const posArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 400;
      posArray[i + 1] = (Math.random() - 0.5) * 400;
      posArray[i + 2] = (Math.random() - 0.5) * 400;
    }

    const partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const partMat = new THREE.PointsMaterial({
      size: 1.6,
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.45
    });
    const particlesMesh = new THREE.Points(partGeo, partMat);
    particlesGroup.add(particlesMesh);
    scene.add(particlesGroup);

    // Event Listeners
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('click', onTileClick);
    window.addEventListener('resize', onResize);
  }

  function onPointerDown(e) {
    isDragging = true;
    dragDistance = 0;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e) {
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    mouseVector.x = (mouseX / container.clientWidth) * 2 - 1;
    mouseVector.y = -(mouseY / container.clientHeight) * 2 + 1;

    pointerTargetX = mouseVector.x * 0.12;
    pointerTargetY = mouseVector.y * 0.12;

    if (isDragging) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

      velY = deltaX * 0.0025;
      velX = deltaY * 0.0025;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  }

  function onPointerUp() {
    isDragging = false;
  }

  function onTileClick(e) {
    if (dragDistance > 6) return;

    raycaster.setFromCamera(mouseVector, camera);
    const intersects = raycaster.intersectObjects(tileMeshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const proj = clickedMesh.userData.project;
      if (proj && typeof openLightbox === "function") {
        openLightbox(proj.src, proj.title, proj.subtitle);
      }
    }
  }

  function updateCameraDistance() {
    if (!camera) return;
    const w = window.innerWidth;
    if (w <= 480) {
      camera.position.z = 310;
    } else if (w <= 768) {
      camera.position.z = 275;
    } else {
      camera.position.z = 245;
    }
  }

  function onResize() {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth || 600;
    const h = container.clientHeight || 600;
    updateCameraDistance();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate() {
    if (!isIntersecting) return;

    if (!isDragging) {
      velY *= 0.96;
      velX *= 0.96;
      if (Math.abs(velY) < 0.001) velY = 0.0014;
    }

    globeGroup.rotation.y += velY;
    globeGroup.rotation.x += velX;

    pointerCurrentX += (pointerTargetX - pointerCurrentX) * 0.05;
    pointerCurrentY += (pointerTargetY - pointerCurrentY) * 0.05;
    scene.rotation.y = pointerCurrentX;
    scene.rotation.x = pointerCurrentY;

    if (orbitRingsGroup) {
      orbitRingsGroup.children.forEach((ring, idx) => {
        ring.rotation.z += (idx + 1) * 0.001 * (idx % 2 === 0 ? 1 : -1);
      });
    }

    raycaster.setFromCamera(mouseVector, camera);
    const intersects = raycaster.intersectObjects(tileMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hoveredMesh !== hit) {
        if (hoveredMesh) hoveredMesh.scale.set(1, 1, 1);
        hoveredMesh = hit;
      }
      hoveredMesh.scale.lerp(new THREE.Vector3(1.24, 1.24, 1.24), 0.15);
      container.style.cursor = 'pointer';
    } else {
      if (hoveredMesh) {
        hoveredMesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.15);
        if (hoveredMesh.scale.x < 1.01) hoveredMesh = null;
      }
      container.style.cursor = isDragging ? 'grabbing' : 'grab';
    }

    renderer.render(scene, camera);
    animFrameId = requestAnimationFrame(animate);
  }

  // Initialize 3D Globe immediately on load
  if (!scene) {
    initNewGlobe();
    onResize();
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          isIntersecting = true;
          onResize();
          if (!animFrameId) animFrameId = requestAnimationFrame(animate);
        } else {
          isIntersecting = false;
          if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
          }
        }
      });
    }, { threshold: 0 });

    observer.observe(heroSection);
  } else {
    isIntersecting = true;
    onResize();
    if (!animFrameId) animFrameId = requestAnimationFrame(animate);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startNewGlobeComponent);
} else {
  startNewGlobeComponent();
}
