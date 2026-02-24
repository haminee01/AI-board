# AI 실시간 협업 화이트보드

Next.js 15 + Supabase 기반 프론트엔드 중심 협업 화이트보드 (1~3단계: 환경 + Zustand/Konva 드로잉 + Realtime 동기화)

## 기술 스택

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + Lucide React
- **상태:** Zustand (캔버스/로컬), TanStack React Query (서버 데이터)
- **BaaS:** Supabase (Auth, DB, Realtime)
- **배포:** Docker + Nginx

## 사전 요구사항

- Node.js 20+
- (선택) Docker

## 로컬 실행

```bash
# 프로젝트 폴더에서
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

## 환경 변수

`.env.local`에 Supabase 키 설정 (이미 예시 값 포함):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon(공개) 키
- `OPENAI_API_KEY` — AI 마인드맵 생성용 (OpenAI API 키, 서버 전용)

Supabase 대시보드 → Project Settings → API에서 확인. OpenAI 키는 [platform.openai.com](https://platform.openai.com)에서 발급.

## Docker 빌드 (정적 배포)

AI 마인드맵은 API Route를 사용하므로 **정적 export 시 해당 기능은 동작하지 않습니다.** API를 쓰려면 `output: "export"` 없이 `next build` + `next start` 또는 Node 서버로 배포하세요.

정적만 배포할 때: `next.config.ts`에서 `output: "export"` 주석 해제 후:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -t ai-whiteboard .
docker run -p 80:80 ai-whiteboard
```

## 구현 현황

- **1단계:** Next.js 15, Tailwind, Zustand, React Query, Supabase, Docker/Nginx 세팅
- **2단계:** `useBoardStore`(선 데이터) + react-konva 캔버스 — 마우스 드래그로 선 그리기
- **2.5:** Supabase 클라이언트 singleton (`src/lib/supabase.ts`)
- **3단계:** Supabase Realtime Broadcast — 그린 선을 다른 탭/참여자에게 실시간 동기화 (`useRealtimeWhiteboard`)
- **AI 마인드맵:** 키워드 입력 → `POST /api/ai/mindmap` (OpenAI) → 캔버스에 텍스트 노드 추가 + Realtime으로 공유

## 문서

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 아키텍처 및 데이터 흐름
