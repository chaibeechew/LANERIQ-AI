"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

const MAX_SIZE = 25 * 1024 * 1024;
const ACCEPTED = ["image/", "video/", "audio/", "application/pdf"];

function categoryFor(type=""){
  if(type.startsWith("image/")) return "image";
  if(type.startsWith("video/")) return "video";
  if(type.startsWith("audio/")) return "audio";
  if(type === "application/pdf") return "document";
  return "general";
}

export default function AssetLibraryPage(){
  const supabase = useMemo(()=>createClient(),[]);
  const [user,setUser]=useState(null);
  const [assets,setAssets]=useState([]);
  const [previews,setPreviews]=useState({});
  const [loading,setLoading]=useState(true);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{(async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){window.location.assign("/auth?next=/asset-library");return;}
    setUser(user);await refresh(user.id);
  })()},[supabase]);

  async function refresh(userId=user?.id){
    if(!userId)return;setLoading(true);setError("");
    const {data,error}=await supabase.from("asset_library").select("id,file_name,storage_path,mime_type,file_size,category,alt_text,created_at").eq("user_id",userId).order("created_at",{ascending:false});
    if(error){setError(error.message);setLoading(false);return;}
    setAssets(data||[]);
    const next={};
    for(const item of data||[]){
      const {data:signed}=await supabase.storage.from("user-assets").createSignedUrl(item.storage_path,600);
      if(signed?.signedUrl)next[item.id]=signed.signedUrl;
    }
    setPreviews(next);setLoading(false);
  }

  async function upload(event){
    const file=event.target.files?.[0];event.target.value="";
    if(!file||!user)return;
    if(file.size>MAX_SIZE){setError("File is too large. Maximum 25 MB per asset.");return;}
    if(!ACCEPTED.some(v=>v.endsWith("/")?file.type.startsWith(v):file.type===v)){setError("Use an image, video, audio recording or PDF file.");return;}
    setUploading(true);setError("");
    const safe=(file.name||"asset").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100);
    const path=`${user.id}/${crypto.randomUUID()}-${safe}`;
    try{
      const {error:uploadError}=await supabase.storage.from("user-assets").upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      const {error:dbError}=await supabase.from("asset_library").insert({user_id:user.id,file_name:file.name.slice(0,180),storage_path:path,mime_type:file.type,file_size:file.size,category:categoryFor(file.type),alt_text:""});
      if(dbError){await supabase.storage.from("user-assets").remove([path]);throw dbError;}
      await refresh(user.id);
    }catch(e){setError(e?.message||"Unable to upload this asset.");}
    finally{setUploading(false);}
  }

  async function remove(item){
    if(!confirm(`Delete ${item.file_name}?`))return;
    setError("");
    const {error:storageError}=await supabase.storage.from("user-assets").remove([item.storage_path]);
    if(storageError){setError(storageError.message);return;}
    const {error:dbError}=await supabase.from("asset_library").delete().eq("id",item.id).eq("user_id",user.id);
    if(dbError){setError(dbError.message);return;}
    await refresh(user.id);
  }

  return <main className="assetPage"><div className="wrap">
    <div className="top"><Link href="/studio">← Studio</Link><span>PRIVATE ASSET LIBRARY</span></div>
    <header><div><small>REUSE, DON'T RE-UPLOAD</small><h1>Your creative assets.</h1><p>Keep logos, photos, videos, voice recordings and documents in one private library. Assets stay user-scoped and are served with short-lived signed preview links.</p></div><label className="upload">{uploading?"Uploading…":"+ Add Asset"}<input type="file" accept="image/*,video/*,audio/*,application/pdf" onChange={upload} disabled={uploading}/></label></header>
    <div className="privacy">🔐 Private by default · per-user RLS · signed previews expire automatically · voice recordings stay owner-scoped</div>
    {error&&<div className="error">{error}</div>}
    {loading?<div className="empty">Loading your assets…</div>:assets.length?<section className="grid">{assets.map(item=><article key={item.id}>
      <div className="preview">{item.category==="image"&&previews[item.id]?<img src={previews[item.id]} alt={item.alt_text||item.file_name}/>:item.category==="video"&&previews[item.id]?<video src={previews[item.id]} controls preload="metadata"/>:item.category==="audio"&&previews[item.id]?<div className="audioPreview"><span>VOICE / AUDIO</span><audio src={previews[item.id]} controls preload="metadata"/></div>:<div className="fileIcon">{item.category==="document"?"PDF":"FILE"}</div>}</div>
      <div className="info"><small>{item.category.toUpperCase()}</small><h3 title={item.file_name}>{item.file_name}</h3><p>{item.file_size?`${(item.file_size/1024/1024).toFixed(2)} MB`:""}</p><div className="actions">{previews[item.id]?<a href={previews[item.id]} target="_blank" rel="noreferrer">Open</a>:null}<button onClick={()=>remove(item)}>Delete</button></div></div>
    </article>)}</section>:<div className="empty"><h2>No assets yet</h2><p>Add a logo, photo, video, voice recording or PDF and reuse it in future builds.</p></div>}
  </div><style>{`*{box-sizing:border-box}.assetPage{min-height:100vh;padding:28px 18px 80px;background:radial-gradient(circle at 70% 8%,rgba(216,191,98,.13),transparent 24%),linear-gradient(145deg,#03100d,#0a2119 58%,#06140f);color:#f6fff9}.wrap{max-width:1120px;margin:auto}.top{display:flex;justify-content:space-between;align-items:center;color:#d8bf62;font-size:11px;letter-spacing:.14em}.top a{color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.12);padding:10px 13px;border-radius:999px}header{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;padding:56px 0 24px}header small{color:#d8bf62;font-weight:900;letter-spacing:.18em}h1{font-size:clamp(46px,7vw,76px);letter-spacing:-.045em;margin:8px 0 10px}header p{max-width:720px;color:#9db1a8;line-height:1.65}.upload{background:#d8bf62;color:#07130e;padding:14px 18px;border-radius:13px;font-weight:1000;cursor:pointer;white-space:nowrap}.upload input{display:none}.privacy{padding:13px 15px;border:1px solid rgba(121,215,172,.18);background:rgba(70,190,140,.07);color:#94e1be;border-radius:14px;margin-bottom:15px}.error{padding:13px 15px;background:rgba(220,80,70,.12);color:#ffaaa0;border-radius:14px;margin-bottom:15px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.grid article{overflow:hidden;border:1px solid rgba(255,255,255,.08);background:rgba(3,16,13,.78);border-radius:20px}.preview{height:190px;background:#0b1c17;display:grid;place-items:center}.preview img,.preview video{width:100%;height:100%;object-fit:cover}.audioPreview{width:100%;height:100%;display:grid;align-content:center;gap:16px;padding:22px;background:radial-gradient(circle at 75% 20%,rgba(216,191,98,.18),transparent 32%),#081913}.audioPreview span{color:#d8bf62;font-weight:950;letter-spacing:.12em;font-size:11px}.audioPreview audio{width:100%}.fileIcon{width:80px;height:80px;border-radius:20px;background:linear-gradient(145deg,#d8bf62,#8b7435);color:#07130e;display:grid;place-items:center;font-weight:1000}.info{padding:16px}.info small{color:#d8bf62;font-weight:900;letter-spacing:.12em}.info h3{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:8px 0}.info p{color:#81988e;margin:0}.actions{display:flex;gap:8px;margin-top:14px}.actions a,.actions button{flex:1;text-align:center;border-radius:10px;padding:9px 11px;font:inherit;font-weight:900;text-decoration:none}.actions a{background:#d8bf62;color:#07130e}.actions button{border:1px solid rgba(255,255,255,.12);background:transparent;color:#ffb3aa;cursor:pointer}.empty{padding:70px 20px;text-align:center;border:1px dashed rgba(216,191,98,.2);border-radius:22px;color:#9db1a8}@media(max-width:700px){header{flex-direction:column;align-items:stretch}.top span{display:none}.upload{text-align:center}.preview{height:220px}}`}</style></main>;
}
