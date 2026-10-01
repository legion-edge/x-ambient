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

test('fullscreen is limited to player-containing top layer and visible black bars',()=>{
 const player={},video={closest:()=>player};
 const full={tagName:'DIV',contains:x=>x===player};
 assert.equal(YouTube.fullscreenContainer({fullscreenElement:full},video),full);
 assert.equal(YouTube.fullscreenContainer({fullscreenElement:{tagName:'VIDEO',contains:()=>true}},video),null);
 assert.equal(YouTube.fullscreenContainer({fullscreenElement:{tagName:'DIV',contains:()=>false}},video),null);
 const view={width:1920,height:1080};
 assert.equal(YouTube.hasFullscreenSpace({left:0,top:0,right:1920,bottom:1080},view),false);
 assert.equal(YouTube.hasFullscreenSpace({left:1,top:2,right:1919,bottom:1078},view),false);
 assert.equal(YouTube.hasFullscreenSpace({left:0,top:140,right:1920,bottom:940},view),true);
 assert.equal(YouTube.hasFullscreenSpace({left:560,top:0,right:1360,bottom:1080},view),true);
});
