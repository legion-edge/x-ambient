const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const {Builder, By, Key} = require('selenium-webdriver'), firefox = require('selenium-webdriver/firefox');
const Core = require('../src/ambient-core.js');
const root = path.resolve(__dirname, '..'), baseline = process.argv.includes('--baseline');
const out = path.join(root, 'output', baseline ? 'shorts-overlay-baseline' : 'shorts-overlay-qa');
fs.mkdirSync(out, {recursive: true});
const results = [];
process.env.MOZ_HEADLESS_WIDTH = '1600'; process.env.MOZ_HEADLESS_HEIGHT = '1100';
(async () => {
  let driver;
  const extension = path.join(out, 'extension');
  fs.cpSync(path.join(process.env.X_AMBIENT_OUTPUT_DIR || path.join(root, 'output'), 'x-ambient-firefox'), extension, {recursive: true});
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json')));
  manifest.content_scripts[0].matches.push('http://127.0.0.1/*');
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  fs.appendFileSync(path.join(extension, 'src/streaming.js'), "\nif(location.hostname==='127.0.0.1')globalThis.XAmbientStreaming=Object.freeze({...globalThis.XAmbientStreaming,platformForHostname:()=> 'youtube'});\n");
  const content = path.join(extension, 'src/content.js');
  fs.writeFileSync(content, fs.readFileSync(content, 'utf8').replace('function paint(index) {', 'function paint(index) { host.dataset.testPaints=String(Number(host.dataset.testPaints||0)+1);') + "\ndocument.addEventListener('xa-test-settings',event=>chrome.storage.local.get('xAmbientSettings').then(r=>chrome.storage.local.set({xAmbientSettings:{...r.xAmbientSettings,...JSON.parse(event.detail)}})));\n");
  const server = http.createServer((req, res) => {
    let name = new URL(req.url, 'http://localhost').pathname;
    if (name.startsWith('/shorts/')) name = '/tests/fixtures/youtube-shorts-overlay.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try { res.setHeader('Content-Type', ({'.html':'text/html','.webm':'video/webm'})[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    // All input goes to this headless WebDriver session, never the desktop or another app.
    driver = await new Builder().forBrowser('firefox').setFirefoxService(new firefox.ServiceBuilder().addArguments('--allow-system-access'))
      .setFirefoxOptions(new firefox.Options().addArguments('-headless').setPreference('media.autoplay.default', 0).setPreference('intl.accept_languages', 'en-US')).build();
    await driver.manage().setTimeouts({pageLoad:30000,script:20000});
    await driver.manage().window().setRect({width:1500,height:1050});
    await driver.installAddon(extension, true);
    results.push({browser:(await driver.getCapabilities()).get('browserVersion'),profile:'Disposable headless; no personal credentials or desktop input',baseline});
    const settings = detail => driver.executeScript("document.dispatchEvent(new CustomEvent('xa-test-settings',{detail:JSON.stringify(arguments[0])}))", detail);
    const state = () => driver.executeScript("const h=document.querySelector('#x-ambient-light');return {visible:!!h?.shadowRoot.querySelector('.light.visible'),owners:document.querySelectorAll('.xa-youtube-active').length,paints:Number(h?.dataset.testPaints||0),full:!!document.fullscreenElement}");
    const on = () => driver.wait(async () => { const s=await state(); return s.visible && s.owners===1; },10000,'one visible renderer');
    const off = () => driver.wait(async () => !(await state()).visible,8000,'drawing stops');
    const capture = async name => { const png=await driver.takeScreenshot(); fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(png,'base64')); return png; };
    const decode = (png, regions, bands) => driver.executeAsyncScript(`
      const png=arguments[0],regions=arguments[1],bands=arguments[2],done=arguments[arguments.length-1],image=new Image();
      image.onload=()=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);
      const sample=r=>{const sx=image.width/innerWidth,sy=image.height/innerHeight,l=Math.max(0,Math.ceil(r.left*sx)),t=Math.max(0,Math.ceil(r.top*sy)),w=Math.min(image.width-l,Math.floor((r.left+r.width)*sx)-l),h=Math.min(image.height-t,Math.floor((r.top+r.height)*sy)-t);return w>0&&h>0?[...x.getImageData(l,t,w,h).data]:[]};done({regions:regions.map(sample),bands:bands.map(sample)});};image.src='data:image/png;base64,'+png`,png,regions,bands);
    const geometry = async () => {
      const g = await driver.executeScript(`const r=document.querySelector('ytd-reel-video-renderer.xa-youtube-active'),v=r.querySelector('video'),box=v.getBoundingClientRect(),s=getComputedStyle(v),range=document.createRange(),title=r.querySelector('#title');const elements=[r.querySelector('.caption-window'),r.querySelector('#actions button'),r.querySelector('#local-icon'),r.querySelector('.badge'),r.querySelector('#sticker-layer'),document.querySelector('#comments'),document.querySelector('ytd-guide-renderer')].filter(e=>e&&getComputedStyle(e).display!=='none');const rects=elements.map(e=>{const b=e.getBoundingClientRect();return {left:b.left+3,top:b.top+3,width:b.width-6,height:b.height-6}});for(const title of document.querySelectorAll('ytd-reel-video-renderer #title')){range.selectNodeContents(title);for(const b of range.getClientRects())if(b.width&&b.height)rects.push({left:b.left,top:b.top,width:b.width,height:b.height});}const neighbors=[...document.querySelectorAll('ytd-reel-video-renderer video')].filter(e=>e!==v&&e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>({source:[e.videoWidth,e.videoHeight],box:e.getBoundingClientRect().toJSON(),fit:getComputedStyle(e).objectFit}));return {source:[v.videoWidth,v.videoHeight],box:box.toJSON(),fit:s.objectFit,viewport:[innerWidth,innerHeight],overlay:r.querySelector('#overlay')?.getBoundingClientRect().toJSON(),rects,neighbors};`);
      const picture = Core.contentRect(g.source[0],g.source[1],g.box,g.fit,[.5,.5]);
      g.picture = picture;
      g.regions = [{left:picture.left,top:picture.top,width:picture.width,height:picture.height},...g.rects,...g.neighbors.map(n=>Core.contentRect(n.source[0],n.source[1],n.box,n.fit,[.5,.5]))];
      g.bands = [-1,1].map(side=>({left:side<0?picture.left-75:picture.right+10,top:picture.top+picture.height*.15,width:65,height:picture.height*.7}));
      return g;
    };
    const hash = values => crypto.createHash('sha256').update(Buffer.from(values)).digest('hex');
    const compare = async name => {
      await settings({enabled:true,intensity:85,spread:90}); await on(); await driver.sleep(500);
      const g=await geometry(), lit=await decode(await capture(name+'-on'),g.regions,g.bands);
      await settings({enabled:false}); await off(); await driver.sleep(450);
      const plain=await decode(await capture(name+'-off'),g.regions,g.bands);
      assert.deepEqual(lit.regions.map(hash),plain.regions.map(hash),name+': complete video/text/caption/control/icon/card regions must be unchanged');
      const changed=lit.bands.map((a,i)=>{const b=plain.bands[i];let n=0;for(let p=0;p<a.length;p+=4)if(a[p]!==b[p]||a[p+1]!==b[p+1]||a[p+2]!==b[p+2])n++;return n/(a.length/4);});
      if(baseline)assert.ok(changed.every(n=>n===0),'baseline large transparent wrapper must reproduce missing inner glow');
      else assert.ok(changed.every(n=>n>.25),name+': both broad inner margins must visibly glow');
      const stopped=await state();await driver.sleep(450);assert.equal((await state()).paints,stopped.paints,'OFF paints stop');
      results.push({test:name,pass:true,changedFraction:changed,preservedRegions:g.regions.length,picture:g.picture,overlay:g.overlay,viewport:g.viewport});
      await settings({enabled:true});await on();
    };
    await driver.get(`http://127.0.0.1:${server.address().port}/shorts/aaaaaaaaaaa`);await on();
    await driver.executeScript("document.querySelectorAll('video').forEach(v=>{v.currentTime=1.2;v.pause()})");await driver.wait(()=>driver.executeScript("return [...document.querySelectorAll('video')].every(v=>!v.seeking&&v.readyState>=2)"),10000);
    await compare('light-wide');
    if(!baseline){
      await driver.executeScript('fixture.sidebar(true)');await compare('light-sidebar');
      await driver.executeScript('fixture.theme(true)');await compare('dark-sidebar');
      await driver.executeScript('fixture.sidebar(false)');await compare('dark-wide');
      await driver.executeScript('fixture.theme(false);document.documentElement.classList.add("short-title")');
      for(const width of [1050,1350]){await driver.manage().window().setRect({width,height:950});await compare('light-resize-'+width);}
      const oldMask=await driver.executeScript("return document.querySelector('#x-ambient-light').shadowRoot.querySelector('.light').style.maskImage");
      await driver.executeScript("document.querySelector('.xa-youtube-active #title').firstChild.nodeValue='Updated title with additional wrapped lines and local protection'");
      await driver.wait(()=>driver.executeScript("return document.querySelector('#x-ambient-light').shadowRoot.querySelector('.light').style.maskImage!==arguments[0]",oldMask),5000,'characterData updates the protection mask');await compare('dynamic-text');
      await driver.executeScript('fixture.comments()');await compare('comments');await driver.executeScript('fixture.comments()');
      await driver.executeScript("const r=document.querySelectorAll('ytd-reel-video-renderer')[1];r.hidden=false;r.style.cssText='position:fixed;inset:auto;left:30px;top:calc(100vh - 230px);width:200px;height:200px;transform:translateY(10px)';");await compare('partial-neighbor');
      assert.equal(await driver.executeScript("return document.querySelector('.xa-youtube-active').getAttribute('video-id')"),'aaaaaaaaaaa','neighbor protection does not change the selected video');
      const paused=await state();await driver.sleep(600);assert.equal((await state()).paints,paused.paints,'paused neighbor layout does not continuously paint');
      await driver.executeScript("const r=document.querySelectorAll('ytd-reel-video-renderer')[1];r.hidden=true;r.removeAttribute('style');fixture.go(1)");await on();await compare('next-short');
      await driver.executeScript('fixture.go(0)');await driver.wait(()=>driver.executeScript("return document.querySelector('.xa-youtube-active')?.getAttribute('video-id')==='aaaaaaaaaaa'"),5000);await on();await driver.findElement(By.css('.xa-youtube-active #actions button')).click();assert.equal(await driver.executeScript('return fixture.clicks'),1,'controls remain clickable');
      await driver.findElement(By.css('.xa-youtube-active #fullscreen')).click();await driver.wait(async()=> (await state()).full,5000);await compare('fullscreen');await driver.actions().sendKeys(Key.ESCAPE).perform();await driver.wait(async()=> !(await state()).full,5000);await on();results.push({test:'fixture control clicks and fullscreen/Esc restore one renderer',pass:true});
      if(process.argv.includes('--live')){
        await driver.manage().window().setRect({width:1500,height:1050});await driver.get('https://www.youtube.com/shorts/O3CxEgqYd0A');await on();
        await driver.executeScript("document.querySelector('.xa-youtube-active video').pause()");await driver.actions().move({x:5,y:5}).perform();await driver.sleep(5000);
        const g=await geometry();g.regions=g.regions.filter(r=>r.width>0&&r.height>0);
        const lit=await decode(await capture('live-light-on'),g.regions,g.bands);await settings({enabled:false});await off();await driver.sleep(600);const plain=await decode(await capture('live-light-off'),g.regions,g.bands);
        assert.deepEqual(lit.regions.map(hash),plain.regions.map(hash),'live paused media/UI regions must be unchanged');
        const changed=lit.bands.map((a,i)=>{const b=plain.bands[i];let n=0;for(let p=0;p<a.length;p+=4)if(a[p]!==b[p]||a[p+1]!==b[p+1]||a[p+2]!==b[p+2])n++;return n/(a.length/4);});assert.ok(changed.every(n=>n>.1),'live inner margins must visibly change');
        results.push({test:'public logged-out normal Shorts inner margins and full media region ON/OFF',pass:true,changedFraction:changed,picture:g.picture,overlay:g.overlay,viewport:g.viewport});await settings({enabled:true});await on();
      }
    }
  } catch(error){results.push({error:error.stack});process.exitCode=1;if(driver)try{await captureFailure(driver,out);}catch{}}
  finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));if(driver)await driver.quit();await new Promise(resolve=>server.close(resolve));}
  console.log(JSON.stringify(results,null,2));
})();
async function captureFailure(driver,out){fs.writeFileSync(path.join(out,'failure.png'),Buffer.from(await driver.takeScreenshot(),'base64'));}
