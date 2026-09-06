"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { PRODUCT_BRAND } from "../../lib/product-brand.js";
import { resolveCanonicalUiContext } from "../../lib/product/canonical-ui-registry.js";
import LaneriqLotusBrand from "./LaneriqLotusBrand";
import { clearPrivateSessionStorage, isPublicAccountPath, protectedReturnPath } from "../../lib/auth/session-safety.js";

const ACCOUNT_NAV_SURFACES=new Set(["creations","templates","template-detail"]);

export default function AccountNav() {
  const pathname=usePathname()||"/";
  const context=resolveCanonicalUiContext(pathname,null);
  const canonicalChromeOwnsAccount=Boolean(context&&!ACCOUNT_NAV_SURFACES.has(context.surface));
  const router=useRouter();
  const rootRef=useRef(null);
  const [user,setUser]=useState(null);
  const [open,setOpen]=useState(false);
  const [signingOut,setSigningOut]=useState(false);
  const [signOutError,setSignOutError]=useState("");

  useEffect(()=>{
    const compatibilityClient=createClient();
    let mounted=true;
    let redirecting=false;

    const redirectSignedOutProtectedPage=()=>{
      if(redirecting||isPublicAccountPath(window.location.pathname))return;
      redirecting=true;
      try{clearPrivateSessionStorage(window.sessionStorage)}catch{}
      const next=protectedReturnPath(window.location.pathname,window.location.search);
      window.location.replace(`/auth?next=${encodeURIComponent(next)}`);
    };

    const refreshUser=async()=>{
      try{
        const response=await fetch("/api/auth/session",{method:"GET",cache:"no-store",credentials:"same-origin"});
        const session=await response.json().catch(()=>({}));
        if(!mounted)return;
        if(!response.ok||session?.authenticated!==true||session?.sessionAuthority!=="laneriq"||!session?.user?.id){setUser(null);redirectSignedOutProtectedPage();return}
        let nextUser={id:session.user.id};
        try{const {data,error}=await compatibilityClient.auth.getUser();if(!error&&data?.user?.id===session.user.id)nextUser=data.user}catch{}
        if(mounted)setUser(nextUser);
      }catch{if(mounted){setUser(null);redirectSignedOutProtectedPage()}}
    };

    void refreshUser();
    const close=event=>{if(rootRef.current&&!rootRef.current.contains(event.target))setOpen(false)};
    const revalidate=()=>{void refreshUser()};
    const onVisibility=()=>{if(document.visibilityState==="visible")void refreshUser()};
    document.addEventListener("pointerdown",close);
    window.addEventListener("pageshow",revalidate);
    document.addEventListener("visibilitychange",onVisibility);
    return()=>{mounted=false;document.removeEventListener("pointerdown",close);window.removeEventListener("pageshow",revalidate);document.removeEventListener("visibilitychange",onVisibility)};
  },[]);

  useEffect(()=>{if(canonicalChromeOwnsAccount)setOpen(false)},[canonicalChromeOwnsAccount]);

  async function signOut(){
    if(signingOut)return;
    setSigningOut(true);setSignOutError("");setOpen(false);
    try{
      const response=await fetch("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",credentials:"same-origin",body:JSON.stringify({action:"logout"})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.success!==true||data?.sessionAuthority!=="laneriq")throw new Error("LANERIQ logout failed");
      try{clearPrivateSessionStorage(window.sessionStorage)}catch{}
      window.location.replace("/auth");
    }catch{setSignOutError("Sign out did not complete. Your session is still active; please try again.");setSigningOut(false)}
  }

  function go(path){setOpen(false);router.push(path)}
  if(!user||canonicalChromeOwnsAccount)return null;

  const displayName=user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split("@")[0]||"Account";
  return <div className="accountNav" ref={rootRef}>
    <div className="accountBar">
      <button className="accountTrigger" type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-label="Open account menu"><span className="avatar">{String(displayName).slice(0,1).toUpperCase()}</span><b>{displayName}</b><i>⌄</i></button>
      <button className="visibleLogout" type="button" onClick={signOut} disabled={signingOut} aria-label="Logout">{signingOut?"Signing out…":"Logout"}</button>
    </div>
    {signOutError&&<div className="signOutError" role="alert">{signOutError}</div>}
    {open&&<div className="accountMenu" role="menu" aria-label="Account menu">
      <div className="accountBrand"><LaneriqLotusBrand compact /></div><small>{PRODUCT_BRAND.name} · {PRODUCT_BRAND.capabilities}</small>
      <button type="button" role="menuitem" onClick={()=>go("/my-apps")}>▣ My Projects</button>
      <button type="button" role="menuitem" onClick={()=>go("/account/device-compute")}>◎ Device &amp; Compute</button>
      <button type="button" role="menuitem" onClick={()=>go("/account/cloud")}>◌ LANERIQ Cloud</button>
      <button type="button" role="menuitem" onClick={()=>go("/account/security")}>◇ Security & Email</button>
      <button type="button" role="menuitem" onClick={()=>go("/studio")}>▦ Studio</button>
      <button type="button" role="menuitem" onClick={()=>go("/community-chat")}>◫ Community</button>
      <button className="signout" type="button" role="menuitem" onClick={signOut} disabled={signingOut}>Sign out</button>
    </div>}
    <style jsx>{`.accountNav{position:fixed;right:max(14px,env(safe-area-inset-right));top:max(70px,calc(env(safe-area-inset-top) + 54px));z-index:1000;font-family:Inter,system-ui,-apple-system,sans-serif}.accountBar{display:flex;align-items:center;gap:7px}.accountTrigger{display:flex;align-items:center;gap:8px;min-height:44px;max-width:220px;border:1px solid rgba(166,211,248,.22);border-radius:999px;padding:6px 10px 6px 6px;background:linear-gradient(145deg,rgba(8,35,67,.9),rgba(4,22,45,.93));color:#f5fbff;box-shadow:0 12px 38px rgba(0,15,40,.38);backdrop-filter:blur(18px) saturate(140%);cursor:pointer;touch-action:manipulation}.visibleLogout{min-height:44px;border:1px solid rgba(242,204,114,.3);border-radius:999px;padding:0 13px;background:linear-gradient(145deg,rgba(8,35,67,.9),rgba(4,22,45,.93));color:#f1cf76;font-size:11px;font-weight:950;letter-spacing:.02em;box-shadow:0 12px 38px rgba(0,15,40,.38);backdrop-filter:blur(18px);cursor:pointer;touch-action:manipulation}.visibleLogout:disabled,.accountMenu button:disabled{opacity:.55;cursor:not-allowed}.avatar{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#f8dd87,#e1ad42);color:#172131;font-weight:1000;box-shadow:0 0 18px rgba(242,204,114,.22)}.accountTrigger b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.accountTrigger i{color:#9ed7ff;font-style:normal}.accountMenu{position:absolute;right:0;top:51px;width:244px;padding:10px;border:1px solid rgba(171,215,250,.2);border-radius:19px;background:linear-gradient(160deg,rgba(8,36,68,.97),rgba(3,18,39,.98));box-shadow:0 26px 74px rgba(0,10,30,.58);backdrop-filter:blur(24px) saturate(145%)}.accountBrand{padding:7px 7px 5px;border-bottom:1px solid rgba(180,218,255,.08);margin-bottom:3px}.accountMenu small{display:block;padding:5px 8px 8px;color:#87a6be;font-size:8px;letter-spacing:.08em;font-weight:850}.accountMenu button{display:block;width:100%;min-height:44px;border:0;border-radius:11px;background:transparent;color:#dcebf6;text-align:left;padding:10px 9px;font-weight:800;cursor:pointer;touch-action:manipulation}.accountMenu button:hover,.accountMenu button:focus-visible{background:linear-gradient(145deg,rgba(66,154,244,.16),rgba(26,95,171,.09));outline:none}.accountMenu .signout{margin-top:5px;border-top:1px solid rgba(180,218,255,.08);color:#ffb9b2}.signOutError{position:absolute;right:0;top:52px;width:min(320px,calc(100vw - 28px));padding:10px 12px;border:1px solid rgba(255,126,116,.32);border-radius:12px;background:#3a1110f2;color:#ffc1bb;font-size:10px;font-weight:800;line-height:1.4;box-shadow:0 14px 40px #0008}@media(max-width:720px){.accountNav{right:max(10px,env(safe-area-inset-right));top:max(62px,calc(env(safe-area-inset-top) + 48px))}.accountTrigger{max-width:118px;min-height:44px}.accountTrigger b{display:none}.visibleLogout{min-height:44px;padding:0 11px;font-size:10px}.accountMenu{width:226px}}`}</style>
  </div>;
}
