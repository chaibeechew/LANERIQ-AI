"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {PRODUCT_BRAND} from "../../lib/product-brand.js";

const CREATIVE=[
  {href:"/ai-map",title:"AI Map / World Builder",note:"World · terrain · mission zones"},
  {href:"/avatar-studio",title:"Avatar Studio",note:"Playable · NPC · boss · companion"},
  {href:"/game-builder",title:"Pro Game Creator",note:"Professional playable-game runtime"},
  {href:"/super-game-builder",title:"Super Game Builder",note:"World + Avatar + Scene Assets + Combat Forge"},
  {href:"/image-studio?mode=create",title:"AI Art Generator",note:"Characters · environments · props"},
  {href:"/video-studio",title:"AI Video Generator",note:"Trailers · animation concepts"},
  {href:"/super-game-builder#forge",title:"Game Intelligence Forge",note:"Weapon · skill · ultimate · balance"},
  {href:"/asset-library",title:"Asset Library",note:"Reuse private creative assets"}
];

export default function CreationCapabilityBanner(){
  const pathname=usePathname();
  if(pathname!=="/"&&pathname!=="/create"&&pathname!=="/create/")return null;
  return <section className="creationExpansion" aria-label={`${PRODUCT_BRAND.name} creation capabilities`}>
    <div className="inner">
      <div className="headline"><div><small>SUPER CREATOR STACK</small><h2>{pathname.startsWith("/create")?"Create App · Web · Image · Video · Game · World":PRODUCT_BRAND.productLine}</h2></div><div className="platforms"><span>APP</span><span>WEB</span><span>GAME · PRO</span><span>WORLD</span></div></div>
      <p className="platformNote">Idea → World → Character → Scene Assets → Combat → Merge → Playable Game. The App + Website builder keeps its existing generation contract; Game remains Pro-gated and World uses its dedicated safe route.</p>
      <div className="creativeGrid">{CREATIVE.map(item=><Link href={item.href} key={item.title}><span><strong>{item.title}</strong><small>{item.note}</small></span><em>Open ›</em></Link>)}</div>
      <div className="gameCallout"><span><strong>Pro Game Creator · Super Game Stack</strong><small>AI Map + Avatar + private scene assets + Game Intelligence Forge + existing Professional Game Creator.</small></span><Link href="/super-game-builder">Become Pro · Build Super Game ›</Link></div>
    </div>
    <style jsx>{`.creationExpansion{position:relative;z-index:20;background:#020816;color:#eef7ff;padding:16px 14px 90px;font-family:Inter,system-ui,-apple-system,sans-serif}.inner{max-width:1180px;margin:auto;border:1px solid #6ed5ff24;border-radius:26px;padding:22px;background:linear-gradient(145deg,#081b3af2,#040c20ef);box-shadow:0 30px 100px #0009;overflow:hidden}.headline{display:flex;justify-content:space-between;gap:18px;align-items:center}.headline small{color:#efbd5c;font-size:9px;letter-spacing:.14em;font-weight:950}.headline h2{font-size:clamp(26px,4vw,42px);line-height:1;margin:5px 0 0}.platforms{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.platforms span{border:1px solid #69d3ff33;background:#2a89ca0d;color:#8ddfff;border-radius:999px;padding:7px 9px;font-size:9px;font-weight:900;white-space:nowrap}.platforms span:nth-child(3){border-color:#d8bf6238;color:#efc765}.platformNote{max-width:840px;margin:10px 0 0;color:#a8bcd3;font-size:12px;line-height:1.5}.creativeGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:18px}.creativeGrid a{min-height:88px;border:1px solid #ffffff12;background:#081a38;border-radius:15px;padding:13px;text-decoration:none;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:10px}.creativeGrid a:hover{border-color:#6ed5ff55}.creativeGrid strong,.creativeGrid small{display:block}.creativeGrid strong{font-size:13px;line-height:1.2}.creativeGrid small{color:#829eba;font-size:9px;margin-top:5px;line-height:1.3}.creativeGrid em{font-style:normal;color:#79dbff;font-size:10px;font-weight:900;white-space:nowrap}.gameCallout{margin-top:9px;padding:14px;border-radius:15px;border:1px solid #d8bf6230;background:linear-gradient(100deg,#30220e99,#071a36);display:flex;justify-content:space-between;gap:16px;align-items:center}.gameCallout strong,.gameCallout small{display:block}.gameCallout strong{font-size:16px}.gameCallout small{color:#9cb0c7;font-size:10px;margin-top:4px}.gameCallout a{white-space:nowrap;text-decoration:none;background:#d8bf62;color:#07110d;padding:10px 12px;border-radius:11px;font-size:10px;font-weight:950}@media(max-width:820px){.headline{align-items:flex-start}.creativeGrid{grid-template-columns:1fr 1fr}}@media(max-width:460px){.inner{padding:16px}.headline{display:grid}.platforms{justify-content:flex-start}.headline h2{font-size:27px}.platformNote{font-size:11px}.creativeGrid{grid-template-columns:1fr 1fr}.creativeGrid a{min-height:80px;padding:10px}.creativeGrid strong{font-size:11px}.gameCallout{padding:12px}.gameCallout strong{font-size:14px}}`}</style>
  </section>;
}
