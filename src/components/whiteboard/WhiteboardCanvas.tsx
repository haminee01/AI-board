"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Text, Group } from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "@/stores/useBoardStore";
import { useWhiteboardRealtime } from "@/contexts/WhiteboardRealtimeContext";
import { distancePointToSegment } from "@/lib/geometry";

const STROKE_COLOR = "#1e293b";
const STROKE_WIDTH = 2;
const CURSOR_RADIUS = 6;
const ERASER_RADIUS = 24;

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
    tool,
    addLine,
    removeLinesByIds,
    pushUndo,
    undo,
    redo,
  } = useBoardStore();
  const {
    broadcastLine,
    broadcastCursor,
    broadcastRemoveLines,
    clearMyCursor,
  } = useWhiteboardRealtime();
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const isDrawing = useRef(false);
  const isErasing = useRef(false);
  const eraserPushedUndo = useRef(false);
  const currentPointsRef = useRef<number[]>([]);
  currentPointsRef.current = currentPoints;

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
          pts[i + 3]!
        );
        if (d <= ERASER_RADIUS && line.id) {
          ids.push(line.id);
          break;
        }
      }
    }
    return ids;
  }, []);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const point = getPointerPosition(e);
      if (!point) return;
      if (tool === "eraser") {
        isErasing.current = true;
        eraserPushedUndo.current = false;
        const ids = findLineIdsUnder(point[0], point[1]);
        if (ids.length > 0) {
          pushUndo();
          eraserPushedUndo.current = true;
          removeLinesByIds(ids);
          broadcastRemoveLines(ids);
        }
        return;
      }
      isDrawing.current = true;
      setCurrentPoints(point);
    },
    [getPointerPosition, tool, findLineIdsUnder, pushUndo, removeLinesByIds, broadcastRemoveLines],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const point = getPointerPosition(e);
      if (point) broadcastCursor(point[0], point[1]);
      if (tool === "eraser" && isErasing.current && point) {
        const ids = findLineIdsUnder(point[0], point[1]);
        if (ids.length > 0) {
          if (!eraserPushedUndo.current) {
            pushUndo();
            eraserPushedUndo.current = true;
          }
          removeLinesByIds(ids);
          broadcastRemoveLines(ids);
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
    if (tool === "eraser") {
      isErasing.current = false;
      eraserPushedUndo.current = false;
      return;
    }
    if (!isDrawing.current) return;
    isDrawing.current = false;
    commitLine();
    setCurrentPoints([]);
  }, [commitLine, tool]);

  const handleMouseLeave = useCallback(() => {
    clearMyCursor();
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

  return (
    <Stage
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
        {textNodes.map((node) => (
          <Group key={node.id} listening={false}>
            <Text
              x={node.x}
              y={node.y}
              text={node.text}
              fontSize={14}
              fill="#1e293b"
              listening={false}
              width={160}
              wrap="word"
            />
          </Group>
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
    </Stage>
  );
}
