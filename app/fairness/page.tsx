export default function FairnessPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Fairness
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Airdropper is designed to be provably fair. Every rule, every number,
          every payout — verifiable on-chain. Here&apos;s the math.
        </p>
      </div>

      {/* Core principles */}
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">On-chain rules</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Pool splits (75/10/10/5), entry limits, winner selection — all
            enforced by the smart contract. The UI only displays state.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Chainlink VRF V2.5</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Verifiable Random Function generates provably fair randomness.
            Each VRF proof is published on-chain and independently verifiable.
            Nobody — not the owner, not the devs — can predict outcomes.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Hard caps (anti-whale)</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Maximum 10 entries per wallet per round. Enforced on-chain, not by
            the UI. This limits whale dominance and gives small players a fair shot.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Round rhythm</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Rounds require both MIN_POOL (minimum USDC) and MIN_TIME (minimum
            duration) before closing. Prevents rushed rounds and ensures
            participation windows.
          </p>
        </div>
      </div>

      {/* Odds comparison */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Odds comparison
        </h2>
        <p className="mt-2 text-sm text-white/70">
          Your real chances, compared honestly.
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 text-left font-semibold text-white/70">Game</th>
                <th className="py-3 text-right font-semibold text-white/70">Odds (jackpot)</th>
                <th className="py-3 text-right font-semibold text-white/70">Win probability</th>
                <th className="py-3 text-right font-semibold text-white/70">Verifiable?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr className="bg-green-500/5">
                <td className="py-3 font-semibold text-green-400">
                  Airdropper (100 players, 2 winners)
                </td>
                <td className="py-3 text-right">1 in 50</td>
                <td className="py-3 text-right font-semibold text-green-400">2.00%</td>
                <td className="py-3 text-right text-green-400">Yes (VRF proof)</td>
              </tr>
              <tr className="bg-green-500/5">
                <td className="py-3 font-semibold text-green-400">
                  Airdropper (50 players, 2 winners)
                </td>
                <td className="py-3 text-right">1 in 25</td>
                <td className="py-3 text-right font-semibold text-green-400">4.00%</td>
                <td className="py-3 text-right text-green-400">Yes (VRF proof)</td>
              </tr>
              <tr>
                <td className="py-3 text-white/70">Scratch cards (any prize)</td>
                <td className="py-3 text-right text-white/50">~1 in 4</td>
                <td className="py-3 text-right text-white/50">~25%</td>
                <td className="py-3 text-right text-red-400">No</td>
              </tr>
              <tr>
                <td className="py-3 text-white/70">Online slots</td>
                <td className="py-3 text-right text-white/50">House edge 2-15%</td>
                <td className="py-3 text-right text-white/50">Always lose (long-term)</td>
                <td className="py-3 text-right text-red-400">No</td>
              </tr>
              <tr>
                <td className="py-3 text-white/70">EuroJackpot</td>
                <td className="py-3 text-right text-white/50">1 in 139,838,160</td>
                <td className="py-3 text-right text-white/50">0.0000007%</td>
                <td className="py-3 text-right text-red-400">No</td>
              </tr>
              <tr>
                <td className="py-3 text-white/70">Powerball</td>
                <td className="py-3 text-right text-white/50">1 in 292,201,338</td>
                <td className="py-3 text-right text-white/50">0.0000003%</td>
                <td className="py-3 text-right text-red-400">No</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-white/40">
          Airdropper odds are dynamic and depend on the number of entries in a
          round. Fewer players = better odds. You can calculate exact odds from
          on-chain data at any time.
        </p>
      </div>

      {/* Mathematical breakdown */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          The math
        </h2>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold">Win probability per entry</div>
            <div className="mt-2 font-mono text-sm text-white/70">
              P(win) = winnersPerRound / totalEntries
            </div>
            <p className="mt-2 text-sm text-white/50">
              With 2 winners and 100 total entries: 2/100 = 2% per entry.
              If you have 5 entries: 1 - (98/100 &times; 97/99) = ~9.9%.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold">Expected value (EV)</div>
            <div className="mt-2 font-mono text-sm text-white/70">
              EV = P(win) &times; payout - cost
            </div>
            <p className="mt-2 text-sm text-white/50">
              With 75% rewards pool split among 2 winners from 100 entries (100 USDC pool):
              EV = 0.02 &times; 37.5 - 1.0 = -0.25 USDC per entry.
              The &quot;loss&quot; funds the JackDrop (10%), dev (10%), and aggregator (5%) pools.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold">JackDrop EV boost</div>
            <p className="mt-2 text-sm text-white/50">
              The 10% JackDrop pool accumulates across rounds. When it triggers,
              one random participant wins the entire reserve. This adds significant
              upside EV — the longer you play, the higher the accumulated pot.
            </p>
          </div>
        </div>
      </div>

      {/* VRF verification */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          How to verify VRF proofs
        </h2>

        <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6">
          <ol className="space-y-3 text-sm text-white/70">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                1
              </span>
              <span>
                Find the round close transaction on{" "}
                <a
                  href="https://polygonscan.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:text-yellow-300 underline"
                >
                  PolygonScan
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                2
              </span>
              <span>
                Check the VRF request ID in the transaction logs (RandomWordsRequested event)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                3
              </span>
              <span>
                Find the fulfillment transaction (RandomWordsFulfilled event)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                4
              </span>
              <span>
                Verify the VRF proof on{" "}
                <a
                  href="https://vrf.chain.link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-yellow-400 hover:text-yellow-300 underline"
                >
                  Chainlink VRF Explorer
                </a>
                {" "}— this proves the randomness was not manipulated
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                5
              </span>
              <span>
                Cross-reference the winners with the participant list to confirm
                the selection was based on the VRF output
              </span>
            </li>
          </ol>
        </div>
      </div>

      {/* Emergency protections */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Safety mechanisms
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold">Emergency refunds</div>
            <p className="mt-2 text-sm text-white/70">
              If something goes wrong with a round, the owner can activate
              emergency refunds. Every participant gets their USDC back.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold">VRF timeout fallback</div>
            <p className="mt-2 text-sm text-white/70">
              If Chainlink VRF doesn&apos;t respond within 256 blocks, a fallback
              resolution using blockhash is available. Your funds are never stuck.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold">Pausable</div>
            <p className="mt-2 text-sm text-white/70">
              The contract can be paused to halt new deposits during maintenance
              or emergencies. Existing claims remain accessible.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-semibold">Blacklist</div>
            <p className="mt-2 text-sm text-white/70">
              Malicious actors can be blacklisted to protect the community.
              Blacklisted wallets cannot deposit but can still claim existing payouts.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-white/70">
          Read the contract source on{" "}
          <a
            href="https://polygonscan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 hover:text-yellow-300 underline"
          >
            PolygonScan
          </a>{" "}
          or check the{" "}
          <a href="/transparency" className="text-yellow-400 hover:text-yellow-300 underline">
            Transparency
          </a>{" "}
          page for live round data.
        </p>
      </div>
    </main>
  );
}
