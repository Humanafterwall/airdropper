import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow">
        <h1 className="text-3xl font-bold tracking-tight">404</h1>
        <p className="mt-4 text-white/80">
          This page doesn’t exist.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
          >
            Go Home
          </Link>
          <Link
            href="/docs"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Open Docs
          </Link>
        </div>
      </div>
    </main>
  );
}
