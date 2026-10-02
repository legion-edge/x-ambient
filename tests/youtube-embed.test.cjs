const {test}=require('node:test'),assert=require('node:assert/strict'),Y=require('../src/youtube.js'),Core=require('../src/ambient-core.js'),Streaming=require('../src/streaming.js'),manifest=require('../manifest.json');
const location={pathname:'/embed/aaaaaaaaaaa'};
function tree(state={}) {
  const video={readyState:4,videoWidth:1920,ended:false,...state.video};
  const player={hidden:state.hidden,getAttribute:()=>state.aria?'true':null,matches:()=>state.ad,querySelector:()=>state.noVideo?null:video};
  const title=state.noTitle?null:{getAttribute:()=>state.href||'/watch?v=aaaaaaaaaaa'};
  return {video,root:{querySelectorAll:()=>title?[title,...(state.extraTitles||[]).map(href=>({getAttribute:()=>href}))]:[],querySelector:()=>state.noPlayer?null:player,pictureInPictureElement:state.pip,fullscreenElement:state.fullscreen}};
}
test('embed injection is limited to approved www and privacy-enhanced embed paths without parent or fallback access',()=>{
  assert.deepEqual(manifest.permissions,['storage']);
  const entry=manifest.content_scripts[1];assert.deepEqual(entry.matches,['https://www.youtube.com/embed/*','https://www.youtube-nocookie.com/embed/*']);assert.equal(entry.all_frames,true);
  assert.deepEqual(manifest.content_scripts[0].exclude_matches,['https://www.youtube.com/embed/*']);assert.ok(!manifest.content_scripts[0].all_frames);
  assert.ok(!manifest.content_scripts[0].matches.some(x=>x.includes('nocookie')));
  for(const item of manifest.content_scripts){assert.ok(!item.match_about_blank);assert.ok(!item.match_origin_as_fallback);assert.ok(!item.matches.some(x=>x.includes('<all_urls>')));}
  assert.equal(Streaming.platformForHostname('www.youtube-nocookie.com'),'youtube');
  for(const host of ['youtube-nocookie.com','m.youtube-nocookie.com','www.youtube-nocookie.com.evil'])assert.notEqual(Streaming.platformForHostname(host),'youtube');
});
test('embed routes accept only one exact video ID',()=>{
  assert.equal(Y.embedId(location),'aaaaaaaaaaa');assert.equal(Y.routeId(location),'aaaaaaaaaaa');
  for(const pathname of ['/embed','/embed/videoseries','/embed/bad','/embed/aaaaaaaaaaa/more','/watch'])assert.equal(Y.embedId({pathname}),null);
});
test('embed selects ready main video only when public current title matches route',()=>{
  const t=tree();assert.equal(Y.findVideo(t.root,location),t.video);
  for(const state of [{href:'/watch?v=bbbbbbbbbbb'},{href:'https://evil.example/watch?v=aaaaaaaaaaa'},{href:'http://www.youtube.com/watch?v=aaaaaaaaaaa'},{noTitle:true},{extraTitles:['/watch?v=bbbbbbbbbbb']},{ad:true},{hidden:true},{aria:true},{noPlayer:true},{noVideo:true},{pip:{}},{fullscreen:{}},{video:{readyState:1}},{video:{videoWidth:0}},{video:{ended:true}}])assert.equal(Y.findVideo(tree(state).root,location),null,JSON.stringify(state));
  const paused=tree({video:{paused:true}});assert.equal(Y.findVideo(paused.root,location),paused.video);
});
test('background clip excludes overlapping media/UI as a union, clips out-of-view boxes and handles full coverage',()=>{
  const view={width:100,height:100},boxes=[{left:20,top:20,width:40,height:40},{left:40,top:40,width:40,height:40},{left:-10,top:90,width:120,height:20}];
  const clip=Core.buildBackgroundClip(boxes,view);
  const regions=[...clip.matchAll(/M([\d.]+) ([\d.]+)H([\d.]+)V([\d.]+)H[\d.]+Z/g)].map(m=>m.slice(1,5).map(Number));
  const includes=(x,y)=>regions.some(([left,top,right,bottom])=>x>left&&x<right&&y>top&&y<bottom);
  for(const [x,y] of [[10,10],[90,10],[10,85],[85,85]])assert.equal(includes(x,y),true);
  for(const [x,y] of [[30,30],[50,50],[70,70],[50,95]])assert.equal(includes(x,y),false);
  assert.equal(Core.buildBackgroundClip([{left:0,top:0,width:100,height:100}],view),'inset(100%)');
  // Subpixel movement across an integer edge must invalidate the cached clip.
  const clipAt=left=>Core.buildBackgroundClip([{left,top:20,width:40,height:40}],{width:300,height:100});
  assert.notEqual(clipAt(171.1),clipAt(170.8));
});
