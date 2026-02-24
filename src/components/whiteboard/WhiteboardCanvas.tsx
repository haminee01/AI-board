"use client";

import { useCallback, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Text, Group } from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "@/stores/useBoardStore";
import { useWhiteboardRealtime } from "@/contexts/WhiteboardRealtimeContext";

const STROKE_COLOR = "#1e293b";
const STROKE_WIDTH = 2;
const CURSOR_RADIUS = 6;

function cursorLabel(name: string): string {
  return name.includes("@") ? name.split("@")[0]! : name;
}

export function WhiteboardCanvas() {
  const { lines, cursors, textNodes, addLine } = useBoardStore();
  const { broadcastLine, broadcastCursor, clearMyCursor } =
    useWhiteboardRealtime();
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const isDrawing = useRef(false);
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

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const point = getPointerPosition(e);
      if (!point) return;
      isDrawing.current = true;
      setCurrentPoints(point);
    },
    [getPointerPosition],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const point = getPointerPosition(e);
      if (point) broadcastCursor(point[0], point[1]);
      if (!isDrawing.current) return;
      if (!point) return;
      setCurrentPoints((prev) => [...prev, ...point]);
    },
    [getPointerPosition, broadcastCursor],
  );

  const commitLine = useCallback(() => {
    const points = currentPointsRef.current;
    if (points.length >= 4) {
      const line = { points: [...points], color: STROKE_COLOR };
      addLine(line);
      broadcastLine(line);
    }
  }, [addLine, broadcastLine]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    commitLine();
    setCurrentPoints([]);
  }, [commitLine]);

  const handleMouseLeave = useCallback(() => {
    clearMyCursor();
    if (isDrawing.current) {
      commitLine();
      setCurrentPoints([]);
      isDrawing.current = false;
    }
  }, [commitLine, clearMyCursor]);

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
            key={i}
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
