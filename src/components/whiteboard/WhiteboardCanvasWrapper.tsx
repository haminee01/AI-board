"use client";

import dynamic from "next/dynamic";
import { ShapeToolbar } from "./ShapeToolbar";

const WhiteboardCanvas = dynamic(
  () =>
    import("./WhiteboardCanvas").then((m) => ({ default: m.WhiteboardCanvas })),
  { ssr: false },
);

export function WhiteboardCanvasWrapper() {
  return (
    <div className="relative w-full h-full">
      <WhiteboardCanvas />
      <ShapeToolbar />
    </div>
  );
}
