(() => {
  "use strict";

  const POST_SELECTOR = 'article[data-testid="tweet"], article[role="article"]';
  const BACKGROUND_PROTECTED_SELECTOR = 'button, input, select, textarea, [role="button"], [role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], [aria-modal="true"], [data-testid="Dropdown"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid^="UserAvatar"]';

  function statusId(pathname) {
    return String(pathname).match(/^\/(?:[^/]+\/status|i\/web\/status)\/(\d+)(?:\/|$)/)?.[1] || null;
  }

  function findDetailPost(root, pathname) {
    const id = statusId(pathname);
    if (!id) return null;
    // Match the post's own timestamp, rather than a quoted post or a link in its text.
    for (const time of root.querySelectorAll("time")) {
      const post = time.closest(POST_SELECTOR);
      const link = time.closest("a[href]");
      if (post && link && link.closest(POST_SELECTOR) === post
        && !time.closest('[data-testid="quoteTweet"]') && statusId(link.pathname) === id) return post;
    }
    return null;
  }

  // Keep the browser entry self-contained: already loaded manifests may have an older script list.
  const Posts = Object.freeze({ POST_SELECTOR, statusId, findDetailPost });
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Posts;
    return;
  }

  const Core = globalThis.XAmbientCore;
  const Settings = globalThis.XAmbientSettings;
  const Streaming = globalThis.XAmbientStreaming;
  const Instagram = globalThis.XAmbientInstagram;
  const YouTube = globalThis.XAmbientYouTube;
  if (!Core || !Settings) return;
  globalThis.__xAmbientDispose?.();
  const platform = Streaming?.platformForHostname(location.hostname) || "x";
  const instagram = platform === "instagram";
  const youtube = platform === "youtube";
  const streaming = platform === "twitch" || platform === "kick";
  const automatic = streaming || instagram || youtube;
  const cards = platform === "x" ? globalThis.XAmbientCardLayout?.create() : null;

  const IMAGE_SELECTOR = instagram ? "img" : [
    '[data-testid="tweetPhoto"] img',
    'img[src*="pbs.twimg.com/media/"]',
    'img[src*="pbs.twimg.com/tweet_video_thumb/"]',
    'img[src*="pbs.twimg.com/ext_tw_video_thumb/"]',
    'img[src*="pbs.twimg.com/amplify_video_thumb/"]',
  ].join(",");
  const FRAME_INTERVAL = 1000 / 12;
  const hasStorage = typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const colorScheme = matchMedia("(prefers-color-scheme: dark)");
  const removers = [];
  const posterCache = new WeakMap();
  let settings = { ...Settings.DEFAULTS };
  let pathname = location.pathname;
  const routeKey = () => youtube ? `${location.pathname}:${YouTube?.routeId(location) || ""}` : location.pathname;
  let route = routeKey();
  let youtubeNavigating = false;
  let nativeAmbientOwner = null;
  let fullscreenTarget = null;
  let pointer = null;
  let activePost = null;
  let previewPost = null;
  let pendingPost = null;
  let hoverTimer = 0;
  let reconcileFrame = 0;
  let frameHandle = null;
  let lastPaint = 0;
  let media = [];
  let signature = "";
  let bounds = null;
  let projection = null;
  let protectionKey = "";
  let backgroundActive = false;
  let backgroundDirty = true;
  let backgroundRestoreTimer = 0;
  const clearedBackgrounds = new Set();
  let front = 0;
  let disposed = false;
  let embedObservedVideo = null;
  let embedVisible = true;
  // The browser computes ancestor-frame clipping without reading the parent document.
  const embedIntersectionObserver = youtube && Boolean(YouTube.embedId(location)) && typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
      const entry = entries.find(entry => entry.target === embedObservedVideo);
      if (!entry) return;
      const visible = entry.isIntersecting && entry.intersectionRect.width > 4 && entry.intersectionRect.height > 4;
      if (visible !== embedVisible) {
        embedVisible = visible;
        // Hidden frames can suspend rAF; stop immediately rather than queueing a paint.
        if (!visible) deactivate(); else scheduleReconcile();
      }
    }, { threshold: [0, 0.01] }) : null;

  const host = document.createElement("div");
  host.id = "x-ambient-light";
  host.dataset.platform = platform;
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `all:initial;position:fixed;inset:0;z-index:${platform === "x" ? -1 : 2147483600};pointer-events:none;display:block;overflow:hidden;contain:strict;`;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { --xa-opacity: .65; --xa-blur: 56px; }
    .light { position:absolute; inset:0; pointer-events:none; opacity:0; transition:opacity 320ms ease; mask-repeat:no-repeat; mask-composite:add; -webkit-mask-composite:source-over; }
    .light.visible { opacity:var(--xa-opacity); }
    .field { position:absolute; inset:0; pointer-events:none; }
    canvas { position:absolute; inset:0; width:100%; height:100%; opacity:0; transition:opacity 300ms ease; filter:blur(var(--xa-blur)) saturate(1.65); }
    canvas.front { opacity:1; }
    @media (prefers-reduced-motion:reduce) { .light, canvas { transition:none; } }
    :host([data-presentation="fullscreen"]) .light { transition:none; }
  `;
  const light = document.createElement("div");
  light.className = "light";
  const field = document.createElement("div");
  field.className = "field";
  const canvases = [document.createElement("canvas"), document.createElement("canvas")];
  for (const canvas of canvases) {
    canvas.width = 144;
    canvas.height = 96;
    field.append(canvas);
  }
  light.append(field);
  shadow.append(style, light);
  const backgroundStyle = document.createElement("style");
  backgroundStyle.textContent = ".xa-background-clear { background-color:transparent !important; }";
  backgroundStyle.disabled = true;
  if (platform === "x") {
    document.documentElement.append(backgroundStyle);
    style.textContent += "canvas { filter:blur(var(--xa-blur)); }";
  }
  const youtubeStyle = youtube ? document.createElement("style") : null;
  if (youtubeStyle) {
    // Only suppress YouTube's visual layer while ours is actually drawing.
    // Never change YouTube's stored ambient preference or its controls.
    youtubeStyle.textContent = "ytd-watch-flexy.xa-youtube-active #cinematics, ytd-reel-video-renderer.xa-youtube-active #cinematic-container, ytd-reel-video-renderer.xa-youtube-active #shorts-cinematic-container { visibility:hidden !important; }";
    document.documentElement.append(youtubeStyle);
  }
  document.documentElement.append(host);
  const contexts = canvases.map((canvas) => canvas.getContext("2d"));
  const mosaic = document.createElement("canvas");
  mosaic.width = 144;
  const mosaicContext = mosaic.getContext("2d");
  if (!mosaicContext || contexts.some((context) => !context)) {
    host.remove();
    return;
  }

  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    removers.push(() => target.removeEventListener(type, callback, options));
  }

  function viewport() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  function eligible() {
    if (!settings.enabled || settings.intensity <= 0 || document.hidden) return false;
    if (!youtube) return !document.fullscreenElement;
    const video = !youtubeNavigating && YouTube?.findVideo(document, location);
    const embed = Boolean(YouTube.embedId(location));
    if (embedIntersectionObserver && embedObservedVideo !== (embed ? video : null)) {
      embedIntersectionObserver.disconnect();
      embedObservedVideo = embed ? video : null;
      embedVisible = true;
      if (embedObservedVideo) embedIntersectionObserver.observe(embedObservedVideo);
    }
    if (!video) return false;
    if (embed && !embedVisible) return false;
    if (!document.fullscreenElement && !YouTube.embedId(location)) return true;
    const box = video.getBoundingClientRect();
    const content = imageDescriptor(video, video, box, box)?.fullRect;
    return YouTube.hasFullscreenSpace(content, viewport());
  }

  function syncYouTubePresentation() {
    if (!youtube) return;
    const video = YouTube?.findVideo(document, location);
    const target = YouTube?.fullscreenContainer(document, video) || null;
    if (target !== fullscreenTarget) {
      deactivate();
      fullscreenTarget = target;
    }
    const parent = target || document.documentElement;
    if (host.parentElement !== parent) parent.append(host);
    const presentation = target ? "fullscreen" : "page";
    if (host.dataset.presentation !== presentation) host.dataset.presentation = presentation;
    if (host.style.position !== (target ? "absolute" : "fixed")) host.style.position = target ? "absolute" : "fixed";
  }

  function syncNativeAmbient(active) {
    if (!youtube) return;
    const owner = active ? activePost?.closest("ytd-watch-flexy, ytd-reel-video-renderer") : null;
    if (nativeAmbientOwner !== owner) nativeAmbientOwner?.classList.remove("xa-youtube-active");
    nativeAmbientOwner = owner;
    if (owner && !owner.classList.contains("xa-youtube-active")) owner.classList.add("xa-youtube-active");
  }

  function scheduleReconcile() {
    if (disposed || reconcileFrame) return;
    reconcileFrame = requestAnimationFrame(() => {
      reconcileFrame = 0;
      reconcile();
    });
  }

  function updateTheme() {
    if (platform === "x") return;
    if (youtube && YouTube.embedId(location)) { host.style.mixBlendMode = "normal"; return; }
    // Player fullscreen uses black bars; Shorts can fullscreen the light-themed HTML root.
    if (fullscreenTarget && (fullscreenTarget !== document.documentElement || !YouTube.shortsId(location))) { host.style.mixBlendMode = "screen"; return; }
    const backgrounds = [document.documentElement, document.body].filter(Boolean)
      .map(element => getComputedStyle(element).backgroundColor);
    let dark = colorScheme.matches;
    for (const color of backgrounds) dark = Core.isDarkColor(color, dark);
    host.style.mixBlendMode = dark ? "screen" : "multiply";
  }

  function observeBackgrounds() {
    if (platform !== "x" || !backgroundActive) return;
    backgroundObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "role", "aria-modal"] });
    backgroundObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  }

  function syncBackgrounds() {
    if (platform !== "x") return;
    clearTimeout(backgroundRestoreTimer);
    backgroundRestoreTimer = 0;
    if (backgroundActive && !backgroundDirty) return;
    backgroundActive = true;
    backgroundDirty = false;
    backgroundObserver.disconnect();
    // Temporarily reveal native styles for theme detection, then expose only plain page surfaces.
    // Normal compositing behind the UI lets intensity mix the theme with unmodified media colors.
    backgroundStyle.disabled = true;
    const nativeColors = [document.documentElement, document.body].map(element => getComputedStyle(element).backgroundColor);
    host.style.backgroundColor = Core.resolveBackgroundColor(nativeColors, colorScheme.matches);
    const next = new Set();
    for (const element of document.querySelectorAll("body, body :is(div, main, article, section, aside, header, footer, nav)")) {
      if (element.closest(BACKGROUND_PROTECTED_SELECTOR)) continue;
      if (settings.scope === "post" && activePost?.contains(element)) continue;
      const computed = getComputedStyle(element);
      if (computed.backgroundColor === "rgba(0, 0, 0, 0)" || computed.backgroundImage !== "none"
        || Number(computed.zIndex) > 10) continue;
      const rect = element.getBoundingClientRect();
      if (element !== document.body && (rect.width < 150 || rect.height < 32)) continue;
      if (!element.classList.contains("xa-background-clear")) element.classList.add("xa-background-clear");
      next.add(element);
    }
    for (const element of clearedBackgrounds) if (!next.has(element)) element.classList.remove("xa-background-clear");
    clearedBackgrounds.clear();
    for (const element of next) clearedBackgrounds.add(element);
    backgroundStyle.disabled = false;
    observeBackgrounds();
  }

  function restoreBackgrounds() {
    clearTimeout(backgroundRestoreTimer);
    backgroundRestoreTimer = 0;
    backgroundActive = false;
    backgroundDirty = true;
    backgroundObserver.disconnect();
    backgroundStyle.disabled = true;
    for (const element of clearedBackgrounds) element.classList.remove("xa-background-clear");
    clearedBackgrounds.clear();
    host.style.removeProperty("background-color");
  }

  function releaseBackgrounds() {
    if (platform !== "x" || !backgroundActive || backgroundRestoreTimer) return;
    backgroundRestoreTimer = window.setTimeout(restoreBackgrounds, reducedMotion.matches ? 0 : 320);
  }

  function applySettings(value) {
    const scope = settings.scope;
    settings = Settings.normalize(value);
    if (settings.scope !== scope) backgroundDirty = true;
    cards?.setEnabled(settings.fitCards);
    host.style.setProperty("--xa-opacity", String(settings.intensity / 100));
    host.style.setProperty("--xa-blur", `${settings.blur}px`);
    if (!eligible()) deactivate();
    else scheduleReconcile();
  }

  function stopFrames() {
    if (!frameHandle) return;
    if (frameHandle.type === "video") frameHandle.video.cancelVideoFrameCallback(frameHandle.id);
    else cancelAnimationFrame(frameHandle.id);
    frameHandle = null;
  }

  function deactivate() {
    syncNativeAmbient(false);
    clearTimeout(hoverTimer);
    hoverTimer = 0;
    pendingPost = null;
    activePost = null;
    media = [];
    signature = "";
    bounds = null;
    projection = null;
    host.dataset.mediaCount = "0";
    activeObserver.disconnect();
    activeResizeObserver?.disconnect();
    stopFrames();
    light.classList.remove("visible");
    releaseBackgrounds();
  }

  function visibleRect(element, fullRect, minSize = 48, minIntersection = 16) {
    const view = viewport();
    if (!Core.isVisibleRect(fullRect, view, minSize, minIntersection)) return null;
    const computed = getComputedStyle(element);
    if (computed.visibility === "hidden" || computed.visibility === "collapse" || computed.opacity === "0") return null;
    let rect = Core.intersectRect(fullRect, { left: 0, top: 0, right: view.width, bottom: view.height });
    for (let parent = element.parentElement; rect && parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.opacity === "0" || ((instagram || youtube) && (parent.hidden || parent.getAttribute("aria-hidden") === "true"))) return null;
      // HTML propagates body overflow to the viewport when root overflow is visible.
      // YouTube's body can have zero height while its app visibly overflows it.
      const rootStyle = parent === document.body ? getComputedStyle(document.documentElement) : null;
      const viewportOverflow = rootStyle?.overflowX === "visible" && rootStyle?.overflowY === "visible";
      const clipX = !viewportOverflow && ["hidden", "clip", "auto", "scroll"].includes(style.overflowX);
      const clipY = !viewportOverflow && ["hidden", "clip", "auto", "scroll"].includes(style.overflowY);
      // Root overflow clips to the viewport, already applied above, not its scrolled DOM box.
      if ((clipX || clipY) && parent !== document.documentElement && style.display !== "contents") {
        rect = Core.intersectRect(rect, parent.getBoundingClientRect(), clipX, clipY);
      }
      if (parent === fullscreenTarget || (!instagram && parent === activePost)) break;
    }
    return rect && rect.width >= minIntersection && rect.height >= minIntersection ? rect : null;
  }

  function imageDescriptor(source, owner, rect, fullRect) {
    const computed = getComputedStyle(owner);
    const backgroundImage = owner !== source && owner.tagName !== "VIDEO";
    const values = (backgroundImage ? computed.backgroundPosition : computed.objectPosition).split(" ");
    const position = values.map((value) => value.endsWith("%") ? Math.max(0, Math.min(1, parseFloat(value) / 100)) : 0.5);
    const fit = backgroundImage ? (computed.backgroundSize === "contain" ? "contain" : "cover") : computed.objectFit;
    const normalizedPosition = [position[0] ?? 0.5, position[1] ?? 0.5];
    const content = Core.contentRect(source.videoWidth || source.naturalWidth, source.videoHeight || source.naturalHeight, fullRect, fit, normalizedPosition);
    const visible = Core.intersectRect(rect, content);
    if (!visible) return null;
    return { source, owner, rect: visible, fullRect: content, fit: fit === "contain" || fit === "scale-down" ? "fill" : fit, position: normalizedPosition };
  }

  function imagePresenter(image) {
    if (getComputedStyle(image).opacity !== "0") return image;
    // X's React Native Image displays a background div and keeps its loaded img transparent.
    return [...image.parentElement.children].find((element) => element !== image
      && getComputedStyle(element).backgroundImage !== "none") || image;
  }

  function posterFor(video) {
    if (!video.poster) return null;
    let entry = posterCache.get(video);
    if (!entry || entry.url !== video.poster) {
      const image = new Image();
      entry = { url: video.poster, image };
      posterCache.set(video, entry);
      image.addEventListener("load", () => {
        if (!disposed && activePost?.contains(video)) scheduleReconcile();
      }, { once: true });
      image.src = video.poster;
    }
    return entry.image.complete && entry.image.naturalWidth ? entry.image : null;
  }

  function instagramPoster(video) {
    const box = video.getBoundingClientRect();
    for (let parent = video.parentElement; parent && !parent.matches('main, [role="main"]'); parent = parent.parentElement) {
      if (parent.querySelectorAll("video").length > 1) break;
      const image = [...parent.querySelectorAll("img")].find(image => image.complete && image.naturalWidth
        && Core.overlapFraction(box, image.getBoundingClientRect()) > 0.8);
      if (image) return image;
      if (parent.matches("article")) break;
    }
    return null;
  }

  function instagramCandidate(post) {
    const items = [];
    let playing = false;
    for (const element of post.matches("video") ? [post] : post.querySelectorAll("img, video")) {
      if (element.tagName === "IMG" && !Instagram.isPostImage(element)) continue;
      const fullRect = element.getBoundingClientRect();
      if (fullRect.width < 160 || fullRect.height < 90) continue;
      const rect = visibleRect(element, fullRect, 90, 24);
      if (!rect) continue;
      items.push({ rect, fullRect });
      if (element.tagName === "VIDEO" && !element.paused && !element.ended) playing = true;
    }
    return {
      post, playing, dialog: Boolean(post.closest('[role="dialog"]')),
      rect: Core.unionRects(items.map(item => item.rect)),
      fullRect: Core.unionRects(items.map(item => item.fullRect)),
    };
  }

  function findMedia(post) {
    const videos = [];
    for (const video of post.matches("video") ? [post] : post.querySelectorAll("video")) {
      const fullRect = video.getBoundingClientRect();
      const rect = visibleRect(video, fullRect);
      if (!rect) continue;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        const descriptor = imageDescriptor(video, video, rect, fullRect);
        if (descriptor) videos.push(descriptor);
      }
      else if (!youtube) {
        // YouTube uses only ready in-page video frames; never refetch its poster.
        const poster = posterFor(video);
        const sibling = !poster && instagram && instagramPoster(video);
        const descriptor = poster ? imageDescriptor(poster, video, rect, fullRect)
          : sibling && imageDescriptor(sibling, sibling, rect, sibling.getBoundingClientRect());
        if (descriptor) videos.push(descriptor);
      }
    }
    const images = [];
    for (const image of post.querySelectorAll(IMAGE_SELECTOR)) {
      if (image.closest('[data-testid^="UserAvatar"]') || !image.complete || !image.naturalWidth) continue;
      if (instagram && !Instagram.isPostImage(image)) continue;
      const presenter = imagePresenter(image);
      const fullRect = presenter.getBoundingClientRect();
      if (instagram && (fullRect.width < 160 || fullRect.height < 90)) continue;
      const rect = visibleRect(presenter, fullRect);
      if (!rect || videos.some((video) => Core.overlapFraction(rect, video.rect) > 0.8)) continue;
      if (images.some((other) => Core.overlapFraction(rect, other.rect) > 0.9)) continue;
      const descriptor = imageDescriptor(image, presenter, rect, fullRect);
      if (descriptor) images.push(descriptor);
    }
    const found = [...videos, ...images];
    // A carousel contributes its current slide, not hidden/preloaded neighbors.
    if (instagram) return found.sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height).slice(0, 1);
    return found.slice(0, 4);
  }

  function sourceKey(item) {
    return `${item.source.tagName}:${item.source.currentSrc || item.source.src || ""}:${Math.round(item.rect.width)}x${Math.round(item.rect.height)}:${Math.round(item.rect.left - item.fullRect.left)},${Math.round(item.rect.top - item.fullRect.top)}`;
  }

  function updateLayout() {
    if (!activePost || !bounds) return;
    const view = viewport();
    const shorts = youtube && Boolean(YouTube.shortsId(location));
    const embed = youtube && Boolean(YouTube.embedId(location));
    const youtubeProtection = embed ? YouTube.EMBED_PROTECTED_SELECTOR : shorts ? YouTube.SHORTS_PROTECTED_SELECTOR : YouTube.PROTECTED_SELECTOR;
    const scope = fullscreenTarget ? "fullscreen" : shorts || embed ? "page" : settings.scope;
    host.dataset.scope = scope;
    host.dataset.projection = "rays";
    let region;
    if (scope === "page" || scope === "fullscreen") {
      const protectedRects = [];
      const protectedElements = fullscreenTarget
        ? [activePost, ...fullscreenTarget.querySelectorAll(youtubeProtection)]
        : shorts || embed ? [activePost, ...document.querySelectorAll(youtubeProtection)]
          : document.querySelectorAll("img, video, canvas");
      for (const element of protectedElements) {
        // Instagram's decorative Reel backdrop must remain part of the lit background.
        if (instagram && element.tagName === "IMG" && element.getAttribute("aria-hidden") === "true") continue;
        const presenter = element.tagName === "IMG" ? imagePresenter(element) : element;
        const box = presenter.getBoundingClientRect();
        const picture = imageDescriptor(element, presenter, box, box)?.fullRect || box;
        const rect = visibleRect(presenter, picture, 8, 8);
        if (!rect) continue;
        const rounded = presenter.closest('[data-testid="tweetPhoto"], [data-testid^="UserAvatar"], [data-testid="videoPlayer"]') || presenter;
        const radiusValue = getComputedStyle(rounded).borderTopLeftRadius;
        const radius = radiusValue.endsWith("%") ? Math.min(rect.width, rect.height) * parseFloat(radiusValue) / 100 : parseFloat(radiusValue) || 0;
        const letterboxed = Math.abs(picture.width - box.width) > 2 || Math.abs(picture.height - box.height) > 2;
        protectedRects.push({ ...rect, radius: letterboxed ? 0 : Math.min(radius, rect.width / 2, rect.height / 2) });
      }
      const embedClip = embed ? Core.buildBackgroundClip(protectedRects, view) : "none";
      const nextKey = embed ? `embed:${embedClip}` : `${view.width}:${view.height}:${protectedRects.map((rect) => [rect.left, rect.top, rect.width, rect.height, rect.radius].map(Math.round).join(",")).join(";")}`;
      if (nextKey !== protectionKey) {
        light.style.maskImage = embed ? "none" : Core.buildMediaMask(protectedRects, view);
        light.style.clipPath = embedClip;
        protectionKey = nextKey;
      }
      const padding = settings.blur * 2;
      region = { left: -padding, top: -padding, width: view.width + padding * 2, height: view.height + padding * 2 };
    } else {
      protectionKey = "";
      light.style.clipPath = "none";
      light.style.maskImage = Core.buildPostMask(activePost.getBoundingClientRect(), view);
      const padding = 60 + settings.spread * 3.4;
      region = { left: bounds.left - padding, top: bounds.top - padding, width: bounds.width + padding * 2, height: bounds.height + padding * 2 };
    }
    field.style.cssText = `position:absolute;left:${region.left}px;top:${region.top}px;width:${region.width}px;height:${region.height}px;`;
    const scale = 256 / Math.max(region.width, region.height);
    const size = { width: Math.round(region.width * scale), height: Math.round(region.height * scale) };
    const target = {
      left: (bounds.left - region.left) / region.width * size.width,
      top: (bounds.top - region.top) / region.height * size.height,
      width: bounds.width / region.width * size.width,
      height: bounds.height / region.height * size.height,
    };
    const source = { width: mosaic.width, height: Math.max(48, Math.min(144, Math.round(144 * bounds.height / bounds.width))) };
    projection = { size, source, target, strips: Core.buildRayProjection(source, target, size, (120 + settings.spread * 12) * scale, platform === "x" ? settings.intensity / 100 : 0) };
    updateTheme();
  }

  function paint(index) {
    if (!bounds || !media.length || !projection) return false;
    const canvas = canvases[index];
    const context = contexts[index];
    if (mosaic.height !== projection.source.height) mosaic.height = projection.source.height;
    mosaicContext.clearRect(0, 0, mosaic.width, mosaic.height);
    let drawn = false;
    for (const item of media) {
      const source = item.source;
      const sourceWidth = source.videoWidth || source.naturalWidth;
      const sourceHeight = source.videoHeight || source.naturalHeight;
      const target = {
        left: (item.fullRect.left - bounds.left) / bounds.width * mosaic.width,
        top: (item.fullRect.top - bounds.top) / bounds.height * mosaic.height,
        width: item.fullRect.width / bounds.width * mosaic.width,
        height: item.fullRect.height / bounds.height * mosaic.height,
      };
      const crop = Core.fitImage(sourceWidth, sourceHeight, target, item.fit, item.position);
      if (!crop) continue;
      mosaicContext.save();
      try {
        mosaicContext.beginPath();
        mosaicContext.rect((item.rect.left - bounds.left) / bounds.width * mosaic.width, (item.rect.top - bounds.top) / bounds.height * mosaic.height, item.rect.width / bounds.width * mosaic.width, item.rect.height / bounds.height * mosaic.height);
        mosaicContext.clip();
        // Display-only: never read/export pixels, so cross-origin media can be drawn too.
        mosaicContext.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, crop.dx, crop.dy, crop.dw, crop.dh);
        drawn = true;
      } catch {
        // The site may replace a video source while React reuses its element.
        scheduleReconcile();
      } finally {
        mosaicContext.restore();
      }
    }
    if (canvas.width !== projection.size.width) canvas.width = projection.size.width;
    if (canvas.height !== projection.size.height) canvas.height = projection.size.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (drawn) {
      const target = projection.target;
      context.drawImage(mosaic, target.left, target.top, target.width, target.height);
      for (const strip of projection.strips) {
        context.globalAlpha = strip.alpha;
        context.drawImage(mosaic, strip.sx, strip.sy, strip.sw, strip.sh, strip.dx, strip.dy, strip.dw, strip.dh);
      }
      context.globalAlpha = 1;
    }
    return drawn;
  }

  function startFrames() {
    stopFrames();
    if (!eligible() || !settings.animateVideo || reducedMotion.matches) return;
    const video = media.find((item) => item.source.tagName === "VIDEO" && !item.source.paused && !item.source.ended)?.source;
    if (!video) return;
    const type = typeof video.requestVideoFrameCallback === "function" ? "video" : "raf";
    const next = (time) => {
      frameHandle = null;
      if (youtube && (!eligible() || YouTube.findVideo(document, location) !== video)) {
        deactivate();
        scheduleReconcile();
        return;
      }
      if (!eligible() || !activePost?.isConnected || video.paused || video.ended) return;
      if (time - lastPaint >= FRAME_INTERVAL) {
        paint(front);
        lastPaint = time;
      }
      queue();
    };
    const queue = () => {
      frameHandle = type === "video"
        ? { type, video, id: video.requestVideoFrameCallback(next) }
        : { type, id: requestAnimationFrame(next) };
    };
    queue();
  }

  function refreshMedia(changedPost = false) {
    if (!activePost) return;
    const nextMedia = findMedia(activePost);
    const nextSignature = nextMedia.map(sourceKey).join("|");
    const changed = changedPost || nextSignature !== signature
      || nextMedia.some((item, index) => item.source !== media[index]?.source);
    media = nextMedia;
    signature = nextSignature;
    bounds = Core.unionRects(media.map((item) => item.rect));
    host.dataset.mediaCount = String(media.length);
    if (!media.length || !bounds?.width || !bounds.height) {
      syncNativeAmbient(false);
      light.classList.remove("visible");
      releaseBackgrounds();
      stopFrames();
      return;
    }
    updateLayout();
    if (changed) {
      const back = 1 - front;
      if (paint(back)) {
        syncBackgrounds();
        canvases[front].classList.remove("front");
        canvases[back].classList.add("front");
        front = back;
        light.classList.add("visible");
      }
    } else if (paint(front)) {
      syncBackgrounds();
      light.classList.add("visible");
    }
    startFrames();
    syncNativeAmbient(light.classList.contains("visible"));
  }

  function activate(post) {
    if (disposed || !eligible() || !post.isConnected) return;
    clearTimeout(hoverTimer);
    hoverTimer = 0;
    if (activePost !== post) backgroundDirty = true;
    activePost = post;
    pendingPost = null;
    activeObserver.disconnect();
    activeObserver.observe(post, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "poster"] });
    activeResizeObserver?.disconnect();
    activeResizeObserver?.observe(post);
    refreshMedia(true);
  }

  function reconcile() {
    syncYouTubePresentation();
    if (route !== routeKey()) {
      route = routeKey();
      pathname = location.pathname;
      // Coordinates from the previous page must not select a reply on arrival.
      pointer = null;
      deactivate();
    }
    if (!eligible()) {
      deactivate();
      return;
    }
    if (youtube) {
      const video = YouTube.findVideo(document, location);
      const rect = video && visibleRect(video, video.getBoundingClientRect(), 160, 48);
      if (!rect) deactivate();
      else if (video === activePost) refreshMedia();
      else activate(video);
      return;
    }
    if (instagram) {
      const candidates = Instagram?.findPosts(document, pathname).map(instagramCandidate) || [];
      const post = Instagram?.pickActive(candidates, viewport(), activePost);
      if (!post) deactivate();
      else if (post === activePost) refreshMedia();
      else activate(post);
      return;
    }
    if (streaming) {
      const candidates = [...document.querySelectorAll("video")].map(video => ({
        video, rect: visibleRect(video, video.getBoundingClientRect(), 160, 48),
      }));
      const video = Streaming.pickVideo(candidates);
      if (!video) deactivate();
      else if (video === activePost) refreshMedia();
      else activate(video);
      return;
    }
    const detailPost = Posts.findDetailPost(document, pathname) || (previewPost?.isConnected ? previewPost : null);
    const element = pointer && document.elementFromPoint(pointer.x, pointer.y);
    const post = element?.closest(POST_SELECTOR) || detailPost;
    if (post === activePost && post) {
      refreshMedia();
      return;
    }
    if (!post) {
      deactivate();
      return;
    }
    if (post === detailPost) {
      activate(post);
      return;
    }
    if (post === pendingPost) return;
    deactivate();
    pendingPost = post;
    hoverTimer = window.setTimeout(() => {
      hoverTimer = 0;
      if (pendingPost === post) activate(post);
    }, 70);
  }

  const activeObserver = new MutationObserver(scheduleReconcile);
  const backgroundObserver = new MutationObserver(records => {
    const changed = records.some(record => {
      const target = record.target;
      if (!(target instanceof Element)) return false;
      if (clearedBackgrounds.has(target)) return true;
      if (target.closest(BACKGROUND_PROTECTED_SELECTOR)) return Boolean(target.querySelector(".xa-background-clear"));
      if (record.type === "childList") return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE);
      return target === document.documentElement || target === document.body || clearedBackgrounds.has(target)
        || getComputedStyle(target).backgroundColor !== "rgba(0, 0, 0, 0)";
    });
    if (changed) {
      backgroundDirty = true;
      scheduleReconcile();
    }
  });
  const activeResizeObserver = automatic ? new ResizeObserver(scheduleReconcile) : null;
  const pageObserver = new MutationObserver((records) => {
    if (youtube) {
      if (route !== routeKey() || records.some(record => {
        const target = record.target;
          if (!(target instanceof Element) || target === host || host.contains(target)) return false;
          if (fullscreenTarget?.contains(target)) return true;
          const embedUI = Boolean(YouTube.embedId(location)) && (target.matches(YouTube.EMBED_PROTECTED_SELECTOR + ", " + YouTube.EMBED_TITLE_SELECTOR) || target.closest("#movie_player, [role=dialog], [role=menu]"));
          const shortsUI = Boolean(YouTube.shortsId(location)) && (target.matches(YouTube.SHORTS_PROTECTED_SELECTOR)
            || target.closest('ytd-engagement-panel-section-list-renderer, [role=dialog]'));
          if (record.type === "attributes") {
            // Ignore only our own native-ambient marker; site state still triggers reconciliation.
            if (record.attributeName === "class" && record.oldValue?.split(/\s+/).filter(x=>x!=="xa-youtube-active").join(" ") === (target.getAttribute('class') || '').split(/\s+/).filter(x=>x!=="xa-youtube-active").join(" ")) return false;
            return shortsUI || embedUI || target.matches("ytd-watch-flexy, ytd-reel-video-renderer, #movie_player, #shorts-player, video") || Boolean(target.closest("ytd-shorts"));
          }
          if (embedUI || shortsUI || (YouTube.shortsId(location) && target.closest('ytd-shorts'))) return true;
          return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE
            && (node.matches("ytd-watch-flexy, ytd-shorts, ytd-reel-video-renderer, #movie_player, #shorts-player, video") || node.querySelector("ytd-watch-flexy, ytd-shorts, ytd-reel-video-renderer, #movie_player, #shorts-player, video")
              || (YouTube.embedId(location) && (node.matches(YouTube.EMBED_PROTECTED_SELECTOR + ", " + YouTube.EMBED_TITLE_SELECTOR) || node.querySelector(YouTube.EMBED_PROTECTED_SELECTOR + ", " + YouTube.EMBED_TITLE_SELECTOR)))
              || (YouTube.shortsId(location) && (node.matches(YouTube.SHORTS_PROTECTED_SELECTOR) || node.querySelector(YouTube.SHORTS_PROTECTED_SELECTOR)))));
      })) scheduleReconcile();
      return;
    }
    if (pathname !== location.pathname) scheduleReconcile();
    if ((!automatic && !pointer && !Posts.statusId(location.pathname)) || !eligible()) return;
    if (!automatic && records.some(record => record.type === "attributes" && record.target.matches('a[href*="/status/"]'))) scheduleReconcile();
    if (instagram && records.some(record => record.type === "attributes"
      && (record.target.matches('article, img, video, [role="dialog"]') || record.target.querySelector("article, img, video")))) scheduleReconcile();
    if (streaming && records.some(record => record.type === "attributes"
      && (record.target.matches("video") || record.target.querySelector("video")))) scheduleReconcile();
    if (activePost && !activePost.isConnected) scheduleReconcile();
    else if (records.some((record) => [...record.addedNodes, ...record.removedNodes].some((node) =>
      node.nodeType === Node.ELEMENT_NODE && (node.matches("article, img, video") || node.querySelector("article, img, video"))))) scheduleReconcile();
  });
  pageObserver.observe(document.body, {
    childList: true, subtree: true,
      attributes: true,
      attributeOldValue: youtube,
    attributeFilter: youtube ? ["style", "class", "hidden", "visibility", "aria-hidden", "aria-expanded", "open", "role", "is-active", "video-id", "theater", "is-miniplayer", "src", "href"]
      : automatic ? ["style", "class", "hidden", "aria-hidden", "src", "srcset", "poster"] : ["href"],
  });
  const themeObserver = new MutationObserver(scheduleReconcile);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });

  listen(document, "pointermove", (event) => {
    if (automatic) return;
    if (event.pointerType === "touch") return;
    pointer = { x: event.clientX, y: event.clientY };
    // Within the same post, mouse motion does not need another media repaint.
    if (event.target instanceof Element && event.target.closest(POST_SELECTOR) === activePost && activePost) return;
    scheduleReconcile();
  }, { passive: true });
  listen(document, "pointerout", (event) => {
    if (automatic) return;
    if (!event.relatedTarget) {
      pointer = null;
      scheduleReconcile();
    }
  }, { passive: true });
  listen(document, "scroll", scheduleReconcile, { passive: true, capture: true });
  for (const type of ["transitionend", "transitioncancel", "animationend"]) {
    listen(document, type, event => {
      if (instagram && event.target instanceof Element
        && (event.target.matches("img, video") || event.target.querySelector("img, video"))) scheduleReconcile();
    }, true);
  }
  listen(window, "resize", () => { backgroundDirty = true; scheduleReconcile(); }, { passive: true });
  listen(document, "xambient:layout", scheduleReconcile);
  listen(window, "blur", () => { if (!automatic) { pointer = null; scheduleReconcile(); } });
  listen(window, "focus", scheduleReconcile);
  listen(window, "popstate", scheduleReconcile);
  if (window.navigation) listen(window.navigation, "currententrychange", scheduleReconcile);
  listen(document, "visibilitychange", scheduleReconcile);
  listen(document, "fullscreenchange", scheduleReconcile);
  if (youtube) {
    listen(document, "yt-navigate-start", () => { youtubeNavigating = true; deactivate(); });
    listen(document, "yt-navigate-finish", () => { youtubeNavigating = false; scheduleReconcile(); });
    listen(document, "yt-page-data-updated", scheduleReconcile);
    listen(document, "yt-player-updated", scheduleReconcile);
    // pushState has no popstate event; cover route changes without touching page history methods.
    const routeTimer = window.setInterval(() => { if (route !== routeKey()) scheduleReconcile(); }, 500);
    removers.push(() => clearInterval(routeTimer));
    listen(document, "enterpictureinpicture", scheduleReconcile, true);
    listen(document, "leavepictureinpicture", scheduleReconcile, true);
  }
  for (const event of ["load", "loadeddata", "play", "pause", "ended", "seeked", "emptied", "resize"]) {
    listen(document, event, (event) => {
      if (event.target instanceof Element && ((automatic && event.target.matches("img, video"))
        || (activePost && (activePost.contains(event.target) || event.type === "load")))) scheduleReconcile();
    }, true);
  }
  listen(reducedMotion, "change", scheduleReconcile);
  listen(colorScheme, "change", () => { backgroundDirty = true; scheduleReconcile(); });

  if (hasStorage) {
    chrome.storage.local.get(Settings.STORAGE_KEY).then((result) => {
      if (!disposed) applySettings(result[Settings.STORAGE_KEY]);
    }).catch(() => {});
    const onStorageChange = (changes, area) => {
      if (area === "local" && changes[Settings.STORAGE_KEY]) applySettings(changes[Settings.STORAGE_KEY].newValue);
    };
    chrome.storage.onChanged.addListener(onStorageChange);
    removers.push(() => chrome.storage.onChanged.removeListener(onStorageChange));
  } else {
    // The local demo uses the same renderer without an installed extension.
    listen(document, "xambient:settings", (event) => applySettings(event.detail));
    listen(document, "xambient:preview", (event) => {
      const post = event.detail;
      previewPost = post instanceof Element && post.matches(POST_SELECTOR) ? post : null;
      scheduleReconcile();
    });
  }
  applySettings(settings);

  function dispose() {
    disposed = true;
    deactivate();
    cancelAnimationFrame(reconcileFrame);
    activeObserver.disconnect();
    pageObserver.disconnect();
    embedIntersectionObserver?.disconnect();
    themeObserver.disconnect();
    cards?.dispose();
    restoreBackgrounds();
    backgroundStyle.remove();
    youtubeStyle?.remove();
    for (const remove of removers) remove();
    host.remove();
  }
  globalThis.__xAmbientDispose = dispose;
  listen(window, "pagehide", (event) => { if (!event.persisted) dispose(); });
})();
