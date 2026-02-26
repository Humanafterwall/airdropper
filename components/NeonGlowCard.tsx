"use client";

import type { ReactNode } from "react";

const ACCENTS = {
  yellow: "neon-yellow",
  green: "neon-green",
  blue: "neon-blue",
  purple: "neon-purple",
  white: "neon-white",
  gold: "neon-gold",
  silver: "neon-silver",
  bronze: "neon-bronze",
} as const;

export function NeonGlowCard({
  accent = "yellow",
  animated = true,
  children,
  className = "",
}: {
  accent?: keyof typeof ACCENTS;
  animated?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`neon-glow-wrapper ${ACCENTS[accent]} ${
        animated ? "" : "neon-glow-static"
      } ${className}`}
    >
      <div className="neon-glow-inner">{children}</div>
    </div>
  );
}
