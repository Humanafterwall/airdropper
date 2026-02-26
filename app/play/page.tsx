"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "@/lib/sim/hooks";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "wagmi/chains";
import { formatUnits, parseUnits } from "viem";
import { PROJECT_CONTRACT, USDC_CONTRACT } from "@/lib/contracts";
import { RoundProgressBar } from "@/components/RoundProgressBar";
import { JackDropCelebration } from "@/components/JackDropCelebration";
import type { JackDropWinnerEntry } from "@/lib/sim/types";

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(val: bigint | undefined, decimals = 6): string {
  if (val === undefined) return "—";
  return Number(formatUnits(val, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

type TxStep = "idle" | "approving" | "depositing" | "success" | "error";

/* ------------------------------------------------------------------ */
/*  page                                                               */
/* ------------------------------------------------------------------ */

export default function PlayPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = chainId !== polygonAmoy.id;

  const [entries, setEntries] = useState(1);
  const [txStep, setTxStep] = useState<TxStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const referrerRef = useRef<HTMLInputElement>(null);

  // Get referrer value from the uncontrolled input
  const getReferrer = useCallback(() => referrerRef.current?.value ?? "", []);

  const projectAddr = PROJECT_CONTRACT.address as `0x${string}`;
  const usdcAddr = USDC_CONTRACT.address as `0x${string}`;

  // ── On-chain reads ──

  const { data: currentRoundId } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "currentRoundId",
  });

  const roundId = currentRoundId as bigint | undefined;

  const { data: roundInfo, isLoading: roundLoading } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "getRoundInfo",
    args: roundId ? [roundId] : [BigInt(1)],
    query: { enabled: !!roundId },
  });

  const { data: roundCfg } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "roundCfg",
  });

  const { data: jackpotBal } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "jackpotBalance",
  });

  // user-specific reads
  const { data: usdcBalance } = useReadContract({
    address: usdcAddr,
    abi: USDC_CONTRACT.abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddr,
    abi: USDC_CONTRACT.abi,
    functionName: "allowance",
    args: address ? [address, projectAddr] : undefined,
    query: { enabled: !!address },
  });

  const { data: myEntries } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "entriesOf",
    args: roundId && address ? [roundId, address] : undefined,
    query: { enabled: !!roundId && !!address },
  });

  const { data: myPayout } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "payoutOf",
    args: roundId && address ? [roundId, address] : undefined,
    query: { enabled: !!roundId && !!address },
  });

  const { data: payoutClaimed } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "payoutClaimed",
    args: roundId && address ? [roundId, address] : undefined,
    query: { enabled: !!roundId && !!address },
  });

  // JackDrop multi-winner reads (check current AND previous round)
  const prevRoundId = roundId && roundId > 1n ? roundId - 1n : undefined;

  const { data: jackDropResultsCur } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "jackDropResults",
    args: roundId ? [roundId] : undefined,
    query: { enabled: !!roundId },
  });

  const { data: jackDropResultsPrev } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "jackDropResults",
    args: prevRoundId ? [prevRoundId] : undefined,
    query: { enabled: !!prevRoundId },
  });

  // Resolve JackDrop results (prefer current, fallback to previous)
  const { jackDropResults, jackDropRoundId } = useMemo(() => {
    const cur = jackDropResultsCur as JackDropWinnerEntry[] | undefined;
    const prev = jackDropResultsPrev as JackDropWinnerEntry[] | undefined;
    if (cur && cur.length > 0) return { jackDropResults: cur, jackDropRoundId: roundId };
    if (prev && prev.length > 0) return { jackDropResults: prev, jackDropRoundId: prevRoundId };
    return { jackDropResults: [] as JackDropWinnerEntry[], jackDropRoundId: roundId };
  }, [jackDropResultsCur, jackDropResultsPrev, roundId, prevRoundId]);

  // JackDrop ticket reads
  const { data: myJackDropTickets } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "userJackDropTickets",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: totalJackDropTickets } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "totalJackDropTickets",
  });

  // Cycle config for dynamic prize display + ticket cap
  const { data: cycleCfg } = useReadContract({
    address: projectAddr,
    abi: PROJECT_CONTRACT.abi,
    functionName: "cycleCfg",
  });

  // parse round info tuple (11 values)
  const info = roundInfo as readonly unknown[] | undefined;
  const startTime = info ? Number(info[0] as bigint) : undefined;
  const minPoolSnap = info ? (info[1] as bigint) : undefined;
  const minTimeSnap = info ? Number(info[2]) : undefined;
  const totalPool = info ? (info[4] as bigint) : undefined;
  const totalEntries = info ? (info[5] as bigint) : undefined;
  const uniquePlayers = info ? (info[6] as bigint) : undefined;
  const isOpen = info ? (info[7] as boolean) : undefined;
  const isEmergency = info ? (info[8] as boolean) : undefined;
  const winnersResolved = info ? (info[10] as boolean) : undefined;

  // parse round config
  const cfg = roundCfg as readonly unknown[] | undefined;
  const entryPrice = cfg ? (cfg[0] as bigint) : undefined;
  const maxEntriesPerWallet = cfg ? Number(cfg[1]) : 10;

  // derived
  const myEntryCount = myEntries ? Number(myEntries as bigint) : 0;
  const remaining = Math.max(0, maxEntriesPerWallet - myEntryCount);
  const costUsdc = entryPrice
    ? entryPrice * BigInt(entries)
    : parseUnits(String(entries), 6);
  const needsApproval =
    usdcAllowance !== undefined && (usdcAllowance as bigint) < costUsdc;
  const hasSufficientBalance =
    usdcBalance !== undefined && (usdcBalance as bigint) >= costUsdc;

  // JackDrop derived state
  const isJackTriggered = jackDropResults.length > 0;
  const userJackDropEntry = address
    ? jackDropResults.find(w => w.address === address.toLowerCase())
    : undefined;
  const isJackWinner = !!userJackDropEntry;
  const isJackClaimed = userJackDropEntry?.claimed ?? false;

  // JackDrop ticket info
  const myTickets = myJackDropTickets ? Number(myJackDropTickets as bigint) : 0;
  const allTickets = totalJackDropTickets ? Number(totalJackDropTickets as bigint) : 0;
  const jackDropOdds = allTickets > 0 && myTickets > 0
    ? ((myTickets / allTickets) * 100).toFixed(2)
    : "0";

  // Dynamic JackDrop prizes from cycleCfg
  const ccfg = cycleCfg as readonly unknown[] | undefined;
  const jackTarget = ccfg ? (ccfg[0] as bigint) : undefined;
  const maxTicketsPerWallet = ccfg ? Number(ccfg[1] as bigint) : 100;
  const minCycleParticipants = ccfg ? Number(ccfg[14] as bigint) : 50;
  const ticketRemaining = maxTicketsPerWallet - myTickets;
  // Prizes: 75% / 10% / 1% each × 15
  const prize1st = jackTarget ? (jackTarget * 75n) / 100n : undefined;
  const prize2nd = jackTarget ? (jackTarget * 10n) / 100n : undefined;
  const prizeRest = jackTarget ? (jackTarget * 1n) / 100n : undefined;

  // ── Transactions ──

  const {
    writeContract: writeApprove,
    data: approveTxHash,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract();

  const {
    writeContract: writeDeposit,
    data: depositTxHash,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract();

  const {
    writeContract: writeClaim,
    data: claimTxHash,
    error: claimError,
  } = useWriteContract();

  const {
    writeContract: writeJackClaim,
    data: jackClaimTxHash,
    error: jackClaimError,
  } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });

  const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  });

  const { isSuccess: claimConfirmed } = useWaitForTransactionReceipt({
    hash: claimTxHash,
  });

  const { isSuccess: jackClaimConfirmed } = useWaitForTransactionReceipt({
    hash: jackClaimTxHash,
  });

  // auto-advance: approve confirmed → deposit
  useEffect(() => {
    if (approveConfirmed && txStep === "approving") {
      refetchAllowance();
      setTxStep("depositing");
      // now send deposit tx
      const ref = getReferrer();
      const hasRef = ref && ref.startsWith("0x") && ref.length === 42;
      if (hasRef) {
        writeDeposit({
          address: projectAddr,
          abi: PROJECT_CONTRACT.abi,
          functionName: "depositWithReferrer",
          args: [BigInt(entries), ref as `0x${string}`],
        });
      } else {
        writeDeposit({
          address: projectAddr,
          abi: PROJECT_CONTRACT.abi,
          functionName: "deposit",
          args: [BigInt(entries)],
        });
      }
    }
  }, [approveConfirmed, txStep, entries, projectAddr, writeDeposit, refetchAllowance, getReferrer]);

  // deposit confirmed → success
  useEffect(() => {
    if (depositConfirmed && txStep === "depositing") {
      setTxStep("success");
    }
  }, [depositConfirmed, txStep]);

  // error handling
  useEffect(() => {
    if (approveError) {
      setTxStep("error");
      setErrorMsg(approveError.message.slice(0, 200));
    }
  }, [approveError]);

  useEffect(() => {
    if (depositError) {
      setTxStep("error");
      setErrorMsg(depositError.message.slice(0, 200));
    }
  }, [depositError]);

  // ── Actions ──

  const handleParticipate = useCallback(() => {
    setErrorMsg("");
    resetApprove();
    resetDeposit();

    if (needsApproval) {
      setTxStep("approving");
      writeApprove({
        address: usdcAddr,
        abi: USDC_CONTRACT.abi,
        functionName: "approve",
        args: [projectAddr, costUsdc],
      });
    } else {
      setTxStep("depositing");
      const ref = getReferrer();
      const hasRef = ref && ref.startsWith("0x") && ref.length === 42;
      if (hasRef) {
        writeDeposit({
          address: projectAddr,
          abi: PROJECT_CONTRACT.abi,
          functionName: "depositWithReferrer",
          args: [BigInt(entries), ref as `0x${string}`],
        });
      } else {
        writeDeposit({
          address: projectAddr,
          abi: PROJECT_CONTRACT.abi,
          functionName: "deposit",
          args: [BigInt(entries)],
        });
      }
    }
  }, [
    needsApproval,
    costUsdc,
    entries,
    projectAddr,
    usdcAddr,
    writeApprove,
    writeDeposit,
    resetApprove,
    resetDeposit,
    getReferrer,
  ]);

  const handleClaim = useCallback(() => {
    if (!roundId) return;
    writeClaim({
      address: projectAddr,
      abi: PROJECT_CONTRACT.abi,
      functionName: "claimPayout",
      args: [roundId],
    });
  }, [roundId, projectAddr, writeClaim]);

  const handleJackDropClaim = useCallback(() => {
    if (!jackDropRoundId) return;
    writeJackClaim({
      address: projectAddr,
      abi: PROJECT_CONTRACT.abi,
      functionName: "claimJackDrop",
      args: [jackDropRoundId],
    });
  }, [jackDropRoundId, projectAddr, writeJackClaim]);

  const canDeposit =
    isConnected &&
    !wrongNetwork &&
    isOpen === true &&
    remaining > 0 &&
    hasSufficientBalance &&
    txStep === "idle";

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Play
            </h1>
            <p className="mt-3 text-base leading-relaxed text-white/70">
              Choose 1–{maxEntriesPerWallet} entries per round. Each entry = {entryPrice ? fmt(entryPrice) : "1"} USDC.
              Enforced on-chain.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton />
          </div>
        </div>

        {/* Status cards */}
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="text-sm font-semibold">Round</div>
            <div className="mt-2 text-2xl font-bold">
              {roundId !== undefined ? `#${roundId.toString()}` : "—"}
            </div>
            <div className="mt-1 text-sm text-white/70">
              {roundLoading && "Loading..."}
              {!roundLoading && isOpen === true && (
                <span className="text-green-400">OPEN</span>
              )}
              {!roundLoading && isOpen === false && !isEmergency && (
                <span className="text-red-400">CLOSED</span>
              )}
              {!roundLoading && isEmergency && (
                <span className="text-yellow-400">EMERGENCY</span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="text-sm font-semibold">Pool</div>
            <div className="mt-2 text-2xl font-bold">
              {totalPool !== undefined ? `${fmt(totalPool)} USDC` : "—"}
            </div>
            <div className="mt-1 text-sm text-white/70">
              {totalEntries !== undefined ? `${totalEntries.toString()} total entries` : ""}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="text-sm font-semibold">Players</div>
            <div className="mt-2 text-2xl font-bold">
              {uniquePlayers !== undefined ? uniquePlayers.toString() : "—"}
            </div>
          </div>
        </div>

        {/* Round progress bars */}
        {startTime !== undefined && minTimeSnap !== undefined && totalPool !== undefined && minPoolSnap !== undefined && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
            <RoundProgressBar
              startTime={startTime}
              minTime={minTimeSnap}
              maxDuration={120}
              totalPool={totalPool}
              minPool={minPoolSnap}
            />
          </div>
        )}

        {/* JackDrop banner */}
        {jackpotBal !== undefined && (jackpotBal as bigint) > BigInt(0) && !isJackTriggered && (
          <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-yellow-400">
                  JackDrop reserve
                </div>
                <div className="text-xs text-white/50">
                  17 lucky winners when {jackTarget ? fmt(jackTarget) : "—"} USDC target is reached
                </div>
              </div>
              <div className="text-2xl font-bold text-yellow-400">
                {fmt(jackpotBal as bigint)} USDC
              </div>
            </div>
            {/* Progress bar toward target */}
            {jackTarget && (jackTarget as bigint) > 0n && (
              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all"
                    style={{
                      width: `${Math.min(100, Number(((jackpotBal as bigint) * 100n) / (jackTarget as bigint)))}%`,
                    }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-white/30">
                  <span>{fmt(jackpotBal as bigint)}</span>
                  <span>{fmt(jackTarget)} target</span>
                </div>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/40">
              <span className="rounded-full bg-yellow-500/10 px-2 py-0.5">1st: {prize1st ? fmt(prize1st) : "\u2014"} USDC</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5">2nd: {prize2nd ? fmt(prize2nd) : "\u2014"} USDC</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5">3rd-17th: {prizeRest ? fmt(prizeRest) : "\u2014"} each</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-white/30">
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5">Min 3 entries/round for ticket</span>
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5">Max {maxTicketsPerWallet} tickets/cycle</span>
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5">Min {minCycleParticipants} players to trigger</span>
            </div>
          </div>
        )}

        {/* JackDrop ticket info */}
        {isConnected && !wrongNetwork && !isJackTriggered && (
          <div className="mt-3 rounded-2xl border border-yellow-500/10 bg-yellow-500/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <div className="text-white/50">
                Your JackDrop tickets:{" "}
                <span className="font-bold text-yellow-400">{myTickets}</span>
                <span className="text-white/30"> / {maxTicketsPerWallet} max</span>
                {ticketRemaining > 0 && (
                  <span className="text-white/30"> ({ticketRemaining} remaining)</span>
                )}
                {ticketRemaining <= 0 && myTickets > 0 && (
                  <span className="text-orange-400"> (maxed out)</span>
                )}
              </div>
              {myTickets > 0 ? (
                <div className="text-white/40">
                  Odds: ~<span className="font-semibold text-yellow-400">{jackDropOdds}%</span>
                  <span className="text-white/30"> ({myTickets}/{allTickets})</span>
                </div>
              ) : (
                <div className="text-white/40">
                  Play 3+ entries in a round to earn a ticket
                </div>
              )}
            </div>
            {/* Ticket capacity progress bar */}
            {maxTicketsPerWallet > 0 && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-500/60 to-yellow-500 transition-all"
                  style={{ width: `${Math.min(100, (myTickets / maxTicketsPerWallet) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* JackDrop TRIGGERED - Multi-winner celebration */}
        {isJackTriggered && (
          <div className="mt-5">
            <JackDropCelebration
              results={jackDropResults}
              connectedAddress={address}
              claimedByUser={isJackClaimed}
              onClaim={handleJackDropClaim}
              claimPending={!!jackClaimTxHash && !jackClaimConfirmed}
            />
            {jackClaimError && (
              <div className="mt-2 text-sm text-red-400">
                Claim failed: {jackClaimError.message.slice(0, 100)}
              </div>
            )}
          </div>
        )}

        {/* Network warning */}
        {isConnected && wrongNetwork && (
          <div className="mt-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            Wrong network detected. Please switch to{" "}
            <b>Polygon Amoy</b> testnet.
          </div>
        )}

        {/* Wallet info */}
        {isConnected && !wrongNetwork && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="text-sm font-semibold">Your wallet</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/50">USDC balance</div>
                <div className="text-lg font-semibold">
                  {usdcBalance !== undefined ? fmt(usdcBalance as bigint) : "—"} USDC
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/50">Your entries (this round)</div>
                <div className="text-lg font-semibold">{myEntryCount}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/50">Remaining capacity</div>
                <div className="text-lg font-semibold">{remaining}</div>
              </div>
            </div>
          </div>
        )}

        {/* Entry selector */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
          <div className="text-sm font-semibold">Enter the round</div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            {/* Entry count */}
            <div>
              <label className="text-xs text-white/50">Entries</label>
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => setEntries((e) => Math.max(1, e - 1))}
                  disabled={entries <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black text-white hover:bg-white/5 disabled:opacity-30"
                >
                  −
                </button>
                <div className="flex h-9 w-12 items-center justify-center rounded-lg border border-white/15 bg-black text-sm font-semibold">
                  {entries}
                </div>
                <button
                  onClick={() =>
                    setEntries((e) => Math.min(remaining || 10, e + 1))
                  }
                  disabled={entries >= remaining}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-black text-white hover:bg-white/5 disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>

            {/* Cost display */}
            <div>
              <label className="text-xs text-white/50">Cost</label>
              <div className="mt-1 text-lg font-semibold">
                {entryPrice ? fmt(entryPrice * BigInt(entries)) : entries} USDC
              </div>
            </div>

            {/* Referral */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-white/50">Referrer (optional) — share your link to earn SPA rewards</label>
              <input
                ref={referrerRef}
                type="text"
                placeholder="0x..."
                defaultValue={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") ?? "" : ""}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Approve / Deposit button */}
          <div className="mt-5">
            {txStep === "idle" && (
              <button
                onClick={handleParticipate}
                disabled={!canDeposit}
                className={[
                  "rounded-xl px-6 py-3 text-sm font-semibold transition-all",
                  canDeposit
                    ? "bg-white text-black hover:opacity-90"
                    : "bg-white/20 text-white/60 cursor-not-allowed",
                ].join(" ")}
              >
                {needsApproval
                  ? `Approve & Deposit ${entries} ${entries === 1 ? "entry" : "entries"}`
                  : `Deposit ${entries} ${entries === 1 ? "entry" : "entries"}`}
              </button>
            )}

            {txStep === "approving" && (
              <div className="flex items-center gap-3 text-sm text-yellow-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
                Approving USDC spend... confirm in your wallet
              </div>
            )}

            {txStep === "depositing" && (
              <div className="flex items-center gap-3 text-sm text-blue-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                Depositing entries... confirm in your wallet
              </div>
            )}

            {txStep === "success" && (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
                <div className="text-sm font-semibold text-green-400">
                  Deposit confirmed!
                </div>
                <p className="mt-1 text-sm text-white/70">
                  You entered {entries} {entries === 1 ? "entry" : "entries"} in round{" "}
                  {roundId?.toString()}. Good luck!
                </p>
                <button
                  onClick={() => setTxStep("idle")}
                  className="mt-3 rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
                >
                  Enter more
                </button>
              </div>
            )}

            {txStep === "error" && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <div className="text-sm font-semibold text-red-400">
                  Transaction failed
                </div>
                <p className="mt-1 text-sm text-white/70">{errorMsg}</p>
                <button
                  onClick={() => {
                    setTxStep("idle");
                    setErrorMsg("");
                  }}
                  className="mt-3 rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Insufficient balance warning */}
          {isConnected && !wrongNetwork && !hasSufficientBalance && (
            <p className="mt-3 text-sm text-red-400">
              Insufficient USDC balance. You need{" "}
              {entryPrice ? fmt(entryPrice * BigInt(entries)) : entries} USDC.
            </p>
          )}
        </div>

        {/* Claim section */}
        {isConnected &&
          !wrongNetwork &&
          myPayout !== undefined &&
          (myPayout as bigint) > BigInt(0) &&
          !(payoutClaimed as boolean) && (
            <div className="mt-6 rounded-3xl border border-green-500/20 bg-green-500/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-green-400">
                    You won!
                  </div>
                  <div className="mt-1 text-2xl font-bold text-green-400">
                    {fmt(myPayout as bigint)} USDC
                  </div>
                  <div className="text-xs text-white/50">
                    Round {roundId?.toString()}
                    {winnersResolved ? " • Resolved" : " • Awaiting VRF..."}
                  </div>
                </div>
                <button
                  onClick={handleClaim}
                  disabled={!winnersResolved}
                  className={[
                    "rounded-xl px-6 py-3 text-sm font-semibold",
                    winnersResolved
                      ? "bg-green-500 text-black hover:opacity-90"
                      : "bg-white/20 text-white/60 cursor-not-allowed",
                  ].join(" ")}
                >
                  Claim payout
                </button>
              </div>
              {claimConfirmed && (
                <p className="mt-3 text-sm text-green-400">
                  Payout claimed successfully!
                </p>
              )}
              {claimError && (
                <p className="mt-3 text-sm text-red-400">
                  Claim failed: {claimError.message.slice(0, 100)}
                </p>
              )}
            </div>
          )}

        {/* Emergency refund notice */}
        {isConnected && !wrongNetwork && isEmergency && myEntryCount > 0 && (
          <div className="mt-6 rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <div className="text-sm font-semibold text-yellow-400">
              Emergency refund activated
            </div>
            <p className="mt-2 text-sm text-white/70">
              This round has been flagged for emergency refund. You can claim your
              USDC back.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
