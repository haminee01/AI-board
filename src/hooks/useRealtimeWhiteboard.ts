"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useBoardStore } from "@/stores/useBoardStore";
import type { LineData, ShapeData } from "@/stores/useBoardStore";
import type { CursorData } from "@/stores/useBoardStore";
import type { MindmapNode } from "@/stores/useBoardStore";
import { useAuth } from "@/lib/auth/auth-context";

const CHANNEL_PREFIX = "whiteboard:";
const BROADCAST_EVENT_LINE = "line";
const BROADCAST_EVENT_CURSOR = "cursor";
const BROADCAST_EVENT_MINDMAP = "mindmap";
const BROADCAST_EVENT_REMOVE_MINDMAP_NODE = "removeMindmapNode";
const BROADCAST_EVENT_REMOVE_LINES = "removeLines";
const BROADCAST_EVENT_UPDATE_LINE = "updateLine";
const BROADCAST_EVENT_SHAPE = "shape";
const BROADCAST_EVENT_REMOVE_SHAPES = "removeShapes";
const BROADCAST_EVENT_UPDATE_SHAPE = "updateShape";
const CURSOR_THROTTLE_MS = 80;

const CURSOR_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
];

function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function pickCursorColor(): string {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

function getDisplayName(
  user: {
    user_metadata?: { full_name?: string };
    email?: string;
    id?: string;
  } | null,
): string {
  if (!user) return "익명";
  const name = user.user_metadata?.full_name;
  if (name && String(name).trim()) return String(name).trim();
  if (user.email) {
    const email = user.email;
    return email.includes("@") ? email.split("@")[0]! : email;
  }
  if (user.id) return user.id.slice(0, 8);
  return "익명";
}

type LinePayload = { line: LineData; clientId: string };
type CursorPayload = {
  clientId: string;
  x: number;
  y: number;
  color: string;
  displayName?: string;
};
type MindmapPayload = { nodes: MindmapNode[] };
type RemoveMindmapNodePayload = { nodeId: string };
type RemoveLinesPayload = { lineIds: string[] };
type UpdateLinePayload = { lineId: string; points: number[] };
type ShapePayload = { shape: ShapeData };
type RemoveShapesPayload = { shapeIds: string[] };
type UpdateShapePayload = { shapeId: string; x: number; y: number };

export function useRealtimeWhiteboard() {
  const { user } = useAuth();
  const currentBoardId = useBoardStore((s) => s.currentBoardId);
  const addLine = useBoardStore((s) => s.addLine);
  const setCursor = useBoardStore((s) => s.setCursor);
  const addMindmapNodes = useBoardStore((s) => s.addMindmapNodes);
  const setTextNodes = useBoardStore((s) => s.setTextNodes);
  const removeLinesByIds = useBoardStore((s) => s.removeLinesByIds);
  const updateLine = useBoardStore((s) => s.updateLine);
  const addShape = useBoardStore((s) => s.addShape);
  const removeShapesByIds = useBoardStore((s) => s.removeShapesByIds);
  const updateShape = useBoardStore((s) => s.updateShape);
  const clientIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);
  const pendingLinesRef = useRef<LineData[]>([]);
  const cursorColorRef = useRef<string>(pickCursorColor());
  const lastCursorSentRef = useRef<number>(0);
  const lastCursorPosRef = useRef<{ x: number; y: number } | null>(null);
  const displayNameRef = useRef<string>("익명");
  displayNameRef.current = getDisplayName(user);

  // 로그인했고 특정 보드를 선택했을 때만 실시간 채널 사용 (익명/미선택 시 채널 미연결)
  const channelName =
    user && currentBoardId ? `${CHANNEL_PREFIX}${currentBoardId}` : null;

  if (typeof window !== "undefined" && !clientIdRef.current) {
    clientIdRef.current = generateClientId();
  }

  const sendOneLine = useCallback((ch: RealtimeChannel, line: LineData) => {
    ch.send({
      type: "broadcast",
      event: BROADCAST_EVENT_LINE,
      payload: { line, clientId: clientIdRef.current ?? generateClientId() },
    });
  }, []);

  const sendCursor = useCallback(
    (ch: RealtimeChannel, x: number, y: number) => {
      const clientId = clientIdRef.current ?? generateClientId();
      const payload: CursorPayload = {
        clientId,
        x,
        y,
        color: cursorColorRef.current,
        displayName: displayNameRef.current,
      };
      ch.send({
        type: "broadcast",
        event: BROADCAST_EVENT_CURSOR,
        payload,
      });
      setCursor(clientId, {
        x,
        y,
        color: cursorColorRef.current,
        displayName: displayNameRef.current,
      });
    },
    [setCursor],
  );

  useEffect(() => {
    isSubscribedRef.current = false;
    channelRef.current = null;
    if (!channelName) {
      return;
    }
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const onBroadcast = (ev: string, handler: (p: unknown) => void) =>
      (
        channel as {
          on: (
            ev: string,
            opts: { event: string },
            cb: (p: unknown) => void,
          ) => typeof channel;
        }
      ).on("broadcast", { event: ev }, handler);

    onBroadcast(BROADCAST_EVENT_LINE, (payload: unknown) => {
      const p = payload as { payload?: LinePayload } & LinePayload;
      const data = p.payload ?? p;
      const { line, clientId } = data ?? {};
      if (!line?.points?.length || !clientId) return;
      if (clientId === clientIdRef.current) return;
      addLine(line);
    });

    onBroadcast(BROADCAST_EVENT_CURSOR, (payload: unknown) => {
      const p = payload as { payload?: CursorPayload } & CursorPayload;
      const data = p.payload ?? p;
      const { clientId, x, y, color, displayName } = data ?? {};
      if (clientId == null || typeof x !== "number" || typeof y !== "number")
        return;
      if (clientId === clientIdRef.current) return;
      setCursor(clientId, {
        x,
        y,
        color: color ?? "#64748b",
        displayName: displayName ?? "익명",
      });
    });

    onBroadcast(BROADCAST_EVENT_MINDMAP, (payload: unknown) => {
      const p = payload as { payload?: MindmapPayload } & MindmapPayload;
      const data = p.payload ?? p;
      const nodes = data?.nodes;
      if (Array.isArray(nodes) && nodes.length > 0) addMindmapNodes(nodes);
    });

    onBroadcast(BROADCAST_EVENT_REMOVE_MINDMAP_NODE, (payload: unknown) => {
      const p = payload as {
        payload?: RemoveMindmapNodePayload;
      } & RemoveMindmapNodePayload;
      const data = p.payload ?? p;
      const nodeId = data?.nodeId;
      if (typeof nodeId === "string" && nodeId) {
        const current = useBoardStore.getState().textNodes;
        setTextNodes(current.filter((n) => n.id !== nodeId));
      }
    });

    onBroadcast(BROADCAST_EVENT_REMOVE_LINES, (payload: unknown) => {
      const p = payload as {
        payload?: RemoveLinesPayload;
      } & RemoveLinesPayload;
      const data = p.payload ?? p;
      const lineIds = data?.lineIds;
      if (Array.isArray(lineIds) && lineIds.length > 0)
        removeLinesByIds(lineIds);
    });

    onBroadcast(BROADCAST_EVENT_UPDATE_LINE, (payload: unknown) => {
      const p = payload as { payload?: UpdateLinePayload } & UpdateLinePayload;
      const data = p.payload ?? p;
      const { lineId, points } = data ?? {};
      if (lineId && Array.isArray(points) && points.length >= 2)
        updateLine(lineId, points);
    });

    onBroadcast(BROADCAST_EVENT_SHAPE, (payload: unknown) => {
      const p = payload as { payload?: ShapePayload } & ShapePayload;
      const data = p.payload ?? p;
      const shape = data?.shape;
      if (
        shape?.type &&
        typeof shape.x === "number" &&
        typeof shape.y === "number"
      )
        addShape(shape);
    });

    onBroadcast(BROADCAST_EVENT_REMOVE_SHAPES, (payload: unknown) => {
      const p = payload as {
        payload?: RemoveShapesPayload;
      } & RemoveShapesPayload;
      const data = p.payload ?? p;
      const shapeIds = data?.shapeIds;
      if (Array.isArray(shapeIds) && shapeIds.length > 0)
        removeShapesByIds(shapeIds);
    });

    onBroadcast(BROADCAST_EVENT_UPDATE_SHAPE, (payload: unknown) => {
      const p = payload as {
        payload?: UpdateShapePayload;
      } & UpdateShapePayload;
      const data = p.payload ?? p;
      const { shapeId, x, y } = data ?? {};
      if (shapeId && typeof x === "number" && typeof y === "number")
        updateShape(shapeId, { x, y });
    });

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        isSubscribedRef.current = true;
        pendingLinesRef.current.forEach((line) => sendOneLine(channel, line));
        pendingLinesRef.current = [];
      }
    });

    return () => {
      isSubscribedRef.current = false;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [
    addLine,
    setCursor,
    addMindmapNodes,
    setTextNodes,
    removeLinesByIds,
    updateLine,
    addShape,
    removeShapesByIds,
    updateShape,
    sendOneLine,
    channelName,
  ]);

  const broadcastLine = useCallback(
    (line: LineData) => {
      const ch = channelRef.current;
      if (!ch) return;
      if (isSubscribedRef.current) {
        sendOneLine(ch, line);
      } else {
        pendingLinesRef.current.push(line);
      }
    },
    [sendOneLine],
  );

  const broadcastCursor = useCallback(
    (x: number, y: number) => {
      const ch = channelRef.current;
      if (!ch || !isSubscribedRef.current) return;
      const now = Date.now();
      if (now - lastCursorSentRef.current < CURSOR_THROTTLE_MS) {
        lastCursorPosRef.current = { x, y };
        return;
      }
      lastCursorSentRef.current = now;
      lastCursorPosRef.current = null;
      sendCursor(ch, x, y);
    },
    [sendCursor],
  );

  const clearMyCursor = useCallback(() => {
    const id = clientIdRef.current;
    if (id) setCursor(id, null);
  }, [setCursor]);

  const broadcastMindmapNodes = useCallback((nodes: MindmapNode[]) => {
    const ch = channelRef.current;
    if (!ch || !isSubscribedRef.current) return;
    ch.send({
      type: "broadcast",
      event: BROADCAST_EVENT_MINDMAP,
      payload: { nodes },
    });
  }, []);

  const broadcastRemoveMindmapNode = useCallback((nodeId: string) => {
    const ch = channelRef.current;
    if (!ch || !isSubscribedRef.current || !nodeId) return;
    ch.send({
      type: "broadcast",
      event: BROADCAST_EVENT_REMOVE_MINDMAP_NODE,
      payload: { nodeId },
    });
  }, []);

  const broadcastRemoveLines = useCallback((lineIds: string[]) => {
    const ch = channelRef.current;
    if (!ch || !isSubscribedRef.current || lineIds.length === 0) return;
    ch.send({
      type: "broadcast",
      event: BROADCAST_EVENT_REMOVE_LINES,
      payload: { lineIds },
    });
  }, []);

  const broadcastUpdateLine = useCallback(
    (lineId: string, points: number[]) => {
      const ch = channelRef.current;
      if (!ch || !isSubscribedRef.current) return;
      ch.send({
        type: "broadcast",
        event: BROADCAST_EVENT_UPDATE_LINE,
        payload: { lineId, points },
      });
    },
    [],
  );

  const broadcastShape = useCallback((shape: ShapeData) => {
    const ch = channelRef.current;
    if (!ch || !isSubscribedRef.current) return;
    ch.send({
      type: "broadcast",
      event: BROADCAST_EVENT_SHAPE,
      payload: { shape },
    });
  }, []);

  const broadcastRemoveShapes = useCallback((shapeIds: string[]) => {
    const ch = channelRef.current;
    if (!ch || !isSubscribedRef.current || shapeIds.length === 0) return;
    ch.send({
      type: "broadcast",
      event: BROADCAST_EVENT_REMOVE_SHAPES,
      payload: { shapeIds },
    });
  }, []);

  const broadcastUpdateShape = useCallback(
    (shapeId: string, x: number, y: number) => {
      const ch = channelRef.current;
      if (!ch || !isSubscribedRef.current) return;
      ch.send({
        type: "broadcast",
        event: BROADCAST_EVENT_UPDATE_SHAPE,
        payload: { shapeId, x, y },
      });
    },
    [],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const pos = lastCursorPosRef.current;
      if (!pos) return;
      const ch = channelRef.current;
      if (!ch || !isSubscribedRef.current) return;
      lastCursorPosRef.current = null;
      lastCursorSentRef.current = Date.now();
      sendCursor(ch, pos.x, pos.y);
    }, CURSOR_THROTTLE_MS);
    return () => clearInterval(interval);
  }, [sendCursor]);

  return {
    broadcastLine,
    broadcastCursor,
    broadcastMindmapNodes,
    broadcastRemoveMindmapNode,
    broadcastRemoveLines,
    broadcastUpdateLine,
    broadcastShape,
    broadcastRemoveShapes,
    broadcastUpdateShape,
    clearMyCursor,
    clientId: clientIdRef.current,
  };
}
