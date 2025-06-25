// app/api/chat/route.js  (Next.js edge/server route → FastAPI 프록시)

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

export async function POST(req) {
  const { thread_id, question, image } = await req.json() || {};

  // 1) 토큰: 쿠키 → 헤더
  const cookieToken = cookies().get("token")?.value;
  const headerAuth  = req.headers.get("authorization");
  const headerToken = headerAuth?.replace(/^Bearer\s+/i, "");
  const token       = cookieToken || headerToken;

  if (!token)
    return NextResponse.json({ error: "no token" }, { status: 401 });

  // 2) FastAPI로 프록시 (환경변수 사용)
  const backend = process.env.NEXT_PUBLIC_API || "http://localhost:8000";
  const res = await fetch(`${backend}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ thread_id, question, image }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
