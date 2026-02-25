"use client";

import { useCallback, useState } from "react";
import { useBoardStore } from "@/stores/useBoardStore";
import { useWhiteboardRealtime } from "@/contexts/WhiteboardRealtimeContext";
import { layoutMindmapNodes } from "@/lib/mindmapLayout";

/**
 * 키워드로 AI 마인드맵을 생성해 스토어에 추가하고 Realtime으로 브로드캐스트합니다.
 * (입력창 생성 + 노드 클릭 시 한 단계 더 생성에 공통 사용)
 */
export function useMindmapGenerate() {
  const addMindmapNodes = useBoardStore((s) => s.addMindmapNodes);
  const { broadcastMindmapNodes } = useWhiteboardRealtime();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(
    async (keyword: string) => {
      const k = keyword.trim();
      if (!k) return;
      setIsGenerating(true);
      try {
        const base =
          typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${base}/api/mindmap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: k }),
        });
        const data = await res.json();
        if (!res.ok) return;
        const texts = data.nodes ?? [];
        if (texts.length === 0) return;
        const startIndex = useBoardStore.getState().textNodes.length;
        const nodes = layoutMindmapNodes(texts, startIndex);
        addMindmapNodes(nodes);
        broadcastMindmapNodes(nodes);
      } finally {
        setIsGenerating(false);
      }
    },
    [addMindmapNodes, broadcastMindmapNodes],
  );

  return { generate, isGenerating };
}
