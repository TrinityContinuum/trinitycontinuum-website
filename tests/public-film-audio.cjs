// One-time and on-demand public embed media-track audit. No private tokens or videos are saved.
const { chromium } = require('@playwright/test');
const { spawnSync } = require('node:child_process');
const ids = [
  ['Film 01','4a280414b961425d12074fc7e20830cc'],
  ['Film 02','8feca7a3ab6dab53e7c475de4444b169'],
  ['Film 03','6256a17244fcf1f7ea5eb84b335dec47'],
  ['Film 04','73c9cdab30dc4e55f92fb2bc5b716711'],
];
async function videoDetails(frame) {
  return await frame.evaluate(async () => {
    const v = document.querySelector('video');
    if (!v) return {found:false, frameTitle:document.title, videoCount:0};
    v.muted=false;
    v.volume=1;
    let playError = '';
    try {
      await Promise.race([v.play(), new Promise((_,reject) => setTimeout(() => reject(Error('play timeout')), 8000))]);
    } catch (e) {playError=String(e.message || e);}
    await new Promise(resolve => setTimeout(resolve, 800));
    let audioTracks=null;
    try {
      if(typeof v.captureStream==='function') audioTracks=v.captureStream().getAudioTracks().length;
    } catch(e) {}
    return {found:true, src:v.currentSrc||v.src||'', readyState:v.readyState, paused:v.paused,
      muted:v.muted, volume:v.volume, audioTracks, playError};
  });
}
function probeRemoteAudio(src) {
  if(!/^https:\/\//i.test(src)) return {state:'not-http'};
  const p=spawnSync('ffprobe',['-v','error','-probesize','1500000','-analyzeduration','1500000',
    '-show_entries','stream=codec_type,codec_name,channels','-of','json',src],
    {encoding:'utf8',timeout:30000,maxBuffer:100000});
  if(p.status!==0) return {state:'probe-error',exit:p.status,timeout:!!p.error};
  let data={};
  try {data=JSON.parse(p.stdout)} catch {return {state:'invalid-probe-json'}}
  const audio=(data.streams||[]).filter(s=>s.codec_type==='audio');
  return {state:'success',audioStreams:audio.length,codecs:audio.map(s=>s.codec_name),channels:audio.map(s=>s.channels)};
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:1350,height:900}});
  let confirmed=0;
  try {
    const response=await page.goto('https://trinitycontinuum.com/film-presentations.html',
      {waitUntil:'domcontentloaded',timeout:45000});
    console.log('Production page HTTP:',response?.status());
    for(const [name,id] of ids) {
      const locator=page.locator('iframe[src*="'+id+'"]');
      if(await locator.count()!==1) {console.log(name,'FAIL: expected public iframe not found');continue;}
      await locator.scrollIntoViewIfNeeded({timeout:15000});
      let frame=null,details=null;
      for(let i=0;i<15;i++){
        const handle=await locator.elementHandle();
        frame=await handle.contentFrame();
        if(frame) {
          try{details=await frame.evaluate(()=>({n:document.querySelectorAll('video').length,ready:document.readyState,title:document.title}));}
          catch(e){}
          if(details?.n) break;
        }
        await page.waitForTimeout(1200);
      }
      if(!frame || !details?.n) {
        console.log(name,'UNVERIFIED: no HTML video element in public player; iframe URL and frame observed:',
          !!frame,details?.title||'');
        continue;
      }
      let media=null;try{media=await videoDetails(frame)}catch(e){console.log(name,'UNVERIFIED: media inspection failed:',e.message);continue;}
      const probe=probeRemoteAudio(media.src);
      const trackPresent=Number(media.audioTracks)>0 || probe.audioStreams>0;
      console.log(name,JSON.stringify({videoPresent:media.found,readyState:media.readyState,muted:media.muted,
        audioCaptureTracks:media.audioTracks,remoteProbe:probe,playError:media.playError,pass:trackPresent}));
      if(trackPresent)confirmed++;
    }
  } finally { await browser.close(); }
  console.log('Audio-stream evidence:',confirmed+'/'+ids.length+' embeds; stream presence does not verify intelligible speech or full duration.');
  if(confirmed!==ids.length)process.exitCode=1;
})().catch(e=>{console.error('Audio verification failed:',e.message);process.exitCode=1});
