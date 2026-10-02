const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {Builder, By} = require('selenium-webdriver'), firefox = require('selenium-webdriver/firefox');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/firefox-native-pip-qa');
fs.mkdirSync(out, {recursive: true}); const results = [];
(async () => {
  let driver;
  const extension = path.join(out, 'extension');
  fs.cpSync(path.join(process.env.X_AMBIENT_OUTPUT_DIR || path.join(root, 'output'), 'x-ambient-firefox'), extension, {recursive: true});
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  manifest.content_scripts[0].matches.push('http://127.0.0.1/watch*');
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  fs.appendFileSync(path.join(extension, 'src/streaming.js'), "\nif(location.hostname==='127.0.0.1')globalThis.XAmbientStreaming=Object.freeze({...globalThis.XAmbientStreaming,platformForHostname:()=> 'youtube'});\n");
  fs.appendFileSync(path.join(extension, 'src/content.js'), "\ndocument.addEventListener('xa-test-settings',event=>chrome.storage.local.get('xAmbientSettings').then(r=>chrome.storage.local.set({xAmbientSettings:{...r.xAmbientSettings,...JSON.parse(event.detail)}})));\n");
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/watch' ? '/tests/fixtures/youtube-watch.html' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try { res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : file.endsWith('.webm') ? 'video/webm' : 'application/octet-stream'); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    driver = await new Builder().forBrowser('firefox').setFirefoxService(new firefox.ServiceBuilder().addArguments('--allow-system-access')).setFirefoxOptions(new firefox.Options().addArguments('-headless').setPreference('media.autoplay.default', 0)).build();
    await driver.manage().setTimeouts({pageLoad: 30000, script: 15000});
    await driver.manage().window().setRect({width: 1100, height: 950});
    await driver.installAddon(extension, true);
    results.push({browser: (await driver.getCapabilities()).get('browserVersion'), profile: 'WebDriver disposable; no personal credentials'});
    await driver.get(`http://127.0.0.1:${server.address().port}/watch?v=aaaaaaaaaaa`);
    const visible = () => driver.executeScript("return !!document.querySelector('#x-ambient-light')?.shadowRoot.querySelector('.light.visible')");
    const settings = detail => driver.executeScript("document.dispatchEvent(new CustomEvent('xa-test-settings',{detail:JSON.stringify(arguments[0])}))", detail);
    const nativeState = async () => {
      await driver.setContext('chrome');
      const opened = await driver.executeScript("return !!document.querySelector('.tabbrowser-tab[selected][pictureinpicture]')");
      await driver.setContext('content'); return opened;
    };
    const toggleNative = async () => {
      await driver.actions().contextClick(await driver.findElement(By.css('#movie_player video'))).perform();
      await driver.setContext('chrome');
      const item = await driver.findElement(By.id('context-video-pictureinpicture'));
      assert.equal(await driver.executeScript('return arguments[0].hidden || arguments[0].disabled', item), false);
      // A real browser menu click; no private PictureInPicture functions/events are invoked.
      await item.click(); await driver.setContext('content');
    };
    await driver.wait(visible, 10000);
    await driver.executeScript("window.pipEvents=[];const v=document.querySelector('#movie_player video');v.play();v.addEventListener('enterpictureinpicture',()=>pipEvents.push('enter'));v.addEventListener('leavepictureinpicture',()=>pipEvents.push('leave'))");
    await toggleNative(); await driver.wait(nativeState, 8000, 'native browser PiP must actually open');
    const api = await driver.executeScript("const v=document.querySelector('#movie_player video');return {standardElement:!!document.pictureInPictureElement,standardEvents:window.pipEvents,cloneExposed:'isCloningElementVisually' in v,requestAPI:typeof v.requestPictureInPicture}");
    assert.equal(api.standardElement, false); assert.deepEqual(api.standardEvents, []); assert.equal(api.cloneExposed, false);
    assert.equal(await visible(), true);
    results.push({test: 'real Firefox native PiP menu opens; content standard API/events and privileged clone flag do not expose its state', pass: true, browserPiP: true, ambientAutomaticStop: false, ...api});
    await settings({enabled: false}); await driver.wait(async () => !await visible(), 5000);
    assert.equal(await nativeState(), true);
    assert.equal(await driver.executeScript("return getComputedStyle(document.querySelector('#cinematics')).visibility"), 'visible');
    await toggleNative(); await driver.wait(async () => !await nativeState(), 8000, 'native PiP closes');
    await settings({enabled: true}); await driver.wait(visible, 8000);
    assert.equal(await driver.executeScript("return document.querySelectorAll('#x-ambient-light').length"), 1);
    results.push({test: 'addon OFF leaves browser PiP open and restores native ambient; native menu close then addon ON restores one renderer', pass: true});
  } catch (error) { results.push({error: error.stack}); process.exitCode = 1; }
  finally {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    if (driver) await driver.quit(); await new Promise(resolve => server.close(resolve));
  }
  console.log(JSON.stringify(results, null, 2));
})();
