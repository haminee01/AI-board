import { create } from "zustand";

/**
 * 캔버스 내부 실시간 도형/마우스 등 휘발성 로컬 상태 (Zustand)
 * - 60fps 유지 목적, Supabase Realtime과 연동 예정
 */
export interface Shape {
  id: string;
  type: "rect" | "circle" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
}

interface WhiteboardState {
  shapes: Shape[];
  mousePosition: { x: number; y: number } | null;
  addShape: (shape: Shape) => void;
  setMousePosition: (pos: { x: number; y: number } | null) => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set) => ({
  shapes: [],
  mousePosition: null,
  addShape: (shape) => set((s) => ({ shapes: [...s.shapes, shape] })),
  setMousePosition: (mousePosition) => set({ mousePosition }),
}));
