const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
const {Builder,By,Key}=require('selenium-webdriver');const firefox=require('selenium-webdriver/firefox');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/youtube-fullscreen-qa');fs.mkdirSync(out,{recursive:true});
const results=[];process.env.MOZ_HEADLESS_WIDTH='1280';process.env.MOZ_HEADLESS_HEIGHT='1024';
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
  await driver.manage().setTimeouts({pageLoad:30000,script:15000});
  const renderer=path.join(extension,'src/content.js');fs.writeFileSync(renderer,fs.readFileSync(renderer,'utf8').replace('  function paint(index) {','  function paint(index) { host.dataset.testPaintCount=String(Number(host.dataset.testPaintCount||0)+1);'));
  fs.appendFileSync(path.join(extension,'src/content.js'),"\ndocument.addEventListener('xa-test-settings',e=>chrome.storage.local.set({xAmbientSettings:JSON.parse(e.detail)}));\n");
  await driver.installAddon(extension,true);const base=`http://127.0.0.1:${server.address().port}`;
  const visible=()=>driver.executeScript("return !!document.querySelector('#x-ambient-light')?.shadowRoot.querySelector('.light.visible')");
  const on=async()=>driver.wait(()=>driver.executeScript("const h=document.querySelector('#x-ambient-light'),f=document.fullscreenElement;return !!h?.shadowRoot.querySelector('.light.visible')&&h.parentElement===(f||document.documentElement)&&h.dataset.presentation===(f?'fullscreen':'page')&&(!f||h.dataset.scope==='fullscreen')"),8000,'ambient should appear in current presentation');const off=async()=>driver.wait(async()=>!await visible(),8000,'ambient should stop');
  const main=()=>driver.findElement(By.css('#movie_player video.html5-main-video'));
  const native=()=>driver.executeScript("return getComputedStyle(document.querySelector('#cinematics')).visibility");
  const frame=()=>driver.executeScript("return [...document.querySelector('#x-ambient-light').shadowRoot.querySelectorAll('canvas')].map(c=>c.toDataURL()).join('')");
  const capture=async name=>{await driver.executeAsyncScript('const done=arguments[arguments.length-1];requestAnimationFrame(()=>requestAnimationFrame(done))');fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(await driver.takeScreenshot(),'base64'));};

  const full=()=>driver.executeScript('return !!document.fullscreenElement');
  const settings=async enabled=>driver.executeScript("document.dispatchEvent(new CustomEvent('xa-test-settings',{detail:JSON.stringify({enabled:arguments[0]})}))",enabled);
  const enter=async()=>{await driver.findElement(By.id('fullscreen')).click();await driver.wait(full,5000);};
  const exit=async()=>{await driver.findElement(By.id('fs-exit')).click();await driver.wait(async()=>!await full(),5000);await on();};
  const replace=async kind=>{
   await driver.executeScript("clearInterval(window.testAnimation);const v=document.querySelector('#movie_player video');v.pause();v.srcObject=null;if(arguments[0]==='portrait'){v.src='/demo/assets/portrait.webm';v.load();return;}if(arguments[0]==='wide'){const c=document.createElement('canvas');c.width=1000;c.height=400;const x=c.getContext('2d');let i=0;const draw=()=>{x.fillStyle='rgb('+((i++%80)+90)+',180,70)';x.fillRect(0,0,c.width,c.height);};draw();window.testAnimation=setInterval(draw,80);v.srcObject=c.captureStream(12);v.play();return;}const c=document.createElement('canvas');c.width=innerWidth;c.height=innerHeight;const x=c.getContext('2d');let i=0;const draw=()=>{x.fillStyle='rgb(80,110,'+(150+(i++%70))+')';x.fillRect(0,0,c.width,c.height)};draw();window.testAnimation=setInterval(draw,80);v.srcObject=c.captureStream(12);v.play()",kind);
   await driver.wait(()=>driver.executeScript("const v=document.querySelector('#movie_player video');return v.readyState>=2&&v.videoWidth>0"),5000);
  };
  await driver.get(base+'/watch?v=aaaaaaaaaaa');await on();await replace('portrait');await enter();await on();
  assert.equal(await driver.executeScript("return document.querySelector('#x-ambient-light').parentElement===document.fullscreenElement"),true);
  assert.equal(await driver.executeScript("return document.querySelector('#x-ambient-light').dataset.scope"),'fullscreen');
  assert.equal(await native(),'hidden');
  await driver.findElement(By.id('controls')).click();assert.equal(await driver.executeScript('return fixture.clicks'),1);
  await capture('pillarbox');
  // A paused source lets screenshot pixel equality prove that video/caption/control colors are untouched.
  await driver.executeScript("document.querySelector('#movie_player video').pause()");
  const sample=async()=>{
   const png=await driver.takeScreenshot();return driver.executeAsyncScript("const png=arguments[0],done=arguments[arguments.length-1],v=document.querySelector('#movie_player video'),c=document.querySelector('#caption'),b=document.querySelector('#controls'),box=v.getBoundingClientRect(),ratio=v.videoWidth/v.videoHeight,w=Math.min(box.width,box.height*ratio),h=w/ratio;const points=[[box.left+box.width/2,box.top+box.height/2],[c.getBoundingClientRect().left+3,c.getBoundingClientRect().top+3],[b.getBoundingClientRect().left+3,b.getBoundingClientRect().top+3]];const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const x=canvas.getContext('2d');x.drawImage(image,0,0);done(points.map(p=>[...x.getImageData(Math.round(p[0]*image.width/innerWidth),Math.round(p[1]*image.height/innerHeight),1,1).data]));};image.src='data:image/png;base64,'+png",png);
  };
  await driver.executeAsyncScript('const done=arguments[arguments.length-1];setTimeout(done,400)');const lit=await sample();
  await settings(false);await off();assert.equal(await native(),'visible');await driver.executeAsyncScript('const done=arguments[arguments.length-1];setTimeout(done,400)');const plain=await sample();assert.deepEqual(lit,plain,'video/caption/control pixels must be unchanged');await settings(true);await on();
  results.push({test:'fullscreen pillarbox top-layer mount, click-through, video/caption/control pixels unchanged, native ambient OFF restore',pass:true,pixels:lit});
  const before=await frame();await driver.executeScript("const v=document.querySelector('#movie_player video');v.currentTime=v.currentTime>1?0.2:1.2");await driver.wait(async()=>await frame()!==before,5000);results.push({test:'paused fullscreen seek repaints',pass:true});
  await replace('wide');await on();const wideFrame=await frame();await driver.wait(async()=>await frame()!==wideFrame,5000,'letterbox Canvas frames change');await capture('letterbox');results.push({test:'letterbox source and changing fullscreen Canvas',pass:true});
  await driver.executeScript("document.querySelector('#movie_player video').pause();clearInterval(window.testAnimation)");await driver.executeAsyncScript('const done=arguments[arguments.length-1];setTimeout(done,400)');const litCaption=await sample();await settings(false);await off();await driver.executeAsyncScript('const done=arguments[arguments.length-1];setTimeout(done,400)');assert.deepEqual(await sample(),litCaption,'letterbox caption in black bar and controls remain unchanged');await settings(true);await on();results.push({test:'caption in letterbox and control pixels remain unchanged',pass:true});
  await driver.executeScript("document.querySelector('#movie_player').classList.add('ad-showing')");await off();assert.equal(await native(),'visible');await driver.executeScript("document.querySelector('#movie_player').classList.remove('ad-showing')");await on();
  await driver.executeScript("fixture.go('/watch?v=bbbbbbbbbbb',null,false)");await off();await driver.executeScript("fixture.finish('bbbbbbbbbbb')");await on();results.push({test:'fullscreen ads and SPA stale ID stop/resume',pass:true});
  await replace('fill');await off();const paints=await driver.executeScript("return document.querySelector('#x-ambient-light').dataset.testPaintCount");const frozen=await frame();await driver.executeAsyncScript('const done=arguments[arguments.length-1];setTimeout(done,700)');assert.equal(await frame(),frozen);assert.equal(await driver.executeScript("return document.querySelector('#x-ambient-light').dataset.testPaintCount"),paints);assert.equal(await native(),'visible');assert.equal(await driver.executeScript("return document.querySelector('#x-ambient-light').dataset.mediaCount"),'0');results.push({test:'screen-filling aspect ratio avoids Canvas work and restores native ambient',pass:true});
  await replace('portrait');await on();await driver.actions().sendKeys(Key.ESCAPE).perform();await driver.wait(async()=>!await full(),5000,'Esc exits fullscreen');await on();assert.equal(await driver.executeScript("return document.querySelector('#x-ambient-light').parentElement===document.documentElement"),true);
  for(let i=0;i<4;i++){await driver.findElement(By.id('theater')).click();await enter();await on();await exit();}
  assert.equal(await driver.executeScript("return document.querySelectorAll('#x-ambient-light').length"),1);results.push({test:'Esc, fullscreen exit button, repeated normal/theater/fullscreen restore with one host',pass:true});
  if(process.argv.includes('--live')){
   await driver.manage().window().setRect({width:1100,height:950});
   await driver.get('https://www.youtube.com/watch?v=aqz-KE-bpKQ');await driver.wait(()=>driver.executeScript("return document.querySelector('#movie_player video')?.readyState>=2"),25000);await on();
   await driver.executeScript("const v=document.querySelector('#movie_player video');v.pause();v.currentTime=45");await driver.wait(()=>driver.executeScript("const v=document.querySelector('#movie_player video');return v.currentTime>=45&&!v.seeking"),10000);
   await driver.findElement(By.css('#movie_player .ytp-fullscreen-button')).click();await driver.wait(full,8000);await on();await capture('live-fullscreen');
   assert.equal(await driver.executeScript("return document.querySelector('#x-ambient-light').parentElement===document.fullscreenElement"),true);
   const live=await driver.executeScript("const v=document.querySelector('#movie_player video');return {url:location.href,time:v.currentTime,videoSize:[v.videoWidth,v.videoHeight],viewport:[innerWidth,innerHeight],scope:document.querySelector('#x-ambient-light').dataset.scope,fullscreenTag:document.fullscreenElement.tagName}");
   await driver.actions().sendKeys(Key.ESCAPE).perform();await driver.wait(async()=>!await full(),8000);await on();
   results.push({test:'live YouTube fullscreen button / black bars / seek frame / Esc',pass:true,...live});
   await driver.findElement(By.css('#movie_player .ytp-size-button')).click();await driver.findElement(By.id('movie_player')).sendKeys('f');await driver.wait(full,8000);await on();await driver.findElement(By.css('#movie_player .ytp-fullscreen-button')).click();await driver.wait(async()=>!await full(),8000);await on();
   results.push({test:'live public YouTube fullscreen black bars, seek frame, Esc, theater/fullscreen/button exit',pass:true,...live});
  }

 }catch(error){results.push({error:error.stack});if(driver){try{fs.writeFileSync(path.join(out,'failure.png'),Buffer.from(await driver.takeScreenshot(),'base64'));results.push({diagnostics:await driver.executeScript("return {url:location.href,fullscreen:!!document.fullscreenElement,viewport:[innerWidth,innerHeight],buttons:[...document.querySelectorAll('#movie_player .ytp-fullscreen-button')].map(b=>({box:JSON.stringify(b.getBoundingClientRect()),display:getComputedStyle(b).display,visibility:getComputedStyle(b).visibility}))}")});}catch{}}process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));if(driver)await driver.quit();await new Promise(r=>server.close(r));}console.log(JSON.stringify(results,null,2));
})();
