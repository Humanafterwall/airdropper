"use client";

import type { JackDropWinnerEntry } from "@/lib/sim/types";
import { formatUnits } from "viem";

function fmt(val: bigint): string {
  return Number(formatUnits(val, 6)).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

const RANK_COLORS: Record<number, string> = {
  0: "text-yellow-300", // Grand Prize
  1: "text-gray-300",   // 2nd
};

export function JackDropCelebration({
  results,
  connectedAddress,
  claimedByUser,
  onClaim,
  claimPending,
}: {
  results: JackDropWinnerEntry[];
  connectedAddress?: string;
  claimedByUser: boolean;
  onClaim: () => void;
  claimPending: boolean;
}) {
  if (results.length === 0) return null;

  const addr = connectedAddress?.toLowerCase();
  const userEntry = addr ? results.find(w => w.address === addr) : undefined;
  const userRank = userEntry ? results.indexOf(userEntry) : -1;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 via-black to-black p-6">
      {/* Animated glow background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent animate-pulse" />

      <div className="relative">
        {/* Header */}
        <div className="mb-4 text-center">
          <div className="text-3xl font-black tracking-tight text-yellow-400">
            JACKDROP TRIGGERED!
          </div>
          <div className="mt-1 text-sm text-white/60">
            {fmt(results.reduce((sum, w) => sum + w.amount, 0n))} USDC distributed to {results.length} winners
          </div>
        </div>

        {/* User win banner */}
        {userEntry && (
          <div className="mb-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-center">
            <div className="text-sm font-semibold text-yellow-400">
              Congratulations! You won!
            </div>
            <div className="mt-1 text-2xl font-black text-yellow-300">
              {fmt(userEntry.amount)} USDC
            </div>
            <div className="mt-0.5 text-xs text-white/50">
              {userRank === 0 ? "Grand Prize" : userRank === 1 ? "2nd Prize" : `${userRank + 1}th Prize`}
            </div>
            {!claimedByUser && (
              <button
                onClick={onClaim}
                disabled={claimPending}
                className="mt-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-8 py-2.5 text-sm font-bold text-black transition hover:from-yellow-400 hover:to-orange-400 disabled:opacity-50"
              >
                {claimPending ? "Claiming..." : "Claim Prize"}
              </button>
            )}
            {claimedByUser && (
              <div className="mt-2 text-sm font-semibold text-green-400">
                Prize claimed successfully!
              </div>
            )}
          </div>
        )}

        {/* Winners list */}
        <div className="space-y-1.5">
          {results.map((winner, i) => {
            const isUser = addr && winner.address === addr;
            const color = RANK_COLORS[i] ?? "text-white/60";

            return (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                  isUser
                    ? "border border-yellow-500/30 bg-yellow-500/10"
                    : i === 0
                      ? "border border-yellow-500/10 bg-yellow-500/5"
                      : "bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-6 text-center font-bold ${color}`}>
                    {i === 0 ? "\uD83C\uDFC6" : `#${i + 1}`}
                  </span>
                  <span className="font-mono">
                    {winner.address.slice(0, 6)}...{winner.address.slice(-4)}
                  </span>
                  {isUser && (
                    <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-bold text-yellow-400">
                      YOU
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${color}`}>
                    {fmt(winner.amount)} USDC
                  </span>
                  {winner.claimed && (
                    <span className="text-[9px] text-green-400">claimed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
