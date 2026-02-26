"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow">
        <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>

        <p className="mt-4 text-white/80">
          An unexpected error occurred. You can retry or go back home.
        </p>

        <p className="mt-4 text-xs text-white/50 break-all">
          {error?.message}
          {error?.digest ? ` • digest: ${error.digest}` : ""}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => reset()}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
          >
            Retry
          </button>

          <Link
            href="/"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
