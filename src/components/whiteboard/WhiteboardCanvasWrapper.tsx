"use client";

import dynamic from "next/dynamic";

const WhiteboardCanvas = dynamic(
  () => import("./WhiteboardCanvas").then((m) => ({ default: m.WhiteboardCanvas })),
  { ssr: false }
);

export function WhiteboardCanvasWrapper() {
  return <WhiteboardCanvas />;
}
