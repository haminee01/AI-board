"use client";

import { useBoardStore } from "@/stores/useBoardStore";
import type { Tool } from "@/stores/useBoardStore";

const TOOL_BTNS: { id: Tool; label: string }[] = [
  { id: "pen", label: "펜" },
  { id: "highlighter", label: "형광팬" },
  { id: "eraser", label: "지우개" },
  { id: "text", label: "텍스트" },
];

export function ToolToggle() {
  const tool = useBoardStore((s) => s.tool);
  const setTool = useBoardStore((s) => s.setTool);

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-blue-200 p-0.5">
      {TOOL_BTNS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTool(id)}
          data-color-menu-target={
            id === "pen" || id === "highlighter" ? id : undefined
          }
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 sm:text-sm ${
            tool === id
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
