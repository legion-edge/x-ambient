# YouTube privacy-enhanced embed validation

Issue: https://github.com/legion-edge/x-ambient/issues/12

Base: draft PR11, `3f290a66c15487f5545d60634223c3ed2d7d4b61`. Dependency chain: PR7 → PR9 → PR11 → this change. No dependency is merged. Upstream `6977a59c26b731c4909970fdf814dc282c29093b`, mmnga attribution and MIT LICENSE are retained.

## Approved permission

The user explicitly approved adding the privacy-enhanced embed host. The only new content-script match is `https://www.youtube-nocookie.com/embed/*`, in the existing frame-local entry. No wildcard subdomains, HTTP, parent-site grants, whole-host path matches, about:blank/origin fallbacks or new API permissions are added. Browser permission UI may describe a whole host, while the actual content-script match restricts execution to embed paths. The platform adapter recognizes only the exact www host.

The existing renderer uses public current-title DOM and already-present ready video locally. No external fetch, cookies/site storage/authentication access, tracking, IFrame API initialization or video source replacement is introduced. YouTube poster fallback is disabled explicitly so a readiness transition cannot trigger a supplemental poster request. Extension settings remain in extension-local storage. The package's existing `none` addon-data-collection declaration is preserved; it does not describe YouTube's own network or imply the site is cookie-free.

YouTube officially defines this mode by changing the embed URL to www.youtube-nocookie.com: [YouTube Help](https://support.google.com/youtube/answer/171780?hl=en). Frames must individually match their content-script URL conditions: [Mozilla content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts). No www.youtube.com rewrite is used for privacy-enhanced playback.

## Reproduction and evidence

Run `npm ci`, `npm run check`, `npm test`, `npm run package`, `npm run package:firefox`, `npm run lint:firefox`. Then:

- `npm run test:youtube:embed -- --live`: ordinary public embed and local cross-origin fixture, `output/youtube-embed-qa`.
- `npm run test:youtube:embed -- --live --nocookie`: privacy-enhanced public embed and local cross-origin fixture, `output/youtube-nocookie-qa`.
- `npm run test:youtube`, `npm run test:youtube:shorts:fullscreen`, `npm run test:firefox:native-pip`: fixture regressions.

Each browser run uses a fresh disposable Firefox profile and dynamic localhost port, without personal credentials or profile copies. Localhost grants/settings hooks are test-copy-only. Firefox 157 on Windows is tested. The two embed result sets identify the actual page hostname, and assert that the host and media source stay unchanged across addon setting operations. Source URLs are compared internally and never written to results.

Public video playback progress and seek to 45 seconds are verified before paused ON/OFF screenshots. Three sampled media pixels and three UI-region pixels remain equal, while free black-band pixels change. No visible matching play button was available, so standard HTMLMediaElement.play was used and trustedPlay=false is recorded. Sampling reads browser screenshots only in tests. It does not guarantee every video pixel or frame.

Both cross-origin fixture runs cover frame-local settings, title/caption/control preservation, dynamic menus, ads/stale-title rejection, screen-filling suspension, parent scrolling, hidden-frame paint suspension, fullscreen and parent DOM preservation. Automated child Escape does not exit nested parent iframe fullscreen; standard parent API exit is tested instead. These fullscreen/ad assertions are fixture evidence, distinct from the live-site pixel/playback checks.

The standard PiP and Firefox native PiP records and limits from [FIREFOX_PIP.ja.md](../FIREFOX_PIP.ja.md) remain: native page-state detection is not promised, and OFF → PiP → close → ON is the verified workflow. No private API or PiP preference is added.

Independent review found no blocking issues. Syntax checks and all 45 unit tests passed; web-ext lint reported 0 errors/notices/warnings. Both public-host embed runs passed (10 checks per run), along with watch (12), Shorts fullscreen (11), and actual native PiP (2): 45 browser checks across the five runs. Production source/package equality is verified separately. Node22/24 CI validates the remote commit; browser evidence is generated locally, not by CI.

## Limits

Arbitrary parent-page ambient effects are not implemented. Real ads, DRM, login, old Firefox, Chrome runtime, long CPU runs, all layouts and live-site native PiP remain unverified. Privacy-enhanced support does not alter YouTube's privacy guarantees. ZIPs remain unsigned temporary-install artifacts; no store publication or Mozilla submission is performed.
