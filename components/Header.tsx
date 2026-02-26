"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const nav = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/fairness", label: "Fairness" },
  { href: "/transparency", label: "Transparency" },
  { href: "/docs", label: "Docs" },
  { href: "/security", label: "Security" },
  { href: "/faq", label: "FAQ" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Airdropper" className="h-9 w-9" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Airdropper</div>
            <div className="text-xs text-white/60">Polygon &bull; USDC</div>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-5 lg:flex">
          {nav.map((item) => {
            const active = pathname === item.href;
            const testId =
              "nav-" + item.label.toLowerCase().replace(/\s+/g, "-");

            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={testId}
                className={[
                  "text-sm transition-colors",
                  active
                    ? "text-white"
                    : "text-white/70 hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: Wallet + CTA + mobile menu */}
        <div className="flex items-center gap-3">
          {/* ConnectButton — compact on small screens */}
          <div className="hidden sm:block">
            <ConnectButton
              accountStatus="avatar"
              chainStatus="icon"
              showBalance={false}
            />
          </div>

          <Link
            href="/play"
            data-testid="nav-play"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
          >
            Play Now
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-black/90 backdrop-blur lg:hidden">
          <nav className="mx-auto max-w-6xl px-6 py-4">
            <div className="flex flex-col gap-1">
              {/* Wallet connect for mobile */}
              <div className="mb-3 flex justify-center sm:hidden">
                <ConnectButton
                  accountStatus="address"
                  chainStatus="icon"
                  showBalance={false}
                />
              </div>

              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      "rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-white/10 text-white font-semibold"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
