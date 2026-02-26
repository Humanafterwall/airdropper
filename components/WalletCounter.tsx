"use client";

import { useSimulation } from "@/lib/sim/context";
import { useSyncExternalStore, useCallback, useEffect, useRef, useState } from "react";

const MILESTONES = [100, 500, 1_000, 5_000, 10_000];

function AnimatedNumber({ value, label }: { value: number; label: string }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) return;

    const duration = 600;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    prevRef.current = end;
  }, [value]);

  return (
    <div className="text-center">
      <div className="text-3xl font-bold tabular-nums text-white">
        {display.toLocaleString("en-US")}
      </div>
      <div className="text-xs text-white/40">{label}</div>
    </div>
  );
}

export function WalletCounter() {
  const { isSimMode, engine } = useSimulation();

  const subscribe = useCallback(
    (cb: () => void) => engine?.subscribe(cb) ?? (() => {}),
    [engine]
  );
  const getSnapshot = useCallback(
    () => engine?.getVersion() ?? 0,
    [engine]
  );

  useSyncExternalStore(subscribe, getSnapshot, () => 0);

  if (!isSimMode || !engine) {
    return (
      <>
        <h3 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-white/50">
          Community
        </h3>
        <div className="flex items-center justify-around gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums text-white">—</div>
            <div className="text-xs text-white/40">This Cycle</div>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums text-white">—</div>
            <div className="text-xs text-white/40">All Time</div>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-white/30">
          Connect wallet to see live community stats
        </p>
      </>
    );
  }

  const cycleCount = engine.state.cycleUniqueWallets.size;
  const lifetimeCount = engine.state.lifetimeUniqueWallets.size;

  // Find highest passed milestone
  const passedMilestone = MILESTONES.filter(m => cycleCount >= m).pop();

  // Calculate JackDrop odds
  let totalTickets = 0;
  for (const [, rounds] of engine.state.cycleRoundParticipation) {
    totalTickets += rounds.size;
  }

  return (
    <>
      <h3 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-white/50">
        Community
      </h3>

      <div className="flex items-center justify-around gap-4">
        <AnimatedNumber value={cycleCount} label="This Cycle" />
        <div className="h-10 w-px bg-white/10" />
        <AnimatedNumber value={lifetimeCount} label="All Time" />
      </div>

      {/* Milestones */}
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {MILESTONES.map((m) => {
          const reached = cycleCount >= m;
          const isLatest = m === passedMilestone;
          return (
            <span
              key={m}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all ${
                reached
                  ? isLatest
                    ? "animate-pulse bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : "bg-green-500/15 text-green-400"
                  : "bg-white/5 text-white/20"
              }`}
            >
              {m >= 1000 ? `${m / 1000}K` : m}
            </span>
          );
        })}
      </div>

      {/* JackDrop odds */}
      {totalTickets > 0 && (
        <div className="mt-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10 p-3 text-center">
          <div className="text-[10px] text-white/40">JackDrop Ticket Pool</div>
          <div className="text-lg font-bold text-yellow-400 tabular-nums">
            {totalTickets.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/30">
            tickets from {cycleCount} wallets
          </div>
        </div>
      )}
    </>
  );
}
