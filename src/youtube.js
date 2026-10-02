(() => {
  "use strict";

  function watchId(location) {
    if (location.pathname !== "/watch") return null;
    const id = new URLSearchParams(location.search).get("v");
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }

  function findVideo(root, location) {
    if (shortsId(location)) return findShortVideo(root, location);
    if (embedId(location)) return findEmbedVideo(root, location);
    const id = watchId(location);
    if (!id || root.pictureInPictureElement) return null;
    const watch = root.querySelector("ytd-watch-flexy:not([hidden])");
    // Reject the old player while YouTube is updating the watch route.
    if (!watch || watch.getAttribute("video-id") !== id) return null;
    const player = watch.querySelector("#movie_player");
    if (!player || player.matches(".ad-showing, .ad-interrupting, .ytp-player-minimized")
      || watch.hasAttribute("is-miniplayer")) return null;
    const video = player.querySelector("video.html5-main-video");
    // Never fall back to ads, previews, recommendations or thumbnails.
    if (!video || video.ended || video.readyState < 2 || !video.videoWidth) return null;
    if (root.fullscreenElement && !fullscreenContainer(root, video)) return null;
    return video;
  }

  function shortsId(location) {
    return /^\/shorts\/([A-Za-z0-9_-]{11})\/?$/.exec(location.pathname)?.[1] || null;
  }

  function embedId(location) {
    const id = /^\/embed\/([A-Za-z0-9_-]{11})\/?$/.exec(location.pathname)?.[1];
    return id && id !== 'videoseries' ? id : null;
  }

  const EMBED_TITLE_SELECTOR = '.ytp-title-link[href], .ytmVideoInfoVideoTitle[href]';
  function findEmbedVideo(root, location) {
    const id = embedId(location);
    if (!id || root.pictureInPictureElement) return null;
    const titles = [...root.querySelectorAll(EMBED_TITLE_SELECTOR)];
    if (!titles.length) return null;
    // Fail closed when the embedded API switches videos without changing the frame URL.
    try {
      for (const title of titles) {
        const url = new URL(title.getAttribute('href'), 'https://www.youtube.com');
        if (url.protocol !== 'https:' || url.hostname !== 'www.youtube.com' || watchId(url) !== id) return null;
      }
    } catch { return null; }
    const player = root.querySelector('#movie_player');
    if (!player || player.matches('.ad-showing, .ad-interrupting, .ytp-player-minimized')
      || player.hidden || player.getAttribute('aria-hidden') === 'true') return null;
    const video = player.querySelector('video.html5-main-video');
    if (!video || video.ended || video.readyState < 2 || !video.videoWidth) return null;
    if (root.fullscreenElement && !fullscreenContainer(root, video)) return null;
    return video;
  }

  function routeId(location) { return watchId(location) || shortsId(location) || embedId(location); }

  function shortVideoId(reel) {
    // Current desktop Shorts exposes the playing ID on its player title link.
    const link = reel.querySelector('.ytp-title-link[href]');
    if (link) {
      try { return routeId(new URL(link.getAttribute('href'), 'https://www.youtube.com')); } catch { return null; }
    }
    return reel.getAttribute('video-id');
  }

  function findShortVideo(root, location) {
    const id = shortsId(location), view = root.defaultView;
    if (!id || !view || root.pictureInPictureElement) return null;
    let best = null, bestArea = 0;
    for (const reel of root.querySelectorAll('ytd-reel-video-renderer')) {
      if (shortVideoId(reel) !== id) continue;
      const player = reel.querySelector('#shorts-player, #movie_player, .html5-video-player');
      const video = player?.querySelector('video.html5-main-video');
      if (!video || video.ended || video.readyState < 2 || !video.videoWidth
        || player.matches('.ad-showing, .ad-interrupting, .ytp-player-minimized')) continue;
      const full = root.fullscreenElement && fullscreenContainer(root, video);
      if (root.fullscreenElement && !full) continue;
      const box = video.getBoundingClientRect();
      let left = Math.max(0, box.left), top = Math.max(0, box.top);
      let right = Math.min(view.innerWidth, box.right), bottom = Math.min(view.innerHeight, box.bottom);
      for (let node = video; node && right > left && bottom > top; node = node.parentElement) {
        const style = view.getComputedStyle(node);
        if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none'
          || style.visibility !== 'visible' || style.opacity === '0') { right = left; break; }
        if (node !== video && node !== root.documentElement && node !== root.body) {
          const rect = node.getBoundingClientRect();
          if (['hidden','clip','auto','scroll'].includes(style.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
          if (['hidden','clip','auto','scroll'].includes(style.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
        }
        // A top-layer element ignores clipping/hidden ancestors outside that layer.
        if (node === full) break;
      }
      const area = Math.max(0, right-left)*Math.max(0,bottom-top);
      // URL/DOM must agree and at least half the picture must be on screen.
      if (box.width >= 80 && box.height >= 90 && area >= box.width*box.height*.5 && area > bestArea) { best = video; bestArea = area; }
    }
    return best;
  }

  function fullscreenContainer(root, video) {
    const full = root.fullscreenElement;
    const player = video?.closest?.("#movie_player, #shorts-player, .html5-video-player");
    // A replaced <video> cannot display child overlays. Support the YouTube player top layer only.
    return full && full.tagName !== "VIDEO" && player && full.contains?.(player) ? full : null;
  }

  function hasFullscreenSpace(content, viewport) {
    // Ignore subpixel rounding/slivers rather than render behind a screen-filling picture.
    return content && (content.left > 4 || content.top > 4
      || content.right < viewport.width - 4 || content.bottom < viewport.height - 4);
  }

  const PROTECTED_SELECTOR = ".ytp-chrome-top, .ytp-chrome-bottom, .caption-window, .ytp-settings-menu, .ytp-popup, .ytp-tooltip, .ytp-pause-overlay, button, [role=button]";
  const SHORTS_LAYOUT_SELECTOR = "#metadata, #actions, #overlay, #sticker-layer, reel-action-bar-view-model, yt-reel-player-overlay-view-model";
  const SHORTS_WRAPPER_SELECTOR = "#overlay, yt-reel-player-overlay-view-model";
  const SHORTS_PROTECTED_SELECTOR = `${PROTECTED_SELECTOR}, video, #scrubber, [role=slider], ytd-engagement-panel-section-list-renderer, [role=dialog], [role=menu], [role=menuitem], [role=listbox], [role=tooltip], ytd-menu-popup-renderer, yt-list-view-model, ytd-masthead, ytd-mini-guide-renderer, ytd-guide-renderer`;
  const SHORTS_OBSERVED_SELECTOR = `${SHORTS_PROTECTED_SELECTOR}, ${SHORTS_LAYOUT_SELECTOR}`;

  function shortsProtection(root, reel) {
    const elements = new Set([...root.querySelectorAll(SHORTS_PROTECTED_SELECTOR)]
      .filter(element => !element.matches(SHORTS_WRAPPER_SELECTOR)));
    const textRects = [];
    if (!reel) return { elements: [...elements], textRects };
    const doc = reel.ownerDocument, view = doc.defaultView;
    // Include visible neighboring reels during scrolling, without measuring preload UI.
    const layouts = [...root.querySelectorAll(SHORTS_LAYOUT_SELECTOR)].filter(layout => {
      const box = layout.getBoundingClientRect(), style = view.getComputedStyle(layout);
      return box.width > 0 && box.height > 0 && box.right > 0 && box.bottom > 0
        && box.left < view.innerWidth && box.top < view.innerHeight
        && !layout.closest('[hidden], [aria-hidden=true]') && style.display !== 'none'
        && style.visibility === 'visible' && style.opacity !== '0';
    });
    // Protect painted local cards, but never the structural overlay's empty space.
    for (const layout of layouts) {
      const style = view.getComputedStyle(layout), color = style.backgroundColor;
      const alpha = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color)?.[1];
      const painted = style.backgroundImage !== 'none' || (color !== 'transparent'
        && color !== 'rgba(0, 0, 0, 0)' && (alpha === undefined || Number(alpha) > 0));
      if (!layout.matches(SHORTS_WRAPPER_SELECTOR) && painted) elements.add(layout);
      for (const graphic of layout.querySelectorAll('img, svg, canvas, input, select, textarea, [role=slider], [role=progressbar]')) elements.add(graphic);
      // CSS-generated badges have no text node; retain their local leaf box.
      for (const leaf of layout.querySelectorAll('*')) {
        if (leaf.childElementCount || leaf.matches(SHORTS_WRAPPER_SELECTOR)) continue;
        if (['::before', '::after'].some(pseudo => {
          const content = view.getComputedStyle(leaf, pseudo).content;
          return content && content !== 'none' && content !== 'normal';
        })) elements.add(leaf);
      }
    }
    const seen = new Set(), range = doc.createRange();
    for (const layout of layouts) {
      const walker = doc.createTreeWalker(layout, 4); // SHOW_TEXT; no page/private API.
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (seen.has(node) || !node.textContent.trim()) continue;
        seen.add(node);
        const element = node.parentElement;
        if (!element || element.closest('script, style, template, noscript')) continue;
        range.selectNodeContents(node);
        // Per-line glyph boxes preserve wrapping without blank container-sized holes.
        for (const box of range.getClientRects()) {
          if (box.width <= 0 || box.height <= 0) continue;
          textRects.push({ element, rect: { left: box.left - 3, top: box.top - 3,
            right: box.right + 3, bottom: box.bottom + 3, width: box.width + 6, height: box.height + 6 } });
        }
      }
    }
    return { elements: [...elements], textRects };
  }
  const EMBED_PROTECTED_SELECTOR = `${PROTECTED_SELECTOR}, .ytp-title-text, .ytmVideoInfoHost, .ytmVideoInfoVideoTitle, .ytwPlayerTimeDisplayHost, .ytPlayerProgressBarHost, .ytp-cued-thumbnail-overlay, .ytp-endscreen-content, .ytp-error, [role=dialog], [role=menu], [role=menuitem], [role=tooltip]`;

  const api = Object.freeze({ watchId, shortsId, embedId, routeId, findVideo, findShortVideo, findEmbedVideo, fullscreenContainer, hasFullscreenSpace, shortsProtection, PROTECTED_SELECTOR, SHORTS_PROTECTED_SELECTOR, SHORTS_LAYOUT_SELECTOR, SHORTS_OBSERVED_SELECTOR, EMBED_TITLE_SELECTOR, EMBED_PROTECTED_SELECTOR });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.XAmbientYouTube = api;
})();
