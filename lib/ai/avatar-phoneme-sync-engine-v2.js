function clean(value,max=32){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
const MAP=Object.freeze({AA:"aa",AE:"aa",AH:"aa",AO:"oh",AW:"oh",AY:"aa",B:"mbp",CH:"ch",D:"th",DH:"th",EH:"ee",ER:"rr",EY:"ee",F:"fv",G:"kg",HH:"sil",IH:"ih",IY:"ee",JH:"ch",K:"kg",L:"ln",M:"mbp",N:"ln",NG:"ln",OW:"oh",OY:"oh",P:"mbp",R:"rr",S:"sz",SH:"ch",T:"th",TH:"th",UH:"oo",UW:"oo",V:"fv",W:"oo",Y:"ee",Z:"sz",ZH:"ch",SIL:"sil",SP:"sil"});
export function phonemeToAvatarViseme(value){const raw=clean(value,24).toUpperCase().replace(/[0-9]/g,"");return MAP[raw]||"sil";}

export function buildAvatarCoarticulatedVisemeTimeline(phonemeMarks=[],{audioDurationMs=0,leadMs=35,releaseMs=55}={}){
  const duration=Math.max(1,Math.floor(Number(audioDurationMs)||1)),marks=(Array.isArray(phonemeMarks)?phonemeMarks:[]).slice(0,400).map(item=>({phoneme:clean(item?.phoneme,24),atMs:clamp(item?.atMs,0,duration),durationMs:clamp(item?.durationMs,0,duration),weight:clamp(item?.weight,.05,1)})).sort((a,b)=>a.atMs-b.atMs);const timeline=[];
  for(let i=0;i<marks.length;i++){const mark=marks[i],viseme=phonemeToAvatarViseme(mark.phoneme),next=marks[i+1],start=Math.max(0,mark.atMs-Math.max(0,leadMs)),naturalEnd=mark.atMs+Math.max(mark.durationMs,20)+Math.max(0,releaseMs),end=Math.min(duration,next?Math.min(naturalEnd,next.atMs+Math.max(0,leadMs)):naturalEnd);timeline.push({viseme,startMs:Math.round(start),peakMs:Math.round(mark.atMs),endMs:Math.round(Math.max(start,end)),weight:Number(mark.weight.toFixed(3)),sourcePhoneme:mark.phoneme});}
  return{contract:"laneriq-avatar-coarticulation-v2",audioDurationMs:duration,timeline,providerTimingRequired:true,estimatedTiming:false};
}

export function sampleAvatarVisemeAt(timelinePacket,{playbackMs=0,driftMs=0}={}){
  if(timelinePacket?.contract!=="laneriq-avatar-coarticulation-v2")return{viseme:"sil",weight:0};const t=Math.max(0,Number(playbackMs)||0)+clamp(driftMs,-180,180);let best={viseme:"sil",weight:0};for(const item of timelinePacket.timeline||[]){if(t<item.startMs||t>item.endMs)continue;const rise=Math.max(1,item.peakMs-item.startMs),fall=Math.max(1,item.endMs-item.peakMs),phase=t<=item.peakMs?(t-item.startMs)/rise:(item.endMs-t)/fall,weight=clamp(phase,0,1)*item.weight;if(weight>best.weight)best={viseme:item.viseme,weight:Number(weight.toFixed(3)),sourcePhoneme:item.sourcePhoneme};}return best;
}

export function buildAvatarProsodyEnvelope({audioDurationMs=0,emotion="neutral",speechRate=1,energy=.6}={}){
  const duration=Math.max(1,Math.floor(Number(audioDurationMs)||1)),e=clean(emotion,24).toLowerCase(),rate=clamp(speechRate,.6,1.6),base=clamp(energy,.1,1),emotionBoost=e==="excited"?.18:e==="concerned"?-.08:e==="warm"?.06:0;
  return{contract:"laneriq-avatar-prosody-envelope-v2",durationMs:duration,speechRate:rate,energy:clamp(base+emotionBoost,.05,1),breathSupport:e==="excited"?"high":e==="concerned"?"soft":"natural",pauseScale:rate>1.2?.8:rate<.85?1.2:1};
}

export function evaluateAvatarPhonemeSyncEvidence(samples=[]){const list=(Array.isArray(samples)?samples:[]).slice(0,100),verified=list.filter(x=>x?.providerAudioAligned===true&&x?.exactPhonemeTimingVerified===true),errors=list.map(x=>Math.abs(Number(x?.lipSyncErrorMs))).filter(Number.isFinite).sort((a,b)=>a-b),p95=errors.length?errors[Math.min(errors.length-1,Math.ceil(errors.length*.95)-1)]:null,reasons=[];if(verified.length<5)reasons.push("EXACT_PHONEME_VERIFIED_SAMPLES_LOW");if(p95==null||p95>80)reasons.push("PHONEME_LIP_SYNC_P95_HIGH");return{contract:"laneriq-avatar-phoneme-sync-evidence-v2",pass:reasons.length===0,reasons,metrics:{sampleCount:list.length,verifiedSamples:verified.length,lipSyncErrorP95Ms:p95},externalNeuralVoiceLive:false};}

export function getAvatarPhonemeSyncV2Readiness(){return{contract:"laneriq-avatar-phoneme-sync-v2",phonemeMapCode:true,coarticulationCode:true,prosodyEnvelopeCode:true,audioClockSamplingCode:true,evidenceGate:true,codeReady:true,exactExternalPhonemeTimingLive:false};}
