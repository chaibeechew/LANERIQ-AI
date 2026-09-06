import Link from "next/link";

const base={textDecoration:"none",border:"1px solid #fff3",borderRadius:999,padding:"12px 16px",fontSize:11,fontWeight:950,letterSpacing:".04em",boxShadow:"0 12px 40px #0008",whiteSpace:"nowrap"};

export default function GameBuilderLayout({children}){
  return <>{children}<div style={{position:"fixed",right:18,bottom:"calc(18px + env(safe-area-inset-bottom))",zIndex:80,display:"grid",gap:8,justifyItems:"end",maxHeight:"calc(100vh - 36px)",overflowY:"auto",paddingLeft:8}}>
    <Link href="/game-world-v28" aria-label="Open LANERIQ AI Evidence Orchestrator V28" style={{...base,background:"linear-gradient(90deg,#f5ff92,#7fffd8,#8bbcff)",color:"#03100c",fontSize:12}}>Evidence Orchestrator V28 →</Link>
    <Link href="/game-world-v25" aria-label="Open LANERIQ AI Production Evidence V25" style={{...base,background:"linear-gradient(90deg,#d8ff72,#7fffd8,#8bc8ff)",color:"#03100c",fontSize:12}}>Production Evidence V25 →</Link>
    <Link href="/game-world-v20" aria-label="Open LANERIQ AI Production World V20" style={{...base,background:"linear-gradient(90deg,#7fffd8,#8bc8ff,#d7a8ff)",color:"#03100c",fontSize:12}}>Production World V20 →</Link>
    <Link href="/game-world-v13" aria-label="Open LANERIQ AI World Engine V13 Production Closure" style={{...base,background:"linear-gradient(90deg,#ffe98a,#9ee6cd,#9bc7ff)",color:"#04110d",fontSize:12}}>World Engine V13 →</Link>
    <Link href="/game-world-v7" aria-label="Open LANERIQ AI WASM and Device Evidence V7" style={{...base,background:"linear-gradient(90deg,#d9f7a8,#8fd9ff)",color:"#04110d",fontSize:12}}>WASM + Device V7 →</Link>
    <Link href="/game-world-v6" aria-label="Open LANERIQ AI Real Runtime Mobile V6" style={{...base,background:"linear-gradient(90deg,#8ff0d2,#a9c4ff)",color:"#03100c",fontSize:12}}>Real Runtime V6 →</Link>
    <Link href="/game-world-playable" aria-label="Open LANERIQ AI Playable World Runtime V5" style={{...base,background:"linear-gradient(90deg,#96f0dc,#7cc8ff)",color:"#04110d",fontSize:12}}>Playable World V5 →</Link>
    <Link href="/game-world-v4" aria-label="Open LANERIQ AI Neural Reconstruction and Embodied Simulation V4" style={{...base,background:"linear-gradient(90deg,#77ead5,#ead36f)",color:"#04110d",fontSize:12}}>Neural World V4 →</Link>
    <Link href="/game-world-v3" aria-label="Open LANERIQ AI Spatial Intelligence Hybrid 3D V3" style={{...base,background:"linear-gradient(90deg,#91e8ff,#bea1ff)",color:"#06101b",fontSize:12}}>Spatial Intelligence V3 →</Link>
    <Link href="/game-world-v2" aria-label="Open LANERIQ AI World Model V2" style={{...base,background:"#9ee6cd",color:"#07110d",fontSize:12}}>World Model V2 →</Link>
    <Link href="/game-world-simulation" aria-label="Open LANERIQ AI Game World Simulation Intelligence" style={{...base,background:"#d9c56e",color:"#07110d"}}>World Simulation Intelligence →</Link>
    <Link href="/game-world" aria-label="Open LANERIQ AI Game World Generator" style={{...base,background:"#f0d978",color:"#07110d"}}>Game World Generator →</Link>
    <Link href="/game-e2e-lab" aria-label="Open Real Game End-to-End Lab" style={{...base,background:"#fff3b0",color:"#07110d"}}>Real Game E2E Lab →</Link>
    <Link href="/game-creation-studio" aria-label="Open Complete Game Studio" style={{...base,background:"#e7cd70",color:"#07110d"}}>Complete Game Studio →</Link>
    <Link href="/game-autonomy-v4-lab" aria-label="Open Autonomous Game Development Agent V4 Lab" style={{...base,background:"#5a4a1f",color:"#fff8c7"}}>Development Agent V4 →</Link>
    <Link href="/game-development-lab" aria-label="Open Autonomous Game Development Agent V3 Lab" style={{...base,background:"#493f20",color:"#fff5b8"}}>Development Agent V3 →</Link>
    <Link href="/game-autonomy-lab" aria-label="Open Autonomous Game Director V2 Lab" style={{...base,background:"#3a3a24",color:"#fff0a8"}}>Autonomous Director V2 →</Link>
    <Link href="/game-studio-lab" aria-label="Open Game Studio Intelligence Lab" style={{...base,background:"#2b3828",color:"#ffe49a"}}>Studio Intelligence Lab →</Link>
    <Link href="/game-content-lab" aria-label="Open Game Content Production Lab" style={{...base,background:"#21352a",color:"#f3db89"}}>Game Content Lab →</Link>
    <Link href="/game-engine-lab" aria-label="Open AAA Mobile Game Lab" style={{...base,background:"#173227",color:"#f1d477"}}>AAA Mobile Lab →</Link>
    <Link href="/game-3d-lab" aria-label="Open Advanced 3D Game Lab" style={{...base,background:"#0a2119",color:"#e2c566"}}>Advanced 3D Lab →</Link>
    <Link href="/game-platform-lab" aria-label="Open Game Platform Lab" style={{...base,background:"#e2c566",color:"#07110d"}}>Game Platform Lab →</Link>
  </div></>;
}
