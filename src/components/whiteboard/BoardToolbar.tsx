"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useBoardStore } from "@/stores/useBoardStore";
import {
  useBoardsQuery,
  useSaveBoardMutation,
  useDeleteBoardMutation,
  useBoardMembersQuery,
  useBoardJoinRequestsQuery,
  useInviteMemberMutation,
  useAcceptJoinRequestMutation,
  useRejectJoinRequestMutation,
} from "@/hooks/useBoards";
import type { BoardVisibility } from "@/types/board";
import { MindGridSpinner } from "@/components/layout/MindGridSpinner";

const DEFAULT_TITLE = "제목 없음";

function toFriendlySaveErrorMessage(
  raw: unknown,
  opts: { isDemoUser: boolean },
) {
  const msg = String((raw as { message?: unknown })?.message ?? raw ?? "");
  const lower = msg.toLowerCase();

  // Supabase `.single()` 호출 시 RLS 등으로 0행이 반환되면 자주 나오는 기술적 메시지
  if (lower.includes("cannot coerce the result to a single json object")) {
    return opts.isDemoUser
      ? "데모 계정에서는 저장이 제한됩니다. 개인 계정으로 로그인하면 저장할 수 있어요."
      : "저장 권한이 없습니다. 보드 소유자이거나 초대된 멤버인지 확인해 주세요.";
  }

  if (
    lower.includes("로그인이 필요합니다") ||
    lower.includes("need to be logged")
  ) {
    return "저장하려면 로그인이 필요합니다.";
  }

  if (
    lower.includes("row-level security") ||
    lower.includes("rls") ||
    lower.includes("permission denied") ||
    lower.includes("not allowed")
  ) {
    return "저장 권한이 없습니다. 보드 소유자이거나 초대된 멤버인지 확인해 주세요.";
  }

  if (opts.isDemoUser) {
    return "데모 계정에서는 저장이 제한됩니다. (면접용 체험 계정) 개인 계정으로 로그인하면 저장할 수 있어요.";
  }

  return "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

export function BoardToolbar() {
  const { user } = useAuth();
  const { data: boards = [], isLoading } = useBoardsQuery(user?.id);
  const saveMutation = useSaveBoardMutation(user?.id);
  const deleteMutation = useDeleteBoardMutation(user?.id);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentBoard = boards.find((b) => b.id === currentBoardId);
  const isOwner = !!user && !!currentBoard && currentBoard.user_id === user.id;
  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "test@test.com";
  const isDemoUser =
    !!user?.email && user.email.toLowerCase() === demoEmail.toLowerCase();

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

  const handleDeleteBoard = () => {
    if (!currentBoardId) return;
    if (!isOwner) return;
    const ok = window.confirm(
      "정말 이 보드를 삭제할까요? 삭제는 되돌릴 수 없어요.",
    );
    if (!ok) return;

    deleteMutation.mutate(currentBoardId, {
      onSuccess: () => {
        setCurrentBoardId(null);
        setBoardContent({ lines: [], textNodes: [], shapes: [] });
        setEditingTitle(DEFAULT_TITLE);
        setEditingVisibility("private");
        setInviteOpen(false);
        setJoinRequestsOpen(false);
        if (selectRef.current) selectRef.current.value = "";
      },
    });
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

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
      setInviteOpen(false);
      setJoinRequestsOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      setInviteOpen(false);
      setJoinRequestsOpen(false);
    };

    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  if (!user) {
    return (
      <p className="text-sm text-slate-500">
        보드 저장/불러오기는 로그인 후 이용할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 sm:gap-2 sm:px-3 sm:text-sm"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <span className="text-base leading-none">☰</span>
        <span>보드 메뉴</span>
      </button>

      {menuOpen && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(92vw,26rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="space-y-3">
            <section className="space-y-2 rounded-lg border border-slate-100 p-2">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500">
                보드 선택/편집
              </h3>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block">보드</span>
                <select
                  key={selectKey}
                  ref={selectRef}
                  onChange={handleSelectBoard}
                  defaultValue={currentBoardId ?? ""}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block">제목</span>
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  placeholder={DEFAULT_TITLE}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </label>
              {currentBoardId && (
                <label className="block text-sm text-slate-700">
                  <span className="mb-1 block">공개 여부</span>
                  <select
                    value={editingVisibility}
                    onChange={(e) =>
                      setEditingVisibility(e.target.value as BoardVisibility)
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    disabled={!isOwner}
                  >
                    <option value="public">공개</option>
                    <option value="private">비공개</option>
                  </select>
                </label>
              )}
            </section>

            <section className="space-y-2 rounded-lg border border-slate-100 p-2">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500">
                저장/관리
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="relative overflow-hidden rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <>
                      <span className="relative z-10 inline-flex items-center justify-center gap-2">
                        <MindGridSpinner size={16} />
                        저장 중…
                      </span>
                      <span className="mindgrid-shimmer" aria-hidden />
                    </>
                  ) : (
                    "저장"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleNewBoard}
                  className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  새 보드
                </button>
                {isOwner && currentBoardId && (
                  <button
                    type="button"
                    onClick={handleDeleteBoard}
                    disabled={deleteMutation.isPending}
                    className="col-span-2 rounded-lg border border-orange-200 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                    title="현재 보드를 삭제합니다"
                  >
                    {deleteMutation.isPending ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <MindGridSpinner size={16} />
                        삭제 중…
                      </span>
                    ) : (
                      "보드 삭제"
                    )}
                  </button>
                )}
              </div>
            </section>

            {isOwner && currentBoard?.visibility === "private" && (
              <section className="space-y-2 rounded-lg border border-slate-100 p-2">
                <h3 className="text-xs font-semibold tracking-wide text-slate-500">
                  공유/멤버
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/board/${currentBoardId}`;
                      void navigator.clipboard.writeText(url).then(() => {
                        alert("초대 링크가 복사되었습니다.");
                      });
                    }}
                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    링크 복사
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteOpen((o) => !o);
                      setJoinRequestsOpen(false);
                    }}
                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    초대
                  </button>
                </div>

                {inviteOpen && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
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
                        className="rounded px-2 py-1 text-sm text-blue-700 hover:bg-blue-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleInvite}
                        disabled={inviteMutation.isPending}
                        className="relative overflow-hidden rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {inviteMutation.isPending ? (
                          <>
                            <span className="relative z-10 inline-flex items-center justify-center gap-2">
                              <MindGridSpinner size={16} />
                              처리 중…
                            </span>
                            <span className="mindgrid-shimmer" aria-hidden />
                          </>
                        ) : (
                          "초대"
                        )}
                      </button>
                    </div>
                    {(inviteError || inviteMutation.isError) && (
                      <p className="mt-1 text-xs text-red-600">
                        {inviteError ?? String(inviteMutation.error?.message)}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setJoinRequestsOpen((o) => !o);
                    setInviteOpen(false);
                  }}
                  className="w-full rounded-lg border border-blue-200 px-3 py-1.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  가입 요청{" "}
                  {joinRequests.length > 0 ? `(${joinRequests.length})` : ""}
                </button>

                {joinRequestsOpen && (
                  <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {joinRequests.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        대기 중인 요청 없음
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {joinRequests.map((req) => (
                          <li
                            key={req.id}
                            className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-white p-2 text-sm"
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
                                className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
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
                                className="rounded bg-[var(--accent)] px-2 py-0.5 text-xs text-white hover:bg-orange-600 disabled:opacity-50"
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
              </section>
            )}

            {saveMutation.isError && (
              <span className="block text-sm text-red-600" role="alert">
                {toFriendlySaveErrorMessage(saveMutation.error, { isDemoUser })}
              </span>
            )}
            {deleteMutation.isError && (
              <span className="block text-sm text-red-600" role="alert">
                {String(deleteMutation.error?.message)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
