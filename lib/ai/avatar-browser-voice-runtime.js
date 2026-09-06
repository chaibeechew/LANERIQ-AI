const VOWEL_TO_VISEME=Object.freeze({a:"aa",e:"ee",i:"ih",o:"oh",u:"ou"});
function clean(value,max=4000){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}
function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}

export function browserAvatarVoiceCapabilities(){
  const supported=typeof window!=="undefined"&&"speechSynthesis" in window&&typeof SpeechSynthesisUtterance!=="undefined";
  return{contract:"laneriq-browser-avatar-voice-v1",supported,liveBrowserTTS:supported,providerNeutral:true,exactPhonemeTiming:false,boundaryEventsBestEffort:true,externalLiveVoiceProvider:false};
}

export function estimateAvatarVisemeTimeline(text,{durationMs=null,wordsPerMinute=155}={}){
  const input=clean(text,4000);if(!input)return[];const chars=[...input].filter(ch=>/[A-Za-z]/.test(ch)),estimated=Math.max(320,Number(durationMs)||Math.round((input.split(/\s+/).filter(Boolean).length/Math.max(80,wordsPerMinute))*60000));if(!chars.length)return[{atMs:0,viseme:"sil",weight:0},{atMs:estimated,viseme:"sil",weight:0}];
  const step=estimated/Math.max(1,chars.length),timeline=[];let last="sil";
  chars.forEach((ch,index)=>{const lower=ch.toLowerCase(),viseme=VOWEL_TO_VISEME[lower]||(/[bmp]/.test(lower)?"mbp":/[fv]/.test(lower)?"fv":/[tdnlsz]/.test(lower)?"etc":"sil");if(viseme!==last||index===0){timeline.push({atMs:Math.round(index*step),viseme,weight:viseme==="sil" ? .25 : .72});last=viseme;}});timeline.push({atMs:estimated,viseme:"sil",weight:0});return timeline.slice(0,240);
}

export function createBrowserAvatarVoiceSession({sessionId,language="en-US",rate=1,pitch=1,volume=1}={}){
  const id=clean(sessionId,120);if(!id)throw new Error("AVATAR_BROWSER_VOICE_SESSION_REQUIRED");return{contract:"laneriq-browser-avatar-voice-v1",sessionId:id,language:clean(language,24)||"en-US",rate:clamp(rate,.5,2),pitch:clamp(pitch,.5,2),volume:clamp(volume,0,1),speaking:false,startedAtMs:0,endedAtMs:0,utteranceId:0,interrupted:false};
}

export function speakBrowserAvatarVoice(session,{text,voiceName="",onStart,onBoundary,onEnd,onError}={}){
  if(session?.contract!=="laneriq-browser-avatar-voice-v1")throw new Error("AVATAR_BROWSER_VOICE_SESSION_REQUIRED");const capabilities=browserAvatarVoiceCapabilities();if(!capabilities.supported)throw new Error("AVATAR_BROWSER_TTS_UNAVAILABLE");const value=clean(text,4000);if(!value)throw new Error("AVATAR_BROWSER_TTS_TEXT_REQUIRED");
  const utterance=new SpeechSynthesisUtterance(value);utterance.lang=session.language;utterance.rate=session.rate;utterance.pitch=session.pitch;utterance.volume=session.volume;const requested=clean(voiceName,120);if(requested){const voice=window.speechSynthesis.getVoices().find(v=>v.name===requested);if(voice)utterance.voice=voice;}
  const timeline=estimateAvatarVisemeTimeline(value);utterance.onstart=event=>onStart?.({event,timeline});utterance.onboundary=event=>onBoundary?.({event,charIndex:event.charIndex||0,elapsedTime:event.elapsedTime||0});utterance.onend=event=>onEnd?.({event});utterance.onerror=event=>onError?.({event,error:event.error||"speech-synthesis-error"});window.speechSynthesis.speak(utterance);return{utterance,timeline,session:{...session,speaking:true,startedAtMs:Date.now(),utteranceId:(session.utteranceId||0)+1,interrupted:false}};
}

export function interruptBrowserAvatarVoice(session){
  if(typeof window!=="undefined"&&window.speechSynthesis)window.speechSynthesis.cancel();return{...session,speaking:false,endedAtMs:Date.now(),interrupted:true};
}
