"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useBoardStore } from "@/stores/useBoardStore";
import type { LineData } from "@/stores/useBoardStore";
import type { CursorData } from "@/stores/useBoardStore";
import type { MindmapNode } from "@/stores/useBoardStore";
import { useAuth } from "@/lib/auth/auth-context";

const CHANNEL_NAME = "whiteboard:default";
const BROADCAST_EVENT_LINE = "line";
const BROADCAST_EVENT_CURSOR = "cursor";
const BROADCAST_EVENT_MINDMAP = "mindmap";
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

export function useRealtimeWhiteboard() {
  const { user } = useAuth();
  const addLine = useBoardStore((s) => s.addLine);
  const setCursor = useBoardStore((s) => s.setCursor);
  const addMindmapNodes = useBoardStore((s) => s.addMindmapNodes);
  const clientIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);
  const pendingLinesRef = useRef<LineData[]>([]);
  const cursorColorRef = useRef<string>(pickCursorColor());
  const lastCursorSentRef = useRef<number>(0);
  const lastCursorPosRef = useRef<{ x: number; y: number } | null>(null);
  const displayNameRef = useRef<string>("익명");
  displayNameRef.current = getDisplayName(user);

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
    const channel = supabase.channel(CHANNEL_NAME);
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
  }, [addLine, setCursor, addMindmapNodes, sendOneLine]);

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
    clearMyCursor,
    clientId: clientIdRef.current,
  };
}
