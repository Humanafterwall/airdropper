"use client";

import { useSimulation } from "./context";
import { formatUnits } from "viem";

function fmt(val: bigint | undefined): string {
  if (val === undefined) return "0";
  return Number(formatUnits(val, 6)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

export function SimControlPanel() {
  const { isSimMode, engine, controls } = useSimulation();

  if (!isSimMode || !engine) return null;

  const round = engine.state.rounds.get(Number(engine.state.currentRoundId));
  const pool = round?.totalPool ?? 0n;
  const entries = round?.totalEntries ?? 0n;
  const players = round?.uniquePlayers ?? 0n;
  const isRunning = !!controls.isActive && controls.phase === "open";

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 rounded-2xl border border-yellow-500/30 bg-black/95 p-4 shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-sm font-bold text-yellow-400">
            SIMULATION
          </span>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
          {controls.phase}
        </span>
      </div>

      {/* Speed controls */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-white/50">Speed:</span>
        {[1, 2, 5, 10].map((s) => (
          <button
            key={s}
            onClick={() => controls.setSpeed(s)}
            className={`rounded px-2 py-1 text-xs font-semibold transition ${
              controls.speed === s
                ? "bg-yellow-500 text-black"
                : "border border-white/15 text-white/60 hover:bg-white/10"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Playback controls */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={isRunning ? controls.pause : controls.resume}
          className="flex-1 rounded-lg border border-white/15 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition"
        >
          {isRunning ? "Pause" : "Resume"}
        </button>
        <button
          onClick={controls.advancePhase}
          className="flex-1 rounded-lg border border-white/15 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition"
        >
          Skip
        </button>
        <button
          onClick={controls.reset}
          className="flex-1 rounded-lg border border-red-500/20 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
        >
          Reset
        </button>
      </div>

      {/* Live counters */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 p-2">
          <div className="text-white/40">Pool</div>
          <div className="font-bold text-green-400">{fmt(pool)}</div>
        </div>
        <div className="rounded-lg border border-white/10 p-2">
          <div className="text-white/40">Entries</div>
          <div className="font-bold">{entries.toString()}</div>
        </div>
        <div className="rounded-lg border border-white/10 p-2">
          <div className="text-white/40">Players</div>
          <div className="font-bold">{players.toString()}</div>
        </div>
      </div>

      {/* Round info + JackDrop progress + Cycle info */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-white/40">
        <span>Round #{engine.state.currentRoundId.toString()} | Cycle #{engine.state.cycleId.toString()}</span>
        <span>JackDrop: {fmt(engine.state.jackpotBalance)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[9px] text-white/30">
        <span>Wallets: {engine.state.cycleUniqueWallets.size} cycle / {engine.state.lifetimeUniqueWallets.size} all</span>
        <span>Min for JD: {engine.state.minCycleParticipantsForJackDrop.toString()}</span>
      </div>

      {/* Security mitigation indicators */}
      <div className="mt-1 flex flex-wrap gap-1">
        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[8px] text-blue-300" title="Min entries per round for JackDrop ticket">
          Ticket: {engine.state.roundCfg.minEntriesForJackDropTicket.toString()}+ entries
        </span>
        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[8px] text-blue-300" title="Max JackDrop tickets per wallet per cycle">
          Cap: {engine.state.maxJackDropTicketsPerWallet.toString()}/wallet/cycle
        </span>
        {engine.state.pendingRoundCfg && (
          <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[8px] text-orange-300 animate-pulse" title="Config change pending">
            Cfg pending
          </span>
        )}
        {engine.state.paused && engine.state.pausedAt && (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[8px] text-red-300" title={`Auto-unpause in ${engine.state.maxPauseDuration}s max`}>
            Pause timeout: {engine.state.maxPauseDuration}s
          </span>
        )}
      </div>

      {/* JackDrop progress bar */}
      {engine.state.jackTarget > 0n && (
        <div className="mt-1">
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all"
              style={{
                width: `${Math.min(100, Number((engine.state.jackpotBalance * 100n) / engine.state.jackTarget))}%`,
              }}
            />
          </div>
          <div className="mt-0.5 flex justify-between text-[9px] text-white/30">
            <span>{fmt(engine.state.jackpotBalance)}</span>
            <span>{fmt(engine.state.jackTarget)} target</span>
          </div>
        </div>
      )}

      {/* JackDrop triggered indicator (multi-winner) */}
      {(() => {
        // Check current and previous round for JackDrop results
        const curId = Number(engine.state.currentRoundId);
        const prevId = curId - 1;
        const curResults = engine.state.jackDropResults.get(curId);
        const prevResults = prevId > 0 ? engine.state.jackDropResults.get(prevId) : undefined;
        const results = (curResults && curResults.length > 0) ? curResults : prevResults;

        if (results && results.length > 0) {
          return (
            <div className="mt-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2 animate-pulse">
              <div className="text-[10px] font-bold text-yellow-400">
                JACKDROP TRIGGERED! ({results.length} winners)
              </div>
              {results.slice(0, 3).map((w, i) => (
                <div key={i} className="mt-0.5 truncate text-[10px] text-white/60">
                  {i + 1}. {w.address.slice(0, 8)}...{w.address.slice(-4)}{" "}
                  <span className="text-yellow-400">{fmt(w.amount)}</span>
                </div>
              ))}
              {results.length > 3 && (
                <div className="mt-0.5 text-[10px] text-white/40">
                  +{results.length - 3} more winners...
                </div>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Pressure test */}
      <button
        onClick={() => controls.bulkDeposit(500)}
        className="mt-3 w-full rounded-lg border border-yellow-500/20 bg-yellow-500/10 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/20 transition"
      >
        Pressure test (+500 entries)
      </button>

      {/* Winners display when resolved */}
      {round && round.winnersResolved && round.winners.length > 0 && (
        <div className="mt-2 rounded-lg border border-green-500/20 bg-green-500/5 p-2">
          <div className="text-[10px] font-semibold text-green-400">
            Winners (Round #{round.roundId.toString()})
          </div>
          {round.winners.map((w, i) => (
            <div key={i} className="mt-0.5 truncate text-[10px] text-white/60">
              {i + 1}. {w.slice(0, 8)}...{w.slice(-6)}{" "}
              <span className="text-green-400">
                {fmt(round.payouts.get(w))} USDC
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
