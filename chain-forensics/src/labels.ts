import type { AddressRef, ChainInfo } from "./model.js";

export type EntityCategory =
  | "exchange"
  | "mixer"
  | "bridge"
  | "sanctioned"
  | "scam"
  | "ransomware"
  | "darknet_market"
  | "gambling"
  | "defi"
  | "payment_service"
  | "law_enforcement"
  | "other";

export interface Label {
  /** Chain id, or "evm" to apply to the same address on every EVM chain. */
  chain: string;
  address: string;
  entity: string;
  category: EntityCategory;
  /** Where this attribution came from (OFAC list, court order, exchange response, analyst, ...). */
  source: string;
  /** 0..1 — how certain the attribution is. Official lists / legal responses = 1. */
  confidence: number;
  addedAt?: string;
  note?: string;
}

/**
 * Attribution database. Lookups are case-insensitive for EVM addresses
 * (callers pass normalized addresses; the store normalizes EVM ones itself too).
 */
export class LabelStore {
  private readonly byKey = new Map<string, Label[]>();

  constructor(labels: Label[] = []) {
    this.addAll(labels);
  }

  private static key(chain: string, address: string): string {
    return `${chain}:${/^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : address}`;
  }

  add(label: Label): void {
    if (label.confidence < 0 || label.confidence > 1) throw new Error("confidence must be within 0..1");
    const k = LabelStore.key(label.chain, label.address);
    const list = this.byKey.get(k) ?? [];
    if (!list.some((l) => l.entity === label.entity && l.category === label.category && l.source === label.source)) {
      list.push(label);
    }
    this.byKey.set(k, list);
  }

  addAll(labels: Iterable<Label>): void {
    for (const l of labels) this.add(l);
  }

  /** All labels for an address; `chainInfo` enables "evm"-wide labels to match. */
  lookup(ref: AddressRef, chainInfo?: ChainInfo): Label[] {
    const out = [...(this.byKey.get(LabelStore.key(ref.chain, ref.address)) ?? [])];
    if (chainInfo?.family === "evm") out.push(...(this.byKey.get(LabelStore.key("evm", ref.address)) ?? []));
    return out.sort((a, b) => b.confidence - a.confidence);
  }

  /** Highest-confidence label, if any. */
  primary(ref: AddressRef, chainInfo?: ChainInfo): Label | undefined {
    return this.lookup(ref, chainInfo)[0];
  }

  size(): number {
    let n = 0;
    for (const l of this.byKey.values()) n += l.length;
    return n;
  }

  toJSON(): Label[] {
    return [...this.byKey.values()].flat();
  }
}

/**
 * Extract crypto addresses from the OFAC SDN list (public data, e.g. sdn.csv /
 * the "Remarks" text) — entries look like "Digital Currency Address - XBT 1Abc...;".
 * Only currencies whose chain we can determine unambiguously are mapped.
 */
const OFAC_CHAIN: Record<string, string> = {
  XBT: "bitcoin",
  ETH: "evm",
  BSC: "evm",
  ARB: "evm",
  ETC: "ethereum-classic",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  TRX: "tron",
  XMR: "monero",
  ZEC: "zcash",
  DASH: "dash",
  BTG: "bitcoin-gold",
  BSV: "bitcoin-sv",
  XRP: "xrp",
  SOL: "solana",
};

export function parseOfacSdnAddresses(text: string, source = "OFAC SDN"): Label[] {
  const re = /Digital Currency Address - ([A-Z0-9]+)\s+([A-Za-z0-9]+)/g;
  const labels: Label[] = [];
  for (const m of text.matchAll(re)) {
    const code = m[1]!;
    const chain = OFAC_CHAIN[code];
    if (!chain) continue;
    labels.push({
      chain,
      address: chain === "evm" ? m[2]!.toLowerCase() : m[2]!,
      entity: `OFAC SDN (${code})`,
      category: "sanctioned",
      source,
      confidence: 1,
    });
  }
  return labels;
}
