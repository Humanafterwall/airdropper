import type { EntityCategory } from "./labels.js";
import { addressKey, assetKey, formatAmount } from "./model.js";
import type { TraceResult } from "./tracer.js";

/**
 * Explainable exposure score. Deliberately simple and transparent: every point
 * of the score is traceable to a labeled entity, its hop distance and the
 * attribution confidence. Severity weights are policy — adjust them to your
 * institution's guidelines and document the version used in each report.
 */
export const DEFAULT_SEVERITY: Record<EntityCategory, number> = {
  sanctioned: 1.0,
  ransomware: 1.0,
  darknet_market: 0.9,
  scam: 0.9,
  mixer: 0.8,
  gambling: 0.4,
  bridge: 0.2,
  other: 0.2,
  exchange: 0.1,
  payment_service: 0.1,
  defi: 0.1,
  law_enforcement: 0,
};

export interface RiskContribution {
  address: string;
  chain: string;
  entity: string;
  category: EntityCategory;
  hop: number;
  severity: number;
  labelConfidence: number;
  weight: number;
  /** Value moved directly between the trace and this entity, per asset. */
  amounts: { asset: string; symbol: string; amount: string }[];
  explanation: string;
}

export interface RiskAssessment {
  score: number; // 0..100
  level: "none" | "low" | "medium" | "high" | "severe";
  contributions: RiskContribution[];
  policyVersion: string;
}

export interface RiskOptions {
  severity?: Partial<Record<EntityCategory, number>>;
  /** weight multiplier per hop: hop 1 → 1, hop 2 → decay, hop 3 → decay² ... */
  hopDecay?: number;
  policyVersion?: string;
}

export function assessRisk(trace: TraceResult, opts: RiskOptions = {}): RiskAssessment {
  const severity = { ...DEFAULT_SEVERITY, ...opts.severity };
  const decay = opts.hopDecay ?? 0.5;
  const forward = trace.direction === "forward";
  const originKey = addressKey(trace.origin);
  const contributions: RiskContribution[] = [];

  for (const node of trace.graph.nodes.values()) {
    if (node.labels.length === 0) continue;
    const label = node.labels[0]!;
    const sev = severity[label.category] ?? 0;
    const hop = node.key === originKey ? 0 : node.hop;
    const weight = sev * label.confidence * (hop === 0 ? 1 : decay ** (hop - 1));
    if (weight <= 0) continue;

    const edges = forward ? trace.graph.incoming(node.key) : trace.graph.outgoing(node.key);
    const sums = new Map<string, { symbol: string; decimals: number; amount: bigint }>();
    for (const e of edges) {
      const k = assetKey(e.asset);
      const s = sums.get(k) ?? { symbol: e.asset.symbol, decimals: e.asset.decimals, amount: 0n };
      s.amount += e.amount;
      sums.set(k, s);
    }
    const amounts = [...sums.entries()].map(([asset, s]) => ({
      asset,
      symbol: s.symbol,
      amount: formatAmount(s.amount, s.decimals),
    }));
    const rel = hop === 0 ? "the subject address itself is" : `${hop} hop(s) ${forward ? "downstream" : "upstream"} is`;
    contributions.push({
      address: node.address,
      chain: node.chain,
      entity: label.entity,
      category: label.category,
      hop,
      severity: sev,
      labelConfidence: label.confidence,
      weight: Number(weight.toFixed(4)),
      amounts,
      explanation: `${rel} labeled "${label.entity}" (${label.category}, source: ${label.source}, confidence ${label.confidence})`,
    });
  }

  contributions.sort((a, b) => b.weight - a.weight);
  const combined = 1 - contributions.reduce((p, c) => p * (1 - Math.min(1, c.weight)), 1);
  const score = Math.round(combined * 100);
  const level = score === 0 ? "none" : score < 20 ? "low" : score < 50 ? "medium" : score < 80 ? "high" : "severe";
  return { score, level, contributions, policyVersion: opts.policyVersion ?? "default-1" };
}
