"use client";

import { useBoardStore } from "@/stores/useBoardStore";

export function ToolToggle() {
  const tool = useBoardStore((s) => s.tool);
  const setTool = useBoardStore((s) => s.setTool);

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-300 p-0.5">
      <button
        type="button"
        onClick={() => setTool("pen")}
        className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
          tool === "pen"
            ? "bg-slate-800 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        펜
      </button>
      <button
        type="button"
        onClick={() => setTool("eraser")}
        className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
          tool === "eraser"
            ? "bg-slate-800 text-white"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        지우개
      </button>
    </div>
  );
}
