import { create } from "zustand";

export interface LineData {
  points: number[];
  color: string;
}

interface BoardState {
  lines: LineData[];
  setLines: (lines: LineData[]) => void;
  addLine: (line: LineData) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  lines: [],
  setLines: (lines) => set({ lines }),
  addLine: (line) => set((state) => ({ lines: [...state.lines, line] })),
}));
