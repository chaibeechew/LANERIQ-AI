"use client";

import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "../../lib/supabase/client";
import {FORGE_TYPES,buildGameIntelligenceForgePlan,compileForgeToGameIdea} from "../../lib/ai/game-intelligence-forge.js";

const EXAMPLES=[
  ["雷剑大招","Design a lightning sword ultimate with wuxia footwork, seven fast strikes, a thunder-dragon finish, brief stun and 20% damage-to-heal conversion."],
  ["凤凰补血","Create a phoenix rebirth healing ultimate: trigger at low HP, become untargetable briefly, restore health, cleanse debuffs and return with a temporary fire buff."],
  ["功夫反击","Create a kungfu counter technique with qi guard, perfect-parry timing, palm shockwave, knockback and a short defensive shield."],
  ["Boss 变身","Create a mythic transformation ultimate with a safe enter animation, temporary stat changes, new combo finishers, resource drain and a clear exit/recovery state."],
];

function newRequestId(){try{return`game-forge:${crypto.randomUUID()}`}catch{return`game-forge:${Date.now()}:${Math.random().toString(36).slice(2)}`}}
function safeError(value,fallback){return String(value||fallback||"Unable to continue.").slice(0,260)}

export default function GameIntelligenceForgePage(){
  const supabase=useMemo(()=>createClient(),[]);
  const[idea,setIdea]=useState(EXAMPLES[0][1]);
  const[type,setType]=useState("ultimate");
  const[mode,setMode]=useState("hybrid");
  const[powerScale,setPowerScale]=useState("heroic");
  const[targetCount,setTargetCount]=useState(5);
  const[avatarAssets,setAvatarAssets]=useState([]);
  const[previews,setPreviews]=useState({});
  const[selectedAvatar,setSelectedAvatar]=useState(null);
  const[loadingAssets,setLoadingAssets]=useState(true);
  const[building,setBuilding]=useState(false);
  const[notice,setNotice]=useState("");
  const requestIdRef=useRef("");

  useEffect(()=>{(async()=>{
    const{data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.assign("/auth?next=/game-forge");return;}
    const{data,error}=await supabase.from("asset_library").select("id,file_name,storage_path,mime_type,category,alt_text,created_at").eq("user_id",user.id).eq("category","image").order("created_at",{ascending:false}).limit(24);
    if(error){setNotice("Your private Avatar Library could not be loaded. You can still design the move without an avatar.");setLoadingAssets(false);return;}
    const images=data||[];setAvatarAssets(images);
    const signed={};
    for(const item of images){const{data:url}=await supabase.storage.from("user-assets").createSignedUrl(item.storage_path,600);if(url?.signedUrl)signed[item.id]=url.signedUrl;}
    setPreviews(signed);setLoadingAssets(false);
  })()},[supabase]);

  const plan=useMemo(()=>buildGameIntelligenceForgePlan({
    idea,type,mode,powerScale,targetCount,
    avatarAssetId:selectedAvatar?.id||"",
    avatarName:selectedAvatar?.alt_text||selectedAvatar?.file_name||"Customer Avatar",
  }),[idea,type,mode,powerScale,targetCount,selectedAvatar]);

  function changeIntent(value){setIdea(value);requestIdRef.current="";setNotice("");}

  async function buildInGame(){
    if(building||!idea.trim())return;
    setBuilding(true);setNotice("SoolenAI is binding the Forge specification to the existing AI Game creation pipeline…");
    const requestId=requestIdRef.current||newRequestId();requestIdRef.current=requestId;
    try{
      const gameIdea=compileForgeToGameIdea(plan);
      const response=await fetch("/api/game/generate",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify({idea:gameIdea,industry:"games",language:"en",requestId,gameForge:plan,assetIds:selectedAvatar?.id?[selectedAvatar.id]:[]})});
      const data=await response.json().catch(()=>({}));
      if(response.status===403){setNotice("AI Game creation requires Professional or Full Access. Your Forge design stays on this page; open pricing when you are ready.");return;}
      if(response.status===409){setNotice(data?.error||"This Forge-to-Game request is already running; LANERIQ will not start a duplicate.");return;}
      if(response.status===429){setNotice(data?.error||"Game creation is temporarily in Fair Use cooldown. Your Forge design and avatar remain unchanged.");return;}
      if(!response.ok||!data?.app?.id)throw new Error(data?.error||"Unable to create the game from this Forge specification.");
      window.location.assign(`/a/${data.app.id}`);
    }catch(error){requestIdRef.current="";setNotice(safeError(error?.message,"Unable to create the game from this Forge specification."));}
    finally{setBuilding(false);}
  }

  return <main className="forgePage"><div className="aurora"/><div className="wrap">
    <header><Link href="/game-builder">← AI Game</Link><div><span>LANERIQ AI</span><b>GAME INTELLIGENCE FORGE™</b></div><Link href="/avatar-studio">Create Avatar →</Link></header>

    <section className="hero"><small>INTENT-FIRST · AVATAR-BOUND · GAME-READY</small><h1>Design the move.<br/><em>Your Avatar casts it.</em></h1><p>Forge original treasures, weapons, items, physical attacks, magic, kungfu, defense, healing, summons, transformations and cinematic ultimates—then bind the specification to your own private Avatar and send it directly into AI Game.</p><div className="heroActions"><button onClick={buildInGame} disabled={building}>{building?"Building AI Game…":"Build This Into AI Game →"}</button><Link href="/avatar-studio">+ Make a New Avatar</Link></div></section>

    <section className="workspace">
      <div className="composer card"><div className="label">01 · DESCRIBE YOUR POWER</div><textarea value={idea} onChange={e=>changeIntent(e.target.value)} maxLength={1800} aria-label="Describe the game power you want"/><div className="examples">{EXAMPLES.map(([label,value])=><button type="button" onClick={()=>changeIntent(value)} key={label}>{label}</button>)}</div>
        <div className="label gap">TYPE</div><div className="typeGrid">{FORGE_TYPES.map(item=><button type="button" key={item.id} className={type===item.id?"active":""} onClick={()=>{setType(item.id);requestIdRef.current=""}}>{item.label}</button>)}</div>
        <div className="controls"><label>Mode<select value={mode} onChange={e=>setMode(e.target.value)}><option value="hybrid">PvE + PvP</option><option value="pve">PvE</option><option value="pvp">PvP</option></select></label><label>Power<select value={powerScale} onChange={e=>setPowerScale(e.target.value)}><option value="balanced">Balanced</option><option value="heroic">Heroic</option><option value="boss">Boss</option><option value="mythic">Mythic</option></select></label><label>Max targets<input type="number" min="1" max="20" value={targetCount} onChange={e=>setTargetCount(e.target.value)}/></label></div>
      </div>

      <aside className="preview card"><div className="label">LIVE FORGE SPEC</div><h2>{plan.name}</h2><div className="badges">{plan.types.map(item=><span key={item}>{item}</span>)}<span>{plan.element}</span><span>{plan.combat.powerScale}</span></div><div className="statGrid"><article><small>Damage budget</small><b>{plan.combat.damageBudgetMultiplier.toFixed(1)}×</b></article><article><small>Targets</small><b>{plan.combat.targetCount}</b></article><article><small>Cooldown</small><b>{plan.combat.cooldownSeconds}s</b></article><article><small>Energy</small><b>{plan.combat.energyCost}</b></article></div><div className="phases">{plan.phases.map((phase,index)=><article key={phase.id}><i>{index+1}</i><div><b>{phase.label}</b><small>{phase.durationMs} ms design target</small><p>{phase.rule}</p></div></article>)}</div>{plan.effects.length?<div className="effects">{plan.effects.map(item=><p key={item}>✦ {item}</p>)}</div>:null}</aside>
    </section>

    <section className="avatar card"><div className="avatarHead"><div><div className="label">02 · YOUR AVATAR = THE CASTER</div><h2>Choose a private Avatar Library image.</h2><p>The selected image remains owner-scoped. Forge passes its asset ID into the AI Game project as a private customer reference; it is not converted into a cross-user template.</p></div><Link href="/avatar-studio">Create Avatar</Link></div>
      {loadingAssets?<div className="empty">Loading your private images…</div>:avatarAssets.length?<div className="avatarRail"><button className={!selectedAvatar?"avatarChoice selected":"avatarChoice"} onClick={()=>setSelectedAvatar(null)}><div className="noAvatar">AI</div><b>Original caster</b><small>No private asset</small></button>{avatarAssets.map(item=><button key={item.id} className={selectedAvatar?.id===item.id?"avatarChoice selected":"avatarChoice"} onClick={()=>{setSelectedAvatar(item);requestIdRef.current=""}}>{previews[item.id]?<img src={previews[item.id]} alt={item.alt_text||item.file_name}/>:<div className="noAvatar">IMG</div>}<b>{item.alt_text||item.file_name}</b><small>{/avatar|character/i.test(`${item.alt_text||""} ${item.file_name||""}`)?"Avatar candidate":"Private image"}</small></button>)}</div>:<div className="empty">No private images yet. Create an Avatar first, or continue with an original fictional caster.</div>}
      <div className="binding"><b>{selectedAvatar?"Avatar bound":"Original caster mode"}</b><span>{plan.avatarBinding.identityRule}</span></div>
    </section>

    <section className="bento">
      <article className="card"><div className="label">03 · COMBAT INTELLIGENCE</div><h3>Damage · Healing · Defense</h3><p>Every burst, stun, heal, shield and invulnerability window receives tunable coefficients, counters, caps and mode-specific balance rules.</p></article>
      <article className="card"><div className="label">04 · MOTION + VFX</div><h3>Animation-ready choreography</h3><p>{plan.media.animationBrief}</p><Link href="/video-studio">Open AI Video →</Link></article>
      <article className="card"><div className="label">05 · VISUAL ASSETS</div><h3>Weapon · Treasure · Skill Icon</h3><p>{plan.media.iconBrief}</p><Link href="/image-studio?mode=create">Open AI Image →</Link></article>
      <article className="card"><div className="label">06 · EXPORT CONTRACT</div><h3>Game-engine portable</h3><p>{plan.exports.join(" · ")}</p></article>
    </section>

    <section className="send card"><div><div className="label">AI GAME INTEGRATION</div><h2>Avatar → Skill → Combat Data → AI Game</h2><p>LANERIQ compiles this Forge design into the existing mobile-game generation request. Actual animation, balance and runtime behavior remain evidence-gated until the generated project executes and is tested.</p></div><button onClick={buildInGame} disabled={building}>{building?"Building…":"Build Playable Game →"}</button></section>
    {notice&&<div className="notice" role="status">{notice}{notice.includes("Professional")?<Link href="/pricing"> Open pricing →</Link>:null}</div>}
  </div><style jsx>{`*{box-sizing:border-box}.forgePage{min-height:100vh;background:#020706;color:#effbf5;font-family:Inter,system-ui,-apple-system,sans-serif;padding:24px 18px 80px;position:relative;overflow:hidden}.aurora{position:fixed;inset:-25%;background:radial-gradient(circle at 78% 10%,#d8bf6230,transparent 28%),radial-gradient(circle at 15% 55%,#247c6740,transparent 35%),linear-gradient(160deg,#020706,#071711 58%,#03100c);pointer-events:none}.wrap{position:relative;z-index:1;max-width:1180px;margin:auto}header{display:flex;align-items:center;justify-content:space-between;gap:18px;font-size:11px}header>a{color:#d8bf62;text-decoration:none;border:1px solid #ffffff14;border-radius:999px;padding:10px 13px;min-height:44px;display:flex;align-items:center}header div{display:grid;text-align:center;gap:3px}header span{font-size:8px;letter-spacing:.2em;color:#7b9388}header b{letter-spacing:.12em}.hero{padding:78px 0 34px}.hero small,.label{color:#d8bf62;font-size:9px;font-weight:950;letter-spacing:.16em}.hero h1{font-size:clamp(50px,8vw,96px);line-height:.93;letter-spacing:-.055em;margin:12px 0 18px}.hero em{color:#d8bf62;font-style:normal}.hero p{max-width:930px;color:#a5b8af;line-height:1.65;font-size:17px}.heroActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:22px}.heroActions button,.send button{border:0;border-radius:14px;padding:14px 18px;background:#d8bf62;color:#07110d;font-weight:950;min-height:46px}.heroActions a{border:1px solid #ffffff18;border-radius:14px;padding:14px 18px;color:#fff;text-decoration:none;font-weight:850}.card{border:1px solid #ffffff12;background:#071712d9;border-radius:25px;backdrop-filter:blur(18px);box-shadow:0 30px 80px #0005}.workspace{display:grid;grid-template-columns:1.05fr .95fr;gap:12px}.composer,.preview{padding:22px}.composer textarea{width:100%;min-height:170px;margin-top:10px;background:#020a08;border:1px solid #ffffff18;border-radius:17px;padding:15px;color:#fff;font:700 15px/1.55 Inter,system-ui;resize:vertical}.examples,.typeGrid,.badges{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.examples button,.typeGrid button{border:1px solid #ffffff14;background:#0a2119;color:#9fb4aa;border-radius:999px;padding:9px 11px;font-size:10px}.typeGrid button.active{border-color:#d8bf6270;color:#d8bf62;background:#d8bf6210}.gap{margin-top:20px}.controls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.controls label{display:grid;gap:7px;color:#9fb4aa;font-size:10px}.controls select,.controls input{min-height:44px;border:1px solid #ffffff17;background:#06120e;color:#fff;border-radius:11px;padding:8px}.preview h2,.avatar h2,.send h2{font-size:32px;margin:9px 0}.badges span{font-size:9px;border:1px solid #d8bf6233;color:#d8bf62;border-radius:999px;padding:7px 9px}.statGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:15px 0}.statGrid article{padding:11px;border-radius:13px;background:#0b221a}.statGrid small{display:block;color:#789085;font-size:8px}.statGrid b{display:block;font-size:20px;margin-top:4px}.phases{display:grid;gap:8px}.phases article{display:flex;gap:10px;border-top:1px solid #ffffff0d;padding-top:9px}.phases i{font-style:normal;width:26px;height:26px;border-radius:50%;background:#d8bf62;color:#07110d;display:grid;place-items:center;font-size:9px;font-weight:950}.phases b,.phases small{display:block}.phases small{color:#789085;font-size:8px;margin-top:2px}.phases p,.effects p,.avatar p,.bento p,.send p{color:#8fa59a;line-height:1.5;font-size:11px}.avatar{padding:22px;margin-top:12px}.avatarHead{display:flex;justify-content:space-between;align-items:end;gap:16px}.avatarHead p{max-width:760px}.avatarHead a,.bento a{color:#d8bf62;text-decoration:none;font-weight:900;font-size:11px}.avatarRail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(145px,170px);gap:9px;overflow-x:auto;padding:8px 0 12px}.avatarChoice{border:1px solid #ffffff12;background:#0a2119;color:#fff;border-radius:17px;padding:8px;text-align:left;min-height:205px}.avatarChoice.selected{border-color:#d8bf62;box-shadow:0 0 0 2px #d8bf6218}.avatarChoice img,.noAvatar{width:100%;height:135px;object-fit:cover;border-radius:12px;background:#06110d}.noAvatar{display:grid;place-items:center;color:#d8bf62;font-weight:950;font-size:30px}.avatarChoice b,.avatarChoice small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.avatarChoice b{margin:8px 2px 3px;font-size:10px}.avatarChoice small{margin:0 2px;color:#80978c;font-size:8px}.binding{display:grid;gap:5px;border-top:1px solid #ffffff0d;padding-top:12px}.binding b{color:#d8bf62}.binding span{font-size:10px;color:#8fa59a;line-height:1.45}.empty{padding:30px;text-align:center;border:1px dashed #ffffff16;border-radius:15px;color:#80978c}.bento{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px}.bento article{padding:20px;min-height:170px}.bento h3{font-size:22px;margin:8px 0}.send{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px;margin-top:12px}.send p{max-width:780px}.send button{min-width:210px}.notice{margin-top:12px;border:1px solid #d8bf6230;background:#d8bf6209;color:#cbd9d2;border-radius:14px;padding:12px;font-size:11px}.notice a{color:#d8bf62}@media(max-width:850px){.workspace{grid-template-columns:1fr}.statGrid{grid-template-columns:repeat(2,1fr)}.bento{grid-template-columns:1fr}.send{align-items:stretch;flex-direction:column}.send button{width:100%}}@media(max-width:650px){.forgePage{padding:calc(18px + env(safe-area-inset-top,0px)) 12px calc(60px + env(safe-area-inset-bottom,0px))}.hero{padding-top:58px}.controls{grid-template-columns:1fr}.avatarHead{align-items:start;flex-direction:column}.heroActions>*{width:100%;text-align:center}.composer textarea,.controls select,.controls input{font-size:16px}header div{display:none}}`}</style></main>;
}
