const {test}=require('node:test'),assert=require('node:assert/strict'),YouTube=require('../src/youtube.js');

test('Shorts empty structural wrappers are not holes; wrapped text, graphics and local painted UI remain protected',()=>{
  const text={textContent:'Two wrapped lines',parentElement:null};
  const label={closest:()=>null};text.parentElement=label;
  const icon={matches:()=>false,childElementCount:0};
  const badge={matches:()=>false,childElementCount:0};
  const button={matches:()=>false};
  const wrapper={matches:()=>true,querySelectorAll:selector=>selector==='*'?[icon,badge]:[icon]};
  const card={matches:()=>false,querySelectorAll:()=>[]};
  const neighbor={matches:()=>false,querySelectorAll:()=>[]};
  const offscreen={matches:()=>false,querySelectorAll:()=>{throw Error('offscreen layout measured')}};
  for(const element of [wrapper,card,neighbor,offscreen]){element.closest=()=>null;element.getBoundingClientRect=()=>({left:0,top:element===offscreen?2000:0,right:100,bottom:element===offscreen?2100:100,width:100,height:100});}
  let selected;
  const doc={defaultView:{innerWidth:1000,innerHeight:800,getComputedStyle:(element,pseudo)=>pseudo?{content:element===badge?'"LIVE"':'none'}:
    {display:'block',visibility:'visible',opacity:'1',backgroundColor:'rgba(0, 0, 0, 0)',backgroundImage:[card,neighbor].includes(element)?'linear-gradient(red,blue)':'none'}},
    createTreeWalker:()=>{let done=false;return{nextNode:()=>done?null:(done=true,text)}},
    createRange:()=>({selectNodeContents:node=>selected=node,getClientRects:()=>selected===text?[{left:20,top:30,right:80,bottom:45,width:60,height:15},{left:20,top:50,right:50,bottom:65,width:30,height:15}]:[]})};
  const root={querySelectorAll:selector=>selector===YouTube.SHORTS_LAYOUT_SELECTOR?[wrapper,card,neighbor,offscreen]:[wrapper,button]},reel={ownerDocument:doc,querySelectorAll:()=>[wrapper,card]};
  const result=YouTube.shortsProtection(root,reel);
  assert.ok(!result.elements.includes(wrapper));assert.ok(result.elements.includes(button));assert.ok(result.elements.includes(icon));assert.ok(result.elements.includes(badge));assert.ok(result.elements.includes(card));
  assert.ok(result.elements.includes(neighbor));assert.ok(!result.elements.includes(offscreen));
  assert.deepEqual(result.textRects.map(x=>x.rect),[{left:17,top:27,right:83,bottom:48,width:66,height:21},{left:17,top:47,right:53,bottom:68,width:36,height:21}]);
});

test('Shorts layout changes stay observable without restoring whole-wrapper masks',()=>{
  assert.ok(!YouTube.SHORTS_PROTECTED_SELECTOR.includes('#overlay'));
  assert.ok(!YouTube.SHORTS_PROTECTED_SELECTOR.includes('yt-reel-player-overlay-view-model'));
  for(const name of ['#overlay','yt-reel-player-overlay-view-model','#metadata','#actions'])assert.ok(YouTube.SHORTS_OBSERVED_SELECTOR.includes(name));
  for(const name of ['video','.caption-window','button','[role=dialog]','ytd-engagement-panel-section-list-renderer'])assert.ok(YouTube.SHORTS_PROTECTED_SELECTOR.includes(name));
});
