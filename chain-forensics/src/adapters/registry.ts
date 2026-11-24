import type { AddressRef, ChainInfo } from "../model.js";
import type { ChainAdapter, TransferPage, TransferQuery } from "./types.js";

/**
 * Holds one adapter per chain and caches address histories for the lifetime
 * of an investigation session, so a trace never fetches the same address twice.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, ChainAdapter>();
  private readonly cache = new Map<string, Promise<TransferPage>>();

  register(adapter: ChainAdapter): this {
    this.adapters.set(adapter.chain.id, adapter);
    return this;
  }

  get(chain: string): ChainAdapter {
    const a = this.adapters.get(chain);
    if (!a) throw new Error(`No adapter registered for chain "${chain}"`);
    return a;
  }

  has(chain: string): boolean {
    return this.adapters.has(chain);
  }

  chains(): ChainInfo[] {
    return [...this.adapters.values()].map((a) => a.chain);
  }

  chainInfo(chain: string): ChainInfo | undefined {
    return this.adapters.get(chain)?.chain;
  }

  normalize(ref: AddressRef): AddressRef {
    return { chain: ref.chain, address: this.get(ref.chain).normalizeAddress(ref.address) };
  }

  /** Which registered chains accept this address string? Useful for "paste any address" UX. */
  detectChains(address: string): ChainInfo[] {
    return [...this.adapters.values()].filter((a) => a.isValidAddress(address)).map((a) => a.chain);
  }

  getTransfers(ref: AddressRef, query: TransferQuery = {}): Promise<TransferPage> {
    const adapter = this.get(ref.chain);
    const address = adapter.normalizeAddress(ref.address);
    const key = `${ref.chain}:${address}:${query.fromTime ?? ""}:${query.toTime ?? ""}:${query.maxTransactions ?? ""}`;
    let p = this.cache.get(key);
    if (!p) {
      p = adapter.getTransfers(address, query);
      this.cache.set(key, p);
      p.catch(() => this.cache.delete(key));
    }
    return p;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
