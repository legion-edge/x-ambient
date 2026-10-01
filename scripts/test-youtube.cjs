const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
const {Builder,By}=require('selenium-webdriver');const firefox=require('selenium-webdriver/firefox');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/youtube-qa');fs.mkdirSync(out,{recursive:true});
const results=[];
(async()=>{
 const extension=path.join(out,'extension');fs.cpSync(path.join(process.env.X_AMBIENT_OUTPUT_DIR || path.join(root,'output'),'x-ambient-firefox'),extension,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.content_scripts[0].matches.push('http://127.0.0.1/*');fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
 // Only the test copy routes localhost into the YouTube adapter; production code stays unchanged.
 fs.appendFileSync(path.join(extension,'src/streaming.js'),`\nif(location.hostname==='127.0.0.1'){globalThis.XAmbientStreaming=Object.freeze({...globalThis.XAmbientStreaming,platformForHostname:()=> 'youtube'});}\n`);
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let name=url.pathname;
  if(name==='/'||name==='/watch'||name.startsWith('/shorts/')||name.startsWith('/embed/'))name='/tests/fixtures/youtube-watch.html';
  const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{const types={'.html':'text/html','.js':'text/javascript','.svg':'image/svg+xml','.webm':'video/webm','.css':'text/css','.json':'application/json'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let driver;
 try{
  driver=await new Builder().forBrowser('firefox').setFirefoxService(new firefox.ServiceBuilder().addArguments('--allow-system-access')).setFirefoxOptions(new firefox.Options().addArguments('-headless').setPreference('extensions.webextensions.uuids',JSON.stringify({'x-ambient@legion-edge':'12345678-1234-4234-8234-123456789abc'})).setPreference('media.autoplay.default',0)).build();
  results.push({browser:(await driver.getCapabilities()).get('browserVersion'),profile:'WebDriver disposable Firefox profile; no personal credentials',scope:'installed extension + localhost fixture'});
  await driver.installAddon(extension,true);const base=`http://127.0.0.1:${server.address().port}`;
  const visible=()=>driver.executeScript("return !!document.querySelector('#x-ambient-light')?.shadowRoot.querySelector('.light.visible')");
  const on=async()=>driver.wait(visible,8000,'ambient should appear');const off=async()=>driver.wait(async()=>!await visible(),8000,'ambient should stop');
  const main=()=>driver.findElement(By.css('#movie_player video.html5-main-video'));
  const native=()=>driver.executeScript("return getComputedStyle(document.querySelector('#cinematics')).visibility");
  const frame=()=>driver.executeScript("return [...document.querySelector('#x-ambient-light').shadowRoot.querySelectorAll('canvas')].map(c=>c.toDataURL()).join('')");
  const capture=async name=>{await driver.executeAsyncScript('const done=arguments[arguments.length-1];requestAnimationFrame(()=>requestAnimationFrame(done))');fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(await driver.takeScreenshot(),'base64'));};
  await driver.get(base+'/watch?v=aaaaaaaaaaa');await on();assert.equal(await native(),'hidden');
  await driver.findElement(By.id('controls')).click();assert.equal(await driver.executeScript('return fixture.clicks'),1);
  const initial=await frame();await driver.executeScript('arguments[0].play()',await main());await driver.wait(async()=>await frame()!==initial,8000,'video pixels change');
  await capture('normal');results.push({test:'normal main video automatic selection, changing Canvas, click-through, native ambient suppressed',pass:true});
  await driver.findElement(By.id('theater')).click();await on();await driver.wait(()=>driver.executeScript("return document.querySelector('ytd-watch-flexy').hasAttribute('theater')"),5000);await capture('theater');
  const beforeSeek=await frame();await driver.findElement(By.id('seek')).click();await driver.wait(async()=>await frame()!==beforeSeek,5000);results.push({test:'theater and paused seek redraw',pass:true});
  await driver.findElement(By.id('advert')).click();await off();assert.equal(await native(),'visible');await driver.findElement(By.id('advert')).click();await on();results.push({test:'ads stop rendering and restore native ambient, content resumes',pass:true});
  await driver.executeScript("fixture.go('/watch?v=bbbbbbbbbbb',null,false)");await off();assert.equal(await native(),'visible');await driver.executeScript("fixture.finish('bbbbbbbbbbb')");await on();
  await driver.executeScript("history.pushState({},'', '/watch?v=ccccccccccc')");await off();await driver.executeScript("fixture.finish('ccccccccccc')");await on();results.push({test:'watch ID changes, stale player rejection, eventless pushState fallback',pass:true});
  await driver.findElement(By.id('home')).click();await off();await driver.executeScript("fixture.go('/watch?v=ddddddddddd','ddddddddddd')");await on();await driver.navigate().back();await off();await driver.navigate().forward();await on();results.push({test:'home-to-watch SPA and browser back/forward',pass:true});
  const original=await main();await driver.executeScript("const v=arguments[0],n=v.cloneNode(true);n.src='/demo/assets/portrait.webm';v.replaceWith(n)",original);await on();await driver.wait(()=>driver.executeScript("return document.querySelector('#movie_player video').videoWidth>0"),5000);results.push({test:'player replacement rebinds renderer',pass:true});
  await driver.executeScript("document.querySelector('#movie_player').classList.add('ytp-player-minimized')");await off();await driver.executeScript("document.querySelector('#movie_player').classList.remove('ytp-player-minimized')");await on();
  for(const route of ['/shorts/aaaaaaaaaaa','/embed/aaaaaaaaaaa']){await driver.executeScript('fixture.go(arguments[0])',route);await off();}await driver.executeScript("fixture.go('/watch?v=ddddddddddd','ddddddddddd')");await on();results.push({test:'mini player / Shorts / embed excluded',pass:true});
  await driver.findElement(By.id('fullscreen')).click();await driver.wait(()=>driver.executeScript('return !!document.fullscreenElement'),5000);await off();await driver.executeScript('document.exitFullscreen()');await on();results.push({test:'real fullscreen stops and exit restores',pass:true});
  await driver.executeScript('window.scrollTo(0,document.documentElement.scrollHeight)');await off();assert.equal(await native(),'visible');await driver.executeScript('window.scrollTo(0,0)');await on();
  for(let i=0;i<6;i++){await driver.findElement(By.id('theater')).click();await driver.manage().window().setRect({width:1100+i*20,height:850});await on();}
  assert.equal(await driver.executeScript("return document.querySelectorAll('#x-ambient-light').length"),1);results.push({test:'scroll-out stops, repeated theater / resize single renderer',pass:true});
  // Exercise settings through the actual extension page, retaining the watch tab.
  const watchTab=await driver.getWindowHandle();await driver.switchTo().newWindow('tab');
  await driver.setContext('chrome');await driver.executeScript("gBrowser.selectedBrowser.loadURI(Services.io.newURI(arguments[0]),{triggeringPrincipal:Services.scriptSecurityManager.getSystemPrincipal()})",'moz-extension://12345678-1234-4234-8234-123456789abc/src/popup.html');await driver.setContext('content');
  await driver.wait(async()=>!(await driver.findElement(By.id('enabled')).getAttribute('disabled')),5000);await driver.findElement(By.id('enabled')).click();await driver.wait(()=>driver.executeScript("return browser.storage.local.get('xAmbientSettings').then(r=>r.xAmbientSettings.enabled===false)"),5000);await driver.switchTo().window(watchTab);await off();assert.equal(await native(),'visible');
  results.push({test:'popup off restores YouTube native ambient',pass:true});
  if(process.argv.includes('--live')){
   await driver.close();await driver.switchTo().window((await driver.getAllWindowHandles())[0]);await driver.findElement(By.id('enabled')).click();await driver.wait(()=>driver.executeScript("return browser.storage.local.get('xAmbientSettings').then(r=>r.xAmbientSettings.enabled===true)"),5000);
   await driver.get('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
   await driver.wait(()=>driver.executeScript("return document.readyState==='complete'"),20000);
   const inspect=()=>driver.executeScript("const w=document.querySelector('ytd-watch-flexy'),p=w?.querySelector('#movie_player'),v=p?.querySelector('video.html5-main-video');return {url:location.href,title:document.title,watchId:w?.getAttribute('video-id'),playerClass:p?.className,video:v?{readyState:v.readyState,width:v.videoWidth,time:v.currentTime,paused:v.paused}:null,ambient:!!document.querySelector('#x-ambient-light')?.shadowRoot.querySelector('.light.visible')}");
   try{await driver.wait(async()=>!!(await inspect()).video?.width,20000);await on();await capture('live');results.push({test:'live public YouTube watch (logged out)',pass:true,...await inspect()});}catch(error){results.push({test:'live public YouTube watch (logged out)',pass:false,limitation:error.message,...await inspect()});}
  }
 }catch(error){results.push({error:error.stack});process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));if(driver)await driver.quit();await new Promise(r=>server.close(r));}console.log(JSON.stringify(results,null,2));
})();
