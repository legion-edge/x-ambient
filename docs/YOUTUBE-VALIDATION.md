This record describes the normal/theater implementation at PR #3. Fullscreen changes and current evidence are documented in YOUTUBE-FULLSCREEN-VALIDATION.md.

# YouTube validation

Base: Firefox PR #1, commit 3190739d09c74b3a08617ed159d93e4941ed843b. Upstream remains mmnga/x-ambient @ 6977a59c26b731c4909970fdf814dc282c29093b. Windows, Node 24.11.1, installed Firefox 157.0. Existing Chrome manifest and MIT attribution retained; only www.youtube.com content-script host added.

## Verified

- Static checks; 37 Node tests; Chrome and Firefox packages; web-ext lint with 0 errors/notices/warnings.
- Dedicated disposable Firefox profile: installed extension + original local-media watch fixture. Normal/theater, automatic main-video selection, Canvas frame changes, paused seek, ad stop/resume, native ambient restoration, v changes with stale-player exclusion, eventless pushState, home/watch SPA and back/forward, video replacement, mini/Shorts/embed exclusion, actual fullscreen stop/exit, scroll-out and repeated resize/theater, popup OFF restoration. Zero-height BODY with viewport-propagated overflow regression; no paused watch class mutation loop (0 changes in one second).
- Existing Firefox regression: popup save/reopen/reset, image/video Canvas, settings propagation, scroll/resize/repeated controls passed.
- Live public YouTube, logged out: https://www.youtube.com/watch?v=aqz-KE-bpKQ (Blender's Big Buck Bunny). Main video loaded and extension ambient became visible; actual YouTube theater button changed layout and renderer stayed active. This is separate from fixture coverage.
- Independent review found repeated class writes and live investigation found viewport BODY overflow clipping. Both corrected; final review found no blockers.

Local evidence: output/youtube-qa/results.json; normal.png, theater.png, live.png, live-theater.png; output/firefox-qa/results.json. No personal profile or login data used. Profile is removed by WebDriver shutdown. Do not stop unrelated Firefox processes.

## Limits

No live ads were observed/tested; ad/SPA/back-forward/scroll/popup restoration checks above are fixture tests. No authenticated YouTube, DRM, Firefox 142 runtime, Firefox-native PiP, or Chrome runtime validation. Other languages retain upstream site descriptions; English/Japanese descriptions include YouTube. Standard PiP API exclusion is covered by unit tests; Firefox native PiP is outside scope and users should disable ambient for it. Native ambient visual suppression does not stop YouTube's internal ambient processing or change its stored setting.

No merge, AMO signing or store publication. Firefox ZIP is unsigned, for temporary installation. PR is stacked on Firefox support and needs review before merging.

## Reproduce

npm ci; npm run check; npm test; npm run package; npm run package:firefox; npm run lint:firefox; npm run test:firefox; npm run test:youtube -- --live.

On this machine an existing output/x-ambient-firefox directory is held by another process. Build to a separate output directory using X_AMBIENT_OUTPUT_DIR (currently output/youtube-build-verified). Both browser scripts accept that variable. Lint the custom source directory explicitly with npm exec -- web-ext lint --source-dir output/youtube-build-verified/x-ambient-firefox --warnings-as-errors. The production archives never include localhost matches, fixtures or diagnostic scripts. Unit and CI checks do not need a signed build.

References: [MDN pushState](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState), [MDN seeked](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event), [MDN standard PiP](https://developer.mozilla.org/en-US/docs/Web/API/Document/pictureInPictureElement).
