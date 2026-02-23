"use client";

import { useCallback, useRef, useState } from "react";
import { Stage, Layer, Line } from "react-konva";
import type Konva from "konva";
import { useBoardStore } from "@/stores/useBoardStore";
import { useRealtimeWhiteboard } from "@/hooks/useRealtimeWhiteboard";

const STROKE_COLOR = "#1e293b";
const STROKE_WIDTH = 2;

export function WhiteboardCanvas() {
  const { lines, addLine } = useBoardStore();
  const { broadcastLine } = useRealtimeWhiteboard();
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
      if (!isDrawing.current) return;
      const point = getPointerPosition(e);
      if (!point) return;
      setCurrentPoints((prev) => [...prev, ...point]);
    },
    [getPointerPosition],
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
    if (isDrawing.current) {
      commitLine();
      setCurrentPoints([]);
      isDrawing.current = false;
    }
  }, [commitLine]);

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
      </Layer>
    </Stage>
  );
}
