const {test}=require('node:test');
const assert=require('node:assert/strict');
const YouTube=require('../src/youtube.js');
const Streaming=require('../src/streaming.js');
const manifest=require('../manifest.json');
const location={pathname:'/watch',search:'?v=aaaaaaaaaaa'};
function tree(overrides={}) {
  const video={ended:false,readyState:2,videoWidth:1920,...overrides.video};
  const player={matches:()=>!!overrides.ad,querySelector:()=>overrides.noVideo?null:video};
  const watch={getAttribute:()=>overrides.id||'aaaaaaaaaaa',hasAttribute:()=>!!overrides.mini,querySelector:()=>overrides.noPlayer?null:player};
  return {video,root:{querySelector:()=>overrides.hidden?null:watch,fullscreenElement:overrides.fullscreen,pictureInPictureElement:overrides.pip}};
}
test('YouTube is limited to www host and watch video IDs; no extra API permissions',()=>{
 assert.equal(Streaming.platformForHostname('www.youtube.com'),'youtube');
 for(const host of ['youtube.com','m.youtube.com','www.youtube.com.evil','youtu.be'])assert.notEqual(Streaming.platformForHostname(host),'youtube');
 assert.equal(YouTube.watchId(location),'aaaaaaaaaaa');
 for(const loc of [{pathname:'/',search:'?v=aaaaaaaaaaa'},{pathname:'/shorts/aaaaaaaaaaa',search:''},{pathname:'/embed/aaaaaaaaaaa',search:''},{pathname:'/watch',search:'?v=bad'},{pathname:'/watch',search:''}])assert.equal(YouTube.watchId(loc),null);
 assert.deepEqual(manifest.permissions,['storage']);
 assert.ok(manifest.content_scripts[0].matches.includes('https://www.youtube.com/*'));
 assert.ok(manifest.content_scripts[0].js.indexOf('src/youtube.js')<manifest.content_scripts[0].js.indexOf('src/content.js'));
});
test('only ready main watch video is selected, including paused frames',()=>{
 const t=tree({video:{paused:true}});assert.equal(YouTube.findVideo(t.root,location),t.video);
 for(const state of [{ad:true},{mini:true},{hidden:true},{id:'bbbbbbbbbbb'},{fullscreen:{}},{pip:{}},{noPlayer:true},{noVideo:true},{video:{readyState:1}},{video:{videoWidth:0}},{video:{ended:true}}])assert.equal(YouTube.findVideo(tree(state).root,location),null,JSON.stringify(state));
 assert.equal(YouTube.findVideo(tree().root,{pathname:'/',search:''}),null);
});
