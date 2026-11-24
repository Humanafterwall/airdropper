import { AuditLog, type InvestigationContext } from "../src/audit.js";
import type { FetchLike } from "../src/http.js";
import type { ChainAdapter, TransferPage, TransferQuery } from "../src/adapters/types.js";
import type { ChainInfo, Transfer } from "../src/model.js";

export const fixedClock = () => new Date("2026-01-01T00:00:00Z");

export function makeCtx(): InvestigationContext {
  return { caseId: "KT-123/2026", actor: "analyst.petrovic", audit: new AuditLog({ clock: fixedClock }) };
}

/** Fake fetch: matches requests by URL substring. */
export function fakeFetch(routes: [match: string | RegExp, body: unknown, status?: number][]): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const r = routes.find(([m]) => (typeof m === "string" ? url.includes(m) : m.test(url)));
    if (!r) return { status: 404, ok: false, text: async () => "not found" };
    const status = r[2] ?? 200;
    return { status, ok: status < 400, text: async () => JSON.stringify(r[1]) };
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}

export const noSleep = { sleep: async () => {}, minIntervalMs: 0 };

/** In-memory adapter over a fixed list of transfers. */
export class MemoryAdapter implements ChainAdapter {
  readonly sourceId = "memory";
  calls: string[] = [];
  constructor(
    readonly chain: ChainInfo,
    private readonly transfers: Transfer[],
    private readonly truncatedAddrs = new Set<string>(),
  ) {}
  isValidAddress(a: string) {
    return a.length > 0 && !a.includes(" ");
  }
  normalizeAddress(a: string) {
    return a.toLowerCase();
  }
  async getTransfers(address: string, q: TransferQuery = {}): Promise<TransferPage> {
    this.calls.push(address);
    return {
      truncated: this.truncatedAddrs.has(address),
      transfers: this.transfers.filter(
        (t) =>
          (t.from === address || t.to === address) &&
          (q.fromTime === undefined || t.timestamp >= q.fromTime) &&
          (q.toTime === undefined || t.timestamp <= q.toTime),
      ),
    };
  }
}

let n = 0;
export function tr(chain: ChainInfo, from: string, to: string, amount: bigint, timestamp: number): Transfer {
  const h = `0xtx${++n}`;
  return {
    id: `${chain.id}:${h}:native`,
    chain: chain.id,
    txHash: h,
    position: "native",
    from,
    to,
    asset: chain.nativeAsset,
    amount,
    timestamp,
    kind: "native",
    attribution: "direct",
    source: "memory",
  };
}
