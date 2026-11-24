import type { Label } from "./labels.js";
import { addressKey, type AddressRef, type Transfer } from "./model.js";

export interface GraphNode {
  key: string;
  chain: string;
  address: string;
  /** Minimum number of hops from the trace origin. */
  hop: number;
  labels: Label[];
  /** True if the tracer did not expand this node further, and why. */
  stopReason?: "labeled_entity" | "max_hops" | "max_addresses" | "too_many_transactions" | "fetch_error";
  /** History was larger than the configured limit; the node's edges are incomplete. */
  truncated?: boolean;
  error?: string;
}

/** Directed multigraph of addresses (nodes) and transfers (edges). */
export class TransactionGraph {
  readonly nodes = new Map<string, GraphNode>();
  readonly edges = new Map<string, Transfer>();

  upsertNode(ref: AddressRef, hop: number, labels: Label[] = []): GraphNode {
    const key = addressKey(ref);
    const existing = this.nodes.get(key);
    if (existing) {
      if (hop < existing.hop) existing.hop = hop;
      return existing;
    }
    const node: GraphNode = { key, chain: ref.chain, address: ref.address, hop, labels };
    this.nodes.set(key, node);
    return node;
  }

  addEdge(t: Transfer): boolean {
    if (this.edges.has(t.id)) return false;
    this.edges.set(t.id, t);
    return true;
  }

  outgoing(key: string): Transfer[] {
    return [...this.edges.values()].filter((e) => addressKey({ chain: e.chain, address: e.from }) === key);
  }

  incoming(key: string): Transfer[] {
    return [...this.edges.values()].filter((e) => addressKey({ chain: e.chain, address: e.to }) === key);
  }

  labeledNodes(): GraphNode[] {
    return [...this.nodes.values()].filter((n) => n.labels.length > 0);
  }

  /** JSON-safe export (bigint → string) for UI clients and reports. */
  toJSON(): { nodes: GraphNode[]; edges: (Omit<Transfer, "amount"> & { amount: string })[] } {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()].map((e) => ({ ...e, amount: e.amount.toString() })),
    };
  }
}
