# Embed / native PiP validation

Issue: https://github.com/legion-edge/x-ambient/issues/10
Base: PR #9, 394ea07a7290886c3e38fca8bdf2bf382b8a7315. Upstream remains pinned to 6977a59c26b731c4909970fdf814dc282c29093b; mmnga attribution and MIT notices are preserved.

## Scope

Only existing https://www.youtube.com/embed/* gets a separate all_frames entry. The original top-level entry excludes embed. No new hosts, parent injection, about:blank fallback, private player API, authentication access, background service or transmission is added. Settings remain local extension storage; rendering remains local. The Firefox package's none data-collection declaration is still appropriate for these changes; YouTube's own network traffic is distinct from addon collection.

Public title links must all match the exact current video ID. Ads, stale IDs, hidden/unready/ended sources and full-viewport media fail closed. IntersectionObserver observes the video without reading parent DOM. CSS path clipping conservatively protects the union of media and visible UI rectangles, only for embed. Real Firefox iframe screenshots showed video tint with the existing image mask; clipping preserved sampled media pixels. This does not assert a specific Firefox bug or universal renderer result. Other platforms retain the existing mask. [MDN CSS path](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/basic-shape/path).

## Verification

npm run check, npm test (45 tests), packaging and web-ext lint. Browser scripts use fresh disposable Firefox profiles and dynamic local ports. No personal profiles, cookies or credentials are copied. Fixture grants, counters and storage hooks exist only in test addon copies.

npm run test:youtube:embed -- --live covers a cross-origin local frame in an unmatched parent: ON/OFF video/title/caption/control pixels; setting normalization; dynamic menu protection; ads and stale title rejection; no-margin suspension; parent scrolling; hidden-frame paint suspension; player/iframe fullscreen; exact parent markup preservation. CSS hiding can suspend painting before active classes change. Automated child Escape did not exit nested parent iframe fullscreen; the test explicitly exits with the standard parent fullscreen API and records that limit.

The separate real-site section loads public unauthenticated www.youtube.com/embed/aqz-KE-bpKQ in a portrait frame, waits for actual playback progress, seeks to 45 seconds and pauses. Three video pixels and three UI-region pixels are compared ON/OFF; visible black-band changes and setting restoration are checked. Standard HTMLMediaElement.play is used when no native play button is visible; trustedPlay=false is recorded. Source resolution can vary. Screenshot sampling occurs solely in the test, not production media-pixel access. This is sampled evidence, not every-frame/every-pixel verification.

npm run test:firefox:native-pip actually opens and closes Firefox's native context-menu PiP. Browser UI indicates PiP while standard page state/events remain absent. Manual OFF/close/ON stops and restores one renderer. No privileged clone API or PiP preference change is shipped. Standard-API and native-browser PiP are separate tests.

## Limits

Firefox 157 on Windows is tested. Older Firefox, Chrome runtime, real ads, DRM, login, long-duration CPU use, all YouTube layouts and native PiP on a live YouTube page remain unverified. youtube-nocookie.com needs a new host grant and is pending approval, not included. Parent-page effects need separate parent-site access and are not implemented. Packages remain unsigned temporary-install artifacts; no Mozilla submission or store publication.
