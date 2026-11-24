import type { AdapterRegistry } from "./adapters/registry.js";
import type { InvestigationContext } from "./audit.js";
import { TransactionGraph, type GraphNode } from "./graph.js";
import type { EntityCategory, LabelStore } from "./labels.js";
import { addressKey, assetKey, type AddressRef, type Asset, type Transfer } from "./model.js";

export type TraceDirection = "forward" | "backward";

export interface TraceOptions {
  /** forward = where did the funds go; backward = where did they come from. */
  direction: TraceDirection;
  /** Maximum hops from the origin. Default 3. */
  maxHops?: number;
  /** Hard cap on addresses expanded (each expansion = network calls). Default 200. */
  maxAddresses?: number;
  /** Ignore transfers below this amount (base units). Per asset; undefined = keep all. */
  minAmount?: (asset: Asset) => bigint | undefined;
  /** Only follow these assets (asset keys "chain:contract|native"). Undefined = all. */
  assets?: string[];
  /**
   * Enforce causality: when following funds forward, only use outgoing transfers that
   * happened at/after the funds arrived (backward: incoming before they left). Default true.
   */
  respectTime?: boolean;
  /** Time window applied at the origin address (UNIX seconds). */
  fromTime?: number;
  toTime?: number;
  /** Do not expand past addresses labeled with these categories. */
  stopAtCategories?: EntityCategory[];
  /** Per-address history cap; addresses above it are treated as services and not expanded. Default 500. */
  maxTransactionsPerAddress?: number;
  onProgress?: (p: { expanded: number; queued: number; hop: number }) => void;
}

export interface TraceResult {
  origin: AddressRef;
  direction: TraceDirection;
  graph: TransactionGraph;
  /** Labeled entities reached (exchanges etc. — candidates for a legal data request). */
  endpoints: GraphNode[];
  /** True if any limit (hops, addresses, history size) cut the trace short. */
  incomplete: boolean;
  stats: { addressesExpanded: number; transfers: number; maxHopReached: number };
}

export const DEFAULT_STOP_CATEGORIES: EntityCategory[] = ["exchange", "mixer", "bridge", "payment_service"];

/** Pseudo-addresses produced by UTXO normalization (coinbase, unresolved inputs) — never expanded. */
const isPseudoAddress = (a: string): boolean => a === "coinbase" || a.startsWith("unknown:");

interface QueueItem {
  ref: AddressRef;
  hop: number;
  /** forward: earliest arrival time; backward: latest departure time. */
  bound: number;
}

export async function traceFunds(
  originInput: AddressRef,
  registry: AdapterRegistry,
  labels: LabelStore,
  ctx: InvestigationContext,
  opts: TraceOptions,
): Promise<TraceResult> {
  const maxHops = opts.maxHops ?? 3;
  const maxAddresses = opts.maxAddresses ?? 200;
  const respectTime = opts.respectTime ?? true;
  const stopAt = new Set(opts.stopAtCategories ?? DEFAULT_STOP_CATEGORIES);
  const assets = opts.assets ? new Set(opts.assets) : undefined;
  const maxTx = opts.maxTransactionsPerAddress ?? 500;
  const forward = opts.direction === "forward";

  const adapter = registry.get(originInput.chain);
  if (!adapter.isValidAddress(originInput.address)) {
    throw new Error(`Invalid ${adapter.chain.name} address: ${originInput.address}`);
  }
  const origin = registry.normalize(originInput);

  ctx.audit.append(ctx.caseId, ctx.actor, "trace.start", {
    origin,
    direction: opts.direction,
    maxHops,
    maxAddresses,
    respectTime,
    fromTime: opts.fromTime,
    toTime: opts.toTime,
    stopAtCategories: [...stopAt],
    assets: opts.assets,
  });

  const graph = new TransactionGraph();
  const labelsFor = (ref: AddressRef) => labels.lookup(ref, registry.chainInfo(ref.chain));
  graph.upsertNode(origin, 0, labelsFor(origin));

  // best time bound with which each address has been expanded
  const expandedBound = new Map<string, number>();
  const queue: QueueItem[] = [{ ref: origin, hop: 0, bound: forward ? -Infinity : Infinity }];
  let expanded = 0;
  let incomplete = false;
  let maxHopReached = 0;

  while (queue.length > 0) {
    const item = queue.shift()!;
    const key = addressKey(item.ref);
    const node = graph.nodes.get(key)!;

    const prev = expandedBound.get(key);
    if (prev !== undefined && (forward ? prev <= item.bound : prev >= item.bound)) continue;

    if (item.hop > 0 && node.labels.some((l) => stopAt.has(l.category))) {
      node.stopReason = "labeled_entity";
      continue;
    }
    const alreadyExpanded = prev !== undefined;
    if (item.hop >= maxHops) {
      if (!alreadyExpanded) {
        node.stopReason ??= "max_hops";
        incomplete = true;
      }
      continue;
    }
    if (expanded >= maxAddresses) {
      if (!alreadyExpanded) node.stopReason = "max_addresses";
      incomplete = true;
      continue;
    }

    expandedBound.set(key, item.bound);
    expanded++;
    maxHopReached = Math.max(maxHopReached, item.hop);
    opts.onProgress?.({ expanded, queued: queue.length, hop: item.hop });

    let transfers: Transfer[];
    try {
      const page = await registry.getTransfers(item.ref, {
        fromTime: item.hop === 0 ? opts.fromTime : undefined,
        toTime: item.hop === 0 ? opts.toTime : undefined,
        maxTransactions: maxTx,
      });
      if (page.truncated) {
        node.truncated = true;
        incomplete = true;
        if (item.hop > 0) {
          node.stopReason = "too_many_transactions";
          continue;
        }
      }
      transfers = page.transfers;
    } catch (err) {
      node.stopReason = "fetch_error";
      node.error = err instanceof Error ? err.message : String(err);
      incomplete = true;
      continue;
    }

    for (const t of transfers) {
      const self = forward ? t.from : t.to;
      const other = forward ? t.to : t.from;
      if (self !== item.ref.address || other === self) continue;
      if (respectTime && (forward ? t.timestamp < item.bound : t.timestamp > item.bound)) continue;
      if (assets && !assets.has(assetKey(t.asset))) continue;
      const min = opts.minAmount?.(t.asset);
      if (min !== undefined && t.amount < min) continue;

      graph.addEdge(t);
      const nextRef = { chain: t.chain, address: other };
      graph.upsertNode(nextRef, item.hop + 1, labelsFor(nextRef));
      if (isPseudoAddress(other)) continue;
      queue.push({ ref: nextRef, hop: item.hop + 1, bound: t.timestamp });
    }
  }

  const endpoints = graph.labeledNodes().filter((n) => n.key !== addressKey(origin));
  const result: TraceResult = {
    origin,
    direction: opts.direction,
    graph,
    endpoints,
    incomplete,
    stats: { addressesExpanded: expanded, transfers: graph.edges.size, maxHopReached },
  };
  ctx.audit.append(ctx.caseId, ctx.actor, "trace.end", {
    origin,
    ...result.stats,
    nodes: graph.nodes.size,
    endpoints: endpoints.map((e) => e.key),
    incomplete,
  });
  return result;
}
