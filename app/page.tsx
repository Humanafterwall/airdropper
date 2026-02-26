"use client";

import Link from "next/link";
import { useReadContract } from "@/lib/sim/hooks";
import { PROJECT_CONTRACT } from "@/lib/contracts";
import { formatUnits } from "viem";
import { JackDropPoolViz } from "@/components/JackDropPoolViz";
import { NeonGlowCard } from "@/components/NeonGlowCard";
import { WalletCounter } from "@/components/WalletCounter";
import { ReferralLeaderboard } from "@/components/ReferralLeaderboard";

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(val: bigint | undefined, decimals = 6): string {
  if (val === undefined) return "\u2014";
  return Number(formatUnits(val, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? "text-white"}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-white/40">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  odds comparison data                                               */
/* ------------------------------------------------------------------ */

const odds = [
  {
    name: "Airdropper",
    odds: "~1 in 50",
    pct: "2%",
    bar: 100,
    color: "bg-green-500",
    note: "100 players, 2 winners",
  },
  {
    name: "Scratch cards",
    odds: "1 in 4",
    pct: "25%",
    bar: 80,
    color: "bg-yellow-500",
    note: "Any prize (mostly 1 USDC equivalent)",
  },
  {
    name: "Online slots",
    odds: "House edge 2-15%",
    pct: "\u2014",
    bar: 15,
    color: "bg-orange-500",
    note: "Always lose long-term",
  },
  {
    name: "EuroJackpot",
    odds: "1 in 140M",
    pct: "0.0000007%",
    bar: 1,
    color: "bg-red-500",
    note: "Jackpot odds",
  },
  {
    name: "Powerball",
    odds: "1 in 292M",
    pct: "0.0000003%",
    bar: 1,
    color: "bg-red-700",
    note: "Jackpot odds",
  },
];

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

export default function Home() {
  const addr = PROJECT_CONTRACT.address as `0x${string}`;
  const abi = PROJECT_CONTRACT.abi;

  const { data: roundId } = useReadContract({
    address: addr,
    abi,
    functionName: "currentRoundId",
  });

  const { data: roundInfo } = useReadContract({
    address: addr,
    abi,
    functionName: "getRoundInfo",
    args: roundId ? [roundId as bigint] : [BigInt(1)],
    query: { enabled: !!roundId },
  });

  const { data: jackpotBal } = useReadContract({
    address: addr,
    abi,
    functionName: "jackpotBalance",
  });

  const { data: roundCfg } = useReadContract({
    address: addr,
    abi,
    functionName: "roundCfg",
  });

  const { data: cycleCfg } = useReadContract({
    address: addr,
    abi,
    functionName: "cycleCfg",
  });

  // parse round info tuple
  const info = roundInfo as readonly unknown[] | undefined;
  const totalPool = info ? (info[4] as bigint) : undefined;
  const totalEntries = info ? (info[5] as bigint) : undefined;
  const uniquePlayers = info ? (info[6] as bigint) : undefined;
  const isOpen = info ? (info[7] as boolean) : undefined;

  // parse round config
  const cfg = roundCfg as readonly unknown[] | undefined;
  const entryPrice = cfg ? (cfg[0] as bigint) : undefined;

  // parse cycle config for dynamic JackDrop target + prizes
  const ccfg = cycleCfg as readonly unknown[] | undefined;
  const jackTarget = ccfg ? (ccfg[0] as bigint) : undefined;

  const prize1st = jackTarget ? (jackTarget * 75n) / 100n : undefined;
  const prize2nd = jackTarget ? (jackTarget * 10n) / 100n : undefined;
  const prizeRest = jackTarget ? (jackTarget * 1n) / 100n : undefined;

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      {/* ── Hero ── */}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          {/* Left: Title + CTA + Pool split */}
          <div className="flex flex-1 flex-col justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Airdropper
              </h1>
              <p className="mt-1 text-sm text-white/50">
                Polygon &bull; USDC &bull; Chainlink VRF
              </p>
              <p className="mt-3 text-base leading-relaxed text-white/80">
                75% to winners. No house edge. Provably fair.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/play"
                  className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
                >
                  Open App
                </Link>
                <Link
                  href="/how-it-works"
                  className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
                >
                  How it works
                </Link>
              </div>
            </div>

            {/* Pool split cards */}
            <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <NeonGlowCard accent="green" animated={false}>
                <div className="p-2.5 text-center">
                  <div className="text-xl font-bold text-green-400">75%</div>
                  <div className="text-[10px] text-white/50">Rewards</div>
                </div>
              </NeonGlowCard>
              <NeonGlowCard accent="yellow" animated={false}>
                <div className="p-2.5 text-center">
                  <div className="text-xl font-bold text-yellow-400">10%</div>
                  <div className="text-[10px] text-white/50">JackDrop</div>
                </div>
              </NeonGlowCard>
              <NeonGlowCard accent="blue" animated={false}>
                <div className="p-2.5 text-center">
                  <div className="text-xl font-bold text-blue-400">10%</div>
                  <div className="text-[10px] text-white/50">Dev</div>
                </div>
              </NeonGlowCard>
              <NeonGlowCard accent="purple" animated={false}>
                <div className="p-2.5 text-center">
                  <div className="text-xl font-bold text-purple-400">5%</div>
                  <div className="text-[10px] text-white/50">SPA</div>
                </div>
              </NeonGlowCard>
            </div>
          </div>

          {/* Right: JackDrop Pool — vertical epruveta */}
          <div className="flex justify-center lg:w-auto">
            <NeonGlowCard accent="green">
              <div className="px-4 py-5">
                <JackDropPoolViz
                  balance={(jackpotBal as bigint) ?? 0n}
                  target={jackTarget ?? 100_000_000_000n}
                  prizes={
                    prize1st && prize2nd && prizeRest
                      ? { first: prize1st, second: prize2nd, rest: prizeRest }
                      : undefined
                  }
                />
              </div>
            </NeonGlowCard>
          </div>
        </div>
      </section>

      {/* ── Community + Referral ── */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <NeonGlowCard accent="white" animated={false}>
          <div className="p-6">
            <WalletCounter />
          </div>
        </NeonGlowCard>
        <NeonGlowCard accent="purple" animated={false}>
          <div className="p-6">
            <ReferralLeaderboard />
          </div>
        </NeonGlowCard>
      </section>

      {/* ── Live stats ── */}
      <section className="mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">Live stats</h2>
        <p className="mt-1 text-sm text-white/50">
          Read directly from the smart contract on Polygon
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <NeonGlowCard accent="green" animated={false}>
            <Stat
              label="Current round"
              value={roundId != null ? `#${roundId.toString()}` : "\u2014"}
              sub={
                isOpen === true
                  ? "OPEN"
                  : isOpen === false
                    ? "CLOSED"
                    : "Loading..."
              }
              accent={isOpen === true ? "text-green-400" : "text-white"}
            />
          </NeonGlowCard>
          <NeonGlowCard accent="white" animated={false}>
            <Stat
              label="Round pool"
              value={
                totalPool !== undefined ? `${fmt(totalPool)} USDC` : "\u2014"
              }
              sub={
                totalEntries !== undefined
                  ? `${totalEntries.toString()} entries`
                  : undefined
              }
            />
          </NeonGlowCard>
          <NeonGlowCard accent="white" animated={false}>
            <Stat
              label="Players this round"
              value={
                uniquePlayers !== undefined
                  ? uniquePlayers.toString()
                  : "\u2014"
              }
              sub={
                entryPrice !== undefined
                  ? `Entry: ${fmt(entryPrice)} USDC`
                  : undefined
              }
            />
          </NeonGlowCard>
          <NeonGlowCard accent="yellow" animated={false}>
            <Stat
              label="JackDrop reserve"
              value={
                jackpotBal != null
                  ? `${fmt(jackpotBal as bigint)} USDC`
                  : "\u2014"
              }
              accent="text-yellow-400"
              sub="17 winners when target reached"
            />
          </NeonGlowCard>
        </div>
      </section>

      {/* ── Odds comparison ── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Your odds, in perspective
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Airdropper vs. traditional lotteries and gambling. All numbers are
          publicly verifiable.
        </p>

        <div className="mt-6 space-y-3">
          {odds.map((o) => (
            <NeonGlowCard
              key={o.name}
              animated={false}
              accent={
                o.name === "Airdropper"
                  ? "green"
                  : o.name === "Scratch cards"
                    ? "yellow"
                    : "white"
              }
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{o.name}</div>
                    <div className="text-xs text-white/50">{o.note}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{o.odds}</div>
                    <div className="text-xs text-white/50">{o.pct}</div>
                  </div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${o.color} transition-all`}
                    style={{ width: `${o.bar}%` }}
                  />
                </div>
              </div>
            </NeonGlowCard>
          ))}
        </div>

        <p className="mt-4 text-xs text-white/40">
          Airdropper odds are real-time and depend on the number of entries.
          With fewer players, your odds are even better. Conventional lottery
          odds are fixed and astronomically low.
        </p>
      </section>

      {/* ── Why different ── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Why Airdropper is different
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "No house edge",
              text: "100% of deposits go to the pools. The contract takes nothing beyond the transparent 75/10/10/5 split.",
            },
            {
              title: "Whale-proof",
              text: "Max 10 entries per wallet per round. On-chain enforced \u2014 no exceptions. One wallet, one fair chance.",
            },
            {
              title: "Provably fair",
              text: "Chainlink VRF generates verifiable randomness. Every VRF proof is on-chain and independently verifiable.",
            },
            {
              title: "Anti-addiction design",
              text: "Low cap per wallet. Clear rules. No flashy autoplay. Designed to be simple and transparent, not addictive.",
            },
            {
              title: "Self-custody",
              text: "Your USDC stays in the smart contract, not a company wallet. Claim payouts directly \u2014 no withdrawal requests.",
            },
            {
              title: "Open source",
              text: "Contract code is public and verified on PolygonScan. Read it, audit it, verify it yourself.",
            },
          ].map((card) => (
            <NeonGlowCard key={card.title} accent="white" animated={false}>
              <div className="p-5">
                <div className="text-sm font-semibold">{card.title}</div>
                <p className="mt-2 text-sm text-white/70">{card.text}</p>
              </div>
            </NeonGlowCard>
          ))}
        </div>
      </section>

      {/* ── Transparency links ── */}
      <section className="mt-12">
        <NeonGlowCard accent="white" animated={false}>
          <div className="p-6">
            <h3 className="text-lg font-semibold">Verify everything</h3>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <a
                href="https://polygonscan.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 px-4 py-2 text-white/70 hover:bg-white/5 transition-colors"
              >
                PolygonScan
              </a>
              <Link
                href="/transparency"
                className="rounded-full border border-white/20 px-4 py-2 text-white/70 hover:bg-white/5 transition-colors"
              >
                Round history
              </Link>
              <Link
                href="/fairness"
                className="rounded-full border border-white/20 px-4 py-2 text-white/70 hover:bg-white/5 transition-colors"
              >
                Fairness proofs
              </Link>
              <Link
                href="/docs"
                className="rounded-full border border-white/20 px-4 py-2 text-white/70 hover:bg-white/5 transition-colors"
              >
                Documentation
              </Link>
            </div>
          </div>
        </NeonGlowCard>
      </section>

      {/* ── CTA ── */}
      <section className="mt-12 text-center">
        <Link
          href="/play"
          className="inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
        >
          Enter the current round
        </Link>
        <p className="mt-3 text-xs text-white/40">
          Polygon PoS &bull; Gas fees &lt; 0.01 USDC &bull; USDC payments
        </p>
      </section>
    </main>
  );
}
