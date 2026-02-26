import Link from "next/link";

export default function DocsRoundsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <div className="text-sm text-white/50">
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>{" "}
          / Rounds
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Rounds
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          The core lifecycle: open → deposit → close → VRF → resolve → claim.
          Rounds run continuously with no downtime.
        </p>
      </div>

      {/* Lifecycle */}
      <div className="mt-10 max-w-3xl space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-400">
              1
            </div>
            <div className="text-sm font-semibold">Round opens</div>
          </div>
          <p className="mt-3 text-sm text-white/70 pl-11">
            A new round opens automatically after the previous round closes.
            The opening snapshots the current round configuration (entry price,
            min pool, min time, max entries, winners per round, payout BPS).
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-400">
              2
            </div>
            <div className="text-sm font-semibold">Users deposit</div>
          </div>
          <p className="mt-3 text-sm text-white/70 pl-11">
            Users approve USDC and call <code className="text-white/80">deposit(entries)</code> or{" "}
            <code className="text-white/80">depositWithReferrer(entries, referrer)</code>.
            Each wallet can deposit 1–10 entries per round (on-chain enforced).
            The deposit splits the USDC immediately into the four pools.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-sm font-bold text-yellow-400">
              3
            </div>
            <div className="text-sm font-semibold">Round closes (Phase 1)</div>
          </div>
          <p className="mt-3 text-sm text-white/70 pl-11">
            Admin calls <code className="text-white/80">closeRound()</code> when both conditions
            are met: <code className="text-white/80">totalPool &gt;= minPool</code> AND{" "}
            <code className="text-white/80">block.timestamp &gt;= startTime + minTime</code>.
            The contract checks if the JackDrop threshold is reached and requests
            VRF random words from Chainlink. The next round opens immediately.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-sm font-bold text-purple-400">
              4
            </div>
            <div className="text-sm font-semibold">VRF callback (Phase 2)</div>
          </div>
          <p className="mt-3 text-sm text-white/70 pl-11">
            1–3 blocks later, Chainlink delivers verifiable random numbers via{" "}
            <code className="text-white/80">rawFulfillRandomWords()</code>. The contract uses
            these to select winners from the participant pool. If JackDrop was
            triggered, one random participant wins the entire JackDrop reserve.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-400">
              5
            </div>
            <div className="text-sm font-semibold">Claim payouts</div>
          </div>
          <p className="mt-3 text-sm text-white/70 pl-11">
            Winners call <code className="text-white/80">claimPayout(roundId)</code> to receive
            their USDC. JackDrop winners call <code className="text-white/80">claimJackDrop(roundId)</code>.
            Self-custody: funds go directly to the winner&apos;s wallet.
          </p>
        </div>
      </div>

      {/* Config parameters */}
      <div className="mt-10 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          Round configuration
        </h2>
        <p className="mt-2 text-sm text-white/70">
          These parameters are configurable by the owner and snapshotted at round open:
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 text-left text-white/50">Parameter</th>
                <th className="py-2 text-left text-white/50">Description</th>
                <th className="py-2 text-right text-white/50">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/70">
              <tr>
                <td className="py-2 font-mono">entryPrice</td>
                <td className="py-2">Cost per entry in USDC (6 decimals)</td>
                <td className="py-2 text-right">uint256</td>
              </tr>
              <tr>
                <td className="py-2 font-mono">maxEntriesPerWalletPerRound</td>
                <td className="py-2">Max entries one wallet can submit</td>
                <td className="py-2 text-right">uint16</td>
              </tr>
              <tr>
                <td className="py-2 font-mono">minPool</td>
                <td className="py-2">Minimum reward pool to close round</td>
                <td className="py-2 text-right">uint256</td>
              </tr>
              <tr>
                <td className="py-2 font-mono">minTime</td>
                <td className="py-2">Minimum time before round can close</td>
                <td className="py-2 text-right">uint32</td>
              </tr>
              <tr>
                <td className="py-2 font-mono">maxTotalEntries</td>
                <td className="py-2">Maximum entries per round (hard cap)</td>
                <td className="py-2 text-right">uint32</td>
              </tr>
              <tr>
                <td className="py-2 font-mono">winnersPerRound</td>
                <td className="py-2">Number of winners selected per round</td>
                <td className="py-2 text-right">uint8</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link
          href="/docs/tokenomics"
          className="text-white/50 hover:text-white transition-colors"
        >
          ← Tokenomics
        </Link>
        <Link
          href="/docs/jackdrop"
          className="text-yellow-400 hover:text-yellow-300 underline"
        >
          Next: JackDrop →
        </Link>
      </div>
    </main>
  );
}
