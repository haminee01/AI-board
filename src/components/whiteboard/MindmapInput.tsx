"use client";

import { useState } from "react";
import { useBoardStore } from "@/stores/useBoardStore";
import { useWhiteboardRealtime } from "@/contexts/WhiteboardRealtimeContext";
import { layoutMindmapNodes } from "@/lib/mindmapLayout";

export function MindmapInput() {
  const textNodes = useBoardStore((s) => s.textNodes);
  const addMindmapNodes = useBoardStore((s) => s.addMindmapNodes);
  const { broadcastMindmapNodes } = useWhiteboardRealtime();
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const k = keyword.trim();
    if (!k) return;
    setError(null);
    setLoading(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/mindmap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: k }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "요청 실패");
        return;
      }
      const texts = data.nodes ?? [];
      if (texts.length === 0) {
        setError("생성된 항목이 없습니다.");
        return;
      }
      const nodes = layoutMindmapNodes(texts, textNodes.length);
      addMindmapNodes(nodes);
      broadcastMindmapNodes(nodes);
      setKeyword("");
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="키워드 입력 후 AI 마인드맵 생성"
        className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !keyword.trim()}
        className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {loading ? "생성 중…" : "AI 생성"}
      </button>
      {error && (
        <span className="text-sm text-red-600" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}
