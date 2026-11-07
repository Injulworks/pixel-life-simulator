// simulate.js: runs the reference game headless in node with a virtual clock (no browser, no throttling).
// Usage: node simulate.js pixel-life-sim.html natural        or        node simulate.js pixel-life-sim.html fit 30
// It stubs the canvas and DOM, drives frame() by hand at 60 fps of virtual time, and prints the elapsed virtual seconds and the score.
const fs=require("fs"); const html=fs.readFileSync(process.argv[2],"utf8");
const src=html.slice(html.indexOf("<script>")+8, html.lastIndexOf("</script>"));
let vnow=0; const ctx=new Proxy({}, {get:(t,k)=>k==="measureText"?()=>({width:10}):()=>{}, set:()=>true});
const el=()=>new Proxy({classList:{add(){},remove(){}},style:{},getContext:()=>ctx,addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:360,height:640}),setAttribute(){},value:"SUGGEST",captureStream(){}}, {get:(t,k)=>k in t?t[k]:undefined,set:(t,k,v)=>{t[k]=v;return true}});
const els={}; global.document={getElementById:(id)=>els[id]||(els[id]=el()),createElement:()=>el()};
global.window=global; global.performance={now:()=>vnow}; let rafCb=null; global.requestAnimationFrame=(f)=>{rafCb=f}; global.setTimeout=(f,ms)=>{pend.push([vnow+ms,f])}; global.clearTimeout=()=>{}; const pend=[];
global.alert=()=>{}; global.AudioContext=undefined; global.MediaRecorder=undefined; global.URL={createObjectURL(){}}; global.Blob=class{};
new Function(src+"; global.__PL = window.PixelLife; global.__frame = frame;")();
const PL=global.__PL; const mode=process.argv[3]||"fit";
if(mode==="fit"){PL.FIT.on=true; PL.FIT.total=+process.argv[4]||30;}
document.getElementById("sSpeed").value="2";
let done=false; PL.runDay().then(()=>{done=true});
(async()=>{
  while(!done && vnow<300000){ vnow+=16; for(let i=pend.length-1;i>=0;i--) if(pend[i][0]<=vnow){const f=pend.splice(i,1)[0][1]; f();} global.__frame(vnow); for(let k=0;k<8;k++) await Promise.resolve(); }
  const exp=PL.DAY.flatMap(e=>e.rewards).reduce((a,r)=>a+r.pts,0);
  console.log(JSON.stringify({mode, virtualSecs:(vnow/1000).toFixed(1), done, score:PL.S.score, expected:exp, caption:PL.S.caption}));
})();
