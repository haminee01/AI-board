import { WhiteboardCanvasWrapper } from "@/components/whiteboard/WhiteboardCanvasWrapper";
import { BoardToolbar } from "@/components/whiteboard/BoardToolbar";
import { ToolToggle } from "@/components/whiteboard/ToolToggle";
import { WhiteboardRealtimeProvider } from "@/contexts/WhiteboardRealtimeContext";
import { Header } from "@/components/layout/Header";
import { AnonymousBoardReset } from "@/components/whiteboard/AnonymousBoardReset";
import { MindmapGeneratorLauncher } from "@/components/whiteboard/MindmapGeneratorLauncher";

export default function HomePage() {
  return (
    <main className="flex min-h-0 min-h-[100dvh] flex-col">
      <Header />
      <WhiteboardRealtimeProvider>
        <AnonymousBoardReset />
        <section className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:gap-3 sm:px-4">
          <ToolToggle />
          <BoardToolbar />
          <MindmapGeneratorLauncher />
          <span className="text-xs text-slate-400"></span>
        </section>
        <section className="min-h-0 flex-1 overflow-hidden">
          <WhiteboardCanvasWrapper />
        </section>
      </WhiteboardRealtimeProvider>
    </main>
  );
}
