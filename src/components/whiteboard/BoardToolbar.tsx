"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useBoardStore } from "@/stores/useBoardStore";
import { useBoardsQuery, useSaveBoardMutation } from "@/hooks/useBoards";

const DEFAULT_TITLE = "제목 없음";

export function BoardToolbar() {
  const { user } = useAuth();
  const { data: boards = [], isLoading } = useBoardsQuery(user?.id);
  const saveMutation = useSaveBoardMutation(user?.id);
  const {
    lines,
    textNodes,
    currentBoardId,
    setBoardContent,
    setCurrentBoardId,
  } = useBoardStore();

  const [selectKey, setSelectKey] = useState(0);
  const [editingTitle, setEditingTitle] = useState(DEFAULT_TITLE);
  const selectRef = useRef<HTMLSelectElement>(null);

  const currentBoard = boards.find((b) => b.id === currentBoardId);

  const handleSelectBoard = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id === "") {
      setCurrentBoardId(null);
      setBoardContent({ lines: [], textNodes: [] });
      setEditingTitle(DEFAULT_TITLE);
      return;
    }
    const board = boards.find((b) => b.id === id);
    if (board?.content) {
      setCurrentBoardId(board.id);
      setEditingTitle(board.title || DEFAULT_TITLE);
      setBoardContent({
        lines: board.content.lines ?? [],
        textNodes: board.content.textNodes ?? [],
      });
    }
  };

  const handleSave = () => {
    if (!user) return;
    const content = { lines, textNodes };
    const title = editingTitle.trim() || DEFAULT_TITLE;
    saveMutation.mutate(
      { id: currentBoardId, title, content },
      {
        onSuccess: (saved) => {
          setCurrentBoardId(saved.id);
          setSelectKey((k) => k + 1);
        },
      },
    );
  };

  const handleNewBoard = () => {
    setCurrentBoardId(null);
    setBoardContent({ lines: [], textNodes: [] });
    setEditingTitle(DEFAULT_TITLE);
    if (selectRef.current) selectRef.current.value = "";
  };

  if (!user) {
    return (
      <p className="text-sm text-slate-500">
        보드 저장/불러오기는 로그인 후 이용할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        제목
        <input
          type="text"
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          placeholder={DEFAULT_TITLE}
          className="w-36 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        보드
        <select
          key={selectKey}
          ref={selectRef}
          onChange={handleSelectBoard}
          defaultValue={currentBoardId ?? ""}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          disabled={isLoading}
        >
          <option value="">(새 보드)</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title || DEFAULT_TITLE}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {saveMutation.isPending ? "저장 중…" : "저장"}
      </button>
      <button
        type="button"
        onClick={handleNewBoard}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        새 보드
      </button>
      {saveMutation.isError && (
        <span className="text-sm text-red-600" role="alert">
          {String(saveMutation.error?.message)}
        </span>
      )}
    </div>
  );
}
