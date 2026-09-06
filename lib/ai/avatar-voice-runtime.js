import {normalizeVisemeTimeline} from "./avatar-runtime-engine.js";

function clamp(value,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function clean(value,max=120){return String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);}

export function createAvatarVoiceStream({sessionId,language="en",style="natural",jitterBufferMs=80,maxQueuedMs=30000}={}){
  const id=clean(sessionId,120);
  if(!id)throw new Error("VOICE_SESSION_ID_REQUIRED");
  return{
    sessionId:id,
    language:clean(language,24)||"en",
    style:clean(style,40)||"natural",
    jitterBufferMs:Math.round(clamp(jitterBufferMs,20,500)),
    maxQueuedMs:Math.round(clamp(maxQueuedMs,1000,60000)),
    chunks:[],
    seenChunkIds:[],
    finalReceived:false,
    interrupted:false,
    interruptedAtMs:null,
    sequence:0,
    lastAcceptedEndMs:0
  };
}

export function appendAvatarVoiceChunk(stream,{chunkId,startMs,durationMs,visemes=[],final=false}={}){
  if(!stream?.sessionId)throw new Error("VOICE_STREAM_REQUIRED");
  if(stream.interrupted)return{...stream,rejectedChunkId:clean(chunkId,120)||null};
  const id=clean(chunkId,120);
  if(!id)throw new Error("VOICE_CHUNK_ID_REQUIRED");
  if(stream.seenChunkIds?.includes(id))return{...stream,replayedChunkId:id};
  const start=Math.max(0,Math.round(Number(startMs)||0));
  const duration=Math.round(clamp(durationMs,1,15000));
  const absoluteVisemes=normalizeVisemeTimeline(visemes,{durationMs:duration,maxEntries:240}).map(item=>({...item,atMs:start+item.atMs}));
  const chunk={id,startMs:start,durationMs:duration,endMs:start+duration,visemes:absoluteVisemes,final:Boolean(final)};
  const chunks=[...(stream.chunks||[]),chunk].sort((a,b)=>a.startMs-b.startMs||a.id.localeCompare(b.id));
  const newestEnd=Math.max(stream.lastAcceptedEndMs||0,...chunks.map(item=>item.endMs));
  const floor=Math.max(0,newestEnd-(stream.maxQueuedMs||30000));
  const bounded=chunks.filter(item=>item.endMs>=floor).slice(-128);
  const seen=[...(stream.seenChunkIds||[]),id].slice(-256);
  return{
    ...stream,
    chunks:bounded,
    seenChunkIds:seen,
    finalReceived:Boolean(stream.finalReceived||final),
    sequence:(stream.sequence||0)+1,
    lastAcceptedEndMs:newestEnd,
    rejectedChunkId:null,
    replayedChunkId:null
  };
}

export function interruptAvatarVoice(stream,{atMs=0,reason="barge-in"}={}){
  if(!stream?.sessionId)throw new Error("VOICE_STREAM_REQUIRED");
  return{
    ...stream,
    interrupted:true,
    interruptedAtMs:Math.max(0,Math.round(Number(atMs)||0)),
    interruptReason:clean(reason,80)||"barge-in",
    sequence:(stream.sequence||0)+1
  };
}

function activeChunkAt(chunks,time){return(chunks||[]).find(item=>time>=item.startMs&&time<item.endMs)||null;}
function activeVisemeAt(visemes,time){
  if(!visemes?.length)return{viseme:"sil",weight:0};
  let active=visemes[0];
  for(const item of visemes){if(item.atMs<=time)active=item;else break;}
  const next=visemes.find(item=>item.atMs>time);
  if(!next)return{viseme:active.viseme,weight:active.weight};
  const span=Math.max(1,next.atMs-active.atMs);
  const progress=clamp((time-active.atMs)/span,0,1);
  const eased=progress*progress*(3-2*progress);
  return{viseme:active.viseme,weight:clamp(active.weight*(1-eased)+next.weight*eased*.3,0,1)};
}

export function getAvatarVoicePlaybackFrame(stream,{playbackMs=0}={}){
  if(!stream?.sessionId)throw new Error("VOICE_STREAM_REQUIRED");
  const time=Math.max(0,Number(playbackMs)||0);
  if(stream.interrupted&&time>=Number(stream.interruptedAtMs||0))return{sessionId:stream.sessionId,speaking:false,finished:true,interrupted:true,viseme:"sil",visemeWeight:0,playbackMs:time};
  const chunk=activeChunkAt(stream.chunks,time);
  if(!chunk){
    const finished=Boolean(stream.finalReceived&&time>=Number(stream.lastAcceptedEndMs||0));
    return{sessionId:stream.sessionId,speaking:false,finished,interrupted:false,buffering:!finished&&time<Number(stream.lastAcceptedEndMs||0),viseme:"sil",visemeWeight:0,playbackMs:time};
  }
  const mouth=activeVisemeAt(chunk.visemes,time);
  return{
    sessionId:stream.sessionId,
    chunkId:chunk.id,
    speaking:true,
    finished:false,
    interrupted:false,
    buffering:false,
    viseme:mouth.viseme,
    visemeWeight:mouth.weight,
    playbackMs:time,
    jitterBufferMs:stream.jitterBufferMs
  };
}

export function buildAvatarVoiceProviderRequest(manifest,{text,requestId}={}){
  const value=clean(text,4000);
  const id=clean(requestId,160);
  if(!manifest?.characterId)throw new Error("LIVING_CHARACTER_MANIFEST_REQUIRED");
  if(!value)throw new Error("VOICE_TEXT_REQUIRED");
  if(!id)throw new Error("VOICE_REQUEST_ID_REQUIRED");
  return{
    contract:"tts-stream-v1",
    requestId:id,
    characterId:manifest.characterId,
    text:value,
    language:manifest?.interfaces?.voice?.language||manifest?.dna?.language||"en",
    style:manifest?.interfaces?.voice?.style||manifest?.dna?.voice?.style||"natural",
    wantVisemeTimeline:true,
    providerRouted:true,
    providerIdentityExposed:false
  };
}
