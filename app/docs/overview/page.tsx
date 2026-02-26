import Link from "next/link";

export default function DocsOverviewPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <div className="text-sm text-white/50">
          <Link href="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>{" "}
          / Overview
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Overview
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Airdropper is a transparent, on-chain distribution system built on
          Polygon PoS. It uses USDC for payments and Chainlink VRF V2.5 for
          provably fair randomness.
        </p>
      </div>

      <div className="mt-10 space-y-6 max-w-3xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">What is Airdropper?</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Airdropper is a round-based participation system where users deposit
            USDC entries. Each round, winners are selected using Chainlink VRF
            (Verifiable Random Function), ensuring nobody can predict or manipulate
            outcomes. 75% of each round&apos;s pool goes to winners, 10% to the
            progressive JackDrop reserve, 10% to development, and 5% to
            community-driven marketing (aggregator pool).
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Design philosophy</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/70 list-disc pl-5">
            <li>
              <strong>Anti-addiction:</strong> Low caps per wallet (max 10 entries),
              no autoplay, no flashy engagement tricks
            </li>
            <li>
              <strong>Transparency:</strong> All rules enforced by smart contracts,
              all data on-chain and verifiable
            </li>
            <li>
              <strong>Whale-proof:</strong> Per-wallet entry limits prevent any
              single player from dominating
            </li>
            <li>
              <strong>Self-sustaining:</strong> Community-driven growth through
              the referral program and aggregator pool
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">Tech stack</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="text-sm">
              <div className="font-semibold">Chain</div>
              <div className="text-white/70">Polygon PoS (cheapest gas, Circle USDC)</div>
            </div>
            <div className="text-sm">
              <div className="font-semibold">Randomness</div>
              <div className="text-white/70">Chainlink VRF V2.5 (verifiable proofs)</div>
            </div>
            <div className="text-sm">
              <div className="font-semibold">Token</div>
              <div className="text-white/70">USDC (stablecoin, no volatility)</div>
            </div>
            <div className="text-sm">
              <div className="font-semibold">Contract</div>
              <div className="text-white/70">Solidity, verified on PolygonScan</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold">License</h2>
          <p className="mt-3 text-sm text-white/70">
            OTC-NC-1.0 (Open Transparent Code — Non-Commercial). The contract
            code is open source for auditing and verification, but commercial
            use requires explicit permission. The author&apos;s identity is
            cryptographically committed on-chain via AUTHOR_DNA_HASH.
          </p>
        </div>
      </div>

      <div className="mt-8 text-sm">
        <Link
          href="/docs/tokenomics"
          className="text-yellow-400 hover:text-yellow-300 underline"
        >
          Next: Tokenomics &amp; Pools →
        </Link>
      </div>
    </main>
  );
}
