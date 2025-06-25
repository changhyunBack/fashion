// app/layout.js  (Next.js App Router 글로벌 레이아웃)

export const metadata = {
  title: "Simple AI Chat",
  description: "Next.js App Router + FastAPI backend",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      {/* 전역 배경색은 globals.css 에서 지정하므로 inline background 제거 */}
      <body style={{ margin: 0, fontFamily: "sans-serif" }}>
        {children}
      </body>
    </html>
  );
}