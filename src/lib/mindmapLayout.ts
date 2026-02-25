import type { MindmapNode } from "@/stores/useBoardStore";

/** 왼쪽 상단 그리드 배치용 상수 */
export const GRID_LEFT = 20;
export const GRID_TOP = 20;
export const BTN_WIDTH = 100;
export const BTN_HEIGHT = 28;
export const GAP = 8;
export const COLS = 5;

function generateId(): string {
  return `mindmap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 새 마인드맵 노드들을 그리드(왼쪽 상단, 사각 버튼 배치)로 배치합니다.
 * @param texts 노드 텍스트 배열
 * @param startIndex 기존 노드 개수(그리드 인덱스 시작)
 */
export function layoutMindmapNodes(
  texts: string[],
  startIndex: number
): MindmapNode[] {
  return texts.map((text, i) => {
    const index = startIndex + i;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    return {
      id: generateId(),
      text,
      x: GRID_LEFT + col * (BTN_WIDTH + GAP),
      y: GRID_TOP + row * (BTN_HEIGHT + GAP),
    };
  });
}
