import Link from "next/link";

const sections = [
  { href: "/docs/overview", label: "Overview" },
  { href: "/docs/tokenomics", label: "Tokenomics & Pools" },
  { href: "/docs/rounds", label: "Rounds (MIN_POOL + MIN_TIME)" },
  { href: "/docs/jackdrop", label: "JackDrop (supercycle)" },
  { href: "/docs/referrals", label: "Referral Program" },
  { href: "/docs/security", label: "Security & Anti-Scam" },
];

export default function DocsIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow">
        <h1 className="text-3xl font-bold tracking-tight">Docs</h1>
        <p className="mt-4 text-white/80">
          This is the documentation hub. We keep it simple, readable, and audit-friendly.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
            >
              <div className="text-sm text-white/70">Section</div>
              <div className="mt-1 text-lg font-semibold">{s.label}</div>
              <div className="mt-2 text-sm text-white/60">{s.href}</div>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-sm text-white/60">
          Next: fill each section with short, clear text + “REMEMBER” markers on critical points.
        </p>
      </div>
    </main>
  );
}
