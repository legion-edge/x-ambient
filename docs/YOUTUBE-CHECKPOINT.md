# YouTube work checkpoint (in progress)

Base: Firefox PR #1 head 3190739d09c74b3a08617ed159d93e4941ed843b. Branch: youtube-support. Issue: https://github.com/legion-edge/x-ambient/issues/2.

Implemented: www.youtube.com-only content script; watch main video adapter, current video-id check, ad/miniplayer/fullscreen/standard PiP exclusion, paused frames and SPA route handling including v changes, native #cinematics suppression only while extension renders, existing Canvas renderer reuse. Japanese instructions and original local-media fixture added. No changes to user browser profiles or YouTube stored settings. No merge/signing/store submission.

At this checkpoint, Windows Firefox 157 disposable-profile fixture tests passed normal playback Canvas updates, theater, pause/seek, ads/native ambient restore, watch ID and eventless pushState, home/watch/back/forward, video replacement, Shorts/embed/miniplayer exclusion and real fullscreen. Scroll test initially used a fixed offset that did not move a replaced portrait video fully outside the viewport; it now scrolls to document bottom and full test is rerunning. Do not treat this checkpoint as complete.

Remaining: finish full YouTube fixture run and public logged-out live-site attempt; run Firefox regression; review findings; final QA screenshots; final commit/push/draft PR and remote CI verification. Live-site ads, Firefox native PiP and latest DOM cannot be guaranteed by fixture tests.

Existing output/x-ambient-firefox folder is locked by another process, so do not kill any existing Firefox process. Dedicated build output is output/youtube-build. PowerShell: set $env:X_AMBIENT_OUTPUT_DIR to the absolute output/youtube-build path; npm run package:firefox; npm run test:youtube -- --live; npm run test:firefox. Lint that directory with npm exec -- web-ext lint --source-dir output/youtube-build/x-ambient-firefox --warnings-as-errors. Outputs/results are ignored local files, not credentials.
