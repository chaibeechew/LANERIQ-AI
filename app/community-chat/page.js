"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CommunityChatPage() {
  const [supabase, setSupabase] = useState(null);
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setSupabase(createClient()); }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) { window.location.href = "/auth"; return; }
      setUser(data.user);
      const { data: foundRoom } = await supabase.from("chat_rooms").select("id,name,description").eq("slug", "community").eq("is_active", true).single();
      if (!active) return;
      setRoom(foundRoom);
      if (foundRoom) {
        const { data: member } = await supabase.from("chat_room_members").select("room_id").eq("room_id", foundRoom.id).eq("user_id", data.user.id).maybeSingle();
        if (member) {
          setJoined(true);
          const { data: history } = await supabase.from("chat_messages").select("id,room_id,user_id,sender_type,body,created_at").eq("room_id", foundRoom.id).order("created_at", { ascending: true }).limit(100);
          if (active) setMessages(history || []);
        }
      }
      if (active) setLoading(false);
    }).catch((e) => { if (active) { setError(e?.message || "Unable to load community chat."); setLoading(false); } });
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !joined || !room) return;
    const channel = supabase.channel(`community-chat-${room.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${room.id}` }, (payload) => {
      setMessages((current) => current.some((item) => item.id === payload.new.id) ? current : [...current, payload.new]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [joined, room, supabase]);

  async function openChat() {
    if (!room || !user || !supabase) return;
    setError("");
    const { error: joinError } = await supabase.from("chat_room_members").upsert({ room_id: room.id, user_id: user.id }, { onConflict: "room_id,user_id" });
    if (joinError) { setError(joinError.message); return; }
    setJoined(true);
    const { data: history } = await supabase.from("chat_messages").select("id,room_id,user_id,sender_type,body,created_at").eq("room_id", room.id).order("created_at", { ascending: true }).limit(100);
    setMessages(history || []);
  }

  async function closeChat() {
    if (!room || !user || !supabase) return;
    setError("");
    const { error: closeError } = await supabase.from("chat_room_members").delete().eq("room_id", room.id).eq("user_id", user.id);
    if (closeError) { setError(closeError.message); return; }
    setJoined(false);
    setMessages([]);
  }

  async function sendMessage(event) {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending || !joined) return;
    setText(""); setSending(true); setError("");
    try {
      const response = await fetch("/api/community-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to send message");
      if (result.message) setMessages((current) => current.some((item) => item.id === result.message.id) ? current : [...current, result.message]);
      if (result.ai) setMessages((current) => current.some((item) => item.id === result.ai.id) ? current : [...current, result.ai]);
    } catch (sendError) { setError(sendError.message); setText(message); } finally { setSending(false); }
  }

  if (loading) return <main className="chatPage"><div className="loadingCard"><span className="loadingOrb">✦</span><div><b>Opening Community Intelligence</b><small>Checking your optional participation state…</small></div></div><style jsx>{styles}</style><style jsx global>{globalStyles}</style></main>;

  const roomReady = Boolean(room);

  return (
    <main className="chatPage">
      <section className="chatShell">
        <header className="chatHeader">
          <div className="heroCopy">
            <div className="eyebrow">LANERIQ AI · COMMUNITY INTELLIGENCE</div>
            <div className="titleRow"><h1>{room?.name || "Community Chat"}</h1><span className={`statePill ${joined ? "live" : "off"}`}><i />{joined ? "Room Open" : "Opt-in Only"}</span></div>
            <p>{room?.description || "Connect with participating LANERIQ users and the clearly identified AI assistant when you choose to join."}</p>
          </div>
          <div className="headerActions">
            {joined ? <button className="ghostButton" onClick={closeChat}>Close Chat</button> : <button className="primaryButton" onClick={openChat} disabled={!roomReady}>Open Chat</button>}
            <a className="ghostButton" href="/my-apps">My Projects</a>
          </div>
        </header>

        <section className="trustGrid" aria-label="Community chat trust controls">
          <article><span>01</span><div><b>Optional by design</b><small>Nothing opens until you choose to join.</small></div></article>
          <article><span>02</span><div><b>Realtime only when joined</b><small>Live updates use the actual community room.</small></div></article>
          <article><span>03</span><div><b>AI stays identifiable</b><small>Assistant messages are explicitly labeled AI.</small></div></article>
        </section>

        {!joined ? (
          <section className="optInCard">
            <div className="communityVisual" aria-hidden="true"><span className="orbit orbitOne" /><span className="orbit orbitTwo" /><div className="communityOrb">✦</div></div>
            <div className="optInCopy">
              <div className="eyebrow">YOU CONTROL PARTICIPATION</div>
              <h2>{roomReady ? "Community stays off until you open it." : "Community room is currently unavailable."}</h2>
              <p>{roomReady ? <>Opening the room adds your account as a participant. Community messages are visible to other participating users, and you can close the chat again at any time.</> : <>No active community room was returned. Your account has not been joined automatically. You can return later and try again.</>}</p>
              <div className="optInSignals"><span>✓ No automatic join</span><span>✓ Leave whenever you want</span><span>✓ AI replies labeled</span></div>
              <button className="primaryButton large" onClick={openChat} disabled={!roomReady}>{roomReady ? "Open Community Chat" : "Room Unavailable"}</button>
            </div>
          </section>
        ) : (
          <>
            <div className="sessionNotice"><span className="pulse" /><div><b>Realtime room active</b><small>You chose to join. Community messages may be visible to other participating users.</small></div><span className="sessionTag">OPTIONAL SESSION</span></div>
            <section className="communityWorkspace">
              <div className="conversationPanel">
                <div className="panelHead"><div><span className="eyebrow">LIVE CONVERSATION</span><h2>Community room</h2></div><span>{messages.length} loaded</span></div>
                <section className="messages" aria-live="polite" aria-label="Community messages">
                  {messages.length ? messages.map((message) => {
                    const mine = message.sender_type !== "ai" && message.sender_type !== "system" && message.user_id === user?.id;
                    const label = message.sender_type === "ai" ? "AI Assistant" : message.sender_type === "system" ? "System" : mine ? "You" : "Community User";
                    return <article className={`message ${message.sender_type} ${mine ? "mine" : ""}`} key={message.id}><div className="messageLabel"><span>{label}</span><time>{formatMessageTime(message.created_at)}</time></div><div className="bubble">{message.body}</div></article>;
                  }) : <div className="empty"><span>✦</span><b>No messages yet</b><small>Start the conversation when you are ready.</small></div>}
                </section>
                <form className="composer" onSubmit={sendMessage}>
                  <div className="composerField"><textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder="Message the community or ask the AI…" rows={2} disabled={sending} aria-label="Community message" /><small>{text.length}/4000</small></div>
                  <button className="primaryButton sendButton" disabled={sending || !text.trim()}>{sending ? "Sending…" : "Send"}</button>
                </form>
              </div>

              <aside className="communityIntel" aria-label="Room intelligence">
                <div className="intelOrb">◎</div>
                <div><span className="eyebrow">ROOM INTELLIGENCE</span><h2>Trust controls</h2><p>Participation and message identity remain visible while you chat.</p></div>
                <dl><div><dt>Participation</dt><dd>Optional</dd></div><div><dt>Visibility</dt><dd>Participants</dd></div><div><dt>AI identity</dt><dd>Always labeled</dd></div><div><dt>Loaded history</dt><dd>Latest 100</dd></div></dl>
                <button className="ghostButton full" onClick={closeChat}>Close this chat</button>
              </aside>
            </section>
          </>
        )}

        {error && <div className="error" role="alert"><b>Community Chat</b><span>{error}</span></div>}
        <footer className="truthNote">LANERIQ AI shows the real joined state and loaded messages only. No online-user, engagement or activity counts are invented for presentation.</footer>
      </section>
      <style jsx>{styles}</style>
      <style jsx global>{globalStyles}</style>
    </main>
  );
}

const styles = `
  .chatPage{min-height:100vh;padding:34px 22px 132px;background:transparent;color:var(--liui-text,#f8fbff)}
  .chatShell{max-width:1180px;margin:0 auto}
  .chatHeader{display:flex;justify-content:space-between;gap:28px;align-items:flex-end;margin-bottom:18px}
  .heroCopy{max-width:760px}.eyebrow{color:var(--liui-gold,#f2bd52);letter-spacing:.17em;font-size:10px;font-weight:900}
  .titleRow{display:flex;align-items:center;gap:13px;flex-wrap:wrap}.titleRow h1{font-size:clamp(40px,5vw,62px);letter-spacing:-.045em;margin:8px 0 7px;line-height:1}
  .heroCopy>p{max-width:680px;margin:0;color:var(--liui-muted,#b8c7d7);line-height:1.6;font-size:14px}
  .statePill{display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:0 11px;border-radius:999px;font-size:10px;font-weight:850;letter-spacing:.05em;border:1px solid rgba(255,255,255,.13);background:rgba(5,18,35,.65)}
  .statePill i{width:7px;height:7px;border-radius:50%;background:#8392a3}.statePill.live{color:#a9f3c2;border-color:rgba(102,223,145,.28)}.statePill.live i{background:var(--liui-green,#66df91);box-shadow:0 0 16px rgba(102,223,145,.72)}.statePill.off{color:#d6e0ea}
  .headerActions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}
  .primaryButton,.ghostButton{min-height:46px;display:inline-flex;align-items:center;justify-content:center;border-radius:14px;padding:0 17px;font-weight:850;text-decoration:none;cursor:pointer;font:inherit;font-size:12px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
  .primaryButton{background:linear-gradient(135deg,#f7d67c,#c78d2d);color:#111a25;border:1px solid rgba(255,238,178,.62);box-shadow:0 12px 34px rgba(210,158,51,.18)}
  .primaryButton:hover{box-shadow:0 16px 42px rgba(210,158,51,.28)}.primaryButton:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}
  .ghostButton{background:linear-gradient(145deg,rgba(10,31,53,.76),rgba(7,22,42,.54));color:#e7eef5;border:1px solid rgba(190,216,244,.19);backdrop-filter:blur(18px)}
  .primaryButton:focus-visible,.ghostButton:focus-visible,.composer textarea:focus-visible{outline:2px solid #bca1ff;outline-offset:3px}
  .large{min-height:52px;padding:0 22px}.full{width:100%}
  .trustGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
  .trustGrid article{min-height:86px;display:flex;align-items:center;gap:12px;padding:14px;border:1px solid rgba(190,216,244,.16);border-radius:18px;background:linear-gradient(145deg,rgba(10,30,52,.7),rgba(7,19,38,.62));box-shadow:0 18px 48px rgba(0,0,0,.2);backdrop-filter:blur(20px) saturate(135%)}
  .trustGrid article>span{width:38px;height:38px;flex:0 0 38px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(139,87,255,.28),rgba(76,184,255,.14));border:1px solid rgba(166,139,255,.2);color:#d4c6ff;font-size:10px;font-weight:900}
  .trustGrid b,.trustGrid small{display:block}.trustGrid b{font-size:12px}.trustGrid small{margin-top:4px;color:#8fa3b6;line-height:1.4;font-size:10px}
  .optInCard{min-height:430px;padding:42px;display:grid;grid-template-columns:.85fr 1.15fr;gap:44px;align-items:center;border:1px solid rgba(190,216,244,.18);border-radius:30px;background:linear-gradient(145deg,rgba(8,25,47,.84),rgba(18,18,50,.68));box-shadow:0 28px 80px rgba(0,0,0,.3);backdrop-filter:blur(28px) saturate(145%);overflow:hidden;position:relative}
  .optInCard:before{content:"";position:absolute;width:380px;height:380px;border-radius:50%;left:-130px;bottom:-220px;background:radial-gradient(circle,rgba(76,184,255,.16),transparent 68%);pointer-events:none}
  .communityVisual{min-height:310px;position:relative;display:grid;place-items:center}
  .communityOrb{width:132px;height:132px;border-radius:50%;display:grid;place-items:center;position:relative;z-index:2;font-size:46px;color:#142031;background:radial-gradient(circle at 35% 28%,#fff1b8,#f2bd52 44%,#a96820 82%);box-shadow:0 0 28px rgba(242,189,82,.42),0 0 100px rgba(111,72,255,.28)}
  .orbit{position:absolute;border-radius:50%;border:1px solid rgba(176,155,255,.28);box-shadow:inset 0 0 34px rgba(98,104,255,.07)}.orbitOne{width:230px;height:230px}.orbitTwo{width:310px;height:310px;border-color:rgba(76,184,255,.16)}
  .orbitOne:before,.orbitTwo:after{content:"";position:absolute;width:11px;height:11px;border-radius:50%;background:#9d79ff;box-shadow:0 0 20px rgba(157,121,255,.8)}.orbitOne:before{top:28px;right:34px}.orbitTwo:after{bottom:52px;left:22px;background:#58bfff;box-shadow:0 0 20px rgba(88,191,255,.72)}
  .optInCopy{position:relative;z-index:2}.optInCopy h2{font-size:clamp(28px,4vw,42px);letter-spacing:-.035em;line-height:1.08;margin:10px 0}.optInCopy p{color:#aebfd0;line-height:1.65;max-width:620px}
  .optInSignals{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 22px}.optInSignals span{padding:8px 10px;border-radius:10px;background:rgba(102,223,145,.07);border:1px solid rgba(102,223,145,.13);color:#bdebcf;font-size:10px;font-weight:750}
  .sessionNotice{display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:11px;padding:12px 15px;margin:12px 0;border:1px solid rgba(102,223,145,.17);border-radius:17px;background:linear-gradient(90deg,rgba(44,129,84,.13),rgba(9,26,47,.7));backdrop-filter:blur(18px)}
  .sessionNotice b,.sessionNotice small{display:block}.sessionNotice b{font-size:11px}.sessionNotice small{margin-top:2px;color:#8ea9a0;font-size:9px}.pulse{width:9px;height:9px;border-radius:50%;background:#66df91;box-shadow:0 0 20px rgba(102,223,145,.76)}.sessionTag{font-size:9px;letter-spacing:.12em;color:#9adfb2;font-weight:900}
  .communityWorkspace{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:12px}
  .conversationPanel,.communityIntel{border:1px solid rgba(190,216,244,.17);border-radius:25px;background:linear-gradient(145deg,rgba(7,24,45,.88),rgba(8,18,38,.75));box-shadow:0 24px 70px rgba(0,0,0,.28);backdrop-filter:blur(24px) saturate(140%)}
  .conversationPanel{padding:14px}.panelHead{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding:5px 5px 12px}.panelHead h2{margin:5px 0 0;font-size:20px}.panelHead>span{color:#8497aa;font-size:9px}
  .messages{min-height:48vh;max-height:60vh;overflow:auto;padding:18px;border:1px solid rgba(190,216,244,.1);border-radius:19px;background:linear-gradient(180deg,rgba(3,15,30,.76),rgba(5,18,35,.9));scrollbar-color:#42536a transparent}
  .message{margin:0 0 15px;display:flex;flex-direction:column;align-items:flex-start;max-width:78%}.message.mine{margin-left:auto;align-items:flex-end}.messageLabel{width:100%;display:flex;gap:10px;justify-content:flex-start;padding:0 5px 5px;color:#7f94a8;font-size:9px}.message.mine .messageLabel{justify-content:flex-end}.messageLabel time{opacity:.68}
  .bubble{padding:11px 14px;border-radius:6px 16px 16px 16px;background:linear-gradient(145deg,#0d2b49,#0a223d);border:1px solid rgba(112,174,229,.12);white-space:pre-wrap;line-height:1.55;color:#e7f0f7;font-size:13px;overflow-wrap:anywhere}.message.mine .bubble{border-radius:16px 6px 16px 16px;background:linear-gradient(145deg,#5739b7,#43308e);border-color:rgba(190,161,255,.2)}.message.ai .bubble{background:linear-gradient(145deg,rgba(98,69,35,.72),rgba(38,34,53,.92));border-color:rgba(242,189,82,.21);color:#fff1c4}.message.system .bubble{background:rgba(255,255,255,.055);color:#aebdca}
  .empty{min-height:300px;display:grid;place-items:center;align-content:center;gap:7px;text-align:center;color:#71879a}.empty>span{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:rgba(139,87,255,.12);color:#bda5ff;font-size:24px;box-shadow:0 0 34px rgba(139,87,255,.14)}.empty b{color:#c6d2dd;font-size:13px}.empty small{font-size:10px}
  .composer{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:10px}.composerField{position:relative}.composer textarea{width:100%;min-height:70px;resize:vertical;border-radius:16px;border:1px solid rgba(190,216,244,.18);background:linear-gradient(180deg,#fffdf8,#f0eadf);color:#17222e;padding:13px 55px 13px 14px;font:inherit;font-size:16px;outline:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}.composer textarea::placeholder{color:#687582}.composerField>small{position:absolute;right:11px;bottom:10px;color:#75808a;font-size:8px}.sendButton{min-width:92px;align-self:stretch}
  .communityIntel{padding:18px;align-self:start;position:sticky;top:120px}.intelOrb{width:54px;height:54px;border-radius:18px;display:grid;place-items:center;margin-bottom:18px;background:linear-gradient(145deg,rgba(139,87,255,.26),rgba(76,184,255,.13));border:1px solid rgba(173,145,255,.18);color:#d6c8ff;font-size:24px;box-shadow:0 0 30px rgba(111,82,255,.13)}.communityIntel h2{font-size:24px;margin:6px 0}.communityIntel p{color:#8fa4b6;font-size:11px;line-height:1.55}.communityIntel dl{margin:19px 0;display:grid;gap:7px}.communityIntel dl>div{display:flex;justify-content:space-between;gap:12px;padding:10px;border-radius:11px;background:rgba(4,17,34,.62);border:1px solid rgba(190,216,244,.08)}.communityIntel dt{color:#8297a9;font-size:9px}.communityIntel dd{margin:0;color:#e5edf4;font-size:9px;font-weight:800;text-align:right}
  .error{margin-top:12px;display:flex;gap:10px;align-items:center;padding:11px 13px;border-radius:13px;border:1px solid rgba(255,128,128,.18);background:rgba(125,35,51,.24);color:#ffd0d0;font-size:11px}.error b{color:#ffabab}.truthNote{margin-top:12px;padding:11px 14px;text-align:center;border:1px solid rgba(190,216,244,.09);border-radius:13px;background:rgba(4,17,34,.46);color:#74899c;font-size:9px;line-height:1.5}
  .loadingCard{max-width:580px;min-height:150px;margin:16vh auto 0;padding:24px;display:flex;align-items:center;gap:17px;border:1px solid rgba(190,216,244,.16);border-radius:24px;background:rgba(7,24,45,.78);backdrop-filter:blur(24px);box-shadow:0 24px 70px rgba(0,0,0,.3)}.loadingOrb{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 28%,#fff1b8,#f2bd52 44%,#a96820 82%);color:#142031;font-size:22px;box-shadow:0 0 30px rgba(242,189,82,.35)}.loadingCard b,.loadingCard small{display:block}.loadingCard small{margin-top:5px;color:#879aab}
  @media(max-width:860px){.trustGrid{grid-template-columns:1fr}.trustGrid article{min-height:70px}.optInCard{grid-template-columns:1fr;padding:30px;gap:15px}.communityVisual{min-height:250px}.communityWorkspace{grid-template-columns:1fr}.communityIntel{position:static}.messages{min-height:46vh}.headerActions{justify-content:flex-start}}
  @media(max-width:620px){.chatPage{padding-inline:10px}.chatHeader{align-items:stretch;flex-direction:column}.titleRow h1{font-size:38px}.headerActions{display:grid;grid-template-columns:1fr 1fr}.headerActions>*{width:100%}.optInCard{padding:24px 16px;border-radius:22px}.communityVisual{min-height:220px}.communityOrb{width:104px;height:104px;font-size:38px}.orbitOne{width:180px;height:180px}.orbitTwo{width:220px;height:220px}.sessionNotice{grid-template-columns:12px 1fr}.sessionTag{grid-column:2}.conversationPanel{padding:9px;border-radius:20px}.messages{padding:12px}.message{max-width:90%}.composer{grid-template-columns:1fr}.sendButton{min-height:50px}.communityIntel{border-radius:20px}}
  @media(prefers-reduced-motion:reduce){.primaryButton,.ghostButton{transition:none}}
`;

const globalStyles = `
  @media(min-width:1001px){body[data-liui-surface="community"] .chatPage{margin-left:112px;padding-top:118px!important}}
  @media(max-width:1000px){body[data-liui-surface="community"] .chatPage{padding-top:88px!important;padding-bottom:126px!important}}
`;
