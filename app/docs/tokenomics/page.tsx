import Link from "next/link";

export default function DocsTokenomicsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <div className="text-sm text-white/50">
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>{" "}
          / Tokenomics
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Tokenomics &amp; Pools
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Every USDC deposited is split transparently into four pools.
          The split is hardcoded in the smart contract and cannot be changed.
        </p>
      </div>

      {/* Split visualization */}
      <div className="mt-10 grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
          <div className="text-3xl font-bold text-green-400">75%</div>
          <div className="mt-1 text-sm font-semibold">Round rewards</div>
          <p className="mt-2 text-xs text-white/50">
            Distributed to winners immediately after VRF resolution.
            Split among winners according to payoutBps configuration.
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <div className="text-3xl font-bold text-yellow-400">10%</div>
          <div className="mt-1 text-sm font-semibold">JackDrop pool</div>
          <p className="mt-2 text-xs text-white/50">
            Accumulates across rounds. When jackTarget is reached, one
            random participant wins the entire reserve. Cycle resets.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
          <div className="text-3xl font-bold text-blue-400">10%</div>
          <div className="mt-1 text-sm font-semibold">Development</div>
          <p className="mt-2 text-xs text-white/50">
            Funds ongoing development, infrastructure costs, security
            audits, and platform improvements.
          </p>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
          <div className="text-3xl font-bold text-purple-400">5%</div>
          <div className="mt-1 text-sm font-semibold">SPA (Self-Propelled Aggregator)</div>
          <p className="mt-2 text-xs text-white/50">
            Automatically distributed to top 100 referrers at cycle end.
            No admin involvement — fully transparent, on-chain rewards.
          </p>
        </div>
      </div>

      {/* Contract constants */}
      <div className="mt-10 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          Contract constants
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 text-left text-white/50">Constant</th>
                <th className="py-2 text-right text-white/50">Value</th>
                <th className="py-2 text-right text-white/50">BPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2">REWARDS_BPS</td>
                <td className="py-2 text-right">75%</td>
                <td className="py-2 text-right font-mono text-white/50">7500</td>
              </tr>
              <tr>
                <td className="py-2">JACKPOT_BPS</td>
                <td className="py-2 text-right">10%</td>
                <td className="py-2 text-right font-mono text-white/50">1000</td>
              </tr>
              <tr>
                <td className="py-2">DEV_BPS</td>
                <td className="py-2 text-right">10%</td>
                <td className="py-2 text-right font-mono text-white/50">1000</td>
              </tr>
              <tr>
                <td className="py-2">SPA_BPS</td>
                <td className="py-2 text-right">5%</td>
                <td className="py-2 text-right font-mono text-white/50">500</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-2">BPS_DENOM</td>
                <td className="py-2 text-right">100%</td>
                <td className="py-2 text-right font-mono text-white/50">10000</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-white/40">
          BPS = basis points. 10000 BPS = 100%. These values are immutable
          constants in the contract — they cannot be changed after deployment.
        </p>
      </div>

      {/* Flow example */}
      <div className="mt-10 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          Example: 100 USDC pool
        </h2>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="space-y-2 text-sm text-white/70">
            <div className="flex justify-between">
              <span>Total pool</span>
              <span className="font-semibold text-white">100.00 USDC</span>
            </div>
            <div className="flex justify-between">
              <span>→ Winners (75%)</span>
              <span className="text-green-400">75.00 USDC</span>
            </div>
            <div className="flex justify-between">
              <span>→ JackDrop (10%)</span>
              <span className="text-yellow-400">10.00 USDC</span>
            </div>
            <div className="flex justify-between">
              <span>→ Development (10%)</span>
              <span className="text-blue-400">10.00 USDC</span>
            </div>
            <div className="flex justify-between">
              <span>→ SPA — referral rewards (5%)</span>
              <span className="text-purple-400">5.00 USDC</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/40">
            With 2 winners: each winner receives 37.50 USDC (default equal split).
            Winner payouts can be configured per-round (e.g., 75/25 split).
          </p>
        </div>
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link
          href="/docs/overview"
          className="text-white/50 hover:text-white transition-colors"
        >
          ← Overview
        </Link>
        <Link
          href="/docs/rounds"
          className="text-yellow-400 hover:text-yellow-300 underline"
        >
          Next: Rounds →
        </Link>
      </div>
    </main>
  );
}
