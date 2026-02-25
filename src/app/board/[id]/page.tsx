"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { useBoardStore } from "@/stores/useBoardStore";
import { useBoardByIdQuery, useRequestToJoinMutation } from "@/hooks/useBoards";
import { useEffect, useState } from "react";

export default function BoardByIdPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : null;
  const { user, loading: authLoading } = useAuth();
  const setCurrentBoardId = useBoardStore((s) => s.setCurrentBoardId);
  const setBoardContent = useBoardStore((s) => s.setBoardContent);

  const {
    data: board,
    isLoading: boardLoading,
    error: boardError,
    isSuccess,
  } = useBoardByIdQuery(id, user?.id);
  const requestMutation = useRequestToJoinMutation(user?.id);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    if (!isSuccess || !board) return;
    setCurrentBoardId(board.id);
    setBoardContent({
      lines: board.content?.lines ?? [],
      textNodes: board.content?.textNodes ?? [],
      shapes: board.content?.shapes ?? [],
    });
    router.replace("/");
  }, [isSuccess, board, setCurrentBoardId, setBoardContent, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">로딩 중…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-slate-700">이 보드를 보려면 로그인이 필요합니다.</p>
        <Link
          href="/login"
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          로그인
        </Link>
        <Link href="/" className="text-sm text-slate-500 underline">
          홈으로
        </Link>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">보드를 찾을 수 없습니다.</p>
        <Link href="/" className="ml-2 text-sm text-slate-600 underline">
          홈으로
        </Link>
      </div>
    );
  }

  if (boardLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">보드 불러오는 중…</p>
      </div>
    );
  }

  if (boardError || !board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-slate-700">
          접근 권한이 없거나 보드가 없습니다. 비공개 보드라면 가입 요청을 보낼
          수 있습니다.
        </p>
        {!requestSent ? (
          <button
            type="button"
            onClick={() => {
              requestMutation.mutate(id, {
                onSuccess: () => setRequestSent(true),
              });
            }}
            disabled={requestMutation.isPending}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {requestMutation.isPending ? "요청 중…" : "가입 요청 보내기"}
          </button>
        ) : (
          <p className="text-sm text-green-600">
            가입 요청이 전송되었습니다. 보드 소유자가 수락하면 이용할 수
            있습니다.
          </p>
        )}
        {requestMutation.isError && (
          <p className="text-sm text-red-600">
            {String(requestMutation.error?.message)}
          </p>
        )}
        <Link href="/" className="text-sm text-slate-500 underline">
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate-500">보드로 이동 중…</p>
    </div>
  );
}
