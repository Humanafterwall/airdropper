import Link from "next/link";

export default function DocsReferralsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <div className="text-sm text-white/50">
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>{" "}
          / Referrals &amp; SPA
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          SPA — Self-Propelled Aggregator
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Every depositor is an influencer. Share your referral link, climb the
          leaderboard, and earn USDC rewards automatically from the 5% SPA pool.
          No admin involvement — fully transparent, fully on-chain.
        </p>
      </div>

      <div className="mt-10 max-w-3xl space-y-4">
        {/* How referrals work */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">How it works</h2>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="flex gap-3">
              <span className="font-mono text-purple-400 shrink-0">1.</span>
              <span>
                A new user deposits using{" "}
                <code className="text-white/80">depositWithReferrer(entries, referrerAddress)</code>.
                The referrer is recorded on-chain permanently.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-purple-400 shrink-0">2.</span>
              <span>
                Every depositor is automatically an influencer — you can share
                your own referral link immediately after your first deposit.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-purple-400 shrink-0">3.</span>
              <span>
                A referral becomes &quot;active&quot; when the referred wallet deposits at
                least <code className="text-white/80">100 USDC</code> in the current
                cycle. Active referrals determine your leaderboard rank.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-purple-400 shrink-0">4.</span>
              <span>
                When JackDrop triggers (cycle end), the <b>entire SPA pool</b> is
                automatically distributed to the top 100 referrers based on their
                leaderboard rank. No admin action required.
              </span>
            </div>
          </div>
        </div>

        {/* Tier distribution */}
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
          <h2 className="text-lg font-semibold text-purple-400">
            SPA Reward Tiers
          </h2>
          <p className="mt-3 text-sm text-white/70">
            100% of the SPA pool is distributed across four tiers. If a tier has
            fewer members than its max capacity, the per-person share increases.
            If a tier is empty, its allocation redistributes upward.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2 text-left text-white/50">Tier</th>
                  <th className="py-2 text-right text-white/50">Ranks</th>
                  <th className="py-2 text-right text-white/50">Pool share</th>
                  <th className="py-2 text-right text-white/50">Per person</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-2">
                    <span className="rounded-full bg-yellow-500/15 border border-yellow-500/30 px-2 py-0.5 text-xs font-semibold text-yellow-400">
                      Champion
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">#1</td>
                  <td className="py-2 text-right font-bold text-purple-400">40%</td>
                  <td className="py-2 text-right text-white/70">40.0%</td>
                </tr>
                <tr>
                  <td className="py-2">
                    <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-xs font-semibold text-purple-300">
                      Elite
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">#2 — #10</td>
                  <td className="py-2 text-right font-bold text-purple-400">30%</td>
                  <td className="py-2 text-right text-white/70">~3.33% each</td>
                </tr>
                <tr>
                  <td className="py-2">
                    <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-xs font-semibold text-blue-300">
                      Rising
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">#11 — #30</td>
                  <td className="py-2 text-right font-bold text-purple-400">20%</td>
                  <td className="py-2 text-right text-white/70">~1.0% each</td>
                </tr>
                <tr>
                  <td className="py-2">
                    <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-xs font-semibold text-white/50">
                      Community
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">#31 — #100</td>
                  <td className="py-2 text-right font-bold text-purple-400">10%</td>
                  <td className="py-2 text-right text-white/70">~0.14% each</td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right font-mono">100 wallets</td>
                  <td className="py-2 text-right text-purple-400">100%</td>
                  <td className="py-2 text-right text-white/70">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Example */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Example: $50,000 SPA pool</h2>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
            <ul className="space-y-1.5 list-disc pl-5">
              <li><b className="text-yellow-400">#1 Champion:</b> $20,000</li>
              <li><b className="text-purple-300">#2-10 Elite:</b> ~$1,667 each</li>
              <li><b className="text-blue-300">#11-30 Rising:</b> ~$500 each</li>
              <li><b className="text-white/60">#31-100 Community:</b> ~$71 each</li>
            </ul>
            <p className="mt-3 text-xs text-white/40">
              Rewards are auto-credited to wallets when JackDrop triggers. No claim needed.
            </p>
          </div>
        </div>

        {/* Edge cases */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Edge cases</h2>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            <div className="flex gap-3">
              <span className="text-white/40 shrink-0">•</span>
              <span>
                <b>Fewer than 100 referrers:</b> Empty tier slots redistribute
                upward. If only 5 referrers exist, they share the entire pool.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-white/40 shrink-0">•</span>
              <span>
                <b>Zero referrers:</b> SPA balance carries forward to the next cycle.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-white/40 shrink-0">•</span>
              <span>
                <b>Only 1 referrer:</b> They receive 100% of the SPA pool.
              </span>
            </div>
          </div>
        </div>

        {/* How to participate */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">How to become a referrer</h2>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="flex gap-3">
              <span className="font-mono text-purple-400 shrink-0">1.</span>
              <span>Make at least one deposit on Airdropper.</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-purple-400 shrink-0">2.</span>
              <span>
                Share your referral link:{" "}
                <code className="text-white/80">airdropper.xyz/play?ref=YOUR_ADDRESS</code>
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-purple-400 shrink-0">3.</span>
              <span>
                When someone deposits using your link, you gain an active referral
                once they reach the 100 USDC threshold.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-purple-400 shrink-0">4.</span>
              <span>
                The more active referrals you have, the higher your rank on the
                leaderboard — and the bigger your SPA reward at cycle end.
              </span>
            </div>
          </div>
        </div>

        {/* On-chain functions */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">On-chain data</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/5 text-white/70">
                <tr>
                  <td className="py-2 font-mono">referrerOf(address)</td>
                  <td className="py-2">Permanent referrer of a wallet</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">isInfluencer(address)</td>
                  <td className="py-2">Whether wallet has ever deposited</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">aggregatorBalance</td>
                  <td className="py-2">Current SPA pool balance (auto-distributed at cycle end)</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">cycleCfg</td>
                  <td className="py-2">
                    SPA tier BPS (4000/3000/2000/1000), active ref threshold
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link
          href="/docs/jackdrop"
          className="text-white/50 hover:text-white transition-colors"
        >
          ← JackDrop
        </Link>
        <Link
          href="/docs/security"
          className="text-yellow-400 hover:text-yellow-300 underline"
        >
          Next: Security →
        </Link>
      </div>
    </main>
  );
}
