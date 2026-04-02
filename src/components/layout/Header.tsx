"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { MindGridSpinner } from "@/components/layout/MindGridSpinner";

export function Header() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 shrink-0">
      <div className="flex items-center gap-2">
        <MindGridSpinner
          size={20}
          label={loading ? "MindGrid 로딩" : "MindGrid 로고"}
          animate={loading}
          kind={loading ? "status" : "logo"}
        />
        <Link
          href="/"
          className="text-base font-semibold sm:text-lg text-[var(--primary)]"
        >
          M<span className="text-[var(--accent)]">i</span>
          ndG
          <span className="text-[var(--accent)]">i</span>d
        </Link>
        <span className="text-sm text-slate-500"></span>
      </div>
      <nav className="flex items-center gap-2 sm:gap-3">
        {loading ? (
          <span className="text-xs text-slate-500 sm:text-sm">로딩 중…</span>
        ) : user ? (
          <>
            <span className="hidden max-w-[180px] truncate text-sm text-slate-600 sm:inline">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 sm:px-3 sm:text-sm"
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 sm:px-3 sm:text-sm"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 sm:px-3 sm:text-sm"
            >
              회원가입
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
