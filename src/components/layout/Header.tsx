"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";

export function Header() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-slate-200 bg-white shrink-0">
      <div className="flex items-center gap-2">
        <Link href="/" className="text-lg font-semibold text-slate-800">
          AI 실시간 협업 화이트보드
        </Link>
        <span className="text-sm text-slate-500">— 드래그로 선 그리기</span>
      </div>
      <nav className="flex items-center gap-3">
        {loading ? (
          <span className="text-sm text-slate-400">로딩 중…</span>
        ) : user ? (
          <>
            <span className="text-sm text-slate-600 truncate max-w-[180px]">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              회원가입
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
