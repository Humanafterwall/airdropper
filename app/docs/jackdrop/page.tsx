import Link from "next/link";

export default function DocsJackDropPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <div className="text-sm text-white/50">
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>{" "}
          / JackDrop
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          JackDrop
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          The progressive supercycle. 10% of every round builds toward one
          massive payout for a single random participant.
        </p>
      </div>

      {/* How it works */}
      <div className="mt-10 max-w-3xl space-y-4">
        <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-6">
          <h2 className="text-lg font-semibold text-yellow-400">The cycle</h2>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="flex gap-3">
              <span className="font-mono text-yellow-400 shrink-0">1.</span>
              <span>
                Every round, 10% of the pool (JACKPOT_BPS = 1000) is added to
                the JackDrop reserve via <code className="text-white/80">jackpotBalance</code>.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-yellow-400 shrink-0">2.</span>
              <span>
                The reserve accumulates across many rounds within a cycle.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-yellow-400 shrink-0">3.</span>
              <span>
                When <code className="text-white/80">jackpotBalance &gt;= jackTarget</code>,
                the JackDrop is triggered during <code className="text-white/80">closeRound()</code>.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-yellow-400 shrink-0">4.</span>
              <span>
                The VRF callback selects one random participant from the triggering
                round as the JackDrop winner.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-yellow-400 shrink-0">5.</span>
              <span>
                The winner calls <code className="text-white/80">claimJackDrop(roundId)</code> to
                receive the entire accumulated reserve.
              </span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono text-yellow-400 shrink-0">6.</span>
              <span>
                The cycle resets: <code className="text-white/80">cycleId</code> increments,
                JackDrop reserve goes back to zero, and accumulation starts again.
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold">JackDrop eligibility</h3>
          <p className="mt-2 text-sm text-white/70">
            Only participants of the round that triggers the JackDrop are eligible.
            The more entries you have in that round, the higher your chance — but
            the selection is from <em>participants</em> (wallets), weighted by entries.
            The contract tracks{" "}
            <code className="text-white/80">maxJackEntriesCountedPerWallet</code> to
            cap how many entries count toward JackDrop selection per wallet.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold">Example scenario</h3>
          <div className="mt-3 text-sm text-white/70 space-y-1">
            <p>jackTarget = 1,000,000 USDC</p>
            <p>Each round contributes ~10 USDC to JackDrop (from 100 USDC pools)</p>
            <p>After ~100,000 rounds, the JackDrop target is reached</p>
            <p>One random participant from round #100,000 wins 1,000,000 USDC</p>
          </div>
          <p className="mt-3 text-xs text-white/40">
            Real targets and accumulation rates depend on round sizes and
            configuration. Check the Transparency page for live JackDrop reserve.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold">On-chain data</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/5 text-white/70">
                <tr>
                  <td className="py-2 font-mono">jackpotBalance</td>
                  <td className="py-2">Current accumulated reserve</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">cycleId</td>
                  <td className="py-2">Current cycle number</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">jackDropWinner(roundId)</td>
                  <td className="py-2">Winner address for a specific round</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">jackDropAmount(roundId)</td>
                  <td className="py-2">Amount won in a specific round</td>
                </tr>
                <tr>
                  <td className="py-2 font-mono">jackDropClaimed(roundId)</td>
                  <td className="py-2">Whether JackDrop was claimed</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link
          href="/docs/rounds"
          className="text-white/50 hover:text-white transition-colors"
        >
          ← Rounds
        </Link>
        <Link
          href="/docs/referrals"
          className="text-yellow-400 hover:text-yellow-300 underline"
        >
          Next: Referral Program →
        </Link>
      </div>
    </main>
  );
}
