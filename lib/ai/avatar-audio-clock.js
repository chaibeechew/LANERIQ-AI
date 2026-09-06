function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function clean(value,max=120){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}

export function createAvatarAudioClock({sessionId,nowMs=0,playbackMs=0}={}){
  const id=clean(sessionId,120);if(!id)throw new Error("AVATAR_AUDIO_SESSION_REQUIRED");
  const now=Math.max(0,Number(nowMs)||0),playback=Math.max(0,Number(playbackMs)||0);
  return{contract:"laneriq-avatar-audio-clock-v1",sessionId:id,originNowMs:now,originPlaybackMs:playback,playbackMs:playback,rate:1,driftMs:0,jitterMs:0,resyncCount:0,lastNowMs:now,lastReportedPlaybackMs:playback,paused:false};
}

export function advanceAvatarAudioClock(clock,{nowMs,reportedPlaybackMs,paused=false,buffering=false,maxSoftDriftMs=40,maxHardDriftMs=120}={}){
  if(!clock?.sessionId)throw new Error("AVATAR_AUDIO_CLOCK_REQUIRED");
  const previousNow=Number.isFinite(Number(clock.lastNowMs))?Number(clock.lastNowMs):Number(nowMs)||0;
  const now=Math.max(previousNow,Number(nowMs)||0),dt=Math.max(0,now-previousNow);
  const predicted=clock.paused?clock.playbackMs:clock.playbackMs+dt*(clock.rate||1);
  const hasReported=Number.isFinite(Number(reportedPlaybackMs));
  const reported=hasReported?Math.max(0,Number(reportedPlaybackMs)):predicted;
  const drift=reported-predicted;
  const abs=Math.abs(drift),soft=Math.max(20,Number(maxSoftDriftMs)||40),hard=Math.max(soft,Number(maxHardDriftMs)||120);
  let playback=predicted,rate=1,resyncCount=clock.resyncCount||0;
  if(hasReported&&abs>=hard){playback=reported;resyncCount+=1;}
  else if(hasReported&&abs>=soft&&!buffering){rate=clamp(1+drift/800,0.90,1.10);playback=predicted+drift*.2;}
  else if(hasReported){playback=predicted+drift*.35;}
  if(paused||buffering){rate=0;playback=hasReported?reported:clock.playbackMs;}
  const previousReported=Number.isFinite(Number(clock.lastReportedPlaybackMs))?Number(clock.lastReportedPlaybackMs):0;
  const sampleJitter=hasReported?Math.abs(reported-previousReported-dt):0;
  const jitter=(clock.jitterMs||0)*.75+sampleJitter*.25;
  return{...clock,playbackMs:Math.max(0,playback),rate,driftMs:drift,jitterMs:jitter,resyncCount,lastNowMs:now,lastReportedPlaybackMs:reported,paused:Boolean(paused||buffering)};
}

export function getAvatarAudioClockFrame(clock){
  if(!clock?.sessionId)throw new Error("AVATAR_AUDIO_CLOCK_REQUIRED");
  return{contract:clock.contract,sessionId:clock.sessionId,playbackMs:Math.max(0,Math.round(clock.playbackMs||0)),rate:clock.rate||0,driftMs:Math.round(clock.driftMs||0),jitterMs:Math.round(clock.jitterMs||0),resyncCount:clock.resyncCount||0,stable:Math.abs(clock.driftMs||0)<80&&(clock.jitterMs||0)<80,competitiveLipSyncTargetMs:80,paused:Boolean(clock.paused)};
}

export function shouldHardResyncAvatarAudio(clock,{driftLimitMs=120,jitterLimitMs=120}={}){
  return Math.abs(Number(clock?.driftMs)||0)>=Math.max(60,Number(driftLimitMs)||120)||(Number(clock?.jitterMs)||0)>=Math.max(60,Number(jitterLimitMs)||120);
}
