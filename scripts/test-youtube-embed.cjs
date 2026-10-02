const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const {Builder, By, Key} = require('selenium-webdriver'), firefox = require('selenium-webdriver/firefox');
const privacyEnhanced = process.argv.includes('--nocookie');
const embedHost = privacyEnhanced ? 'www.youtube-nocookie.com' : 'www.youtube.com';
const root = path.resolve(__dirname, '..'), out = path.join(root, privacyEnhanced ? 'output/youtube-nocookie-qa' : 'output/youtube-embed-qa');
fs.mkdirSync(out, {recursive: true});
const results = [];
process.env.MOZ_HEADLESS_WIDTH = '1280'; process.env.MOZ_HEADLESS_HEIGHT = '1024';
(async () => {
  let driver;
  const extension = path.join(out, 'extension');
  fs.cpSync(path.join(process.env.X_AMBIENT_OUTPUT_DIR || path.join(root, 'output'), 'x-ambient-firefox'), extension, {recursive: true});
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  // Only the test copy grants a fixture-frame host; the parent remains unmatched.
  manifest.content_scripts[1].matches.push('http://localhost/embed/*');
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  fs.appendFileSync(path.join(extension, 'src/streaming.js'), "\nif(location.hostname==='localhost')globalThis.XAmbientStreaming=Object.freeze({...globalThis.XAmbientStreaming,platformForHostname:()=> 'youtube'});\n");
  const content = path.join(extension, 'src/content.js');
  fs.writeFileSync(content, fs.readFileSync(content, 'utf8').replace('function paint(index) {', 'function paint(index) { host.dataset.testPaints=String(Number(host.dataset.testPaints||0)+1);') + "\ndocument.addEventListener('xa-test-settings',event=>chrome.storage.local.get('xAmbientSettings').then(r=>chrome.storage.local.set({xAmbientSettings:{...r.xAmbientSettings,...JSON.parse(event.detail)}})));\n");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/parent') {
      const frameURL = url.searchParams.has('live') ? `https://${embedHost}/embed/aqz-KE-bpKQ?autoplay=1&mute=1` : `http://localhost:${server.address().port}/embed/aaaaaaaaaaa`;
      res.setHeader('Content-Type', 'text/html');
      return res.end(`<!doctype html><title>Cross-origin embed test parent</title><style>body{margin:24px;background:white}iframe{border:0;width:${url.searchParams.has('live')?'480px':'640px'};height:${url.searchParams.has('live')?'640px':'480px'}}footer{height:1800px}</style><h1>Public or original local video frame</h1><iframe allow="autoplay; fullscreen" allowfullscreen src="${frameURL}"></iframe><footer>Scroll fixture</footer>`);
    }
    const name = url.pathname.startsWith('/embed/') ? '/tests/fixtures/youtube-embed.html' : url.pathname;
    const file = path.resolve(root, '.' + name);
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
    const base = `http://127.0.0.1:${server.address().port}`;
    const enter = async () => { await driver.switchTo().defaultContent(); await driver.switchTo().frame(await driver.findElement(By.css('iframe'))); };
    const state = () => driver.executeScript("const h=document.querySelector('#x-ambient-light');return {visible:!!h?.shadowRoot.querySelector('.light.visible'),paints:Number(h?.dataset.testPaints||0),hosts:document.querySelectorAll('#x-ambient-light').length,scope:h?.dataset.scope,full:!!document.fullscreenElement}");
    const on = () => driver.wait(async () => (await state()).visible, 10000, 'frame ambient visible');
    const off = () => driver.wait(async () => !(await state()).visible, 8000, 'frame ambient stopped');
    const settings = detail => driver.executeScript("document.dispatchEvent(new CustomEvent('xa-test-settings',{detail:JSON.stringify(arguments[0])}))", detail);
    const capture = async name => { await driver.switchTo().defaultContent();await driver.executeAsyncScript('scrollTo(0,0);const done=arguments[arguments.length-1];requestAnimationFrame(()=>requestAnimationFrame(done))'); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(await driver.takeScreenshot(), 'base64')); await enter(); };
    const pixels = async points => {
      await driver.switchTo().defaultContent();
      await driver.executeAsyncScript('scrollTo(0,0);const done=arguments[arguments.length-1];requestAnimationFrame(()=>requestAnimationFrame(done))');
      const rect = await driver.executeScript("const r=document.querySelector('iframe').getBoundingClientRect();return {left:r.left,top:r.top,width:document.defaultView.innerWidth,height:document.defaultView.innerHeight}");
      const png = await driver.takeScreenshot();
      const value = await driver.executeAsyncScript("const png=arguments[0],points=arguments[1],rect=arguments[2],done=arguments[arguments.length-1],image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);done(points.map(p=>[...x.getImageData(Math.round((rect.left+p[0])*image.width/rect.width),Math.round((rect.top+p[1])*image.height/rect.height),1,1).data]));};image.src='data:image/png;base64,'+png", png, points, rect);
      await enter(); return value;
    };
    await driver.get(base + '/parent');
    assert.equal(await driver.executeScript("return !!document.querySelector('#x-ambient-light')"), false);
    const parentHTML = await driver.executeScript('return document.body.innerHTML');
    await enter(); await on();
    assert.equal((await state()).hosts, 1);
    await driver.executeScript("document.querySelector('video').pause()"); await driver.sleep(400);
    const points = await driver.executeScript("const es=[document.querySelector('video'),document.querySelector('.caption-window'),document.querySelector('#control'),document.querySelector('.ytmVideoInfoVideoTitle')];return [[100,360],...es.map(e=>{const r=e.getBoundingClientRect();return e.tagName==='VIDEO'?[r.left+r.width/2,r.top+r.height/2]:[r.left+3,r.top+3]})]");
    await driver.sleep(500);const lit = await pixels(points); await capture('fixture-on');
    await settings({enabled: false}); await off(); await driver.sleep(400);
    const unlit = await pixels(points); await capture('fixture-off');
    assert.notDeepEqual(lit[0], unlit[0]); assert.deepEqual(lit.slice(1), unlit.slice(1));
    await settings({enabled: true, scope: 'post'}); await on(); assert.equal((await state()).scope, 'page');
    await driver.findElement(By.id('control')).click(); assert.equal(await driver.executeScript('return fixture.clicks'), 1);
    results.push({test: 'cross-origin fixture frame only; one host; visible margin ON/OFF; video/title/caption/control pixels preserved; post setting stays frame-local', pass: true});
    await driver.executeScript("document.querySelector('#menu').hidden=false"); await driver.sleep(400);
    const menuOn = await pixels([[600,50]]); await settings({enabled: false}); await off(); await driver.sleep(300); assert.deepEqual(await pixels([[600,50]]), menuOn);
    await settings({enabled: true}); await on(); await driver.executeScript("document.querySelector('#menu').hidden=true");
    results.push({test: 'dynamic menu mask without resize', pass: true});
    for (const change of ["document.querySelector('#movie_player').classList.add('ad-showing')", "document.querySelector('.ytmVideoInfoVideoTitle').href='https://www.youtube.com/watch?v=bbbbbbbbbbb'"]) {
      await driver.executeScript(change); await off();
      await driver.executeScript("document.querySelector('#movie_player').classList.remove('ad-showing');document.querySelector('.ytmVideoInfoVideoTitle').href='https://www.youtube.com/watch?v=aaaaaaaaaaa'"); await on();
    }
    await driver.executeScript("const old=document.createElement('a');old.className='ytp-title-link';old.href='/watch?v=bbbbbbbbbbb';old.id='stale-title';document.querySelector('#movie_player').prepend(old)"); await off();
    await driver.executeScript("document.querySelector('#stale-title').remove()"); await on();
    results.push({test: 'fixture ad, mismatched title and retained stale title stop; correct title restores', pass: true});
    await driver.executeScript("document.querySelector('video').style.objectFit='cover'"); await off(); const stopped = (await state()).paints; await driver.sleep(700); assert.equal((await state()).paints, stopped);
    await driver.executeScript("document.querySelector('video').style.objectFit='contain'"); await on();
    results.push({test: 'screen-filling embed stops paint and resumes with margins', pass: true});
    await driver.switchTo().defaultContent(); await driver.executeScript('scrollTo(0,1000)'); await enter(); await off();
    const hiddenPaints = (await state()).paints; await driver.sleep(700); assert.equal((await state()).paints, hiddenPaints);
    await driver.switchTo().defaultContent(); await driver.executeScript('scrollTo(0,0)'); await enter(); await on();
    results.push({test: 'parent scroll offscreen stops frame paint without parent access; visible frame resumes', pass: true});
    await driver.switchTo().defaultContent(); await driver.executeScript("document.querySelector('iframe').style.display='none'"); await enter();await driver.sleep(300);const cssHiddenPaints=(await state()).paints;await driver.sleep(700);assert.equal((await state()).paints,cssHiddenPaints);
    await driver.switchTo().defaultContent(); await driver.executeScript("document.querySelector('iframe').removeAttribute('style')"); await enter(); await on();
    results.push({test:'display-none frame suspends paints and restores',pass:true});await driver.findElement(By.id('fullscreen')).click(); await driver.wait(async () => (await state()).full, 5000); await on(); assert.equal((await state()).scope, 'fullscreen'); await capture('fixture-fullscreen');
    await driver.actions().sendKeys(Key.ESCAPE).perform(); await driver.wait(async () => !(await state()).full, 5000); await on();await driver.switchTo().defaultContent();if(await driver.executeScript('return !!document.fullscreenElement'))await driver.executeScript('return document.exitFullscreen()');await enter();await on();
    results.push({test:'fixture player fullscreen/Esc',pass:true});await driver.switchTo().defaultContent();await driver.executeScript("const b=document.createElement('button');b.id='frame-fullscreen';b.textContent='Frame fullscreen';b.style.cssText='position:fixed;left:8px;top:8px;z-index:2147483647';b.onclick=()=>document.querySelector('iframe').requestFullscreen();document.body.prepend(b)");await driver.findElement(By.id('frame-fullscreen')).click();await driver.wait(()=>driver.executeScript("return document.fullscreenElement===document.querySelector('iframe')"),5000);await enter();await on();await capture('fixture-frame-fullscreen');await driver.actions().sendKeys(Key.ESCAPE).perform();await driver.switchTo().defaultContent();const iframeEscClosed=await driver.executeScript('return !document.fullscreenElement');if(!iframeEscClosed)await driver.executeScript('return document.exitFullscreen()');await driver.wait(()=>driver.executeScript('return !document.fullscreenElement'),5000,'parent standard fullscreen API exit');results.push({test:'iframe fullscreen and standard API exit',pass:true,escapeClosedParent:iframeEscClosed});await driver.executeScript("document.querySelector('#frame-fullscreen').remove()");assert.equal(await driver.executeScript('return document.body.innerHTML'),parentHTML); assert.equal(await driver.executeScript("return !!document.querySelector('#x-ambient-light')"), false);
    results.push({test: 'display-none frame has no paints and restores; player Esc and parent standard fullscreen API exit; parent DOM remains unchanged', pass: true});
    if (process.argv.includes('--live')) {
      await driver.get(base + '/parent?live'); await enter(); await on();
      const playButtons=await driver.findElements(By.css('button.ytmCuedOverlayPlayButton,button.ytp-large-play-button,button[aria-label="再生"],button[aria-label="動画を再生"],button[aria-label="Play"],button[aria-label="Play video"]'));let trustedPlay=false;for(const b of playButtons){if(await b.isDisplayed()){await b.click();trustedPlay=true;break;}}if(!trustedPlay)await driver.executeScript("return document.querySelector('#movie_player video').play()");await driver.wait(()=>driver.executeScript("return document.querySelector('#movie_player video').currentTime>1"),15000,'public playback progresses');await driver.executeScript("const v=document.querySelector('#movie_player video');v.currentTime=45;v.pause()");await driver.wait(()=>driver.executeScript("const v=document.querySelector('#movie_player video');return !v.seeking&&v.readyState>=2&&v.currentTime>44"),15000);await driver.sleep(2200);
      const dimensions = await driver.executeScript("const v=document.querySelector('#movie_player video');return {source:[v.videoWidth,v.videoHeight],viewport:[innerWidth,innerHeight],fit:getComputedStyle(v).objectFit,pathname:location.pathname,hostname:location.hostname}");
      assert.equal(dimensions.hostname, embedHost, 'privacy-enhanced host must not be rewritten');
      const originalSource = await driver.executeScript("return document.querySelector('#movie_player video').currentSrc");
      const liveOn = await pixels([[240,100],[40,100],[440,540],[240,540],[80,240],[80,320],[400,380],[15,50],[16,528],[35,548]]); await capture('live-on'); await settings({enabled: false}); await off(); await driver.sleep(500);
      const liveOff = await pixels([[240,100],[40,100],[440,540],[240,540],[80,240],[80,320],[400,380],[15,50],[16,528],[35,548]]); await capture('live-off'); assert.notDeepEqual(liveOn.slice(0,4),liveOff.slice(0,4));assert.deepEqual(liveOn.slice(4),liveOff.slice(4),'public paused video pixels must remain unchanged');
      await settings({enabled: true}); await on();
      assert.equal(await driver.executeScript("return document.querySelector('#movie_player video').currentSrc"), originalSource, 'addon must not replace/refetch the media source');
      await driver.switchTo().defaultContent(); assert.equal(await driver.executeScript("return !!document.querySelector('#x-ambient-light')"), false);
      results.push({test: 'real public YouTube cross-origin embed, visible margin ON/OFF and setting restore; parent unmatched', pass: true, embedHost, privacyEnhanced, trustedPlay,marginOn: liveOn.slice(0,4), marginOff: liveOff.slice(0,4),videoPixels:liveOn.slice(4,7),uiPixels:liveOn.slice(7), ...dimensions});
    }
  } catch (error) {
    results.push({error: error.stack}); process.exitCode = 1;if(driver)try{results.push({diagnostics:await driver.executeScript("return {path:location.pathname,fullTag:document.fullscreenElement?.tagName,fixture:window.fixture,host:document.querySelector('#x-ambient-light')?.dataset,bodyRect:document.body.getBoundingClientRect().toJSON()}" )});}catch{}
    if (driver) try { await driver.switchTo().defaultContent(); fs.writeFileSync(path.join(out, 'failure.png'), Buffer.from(await driver.takeScreenshot(), 'base64')); } catch {}
  } finally {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    if (driver) await driver.quit(); await new Promise(resolve => server.close(resolve));
  }
  console.log(JSON.stringify(results, null, 2));
})();
