# YouTube Shorts validation

Base main: 5336c262b2640359164bede235084f0071ff5f30 (merged PRs #1/#3/#5). Original upstream: 6977a59c26b731c4909970fdf814dc282c29093b. MIT/mmnga attribution retained; no manifest permissions changed. Issue #6; branch youtube-shorts.

Windows, Node 24.11.1, installed Firefox 157.0. Browser runs use WebDriver disposable profiles, no personal profile/login/cookies copied. Signing and store submission are out of scope.

## Evidence

- Static check and 40 unit tests pass. Chrome/Firefox packages build and Firefox web-ext lint has zero errors/notices/warnings.
- Local original-media fixture: repeated down/up selects one URL-matched ready video; preload/hidden/ads/stale route rejected. Paused seek repaints; same-document Shorts/watch/Shorts and browser back/forward work.
- Video/caption/metadata/action/comment screenshot sample pixels are equal ON/OFF. Pause with external comments displayed and new dialog inserted/removed updates mask without resize. Independent review found this lifecycle gap; it was fixed and a regression check added.
- Stored post scope uses Shorts page mask without changing the saved scope; animate OFF stops video paints; intensity zero restores native state. Popup OFF restores native ambient marker/visibility and stops paint calls; ON resumes. Repeated resize retains one renderer. Playing fixture with preload neighbors measured 12 paint calls in one second, paused state measured zero (occasionally one settling event), OFF measured zero. These are bounded-work checks, not a hardware CPU benchmark.
- Actual logged-out public Shorts: https://www.youtube.com/shorts/O3CxEgqYd0A; next/previous button navigation and one active renderer passed. Recommendation chosen by YouTube varies; latest saved successful run used /shorts/9YOonLS1TcY as next, then returned to the original.
- Initial tests on /shorts/Yh-6ELnwJ8c and the second seed sometimes showed no route change after the first navigation input. This also reproduced with no extension and a diagnostic copy returning before host creation. Successful run used a second native next-button click when the URL was unchanged after 1.5s. The committed test records whether it retried; it does not synthesize DOM click or ignore a failed transition.
- Existing Firefox/X fixture, images/video/storage/toggle/scroll/resize and non-YouTube fullscreen stop/exit passed. Normal YouTube/theater fixture and public Big Buck Bunny passed. Fullscreen fixture and public button/Esc/theater/f/button-exit passed on rerun; an earlier live final exit timed out and is not counted as success.
- Independent code review: no remaining blocking implementation finding after external UI lifecycle fix.

Results/screenshots are in output/youtube-shorts-qa. Regression results are output/firefox-qa, output/youtube-qa and output/youtube-fullscreen-qa. Successful screenshots were visually inspected. QA bundle includes final JSON and successful screenshots, not older failure/debug dumps.

Localhost host match, routing override, paint/reconcile/navigation counters are injected only into a test copy. Distributed packages contain no diagnostics. Screenshot pixel reads occur only in fixtures; production does not read/export video pixels.

## Limits

No authenticated accounts, actual ads/subtitle tracks/comments, DRM, mobile, Firefox 142 or Chrome runtime validation. Caption/ad/comments are fixtures. Shorts full screen/embed/PiP remain excluded; Firefox native PiP cannot be guaranteed detected. DOM-based detection/UI rectangles may need updates when YouTube changes its layout. Video must be at least half visible; intermediate scroll/URL mismatch intentionally stops drawing. Shorts uses page scope while preserving the stored user's scope for other pages.

No merge of the new Shorts PR, no signing/store publication. The unsigned ZIP is for temporary installation.

## Reproduce

`npm ci`, `npm run check`, `npm test`, `npm run package`, `npm run package:firefox`, `npm run lint:firefox`, `npm run test:firefox`, `npm run test:youtube -- --live`, `npm run test:youtube:fullscreen -- --live`, `npm run test:youtube:shorts -- --live`.

Local release used `X_AMBIENT_OUTPUT_DIR=output/youtube-shorts-release` to preserve older locked package folders. For this custom path, lint with `npm exec -- web-ext lint --source-dir output/youtube-shorts-release/x-ambient-firefox --warnings-as-errors`. See YOUTUBE_SHORTS.ja.md for installation and behavior.
