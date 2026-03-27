"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";

export function Header() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 shrink-0">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="text-base font-semibold text-slate-800 sm:text-lg"
        >
          MindGrid
        </Link>
        <span className="text-sm text-slate-500"></span>
      </div>
      <nav className="flex items-center gap-2 sm:gap-3">
        {loading ? (
          <span className="text-xs text-slate-400 sm:text-sm">로딩 중…</span>
        ) : user ? (
          <>
            <span className="hidden max-w-[180px] truncate text-sm text-slate-600 sm:inline">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:px-3 sm:text-sm"
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:px-3 sm:text-sm"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 sm:px-3 sm:text-sm"
            >
              회원가입
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
