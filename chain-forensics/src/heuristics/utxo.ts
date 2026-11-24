import type { UtxoTransaction } from "../model.js";

/**
 * UTXO heuristics. None of these are proof on their own — each result carries
 * the reasons and a confidence so an analyst (and a court) can see exactly
 * why a conclusion was drawn.
 */

// ------------------------------------------------------------- CoinJoin check

export interface CoinJoinAssessment {
  likelyCoinJoin: boolean;
  equalOutputCount: number;
  denomination?: bigint;
  distinctInputAddresses: number;
}

/**
 * Collaborative transactions (Wasabi, Whirlpool, JoinMarket...) mix many users'
 * coins into equal-value outputs. They break the common-input heuristic, so
 * they must be excluded from clustering.
 */
export function assessCoinJoin(tx: UtxoTransaction, minEqualOutputs = 3): CoinJoinAssessment {
  const inputAddrs = new Set(tx.inputs.map((i) => i.address).filter(Boolean));
  const counts = new Map<bigint, number>();
  for (const o of tx.outputs) counts.set(o.value, (counts.get(o.value) ?? 0) + 1);
  let denomination: bigint | undefined;
  let equal = 0;
  for (const [v, c] of counts) {
    if (c > equal || (c === equal && denomination !== undefined && v > denomination)) {
      equal = c;
      denomination = v;
    }
  }
  return {
    likelyCoinJoin: equal >= minEqualOutputs && inputAddrs.size >= minEqualOutputs,
    equalOutputCount: equal,
    denomination: equal > 1 ? denomination : undefined,
    distinctInputAddresses: inputAddrs.size,
  };
}

// ------------------------------------------------ Common-input-ownership (CIOH)

export interface AddressCluster {
  id: string;
  addresses: string[];
  /** Transactions whose co-spent inputs linked these addresses. */
  evidenceTxids: string[];
}

export interface ClusteringResult {
  clusters: AddressCluster[];
  /** Transactions skipped because they look collaborative (CoinJoin). */
  excludedTxids: string[];
}

/**
 * Addresses spent together as inputs of one (non-CoinJoin) transaction are
 * presumed to be controlled by the same entity. Union-find over all txs.
 */
export function clusterByCommonInputs(txs: UtxoTransaction[]): ClusteringResult {
  const parent = new Map<string, string>();
  const find = (a: string): string => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = a;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  };

  const excluded: string[] = [];
  const linking: { txid: string; addrs: string[] }[] = [];
  for (const tx of txs) {
    if (tx.isCoinbase) continue;
    const addrs = [...new Set(tx.inputs.map((i) => i.address).filter((a): a is string => !!a))];
    for (const a of addrs) if (!parent.has(a)) parent.set(a, a);
    if (addrs.length < 2) continue;
    if (assessCoinJoin(tx).likelyCoinJoin) {
      excluded.push(tx.txid);
      continue;
    }
    for (let i = 1; i < addrs.length; i++) union(addrs[0]!, addrs[i]!);
    linking.push({ txid: tx.txid, addrs });
  }

  const members = new Map<string, Set<string>>();
  for (const a of parent.keys()) {
    const r = find(a);
    if (!members.has(r)) members.set(r, new Set());
    members.get(r)!.add(a);
  }
  const evidence = new Map<string, Set<string>>();
  for (const l of linking) {
    const r = find(l.addrs[0]!);
    if (!evidence.has(r)) evidence.set(r, new Set());
    evidence.get(r)!.add(l.txid);
  }

  const clusters = [...members.entries()]
    .filter(([, m]) => m.size > 1)
    .map(([root, m]) => ({
      id: `cluster:${root}`,
      addresses: [...m].sort(),
      evidenceTxids: [...(evidence.get(root) ?? [])].sort(),
    }))
    .sort((a, b) => b.addresses.length - a.addresses.length);
  return { clusters, excludedTxids: excluded };
}

// ------------------------------------------------------------ Change detection

export interface ChangeDetection {
  outputIndex: number;
  address?: string;
  confidence: number;
  reasons: string[];
}

const isRound = (sats: bigint, unit = 100_000n): boolean => sats > 0n && sats % unit === 0n;

/**
 * Guess which output is change returned to the sender.
 * Signals used (each adds to a score, all are reported):
 *  - address reuse: output pays back to one of the input addresses
 *  - script type: output matches the inputs' script type while the others don't
 *  - round payment: every other output is a round amount, this one isn't
 * Returns null when no single output stands out.
 */
export function detectChangeOutput(tx: UtxoTransaction): ChangeDetection | null {
  if (tx.isCoinbase || tx.outputs.length < 2) return null;
  if (assessCoinJoin(tx).likelyCoinJoin) return null;

  const inputAddrs = new Set(tx.inputs.map((i) => i.address).filter(Boolean));
  const inputTypes = new Set(tx.inputs.map((i) => i.scriptType).filter(Boolean));
  const candidates = tx.outputs.map((o, i) => ({ i, o, score: 0, reasons: [] as string[] }));

  for (const c of candidates) {
    if (c.o.address && inputAddrs.has(c.o.address)) {
      c.score += 0.8;
      c.reasons.push("output address is also an input address (address reuse)");
    }
  }

  if (inputTypes.size === 1) {
    const t = [...inputTypes][0];
    const matching = candidates.filter((c) => c.o.scriptType === t);
    if (matching.length === 1) {
      matching[0]!.score += 0.3;
      matching[0]!.reasons.push(`only output with the inputs' script type (${t})`);
    }
  }

  const nonRound = candidates.filter((c) => !isRound(c.o.value));
  if (nonRound.length === 1 && candidates.length - nonRound.length >= 1) {
    nonRound[0]!.score += 0.3;
    nonRound[0]!.reasons.push("all other outputs are round amounts (likely payments)");
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]!;
  const second = candidates[1]!;
  if (best.score < 0.3 || best.score === second.score) return null;
  return {
    outputIndex: best.i,
    address: best.o.address,
    confidence: Math.min(0.95, Number((best.score - second.score * 0.5).toFixed(2))),
    reasons: best.reasons,
  };
}
