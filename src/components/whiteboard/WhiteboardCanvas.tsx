"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
import type { MindmapNode, ShapeData, ShapeType } from "@/stores/useBoardStore";
import { useWhiteboardRealtime } from "@/contexts/WhiteboardRealtimeContext";
import {
  distancePointToSegment,
  getLineBoundingBox,
  pointInEllipse,
  pointInRect,
  pointInTriangle,
  rectsIntersect,
} from "@/lib/geometry";
import { BTN_WIDTH, BTN_HEIGHT } from "@/lib/mindmapLayout";
import { useMindmapGenerate } from "@/hooks/useMindmapGenerate";

const STROKE_COLOR = "#1e293b";
const STROKE_WIDTH = 2;
const CURSOR_RADIUS = 6;
const ERASER_RADIUS = 24;
/** 선택된 선 위에서 드래그 시작할 때 인식 반경 */
const MOVE_HIT_RADIUS = 12;

function cursorLabel(name: string): string {
  return name.includes("@") ? name.split("@")[0]! : name;
}

function generateLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function WhiteboardCanvas() {
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
    broadcastRemoveMindmapNode,
    clearMyCursor,
  } = useWhiteboardRealtime();
  const { generate: generateMindmap, isGenerating: isMindmapGenerating } =
    useMindmapGenerate();
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  /** Shift+드래그로 선택된 선 id 목록 */
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  /** Shift+드래그로 선택된 도형 id 목록 */
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
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
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
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
  const movingStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const selectionRectRef = useRef<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  selectionRectRef.current = selectionRect;

  const getPointerPosition = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      return pos ? [pos.x, pos.y] : null;
    },
    [],
  );

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

  /** 이벤트에서 stage 좌표 [x,y] 계산 (컨테이너 rect + 스케일 보정) */
  const getStagePosFromEvent = useCallback(
    (
      stage: Konva.Stage | null,
      clientX: number,
      clientY: number,
    ): number[] | null => {
      if (!stage) return null;
      const container = stage.container();
      const rect = container.getBoundingClientRect();
      const scaleX = stage.width() / rect.width;
      const scaleY = stage.height() / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      return [x, y];
    },
    [],
  );

  /** stage 좌표 (x,y)가 마인드맵 버튼 안인 노드 반환 (겹치면 맨 위 = 배열 마지막) */
  const getMindmapNodeAtStagePos = useCallback(
    (stageX: number, stageY: number): MindmapNode | null => {
      const nodes = useBoardStore.getState().textNodes;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]!;
        if (
          stageX >= n.x &&
          stageX < n.x + BTN_WIDTH &&
          stageY >= n.y &&
          stageY < n.y + BTN_HEIGHT
        ) {
          return n;
        }
      }
      return null;
    },
    [],
  );

  const getMindmapNodeUnderPointer = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>): MindmapNode | null => {
      const stage = e.target.getStage();
      const pos = getStagePosFromEvent(stage, e.evt.clientX, e.evt.clientY);
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
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const mindmapNode = getMindmapNodeUnderPointer(e);
      if (mindmapNode && e.evt.button === 0) {
        mouseDownMindmapNodeRef.current = mindmapNode;
        return;
      }
      mouseDownMindmapNodeRef.current = null;
      const stage = e.target.getStage();
      let point = getPointerPosition(e);
      if (!point && stage)
        point = getStagePosFromEvent(stage, e.evt.clientX, e.evt.clientY);
      if (!point || point.length < 2) return;
      const shift = e.evt.shiftKey;
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
      if (selectedLineIds.length > 0 || selectedShapeIds.length > 0) {
        const hitLineId = findLineIdAt(point[0], point[1]);
        const hitShapeId = findShapeIdAt(point[0], point[1]);
        const hitSelectedLine =
          hitLineId && selectedLineIds.includes(hitLineId);
        const hitSelectedShape =
          hitShapeId && selectedShapeIds.includes(hitShapeId);
        if (hitSelectedLine || hitSelectedShape) {
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
          movingOriginalPointsByLineIdRef.current = lineById;
          movingOriginalShapesByIdRef.current = shapeById;
          movingStartRef.current = { x: point[0], y: point[1] };
          isMovingSelectionRef.current = true;
          return;
        }
      }
      setSelectedLineIds([]);
      setSelectedShapeIds([]);
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
      if (tool === "pen") {
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
      findLineIdsUnder,
      findLineIdAt,
      findShapeIdsUnder,
      findShapeIdAt,
      pushUndo,
      removeLinesByIds,
      removeShapesByIds,
      broadcastRemoveLines,
      broadcastRemoveShapes,
    ],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
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
      pushUndo,
      removeLinesByIds,
      broadcastRemoveLines,
      updateLine,
      broadcastUpdateLine,
    ],
  );

  const commitLine = useCallback(() => {
    const points = currentPointsRef.current;
    if (points.length >= 4) {
      pushUndo();
      const line = {
        id: generateLineId(),
        points: [...points],
        color: STROKE_COLOR,
      };
      addLine(line);
      broadcastLine(line);
    }
  }, [addLine, broadcastLine, pushUndo]);

  const handleMouseUp = useCallback(() => {
    if (mouseDownMindmapNodeRef.current) {
      const node = mouseDownMindmapNodeRef.current;
      mouseDownMindmapNodeRef.current = null;
      if (!isMindmapGenerating) generateMindmap(node.text);
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
      }
      setSelectionRect(null);
      return;
    }
    if (isMovingSelectionRef.current) {
      isMovingSelectionRef.current = false;
      movingOriginalPointsByLineIdRef.current = {};
      movingOriginalShapesByIdRef.current = {};
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
    generateMindmap,
    isMindmapGenerating,
    pushUndo,
    addShape,
    broadcastShape,
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
        setContextMenu({ x: e.clientX, y: e.clientY, node });
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
      if (!e.ctrlKey) return;
      if (e.key === "z" || e.key === "y") {
        if (e.shiftKey) {
          redo();
          e.preventDefault();
        } else {
          undo();
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  return (
    <React.Fragment>
      <div
        className="w-full h-full"
        style={{ position: "relative" }}
        onContextMenu={handleNativeContextMenu}
      >
        <Stage
          ref={(node) => {
            stageRef.current = node ?? null;
          }}
          width={typeof window !== "undefined" ? window.innerWidth : 800}
          height={typeof window !== "undefined" ? window.innerHeight - 48 : 600}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ background: "#f8fafc" }}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={line.id ?? i}
                points={line.points}
                stroke={line.color}
                strokeWidth={STROKE_WIDTH}
                lineCap="round"
                lineJoin="round"
              />
            ))}
            {currentPoints.length >= 2 && (
              <Line
                points={currentPoints}
                stroke={STROKE_COLOR}
                strokeWidth={STROKE_WIDTH}
                lineCap="round"
                lineJoin="round"
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
              (selectedLineIds.length > 0 || selectedShapeIds.length > 0) &&
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
            {textNodes.map((node) => (
              <Group key={node.id} x={node.x} y={node.y} listening={false}>
                <Rect
                  name="mindmap-node-rect"
                  width={BTN_WIDTH}
                  height={BTN_HEIGHT}
                  fill="#f1f5f9"
                  stroke="#94a3b8"
                  strokeWidth={1}
                  cornerRadius={4}
                  listening={true}
                />
                <Text
                  x={6}
                  y={5}
                  text={node.text}
                  fontSize={12}
                  fill="#1e293b"
                  listening={false}
                  width={BTN_WIDTH - 12}
                  ellipsis
                />
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
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
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => {
              if (!isMindmapGenerating) generateMindmap(contextMenu.node.text);
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
