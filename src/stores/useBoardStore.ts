import { create } from "zustand";

export interface LineData {
  id?: string;
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

export interface BoardContent {
  lines: LineData[];
  textNodes: MindmapNode[];
}

const MAX_UNDO = 50;

export type Tool = "pen" | "eraser";

interface BoardState {
  lines: LineData[];
  cursors: Record<string, CursorData>;
  textNodes: MindmapNode[];
  currentBoardId: string | null;
  tool: Tool;
  undoStack: BoardContent[];
  redoStack: BoardContent[];
  setLines: (lines: LineData[]) => void;
  addLine: (line: LineData) => void;
  removeLinesByIds: (ids: string[]) => void;
  setCursor: (clientId: string, cursor: CursorData | null) => void;
  addMindmapNodes: (nodes: MindmapNode[]) => void;
  setTextNodes: (nodes: MindmapNode[]) => void;
  setCurrentBoardId: (id: string | null) => void;
  setBoardContent: (content: BoardContent) => void;
  setTool: (tool: Tool) => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

function ensureLineIds(lines: LineData[]): LineData[] {
  return lines.map((line, i) =>
    line.id ? line : { ...line, id: `line-${Date.now()}-${i}` }
  );
}

export const useBoardStore = create<BoardState>((set, get) => ({
  lines: [],
  cursors: {},
  textNodes: [],
  currentBoardId: null,
  tool: "pen",
  undoStack: [],
  redoStack: [],
  setLines: (lines) =>
    set({ lines: ensureLineIds(lines), redoStack: [] }),
  addLine: (line) =>
    set((state) => ({
      lines: [...state.lines, { ...line, id: line.id ?? `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }],
      redoStack: [],
    })),
  removeLinesByIds: (ids) =>
    set((state) => {
      const set = new Set(ids);
      return {
        lines: state.lines.filter((l) => !set.has(l.id ?? "")),
        redoStack: [],
      };
    }),
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
  setTextNodes: (nodes) => set({ textNodes: nodes }),
  setCurrentBoardId: (id) => set({ currentBoardId: id }),
  setBoardContent: (content) =>
    set({
      lines: ensureLineIds(content.lines),
      textNodes: content.textNodes,
      redoStack: [],
    }),
  setTool: (tool) => set({ tool }),
  pushUndo: () =>
    set((state) => {
      const snapshot: BoardContent = {
        lines: state.lines,
        textNodes: state.textNodes,
      };
      const next = state.undoStack.slice(-(MAX_UNDO - 1));
      next.push(snapshot);
      return { undoStack: next };
    }),
  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state;
      const redoSnapshot: BoardContent = {
        lines: state.lines,
        textNodes: state.textNodes,
      };
      const snapshot = state.undoStack[state.undoStack.length - 1]!;
      return {
        lines: snapshot.lines,
        textNodes: snapshot.textNodes,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, redoSnapshot],
      };
    }),
  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state;
      const undoSnapshot: BoardContent = {
        lines: state.lines,
        textNodes: state.textNodes,
      };
      const snapshot = state.redoStack[state.redoStack.length - 1]!;
      return {
        lines: snapshot.lines,
        textNodes: snapshot.textNodes,
        undoStack: [...state.undoStack, undoSnapshot],
        redoStack: state.redoStack.slice(0, -1),
      };
    }),
}));
