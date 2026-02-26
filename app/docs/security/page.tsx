import Link from "next/link";

export default function DocsSecurityPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <div className="text-sm text-white/50">
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>{" "}
          / Security
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Security &amp; Anti-Scam
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Security measures, emergency protections, and what to watch out for
          as a participant.
        </p>
      </div>

      <div className="mt-10 max-w-3xl space-y-4">
        {/* Contract security */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Contract security</h2>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="font-semibold text-white/80">ReentrancyGuard</div>
              <div className="text-white/50">
                All state-changing functions are protected against reentrancy attacks.
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="font-semibold text-white/80">Pausable</div>
              <div className="text-white/50">
                Contract can be paused in emergencies to halt new deposits.
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="font-semibold text-white/80">Ownable (non-renounceable)</div>
              <div className="text-white/50">
                Owner controls admin functions. renounceOwnership() is disabled
                to prevent orphaned contracts.
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="font-semibold text-white/80">Chainlink VRF V2.5</div>
              <div className="text-white/50">
                Randomness is externally generated and cryptographically proven.
                No internal randomness (no blockhash abuse, no timestamp manipulation).
              </div>
            </div>
          </div>
        </div>

        {/* Emergency mechanisms */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Emergency mechanisms</h2>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div>
              <div className="font-semibold text-red-400">Emergency refunds</div>
              <p className="mt-1">
                If something goes wrong with a round (failed VRF, contract issue),
                the owner can call{" "}
                <code className="text-white/80">activateEmergencyRefund(roundId)</code>.
                Every participant can then call{" "}
                <code className="text-white/80">claimRefund(roundId)</code> to get their USDC back.
                This is only available before payouts are set.
              </p>
            </div>
            <div>
              <div className="font-semibold text-yellow-400">VRF timeout fallback</div>
              <p className="mt-1">
                If Chainlink VRF doesn&apos;t respond within 256 blocks (~8.5 minutes on
                Polygon), the owner can call{" "}
                <code className="text-white/80">resolveRoundFallback(roundId)</code> which uses
                blockhash as a fallback random source. This ensures funds are never
                permanently stuck.
              </p>
            </div>
            <div>
              <div className="font-semibold text-white/80">Expired refund sweep</div>
              <p className="mt-1">
                Unclaimed refunds from emergency rounds can be swept back into the
                contract after the expiry period, preventing permanent fund lockup.
              </p>
            </div>
          </div>
        </div>

        {/* User safety */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">User safety tips</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 text-sm">
              <span className="font-bold text-yellow-300">REMEMBER</span>
              <span className="ml-2 text-white/80">
                Always verify the contract address on PolygonScan before approving USDC.
              </span>
            </div>
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 text-sm">
              <span className="font-bold text-yellow-300">REMEMBER</span>
              <span className="ml-2 text-white/80">
                Bookmark the official site. Scammers clone sites with one-letter changes.
              </span>
            </div>
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 text-sm">
              <span className="font-bold text-yellow-300">REMEMBER</span>
              <span className="ml-2 text-white/80">
                Never share your seed phrase. The Airdropper team will never ask for it.
              </span>
            </div>
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 text-sm">
              <span className="font-bold text-yellow-300">REMEMBER</span>
              <span className="ml-2 text-white/80">
                Only approve the exact USDC amount you intend to deposit. Revoke unused approvals.
              </span>
            </div>
          </div>
        </div>

        {/* Blacklist */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Blacklist</h2>
          <p className="mt-3 text-sm text-white/70">
            The owner can blacklist wallets that engage in malicious behavior
            (Sybil attacks, bot abuse, etc.) via{" "}
            <code className="text-white/80">setBlacklist(address, true)</code>.
            Blacklisted wallets cannot make new deposits but can still claim
            existing payouts and refunds.
          </p>
        </div>

        {/* Verification */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Verify everything</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/70 list-disc pl-5">
            <li>Contract source: verified on PolygonScan</li>
            <li>
              VRF proofs: verifiable on{" "}
              <a
                href="https://vrf.chain.link"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 hover:text-yellow-300 underline"
              >
                Chainlink VRF Explorer
              </a>
            </li>
            <li>Round history: read directly from the contract</li>
            <li>Pool balances: visible on the Transparency page</li>
            <li>License: OTC-NC-1.0 (open, auditable, non-commercial)</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link
          href="/docs/referrals"
          className="text-white/50 hover:text-white transition-colors"
        >
          ← Referrals
        </Link>
        <Link
          href="/docs"
          className="text-yellow-400 hover:text-yellow-300 underline"
        >
          Back to Docs →
        </Link>
      </div>
    </main>
  );
}
