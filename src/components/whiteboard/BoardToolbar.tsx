"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useBoardStore } from "@/stores/useBoardStore";
import {
  useBoardsQuery,
  useSaveBoardMutation,
  useBoardMembersQuery,
  useBoardJoinRequestsQuery,
  useInviteMemberMutation,
  useAcceptJoinRequestMutation,
  useRejectJoinRequestMutation,
} from "@/hooks/useBoards";
import type { BoardVisibility } from "@/types/board";

const DEFAULT_TITLE = "제목 없음";

export function BoardToolbar() {
  const { user } = useAuth();
  const { data: boards = [], isLoading } = useBoardsQuery(user?.id);
  const saveMutation = useSaveBoardMutation(user?.id);
  const inviteMutation = useInviteMemberMutation(user?.id);
  const acceptMutation = useAcceptJoinRequestMutation(user?.id);
  const rejectMutation = useRejectJoinRequestMutation(user?.id);
  const {
    lines,
    textNodes,
    shapes,
    currentBoardId,
    setBoardContent,
    setCurrentBoardId,
  } = useBoardStore();

  const [selectKey, setSelectKey] = useState(0);
  const [editingTitle, setEditingTitle] = useState(DEFAULT_TITLE);
  const [editingVisibility, setEditingVisibility] =
    useState<BoardVisibility>("private");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [joinRequestsOpen, setJoinRequestsOpen] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  const currentBoard = boards.find((b) => b.id === currentBoardId);
  const isOwner = !!user && !!currentBoard && currentBoard.user_id === user.id;

  const { data: members = [] } = useBoardMembersQuery(currentBoardId, isOwner);
  const { data: joinRequests = [] } = useBoardJoinRequestsQuery(
    currentBoardId,
    isOwner,
  );

  const handleSelectBoard = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (id === "") {
      setCurrentBoardId(null);
      setBoardContent({ lines: [], textNodes: [], shapes: [] });
      setEditingTitle(DEFAULT_TITLE);
      setEditingVisibility("private");
      return;
    }
    const board = boards.find((b) => b.id === id);
    if (board?.content) {
      setCurrentBoardId(board.id);
      setEditingTitle(board.title || DEFAULT_TITLE);
      setEditingVisibility(
        (board as { visibility?: BoardVisibility }).visibility ?? "private",
      );
      setBoardContent({
        lines: board.content.lines ?? [],
        textNodes: board.content.textNodes ?? [],
        shapes: board.content.shapes ?? [],
      });
    }
  };

  const handleSave = () => {
    if (!user) return;
    const content = { lines, textNodes, shapes };
    const title = editingTitle.trim() || DEFAULT_TITLE;
    saveMutation.mutate(
      {
        id: currentBoardId,
        title,
        content,
        visibility: editingVisibility,
      },
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
    setBoardContent({ lines: [], textNodes: [], shapes: [] });
    setEditingTitle(DEFAULT_TITLE);
    setEditingVisibility("private");
    if (selectRef.current) selectRef.current.value = "";
  };

  const handleInvite = async () => {
    setInviteError(null);
    const email = inviteEmail.trim();
    if (!email || !currentBoardId || !user) return;
    try {
      const res = await fetch(
        `/api/users/lookup?email=${encodeURIComponent(email)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "조회 실패");
        return;
      }
      const inviteeUserId = data.userId as string;
      if (inviteeUserId === user.id) {
        setInviteError("본인은 초대할 수 없습니다. (이미 보드 소유자입니다)");
        return;
      }
      if (members.some((m) => m.user_id === inviteeUserId)) {
        setInviteError("이미 초대된 멤버입니다.");
        return;
      }
      inviteMutation.mutate(
        { boardId: currentBoardId, inviteeUserId },
        {
          onSuccess: () => {
            setInviteEmail("");
            setInviteOpen(false);
          },
          onError: (e) => {
            const msg = e.message ?? "";
            setInviteError(
              msg.includes("duplicate") || msg.includes("unique constraint")
                ? "이미 초대된 사용자입니다."
                : msg,
            );
          },
        },
      );
    } catch {
      setInviteError("요청 실패");
    }
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
              {(b as { visibility?: string }).visibility === "public"
                ? " (공개)"
                : ""}
            </option>
          ))}
        </select>
      </label>
      {currentBoardId && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          공개
          <select
            value={editingVisibility}
            onChange={(e) =>
              setEditingVisibility(e.target.value as BoardVisibility)
            }
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            disabled={!isOwner}
          >
            <option value="public">공개</option>
            <option value="private">비공개</option>
          </select>
        </label>
      )}
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
      {isOwner && currentBoard?.visibility === "private" && (
        <>
          <button
            type="button"
            onClick={() => {
              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/board/${currentBoardId}`;
              void navigator.clipboard.writeText(url).then(() => {
                alert("초대 링크가 복사되었습니다.");
              });
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            링크 복사
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setInviteOpen((o) => !o)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              초대
            </button>
            {inviteOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteError(null);
                  }}
                  placeholder="이메일 입력"
                  className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setInviteOpen(false);
                      setInviteError(null);
                    }}
                    className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={inviteMutation.isPending}
                    className="rounded bg-slate-700 px-2 py-1 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {inviteMutation.isPending ? "처리 중…" : "초대"}
                  </button>
                </div>
                {(inviteError || inviteMutation.isError) && (
                  <p className="mt-1 text-xs text-red-600">
                    {inviteError ?? String(inviteMutation.error?.message)}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setJoinRequestsOpen((o) => !o)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              가입 요청{" "}
              {joinRequests.length > 0 ? `(${joinRequests.length})` : ""}
            </button>
            {joinRequestsOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-64 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                {joinRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">대기 중인 요청 없음</p>
                ) : (
                  <ul className="space-y-2">
                    {joinRequests.map((req) => (
                      <li
                        key={req.id}
                        className="flex items-center justify-between gap-2 rounded border border-slate-100 p-2 text-sm"
                      >
                        <span className="truncate text-slate-700">
                          {req.user_id.slice(0, 8)}…
                        </span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              acceptMutation.mutate({
                                requestId: req.id,
                                boardId: req.board_id,
                                acceptedUserId: req.user_id,
                              });
                            }}
                            disabled={acceptMutation.isPending}
                            className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            수락
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              rejectMutation.mutate({
                                requestId: req.id,
                                boardId: req.board_id,
                              });
                            }}
                            disabled={rejectMutation.isPending}
                            className="rounded bg-slate-400 px-2 py-0.5 text-xs text-white hover:bg-slate-500 disabled:opacity-50"
                          >
                            거절
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {saveMutation.isError && (
        <span className="text-sm text-red-600" role="alert">
          {String(saveMutation.error?.message)}
        </span>
      )}
    </div>
  );
}
