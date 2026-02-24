import { WhiteboardCanvasWrapper } from "@/components/whiteboard/WhiteboardCanvasWrapper";
import { MindmapInput } from "@/components/whiteboard/MindmapInput";
import { WhiteboardRealtimeProvider } from "@/contexts/WhiteboardRealtimeContext";
import { Header } from "@/components/layout/Header";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <WhiteboardRealtimeProvider>
        <section className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 shrink-0">
          <MindmapInput />
        </section>
        <section className="flex-1 overflow-hidden">
          <WhiteboardCanvasWrapper />
        </section>
      </WhiteboardRealtimeProvider>
    </main>
  );
}
