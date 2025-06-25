# backend/main.py  ────────────────  (Streaming, 즉시 플러시)
# streaming처리까지 완료된 버전 (front app2와 호환)
import os, uuid, datetime as dt, hmac, hashlib, base64, time
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, DateTime, ForeignKey, select, delete
from sqlalchemy.orm import Session, declarative_base, sessionmaker, relationship
from dotenv import load_dotenv, find_dotenv
import asyncio, aiosqlite
import nest_asyncio
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

# ── LangChain / LangGraph ─────────────────────────────────────────────
from openai import OpenAI
from langchain_openai import ChatOpenAI
from langchain.agents import tool
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_tavily import TavilySearch
from langchain_experimental.tools.python.tool import PythonREPLTool
from graphparser.rag_tool import make_rag_tool
import operator
from typing import Sequence, Annotated
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage

# ── 기본 설정 ─────────────────────────────────────────────────────────
load_dotenv(find_dotenv())
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SECRET         = os.getenv("APP_SECRET", "change-me")

if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY environment variable is missing. \n"
        "Set it in a `.env` file or export it before running the server."
    )

VECTOR_STORE1_ID = "vs_6822d7e1761881918b5ee78d3d689562"
VECTOR_STORE2_ID = "vs_6822d7e5e79881919418a3bea0987f89"

#####################################################################
# ── LangGraph 에이전트 ────────────────────────────────────────────────
#####################################################################
client = OpenAI(api_key=OPENAI_API_KEY)
llm    = ChatOpenAI(model="gpt-4.1-mini", temperature=0)
vision_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# 상태 정의
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]  # 메시지
    next: str  # 다음으로 라우팅할 에이전트

# 최대 5개의 검색 결과를 반환하는 Tavily 검색 도구 
tavily_tool=TavilySearch(max_results=5,topic="general",include_raw_content=True)
# 로컬에서 코드를 실행하는 Python REPL 도구 
python_repl_tool = PythonREPLTool()
# DB에서 정보를 검색하는 도구 (RAG_process를 여기다가 탑재)
rag_search_tool = make_rag_tool("RS")

@tool
def analyze_image(url: str, prompt: str) -> str:
    """Analyze the given image (URL or base64) with the prompt."""
    msg = HumanMessage(content=[
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": url}},
    ])
    return vision_llm.invoke([msg]).content

async def _init_saver(db_path: str = "lg.sqlite"):
    conn = await aiosqlite.connect(db_path)
    return AsyncSqliteSaver(conn)

try:
    # If we're in a fresh context with no running loop
    checkpointer = asyncio.run(_init_saver())
except RuntimeError:
    # Already inside an event loop (e.g., uvicorn --reload)
    nest_asyncio.apply()
    loop = asyncio.get_event_loop()
    checkpointer = loop.run_until_complete(_init_saver())

# Research Agent 생성
research_prompt="""
You are a **“research_agent”**.  
Your sole responsibility is to collect and organize information relevant to the user’s query using **only reliable, verifiable sources**.  
If you do not know the answer, state this explicitly.  
**All responses must be written in Korean.**

────────────────────────────────────────────
## Unified Guidelines  (DO NOT OMIT)

1. **Understand the Intent**  
   • Precisely grasp the context and scope of the question and why the user is asking it.

2. **Gather Trustworthy Information**  
   • Identify key terms.  
   • **Retrieval order:** always attempt **`rag_search_tool`** first; use **`web_search_tool`** only if the RAG search yields insufficient material.  
   • Search academic papers, government or official institutional websites, reputable databases, and major news outlets only.  
   • Prioritize recent, fact-checked data and cross-verify all facts.

3. **Present Information**  
   • **Use *only* the text contained in the retrieved `<document>` elements.**  
   • Provide content **verbatim from the source**—do **not** paraphrase, summarize, interpret, or add outside knowledge.  
   • Organize core information into coherent paragraphs; add concise tables only when they add clear value.  
   • If the answer is uncertain, clearly state **“모른다”** (“I don’t know”) or **“자료 부족”** (“Insufficient data”).  
   • Minimize hallucinations: generating any statement not present in the retrieved documents is strictly forbidden.

4. **Source Formatting**  
   • Begin every answer with:  
     `이 답변은 문서 **📚에서 발견된 내용을 기반으로 합니다`  
   • End with:  
     `**📌 출처**`  
     and list *all* sources in the form `- filename.pdf, page` (page numbers must be integers).  
   • **STRICT RULES FOR CITATIONS**  
     1) Use the **exact filename** from each `<source>` tag—never rename, translate, or invent filenames.  
     2) Use the **exact page number** (integer) from each `<page>` tag.  
     3) Cite **only** files and pages that actually occur in the retrieved context; inventing or extrapolating pages is forbidden.  
     4) If multiple `<document>` elements reference the same file and contiguous pages, you may combine them as a range (e.g., `8~9쪽`); otherwise list each page separately.  
     5) If a source appears multiple times, list it **once**.

5. **Language & Tone**  
   • Respond **entirely in Korean**.  
   • Avoid speculation or definitive claims without evidence; acknowledge uncertainty plainly.  
   • Be concise yet sufficiently detailed, eliminating unnecessary verbosity.

6. **Mandatory Elements**  
   1) Include all sources and page numbers exactly as described above.  
   2) Include tables only when relevant to the context.  
   3) Include image explanations if images appear in the source.  
   4) Provide the fullest detail possible within factual bounds.

────────────────────────────────────────────
## Directions (workflow checklist)

1. **Clarify** the question’s intent and scope.  
2. **Select** the most relevant content directly tied to the query.  
3. **Compose** a concise, logical answer using **only** the retrieved text, arranging citations so the text flows naturally.  
4. If no relevant material is found, reply: *‘내가 가지고 있는 자료에서 그 질문에 대한 답을 찾을 수 없다’*.  
5. Present any key points in a table when useful.  
6. Attach every citation with page numbers (see Source Formatting rules).  
7. Always answer in Korean.  
8. Provide maximum feasible detail.  
9. Start with the required header and finish with **📌 출처**.  
10. Page numbers must be integers.

────────────────────────────────────────────
## Example Answer  (template)

(brief summary of the answer)  
(include table if there is a table in the context related to the question)  
(include image explanation if there is an image in the context related to the question)  
(detailed answer to the question)

**📌 출처**  
[here you only write filename(.pdf only), page]  
- 파일명.pdf, 192쪽  
- 파일명.pdf, 193쪽  
- ...
"""
research_agent = create_react_agent(llm, tools=[rag_search_tool],prompt=research_prompt, name='research_agent')

# Coder Agent 
code_system_prompt = """
Be sure to use the following font in your code for visualization.
----------------------------------------------------------------
##### 폰트 설정 #####
import platform

# OS 판단
current_os = platform.system()

if current_os == "Windows":
    # Windows 환경 폰트 설정
    font_path = "C:/Windows/Fonts/malgun.ttf"  # 맑은 고딕 폰트 경로
    fontprop = fm.FontProperties(fname=font_path, size=12)
    plt.rc("font", family=fontprop.get_name())
elif current_os == "Darwin":  # macOS
    # Mac 환경 폰트 설정
    plt.rcParams["font.family"] = "AppleGothic"
else:  # Linux 등 기타 OS
    # 기본 한글 폰트 설정 시도
    try:
        plt.rcParams["font.family"] = "NanumGothic"
    except:
        print("한글 폰트를 찾을 수 없습니다. 시스템 기본 폰트를 사용합니다.")

##### 마이너스 폰트 깨짐 방지 #####
plt.rcParams["axes.unicode_minus"] = False  # 마이너스 폰트 깨짐 방지
"""

# Coder Agent 생성
coder_agent = create_react_agent(
    model=llm,
    tools=[python_repl_tool],
    prompt=code_system_prompt, 
    name = "coder_agent"
)


# Websearch Agent 생성
webserach_system_prompt="""
### SYSTEM PROMPT — “search_agent” (General-purpose Web Information Retrieval)

You are **“search_agent.”**  
Your role is to answer user questions that are *not* related to quality-engineering or reliability domain knowledge by using the web search tool **`tavily_search`.**  
Respond **in Korean** and always include explicit source links (URLs).

────────────────────────────────────────
## 1. Behaviour Guidelines

1. **Execute a Search**  
   • Rewrite the user’s question into a concise query sentence.  
   • Call **`tavily_search`** with these options:  
     `max_results=5`, `include_raw_content=True`.

2. **Filter & Validate**  
   • From the top results, keep those from trustworthy domains (government sites, respected news outlets, academic sources).  
   • Remove duplicate articles from the same domain.

3. **Compose the Answer**  
   • Summarise key facts in coherent paragraphs or numbered lists.  
   • Do not add any information that is absent from the retrieved results.  
   • If essential data is missing, explicitly state **“모른다”** or **“자료 부족.”**  
   • Quote numbers or statements exactly as they appear in the source.

4. **Cite Sources**  
   • Finish every answer with the header **“📌 출처.”**  
   • List each citation as a Markdown link:  
     `- [Title](URL)`

────────────────────────────────────────
## 2. Output Format (Example)

(Concise explanation of the answer)

**📌 출처**  
- [OECD Health Statistics – Life Expectancy](https://stats.oecd.org/Index.aspx?DataSetCode=HEALTH_STAT)  
- [WHO Fact Sheet: Air Pollution](https://www.who.int/news-room/fact-sheets/detail/ambient-(outdoor)-air-quality-and-health)

────────────────────────────────────────
## 3. Failure Handling

If no relevant information is found or critical details are missing, reply:  
**“내가 가지고 있는 검색 결과로는 답을 찾을 수 없다.”**
"""

websearcher_agent = create_react_agent(model= llm, tools=[tavily_tool], prompt=webserach_system_prompt, name='websearcher_agent')

from langgraph_supervisor import create_supervisor
app = create_supervisor(
    [research_agent, websearcher_agent, coder_agent],
    model=llm,
    prompt=(
        "You are the team supervisor. Your job is to orchestrate multiple specialist agents to achieve the user's goal.\n"
        "\n"
        "There are three subordinate agents you can delegate tasks to:\n"
        "• research_agent — use this when you need information in the reliability or quality‑engineering domain.\n"
        "• websearcher_agent — use this when you need up‑to‑date information such as breaking news or other recent web content.\n"
        "• coder_agent — use this when you need to write or execute code, do calculations, or create visualizations.\n"
        "\n"
        "Workflow rules:\n"
        "1. Decide which agent(s) to call and in what order.\n"
        "2. After an agent returns, carefully read its answer. **If the answer contains a citation or '📌 출처' block, you must preserve it verbatim in your final reply.**\n"
        "3. If an agent omits citations when they are required (e.g. research_agent answer without '📌 출처'), ask that agent once more for the sources, then include them.\n"
        "4. When you have enough information, reply to the user in Korean, keeping any citation block exactly as given (do not paraphrase or remove it).\n"
        "\n"
        "Always follow these rules. Never invent citations."
    ),
)
agent= app.compile(checkpointer=checkpointer)

# ── SQLite ORM ────────────────────────────────────────────────────────
Base   = declarative_base()
engine = create_engine("sqlite:///chat.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

class Thread(Base):
    __tablename__ = "threads"
    id       = Column(String, primary_key=True)
    user_id  = Column(String, index=True)
    title    = Column(String, default="새 대화")
    created  = Column(DateTime, default=dt.datetime.utcnow)
    messages = relationship("Message", cascade="all,delete")

class Message(Base):
    __tablename__ = "messages"
    id        = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    thread_id = Column(String, ForeignKey("threads.id"))
    role      = Column(String)   # "user" | "assistant"
    content   = Column(String)
    ts        = Column(DateTime, default=dt.datetime.utcnow)
    images    = relationship("MessageImage", cascade="all,delete", back_populates="message")


class MessageImage(Base):
    __tablename__ = "message_images"
    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String, ForeignKey("messages.id"))
    data       = Column(String)  # base64 encoded image
    message    = relationship("Message", back_populates="images")

Base.metadata.create_all(engine)

def get_db():
    db = SessionLocal()
    try:    yield db
    finally: db.close()

# ── 간단 토큰 util ------------------------------------------------------------
def sign(user: str) -> str:
    sig = hmac.new(SECRET.encode(), user.encode(), hashlib.sha256).digest()
    return f"{user}.{base64.urlsafe_b64encode(sig).decode()}"

def verify(tok: str) -> str:
    try:
        user, sig = tok.split(".")
        expect = base64.urlsafe_b64encode(
            hmac.new(SECRET.encode(), user.encode(), hashlib.sha256).digest()
        ).decode()
        if hmac.compare_digest(sig, expect):
            return user
    except Exception:
        ...
    raise HTTPException(401, "Invalid token")

def current_user(auth: str = Header(..., alias="Authorization")):
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Bearer required")
    return verify(auth.removeprefix("Bearer ").strip())

# ── FastAPI 앱 전역 -----------------------------------------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1) 로그인 --------------------------------------------------------------------
class LoginReq(BaseModel):
    user: str
    key: str

@app.post("/login")
def login(body: LoginReq):
    if body.key != "open-sesame" or len(body.user) < 3:
        raise HTTPException(401, "Bad credentials")
    return {"token": sign(body.user)}

# 2) Thread CRUD --------------------------------------------------------------
@app.post("/threads")
def new_thread(db: Session = Depends(get_db), user=Depends(current_user)):
    tid = str(uuid.uuid4())
    db.add(Thread(id=tid, user_id=user)); db.commit()
    return {"thread_id": tid, "title": "새 대화"}

@app.get("/threads", response_model=List[dict])
def list_threads(db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.scalars(select(Thread).where(Thread.user_id == user)).all()
    return [{"id": t.id, "title": t.title} for t in rows]

@app.patch("/threads/{tid}")
def rename_thread(tid: str, body: dict,
                  db: Session = Depends(get_db),
                  user=Depends(current_user)):
    new_title = body.get("title", "").strip()[:50] or "제목 없음"
    th = db.get(Thread, tid)
    if not th or th.user_id != user: raise HTTPException(404)
    th.title = new_title; db.commit()
    return {"ok": True, "title": new_title}

@app.delete("/threads/{tid}")
def delete_thread(tid: str, db: Session = Depends(get_db), user=Depends(current_user)):
    rows = db.execute(delete(Thread).where(Thread.id == tid,
                                           Thread.user_id == user)).rowcount
    if rows: db.commit(); return {"ok": True}
    raise HTTPException(404)

# 3) 메시지 조회 ---------------------------------------------------------------
@app.get("/messages/{tid}", response_model=List[dict])
def get_messages(tid: str, db: Session = Depends(get_db), user=Depends(current_user)):
    db.scalar(select(Thread).where(Thread.id == tid, Thread.user_id == user)) \
        or (_ for _ in ()).throw(HTTPException(404))
    q = db.scalars(select(Message).where(Message.thread_id == tid).order_by(Message.ts)).all()
    def to_dict(m):
        img = m.images[0].data if m.images else None
        return {"role": m.role, "content": m.content, "image": img}
    return [to_dict(m) for m in q]

# 4) 채팅 (완료 응답) ----------------------------------------------------------
class ChatReq(BaseModel):
    thread_id: str
    question: str
    image: Optional[str] = None

@app.post("/chat")
def chat(req: ChatReq, db: Session = Depends(get_db), user=Depends(current_user)):
    db.scalar(select(Thread).where(Thread.id == req.thread_id, Thread.user_id == user)) \
        or (_ for _ in ()).throw(HTTPException(404))

    human = HumanMessage(content=req.question)
    if req.image:
        human = HumanMessage(content=[
            {"type": "text", "text": req.question},
            {"type": "image_url", "image_url": {"url": req.image, "detail": "auto"}},
        ])
    state = {"messages": [human]}
    cfg   = RunnableConfig(configurable={"thread_id": req.thread_id})
    answer = agent.invoke(state, cfg)["messages"][-1].content

    user_msg = Message(thread_id=req.thread_id, role="user", content=req.question)
    if req.image:
        user_msg.images.append(MessageImage(data=req.image))
    db.add_all([
        user_msg,
        Message(thread_id=req.thread_id, role="assistant", content=answer),
    ]); db.commit()
    return {"role": "assistant", "content": answer}

# 5) 채팅 (글자 단위 스트리밍) -------------------------------------------------
@app.post("/chat/stream")
async def chat_stream(req: ChatReq, db: Session = Depends(get_db), user=Depends(current_user)):
    # ── 권한 확인 --------------------------------------------------------
    db.scalar(select(Thread).where(Thread.id == req.thread_id, Thread.user_id == user)) \
        or (_ for _ in ()).throw(HTTPException(404))

    # ── 입력 메시지 ------------------------------------------------------
    if req.image:
        human = HumanMessage(content=[
            {"type": "text", "text": req.question},
            {"type": "image_url", "image_url": {"url": req.image, "detail": "auto"}},
        ])
    else:
        human = HumanMessage(content=req.question)

    state = {"messages": [human]}
    cfg   = RunnableConfig(configurable={"thread_id": req.thread_id})

    # ── LangGraph 이벤트 스트리밍 --------------------------------------
    # ─── /chat/stream → gen() 파서 보강 ─────────
    async def gen():
        assistant = ""
        async for ev in agent.astream_events(state, cfg, version="v1"):
            if not isinstance(ev, dict):
                continue                      # 문자열 이벤트 무시
            t = ev.get("type") or ev.get("event")
            if t is None:
                continue
            if t == "on_tool_start":
                yield f"[STEP] 🔧 {ev['name']} 호출\n".encode()
            elif t == "on_tool_end":
                yield f"[OBS] {ev['output']}\n".encode()
            elif t == "on_llm_end":
                chunk = ev["output"]["choices"][0]["message"]["content"]
                assistant += chunk
                yield chunk.encode()

        # ── DB 기록 ----------------------------------------------------
        user_msg = Message(thread_id=req.thread_id, role="user", content=req.question)
        if req.image:
            user_msg.images.append(MessageImage(data=req.image))
        db.add_all([
            user_msg,
            Message(thread_id=req.thread_id, role="assistant", content=assistant),
        ])
        db.commit()
        yield b"[DONE]"

    return StreamingResponse(
        gen(),
        media_type="text/plain; charset=utf-8",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
        },
    )


