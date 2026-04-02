"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Stage,
  Layer,
  Line,
  Rect,
  Ellipse,
  Circle,
  Text,
  Group,
} from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "@/stores/useBoardStore";
import type {
  DiscussionComment,
  MindmapNode,
  ShapeData,
  ShapeType,
} from "@/stores/useBoardStore";
import { useWhiteboardRealtime } from "@/contexts/WhiteboardRealtimeContext";
import { useAuth } from "@/lib/auth/auth-context";
import {
  distancePointToSegment,
  getLineBoundingBox,
  pointInEllipse,
  pointInRect,
  pointInTriangle,
  rectsIntersect,
} from "@/lib/geometry";
import { BTN_WIDTH, BTN_HEIGHT } from "@/lib/mindmapLayout";
import { useMindmapGeneratorModalStore } from "@/stores/useMindmapGeneratorModalStore";

const STROKE_COLOR = "#1e293b";
const STROKE_WIDTH = 2;
const HIGHLIGHTER_STROKE_COLOR = "#fde047";
const HIGHLIGHTER_STROKE_WIDTH = 16;
const HIGHLIGHTER_OPACITY = 0.45;
const FREETEXT_FONT_SIZE = 16;
const NOTE_PADDING_X = 12;
const NOTE_PADDING_Y = 10;
const NOTE_MIN_WIDTH = 120;
const NOTE_MIN_HEIGHT = 48;
const CURSOR_RADIUS = 6;
const ERASER_RADIUS = 24;
/** 보기 줌 (손가락/트랙패드) */
const VIEW_SCALE_MIN = 0.12;
const VIEW_SCALE_MAX = 8;
/** 두 손가락 거리 변화가 이보다 작으면 줌 없이 이동(팬)만 처리 */
const TWO_FINGER_ZOOM_INTENT_EPS = 0.007;
/** 선택된 선 위에서 드래그 시작할 때 인식 반경 */
const MOVE_HIT_RADIUS = 12;
const PEN_COLOR_PRESETS = [
  "#1e293b",
  "#0f172a",
  "#ef4444",
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#111827",
];
const HIGHLIGHTER_COLOR_PRESETS = [
  "#fde047",
  "#facc15",
  "#86efac",
  "#67e8f9",
  "#93c5fd",
  "#c4b5fd",
  "#f9a8d4",
  "#fdba74",
];

function cursorLabel(name: string): string {
  return name.includes("@") ? name.split("@")[0]! : name;
}

function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateFreeTextId(): string {
  return `freetext-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateCommentId(): string {
  return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateReplyId(): string {
  return `reply-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getNoteSize(
  text: string,
  fontSize: number,
): { width: number; height: number } {
  const lines = (text || "").split("\n");
  const maxLine = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const width = Math.max(
    NOTE_MIN_WIDTH,
    maxLine * fontSize * 0.56 + NOTE_PADDING_X * 2,
  );
  const height = Math.max(
    NOTE_MIN_HEIGHT,
    lines.length * fontSize * 1.45 + NOTE_PADDING_Y * 2,
  );
  return { width, height };
}

function getTextNodeBounds(n: MindmapNode): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (n.kind === "freetext") {
    const fs = n.fontSize ?? FREETEXT_FONT_SIZE;
    const { width: w, height: h } = getNoteSize(n.text, fs);
    return { minX: n.x, minY: n.y, maxX: n.x + w, maxY: n.y + h };
  }
  return {
    minX: n.x,
    minY: n.y,
    maxX: n.x + BTN_WIDTH,
    maxY: n.y + BTN_HEIGHT,
  };
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** 컨텍스트/색 메뉴가 뷰포트 밖으로 나가지 않도록 고정 좌표 보정 */
function clampFixedMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
): { left: number; top: number } {
  if (typeof window === "undefined") return { left: clientX, top: clientY };
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    left: clamp(clientX, pad, Math.max(pad, vw - menuWidth - pad)),
    top: clamp(clientY, pad, Math.max(pad, vh - menuHeight - pad)),
  };
}

export function WhiteboardCanvas() {
  const { user } = useAuth();
  const {
    lines,
    cursors,
    textNodes,
    shapes,
    tool,
    addLine,
    addShape,
    updateLine,
    removeLinesByIds,
    removeShapesByIds,
    updateShape,
    setTextNodes,
    addMindmapNodes,
    updateTextNode,
    pushUndo,
    undo,
    redo,
  } = useBoardStore();
  const {
    broadcastLine,
    broadcastCursor,
    broadcastRemoveLines,
    broadcastUpdateLine,
    broadcastShape,
    broadcastRemoveShapes,
    broadcastUpdateShape,
    broadcastMindmapNodes,
    broadcastUpdateTextNode,
    broadcastRemoveMindmapNode,
    clearMyCursor,
  } = useWhiteboardRealtime();
  const openMindmapModal = useMindmapGeneratorModalStore((s) => s.open);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  /** Shift+드래그로 선택된 선 id 목록 */
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  /** Shift+드래그로 선택된 도형 id 목록 */
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  /** Shift+드래그로 선택된 텍스트 노드 id (자유 텍스트·마인드맵 버튼) */
  const [selectedTextNodeIds, setSelectedTextNodeIds] = useState<string[]>([]);
  type TextEditorState =
    | {
        mode: "new";
        stageX: number;
        stageY: number;
      }
    | { mode: "edit"; nodeId: string };
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [draftText, setDraftText] = useState("");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState(false);
  const [editingNoteDraft, setEditingNoteDraft] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [replyTargetCommentId, setReplyTargetCommentId] = useState<
    string | null
  >(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingReplyKey, setEditingReplyKey] = useState<string | null>(null);
  const [editingReplyDraft, setEditingReplyDraft] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const skipTextEditorBlurCommitRef = useRef(false);
  /** Shift+드래그 중인 선택 영역 (x1,y1 시작점, x2,y2 현재 커서) */
  const [selectionRect, setSelectionRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  /** 우클릭 메뉴: { x, y, node } 또는 null */
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: MindmapNode;
  } | null>(null);
  const [colorMenu, setColorMenu] = useState<{
    x: number;
    y: number;
    target: "pen" | "highlighter";
  } | null>(null);
  const [penColor, setPenColor] = useState(STROKE_COLOR);
  const [highlighterColor, setHighlighterColor] = useState(
    HIGHLIGHTER_STROKE_COLOR,
  );
  const [hoveredMindmapNodeId, setHoveredMindmapNodeId] = useState<
    string | null
  >(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  /** 화면에 보이는 줌·팬 (스테이지 transform; 그리기 좌표계는 그대로) */
  const [viewScale, setViewScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  viewRef.current = { scale: viewScale, x: viewPos.x, y: viewPos.y };
  /** 두 손가락 핀치 중 (한 프레임 이상) */
  const pinchRef = useRef<{
    lastDist: number;
    lastMidX: number;
    lastMidY: number;
  } | null>(null);
  /** 가운데 버튼(휠 클릭) 드래그로 화면 이동 */
  const isMiddlePanningRef = useRef(false);
  const lastMiddlePanClientRef = useRef<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const middlePanWindowCleanupRef = useRef<(() => void) | null>(null);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  /** 마인드맵 버튼 위에서 mousedown 했을 때 해당 노드 (클릭 완료 시 2단계 생성용) */
  const mouseDownMindmapNodeRef = useRef<MindmapNode | null>(null);
  const isDrawing = useRef(false);
  const isDrawingShapeRef = useRef(false);
  const shapeStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draftShape, setDraftShape] = useState<{
    type: ShapeType;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const draftShapeRef = useRef<typeof draftShape>(null);
  draftShapeRef.current = draftShape;
  const isErasing = useRef(false);
  const eraserPushedUndo = useRef(false);
  const currentPointsRef = useRef<number[]>([]);
  currentPointsRef.current = currentPoints;
  const isSelectingRef = useRef(false);
  const isMovingSelectionRef = useRef(false);
  const movingOriginalPointsByLineIdRef = useRef<Record<string, number[]>>({});
  const movingOriginalShapesByIdRef = useRef<
    Record<string, { x: number; y: number }>
  >({});
  const movingOriginalTextByIdRef = useRef<
    Record<string, { x: number; y: number }>
  >({});
  const movingStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectionRectRef = useRef<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  selectionRectRef.current = selectionRect;
  const selectedLineIdsRef = useRef<string[]>([]);
  const selectedShapeIdsRef = useRef<string[]>([]);
  selectedLineIdsRef.current = selectedLineIds;
  selectedShapeIdsRef.current = selectedShapeIds;
  const selectedTextNodeIdsRef = useRef<string[]>([]);
  selectedTextNodeIdsRef.current = selectedTextNodeIds;

  const findLineIdsUnder = useCallback((x: number, y: number): string[] => {
    const ids: string[] = [];
    const linesSnapshot = useBoardStore.getState().lines;
    for (const line of linesSnapshot) {
      const pts = line.points;
      for (let i = 0; i < pts.length - 2; i += 2) {
        const d = distancePointToSegment(
          x,
          y,
          pts[i]!,
          pts[i + 1]!,
          pts[i + 2]!,
          pts[i + 3]!,
        );
        if (d <= ERASER_RADIUS && line.id) {
          ids.push(line.id);
          break;
        }
      }
    }
    return ids;
  }, []);

  /** 커서 아래 맨 위에 있는 선 하나의 id 반환 (선택된 선 위에서 이동 시작 판별용) */
  const findLineIdAt = useCallback(
    (x: number, y: number): string | undefined => {
      const linesSnapshot = useBoardStore.getState().lines;
      for (let idx = linesSnapshot.length - 1; idx >= 0; idx--) {
        const line = linesSnapshot[idx]!;
        const pts = line.points;
        for (let i = 0; i < pts.length - 2; i += 2) {
          const d = distancePointToSegment(
            x,
            y,
            pts[i]!,
            pts[i + 1]!,
            pts[i + 2]!,
            pts[i + 3]!,
          );
          if (d <= MOVE_HIT_RADIUS && line.id) return line.id;
        }
      }
      return undefined;
    },
    [],
  );

  /** 선택 사각형 안과 겹치는 선 id 목록 반환. Shift+클릭(거의 점)이면 커서 근처 선 선택 */

  /** 이벤트에서 stage(콘텐츠) 좌표 [x,y] — 줌/팬이 있어도 동일하게 보정 */
  const getStagePosFromEvent = useCallback(
    (
      stage: Konva.Stage | null,
      clientX: number,
      clientY: number,
    ): number[] | null => {
      if (!stage) return null;
      const content = stage.getContent();
      if (!content?.getBoundingClientRect) return null;
      const rect = content.getBoundingClientRect();
      const sx = rect.width / (content.clientWidth || rect.width) || 1;
      const sy = rect.height / (content.clientHeight || rect.height) || 1;
      const x = (clientX - rect.left) / sx;
      const y = (clientY - rect.top) / sy;
      const inv = stage.getAbsoluteTransform().copy().invert();
      const local = inv.point({ x, y });
      return [local.x, local.y];
    },
    [],
  );

  /** Konva 기본 getPointerPosition은 Stage 팬/줌을 반영하지 않음 → 월드 좌표로 통일 */
  const getPointerPosition = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const stage = e.target.getStage();
      const t = (e.evt as TouchEvent).touches?.[0];
      const cx = t?.clientX ?? (e.evt as MouseEvent).clientX;
      const cy = t?.clientY ?? (e.evt as MouseEvent).clientY;
      return getStagePosFromEvent(stage, cx, cy);
    },
    [getStagePosFromEvent],
  );

  /** stage 좌표 (x,y)가 마인드맵 버튼 안인 노드 반환 (마인드맵 전용) */
  const getMindmapNodeAtStagePos = useCallback(
    (stageX: number, stageY: number): MindmapNode | null => {
      const nodes = useBoardStore.getState().textNodes;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]!;
        if (n.kind === "freetext") continue;
        const b = getTextNodeBounds(n);
        if (
          pointInRect(
            stageX,
            stageY,
            b.minX,
            b.minY,
            b.maxX - b.minX,
            b.maxY - b.minY,
          )
        ) {
          return n;
        }
      }
      return null;
    },
    [],
  );

  const getEditableTextNodeAtStagePos = useCallback(
    (stageX: number, stageY: number): MindmapNode | null => {
      const nodes = useBoardStore.getState().textNodes;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]!;
        if (n.kind !== "freetext") continue;
        const b = getTextNodeBounds(n);
        if (
          pointInRect(
            stageX,
            stageY,
            b.minX,
            b.minY,
            b.maxX - b.minX,
            b.maxY - b.minY,
          )
        ) {
          return n;
        }
      }
      return null;
    },
    [],
  );

  const getMindmapNodeUnderPointer = useCallback(
    (
      e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
    ): MindmapNode | null => {
      const stage = e.target.getStage();
      const t = (e.evt as TouchEvent).touches?.[0];
      const cx = t?.clientX ?? (e.evt as MouseEvent).clientX;
      const cy = t?.clientY ?? (e.evt as MouseEvent).clientY;
      const pos = getStagePosFromEvent(stage, cx, cy);
      if (!pos || pos.length < 2) return null;
      return getMindmapNodeAtStagePos(pos[0], pos[1]);
    },
    [getStagePosFromEvent, getMindmapNodeAtStagePos],
  );

  const getLineIdsInRect = useCallback(
    (x1: number, y1: number, x2: number, y2: number): string[] => {
      let minX = Math.min(x1, x2);
      let maxX = Math.max(x1, x2);
      let minY = Math.min(y1, y2);
      let maxY = Math.max(y1, y2);
      if (maxX - minX < 4 && maxY - minY < 4) {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const pad = MOVE_HIT_RADIUS;
        minX = cx - pad;
        maxX = cx + pad;
        minY = cy - pad;
        maxY = cy + pad;
      }
      const sel = { minX, minY, maxX, maxY };
      const ids: string[] = [];
      const linesSnapshot = useBoardStore.getState().lines;
      for (const line of linesSnapshot) {
        if (!line.id || !line.points.length) continue;
        const box = getLineBoundingBox(line.points);
        if (rectsIntersect(sel, box)) ids.push(line.id);
      }
      return ids;
    },
    [],
  );

  const getShapeIdsInRect = useCallback(
    (x1: number, y1: number, x2: number, y2: number): string[] => {
      let minX = Math.min(x1, x2);
      let maxX = Math.max(x1, x2);
      let minY = Math.min(y1, y2);
      let maxY = Math.max(y1, y2);
      if (maxX - minX < 4 && maxY - minY < 4) {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const pad = MOVE_HIT_RADIUS;
        minX = cx - pad;
        maxX = cx + pad;
        minY = cy - pad;
        maxY = cy + pad;
      }
      const sel = { minX, minY, maxX, maxY };
      const ids: string[] = [];
      const shapesSnapshot = useBoardStore.getState().shapes;
      for (const shape of shapesSnapshot) {
        if (!shape.id) continue;
        const box = {
          minX: shape.x,
          minY: shape.y,
          maxX: shape.x + shape.width,
          maxY: shape.y + shape.height,
        };
        if (rectsIntersect(sel, box)) ids.push(shape.id);
      }
      return ids;
    },
    [],
  );

  const getTextNodeIdsInRect = useCallback(
    (x1: number, y1: number, x2: number, y2: number): string[] => {
      let minX = Math.min(x1, x2);
      let maxX = Math.max(x1, x2);
      let minY = Math.min(y1, y2);
      let maxY = Math.max(y1, y2);
      if (maxX - minX < 4 && maxY - minY < 4) {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const pad = MOVE_HIT_RADIUS;
        minX = cx - pad;
        maxX = cx + pad;
        minY = cy - pad;
        maxY = cy + pad;
      }
      const sel = { minX, minY, maxX, maxY };
      const ids: string[] = [];
      const nodes = useBoardStore.getState().textNodes;
      for (const n of nodes) {
        if (!n.id) continue;
        const b = getTextNodeBounds(n);
        const box = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
        if (rectsIntersect(sel, box)) ids.push(n.id);
      }
      return ids;
    },
    [],
  );

  const findSelectedTextNodeIdAt = useCallback(
    (x: number, y: number, selectedIds: string[]): string | undefined => {
      if (selectedIds.length === 0) return undefined;
      const set = new Set(selectedIds);
      const nodes = useBoardStore.getState().textNodes;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]!;
        if (!set.has(n.id)) continue;
        const b = getTextNodeBounds(n);
        if (pointInRect(x, y, b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY))
          return n.id;
      }
      return undefined;
    },
    [],
  );

  const findShapeIdsUnder = useCallback((x: number, y: number): string[] => {
    const ids: string[] = [];
    const shapesSnapshot = useBoardStore.getState().shapes;
    for (const shape of shapesSnapshot) {
      if (!shape.id) continue;
      const inside =
        shape.type === "rect"
          ? pointInRect(x, y, shape.x, shape.y, shape.width, shape.height)
          : shape.type === "ellipse"
            ? pointInEllipse(x, y, shape.x, shape.y, shape.width, shape.height)
            : pointInTriangle(
                x,
                y,
                shape.x,
                shape.y,
                shape.width,
                shape.height,
              );
      if (inside) ids.push(shape.id);
    }
    return ids;
  }, []);

  /** 커서 아래 맨 위에 있는 도형 하나의 id 반환 (선택된 도형 위에서 이동 시작 판별용) */
  const findShapeIdAt = useCallback(
    (x: number, y: number): string | undefined => {
      const shapesSnapshot = useBoardStore.getState().shapes;
      for (let i = shapesSnapshot.length - 1; i >= 0; i--) {
        const shape = shapesSnapshot[i]!;
        if (!shape.id) continue;
        const inside =
          shape.type === "rect"
            ? pointInRect(x, y, shape.x, shape.y, shape.width, shape.height)
            : shape.type === "ellipse"
              ? pointInEllipse(
                  x,
                  y,
                  shape.x,
                  shape.y,
                  shape.width,
                  shape.height,
                )
              : pointInTriangle(
                  x,
                  y,
                  shape.x,
                  shape.y,
                  shape.width,
                  shape.height,
                );
        if (inside) return shape.id;
      }
      return undefined;
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const isPrimaryDown =
        "button" in e.evt ? (e.evt as MouseEvent).button === 0 : true;
      const isMiddleDown =
        "button" in e.evt ? (e.evt as MouseEvent).button === 1 : false;

      if (isMiddleDown) {
        e.evt.preventDefault();
        middlePanWindowCleanupRef.current?.();
        isMiddlePanningRef.current = true;
        lastMiddlePanClientRef.current = {
          x: (e.evt as MouseEvent).clientX,
          y: (e.evt as MouseEvent).clientY,
        };
        setIsMiddlePanning(true);
        const onMove = (ev: MouseEvent) => {
          if (!isMiddlePanningRef.current) return;
          const last = lastMiddlePanClientRef.current;
          const dx = ev.clientX - last.x;
          const dy = ev.clientY - last.y;
          lastMiddlePanClientRef.current = { x: ev.clientX, y: ev.clientY };
          setViewPos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        };
        const endMiddlePan = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          middlePanWindowCleanupRef.current = null;
          isMiddlePanningRef.current = false;
          setIsMiddlePanning(false);
        };
        function onUp() {
          endMiddlePan();
        }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        middlePanWindowCleanupRef.current = endMiddlePan;
        return;
      }
      const mindmapNode = getMindmapNodeUnderPointer(e);
      if (mindmapNode && isPrimaryDown) {
        mouseDownMindmapNodeRef.current = mindmapNode;
        return;
      }
      mouseDownMindmapNodeRef.current = null;
      const stage = e.target.getStage();
      let point = getPointerPosition(e);
      if (!point && stage) {
        const t = (e.evt as TouchEvent).touches?.[0];
        const cx = t?.clientX ?? (e.evt as MouseEvent).clientX;
        const cy = t?.clientY ?? (e.evt as MouseEvent).clientY;
        point = getStagePosFromEvent(stage, cx, cy);
      }
      if (!point || point.length < 2) return;
      const shift =
        "shiftKey" in e.evt ? (e.evt as MouseEvent).shiftKey : false;
      const editableNode = getEditableTextNodeAtStagePos(point[0], point[1]);
      if (editableNode?.kind === "freetext") setActiveNoteId(editableNode.id);
      else if (tool !== "text") setActiveNoteId(null);
      if (tool === "eraser" && !shift) {
        isErasing.current = true;
        eraserPushedUndo.current = false;
        const lineIds = findLineIdsUnder(point[0], point[1]);
        const shapeIds = findShapeIdsUnder(point[0], point[1]);
        if (lineIds.length > 0 || shapeIds.length > 0) {
          pushUndo();
          eraserPushedUndo.current = true;
          if (lineIds.length > 0) {
            removeLinesByIds(lineIds);
            broadcastRemoveLines(lineIds);
          }
          if (shapeIds.length > 0) {
            removeShapesByIds(shapeIds);
            broadcastRemoveShapes(shapeIds);
          }
        }
        return;
      }
      // 텍스트 도구가 아닐 때 텍스트 박스를 바로 드래그 이동
      if (editableNode?.kind === "freetext" && !shift && tool !== "text") {
        pushUndo();
        setSelectedLineIds([]);
        setSelectedShapeIds([]);
        setSelectedTextNodeIds([editableNode.id]);
        movingOriginalPointsByLineIdRef.current = {};
        movingOriginalShapesByIdRef.current = {};
        movingOriginalTextByIdRef.current = {
          [editableNode.id]: { x: editableNode.x, y: editableNode.y },
        };
        movingStartRef.current = { x: point[0], y: point[1] };
        isMovingSelectionRef.current = true;
        return;
      }
      if (shift) {
        isSelectingRef.current = true;
        setSelectionRect({
          x1: point[0],
          y1: point[1],
          x2: point[0],
          y2: point[1],
        });
        return;
      }
      if (
        selectedLineIds.length > 0 ||
        selectedShapeIds.length > 0 ||
        selectedTextNodeIds.length > 0
      ) {
        const hitLineId = findLineIdAt(point[0], point[1]);
        const hitShapeId = findShapeIdAt(point[0], point[1]);
        const hitSelectedText = findSelectedTextNodeIdAt(
          point[0],
          point[1],
          selectedTextNodeIds,
        );
        const hitSelectedLine =
          hitLineId && selectedLineIds.includes(hitLineId);
        const hitSelectedShape =
          hitShapeId && selectedShapeIds.includes(hitShapeId);
        if (hitSelectedLine || hitSelectedShape || hitSelectedText) {
          pushUndo();
          const linesSnapshot = useBoardStore.getState().lines;
          const lineById: Record<string, number[]> = {};
          for (const id of selectedLineIds) {
            const line = linesSnapshot.find((l) => l.id === id);
            if (line?.points) lineById[id] = [...line.points];
          }
          const shapesSnapshot = useBoardStore.getState().shapes;
          const shapeById: Record<string, { x: number; y: number }> = {};
          for (const id of selectedShapeIds) {
            const s = shapesSnapshot.find((sh) => sh.id === id);
            if (s) shapeById[id] = { x: s.x, y: s.y };
          }
          const textById: Record<string, { x: number; y: number }> = {};
          for (const id of selectedTextNodeIds) {
            const n = useBoardStore
              .getState()
              .textNodes.find((t) => t.id === id);
            if (n) textById[id] = { x: n.x, y: n.y };
          }
          movingOriginalPointsByLineIdRef.current = lineById;
          movingOriginalShapesByIdRef.current = shapeById;
          movingOriginalTextByIdRef.current = textById;
          movingStartRef.current = { x: point[0], y: point[1] };
          isMovingSelectionRef.current = true;
          return;
        }
      }
      setSelectedLineIds([]);
      setSelectedShapeIds([]);
      setSelectedTextNodeIds([]);
      if (tool === "text" && !shift && isPrimaryDown) {
        if (editableNode?.kind === "freetext") {
          setTextEditor({ mode: "edit", nodeId: editableNode.id });
          setDraftText(editableNode.text);
        } else {
          setTextEditor({ mode: "new", stageX: point[0], stageY: point[1] });
          setDraftText("");
        }
        return;
      }
      if (tool === "rect" || tool === "ellipse" || tool === "triangle") {
        isDrawingShapeRef.current = true;
        shapeStartRef.current = { x: point[0], y: point[1] };
        setDraftShape({
          type: tool,
          x: point[0],
          y: point[1],
          width: 0,
          height: 0,
        });
        return;
      }
      if (tool === "pen" || tool === "highlighter") {
        isDrawing.current = true;
        setCurrentPoints(point);
      }
    },
    [
      getMindmapNodeUnderPointer,
      getPointerPosition,
      getStagePosFromEvent,
      tool,
      selectedLineIds,
      selectedShapeIds,
      selectedTextNodeIds,
      findLineIdsUnder,
      findLineIdAt,
      findShapeIdsUnder,
      findShapeIdAt,
      findSelectedTextNodeIdAt,
      getEditableTextNodeAtStagePos,
      pushUndo,
      removeLinesByIds,
      removeShapesByIds,
      broadcastRemoveLines,
      broadcastRemoveShapes,
    ],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (middlePanWindowCleanupRef.current) return;
      const point = getPointerPosition(e);
      if (point) broadcastCursor(point[0], point[1]);
      if (isMovingSelectionRef.current && point) {
        const initial = movingStartRef.current;
        const dx = point[0] - initial.x;
        const dy = point[1] - initial.y;
        const lineById = movingOriginalPointsByLineIdRef.current;
        for (const [lineId, orig] of Object.entries(lineById)) {
          const newPoints = orig.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
          updateLine(lineId, newPoints);
          broadcastUpdateLine(lineId, newPoints);
        }
        const shapeById = movingOriginalShapesByIdRef.current;
        for (const [shapeId, orig] of Object.entries(shapeById)) {
          const x = orig.x + dx;
          const y = orig.y + dy;
          updateShape(shapeId, { x, y });
          broadcastUpdateShape(shapeId, x, y);
        }
        const textById = movingOriginalTextByIdRef.current;
        for (const [nodeId, orig] of Object.entries(textById)) {
          const x = orig.x + dx;
          const y = orig.y + dy;
          updateTextNode(nodeId, { x, y });
          broadcastUpdateTextNode(nodeId, { x, y });
        }
        return;
      }
      if (isSelectingRef.current && point) {
        setSelectionRect((prev) =>
          prev ? { ...prev, x2: point[0], y2: point[1] } : null,
        );
        return;
      }
      if (isDrawingShapeRef.current && point) {
        const start = shapeStartRef.current;
        const x = Math.min(start.x, point[0]);
        const y = Math.min(start.y, point[1]);
        const width = Math.abs(point[0] - start.x);
        const height = Math.abs(point[1] - start.y);
        setDraftShape((prev) =>
          prev ? { ...prev, x, y, width, height } : null,
        );
        return;
      }
      if (tool === "eraser" && isErasing.current && point) {
        const lineIds = findLineIdsUnder(point[0], point[1]);
        const shapeIds = findShapeIdsUnder(point[0], point[1]);
        if (lineIds.length > 0 || shapeIds.length > 0) {
          if (!eraserPushedUndo.current) {
            pushUndo();
            eraserPushedUndo.current = true;
          }
          if (lineIds.length > 0) {
            removeLinesByIds(lineIds);
            broadcastRemoveLines(lineIds);
          }
          if (shapeIds.length > 0) {
            removeShapesByIds(shapeIds);
            broadcastRemoveShapes(shapeIds);
          }
        }
        return;
      }
      if (!isDrawing.current) return;
      if (!point) return;
      setCurrentPoints((prev) => [...prev, ...point]);
    },
    [
      getPointerPosition,
      broadcastCursor,
      tool,
      findLineIdsUnder,
      findShapeIdsUnder,
      pushUndo,
      removeLinesByIds,
      removeShapesByIds,
      broadcastRemoveLines,
      broadcastRemoveShapes,
      updateLine,
      broadcastUpdateLine,
      updateShape,
      broadcastUpdateShape,
      updateTextNode,
      broadcastUpdateTextNode,
    ],
  );

  const commitLine = useCallback(() => {
    const points = currentPointsRef.current;
    if (points.length >= 4) {
      pushUndo();
      const drawingTool = useBoardStore.getState().tool;
      const line =
        drawingTool === "highlighter"
          ? {
              id: generateLineId(),
              points: [...points],
              color: highlighterColor,
              strokeWidth: HIGHLIGHTER_STROKE_WIDTH,
              opacity: HIGHLIGHTER_OPACITY,
            }
          : {
              id: generateLineId(),
              points: [...points],
              color: penColor,
            };
      addLine(line);
      broadcastLine(line);
    }
  }, [addLine, broadcastLine, highlighterColor, penColor, pushUndo]);

  const commitLineRef = useRef(commitLine);
  commitLineRef.current = commitLine;

  const handleStageWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (!stage) return;

      const zoomGesture = e.evt.ctrlKey || e.evt.metaKey;

      if (!zoomGesture) {
        let dx = e.evt.deltaX;
        let dy = e.evt.deltaY;
        if (e.evt.deltaMode === 1) {
          const line = 18;
          dx *= line;
          dy *= line;
        } else if (e.evt.deltaMode === 2) {
          const el = stage.container();
          const w = el?.clientWidth ?? 800;
          const h = el?.clientHeight ?? 600;
          dx *= w;
          dy *= h;
        }
        setViewPos((prev) => ({
          x: prev.x - dx,
          y: prev.y - dy,
        }));
        return;
      }

      const p = getStagePosFromEvent(stage, e.evt.clientX, e.evt.clientY);
      if (!p) return;
      const pointer = { x: p[0], y: p[1] };
      const v = viewRef.current;
      const oldScale = v.scale;
      const scaleBy = 1.08;
      const newScale =
        e.evt.deltaY > 0
          ? Math.max(VIEW_SCALE_MIN, oldScale / scaleBy)
          : Math.min(VIEW_SCALE_MAX, oldScale * scaleBy);
      const mousePointTo = {
        x: (pointer.x - v.x) / oldScale,
        y: (pointer.y - v.y) / oldScale,
      };
      setViewScale(newScale);
      setViewPos({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [getStagePosFromEvent],
  );

  const handleMouseUp = useCallback(() => {
    if (middlePanWindowCleanupRef.current) {
      middlePanWindowCleanupRef.current();
      return;
    }
    if (mouseDownMindmapNodeRef.current) {
      const node = mouseDownMindmapNodeRef.current;
      mouseDownMindmapNodeRef.current = null;
      openMindmapModal({ keyword: node.text, autoGenerate: true });
      return;
    }
    if (isDrawingShapeRef.current && draftShapeRef.current) {
      const { type, x, y, width, height } = draftShapeRef.current;
      if (width >= 2 && height >= 2) {
        pushUndo();
        const shape: ShapeData = {
          type,
          x,
          y,
          width,
          height,
          stroke: STROKE_COLOR,
        };
        addShape(shape);
        broadcastShape(shape);
      }
      isDrawingShapeRef.current = false;
      setDraftShape(null);
      return;
    }
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      const rect = selectionRectRef.current;
      if (rect) {
        setSelectedLineIds(
          getLineIdsInRect(rect.x1, rect.y1, rect.x2, rect.y2),
        );
        setSelectedShapeIds(
          getShapeIdsInRect(rect.x1, rect.y1, rect.x2, rect.y2),
        );
        setSelectedTextNodeIds(
          getTextNodeIdsInRect(rect.x1, rect.y1, rect.x2, rect.y2),
        );
      }
      setSelectionRect(null);
      return;
    }
    if (isMovingSelectionRef.current) {
      isMovingSelectionRef.current = false;
      movingOriginalPointsByLineIdRef.current = {};
      movingOriginalShapesByIdRef.current = {};
      movingOriginalTextByIdRef.current = {};
      return;
    }
    if (tool === "eraser") {
      isErasing.current = false;
      eraserPushedUndo.current = false;
      return;
    }
    if (!isDrawing.current) return;
    isDrawing.current = false;
    commitLine();
    setCurrentPoints([]);
  }, [
    commitLine,
    tool,
    getLineIdsInRect,
    getShapeIdsInRect,
    openMindmapModal,
    pushUndo,
    addShape,
    broadcastShape,
    getTextNodeIdsInRect,
  ]);

  /** DOM contextmenu: 마인드맵 버튼 위면 기본 메뉴 차단 후 커스텀 메뉴 표시 */
  const handleNativeContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = getStagePosFromEvent(stage, e.clientX, e.clientY);
      if (!pos) return;
      const node = getMindmapNodeAtStagePos(pos[0], pos[1]);
      if (node) {
        e.preventDefault();
        e.stopPropagation();
        mouseDownMindmapNodeRef.current = null;
        setColorMenu(null);
        const p = clampFixedMenuPosition(e.clientX, e.clientY, 200, 140);
        setContextMenu({ x: p.left, y: p.top, node });
        return;
      }
    },
    [getStagePosFromEvent, getMindmapNodeAtStagePos],
  );

  const handleMouseLeave = useCallback(() => {
    clearMyCursor();
    mouseDownMindmapNodeRef.current = null;
    isDrawingShapeRef.current = false;
    setDraftShape(null);
    isSelectingRef.current = false;
    isMovingSelectionRef.current = false;
    movingOriginalPointsByLineIdRef.current = {};
    movingOriginalShapesByIdRef.current = {};
    movingOriginalTextByIdRef.current = {};
    setSelectionRect(null);
    isErasing.current = false;
    if (isDrawing.current) {
      commitLine();
      setCurrentPoints([]);
      isDrawing.current = false;
    }
  }, [commitLine, clearMyCursor]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      // Ctrl+Y / Cmd+Shift+Z(일부 레이아웃): 다시 실행
      if (k === "y") {
        redo();
        e.preventDefault();
        return;
      }
      if (k === "z") {
        if (e.shiftKey) redo();
        else undo();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (isSelectingRef.current) return;
      if (isEditableKeyboardTarget(e.target)) return;
      const lineIds = selectedLineIdsRef.current;
      const shapeIds = selectedShapeIdsRef.current;
      const textIds = selectedTextNodeIdsRef.current;
      if (lineIds.length === 0 && shapeIds.length === 0 && textIds.length === 0)
        return;
      e.preventDefault();
      pushUndo();
      if (lineIds.length > 0) {
        removeLinesByIds(lineIds);
        broadcastRemoveLines(lineIds);
      }
      if (shapeIds.length > 0) {
        removeShapesByIds(shapeIds);
        broadcastRemoveShapes(shapeIds);
      }
      if (textIds.length > 0) {
        const cur = useBoardStore.getState().textNodes;
        setTextNodes(cur.filter((n) => !textIds.includes(n.id)));
        for (const id of textIds) broadcastRemoveMindmapNode(id);
      }
      setSelectedLineIds([]);
      setSelectedShapeIds([]);
      setSelectedTextNodeIds([]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    pushUndo,
    removeLinesByIds,
    removeShapesByIds,
    broadcastRemoveLines,
    broadcastRemoveShapes,
    setTextNodes,
    broadcastRemoveMindmapNode,
  ]);

  const commitTextEditor = useCallback(() => {
    if (!textEditor) return;
    const t = draftText.trim();
    if (textEditor.mode === "new") {
      if (t) {
        pushUndo();
        const node: MindmapNode = {
          id: generateFreeTextId(),
          text: t,
          x: textEditor.stageX,
          y: textEditor.stageY,
          kind: "freetext",
          fontSize: FREETEXT_FONT_SIZE,
          comments: [],
        };
        addMindmapNodes([node]);
        broadcastMindmapNodes([node]);
        setActiveNoteId(node.id);
      }
    } else {
      pushUndo();
      if (!t) {
        const cur = useBoardStore.getState().textNodes;
        setTextNodes(cur.filter((n) => n.id !== textEditor.nodeId));
        broadcastRemoveMindmapNode(textEditor.nodeId);
      } else {
        updateTextNode(textEditor.nodeId, { text: t });
        broadcastUpdateTextNode(textEditor.nodeId, { text: t });
      }
    }
    setTextEditor(null);
  }, [
    textEditor,
    draftText,
    pushUndo,
    addMindmapNodes,
    broadcastMindmapNodes,
    setTextNodes,
    broadcastRemoveMindmapNode,
    updateTextNode,
    broadcastUpdateTextNode,
    setActiveNoteId,
  ]);

  useEffect(() => {
    if (!textEditor) return;
    const id = requestAnimationFrame(() => textAreaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [textEditor]);

  const textEditorStyle = useMemo((): React.CSSProperties | null => {
    if (!textEditor) return null;
    // Konva Stage의 절대 변환은 화면 줌/패닝 값에 의해 바뀌는데,
    // 해당 값이 여기 콜백에선 직접 계산에 쓰이지 않아 eslint가 false positive를 낼 수 있습니다.
    // 따라서 useMemo가 viewScale/viewPos 변경에도 재계산되도록 값을 참조만 보장합니다.
    void viewScale;
    void viewPos;
    const stage = stageRef.current;
    if (!stage) {
      return { position: "fixed", left: 8, top: 8, zIndex: 50, minWidth: 140 };
    }
    const rect = stage.container().getBoundingClientRect();
    let sx: number;
    let sy: number;
    if (textEditor.mode === "new") {
      sx = textEditor.stageX;
      sy = textEditor.stageY;
    } else {
      const n = textNodes.find((x) => x.id === textEditor.nodeId);
      if (!n)
        return {
          position: "fixed",
          left: rect.left,
          top: rect.top,
          zIndex: 50,
          minWidth: 140,
        };
      sx = n.x;
      sy = n.y;
    }
    const t = stage.getAbsoluteTransform();
    const pt = t.point({ x: sx, y: sy });
    return {
      position: "fixed",
      left: rect.left + pt.x,
      top: rect.top + pt.y,
      zIndex: 50,
      minWidth: 140,
    };
  }, [textEditor, textNodes, viewScale, viewPos]);

  const myName = useMemo(() => {
    if (!user) return "익명";
    const name = user.user_metadata?.full_name;
    if (name && String(name).trim()) return String(name).trim();
    if (user.email) return user.email.split("@")[0] ?? "익명";
    return user.id?.slice(0, 8) ?? "익명";
  }, [user]);

  const activeNote = useMemo(
    () =>
      textNodes.find((n) => n.id === activeNoteId && n.kind === "freetext") ??
      null,
    [activeNoteId, textNodes],
  );

  useEffect(() => {
    setEditingNoteText(false);
    setEditingNoteDraft("");
    setEditingCommentId(null);
    setEditingCommentDraft("");
    setEditingReplyKey(null);
    setEditingReplyDraft("");
  }, [activeNoteId]);

  const updateNoteComments = useCallback(
    (noteId: string, nextComments: DiscussionComment[]) => {
      pushUndo();
      updateTextNode(noteId, { comments: nextComments });
      broadcastUpdateTextNode(noteId, { comments: nextComments });
    },
    [pushUndo, updateTextNode, broadcastUpdateTextNode],
  );

  const addComment = useCallback(() => {
    if (!activeNote || !commentDraft.trim()) return;
    const nextComments: DiscussionComment[] = [
      ...(activeNote.comments ?? []),
      {
        id: generateCommentId(),
        text: commentDraft.trim(),
        authorName: myName,
        createdAt: new Date().toISOString(),
        replies: [],
      },
    ];
    updateNoteComments(activeNote.id, nextComments);
    setCommentDraft("");
  }, [activeNote, commentDraft, myName, updateNoteComments]);

  const addReply = useCallback(() => {
    if (!activeNote || !replyTargetCommentId || !replyDraft.trim()) return;
    const nextComments = (activeNote.comments ?? []).map((c) =>
      c.id === replyTargetCommentId
        ? {
            ...c,
            replies: [
              ...(c.replies ?? []),
              {
                id: generateReplyId(),
                text: replyDraft.trim(),
                authorName: myName,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : c,
    );
    updateNoteComments(activeNote.id, nextComments);
    setReplyDraft("");
    setReplyTargetCommentId(null);
  }, [
    activeNote,
    replyTargetCommentId,
    replyDraft,
    myName,
    updateNoteComments,
  ]);

  useEffect(() => {
    if (!contextMenu && !colorMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const outsideContext =
        !contextMenuRef.current || !contextMenuRef.current.contains(target);
      const outsideColor =
        !colorMenuRef.current || !colorMenuRef.current.contains(target);
      if (outsideContext) setContextMenu(null);
      if (outsideColor) setColorMenu(null);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setColorMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [contextMenu, colorMenu]);

  useEffect(() => {
    const onGlobalContextMenu = (e: MouseEvent) => {
      const targetEl = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-color-menu-target]",
      );
      const menuTarget = targetEl?.dataset.colorMenuTarget;
      if (menuTarget !== "pen" && menuTarget !== "highlighter") return;
      e.preventDefault();
      setContextMenu(null);
      const p = clampFixedMenuPosition(e.clientX, e.clientY, 220, 200);
      setColorMenu({
        x: p.left,
        y: p.top,
        target: menuTarget,
      });
    };
    window.addEventListener("contextmenu", onGlobalContextMenu);
    return () => window.removeEventListener("contextmenu", onGlobalContextMenu);
  }, []);

  // 데스크톱: 더블 클릭, 모바일(iOS/iPadOS): 더블 탭으로 펜/형광펜 색상 메뉴 열기
  useEffect(() => {
    const DOUBLE_TAP_MS = 320;
    const MOVE_CANCEL_PX = 12;

    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let lastTapTarget: "pen" | "highlighter" | null = null;

    const openColorMenu = (
      x: number,
      y: number,
      target: "pen" | "highlighter",
    ) => {
      setContextMenu(null);
      const p = clampFixedMenuPosition(x, y, 220, 200);
      setColorMenu({ x: p.left, y: p.top, target });
    };

    const getTarget = (eventTarget: EventTarget | null) => {
      const el = (eventTarget as HTMLElement | null)?.closest<HTMLElement>(
        "[data-color-menu-target]",
      );
      const menuTarget = el?.dataset.colorMenuTarget;
      return menuTarget === "pen" || menuTarget === "highlighter"
        ? (menuTarget as "pen" | "highlighter")
        : null;
    };

    const onDblClick = (e: MouseEvent) => {
      const t = getTarget(e.target);
      if (!t) return;
      e.preventDefault();
      openColorMenu(e.clientX, e.clientY, t);
    };

    const onTouchEnd = (e: TouchEvent) => {
      // touchend에는 touches가 0일 수 있어 changedTouches 사용
      const t = getTarget(e.target);
      if (!t) return;
      const touch = e.changedTouches?.[0];
      if (!touch) return;

      const now = Date.now();
      const dx = touch.clientX - lastTapX;
      const dy = touch.clientY - lastTapY;
      const closeEnough = Math.hypot(dx, dy) <= MOVE_CANCEL_PX;

      if (
        lastTapTarget === t &&
        closeEnough &&
        now - lastTapAt > 0 &&
        now - lastTapAt <= DOUBLE_TAP_MS
      ) {
        e.preventDefault();
        openColorMenu(touch.clientX, touch.clientY, t);
        lastTapAt = 0;
        lastTapTarget = null;
        return;
      }

      lastTapAt = now;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
      lastTapTarget = t;
    };

    window.addEventListener("dblclick", onDblClick, { capture: true });
    window.addEventListener("touchend", onTouchEnd, {
      capture: true,
      passive: false,
    });

    return () => {
      window.removeEventListener("dblclick", onDblClick, true);
      window.removeEventListener("touchend", onTouchEnd, true);
    };
  }, [clampFixedMenuPosition]);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const syncCanvasSize = () => {
      setCanvasSize({
        width: Math.max(1, Math.floor(el.clientWidth)),
        height: Math.max(1, Math.floor(el.clientHeight)),
      });
    };

    syncCanvasSize();

    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(el);
    window.addEventListener("resize", syncCanvasSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncCanvasSize);
    };
  }, []);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        if (isDrawing.current && currentPointsRef.current.length >= 4) {
          commitLineRef.current();
        }
        isDrawing.current = false;
        setCurrentPoints([]);
        isErasing.current = false;
        isDrawingShapeRef.current = false;
        setDraftShape(null);
        isSelectingRef.current = false;
        isMovingSelectionRef.current = false;
        mouseDownMindmapNodeRef.current = null;
        const t0 = e.touches[0]!;
        const t1 = e.touches[1]!;
        pinchRef.current = {
          lastDist: Math.hypot(
            t0.clientX - t1.clientX,
            t0.clientY - t1.clientY,
          ),
          lastMidX: (t0.clientX + t1.clientX) / 2,
          lastMidY: (t0.clientY + t1.clientY) / 2,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return;
      let p = pinchRef.current;
      if (!p) {
        const t0 = e.touches[0]!;
        const t1 = e.touches[1]!;
        p = {
          lastDist: Math.hypot(
            t0.clientX - t1.clientX,
            t0.clientY - t1.clientY,
          ),
          lastMidX: (t0.clientX + t1.clientX) / 2,
          lastMidY: (t0.clientY + t1.clientY) / 2,
        };
        pinchRef.current = p;
      }
      e.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const midX = (t0.clientX + t1.clientX) / 2;
      const midY = (t0.clientY + t1.clientY) / 2;
      const scaleRatio = dist / p.lastDist;
      if (Math.abs(scaleRatio - 1) < TWO_FINGER_ZOOM_INTENT_EPS) {
        const panDx = midX - p.lastMidX;
        const panDy = midY - p.lastMidY;
        setViewPos((prev) => ({
          x: prev.x + panDx,
          y: prev.y + panDy,
        }));
        pinchRef.current = {
          lastDist: dist,
          lastMidX: midX,
          lastMidY: midY,
        };
        return;
      }
      const pw = getStagePosFromEvent(stage, midX, midY);
      if (!pw) return;
      const pointer = { x: pw[0], y: pw[1] };
      const v = viewRef.current;
      const oldScale = v.scale;
      const newScale = clamp(
        oldScale * scaleRatio,
        VIEW_SCALE_MIN,
        VIEW_SCALE_MAX,
      );
      const mousePointTo = {
        x: (pointer.x - v.x) / oldScale,
        y: (pointer.y - v.y) / oldScale,
      };
      let newX = pointer.x - mousePointTo.x * newScale;
      let newY = pointer.y - mousePointTo.y * newScale;
      newX += midX - p.lastMidX;
      newY += midY - p.lastMidY;
      setViewScale(newScale);
      setViewPos({ x: newX, y: newY });
      pinchRef.current = {
        lastDist: dist,
        lastMidX: midX,
        lastMidY: midY,
      };
    };

    const onTouchEnd = (ev: TouchEvent) => {
      if (ev.touches.length < 2) pinchRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [getStagePosFromEvent]);

  useEffect(() => {
    return () => {
      middlePanWindowCleanupRef.current?.();
    };
  }, []);

  return (
    <React.Fragment>
      <div
        ref={canvasContainerRef}
        className={`relative h-full w-full touch-none overscroll-contain ${
          isMiddlePanning ? "cursor-grabbing" : ""
        }`}
        onContextMenu={handleNativeContextMenu}
      >
        {textEditor && textEditorStyle ? (
          <textarea
            ref={textAreaRef}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                skipTextEditorBlurCommitRef.current = true;
                setTextEditor(null);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                textAreaRef.current?.blur();
              }
            }}
            onBlur={() => {
              if (skipTextEditorBlurCommitRef.current) {
                skipTextEditorBlurCommitRef.current = false;
                return;
              }
              commitTextEditor();
            }}
            className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900 shadow-lg outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-500"
            style={textEditorStyle}
            rows={2}
            aria-label="화이트보드 텍스트 입력"
          />
        ) : null}
        <Stage
          ref={(node) => {
            stageRef.current = node ?? null;
          }}
          width={canvasSize.width}
          height={canvasSize.height}
          scaleX={viewScale}
          scaleY={viewScale}
          x={viewPos.x}
          y={viewPos.y}
          onWheel={handleStageWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          onTouchCancel={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ background: "#f8fafc" }}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={line.id ?? i}
                points={line.points}
                stroke={line.color}
                strokeWidth={line.strokeWidth ?? STROKE_WIDTH}
                opacity={line.opacity ?? 1}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.opacity != null && line.opacity < 1
                    ? "multiply"
                    : "source-over"
                }
              />
            ))}
            {currentPoints.length >= 2 && (
              <Line
                points={currentPoints}
                stroke={tool === "highlighter" ? highlighterColor : penColor}
                strokeWidth={
                  tool === "highlighter"
                    ? HIGHLIGHTER_STROKE_WIDTH
                    : STROKE_WIDTH
                }
                opacity={tool === "highlighter" ? HIGHLIGHTER_OPACITY : 1}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  tool === "highlighter" ? "multiply" : "source-over"
                }
              />
            )}
            {/* Shift+드래그 중: 선택 영역 사각형 (점선) */}
            {selectionRect && (
              <Rect
                x={Math.min(selectionRect.x1, selectionRect.x2)}
                y={Math.min(selectionRect.y1, selectionRect.y2)}
                width={Math.abs(selectionRect.x2 - selectionRect.x1)}
                height={Math.abs(selectionRect.y2 - selectionRect.y1)}
                stroke="#2563eb"
                strokeWidth={2}
                dash={[8, 4]}
                fill="rgba(59, 130, 246, 0.18)"
              />
            )}
            {/* 선택 확정 후: 선택된 선들의 경계 상자 (어디까지 선택됐는지 표시) */}
            {!selectionRect &&
              (selectedLineIds.length > 0 ||
                selectedShapeIds.length > 0 ||
                selectedTextNodeIds.length > 0) &&
              (() => {
                let minX = Infinity,
                  minY = Infinity,
                  maxX = -Infinity,
                  maxY = -Infinity;
                const lineSet = new Set(selectedLineIds);
                for (const line of lines) {
                  if (!line.id || !lineSet.has(line.id)) continue;
                  const box = getLineBoundingBox(line.points);
                  if (box.minX < minX) minX = box.minX;
                  if (box.minY < minY) minY = box.minY;
                  if (box.maxX > maxX) maxX = box.maxX;
                  if (box.maxY > maxY) maxY = box.maxY;
                }
                const shapeSet = new Set(selectedShapeIds);
                for (const shape of shapes) {
                  if (!shape.id || !shapeSet.has(shape.id)) continue;
                  const sx = shape.x;
                  const sy = shape.y;
                  const sx2 = shape.x + shape.width;
                  const sy2 = shape.y + shape.height;
                  if (sx < minX) minX = sx;
                  if (sy < minY) minY = sy;
                  if (sx2 > maxX) maxX = sx2;
                  if (sy2 > maxY) maxY = sy2;
                }
                const textSet = new Set(selectedTextNodeIds);
                for (const n of textNodes) {
                  if (!textSet.has(n.id)) continue;
                  const b = getTextNodeBounds(n);
                  if (b.minX < minX) minX = b.minX;
                  if (b.minY < minY) minY = b.minY;
                  if (b.maxX > maxX) maxX = b.maxX;
                  if (b.maxY > maxY) maxY = b.maxY;
                }
                if (minX === Infinity) return null;
                const pad = 6;
                return (
                  <Rect
                    x={minX - pad}
                    y={minY - pad}
                    width={maxX - minX + pad * 2}
                    height={maxY - minY + pad * 2}
                    stroke="#2563eb"
                    strokeWidth={2}
                    dash={[6, 4]}
                    fill="transparent"
                  />
                );
              })()}
            {/* 저장된 도형 */}
            {shapes.map((shape, i) =>
              shape.type === "rect" ? (
                <Rect
                  key={shape.id ?? i}
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  stroke={shape.stroke ?? STROKE_COLOR}
                  strokeWidth={STROKE_WIDTH}
                  listening={false}
                />
              ) : shape.type === "ellipse" ? (
                <Ellipse
                  key={shape.id ?? i}
                  x={shape.x + shape.width / 2}
                  y={shape.y + shape.height / 2}
                  radiusX={shape.width / 2}
                  radiusY={shape.height / 2}
                  stroke={shape.stroke ?? STROKE_COLOR}
                  strokeWidth={STROKE_WIDTH}
                  listening={false}
                />
              ) : (
                <Line
                  key={shape.id ?? i}
                  x={shape.x}
                  y={shape.y}
                  points={[
                    shape.width / 2,
                    0,
                    0,
                    shape.height,
                    shape.width,
                    shape.height,
                  ]}
                  stroke={shape.stroke ?? STROKE_COLOR}
                  strokeWidth={STROKE_WIDTH}
                  closed
                  listening={false}
                />
              ),
            )}
            {/* 도형 드래그 중 미리보기 */}
            {draftShape &&
              draftShape.width >= 1 &&
              draftShape.height >= 1 &&
              (draftShape.type === "rect" ? (
                <Rect
                  x={draftShape.x}
                  y={draftShape.y}
                  width={draftShape.width}
                  height={draftShape.height}
                  stroke={STROKE_COLOR}
                  strokeWidth={STROKE_WIDTH}
                  dash={[6, 4]}
                  listening={false}
                />
              ) : draftShape.type === "ellipse" ? (
                <Ellipse
                  x={draftShape.x + draftShape.width / 2}
                  y={draftShape.y + draftShape.height / 2}
                  radiusX={draftShape.width / 2}
                  radiusY={draftShape.height / 2}
                  stroke={STROKE_COLOR}
                  strokeWidth={STROKE_WIDTH}
                  dash={[6, 4]}
                  listening={false}
                />
              ) : (
                <Line
                  x={draftShape.x}
                  y={draftShape.y}
                  points={[
                    draftShape.width / 2,
                    0,
                    0,
                    draftShape.height,
                    draftShape.width,
                    draftShape.height,
                  ]}
                  stroke={STROKE_COLOR}
                  strokeWidth={STROKE_WIDTH}
                  dash={[6, 4]}
                  closed
                  listening={false}
                />
              ))}
          </Layer>
          <Layer listening={false}>
            {Object.entries(cursors).map(
              ([clientId, { x, y, color, displayName }]) => (
                <Group key={clientId} listening={false}>
                  <Circle
                    x={x}
                    y={y}
                    radius={CURSOR_RADIUS}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={2}
                    listening={false}
                  />
                  <Text
                    x={x + CURSOR_RADIUS + 4}
                    y={y - 8}
                    text={cursorLabel(displayName ?? clientId.slice(-6))}
                    fontSize={12}
                    fill={color}
                    listening={false}
                  />
                </Group>
              ),
            )}
          </Layer>
          {/* 마인드맵 노드 레이어를 맨 위에 배치 - getIntersection이 버튼을 찾도록 */}
          <Layer listening={true}>
            {textNodes.map((node) =>
              node.kind === "freetext" ? (
                <Group key={node.id} x={node.x} y={node.y} listening={true}>
                  {(() => {
                    const fs = node.fontSize ?? FREETEXT_FONT_SIZE;
                    const size = getNoteSize(node.text, fs);
                    const count = node.comments?.length ?? 0;
                    return (
                      <React.Fragment>
                        <Rect
                          width={size.width}
                          height={size.height}
                          fill="#ffffff"
                          stroke="#cbd5e1"
                          strokeWidth={1}
                          cornerRadius={10}
                          listening={true}
                        />
                        <Text
                          x={NOTE_PADDING_X}
                          y={NOTE_PADDING_Y}
                          text={node.text}
                          fontSize={fs}
                          fill="#0f172a"
                          fontFamily="system-ui, -apple-system, sans-serif"
                          listening={false}
                          width={size.width - NOTE_PADDING_X * 2}
                        />
                        <Text
                          x={8}
                          y={size.height + 4}
                          text={`댓글 ${count}`}
                          fontSize={12}
                          fill="#475569"
                          listening={false}
                        />
                      </React.Fragment>
                    );
                  })()}
                </Group>
              ) : (
                <Group key={node.id} x={node.x} y={node.y} listening={true}>
                  <Rect
                    name="mindmap-node-rect"
                    width={BTN_WIDTH}
                    height={BTN_HEIGHT}
                    fill={
                      hoveredMindmapNodeId === node.id ? "#e2e8f0" : "#f9fafb"
                    }
                    stroke={
                      hoveredMindmapNodeId === node.id ? "#64748b" : "#cbd5e1"
                    }
                    strokeWidth={1}
                    cornerRadius={4}
                    listening={true}
                    onMouseEnter={(e) => {
                      const stage = e.target.getStage();
                      const container = stage?.container();
                      if (container) container.style.cursor = "pointer";
                      setHoveredMindmapNodeId(node.id);
                    }}
                    onMouseLeave={(e) => {
                      const stage = e.target.getStage();
                      const container = stage?.container();
                      if (container) container.style.cursor = "default";
                      setHoveredMindmapNodeId((prev) =>
                        prev === node.id ? null : prev,
                      );
                    }}
                  />
                  <Text
                    x={0}
                    y={0}
                    text={node.text}
                    fontSize={12}
                    fill="#1e293b"
                    listening={false}
                    width={BTN_WIDTH}
                    height={BTN_HEIGHT}
                    align="center"
                    verticalAlign="middle"
                    ellipsis
                  />
                </Group>
              ),
            )}
          </Layer>
        </Stage>
      </div>
      {activeNote && (
        <aside className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.5rem,env(safe-area-inset-left))] right-[max(0.5rem,env(safe-area-inset-right))] top-[max(3.5rem,env(safe-area-inset-top))] z-40 overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl sm:bottom-auto sm:left-auto sm:right-[max(1rem,env(safe-area-inset-right))] sm:top-[max(4rem,env(safe-area-inset-top))] sm:w-80 sm:max-h-[min(85dvh,calc(100svh-5rem))]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              텍스트/댓글
            </h3>
            <button
              type="button"
              className="text-xs text-blue-700 hover:text-blue-800"
              onClick={() => setActiveNoteId(null)}
            >
              닫기
            </button>
          </div>
          <div className="mb-3 rounded-lg border border-slate-200 p-2">
            <p className="mb-2 text-xs text-slate-500">텍스트</p>
            {editingNoteText ? (
              <textarea
                value={editingNoteDraft}
                onChange={(e) => setEditingNoteDraft(e.target.value)}
                rows={4}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-800">
                {activeNote.text}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {editingNoteText ? (
                <>
                  <button
                    type="button"
                    className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                    onClick={() => {
                      setEditingNoteText(false);
                      setEditingNoteDraft("");
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                    onClick={() => {
                      pushUndo();
                      updateTextNode(activeNote.id, { text: editingNoteDraft });
                      broadcastUpdateTextNode(activeNote.id, {
                        text: editingNoteDraft,
                      });
                      setEditingNoteText(false);
                      setEditingNoteDraft("");
                    }}
                  >
                    저장
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    setEditingNoteText(true);
                    setEditingNoteDraft(activeNote.text);
                  }}
                >
                  텍스트 수정
                </button>
              )}
              <button
                type="button"
                className="rounded border border-orange-200 px-2 py-1 text-xs text-orange-700 hover:bg-orange-50"
                onClick={() => {
                  const ok = window.confirm("이 텍스트와 댓글을 삭제할까요?");
                  if (!ok) return;
                  pushUndo();
                  const cur = useBoardStore.getState().textNodes;
                  setTextNodes(cur.filter((n) => n.id !== activeNote.id));
                  broadcastRemoveMindmapNode(activeNote.id);
                  setActiveNoteId(null);
                }}
              >
                텍스트 삭제
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">댓글</p>
            {(activeNote.comments ?? []).map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-slate-200 p-2"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {c.authorName} · {new Date(c.createdAt).toLocaleString()}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-blue-700 hover:text-blue-900"
                      onClick={() => {
                        setEditingCommentId(c.id);
                        setEditingCommentDraft(c.text);
                      }}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      className="text-xs text-orange-600 hover:text-orange-700"
                      onClick={() => {
                        const nextComments = (activeNote.comments ?? []).filter(
                          (x) => x.id !== c.id,
                        );
                        updateNoteComments(activeNote.id, nextComments);
                      }}
                    >
                      삭제
                    </button>
                  </span>
                </div>
                {editingCommentId === c.id ? (
                  <div className="space-y-1">
                    <textarea
                      value={editingCommentDraft}
                      onChange={(e) => setEditingCommentDraft(e.target.value)}
                      rows={3}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditingCommentDraft("");
                        }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                        onClick={() => {
                          const nextComments = (activeNote.comments ?? []).map(
                            (x) =>
                              x.id === c.id
                                ? { ...x, text: editingCommentDraft }
                                : x,
                          );
                          updateNoteComments(activeNote.id, nextComments);
                          setEditingCommentId(null);
                          setEditingCommentDraft("");
                        }}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-slate-800">
                    {c.text}
                  </p>
                )}
                {(c.replies ?? []).length > 0 && (
                  <ul className="mt-2 space-y-1 border-l border-slate-200 pl-2">
                    {(c.replies ?? []).map((r) => (
                      <li key={r.id} className="rounded bg-slate-50 p-1.5">
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            {r.authorName} ·{" "}
                            {new Date(r.createdAt).toLocaleString()}
                          </span>
                          <span className="flex gap-2">
                            <button
                              type="button"
                              className="text-[11px] text-blue-700 hover:text-blue-900"
                              onClick={() => {
                                setEditingReplyKey(`${c.id}:${r.id}`);
                                setEditingReplyDraft(r.text);
                              }}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="text-[11px] text-orange-600 hover:text-orange-700"
                              onClick={() => {
                                const nextComments = (
                                  activeNote.comments ?? []
                                ).map((x) =>
                                  x.id !== c.id
                                    ? x
                                    : {
                                        ...x,
                                        replies: (x.replies ?? []).filter(
                                          (y) => y.id !== r.id,
                                        ),
                                      },
                                );
                                updateNoteComments(activeNote.id, nextComments);
                              }}
                            >
                              삭제
                            </button>
                          </span>
                        </div>
                        {editingReplyKey === `${c.id}:${r.id}` ? (
                          <div className="space-y-1">
                            <textarea
                              value={editingReplyDraft}
                              onChange={(e) =>
                                setEditingReplyDraft(e.target.value)
                              }
                              rows={2}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="rounded px-2 py-0.5 text-[11px] text-blue-700 hover:bg-blue-100"
                                onClick={() => {
                                  setEditingReplyKey(null);
                                  setEditingReplyDraft("");
                                }}
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                className="rounded bg-blue-600 px-2 py-0.5 text-[11px] text-white hover:bg-blue-700"
                                onClick={() => {
                                  const nextComments = (
                                    activeNote.comments ?? []
                                  ).map((x) =>
                                    x.id !== c.id
                                      ? x
                                      : {
                                          ...x,
                                          replies: (x.replies ?? []).map((y) =>
                                            y.id === r.id
                                              ? {
                                                  ...y,
                                                  text: editingReplyDraft,
                                                }
                                              : y,
                                          ),
                                        },
                                  );
                                  updateNoteComments(
                                    activeNote.id,
                                    nextComments,
                                  );
                                  setEditingReplyKey(null);
                                  setEditingReplyDraft("");
                                }}
                              >
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-xs text-slate-700">
                            {r.text}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2">
                  {replyTargetCommentId === c.id ? (
                    <div className="space-y-1">
                      <textarea
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        rows={2}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        placeholder="답글 입력"
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                          onClick={() => {
                            setReplyTargetCommentId(null);
                            setReplyDraft("");
                          }}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                          onClick={addReply}
                        >
                          답글 등록
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-blue-700 hover:text-blue-900"
                      onClick={() => setReplyTargetCommentId(c.id)}
                    >
                      답글 달기
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-slate-200 pt-3">
            <textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="댓글 입력"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                onClick={addComment}
              >
                댓글 등록
              </button>
            </div>
          </div>
        </aside>
      )}
      {colorMenu && (
        <div
          ref={colorMenuRef}
          className="fixed z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
          style={{ left: colorMenu.x, top: colorMenu.y + 8 }}
        >
          <p className="mb-1 text-[11px] text-slate-500">
            {colorMenu.target === "pen" ? "펜 색상" : "형광펜 색상"}
          </p>
          <div className="mb-2 grid grid-cols-4 gap-1">
            {(colorMenu.target === "pen"
              ? PEN_COLOR_PRESETS
              : HIGHLIGHTER_COLOR_PRESETS
            ).map((color) => (
              <button
                key={color}
                type="button"
                className="h-5 w-5 rounded border border-blue-200"
                style={{ backgroundColor: color }}
                onClick={() => {
                  if (colorMenu.target === "pen") setPenColor(color);
                  else setHighlighterColor(color);
                  setColorMenu(null);
                }}
                aria-label={`색상 ${color}`}
                title={color}
              />
            ))}
          </div>
          <input
            type="color"
            value={colorMenu.target === "pen" ? penColor : highlighterColor}
            onChange={(e) => {
              const color = e.target.value;
              if (colorMenu.target === "pen") setPenColor(color);
              else setHighlighterColor(color);
            }}
            className="h-7 w-full cursor-pointer rounded border border-slate-300"
          />
        </div>
      )}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm text-orange-700 hover:bg-orange-50"
            onClick={() => {
              const nodeId = contextMenu.node.id;
              const current = useBoardStore.getState().textNodes;
              setTextNodes(current.filter((n) => n.id !== nodeId));
              broadcastRemoveMindmapNode(nodeId);
              setContextMenu(null);
            }}
          >
            삭제
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
            onClick={() => {
              openMindmapModal({
                keyword: contextMenu.node.text,
                autoGenerate: true,
              });
              setContextMenu(null);
            }}
          >
            마인드맵 생성
          </button>
        </div>
      )}
    </React.Fragment>
  );
}
