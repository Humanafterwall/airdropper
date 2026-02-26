"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useAccount,
  useReadContract,
} from "@/lib/sim/hooks";
import { useSimulation } from "@/lib/sim/context";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits } from "viem";
import { PROJECT_CONTRACT, USDC_CONTRACT } from "@/lib/contracts";
import { MEMBERSHIP_TIER_NAMES } from "@/lib/sim/types";
import type { MembershipTier } from "@/lib/sim/types";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(val: bigint | undefined, decimals = 6): string {
  if (val === undefined) return "—";
  return Number(formatUnits(val, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { isSimMode, engine, controls } = useSimulation();
  const [copied, setCopied] = useState(false);

  const projectAddr = PROJECT_CONTRACT.address as `0x${string}`;
  const usdcAddr = USDC_CONTRACT.address as `0x${string}`;

  // ── On-chain reads ──

  const { data: usdcBalance } = useReadContract({
    address: usdcAddr,
    abi: USDC_CONTRACT.abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: currentRoundId } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "currentRoundId",
  });

  const { data: isInfluencer } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "isInfluencer",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: hasDeposited } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "hasEverDeposited",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: myReferrer } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "referrerOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: aggregatorBal } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "aggregatorBalance",
  });

  // ── Sim-only data (referral counts, history) ──

  const referralCount = useMemo(() => {
    if (!isSimMode || !engine || !address) return 0;
    return engine.getReferralCount(address);
  }, [isSimMode, engine, address]);

  const activeReferralCount = useMemo(() => {
    if (!isSimMode || !engine || !address) return 0;
    return engine.getActiveReferralCount(address);
  }, [isSimMode, engine, address]);

  const referrals = useMemo(() => {
    if (!isSimMode || !engine || !address) return [];
    return engine.getReferrals(address);
  }, [isSimMode, engine, address]);

  const roundHistory = useMemo(() => {
    if (!isSimMode || !engine || !address) return [];
    return engine.getUserRoundHistory(address);
  }, [isSimMode, engine, address]);

  const totalWinnings = useMemo(() => {
    return roundHistory.reduce((sum, r) => sum + r.payout, 0n);
  }, [roundHistory]);

  const totalEntriesAllRounds = useMemo(() => {
    return roundHistory.reduce((sum, r) => sum + r.entries, 0n);
  }, [roundHistory]);

  // Leaderboard rank
  const leaderboardRank = useMemo(() => {
    if (!isSimMode || !engine || !address) return 0;
    return engine.getUserLeaderboardRank(address);
  }, [isSimMode, engine, address]);

  // JackDrop tickets
  const jackDropTickets = useMemo(() => {
    if (!isSimMode || !engine || !address) return 0;
    const participation = engine.state.cycleRoundParticipation.get(address.toLowerCase());
    return participation?.size ?? 0;
  }, [isSimMode, engine, address]);

  // Cycle info
  const cycleId = useMemo(() => {
    if (!isSimMode || !engine) return 1n;
    return engine.state.cycleId;
  }, [isSimMode, engine]);

  // ── Membership profile ──
  const userProfile = useMemo(() => {
    if (!isSimMode || !engine || !address) return null;
    return engine.getUserProfile(address);
  }, [isSimMode, engine, address]);

  // ── Airdrop eligibility ──
  const userAirdrops = useMemo(() => {
    if (!isSimMode || !engine || !address) return [];
    return engine.getUserAirdrops(address);
  }, [isSimMode, engine, address]);

  const unclaimedAirdrops = useMemo(() => {
    return userAirdrops.filter(a => !a.claimed);
  }, [userAirdrops]);

  // ── Referral link ──

  const referralLink = useMemo(() => {
    if (!address) return "";
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    return `${base}/play?ref=${address}`;
  }, [address]);

  const handleCopy = useCallback(() => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [referralLink]);

  // ── Not connected state ──

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-4 text-white/70">
            Connect your wallet to access your personal dashboard.
          </p>
          <div className="mt-6 flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </main>
    );
  }

  const referrerAddr = myReferrer as string | undefined;
  const isZeroAddr = !referrerAddr || referrerAddr === "0x0000000000000000000000000000000000000000";

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-white/50">
            {shortAddr(address!)} — Your private wallet overview
          </p>
        </div>
        <ConnectButton />
      </div>

      {/* ── Airdrop claim banner ── */}
      {unclaimedAirdrops.length > 0 && (
        <section className="mt-8">
          <div className="rounded-3xl border-2 border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                <span className="text-xl">&#127873;</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-green-400">
                  You have {unclaimedAirdrops.length} unclaimed airdrop{unclaimedAirdrops.length > 1 ? "s" : ""}!
                </h3>
                <p className="text-sm text-white/60">Claim your rewards below</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {unclaimedAirdrops.map((a) => (
                <div
                  key={a.campaign.id}
                  className="flex items-center justify-between rounded-xl border border-green-500/20 bg-black/30 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold">{a.campaign.name}</div>
                    <div className="text-xs text-white/50">Campaign #{a.campaign.id}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">{fmt(a.amount)} USDC</div>
                    </div>
                    <button
                      onClick={() => controls.userClaimAirdrop(a.campaign.id)}
                      className="rounded-xl bg-green-500 px-5 py-2 text-sm font-semibold text-black hover:bg-green-400 transition-colors"
                    >
                      Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Wallet overview ── */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">USDC Balance</div>
          <div className="mt-1 text-2xl font-bold text-green-400">
            {usdcBalance !== undefined ? fmt(usdcBalance as bigint) : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Total Entries</div>
          <div className="mt-1 text-2xl font-bold">
            {totalEntriesAllRounds > 0n ? totalEntriesAllRounds.toString() : "0"}
          </div>
          <div className="mt-1 text-xs text-white/40">
            Across {roundHistory.length} round{roundHistory.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Total Winnings</div>
          <div className="mt-1 text-2xl font-bold text-yellow-400">
            {totalWinnings > 0n ? `${fmt(totalWinnings)} USDC` : "0"}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Status</div>
          <div className="mt-1 text-2xl font-bold">
            {isInfluencer ? (
              <span className="text-purple-400">Influencer</span>
            ) : hasDeposited ? (
              <span className="text-blue-400">Active</span>
            ) : (
              <span className="text-white/40">New</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Membership card ── */}
      {userProfile && (
        <section className="mt-4">
          <div className={`rounded-2xl border p-5 ${
            userProfile.membershipTier === 3
              ? "border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-amber-500/5"
              : userProfile.membershipTier === 2
                ? "border-purple-500/20 bg-purple-500/5"
                : userProfile.membershipTier === 1
                  ? "border-blue-500/20 bg-blue-500/5"
                  : "border-white/10 bg-white/5"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`text-3xl font-bold ${
                  userProfile.membershipTier === 3 ? "text-yellow-400" :
                  userProfile.membershipTier === 2 ? "text-purple-400" :
                  userProfile.membershipTier === 1 ? "text-blue-400" :
                  "text-white/40"
                }`}>
                  {MEMBERSHIP_TIER_NAMES[userProfile.membershipTier]}
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-mono">
                  Serial #{userProfile.serialNumber}
                  {userProfile.serialNumber <= 1000 && (
                    <span className="ml-1.5 text-green-400 font-semibold">Early Adopter</span>
                  )}
                </span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
              <div>
                <div className="text-xs text-white/50">Current Streak</div>
                <div className="text-lg font-bold">{userProfile.currentStreak} epochs</div>
              </div>
              <div>
                <div className="text-xs text-white/50">Longest Streak</div>
                <div className="text-lg font-bold">{userProfile.longestStreak} epochs</div>
              </div>
              <div>
                <div className="text-xs text-white/50">Active Epochs</div>
                <div className="text-lg font-bold">{userProfile.activeEpochs}</div>
              </div>
              <div>
                <div className="text-xs text-white/50">Rounds Played</div>
                <div className="text-lg font-bold">{userProfile.totalRoundsPlayed}</div>
              </div>
            </div>
            {/* Next tier progress */}
            {userProfile.membershipTier < 3 && (
              <div className="mt-4">
                <div className="text-xs text-white/50">
                  {userProfile.membershipTier === 0
                    ? `Progress to Member: ${userProfile.longestStreak}/4 consecutive epochs`
                    : userProfile.membershipTier === 1
                      ? `Progress to Veteran: ${userProfile.longestStreak}/12 consecutive epochs`
                      : `Progress to OG: ${userProfile.longestStreak}/26 consecutive epochs${userProfile.serialNumber > 1000 ? " (requires Early Adopter)" : ""}`
                  }
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      userProfile.membershipTier === 0 ? "bg-blue-500" :
                      userProfile.membershipTier === 1 ? "bg-purple-500" :
                      "bg-yellow-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (userProfile.longestStreak / (
                        userProfile.membershipTier === 0 ? 4 :
                        userProfile.membershipTier === 1 ? 12 : 26
                      )) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Claimed airdrop history ── */}
      {userAirdrops.filter(a => a.claimed).length > 0 && (
        <section className="mt-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Airdrop History</div>
            <div className="mt-3 space-y-2">
              {userAirdrops.filter(a => a.claimed).map((a) => (
                <div
                  key={a.campaign.id}
                  className="flex items-center justify-between rounded-xl border border-green-500/10 bg-green-500/5 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-semibold">{a.campaign.name}</span>
                    <span className="ml-2 text-xs text-white/50">#{a.campaign.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-400">+{fmt(a.amount)} USDC</span>
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                      CLAIMED
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── JackDrop & Leaderboard ── */}
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-yellow-500/10 bg-yellow-500/5 p-4">
          <div className="text-xs text-white/50">JackDrop Tickets</div>
          <div className="mt-1 text-3xl font-bold text-yellow-400">
            {jackDropTickets}
          </div>
          <div className="mt-1 text-xs text-white/40">
            {jackDropTickets} {jackDropTickets === 1 ? "round" : "rounds"} played this cycle
          </div>
        </div>
        <div className="rounded-2xl border border-purple-500/10 bg-purple-500/5 p-4">
          <div className="text-xs text-white/50">Leaderboard Rank</div>
          <div className="mt-1 text-3xl font-bold text-purple-400">
            {leaderboardRank > 0 ? `#${leaderboardRank}` : "—"}
          </div>
          <div className="mt-1 text-xs text-white/40">
            {leaderboardRank > 0 ? "By active referrals" : "No active referrals yet"}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Cycle</div>
          <div className="mt-1 text-3xl font-bold text-white">
            #{cycleId.toString()}
          </div>
          <div className="mt-1 text-xs text-white/40">
            Resets after JackDrop trigger
          </div>
        </div>
      </section>

      {/* ── Referral Link Creator ── */}
      <section className="mt-8 rounded-3xl border border-purple-500/20 bg-purple-500/5 p-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-purple-400" />
          <h2 className="text-lg font-semibold text-purple-400">
            Your Referral Link
          </h2>
        </div>
        <p className="mt-2 text-sm text-white/60">
          Share this link on social media, in your video descriptions, or
          anywhere. When someone uses your link, they&apos;re permanently
          registered as your referral.
        </p>

        <div className="mt-4 flex gap-2">
          <div className="flex-1 rounded-xl border border-white/15 bg-black/50 px-4 py-3 font-mono text-sm text-white/80 overflow-x-auto">
            {referralLink || "Loading..."}
          </div>
          <button
            onClick={handleCopy}
            className={[
              "shrink-0 rounded-xl px-5 py-3 text-sm font-semibold transition-all",
              copied
                ? "bg-green-500 text-black"
                : "bg-purple-500 text-white hover:bg-purple-400",
            ].join(" ")}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="mt-3 text-xs text-white/40">
          Format: {typeof window !== "undefined" ? window.location.origin : ""}/play?ref=YOUR_WALLET
        </div>
      </section>

      {/* ── Referral Stats ── */}
      <section className="mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          Referral Performance
        </h2>
        <p className="mt-1 text-sm text-white/50">
          Track who joined through your link and their activity
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Total Referrals</div>
            <div className="mt-1 text-3xl font-bold text-purple-400">
              {referralCount}
            </div>
            <div className="mt-1 text-xs text-white/40">
              Users who used your link
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Active Referrals</div>
            <div className="mt-1 text-3xl font-bold text-green-400">
              {activeReferralCount}
            </div>
            <div className="mt-1 text-xs text-white/40">
              Deposited 100+ USDC this cycle
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Aggregator Pool</div>
            <div className="mt-1 text-3xl font-bold text-blue-400">
              {aggregatorBal !== undefined ? fmt(aggregatorBal as bigint) : "—"}
            </div>
            <div className="mt-1 text-xs text-white/40">
              5% from every round
            </div>
          </div>
        </div>

        {/* Referral list */}
        {referrals.length > 0 && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Your Referrals</div>
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {referrals.map((ref) => (
                <div
                  key={ref.address}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        ref.active ? "bg-green-400" : "bg-white/20"
                      }`}
                    />
                    <span className="font-mono text-white/70">
                      {shortAddr(ref.address)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-white/50">
                      {fmt(ref.deposited)} USDC
                    </span>
                    {ref.active && (
                      <span className="ml-2 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Your Referrer ── */}
      <section className="mt-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Your Referrer</div>
          <div className="mt-1 text-sm font-mono text-white/70">
            {isZeroAddr ? (
              <span className="text-white/30">None — you joined directly</span>
            ) : (
              shortAddr(referrerAddr!)
            )}
          </div>
        </div>
      </section>

      {/* ── Round History ── */}
      {roundHistory.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            Round History
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Your participation across all rounds
          </p>

          <div className="mt-5 space-y-2">
            {roundHistory
              .slice()
              .reverse()
              .map((r) => (
                <div
                  key={r.roundId}
                  className={[
                    "flex items-center justify-between rounded-2xl border p-4",
                    r.won
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-white/10 bg-white/5",
                  ].join(" ")}
                >
                  <div>
                    <div className="text-sm font-semibold">
                      Round #{r.roundId}
                    </div>
                    <div className="text-xs text-white/50">
                      {r.entries.toString()} {Number(r.entries) === 1 ? "entry" : "entries"}
                    </div>
                  </div>
                  <div className="text-right">
                    {r.won ? (
                      <>
                        <div className="text-sm font-bold text-green-400">
                          +{fmt(r.payout)} USDC
                        </div>
                        <div className="text-xs text-white/50">
                          {r.claimed ? "Claimed" : "Unclaimed"}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-white/30">No win</div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ── Quick links ── */}
      <section className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href="/play"
          className="rounded-full bg-white px-6 py-2.5 font-semibold text-black hover:opacity-90 transition-opacity"
        >
          Enter Current Round
        </Link>
        <Link
          href="/docs/referrals"
          className="rounded-full border border-white/20 px-6 py-2.5 text-white/70 hover:bg-white/5 transition-colors"
        >
          How Referrals Work
        </Link>
        <Link
          href="/transparency"
          className="rounded-full border border-white/20 px-6 py-2.5 text-white/70 hover:bg-white/5 transition-colors"
        >
          Transparency
        </Link>
      </section>
    </main>
  );
}
