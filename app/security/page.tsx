import Link from "next/link";

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Security
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Airdropper is built with a &quot;clarity first&quot; approach: simple rules,
          fewer moving parts, and transparent on-chain state.
        </p>
      </div>

      <div className="mt-10 space-y-4 max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Wallet safety</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Use a wallet you control long-term. Avoid &quot;temporary wallets&quot; you may
            lose later. Your wallet is your identity and your claim to payouts.
          </p>
          <div className="mt-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-3 py-2 text-sm">
            <span className="font-bold text-yellow-300">REMEMBER</span>
            <span className="ml-2 text-white/80">
              Write down your seed phrase safely. If you lose it, nobody can
              recover your funds.
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Fake sites &amp; phishing</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Always verify the domain and never approve unknown contracts. Check
            the contract address on PolygonScan before any transaction.
          </p>
          <div className="mt-3 rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-3 py-2 text-sm">
            <span className="font-bold text-yellow-300">REMEMBER</span>
            <span className="ml-2 text-white/80">
              Check the URL every time. Scammers clone pages and swap one letter.
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Smart contract protections</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            The contract includes ReentrancyGuard, Pausable, and emergency refund
            mechanisms. Chainlink VRF ensures provably fair randomness — no
            internal randomness that could be manipulated.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Transparency</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Round history, pools, payouts, and VRF proofs are all on-chain and
            auditable. Check the{" "}
            <Link
              href="/transparency"
              className="text-yellow-400 hover:text-yellow-300 underline"
            >
              Transparency
            </Link>{" "}
            page for live data.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Contract verification</div>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            The contract source code is verified on PolygonScan. Read every line,
            audit every function, verify that the rules match the documentation.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://polygonscan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
            >
              PolygonScan
            </a>
            <a
              href="https://vrf.chain.link"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
            >
              Chainlink VRF
            </a>
            <Link
              href="/docs/security"
              className="rounded-full border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 transition-colors"
            >
              Security docs
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
