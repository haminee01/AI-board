import { WhiteboardCanvasWrapper } from "@/components/whiteboard/WhiteboardCanvasWrapper";
import { MindmapInput } from "@/components/whiteboard/MindmapInput";
import { BoardToolbar } from "@/components/whiteboard/BoardToolbar";
import { ToolToggle } from "@/components/whiteboard/ToolToggle";
import { WhiteboardRealtimeProvider } from "@/contexts/WhiteboardRealtimeContext";
import { Header } from "@/components/layout/Header";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <WhiteboardRealtimeProvider>
        <section className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 shrink-0">
          <ToolToggle />
          <BoardToolbar />
          <MindmapInput />
          <span className="text-xs text-slate-400">Ctrl+Z 실행 취소 · Ctrl+Shift+Z 다시 실행</span>
        </section>
        <section className="flex-1 overflow-hidden">
          <WhiteboardCanvasWrapper />
        </section>
      </WhiteboardRealtimeProvider>
    </main>
  );
}
