
export default function FaqPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          FAQ
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Quick answers about entries, rounds, and verifiability.
        </p>
      </div>

      <div className="mt-10 grid gap-5">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">What is an entry?</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            An entry is a single participation unit in a round. Each wallet can
            submit 1–10 entries per round (enforced on-chain).
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Why 1–10 entries?</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            It keeps participation simple and limits whales. The smart contract
            enforces the cap, the UI only shows the state.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Is the outcome provable?</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Yes. Round data and results are on-chain so anyone can verify the
            rules were followed.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Which chain?</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Polygon PoS. Payments in USDC (Circle native). Cheapest gas fees,
            Chainlink VRF for provably fair randomness.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">How are winners selected?</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Chainlink VRF V2.5 generates verifiable random numbers on-chain.
            Nobody — not even the contract owner — can predict or manipulate the outcome.
            Every VRF proof is publicly verifiable on PolygonScan.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">What is the JackDrop?</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            10% of every round&apos;s pool goes into the JackDrop reserve. When the
            reserve hits the target amount, one random participant from the
            triggering round wins the entire JackDrop. It&apos;s a supercycle event.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">What are the odds?</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            With ~100 players and 2 winners per round, your odds are roughly 1 in 50 (2%).
            Compare that to EuroJackpot (1 in 140 million) or Powerball (1 in 292 million).
            Airdropper&apos;s odds are transparent and calculable from on-chain data at any time.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">What happens if a round doesn&apos;t fill?</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            If the VRF callback fails or takes too long (256+ blocks), the owner can
            trigger a fallback resolution. If needed, emergency refunds can be activated
            so every participant gets their USDC back.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Is there a referral program?</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Yes. Share your wallet address as a referral link. When someone deposits
            using your referral, you become their permanent on-chain referrer. Active
            referrals are tracked per cycle and the top influencers earn rewards from
            the aggregator pool.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">Still have questions?</div>
        <p className="mt-3 text-sm text-white/70">
          Check the{" "}
          <a href="/docs" className="text-yellow-400 hover:text-yellow-300 underline">
            Docs
          </a>{" "}
          for detailed technical breakdowns, or verify everything yourself on{" "}
          <a
            href="https://polygonscan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-400 hover:text-yellow-300 underline"
          >
            PolygonScan
          </a>.
        </p>
      </div>
    </main>
  );
}

