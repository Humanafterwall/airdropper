"use client";

import { useSimulation } from "@/lib/sim/context";
import { useSyncExternalStore, useCallback } from "react";
import { formatUnits } from "viem";

const ONE_USDC = 1_000_000n;

function fmtUsdc(val: bigint): string {
  return Number(formatUnits(val, 6)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

/** Tier badge colours & labels */
const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  champion: { label: "Champion", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  elite: { label: "Elite", cls: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  rising: { label: "Rising", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  community: { label: "Top 100", cls: "bg-white/5 text-white/50 border-white/10" },
};

/** Row styling by rank */
const RANK_STYLES: Record<number, string> = {
  1: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  2: "text-gray-300 bg-gray-400/10 border-gray-400/30",
  3: "text-orange-400 bg-orange-500/10 border-orange-500/30",
};

const RANK_LABELS: Record<number, string> = {
  1: "1st",
  2: "2nd",
  3: "3rd",
};

export function ReferralLeaderboard() {
  const { isSimMode, engine } = useSimulation();

  const subscribe = useCallback(
    (cb: () => void) => engine?.subscribe(cb) ?? (() => {}),
    [engine]
  );
  const getSnapshot = useCallback(
    () => engine?.getVersion() ?? 0,
    [engine]
  );

  // Re-render when engine state changes
  useSyncExternalStore(subscribe, getSnapshot, () => 0);

  if (!isSimMode || !engine) {
    return (
      <>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-purple-400">SPA Leaderboard</h3>
        </div>
        <p className="text-sm text-white/50">
          Self-Propelled Aggregator — top 100 referrers share the 5% SPA pool automatically at cycle end. Connect wallet to see leaderboard.
        </p>
      </>
    );
  }

  const leaderboard = engine.getLeaderboard(100);
  const estimated = engine.getEstimatedSpaRewards();
  const spaBalance = engine.state.aggregatorBalance;

  // Build a map: address → estimated reward
  const rewardMap = new Map<string, { amount: bigint; tier: string }>();
  for (const e of estimated) {
    rewardMap.set(e.address, { amount: e.amount, tier: e.tier });
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-purple-400">SPA Leaderboard</h3>
          <p className="mt-0.5 text-[10px] text-white/40">
            100% of SPA pool auto-distributed to top 100 referrers at cycle end
          </p>
        </div>
        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
          Cycle #{engine.state.cycleId.toString()}
        </span>
      </div>

      {/* SPA pool balance */}
      {spaBalance > 0n && (
        <div className="mb-3 rounded-xl border border-purple-500/10 bg-purple-500/5 p-2.5 text-center">
          <div className="text-[10px] text-white/40">SPA Pool</div>
          <div className="text-lg font-bold text-purple-400 tabular-nums">
            {fmtUsdc(spaBalance)} USDC
          </div>
          <div className="mt-1 flex justify-center gap-2 text-[9px] text-white/30">
            <span>40% #1</span>
            <span>·</span>
            <span>30% #2-10</span>
            <span>·</span>
            <span>20% #11-30</span>
            <span>·</span>
            <span>10% #31-100</span>
          </div>
        </div>
      )}

      {leaderboard.length === 0 ? (
        <p className="text-sm text-white/40">No active referrals yet this cycle</p>
      ) : (
        <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
          {leaderboard.map((entry) => {
            const style = RANK_STYLES[entry.rank] ?? "text-white/60 bg-white/5 border-white/10";
            const label = RANK_LABELS[entry.rank] ?? `${entry.rank}th`;
            const reward = rewardMap.get(entry.address);
            const tierInfo = reward ? TIER_BADGE[reward.tier] : undefined;

            return (
              <div
                key={entry.address}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${style}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-7 text-center text-xs font-bold">{label}</span>
                  <span className="font-mono text-xs">
                    {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                  </span>
                  {tierInfo && (
                    <span className={`rounded-full border px-1.5 py-px text-[8px] font-semibold ${tierInfo.cls}`}>
                      {tierInfo.label}
                    </span>
                  )}
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <span className="text-sm font-bold">{entry.activeReferralCount}</span>
                    <span className="ml-1 text-[10px] text-white/40">refs</span>
                  </div>
                  {reward && reward.amount > 0n && (
                    <div className="text-[10px] font-semibold text-purple-400 tabular-nums">
                      ~{fmtUsdc(reward.amount)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="mt-2 text-center text-[9px] text-white/30">
          Showing top {leaderboard.length} referrers · Estimated rewards update in real-time
        </div>
      )}
    </>
  );
}
