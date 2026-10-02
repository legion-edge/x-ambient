# Shorts first-navigation investigation (2026-10-02)

Production base: c76c807b9c89d1014c77b3f3df1f9b2085856db1, PR #7. Firefox 157.0, headless WebDriver, disposable profiles, logged-out public /shorts/O3CxEgqYd0A. No user account or profile data. Each comparison round shares one profile, tab and URL; settings are changed through the installed extension's storage in its own popup page.

## Observations

2026-10-01 saved round completed before environment switch: 3 OFF and 3 ON cases, immediate and 8-second waits. All six first native clicks reached the document as trusted events but left the URL/player ID unchanged for 3.5s. The second native click changed URL and loaded the next player in all six. The final focused-player ArrowDown did not navigate; this is recorded as an unsuccessful input, not a passed test.

2026-10-02 method round (8-second wait after ready video and enabled navigation button):

| Input | OFF first input | ON first input | Subsequent native click when needed |
| --- | --- | --- | --- |
| WebDriver element click | navigated | no navigation | navigated |
| Move pointer, wait 350ms, click | no navigation | no navigation | navigated |
| ArrowDown to body | navigated | no navigation | navigated |
| Wheel input at (400,400), deltaY 650 | no navigation | no navigation | navigated |

The next videos are recommendations selected by YouTube and vary between loads. The same source URL was reloaded for each case. These small samples are observations, not estimates of failure rates.

Final control round: same profile had OFF then ON pointer-hover clicks, both initially unchanged and both successful on another native click. The add-on was then completely uninstalled from that disposable profile. Without the extension installed, native click, ArrowDown and wheel each initially left the same source URL unchanged; each following native button click navigated. Host absent, ambient false and no owned native-ambient class were confirmed. Trusted click/key/wheel events reached the document. No synthetic DOM click, history patch or YouTube settings change was used.

Thus extension rendering/content-script execution is not necessary for the observed first-input failure. We did not find evidence that it is an extension-specific blocker. The precise YouTube/Firefox/WebDriver cause remains unknown; real human desktop behavior and possible changes in probability were not measured. An eight-second load wait and pointer hover did not reliably eliminate it. We do not change production click handling, intercept site input, or automatically retry clicks for users.

## Evidence and reproduction

`output/shorts-navigation-qa/previous-results.json` (saved 2026-10-01), `methods-results.json` (8 method cases), and `results.json` (final uninstall controls), plus screenshots. Each record contains URL/player readiness, actual event type/trust/time, ambient/owner state, and whether the subsequent click succeeded. Resource logging stores only endpoint paths and timings, never query strings/headers/tokens. All comparison runs finished and closed their own Firefox profile.

`npm run test:youtube:navigation` reproduces OFF/ON input comparisons followed by uninstall controls in one disposable profile. It is an observational investigation and records failed first inputs explicitly. Use `X_AMBIENT_OUTPUT_DIR` for a custom package directory. It never uninstalls the extension from the user's normal Firefox profile.
