import { create } from "zustand";

export interface LineData {
  points: number[];
  color: string;
}

export interface CursorData {
  x: number;
  y: number;
  color: string;
  displayName?: string;
}

export interface MindmapNode {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface BoardState {
  lines: LineData[];
  cursors: Record<string, CursorData>;
  textNodes: MindmapNode[];
  setLines: (lines: LineData[]) => void;
  addLine: (line: LineData) => void;
  setCursor: (clientId: string, cursor: CursorData | null) => void;
  addMindmapNodes: (nodes: MindmapNode[]) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  lines: [],
  cursors: {},
  textNodes: [],
  setLines: (lines) => set({ lines }),
  addLine: (line) => set((state) => ({ lines: [...state.lines, line] })),
  setCursor: (clientId, cursor) =>
    set((state) => {
      const next = { ...state.cursors };
      if (cursor) next[clientId] = cursor;
      else delete next[clientId];
      return { cursors: next };
    }),
  addMindmapNodes: (nodes) =>
    set((state) => ({
      textNodes: [...state.textNodes, ...nodes],
    })),
}));
