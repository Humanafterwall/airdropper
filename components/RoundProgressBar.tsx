"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";

function fmtUsdc(val: bigint): string {
  return Number(formatUnits(val, 6)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

export function RoundProgressBar({
  startTime,
  minTime,
  maxDuration,
  totalPool,
  minPool,
}: {
  startTime: number;
  minTime: number;
  maxDuration: number;
  totalPool: bigint;
  minPool: bigint;
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = now - startTime;
  const timeRemaining = Math.max(0, maxDuration - elapsed);
  const timePct = maxDuration > 0 ? Math.min(100, (elapsed / maxDuration) * 100) : 0;
  const minTimeMet = elapsed >= minTime;

  const poolPct = minPool > 0n ? Math.min(100, Number((totalPool * 100n) / minPool)) : 0;
  const poolMet = totalPool >= minPool;

  const formatTime = (secs: number): string => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="space-y-3">
      {/* Time progress */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-white/50">Time</span>
          <span className={minTimeMet ? "font-semibold text-green-400" : "text-white/70"}>
            {timeRemaining > 0 ? formatTime(timeRemaining) + " remaining" : "Time expired"}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              minTimeMet
                ? "bg-gradient-to-r from-green-500 to-green-400"
                : timeRemaining < 60
                  ? "bg-gradient-to-r from-red-500 to-orange-500 animate-pulse"
                  : "bg-gradient-to-r from-blue-500 to-cyan-400"
            }`}
            style={{ width: `${timePct}%` }}
          />
        </div>
        <div className="mt-0.5 flex justify-between text-[10px] text-white/30">
          <span>0s</span>
          {minTime < maxDuration && (
            <span style={{ marginLeft: `${(minTime / maxDuration) * 100 - 5}%` }}>
              min: {formatTime(minTime)}
            </span>
          )}
          <span>{formatTime(maxDuration)}</span>
        </div>
      </div>

      {/* Pool progress */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-white/50">Pool</span>
          <span className={poolMet ? "font-semibold text-green-400" : "text-white/70"}>
            {fmtUsdc(totalPool)} / {fmtUsdc(minPool)} USDC
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              poolMet
                ? "bg-gradient-to-r from-green-500 to-green-400"
                : "bg-gradient-to-r from-yellow-500 to-orange-400"
            }`}
            style={{ width: `${Math.min(100, poolPct)}%` }}
          />
        </div>
      </div>

      {/* Status indicators */}
      <div className="flex gap-2 text-[10px]">
        <span className={`rounded-full px-2 py-0.5 ${minTimeMet ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
          Time {minTimeMet ? "\u2713" : "pending"}
        </span>
        <span className={`rounded-full px-2 py-0.5 ${poolMet ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
          Pool {poolMet ? "\u2713" : "pending"}
        </span>
      </div>
    </div>
  );
}
