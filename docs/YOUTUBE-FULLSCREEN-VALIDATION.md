# YouTube fullscreen validation

Base: PR #3 head 7461e88686e9d0c71c68b334f81387cc40f836b4. Upstream mmnga/x-ambient @ 6977a59c26b731c4909970fdf814dc282c29093b and MIT attribution retained. No permissions added. Branch youtube-fullscreen; Issue #4.

Windows, Node 24.11.1, installed Firefox 157.0. All browser testing used WebDriver disposable profiles, no user login/profile/settings. Fullscreen-specific test sets its own headless screen to 1280x1024 so a 16:9 source has visible letterboxing. No operating-system screen settings changed.

## Passed

- npm run check; 38 unit tests; Chrome and Firefox packages; web-ext lint 0 errors/notices/warnings.
- Installed extension on original local-media fixture: fullscreen top-layer host mount, pillarbox and letterbox, click-through controls, paused seek, video-frame Canvas changes, ads and stale watch-ID transitions, Esc/button exit, four repeated normal/theater/fullscreen cycles with one host, restoration to page presentation.
- Screenshot sample pixels on the paused video, caption and control are identical with extension ON and OFF. A separate letterbox test places the caption in a black band and checks pixel equality there too.
- A changing canvas-stream source exactly matching the fullscreen viewport causes extension deactivation (mediaCount 0), no Canvas pixel changes and no paint-counter increase for 700ms. Native ambient visual suppression is released.
- Actual public logged-out YouTube: https://www.youtube.com/watch?v=aqz-KE-bpKQ, source 854x480, screen 1280x1024. Actual fullscreen button entered fullscreen (Firefox reported fullscreenElement HTML), black bands lit around unchanged video at 45s, Esc restored page. Actual theater button then standard f shortcut reentered fullscreen, and actual fullscreen button exited. Screenshots visually inspected.
- Normal/theater regression suite passed including live public video, popup OFF restore, fixture SPA/back-forward/scroll/ads and replacement.
- Existing Firefox regression passed including non-YouTube fullscreen stop/exit, storage, images, video and repeated operations.
- Independent review findings about presentation-waiting and frame-change assertions were corrected; current results contain no failed tests.

Evidence: output/youtube-fullscreen-qa/results.json, pillarbox.png, letterbox.png, live-fullscreen.png. Normal/theater evidence: output/youtube-qa/results.json. Existing-sites evidence: output/firefox-qa/results.json.

Test-only localhost host match, settings-event bridge and paint counter are injected into a copied extension under output only. Distribution packages contain none of these. Test pixel reading is limited to local fixtures/screenshots; production renderer does not read/export media pixels.

## Limits

Fullscreen does not change video pixels, resize/crop the original image, or analyze black bands encoded into the source. It lights layout margins over 4px; otherwise it stops drawing. This overrides popup scope only while fullscreen. UI masks cover common YouTube control/caption/menu selectors and may need adjustment if site DOM changes.

No live ads, live subtitle track, authenticated account, DRM, Firefox 142 runtime, Chrome runtime, native VIDEO-element fullscreen or PiP validation. Caption/ad/SPA checks are fixtures. Shorts/embed/PiP remain out of scope. Firefox-native PiP cannot be guaranteed detected; turn ambient off for PiP. Other sites still stop in fullscreen.

No merge/signing/store submission. Draft PR stacks on YouTube PR #3; merge order needs review. Unsigned Firefox ZIP is for temporary installation.

## Reproduce

npm ci; npm run check; npm test; npm run package; npm run package:firefox; npm run lint:firefox; npm run test:firefox; npm run test:youtube -- --live; npm run test:youtube:fullscreen -- --live.

Local release artifacts are in output/youtube-fullscreen-release, using X_AMBIENT_OUTPUT_DIR to keep older output folders/profile locks untouched. For a custom output path, lint with npm exec -- web-ext lint --source-dir output/youtube-fullscreen-release/x-ambient-firefox --warnings-as-errors. See YOUTUBE_FULLSCREEN.ja.md for Japanese installation and behavior.
