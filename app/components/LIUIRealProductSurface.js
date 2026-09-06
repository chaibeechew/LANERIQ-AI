"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import LaneriqLotusBrand from "./LaneriqLotusBrand";
import {
  CANONICAL_CREATION_JOURNEY,
  CANONICAL_PRIMARY_NAV,
  CANONICAL_PROJECT_RAIL,
  canonicalCreationIndex,
  resolveCanonicalUiContext,
} from "../../lib/product/canonical-ui-registry.js";

const CORE_ROUTE_IDS=new Set(["home","login","auth","create","build-progress"]);

function suppressLegacyPrimaryNavs(){
  const touched=[];
  for(const nav of document.querySelectorAll("nav.bottomNav")){
    if(nav.classList.contains("liuiRealBottomNav")||nav.classList.contains("canonicalBottomNav")||nav.dataset.liuiNav==="canonical"||nav.dataset.liuiNavSuperseded==="true")continue;
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
  return <Link href="/" className={`liuiPortalBrandAnchor liuiPortalBrandAnchor-${surface}`} aria-label="LANERIQ AI home"><LaneriqLotusBrand compact /></Link>;
}

function ReferenceChrome({context}){
  const surface=context?.surface||"";
  const projectSurface=Boolean(surface&&!['creation','creations','templates','template-detail','auth'].includes(surface));
  const creationIndex=canonicalCreationIndex(context?.stage);
  const showCreationTrack=creationIndex>=3;
  if(!projectSurface)return null;
  return <>
    <header className="liuiReferenceHeader" aria-label="LANERIQ AI workspace header">
      <Link href="/" className="liuiReferenceBrand" aria-label="LANERIQ AI home"><LaneriqLotusBrand compact /></Link>
      <div className="liuiReferenceContext"><small>{context.group?.toUpperCase?.()||"WORKSPACE"}</small><b>{context.name}</b></div>
      <Link href="/studio" className="liuiReferenceProfile"><span className="liuiReferenceAvatar" aria-hidden="true">◉</span><span><b>Profile</b><small>LANERIQ User</small></span><span aria-hidden="true">⌄</span></Link>
    </header>
    <aside className="liuiReferenceRail" aria-label="LANERIQ AI workspace navigation">
      <Link href="/" className="liuiRailLogo" aria-label="LANERIQ AI home"><LaneriqLotusBrand iconOnly /></Link>
      {CANONICAL_PROJECT_RAIL.map(item=><Link key={item.id} href={item.href}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></Link>)}
    </aside>
    {showCreationTrack&&<div className="liuiCreationStage" aria-label={`Creation stage ${context.stage}`}><span className="liuiPageBadge">{context.stage}</span><div>{CANONICAL_CREATION_JOURNEY.map((item,index)=><span key={item.id} className={index<=creationIndex?"done":""}><i>{index<creationIndex?"✓":index===creationIndex?"•":""}</i>{item.label}</span>)}</div></div>}
    {creationIndex<0&&<div className="liuiWorkspaceStage" aria-label={`Current workspace ${context.name}`}><small>Current workspace</small><b>{context.name}</b></div>}
  </>;
}

export default function LIUIRealProductSurface(){
  const pathname=usePathname()||"";
  const searchParams=useSearchParams();
  const context=useMemo(()=>resolveCanonicalUiContext(pathname,searchParams),[pathname,searchParams]);
  const surface=context?.surface||"";
  const active=context?.nav||"";
  const isCore=Boolean(context?.id&&CORE_ROUTE_IDS.has(context.id));

  useEffect(()=>{
    if(surface&&!isCore)document.body.dataset.liuiSurface=surface;else delete document.body.dataset.liuiSurface;
    if(context?.id&&!isCore)document.body.dataset.liuiRoute=context.id;else delete document.body.dataset.liuiRoute;
    document.documentElement.dataset.liuiRealProduct="2026.4-canonical";
    return()=>{
      if(document.body.dataset.liuiSurface===surface)delete document.body.dataset.liuiSurface;
      if(document.body.dataset.liuiRoute===context?.id)delete document.body.dataset.liuiRoute;
    };
  },[surface,context?.id,isCore]);

  useEffect(()=>{
    if(!surface||isCore)return undefined;
    const touched=[];
    const suppress=()=>touched.push(...suppressLegacyPrimaryNavs());
    suppress();
    const observer=new MutationObserver(suppress);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{observer.disconnect();restoreLegacyPrimaryNavs(touched);};
  },[surface,isCore]);

  if(!context||isCore)return null;

  return <>
    <PortalBrandAnchor surface={surface}/>
    <ReferenceChrome context={context}/>
    <nav className="liuiRealBottomNav" aria-label="LANERIQ AI primary navigation" data-liui-nav="canonical">
      {CANONICAL_PRIMARY_NAV.map(item=><Link key={item.id} href={item.href} className={active===item.label?"active":""} aria-current={active===item.label?"page":undefined}><span aria-hidden="true">{item.icon}</span><small>{item.label}</small></Link>)}
    </nav>
  </>;
}
