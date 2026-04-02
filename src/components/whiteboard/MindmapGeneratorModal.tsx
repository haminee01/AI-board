"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMindmapGeneratePreview } from "@/hooks/useMindmapGeneratePreview";
import { useMindmapGeneratorModalStore } from "@/stores/useMindmapGeneratorModalStore";

function toMindmapFriendlyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const lower = msg.toLowerCase();
  const isNetwork =
    lower.includes("failed to fetch") ||
    lower.includes("err_name_not_resolved") ||
    lower.includes("name not resolved") ||
    lower.includes("dns") ||
    lower.includes("timeout") ||
    lower.includes("fetch");
  if (isNetwork) {
    return "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (!msg) return "요청 처리에 실패했습니다.";
  return msg;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function MindmapGeneratorModal() {
  const { isOpen, keyword, autoGenerate, close } =
    useMindmapGeneratorModalStore();
  const { generatePreview, isGenerating } = useMindmapGeneratePreview();

  const [keywordValue, setKeywordValue] = useState(keyword);
  const [results, setResults] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    offsetX: number;
    offsetY: number;
  }>({ active: false, offsetX: 0, offsetY: 0 });

  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 24, y: 84 });
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const lastAutoKeywordRef = useRef<string | null>(null);

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return results;
    return results.filter((t) => t.toLowerCase().includes(q));
  }, [results, search]);

  const onGenerate = useCallback(
    async (k: string) => {
      const kw = k.trim();
      if (!kw) return;

      setError(null);
      setResults([]);
      const res = await generatePreview(kw);
      if (res.error) {
        setError(toMindmapFriendlyError(res.error));
        return;
      }
      setResults(res.nodes);
    },
    [generatePreview],
  );

  // 모달 열릴 때 입력값/결과 초기화
  useEffect(() => {
    if (!isOpen) return;
    setKeywordValue(keyword);
    setResults([]);
    setSearch("");
    setError(null);
    // 같은 키워드로 autoGenerate를 반복 호출하는 것을 방지
    lastAutoKeywordRef.current = null;
  }, [isOpen, keyword]);

  // store에서 autoGenerate가 켜진 경우: 모달 진입 즉시 생성
  useEffect(() => {
    if (!isOpen) return;
    if (!autoGenerate) return;
    if (isGenerating) return;

    const kw = keyword.trim();
    if (!kw) return;
    if (lastAutoKeywordRef.current === kw) return;

    lastAutoKeywordRef.current = kw;
    void onGenerate(kw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, isOpen, isGenerating, keyword]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, isOpen]);

  useEffect(() => {
    const syncViewport = () => {
      const compact = window.innerWidth < 768;
      setIsCompactViewport(compact);
      const vv = window.visualViewport;
      const vw = vv?.width ?? window.innerWidth;
      const vh = vv?.height ?? window.innerHeight;
      if (compact) {
        setPos({ x: 8, y: 8 });
      } else {
        setPos((prev) => {
          const panelWidth = 460;
          const panelHeight = 520;
          const maxX = Math.max(8, vw - panelWidth - 8);
          const maxY = Math.max(8, vh - panelHeight - 8);
          return {
            x: clamp(prev.x, 8, maxX),
            y: clamp(prev.y, 8, maxY),
          };
        });
      }
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
    };
  }, []);

  const startDrag = useCallback((clientX: number, clientY: number) => {
    const rect = panelRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 420;
    const height = rect?.height ?? 520;

    // 패널 내부에서 마우스가 잡힌 위치(클릭 오프셋)
    const offsetX = clientX - (rect?.left ?? clientX);
    const offsetY = clientY - (rect?.top ?? clientY);

    dragRef.current.active = true;
    dragRef.current.offsetX = offsetX;
    dragRef.current.offsetY = offsetY;

    // 드래그 동안 텍스트 선택 방지
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    // move/up 리스너는 전역에서 처리
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return;
      const nextX = e.clientX - dragRef.current.offsetX;
      const nextY = e.clientY - dragRef.current.offsetY;

      const vv = window.visualViewport;
      const vw = vv?.width ?? window.innerWidth;
      const vh = vv?.height ?? window.innerHeight;
      const maxX = vw - width - 8;
      const maxY = vh - height - 8;
      setPos({
        x: clamp(nextX, 8, Math.max(8, maxX)),
        y: clamp(nextY, 8, Math.max(8, maxY)),
      });
    };

    const onUp = () => {
      dragRef.current.active = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const isInteractiveTarget = useCallback((target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return (
      !!el.closest(
        "button, input, textarea, select, label, a, [role='button']",
      ) || el.isContentEditable
    );
  }, []);

  const onPanelPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isCompactViewport) return;
      if (e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;
      startDrag(e.clientX, e.clientY);
    },
    [isCompactViewport, isInteractiveTarget, startDrag],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/30"
        onPointerDown={() => close()}
        aria-hidden
      />

      <div
        ref={panelRef}
        className="absolute max-h-[min(92dvh,calc(100svh-1rem))] w-[min(460px,calc(100vw-1rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        style={
          isCompactViewport
            ? {
                left: "max(8px, env(safe-area-inset-left, 0px))",
                right: "max(8px, env(safe-area-inset-right, 0px))",
                top: "max(8px, env(safe-area-inset-top, 0px))",
                bottom: "max(8px, env(safe-area-inset-bottom, 0px))",
                width: "auto",
              }
            : { left: pos.x, top: pos.y }
        }
        onPointerDown={onPanelPointerDown}
      >
        <div
          className={`flex items-center justify-between gap-2 rounded-t-xl border-b bg-slate-50 px-3 py-2 ${
            isCompactViewport ? "cursor-default" : "cursor-move"
          }`}
          onPointerDown={(e) => {
            if (isCompactViewport) return;
            if (e.button !== 0) return;
            const el = e.target as HTMLElement | null;
            if (
              el?.closest(
                "button, input, textarea, select, label, a, [role='button']",
              )
            )
              return;
            startDrag(e.clientX, e.clientY);
          }}
        >
          <div>
            <p className="text-sm font-semibold text-slate-800">
              AI 마인드맵 생성
            </p>
          </div>

          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => close()}
          >
            닫기
          </button>
        </div>

        <div className="space-y-3 overflow-auto p-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              키워드
            </label>
            <input
              value={keywordValue}
              onChange={(e) => setKeywordValue(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100"
              disabled={isGenerating}
              placeholder="예: 머신러닝, 여행, 우주"
              data-no-drag="true"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isGenerating || !keywordValue.trim()}
              onClick={() => void onGenerate(keywordValue)}
              className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {isGenerating ? "생성 중…" : "AI 생성"}
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => {
                setKeywordValue("");
                setResults([]);
                setSearch("");
                setError(null);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              초기화
            </button>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">결과 단어</p>
              <p className="text-xs text-slate-500">{results.length}개</p>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-100"
              disabled={results.length === 0}
              placeholder="결과 단어 검색"
              data-no-drag="true"
            />

            <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
              {results.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-slate-500">
                  키워드를 입력하고 “AI 생성”을 눌러보세요.
                </p>
              ) : filteredResults.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-slate-500">
                  검색 결과가 없어요.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredResults.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                      title={t}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
