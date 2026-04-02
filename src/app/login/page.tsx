"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";
import { toAuthErrorInfo, type AuthErrorInfo } from "@/lib/auth/auth-error";
import { MindGridSpinner } from "@/components/layout/MindGridSpinner";

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthErrorInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "test@test.com";
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "qwer1234";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(toAuthErrorInfo(error));
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    setEmail(demoEmail);
    setPassword(demoPassword);
    try {
      const res = await fetch("/api/demo-user", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "데모 계정 준비에 실패했습니다.");
      }
    } catch (e) {
      setLoading(false);
      setError(toAuthErrorInfo(e instanceof Error ? e : new Error(String(e))));
      return;
    }
    const { error } = await signIn(demoEmail, demoPassword);
    setLoading(false);
    if (error) {
      setError(toAuthErrorInfo(error));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[color:var(--background)]">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800 text-center">
          로그인
        </h1>
        <p className="mt-1 text-sm text-slate-500 text-center">
          AI 실시간 협업 화이트보드
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {error && <AuthErrorBanner error={error} />}
          <button
            type="submit"
            disabled={loading}
            className="relative w-full overflow-hidden rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="relative z-10 inline-flex items-center justify-center gap-2">
                  <MindGridSpinner size={18} />
                  로그인 중…
                </span>
                <span className="mindgrid-shimmer" aria-hidden />
              </>
            ) : (
              "로그인"
            )}
          </button>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            테스트 계정으로 로그인
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="font-medium text-slate-700 underline">
            회원가입
          </Link>
        </p>
        <p className="mt-2 text-center">
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← 메인으로
          </Link>
        </p>
      </div>
    </main>
  );
}
