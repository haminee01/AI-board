import Link from "next/link";
import type { AuthErrorInfo } from "@/lib/auth/auth-error";

export function AuthErrorBanner({
  error,
  actionHref,
  actionLabel,
}: {
  error: AuthErrorInfo;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-3"
      role="alert"
      aria-live="polite"
    >
      <div className="flex gap-2">
        <div className="mt-0.5 text-red-700" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 9V13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M12 17H12.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M10.29 3.86L1.82 18.14C1.35 18.92 1.92 20 2.83 20H21.17C22.08 20 22.65 18.92 22.18 18.14L13.71 3.86C13.26 3.1 10.74 3.1 10.29 3.86Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-red-800">{error.title}</p>
          <p className="mt-1 text-sm text-red-700">{error.message}</p>

          {actionHref && actionLabel && (
            <div className="mt-2">
              <Link
                href={actionHref}
                className="inline-flex items-center rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
              >
                {actionLabel}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
