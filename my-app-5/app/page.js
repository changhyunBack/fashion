"use client";
import { useState, useEffect, useRef } from "react";

/* ---------- 환경 ----------------------------------------- */
const API       = process.env.NEXT_PUBLIC_API || "http://localhost:8000";
const TOKEN_KEY = "token";

/* ---------- fetch 래퍼 ----------------------------------- */
async function api(path, body = null, method = "POST") {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("no-token");
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
  if (method !== "GET" && body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ---------- 로그인 ---------------------------------------- */
function Login({ onDone }) {
  const [id,  setId]  = useState("");
  const [key, setKey] = useState("");
  async function submit(e) {
    e.preventDefault();
    try {
      const r = await fetch(API + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: id, key }),
      });
      if (!r.ok) throw new Error();
      const { token } = await r.json();
      localStorage.setItem(TOKEN_KEY, token);
      onDone();
    } catch { alert("로그인 실패 (ID ≥3, 비번 open-sesame)"); }
  }
  return (
    <form onSubmit={submit} style={{ maxWidth: 300, margin: "40px auto" }}>
      <h3>Login</h3>
      <input value={id}  onChange={e=>setId(e.target.value)}  placeholder="ID"
             style={{ width:"100%", marginBottom:8 }} />
      <input value={key} onChange={e=>setKey(e.target.value)} placeholder="Key"
             type="password" style={{ width:"100%", marginBottom:8 }} />
      <button style={{ width:"100%" }}>Enter</button>
    </form>
  );
}

/* ---------- 메인 ----------------------------------------- */
export default function ChatPage() {
  const [ready,    setReady]    = useState(false);
  const [threads,  setThreads]  = useState([]);
  const [active,   setActive]   = useState(null);
  const [messages, setMessages] = useState([]);   // [{role,content,image,steps:[]}]
  const [input,    setInput]    = useState("");
  const [image,    setImage]    = useState(null);
  const [loading,  setLoading]  = useState(false);

  const bottomRef = useRef(null);
  const fileRef   = useRef(null);

  /* ---------- 초기 로드 ---------- */
  useEffect(()=>{
    if(!localStorage.getItem(TOKEN_KEY)) return;
    (async()=>{
      try{
        const list = await api("/threads",null,"GET");
        setThreads(list);
        if(list.length) openThread(list[0].id);
        setReady(true);
      }catch{ localStorage.removeItem(TOKEN_KEY); }
    })();
  },[]);

  /* ---------- 스크롤 하단 ---------- */
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  /* ---------- 파일 선택 ---------- */
  function handleFile(e){
    const f=e.target.files[0];
    if(!f) return setImage(null);
    const r=new FileReader();
    r.onload=()=>setImage(r.result);
    r.readAsDataURL(f);
  }

  /* ---------- 메시지 전송 (스트리밍) ---------- */
  async function send(e){
    e.preventDefault();
    if(!active) return alert("대화방을 먼저 선택하세요.");
    const q=input.trim();
    if(!q && !image) return;
    setInput("");

    // UI 선반영
    setMessages(p=>[
      ...p,
      { role:"user", content:q, image },
      { role:"assistant", content:"", steps:[] }
    ]);
    setImage(null); if(fileRef.current) fileRef.current.value="";
    setLoading(true);

    try{
      const res = await fetch(API+"/chat/stream",{
        method:"POST", cache:"no-store",
        headers:{ "Content-Type":"application/json",
                  Authorization:`Bearer ${localStorage.getItem(TOKEN_KEY)}` },
        body:JSON.stringify({ thread_id:active, question:q, image })
      });
      if(!res.ok) throw new Error("stream_error");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while(true){
        const {value,done}=await reader.read();
        if(done) break;
        buf += decoder.decode(value,{stream:true});
        const lines = buf.split("\n");
        buf = lines.pop();

        for(const ln of lines){
          if(ln.startsWith("[STEP]")){
            const s = ln.replace("[STEP] ","");
            setMessages(p=>{ const c=[...p]; c[c.length-1].steps.push(s); return c; });
          }else if(ln.startsWith("[OBS]")){
            const s = ln.replace("[OBS] ","");
            setMessages(p=>{ const c=[...p]; c[c.length-1].steps.push("🔎 "+s); return c; });
          }else if(ln==="[DONE]"){
            /* 완료 마커 – 무시 */
          }else{
            setMessages(p=>{
              const c=[...p]; c[c.length-1].content += ln; return c;
            });
          }
        }
      }
    }catch(err){
      console.error(err);
      setMessages(p=>[...p,{ role:"assistant", content:"⚠️ 스트리밍 오류" }]);
    }finally{ setLoading(false); }
  }

  /* ---------- Thread helpers (new / rename / delete / open / logout) ---------- */
  async function newThread(){
    const r = await api("/threads");
    setThreads(p=>[{id:r.thread_id,title:r.title},...p]);
    openThread(r.thread_id);
  }
  async function renameThread(tid,title){
    const nt = prompt("대화방 이름", title);
    if(!nt) return;
    const { title:newT } = await api(`/threads/${tid}`,{title:nt},"PATCH");
    setThreads(p=>p.map(t=>t.id===tid?{...t,title:newT}:t));
  }
  async function delThread(tid){
    if(!confirm("삭제?")) return;
    await fetch(`${API}/threads/${tid}`,{
      method:"DELETE",
      headers:{ Authorization:`Bearer ${localStorage.getItem(TOKEN_KEY)}` },
    });
    const nxt = threads.filter(t=>t.id!==tid);
    setThreads(nxt);
    setActive(nxt[0]?.id||null);
    setMessages([]);
  }
  async function openThread(tid){
    setActive(tid); setMessages([]);
    const hist = await api(`/messages/${tid}`,null,"GET");
    setMessages(hist.map(m=>({...m,steps:[] })));
  }
  function logout(){
    localStorage.removeItem(TOKEN_KEY);
    setReady(false); setThreads([]); setActive(null); setMessages([]); setInput("");
  }

  /* ---------- 렌더 ---------- */
  if(!ready) return <Login onDone={()=>setReady(true)} />;

  return (
    <div style={{display:"flex",height:"100vh"}}>
      {/* 사이드바 */}
      <aside style={{width:220,borderRight:"1px solid #ddd",display:"flex",flexDirection:"column"}}>
        <div style={{padding:12,flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <button onClick={newThread} style={{width:"100%",marginBottom:12}}>+ 새 대화</button>
          <ul style={{listStyle:"none",padding:0,flex:1,overflowY:"auto"}}>
            {threads.map(th=>(
              <li key={th.id}
                  style={{
                    padding:6,display:"flex",justifyContent:"space-between",
                    background:th.id===active?"var(--theme-light)":"transparent",
                    cursor:"pointer"
                  }}
                  onClick={()=>openThread(th.id)}
                  onContextMenu={e=>{e.preventDefault();renameThread(th.id,th.title);}}>
                <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis"}}>{th.title}</span>
                <span style={{color:"red"}} onClick={e=>{e.stopPropagation();delThread(th.id);}}>×</span>
              </li>
            ))}
          </ul>
          <button onClick={logout} style={{marginTop:12,width:"100%"}}>로그아웃</button>
        </div>
      </aside>

      {/* 채팅 영역 */}
      <div style={{flex:1,display:"flex",flexDirection:"column",background:"#f7f7f7"}}>
        <main style={{flex:1,overflowY:"auto",padding:16}}>
          {messages.map((m,i)=>(
            <Msg key={i} role={m.role} text={m.content} image={m.image} steps={m.steps}/>
          ))}
          <div ref={bottomRef}/>
        </main>

        {/* 입력창 */}
        <form onSubmit={send} style={{
          position:"sticky",bottom:0,background:"#f7f7f7",
          display:"flex",alignItems:"center",borderTop:"1px solid #ddd",padding:"6px 0"
        }}>
          {/* 업로드 미리보기 */}
          {image && (
            <div style={{display:"flex",alignItems:"center",gap:4,marginLeft:8}}>
              <img src={image} style={{height:28,borderRadius:4}} alt="sel"/>
              <button type="button" onClick={()=>setImage(null)}
                      style={{background:"transparent",border:"none",cursor:"pointer",fontSize:18}}>✕</button>
            </div>
          )}

          {/* 첨부 버튼 */}
          <button type="button" title="Attach image"
                  onClick={()=>fileRef.current?.click()}
                  style={{background:"transparent",border:"none",fontSize:24,margin:"0 8px",cursor:"pointer"}}>
            📎
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>

          <input value={input} onChange={e=>setInput(e.target.value)}
                 placeholder="메시지…" style={{flex:1,padding:8}}/>
          <button disabled={loading}
                  style={{width:60,fontSize:24,background:"transparent",border:"none",cursor:"pointer"}}>
            {loading?"…":"➤"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- 메시지 버블 ---------- */
function Msg({ role, text, image, steps=[] }){
  const isUser = role==="user";
  return (
    <div style={{display:"flex",justifyContent:isUser?"flex-end":"flex-start",marginBottom:8}}>
      <div style={{
        maxWidth:"70%",padding:"8px 12px",borderRadius:6,
        background:isUser?"#d4d4d8":"#ffffff",
        whiteSpace:"pre-wrap"
      }}>
        {text}
        {image && <img src={image} alt="img" style={{display:"block",maxWidth:"100%",marginTop:4}} />}
        {!isUser && steps.length>0 && (
          <details style={{marginTop:4,fontSize:12}}>
            <summary style={{cursor:"pointer"}}>⚙️ 중간 과정</summary>
            <ul style={{margin:0,paddingLeft:16}}>
              {steps.map((s,i)=><li key={i}>{s}</li>)}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}