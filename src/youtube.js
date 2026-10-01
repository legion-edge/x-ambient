(() => {
  "use strict";

  function watchId(location) {
    if (location.pathname !== "/watch") return null;
    const id = new URLSearchParams(location.search).get("v");
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }

  function findVideo(root, location) {
    const id = watchId(location);
    if (!id || root.fullscreenElement || root.pictureInPictureElement) return null;
    const watch = root.querySelector("ytd-watch-flexy:not([hidden])");
    // Reject the old player while YouTube is updating the watch route.
    if (!watch || watch.getAttribute("video-id") !== id) return null;
    const player = watch.querySelector("#movie_player");
    if (!player || player.matches(".ad-showing, .ad-interrupting, .ytp-player-minimized")
      || watch.hasAttribute("is-miniplayer")) return null;
    const video = player.querySelector("video.html5-main-video");
    // Never fall back to ads, previews, recommendations or thumbnails.
    if (!video || video.ended || video.readyState < 2 || !video.videoWidth) return null;
    return video;
  }

  const api = Object.freeze({ watchId, findVideo });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.XAmbientYouTube = api;
})();
