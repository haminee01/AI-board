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
      className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-blue-200 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-sm sm:bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-none"
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
                ? "bg-blue-600 text-white"
                : "text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}
