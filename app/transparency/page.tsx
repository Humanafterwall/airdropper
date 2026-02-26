"use client";

import { useState } from "react";
import { useReadContract } from "@/lib/sim/hooks";
import { formatUnits } from "viem";
import { PROJECT_CONTRACT } from "@/lib/contracts";

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(val: bigint | undefined, decimals = 6): string {
  if (val === undefined) return "—";
  return Number(formatUnits(val, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function addr(a: string | undefined): string {
  if (!a || a === "0x0000000000000000000000000000000000000000") return "—";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/*  Round detail component                                             */
/* ------------------------------------------------------------------ */

function RoundDetail({ id }: { id: bigint }) {
  const projectAddr = PROJECT_CONTRACT.address as `0x${string}`;

  const { data: info } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "getRoundInfo",
    args: [id],
  });

  const { data: participants } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "participants",
    args: [id],
  });

  const { data: jackWinner } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "jackDropWinner",
    args: [id],
  });

  const { data: jackAmount } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "jackDropAmount",
    args: [id],
  });

  // read first 3 winners
  const { data: winner0 } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "roundWinners",
    args: [id, BigInt(0)],
  });

  const { data: winner1 } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "roundWinners",
    args: [id, BigInt(1)],
  });

  const tuple = info as readonly unknown[] | undefined;
  if (!tuple) return <div className="text-sm text-white/50">Loading...</div>;

  const startTime = Number(tuple[0] as bigint);
  const totalPool = tuple[4] as bigint;
  const totalEntries = tuple[5] as bigint;
  const uniquePlayers = tuple[6] as bigint;
  const isOpen = tuple[7] as boolean;
  const isEmergency = tuple[8] as boolean;
  const jackTriggered = tuple[9] as boolean;
  const winnersResolved = tuple[10] as boolean;

  const startDate = startTime
    ? new Date(startTime * 1000).toLocaleString()
    : "—";

  const participantList = participants as readonly string[] | undefined;

  return (
    <div className="space-y-4">
      {/* Round stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/50">Pool</div>
          <div className="text-lg font-semibold">{fmt(totalPool)} USDC</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/50">Entries</div>
          <div className="text-lg font-semibold">{totalEntries.toString()}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/50">Players</div>
          <div className="text-lg font-semibold">{uniquePlayers.toString()}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/50">Started</div>
          <div className="text-sm font-semibold">{startDate}</div>
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-wrap gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isOpen
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-white/10 text-white/60 border border-white/10"
          }`}
        >
          {isOpen ? "Open" : "Closed"}
        </span>
        {winnersResolved && (
          <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
            Winners resolved
          </span>
        )}
        {isEmergency && (
          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
            Emergency
          </span>
        )}
        {jackTriggered && (
          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
            JackDrop triggered!
          </span>
        )}
      </div>

      {/* Winners */}
      {winnersResolved && (
        <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-4">
          <div className="text-sm font-semibold text-green-400">Winners</div>
          <div className="mt-2 space-y-1 text-sm font-mono text-white/70">
            {!!winner0 &&
              (winner0 as string) !==
                "0x0000000000000000000000000000000000000000" && (
                <div>1st: {winner0 as string}</div>
              )}
            {!!winner1 &&
              (winner1 as string) !==
                "0x0000000000000000000000000000000000000000" && (
                <div>2nd: {winner1 as string}</div>
              )}
          </div>
        </div>
      )}

      {/* JackDrop */}
      {jackTriggered && (
        <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-4">
          <div className="text-sm font-semibold text-yellow-400">
            JackDrop winner
          </div>
          <div className="mt-2 text-sm font-mono text-white/70">
            {addr(jackWinner as string | undefined)}
          </div>
          <div className="text-sm text-yellow-400">
            {fmt(jackAmount as bigint | undefined)} USDC
          </div>
        </div>
      )}

      {/* Participants */}
      {participantList && participantList.length > 0 && (
        <div>
          <div className="text-sm font-semibold">
            Participants ({participantList.length})
          </div>
          <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3">
            {participantList.map((p, i) => (
              <div
                key={i}
                className="text-xs font-mono text-white/60 py-0.5"
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

export default function TransparencyPage() {
  const projectAddr = PROJECT_CONTRACT.address as `0x${string}`;

  const { data: currentRoundId } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "currentRoundId",
  });

  const { data: devBal } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "devBalance",
  });

  const { data: aggBal } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "aggregatorBalance",
  });

  const { data: jackBal } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "jackpotBalance",
  });

  const roundCount = currentRoundId
    ? Number(currentRoundId as bigint)
    : 0;

  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Transparency
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/70">
          Every round, every payout, every number — on-chain and verifiable.
          This page reads directly from the smart contract.
        </p>
      </div>

      {/* Contract balances */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-yellow-500/10 bg-yellow-500/5 p-5">
          <div className="text-xs text-white/50">JackDrop reserve</div>
          <div className="mt-1 text-2xl font-bold text-yellow-400">
            {fmt(jackBal as bigint | undefined)} USDC
          </div>
        </div>
        <div className="rounded-2xl border border-blue-500/10 bg-blue-500/5 p-5">
          <div className="text-xs text-white/50">Development fund</div>
          <div className="mt-1 text-2xl font-bold text-blue-400">
            {fmt(devBal as bigint | undefined)} USDC
          </div>
          <div className="mt-1 text-xs text-white/40">
            For infrastructure, audits, and improvements
          </div>
        </div>
        <div className="rounded-2xl border border-purple-500/10 bg-purple-500/5 p-5">
          <div className="text-xs text-white/50">Aggregator fund</div>
          <div className="mt-1 text-2xl font-bold text-purple-400">
            {fmt(aggBal as bigint | undefined)} USDC
          </div>
          <div className="mt-1 text-xs text-white/40">
            For influencer rewards (self-propelled marketing)
          </div>
        </div>
      </div>

      {/* Round browser */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          Round history
        </h2>
        <p className="mt-2 text-sm text-white/50">
          {roundCount > 0
            ? `${roundCount} rounds played. Select a round to inspect.`
            : "No rounds yet. Waiting for contract deployment."}
        </p>

        {roundCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: roundCount }, (_, i) => i + 1)
              .reverse()
              .map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    setSelectedRound(selectedRound === n ? null : n)
                  }
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedRound === n
                      ? "bg-white text-black"
                      : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  #{n}
                </button>
              ))}
          </div>
        )}

        {selectedRound && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold">
              Round #{selectedRound}
            </h3>
            <div className="mt-4">
              <RoundDetail id={BigInt(selectedRound)} />
            </div>
          </div>
        )}
      </div>

      {/* Verification links */}
      <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold">Verify independently</h3>
        <p className="mt-2 text-sm text-white/70">
          Don&apos;t trust — verify. Every piece of data on this page comes from the
          smart contract. You can confirm it yourself:
        </p>
        <div className="mt-4 space-y-2 text-sm text-white/70">
          <div className="flex items-center gap-2">
            <span className="text-white/40">1.</span>
            Go to{" "}
            <a
              href="https://polygonscan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 underline"
            >
              PolygonScan
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/40">2.</span>
            Search for the contract address
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/40">3.</span>
            Use &quot;Read Contract&quot; to call any view function
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/40">4.</span>
            Check VRF proofs on{" "}
            <a
              href="https://vrf.chain.link"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-300 underline"
            >
              Chainlink VRF Explorer
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
