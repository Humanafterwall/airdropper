"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "@/lib/sim/hooks";
import { useSimulation } from "@/lib/sim/context";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "wagmi/chains";
import { formatUnits, parseUnits } from "viem";
import { PROJECT_CONTRACT } from "@/lib/contracts";
import { MEMBERSHIP_TIER_NAMES } from "@/lib/sim/types";
import type { MembershipTier, UserProfile, AirdropCampaign } from "@/lib/sim/types";

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(val: bigint | undefined, decimals = 6): string {
  if (val === undefined) return "—";
  return Number(formatUnits(val, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        ok
          ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : "bg-red-500/10 text-red-400 border border-red-500/20"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

// Tier color helper
const TIER_COLORS: Record<number, string> = {
  0: "text-white/40",
  1: "text-blue-400",
  2: "text-purple-400",
  3: "text-yellow-400",
};

const TIER_BG: Record<number, string> = {
  0: "border-white/10 bg-white/5",
  1: "border-blue-500/20 bg-blue-500/5",
  2: "border-purple-500/20 bg-purple-500/5",
  3: "border-yellow-500/20 bg-yellow-500/5",
};

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = chainId !== polygonAmoy.id;
  const { isSimMode, engine, controls } = useSimulation();

  const projectAddr = PROJECT_CONTRACT.address as `0x${string}`;

  // ── On-chain reads ──

  const { data: owner } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "owner",
  });

  const { data: paused } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "paused",
  });

  const { data: currentRoundId } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "currentRoundId",
  });

  const roundId = currentRoundId as bigint | undefined;

  const { data: roundInfo } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "getRoundInfo",
    args: roundId ? [roundId] : [BigInt(1)],
    query: { enabled: !!roundId },
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

  const { data: cycleId } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "cycleId",
  });

  const { data: roundCfg } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "roundCfg",
  });

  const { data: cycleCfg } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "cycleCfg",
  });

  const { data: devWallet } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "devWallet",
  });

  // parse round info
  const info = roundInfo as readonly unknown[] | undefined;
  const totalPool = info ? (info[4] as bigint) : undefined;
  const totalEntries = info ? (info[5] as bigint) : undefined;
  const uniquePlayers = info ? (info[6] as bigint) : undefined;
  const isOpen = info ? (info[7] as boolean) : undefined;
  const isEmergency = info ? (info[8] as boolean) : undefined;
  const winnersResolved = info ? (info[10] as boolean) : undefined;

  // parse configs
  const rcfg = roundCfg as readonly unknown[] | undefined;
  const ccfg = cycleCfg as readonly unknown[] | undefined;

  // authorization check
  const isOwner =
    isConnected &&
    address &&
    owner &&
    address.toLowerCase() === (owner as string).toLowerCase();

  // ── Write actions ──

  const {
    writeContract: writeAction,
    data: actionTxHash,
    error: actionError,
    reset: resetAction,
  } = useWriteContract();

  const { isSuccess: actionConfirmed, isLoading: actionPending } =
    useWaitForTransactionReceipt({ hash: actionTxHash });

  const [lastAction, setLastAction] = useState("");

  // jack target state
  const [newJackTarget, setNewJackTarget] = useState("100000");

  // schedule config state
  const [cfgEntryPrice, setCfgEntryPrice] = useState("1");
  const [cfgMinPool, setCfgMinPool] = useState("100");
  const [cfgMinTime, setCfgMinTime] = useState("3600");
  const [cfgMaxEntries, setCfgMaxEntries] = useState("1000");
  const [cfgWinners, setCfgWinners] = useState("2");

  // ── Member registry state ──
  const [tierFilter, setTierFilter] = useState<number>(-1); // -1 = all
  const [serialFilter, setSerialFilter] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  // ── Airdrop creation state ──
  const [airdropName, setAirdropName] = useState("");
  const [airdropType, setAirdropType] = useState<"early" | "tier">("early");
  const [airdropMaxSerial, setAirdropMaxSerial] = useState("1000");
  const [airdropMinTier, setAirdropMinTier] = useState<number>(1);
  const [airdropBudget, setAirdropBudget] = useState("");
  const [airdropMsg, setAirdropMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Member data from simulation ──
  const allProfiles = useMemo(() => {
    if (!isSimMode || !engine) return [];
    return engine.getAllProfiles();
  }, [isSimMode, engine, engine?.getVersion?.()]);

  const filteredProfiles = useMemo(() => {
    let list = allProfiles;

    // Tier filter
    if (tierFilter >= 0) {
      list = list.filter(e => e.profile.membershipTier === tierFilter);
    }

    // Serial range filter
    if (serialFilter) {
      const parts = serialFilter.split("-").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        list = list.filter(e => e.profile.serialNumber >= parts[0] && e.profile.serialNumber <= parts[1]);
      } else if (parts.length === 1 && !isNaN(parts[0])) {
        list = list.filter(e => e.profile.serialNumber <= parts[0]);
      }
    }

    // Wallet search
    if (memberSearch) {
      const q = memberSearch.toLowerCase();
      list = list.filter(e => e.address.includes(q));
    }

    return list;
  }, [allProfiles, tierFilter, serialFilter, memberSearch]);

  const airdropCampaigns = useMemo(() => {
    if (!isSimMode || !engine) return [];
    return engine.getAirdropCampaigns();
  }, [isSimMode, engine, engine?.getVersion?.()]);

  const memberStats = useMemo(() => {
    const total = allProfiles.length;
    const members = allProfiles.filter(e => e.profile.membershipTier >= 1).length;
    const veterans = allProfiles.filter(e => e.profile.membershipTier >= 2).length;
    const ogs = allProfiles.filter(e => e.profile.membershipTier >= 3).length;
    const earlyAdopters = allProfiles.filter(e => e.profile.serialNumber <= 1000).length;
    return { total, members, veterans, ogs, earlyAdopters };
  }, [allProfiles]);

  const doAction = useCallback(
    (name: string, fn: () => void) => {
      resetAction();
      setLastAction(name);
      fn();
    },
    [resetAction]
  );

  // gate: not connected / wrong network / not owner
  if (!isConnected) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-3xl font-semibold">Admin panel</h1>
          <p className="mt-4 text-white/70">Connect your wallet to continue.</p>
          <div className="mt-6 flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </main>
    );
  }

  if (wrongNetwork) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-8 text-center">
          <h1 className="text-3xl font-semibold">Admin panel</h1>
          <p className="mt-4 text-yellow-300">
            Please switch to <b>Polygon Amoy</b> testnet.
          </p>
          <div className="mt-6 flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <h1 className="text-3xl font-semibold">Admin panel</h1>
          <p className="mt-4 text-red-400">
            Connected wallet is not the contract owner.
          </p>
          <p className="mt-2 text-sm text-white/50">
            Owner: {owner ? (owner as string) : "Loading..."}
          </p>
          <p className="mt-1 text-sm text-white/50">
            You: {address}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin panel</h1>
          <p className="mt-1 text-sm text-white/50">
            Owner: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>
        <ConnectButton />
      </div>

      {/* Transaction status */}
      {(actionPending || actionConfirmed || actionError) && (
        <div
          className={`mt-4 rounded-2xl border p-4 text-sm ${
            actionConfirmed
              ? "border-green-500/20 bg-green-500/10 text-green-400"
              : actionError
                ? "border-red-500/20 bg-red-500/10 text-red-400"
                : "border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
          }`}
        >
          {actionPending && `${lastAction} — waiting for confirmation...`}
          {actionConfirmed && `${lastAction} — confirmed!`}
          {actionError && `${lastAction} failed: ${actionError.message.slice(0, 150)}`}
        </div>
      )}

      {/* ── Dashboard ── */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Contract status</div>
          <div className="mt-2">
            <StatusBadge ok={!(paused as boolean)} label={paused ? "PAUSED" : "ACTIVE"} />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Current round</div>
          <div className="mt-1 text-xl font-bold">
            {roundId !== undefined ? `#${roundId.toString()}` : "—"}
          </div>
          <div className="text-xs text-white/50">
            {isOpen === true ? "Open" : isOpen === false ? "Closed" : "—"}
            {winnersResolved === false && !isOpen ? " • VRF pending" : ""}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Cycle</div>
          <div className="mt-1 text-xl font-bold">
            {cycleId !== undefined ? `#${(cycleId as bigint).toString()}` : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Round pool</div>
          <div className="mt-1 text-xl font-bold">
            {totalPool !== undefined ? `${fmt(totalPool)} USDC` : "—"}
          </div>
          <div className="text-xs text-white/50">
            {uniquePlayers?.toString() ?? "—"} players &bull;{" "}
            {totalEntries?.toString() ?? "—"} entries
          </div>
        </div>
      </div>

      {/* Balances */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-yellow-500/10 bg-yellow-500/5 p-4">
          <div className="text-xs text-white/50">JackDrop reserve</div>
          <div className="mt-1 text-xl font-bold text-yellow-400">
            {fmt(jackBal as bigint | undefined)} USDC
          </div>
        </div>
        <div className="rounded-2xl border border-blue-500/10 bg-blue-500/5 p-4">
          <div className="text-xs text-white/50">Dev balance</div>
          <div className="mt-1 text-xl font-bold text-blue-400">
            {fmt(devBal as bigint | undefined)} USDC
          </div>
        </div>
        <div className="rounded-2xl border border-purple-500/10 bg-purple-500/5 p-4">
          <div className="text-xs text-white/50">SPA Balance</div>
          <div className="mt-1 text-xl font-bold text-purple-400">
            {fmt(aggBal as bigint | undefined)} USDC
          </div>
          <div className="mt-1 text-[10px] text-white/30">Auto-distributed to top 100 referrers</div>
        </div>
      </div>

      {/* Addresses */}
      <div className="mt-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Dev wallet</div>
          <div className="mt-1 text-sm font-mono text-white/70 break-all">
            {devWallet ? (devWallet as string) : "—"}
          </div>
        </div>
      </div>

      {/* ── Round actions ── */}
      <h2 className="mt-10 text-xl font-semibold">Round management</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() =>
            doAction("closeRound", () =>
              writeAction({
                address: projectAddr,
                abi: PROJECT_CONTRACT.abi,
                functionName: "closeRound",
              })
            )
          }
          disabled={!isOpen}
          className="rounded-xl border border-white/15 bg-white/5 p-4 text-left hover:bg-white/10 transition-colors disabled:opacity-30"
        >
          <div className="text-sm font-semibold">Close round</div>
          <div className="text-xs text-white/50">
            Split pool + send VRF request
          </div>
        </button>

        <button
          onClick={() =>
            doAction("pause", () =>
              writeAction({
                address: projectAddr,
                abi: PROJECT_CONTRACT.abi,
                functionName: paused ? "unpause" : "pause",
              })
            )
          }
          className="rounded-xl border border-white/15 bg-white/5 p-4 text-left hover:bg-white/10 transition-colors"
        >
          <div className="text-sm font-semibold">
            {paused ? "Unpause" : "Pause"}
          </div>
          <div className="text-xs text-white/50">
            {paused ? "Resume deposits" : "Halt new deposits"}
          </div>
        </button>

        <button
          onClick={() =>
            doAction("emergencyRefund", () =>
              writeAction({
                address: projectAddr,
                abi: PROJECT_CONTRACT.abi,
                functionName: "activateEmergencyRefund",
                args: [roundId!],
              })
            )
          }
          disabled={!roundId || isOpen === true}
          className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left hover:bg-red-500/10 transition-colors disabled:opacity-30"
        >
          <div className="text-sm font-semibold text-red-400">Emergency refund</div>
          <div className="text-xs text-white/50">Activate refunds for current round</div>
        </button>

        <button
          onClick={() =>
            doAction("resolveRoundFallback", () =>
              writeAction({
                address: projectAddr,
                abi: PROJECT_CONTRACT.abi,
                functionName: "resolveRoundFallback",
                args: [roundId!],
              })
            )
          }
          disabled={!roundId || isOpen === true || winnersResolved === true}
          className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-left hover:bg-yellow-500/10 transition-colors disabled:opacity-30"
        >
          <div className="text-sm font-semibold text-yellow-400">VRF fallback</div>
          <div className="text-xs text-white/50">
            Resolve with blockhash (after 256 blocks)
          </div>
        </button>
      </div>

      {/* ── SPA Info (automated) ── */}
      <h2 className="mt-10 text-xl font-semibold">SPA — Self-Propelled Aggregator</h2>
      <p className="mt-1 text-sm text-white/50">
        The 5% SPA pool is automatically distributed to top 100 referrers when JackDrop triggers. No admin action needed.
      </p>
      <div className="mt-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-purple-500/10 bg-black/30 p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">40%</div>
            <div className="text-[10px] text-white/50">Champion (#1)</div>
          </div>
          <div className="rounded-xl border border-purple-500/10 bg-black/30 p-3 text-center">
            <div className="text-2xl font-bold text-purple-300">30%</div>
            <div className="text-[10px] text-white/50">Elite (#2-10)</div>
          </div>
          <div className="rounded-xl border border-purple-500/10 bg-black/30 p-3 text-center">
            <div className="text-2xl font-bold text-purple-200/70">20%</div>
            <div className="text-[10px] text-white/50">Rising (#11-30)</div>
          </div>
          <div className="rounded-xl border border-purple-500/10 bg-black/30 p-3 text-center">
            <div className="text-2xl font-bold text-purple-200/50">10%</div>
            <div className="text-[10px] text-white/50">Community (#31-100)</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/30 text-center">
          Ranked by active referral count per cycle. Auto-credited to wallets at cycle end.
        </p>
      </div>

      {/* ── Schedule round config ── */}
      <h2 className="mt-10 text-xl font-semibold">Schedule round config</h2>
      <p className="mt-1 text-sm text-white/50">
        New config applies from the next round.
      </p>

      {/* Current config display */}
      {rcfg && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-6">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">Entry price</div>
            <div className="text-sm font-semibold">{fmt(rcfg[0] as bigint)} USDC</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">Max entries/wallet</div>
            <div className="text-sm font-semibold">{Number(rcfg[1])}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">Min pool</div>
            <div className="text-sm font-semibold">{fmt(rcfg[2] as bigint)} USDC</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">Min time</div>
            <div className="text-sm font-semibold">{Number(rcfg[3])}s</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">Max total entries</div>
            <div className="text-sm font-semibold">{Number(rcfg[4])}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">Winners/round</div>
            <div className="text-sm font-semibold">{Number(rcfg[5])}</div>
          </div>
          <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-3">
            <div className="text-xs text-white/50">Max round duration</div>
            <div className="text-sm font-semibold">120s</div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-3 sm:grid-cols-5">
          <div>
            <label className="text-xs text-white/50">Entry price (USDC)</label>
            <input
              type="number"
              value={cfgEntryPrice}
              onChange={(e) => setCfgEntryPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Min pool (USDC)</label>
            <input
              type="number"
              value={cfgMinPool}
              onChange={(e) => setCfgMinPool(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Min time (seconds)</label>
            <input
              type="number"
              value={cfgMinTime}
              onChange={(e) => setCfgMinTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Max total entries</label>
            <input
              type="number"
              value={cfgMaxEntries}
              onChange={(e) => setCfgMaxEntries(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Winners per round</label>
            <input
              type="number"
              value={cfgWinners}
              onChange={(e) => setCfgWinners(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
        <button
          onClick={() =>
            doAction("scheduleRoundConfig", () =>
              writeAction({
                address: projectAddr,
                abi: PROJECT_CONTRACT.abi,
                functionName: "scheduleRoundConfig",
                args: [
                  parseUnits(cfgEntryPrice || "1", 6),
                  parseUnits(cfgMinPool || "100", 6),
                  Number(cfgMinTime || 3600),
                  Number(cfgMaxEntries || 1000),
                  Number(cfgWinners || 2),
                  [7500, 2500] as readonly number[], // default 75/25 payoutBps
                ],
              })
            )
          }
          className="mt-4 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition-all"
        >
          Schedule config for next round
        </button>
      </div>

      {/* ── JackDrop target config ── */}
      <h2 className="mt-10 text-xl font-semibold">JackDrop target</h2>
      <p className="mt-1 text-sm text-white/50">
        Set the USDC target that triggers JackDrop distribution. Prizes scale proportionally.
      </p>

      {/* Current target + projected prizes */}
      {ccfg && (
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/5 p-3">
            <div className="text-xs text-white/50">Current target</div>
            <div className="text-sm font-bold text-yellow-400">{fmt(ccfg[0] as bigint)} USDC</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">1st prize (75%)</div>
            <div className="text-sm font-semibold">{fmt(((ccfg[0] as bigint) * 75n) / 100n)} USDC</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">2nd prize (10%)</div>
            <div className="text-sm font-semibold">{fmt(((ccfg[0] as bigint) * 10n) / 100n)} USDC</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/50">3rd-17th (1% ea.)</div>
            <div className="text-sm font-semibold">{fmt(((ccfg[0] as bigint) * 1n) / 100n)} USDC</div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-white/50">New target (USDC)</label>
            <input
              type="number"
              placeholder="100000"
              value={newJackTarget}
              onChange={(e) => setNewJackTarget(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
          </div>
          <div>
            <label className="text-xs text-white/50">Preview: 1st prize at this target</label>
            <div className="mt-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm font-semibold text-yellow-400">
              {newJackTarget ? fmt(parseUnits(String(Math.floor(Number(newJackTarget) * 0.75)), 6)) : "—"} USDC
            </div>
          </div>
        </div>
        <button
          onClick={() =>
            doAction("setJackTarget", () =>
              writeAction({
                address: projectAddr,
                abi: PROJECT_CONTRACT.abi,
                functionName: "setJackTarget",
                args: [parseUnits(newJackTarget || "100000", 6)],
              })
            )
          }
          disabled={!newJackTarget}
          className="mt-4 rounded-xl bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-30 transition-all"
        >
          Set JackDrop target
        </button>
      </div>

      {/* Cycle config display */}
      {ccfg && (
        <>
          <h2 className="mt-10 text-xl font-semibold">Cycle config (read-only)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/50">JackDrop target</div>
              <div className="text-sm font-semibold">{fmt(ccfg[0] as bigint)} USDC</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/50">Max jack entries/wallet</div>
              <div className="text-sm font-semibold">{Number(ccfg[1])}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/50">Referral program</div>
              <div className="text-sm font-semibold">{ccfg[2] ? "Active" : "Inactive"}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/50">Active ref threshold</div>
              <div className="text-sm font-semibold">{fmt(ccfg[3] as bigint)} USDC</div>
            </div>
            <div className="rounded-xl border border-purple-500/10 bg-purple-500/5 p-3">
              <div className="text-xs text-white/50">SPA Champion BPS</div>
              <div className="text-sm font-semibold">{Number(ccfg[5])} (40%)</div>
            </div>
            <div className="rounded-xl border border-purple-500/10 bg-purple-500/5 p-3">
              <div className="text-xs text-white/50">SPA Elite BPS</div>
              <div className="text-sm font-semibold">{Number(ccfg[6])} (30%)</div>
            </div>
            <div className="rounded-xl border border-purple-500/10 bg-purple-500/5 p-3">
              <div className="text-xs text-white/50">SPA Rising BPS</div>
              <div className="text-sm font-semibold">{Number(ccfg[7])} (20%)</div>
            </div>
            <div className="rounded-xl border border-purple-500/10 bg-purple-500/5 p-3">
              <div className="text-xs text-white/50">SPA Community BPS</div>
              <div className="text-sm font-semibold">{Number(ccfg[8])} (10%)</div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/*  MEMBER REGISTRY                                              */}
      {/* ══════════════════════════════════════════════════════════════ */}

      {isSimMode && (
        <>
          <div className="mt-14 mb-2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <h2 className="mt-8 text-2xl font-semibold tracking-tight">Member Registry</h2>
          <p className="mt-1 text-sm text-white/50">
            All registered wallets with serial numbers, membership tiers, and activity streaks.
          </p>

          {/* Stats overview */}
          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="text-2xl font-bold">{memberStats.total}</div>
              <div className="text-xs text-white/50">Total Users</div>
            </div>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{memberStats.members}</div>
              <div className="text-xs text-white/50">Members</div>
            </div>
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{memberStats.veterans}</div>
              <div className="text-xs text-white/50">Veterans</div>
            </div>
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">{memberStats.ogs}</div>
              <div className="text-xs text-white/50">OGs</div>
            </div>
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{memberStats.earlyAdopters}</div>
              <div className="text-xs text-white/50">Early Adopters</div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-5 flex flex-wrap gap-3">
            <div>
              <label className="text-xs text-white/50">Tier filter</label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
              >
                <option value={-1}>All tiers</option>
                <option value={0}>None (no tier)</option>
                <option value={1}>Member</option>
                <option value={2}>Veteran</option>
                <option value={3}>OG</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50">Serial range (e.g. 1-1000)</label>
              <input
                type="text"
                placeholder="1-1000"
                value={serialFilter}
                onChange={(e) => setSerialFilter(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
            </div>
            <div>
              <label className="text-xs text-white/50">Search wallet</label>
              <input
                type="text"
                placeholder="0x..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Member table */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-white/50">
                    <th className="px-4 py-3">Serial #</th>
                    <th className="px-4 py-3">Wallet</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3">Streak</th>
                    <th className="px-4 py-3">Best Streak</th>
                    <th className="px-4 py-3">Epochs</th>
                    <th className="px-4 py-3">Rounds</th>
                    <th className="px-4 py-3">First Deposit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.slice(0, 100).map(({ address: addr, profile: p }) => (
                    <tr
                      key={addr}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono font-bold">
                        #{p.serialNumber}
                        {p.serialNumber <= 1000 && (
                          <span className="ml-1.5 text-[10px] text-green-400">EA</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-white/70">
                        {addr.slice(0, 6)}...{addr.slice(-4)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${TIER_BG[p.membershipTier]}`}>
                          <span className={TIER_COLORS[p.membershipTier]}>
                            {MEMBERSHIP_TIER_NAMES[p.membershipTier]}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={p.currentStreak >= 4 ? "text-green-400 font-semibold" : "text-white/50"}>
                          {p.currentStreak}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-white/70">{p.longestStreak}</td>
                      <td className="px-4 py-2.5 text-white/70">{p.activeEpochs}</td>
                      <td className="px-4 py-2.5 text-white/70">{p.totalRoundsPlayed}</td>
                      <td className="px-4 py-2.5 text-white/50 text-xs">
                        {new Date(p.firstDepositTime * 1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {filteredProfiles.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-white/30">
                        No members match the current filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredProfiles.length > 100 && (
              <div className="border-t border-white/10 px-4 py-2 text-xs text-white/40 text-center">
                Showing 100 of {filteredProfiles.length} results
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/*  AIRDROP MANAGEMENT                                          */}
          {/* ══════════════════════════════════════════════════════════════ */}

          <div className="mt-14 mb-2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <h2 className="mt-8 text-2xl font-semibold tracking-tight">Airdrop Management</h2>
          <p className="mt-1 text-sm text-white/50">
            Create claim-based airdrops from the DEV fund. Eligible wallets can claim from their dashboard.
          </p>

          {/* DEV fund balance */}
          <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="text-xs text-white/50">Available DEV Fund</div>
            <div className="mt-1 text-2xl font-bold text-blue-400">
              {fmt(devBal as bigint | undefined)} USDC
            </div>
            <div className="text-xs text-white/40">Airdrops are deducted from this balance</div>
          </div>

          {/* Create airdrop form */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold">Create Airdrop Campaign</h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-white/50">Campaign name</label>
                <input
                  type="text"
                  placeholder="Early Adopter Reward #1"
                  value={airdropName}
                  onChange={(e) => setAirdropName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="text-xs text-white/50">Total budget (USDC)</label>
                <input
                  type="number"
                  placeholder="5000"
                  value={airdropBudget}
                  onChange={(e) => setAirdropBudget(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs text-white/50">Eligibility criteria</label>
              <div className="mt-2 flex gap-3">
                <button
                  onClick={() => setAirdropType("early")}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    airdropType === "early"
                      ? "bg-green-500 text-black"
                      : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  Early Adopters (by serial)
                </button>
                <button
                  onClick={() => setAirdropType("tier")}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    airdropType === "tier"
                      ? "bg-purple-500 text-black"
                      : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  By Membership Tier
                </button>
              </div>
            </div>

            {airdropType === "early" ? (
              <div className="mt-4">
                <label className="text-xs text-white/50">Max serial number (e.g. 1000 = first 1000 users)</label>
                <input
                  type="number"
                  placeholder="1000"
                  value={airdropMaxSerial}
                  onChange={(e) => setAirdropMaxSerial(e.target.value)}
                  className="mt-1 w-48 rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
                />
                <div className="mt-2 text-xs text-white/40">
                  Currently {allProfiles.filter(e => e.profile.serialNumber <= Number(airdropMaxSerial || 0)).length} wallets
                  in range 1-{airdropMaxSerial || "?"}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-xs text-white/50">Minimum tier</label>
                <select
                  value={airdropMinTier}
                  onChange={(e) => setAirdropMinTier(Number(e.target.value))}
                  className="mt-1 block w-48 rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white"
                >
                  <option value={1}>Member+</option>
                  <option value={2}>Veteran+</option>
                  <option value={3}>OG only</option>
                </select>
                <div className="mt-2 text-xs text-white/40">
                  Currently {allProfiles.filter(e => e.profile.membershipTier >= airdropMinTier).length} eligible wallets
                </div>
              </div>
            )}

            {/* Preview */}
            {airdropBudget && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                <div className="text-white/50">Preview:</div>
                <div className="mt-1">
                  <span className="font-semibold">{fmt(parseUnits(airdropBudget || "0", 6))} USDC</span>
                  {" distributed equally to "}
                  <span className="font-semibold">
                    {airdropType === "early"
                      ? allProfiles.filter(e => e.profile.serialNumber <= Number(airdropMaxSerial || 0)).length
                      : allProfiles.filter(e => e.profile.membershipTier >= airdropMinTier).length
                    }
                  </span>
                  {" wallets"}
                  {(() => {
                    const count = airdropType === "early"
                      ? allProfiles.filter(e => e.profile.serialNumber <= Number(airdropMaxSerial || 0)).length
                      : allProfiles.filter(e => e.profile.membershipTier >= airdropMinTier).length;
                    if (count > 0) {
                      const perWallet = Number(airdropBudget) / count;
                      return <span className="text-white/50"> ({perWallet.toFixed(2)} USDC each)</span>;
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            {airdropMsg && (
              <div className={`mt-3 rounded-xl border p-3 text-sm ${
                airdropMsg.ok
                  ? "border-green-500/20 bg-green-500/10 text-green-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}>
                {airdropMsg.text}
              </div>
            )}

            <button
              onClick={() => {
                if (!airdropName || !airdropBudget) {
                  setAirdropMsg({ ok: false, text: "Please fill in campaign name and budget." });
                  return;
                }
                const budget = parseUnits(airdropBudget, 6);
                let success = false;
                if (airdropType === "early") {
                  success = controls.createEarlyAdopterAirdrop(
                    airdropName,
                    Number(airdropMaxSerial || 1000),
                    budget,
                  );
                } else {
                  success = controls.createTierAirdrop(
                    airdropName,
                    airdropMinTier as MembershipTier,
                    budget,
                  );
                }
                if (success) {
                  setAirdropMsg({ ok: true, text: `Airdrop "${airdropName}" created successfully! Users can now claim from their dashboard.` });
                  setAirdropName("");
                  setAirdropBudget("");
                } else {
                  setAirdropMsg({ ok: false, text: "Failed: insufficient DEV fund balance or no eligible wallets." });
                }
              }}
              disabled={!airdropName || !airdropBudget}
              className="mt-4 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-30 transition-all"
            >
              Create Airdrop Campaign
            </button>
          </div>

          {/* Airdrop history */}
          {airdropCampaigns.length > 0 && (
            <div className="mt-5">
              <h3 className="text-lg font-semibold">Airdrop History</h3>
              <div className="mt-3 space-y-3">
                {airdropCampaigns.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="text-xs text-white/50">
                          Campaign #{c.id} — {new Date(c.createdAt * 1000).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{fmt(c.totalAmount)} USDC</div>
                        <div className="text-xs text-white/50">
                          {c.claimedCount}/{c.eligibleCount} claimed
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${c.eligibleCount > 0 ? (c.claimedCount / c.eligibleCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
