"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import LaneriqLotusBrand from "./LaneriqLotusBrand";

// Route-aware presentation only. These names never replace the underlying generation,
// project, workflow, database, quality, account, billing or publish engines.
const SURFACES = [
  [/^\/$/, "creation"],
  [/^\/create\/?$/, "creation"],
  [/^\/preview\//, "preview"],
  [/^\/release\//, "launch"],
  [/^\/app-dashboard\//, "manage"],
  [/^\/my-apps\/?$/, "creations"],
  [/^\/templates\/?$/, "templates"],
  [/^\/templates\//, "template-detail"],
  [/^\/soolen-ai\/?$/, "assistant"],
  [/^\/workflows\//, "workflow"],
  [/^\/analytics\//, "analytics"],
  [/^\/studio\/?$/, "more"],
  [/^\/image-studio\/?$/, "media"],
  [/^\/video-studio\/?$/, "media"],
  [/^\/avatar-studio\/?$/, "media"],
  [/^\/brand-kit\/?$/, "brand"],
  [/^\/asset-library\/?$/, "assets"],
  [/^\/community-chat\/?$/, "community"],
  [/^\/credits\/?$/, "credits"],
  [/^\/domains\/?$/, "domains"],
  [/^\/account\/device-compute\/?$/, "account"],
  [/^\/account\/security\/?$/, "account"],
  [/^\/account\/cloud\/?$/, "account"],
  [/^\/editor\//, "editor"],
  [/^\/database\//, "database"],
  [/^\/operations\//, "quality"],
  [/^\/publish\//, "publish"],
];

// Keep the approved product navigation semantics intact while matching the new visual shell.
const NAV = [
  { label: "Home", href: "/", icon: "⌂" },
  { label: "Projects", href: "/my-apps", icon: "▣" },
  { label: "Create", href: "/create", icon: "+" },
  { label: "Templates", href: "/templates", icon: "▦" },
  { label: "More", href: "/studio", icon: "•••" },
];

const PROJECT_RAIL = [
  { label:"Home", href:"/", icon:"⌂" },
  { label:"Projects", href:"/my-apps", icon:"▣" },
  { label:"Templates", href:"/templates", icon:"▦" },
  { label:"Automation", href:"/studio", icon:"⌘" },
  { label:"AI Assistant", href:"/soolen-ai", icon:"◎" },
  { label:"More", href:"/studio", icon:"⚙" },
];

const CREATION_STAGES = ["Idea","Plan","Design","Build","Preview","Launch","Manage"];
const PAGE_STEPS = [
  "Idea","Plan","Build","Preview","Launch","Manage","Projects","Templates","Assistant",
  "Automation","Analytics","More","Editor","Template","Workflow","Database","Testing","Deploy",
];

function resolveSurface(pathname){
  for(const [pattern,name] of SURFACES) if(pattern.test(pathname || "")) return name;
  return "";
}

function resolvePageId(pathname){
  const path=String(pathname||"");
  if(path==="/")return 1;
  if(path==="/create"||path==="/create/")return 2;
  if(path.startsWith("/preview/"))return 4;
  if(path.startsWith("/release/"))return 5;
  if(path.startsWith("/app-dashboard/"))return 6;
  if(path==="/my-apps"||path==="/my-apps/")return 7;
  if(path==="/templates"||path==="/templates/")return 8;
  if(path==="/soolen-ai"||path==="/soolen-ai/")return 9;
  if(path.startsWith("/workflows/"))return 10;
  if(path.startsWith("/analytics/"))return 11;
  if(path==="/studio"||path==="/studio/")return 12;
  if(path.startsWith("/editor/"))return 13;
  if(path.startsWith("/templates/"))return 14;
  if(path.startsWith("/database/"))return 16;
  if(path.startsWith("/operations/"))return 17;
  if(path.startsWith("/publish/"))return 18;
  return 0;
}

function selectedLabel(pathname){
  if(pathname === "/") return "Home";
  if(pathname === "/create" || pathname === "/create/") return "Create";
  if(pathname === "/templates" || pathname === "/templates/" || pathname?.startsWith("/templates/")) return "Templates";
  if(
    pathname === "/studio" || pathname === "/studio/" || pathname === "/soolen-ai" || pathname === "/soolen-ai/" ||
    pathname === "/image-studio" || pathname === "/image-studio/" || pathname === "/video-studio" || pathname === "/video-studio/" ||
    pathname === "/avatar-studio" || pathname === "/avatar-studio/" || pathname === "/brand-kit" || pathname === "/brand-kit/" ||
    pathname === "/asset-library" || pathname === "/asset-library/" || pathname === "/community-chat" || pathname === "/community-chat/" ||
    pathname === "/credits" || pathname === "/credits/" || pathname === "/domains" || pathname === "/domains/" ||
    pathname === "/account/device-compute" || pathname === "/account/device-compute/" ||
    pathname === "/account/security" || pathname === "/account/security/" ||
    pathname === "/account/cloud" || pathname === "/account/cloud/"
  ) return "More";
  if(
    pathname === "/my-apps" || pathname === "/my-apps/" ||
    pathname?.startsWith("/app-dashboard/") || pathname?.startsWith("/preview/") ||
    pathname?.startsWith("/release/") || pathname?.startsWith("/workflows/") ||
    pathname?.startsWith("/analytics/") || pathname?.startsWith("/editor/") ||
    pathname?.startsWith("/database/") || pathname?.startsWith("/operations/") ||
    pathname?.startsWith("/publish/")
  ) return "Projects";
  return "";
}

function suppressLegacyPrimaryNavs(){
  const touched=[];
  for(const nav of document.querySelectorAll("nav.bottomNav")){
    if(nav.classList.contains("liuiRealBottomNav")||nav.dataset.liuiNav==="canonical"||nav.dataset.liuiNavSuperseded==="true")continue;
    touched.push({nav,hidden:nav.hidden,ariaHidden:nav.getAttribute("aria-hidden"),inert:nav.hasAttribute("inert"),marker:nav.dataset.liuiNavSuperseded});
    nav.hidden=true;
    nav.setAttribute("aria-hidden","true");
    nav.setAttribute("inert","");
    nav.dataset.liuiNavSuperseded="true";
  }
  return touched;
}

function restoreLegacyPrimaryNavs(touched){
  for(const item of touched){
    const nav=item?.nav;
    if(!nav?.isConnected)continue;
    nav.hidden=Boolean(item.hidden);
    if(item.ariaHidden===null)nav.removeAttribute("aria-hidden");else nav.setAttribute("aria-hidden",item.ariaHidden);
    if(item.inert)nav.setAttribute("inert","");else nav.removeAttribute("inert");
    if(item.marker===undefined)delete nav.dataset.liuiNavSuperseded;else nav.dataset.liuiNavSuperseded=item.marker;
  }
}

function PortalBrandAnchor({surface}){
  if(!["creations","templates","template-detail"].includes(surface))return null;
  return <Link href="/" className={`liuiPortalBrandAnchor liuiPortalBrandAnchor-${surface}`} aria-label="LANERIQ AI home">
    <LaneriqLotusBrand compact />
  </Link>;
}

function ReferenceChrome({pageId,surface}){
  const projectSurface=Boolean(surface && surface!=="creation" && surface!=="creations" && surface!=="templates" && surface!=="template-detail");
  const showCreationTrack=pageId>=4&&pageId<=6;
  const stageIndex=pageId===4?4:pageId===5?5:pageId===6?6:0;
  if(!projectSurface)return null;
  return <>
    <header className="liuiReferenceHeader" aria-label="LANERIQ AI workspace header">
      <Link href="/" className="liuiReferenceBrand" aria-label="LANERIQ AI home"><LaneriqLotusBrand compact /></Link>
      <Link href="/studio" className="liuiReferenceProfile"><span className="liuiReferenceAvatar" aria-hidden="true">◉</span><span><b>Profile</b><small>LANERIQ User</small></span><span aria-hidden="true">⌄</span></Link>
    </header>
    <aside className="liuiReferenceRail" aria-label="LANERIQ AI workspace navigation">
      <Link href="/" className="liuiRailLogo" aria-label="LANERIQ AI home"><LaneriqLotusBrand iconOnly /></Link>
      {PROJECT_RAIL.map(item=><Link key={item.label} href={item.href}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></Link>)}
    </aside>
    {showCreationTrack&&<div className="liuiCreationStage" aria-label={`Creation stage ${CREATION_STAGES[stageIndex]}`}>
      <span className="liuiPageBadge">Page {pageId} of 6</span>
      <div>{CREATION_STAGES.map((stage,index)=><span key={stage} className={index<=stageIndex?"done":""}><i>{index<stageIndex?"✓":index===stageIndex?String(pageId):""}</i>{stage}</span>)}</div>
    </div>}
    {pageId>=15&&<div className="liuiEighteenStepStrip" aria-label={`Page ${pageId} of 18`}>
      {PAGE_STEPS.map((label,index)=><span key={`${label}-${index}`} className={index+1===pageId?"active":index+1<pageId?"done":""}><i>{index+1}</i><small>{label}</small></span>)}
    </div>}
  </>;
}

export default function LIUIRealProductSurface(){
  const pathname=usePathname() || "";
  const surface=useMemo(()=>resolveSurface(pathname),[pathname]);
  const pageId=useMemo(()=>resolvePageId(pathname),[pathname]);
  const active=selectedLabel(pathname);

  useEffect(()=>{
    if(surface) document.body.dataset.liuiSurface=surface;
    else delete document.body.dataset.liuiSurface;
    if(pageId)document.body.dataset.liuiPage=String(pageId);else delete document.body.dataset.liuiPage;
    document.documentElement.dataset.liuiRealProduct="2026.3-reference";
    return()=>{
      if(document.body.dataset.liuiSurface===surface) delete document.body.dataset.liuiSurface;
      if(document.body.dataset.liuiPage===String(pageId)) delete document.body.dataset.liuiPage;
    };
  },[surface,pageId]);

  useEffect(()=>{
    if(!surface)return undefined;
    const touched=[];
    const suppress=()=>touched.push(...suppressLegacyPrimaryNavs());
    suppress();
    const observer=new MutationObserver(suppress);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{observer.disconnect();restoreLegacyPrimaryNavs(touched);};
  },[surface]);

  if(!surface) return null;

  return <>
    <PortalBrandAnchor surface={surface}/>
    <ReferenceChrome pageId={pageId} surface={surface}/>
    <nav className="liuiRealBottomNav" aria-label="LANERIQ AI primary navigation" data-liui-nav="canonical">
      {NAV.map(item=><Link key={item.label} href={item.href} className={active===item.label?"active":""} aria-current={active===item.label?"page":undefined}>
        <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
      </Link>)}
    </nav>
  </>;
}
