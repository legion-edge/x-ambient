# Firefox validation record

Upstream: mmnga/x-ambient @ 6977a59c26b731c4909970fdf814dc282c29093b. Windows, Node 24.11.1, installed Firefox 157.0, headless WebDriver disposable profile. No existing user profile or credentials used. Gecko minimum 142 is conservative; 142 itself has not been runtime-tested.

- npm run check: passed
- npm test: 35 passed
- Chrome and Firefox packages: built
- web-ext lint --warnings-as-errors: 0 errors, 0 notices, 0 warnings
- Installed temporary extension on localhost-only fixture copy: popup setting save/reopen/reset; real storage.local; images/nontransparent Canvas; SVG media mask/Shadow DOM; video Canvas frame changes; popup on/off propagation; repeated toggles, scrolling and resize; one renderer after repeated operations: passed.
- image.png and video.png visually inspected: ambient visible, original media retained; resize screenshot captured after mask/layout settles.
- Independent review: poster loading can make media requests; documentation corrected. Firefox build/lint added to CI. Removed undocumented Android support flag.

Local evidence: output/firefox-qa/results.json, image.png, video.png. Artifacts: output/x-ambient-firefox.zip and output/x-ambient.zip. Recreate using npm ci, npm run package:firefox, npm run lint:firefox, npm run test:firefox.

Not validated: logged-in/live X, Instagram, Twitch or Kick; cross-origin/DRM media; Firefox 142 runtime; both themes, all site selectors, SPA transitions. x-detail fixture was served on localhost and exercises hover, not the real X status route. Popup was opened as an extension page through WebDriver, not the toolbar's transient popup lifecycle. No AMO submission/signing/store publication; no merge. Unsigned build is for temporary installation.

Source audit found storage.local, bundled locale JSON fetch, and existing video.poster Image loads; no telemetry, collection endpoint, XHR, WebSocket or beacon. The manifest none declaration concerns personal-data collection/transmission, not site or poster network traffic. MIT LICENSE retained in both archives.
