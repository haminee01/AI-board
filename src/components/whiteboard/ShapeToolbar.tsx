"use client";

import { useBoardStore } from "@/stores/useBoardStore";
import type { ShapeType } from "@/stores/useBoardStore";

const SHAPES: { type: ShapeType; label: string }[] = [
  { type: "rect", label: "사각형" },
  { type: "triangle", label: "세모" },
  { type: "ellipse", label: "원" },
];

function IconRect({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function IconTriangle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 22h20L12 2z" />
    </svg>
  );
}

function IconEllipse({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

const SHAPE_ICONS: Record<
  ShapeType,
  React.ComponentType<{ className?: string }>
> = {
  rect: IconRect,
  triangle: IconTriangle,
  ellipse: IconEllipse,
};

export function ShapeToolbar() {
  const tool = useBoardStore((s) => s.tool);
  const setTool = useBoardStore((s) => s.setTool);

  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-sm"
      role="toolbar"
      aria-label="도형 선택"
    >
      {SHAPES.map(({ type, label }) => {
        const Icon = SHAPE_ICONS[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => setTool(type)}
            title={label}
            className={`rounded-lg p-2.5 transition-colors ${
              tool === type
                ? "bg-indigo-100 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}
