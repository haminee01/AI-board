"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useBoardStore } from "@/stores/useBoardStore";

/** 로그인하지 않은 사용자는 항상 빈 보드만 보이도록 상태 초기화 */
export function AnonymousBoardReset() {
  const { user, loading } = useAuth();
  const setBoardContent = useBoardStore((s) => s.setBoardContent);
  const setCurrentBoardId = useBoardStore((s) => s.setCurrentBoardId);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setCurrentBoardId(null);
      setBoardContent({ lines: [], textNodes: [], shapes: [] });
    }
  }, [user, loading, setBoardContent, setCurrentBoardId]);

  return null;
}
