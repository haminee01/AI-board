"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useBoardStore } from "@/stores/useBoardStore";
import type { LineData } from "@/stores/useBoardStore";

const CHANNEL_NAME = "whiteboard:default";
const BROADCAST_EVENT = "line";

function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

type BroadcastPayload = { line: LineData; clientId: string };

export function useRealtimeWhiteboard() {
  const addLine = useBoardStore((s) => s.addLine);
  const clientIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);
  const pendingLinesRef = useRef<LineData[]>([]);

  if (typeof window !== "undefined" && !clientIdRef.current) {
    clientIdRef.current = generateClientId();
  }

  const sendOne = useCallback((ch: RealtimeChannel, line: LineData) => {
    ch.send({
      type: "broadcast",
      event: BROADCAST_EVENT,
      payload: { line, clientId: clientIdRef.current ?? generateClientId() },
    });
  }, []);

  useEffect(() => {
    isSubscribedRef.current = false;
    const channel = supabase.channel(CHANNEL_NAME);
    channelRef.current = channel;

    // RealtimeChannel 타입에 broadcast 오버로드가 없을 수 있어 단언 사용
    (
      channel as {
        on: (
          ev: string,
          opts: { event: string },
          cb: (p: unknown) => void,
        ) => typeof channel;
      }
    )
      .on("broadcast", { event: BROADCAST_EVENT }, (payload: unknown) => {
        const p = payload as { payload?: BroadcastPayload } & BroadcastPayload;
        const data = p.payload ?? p;
        const { line, clientId } = data ?? {};
        if (!line?.points?.length || !clientId) return;
        if (clientId === clientIdRef.current) return;
        addLine(line);
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          isSubscribedRef.current = true;
          pendingLinesRef.current.forEach((line) => sendOne(channel, line));
          pendingLinesRef.current = [];
        }
      });

    return () => {
      isSubscribedRef.current = false;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [addLine, sendOne]);

  const broadcastLine = useCallback(
    (line: LineData) => {
      const ch = channelRef.current;
      if (!ch) return;
      if (isSubscribedRef.current) {
        sendOne(ch, line);
      } else {
        pendingLinesRef.current.push(line);
      }
    },
    [sendOne],
  );

  return { broadcastLine };
}
