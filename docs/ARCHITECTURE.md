# AI 실시간 협업 화이트보드 — 아키텍처

## 1. 기술 스택 역할

| 구분      | 기술                                 | 역할                                             |
| --------- | ------------------------------------ | ------------------------------------------------ |
| Framework | Next.js 15 (App Router) + TypeScript | SSR/정적, 라우팅, API Routes 미사용 시 정적 배포 |
| Styling   | Tailwind CSS + Lucide React          | UI 및 아이콘                                     |
| 로컬 상태 | Zustand                              | 캔버스 도형, 마우스 좌표 등 휘발성 상태 (60fps)  |
| 서버 상태 | TanStack React Query                 | 유저 정보, 보드 목록 등 Supabase 데이터 동기화   |
| BaaS      | Supabase                             | Auth, Database, Realtime (WebSocket 대체)        |
| 인프라    | Docker + Nginx                       | 정적 빌드 결과 서빙 및 리버스 프록시             |

## 2. 데이터 흐름

```
[Client] → 그리기/도형 변경
    ↓
[Zustand] → 즉시 로컬 UI 반영 (60fps)
    ↓
[Supabase Realtime] → 다른 접속자에게 브로드캐스트
    ↓
[React Query + Supabase DB] → 작업 완료 시 최종 보드 상태 저장/관리
```

## 3. 프로젝트 구조

```
src/
├── app/              # App Router 페이지
├── components/       # UI 컴포넌트 (providers, 캔버스 등)
├── lib/              # Supabase 클라이언트 등 유틸
├── stores/           # Zustand 스토어 (whiteboard 등)
└── hooks/            # useRealtimeWhiteboard — Realtime 구독·브로드캐스트
```

## 4. Supabase 설정 체크리스트

- [ ] Project 생성 후 API URL, Anon Key를 `.env.local`에 설정
- [ ] Realtime: Dashboard → Database → Replication → 실시간 사용할 테이블 활성화
- [ ] Auth: 소셜 로그인(Google/GitHub 등) 설정

## 5. Docker 배포 시 주의사항

- 정적 배포를 위해 `next.config.ts`에서 `output: "export"`를 **주석 해제**한 뒤 빌드.
- 빌드 시 환경 변수 전달 예시:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -t ai-whiteboard .
docker run -p 80:80 ai-whiteboard
```
