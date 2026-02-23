import { WhiteboardCanvasWrapper } from "@/components/whiteboard/WhiteboardCanvasWrapper";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="h-12 flex items-center px-4 border-b border-slate-200 bg-white shrink-0">
        <h1 className="text-lg font-semibold text-slate-800">
          AI 실시간 협업 화이트보드
        </h1>
        <span className="ml-2 text-sm text-slate-500">— 드래그로 선 그리기</span>
      </header>
      <section className="flex-1 overflow-hidden">
        <WhiteboardCanvasWrapper />
      </section>
    </main>
  );
}
