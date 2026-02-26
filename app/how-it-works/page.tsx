export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          How it works
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/70">
          Transparent rules enforced by smart contracts on Polygon PoS.
          The UI is only a mirror — everything that matters happens on-chain.
        </p>
      </div>

      {/* 4-step flow */}
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
              1
            </div>
            <div className="text-sm font-semibold">Connect wallet</div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Your wallet address is your identity. No registration, no email,
            no KYC. Connect with MetaMask, WalletConnect, or any EVM wallet.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
              2
            </div>
            <div className="text-sm font-semibold">Choose 1–10 entries</div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Each entry costs 1 USDC. Maximum 10 entries per wallet per round,
            enforced on-chain. First you approve USDC spending, then deposit.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
              3
            </div>
            <div className="text-sm font-semibold">Round closes</div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            A round closes when both conditions are met: minimum pool size reached
            AND minimum time elapsed. Chainlink VRF is called for verifiable randomness.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
              4
            </div>
            <div className="text-sm font-semibold">Winners receive payouts</div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            VRF callback selects winners. Payouts are set on-chain. Winners claim
            their USDC directly from the contract — no intermediary, no delays.
          </p>
        </div>
      </div>

      {/* Pool distribution */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Pool distribution
        </h2>
        <p className="mt-3 text-sm text-white/70">
          Every USDC deposited is split transparently:
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-3xl font-bold text-green-400">75%</div>
            <div className="mt-1 text-sm text-white/70">Round rewards</div>
            <p className="mt-2 text-xs text-white/50">
              Distributed to winners immediately after VRF resolution
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-3xl font-bold text-yellow-400">10%</div>
            <div className="mt-1 text-sm text-white/70">JackDrop pool</div>
            <p className="mt-2 text-xs text-white/50">
              Accumulates until target is hit, then one winner takes all
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-3xl font-bold text-blue-400">10%</div>
            <div className="mt-1 text-sm text-white/70">Development</div>
            <p className="mt-2 text-xs text-white/50">
              Funds ongoing development, infrastructure, and audits
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-3xl font-bold text-purple-400">5%</div>
            <div className="mt-1 text-sm text-white/70">Aggregator</div>
            <p className="mt-2 text-xs text-white/50">
              Self-propelled marketing: rewards for top influencers
            </p>
          </div>
        </div>
      </div>

      {/* Two-phase VRF */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Chainlink VRF: two-phase resolution
        </h2>
        <p className="mt-3 text-sm text-white/70">
          We use Chainlink VRF V2.5 for provably fair randomness. The process is asynchronous:
        </p>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-yellow-400">Phase 1: closeRound()</div>
            <p className="mt-2 text-sm text-white/70">
              Admin closes the round. The pool is split (75/10/10/5). A VRF request is sent
              to Chainlink. The next round opens immediately — no downtime between rounds.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-green-400">Phase 2: fulfillRandomWords()</div>
            <p className="mt-2 text-sm text-white/70">
              1-3 blocks later, Chainlink delivers the random numbers. Winners are selected
              from the participant pool using verifiable randomness. If the JackDrop threshold
              is reached, a random participant wins the entire JackDrop reserve.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white/60">Fallback protection</div>
            <p className="mt-2 text-sm text-white/70">
              If VRF doesn&apos;t respond within 256 blocks, a fallback resolution is available.
              Emergency refunds can also be activated — every participant gets their USDC back.
            </p>
          </div>
        </div>
      </div>

      {/* JackDrop */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          JackDrop supercycle
        </h2>
        <p className="mt-3 text-sm text-white/70">
          The JackDrop is a progressive pool that builds across multiple rounds.
        </p>

        <div className="mt-5 rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-white/50">Each round adds</div>
              <div className="text-lg font-semibold">10% of pool</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Triggers when</div>
              <div className="text-lg font-semibold">Target reached</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Winner selection</div>
              <div className="text-lg font-semibold">VRF random</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-white/60">
            One random participant from the round that triggers the JackDrop wins the
            entire accumulated reserve. The cycle then resets and starts building again.
          </p>
        </div>
      </div>

      {/* Referral program */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Referral program
        </h2>
        <p className="mt-3 text-sm text-white/70">
          Every depositor is automatically an influencer. Share your wallet address
          and earn recognition when your referrals actively participate.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Permanent link</div>
            <p className="mt-2 text-sm text-white/70">
              Referrer is set on first deposit and recorded on-chain forever.
              No one can change your referrer after it&apos;s set.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Active referrals</div>
            <p className="mt-2 text-sm text-white/70">
              A referral becomes &quot;active&quot; when the referred wallet deposits
              at least the threshold amount in the current cycle. The more active
              referrals you have, the higher you rank.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Leaderboard tiers</div>
            <p className="mt-2 text-sm text-white/70">
              Top N influencers, next M, and random K from qualifying influencers
              receive rewards from the aggregator pool each cycle.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Self-propelled marketing</div>
            <p className="mt-2 text-sm text-white/70">
              The 5% aggregator pool funds influencer rewards. This creates organic,
              community-driven growth with no external marketing budget needed.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-white/70">
          Everything described here is enforced by the smart contract. Verify it yourself on{" "}
          <a
            href="https://polygonscan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 hover:text-yellow-300 underline"
          >
            PolygonScan
          </a>{" "}
          or read the{" "}
          <a href="/docs" className="text-yellow-400 hover:text-yellow-300 underline">
            full documentation
          </a>.
        </p>
      </div>
    </main>
  );
}
