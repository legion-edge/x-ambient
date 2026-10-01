(() => {
  "use strict";

  function watchId(location) {
    if (location.pathname !== "/watch") return null;
    const id = new URLSearchParams(location.search).get("v");
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }

  function findVideo(root, location) {
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

  function fullscreenContainer(root, video) {
    const full = root.fullscreenElement;
    const player = video?.closest?.("#movie_player");
    // A replaced <video> cannot display child overlays. Support the YouTube player top layer only.
    return full && full.tagName !== "VIDEO" && player && full.contains?.(player) ? full : null;
  }

  function hasFullscreenSpace(content, viewport) {
    // Ignore subpixel rounding/slivers rather than render behind a screen-filling picture.
    return content && (content.left > 4 || content.top > 4
      || content.right < viewport.width - 4 || content.bottom < viewport.height - 4);
  }

  const PROTECTED_SELECTOR = ".ytp-chrome-top, .ytp-chrome-bottom, .caption-window, .ytp-settings-menu, .ytp-popup, .ytp-tooltip, .ytp-pause-overlay, button, [role=button]";

  const api = Object.freeze({ watchId, findVideo, fullscreenContainer, hasFullscreenSpace, PROTECTED_SELECTOR });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.XAmbientYouTube = api;
})();
