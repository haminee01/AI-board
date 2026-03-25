"use client";

import { useCallback, useState } from "react";

export function useMindmapGeneratePreview() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePreview = useCallback(
    async (
      keyword: string,
    ): Promise<{ nodes: string[]; error: Error | null }> => {
      const k = keyword.trim();
      if (!k) {
        return { nodes: [], error: new Error("키워드를 입력해 주세요.") };
      }

      setIsGenerating(true);
      try {
        const base =
          typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${base}/api/mindmap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: k }),
        });

        const data: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          const maybeError =
            (data as { error?: unknown } | null)?.error ?? null;
          return {
            nodes: [],
            error: new Error(
              typeof maybeError === "string" ? maybeError : "요청 실패",
            ),
          };
        }

        const nodesRaw =
          (data as { nodes?: unknown } | null)?.nodes ?? undefined;
        const nodes =
          Array.isArray(nodesRaw) &&
          nodesRaw.every((t) => typeof t === "string")
            ? (nodesRaw as string[])
            : [];

        if (nodes.length === 0) {
          return {
            nodes: [],
            error: new Error("생성된 항목이 없습니다."),
          };
        }

        return { nodes, error: null };
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  return { generatePreview, isGenerating };
}
