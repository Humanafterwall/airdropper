"use client";

import { useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { NeonGlowCard } from "./NeonGlowCard";

function fmt(val: bigint): string {
  return Number(formatUnits(val, 6)).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

/* ── SVG wave path (horizontal waves for tube surface) ── */
function wavePath(
  width: number,
  height: number,
  amplitude: number,
  frequency: number,
  phase: number,
): string {
  const points: string[] = [];
  const steps = 80;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y =
      height / 2 +
      Math.sin((i / steps) * Math.PI * 2 * frequency + phase) * amplitude;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  points.push(`L${width},${height}`);
  points.push(`L0,${height}`);
  points.push("Z");
  return points.join(" ");
}

/* Scale tick marks on the side of the tube */
const SCALE_TICKS = [0, 25, 50, 75, 100];

export function JackDropPoolViz({
  balance,
  target,
  prizes,
}: {
  balance: bigint;
  target: bigint;
  prizes?: { first: bigint; second: bigint; rest: bigint };
}) {
  const pct =
    target > 0n
      ? Math.min(100, Number((balance * 10000n) / target) / 100)
      : 0;
  const [displayPct, setDisplayPct] = useState(0);
  const prevPctRef = useRef(0);

  // Smooth fill animation
  useEffect(() => {
    const start = prevPctRef.current;
    const end = pct;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPct(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    prevPctRef.current = end;
  }, [pct]);

  // SVG wave dimensions (width of the tube)
  const SVG_W = 400;
  const SVG_H = 24;
  const wave1 = wavePath(SVG_W * 2, SVG_H, 5, 3, 0);
  const wave2 = wavePath(SVG_W * 2, SVG_H, 3, 2.5, 1.5);

  const isNearTarget = pct >= 90;

  // Dynamic prizes
  const prize1 = prizes?.first ?? (target * 75n) / 100n;
  const prize2 = prizes?.second ?? (target * 10n) / 100n;
  const prizeR = prizes?.rest ?? (target * 1n) / 100n;

  return (
    <div className="flex flex-col items-center">
      {/* Title */}
      <h3 className="text-lg font-bold text-green-400">JackDrop Pool</h3>
      <p className="text-xs text-white/50">17 winners when target reached</p>

      {/* Tank row: scale | tube | prizes */}
      <div className="mt-3 flex items-stretch gap-3">
        {/* Left: scale labels */}
        <div className="relative flex w-8 flex-col justify-between py-1 text-right text-[9px] text-white/40">
          {SCALE_TICKS.slice()
            .reverse()
            .map((tick) => (
              <span key={tick}>{tick}%</span>
            ))}
        </div>

        {/* Vertical tube (epruveta) */}
        <div className="relative h-[360px] w-[120px] overflow-hidden rounded-b-[60px] rounded-t-xl border border-white/15 bg-white/5">
          {/* Fill from bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-300"
            style={{
              height: `${displayPct}%`,
              animation: "liquid-bob 4s ease-in-out infinite",
            }}
          >
            {/* Green liquid gradient */}
            <div
              className={`h-full w-full bg-gradient-to-t from-green-700 via-green-500 to-emerald-400 ${
                isNearTarget ? "animate-pulse" : ""
              }`}
            />

            {/* SVG wave surface at top of fill */}
            <div className="absolute left-0 right-0 top-0 -translate-y-[16px] overflow-hidden">
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                preserveAspectRatio="none"
                className="h-[22px] w-full"
              >
                <path
                  d={wave1}
                  fill="rgba(74,222,128,0.5)"
                  style={{ animation: "wave-shift-1 4s linear infinite" }}
                />
                <path
                  d={wave2}
                  fill="rgba(52,211,153,0.35)"
                  style={{ animation: "wave-shift-2 5s linear infinite" }}
                />
              </svg>
            </div>
          </div>

          {/* Bubble particles near target */}
          {isNearTarget && (
            <>
              <div
                className="absolute h-2.5 w-2.5 animate-bounce rounded-full bg-green-300/40"
                style={{ bottom: "15%", left: "25%", animationDuration: "2s" }}
              />
              <div
                className="absolute h-2 w-2 animate-bounce rounded-full bg-emerald-300/30"
                style={{
                  bottom: "35%",
                  left: "55%",
                  animationDelay: "0.5s",
                  animationDuration: "2.5s",
                }}
              />
              <div
                className="absolute h-1.5 w-1.5 animate-bounce rounded-full bg-green-200/30"
                style={{
                  bottom: "55%",
                  left: "40%",
                  animationDelay: "1s",
                  animationDuration: "3s",
                }}
              />
              <div
                className="absolute h-2 w-2 animate-bounce rounded-full bg-emerald-300/20"
                style={{
                  bottom: "25%",
                  left: "70%",
                  animationDelay: "0.7s",
                  animationDuration: "2.8s",
                }}
              />
            </>
          )}

          {/* Scale tick lines inside tube */}
          {SCALE_TICKS.slice(1, -1).map((tick) => (
            <div
              key={tick}
              className="absolute left-0 right-0 border-t border-dashed border-white/10"
              style={{ bottom: `${tick}%` }}
            />
          ))}

          {/* Percentage overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`text-2xl font-black tabular-nums drop-shadow-lg ${
                displayPct > 50 ? "text-black/70" : "text-green-400/90"
              }`}
            >
              {displayPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Right: prize tiers with neon glow badges */}
        <div className="relative flex w-32 flex-col justify-end py-1">
          {/* 1st — Gold */}
          <div className="absolute" style={{ bottom: "88%", left: 0, right: 0 }}>
            <NeonGlowCard accent="gold" animated={false}>
              <div className="px-2 py-1.5 text-[10px] leading-tight">
                <div className="font-semibold text-yellow-300">1st Prize</div>
                <div className="font-bold text-white/90">{fmt(prize1)} USDC</div>
              </div>
            </NeonGlowCard>
          </div>
          {/* 2nd — Silver */}
          <div className="absolute" style={{ bottom: "70%", left: 0, right: 0 }}>
            <NeonGlowCard accent="silver" animated={false}>
              <div className="px-2 py-1.5 text-[10px] leading-tight">
                <div className="font-semibold text-slate-300">2nd Prize</div>
                <div className="font-bold text-white/80">{fmt(prize2)} USDC</div>
              </div>
            </NeonGlowCard>
          </div>
          {/* 3rd-17th — Bronze */}
          <div className="absolute" style={{ bottom: "52%", left: 0, right: 0 }}>
            <NeonGlowCard accent="bronze" animated={false}>
              <div className="px-2 py-1.5 text-[10px] leading-tight">
                <div className="font-semibold text-amber-400">3rd-17th</div>
                <div className="font-bold text-white/70">{fmt(prizeR)} x15</div>
              </div>
            </NeonGlowCard>
          </div>
        </div>
      </div>

      {/* Amount display below tube */}
      <div className="mt-3 text-center">
        <div className="text-xl font-bold text-green-400">
          {fmt(balance)} USDC
        </div>
        <div className="text-xs text-white/40">
          of {fmt(target)} USDC target
        </div>
      </div>
    </div>
  );
}
