import type { ChainInfo, Transfer, UtxoTransaction } from "../model.js";

export interface TransferQuery {
  /** Only transfers at or after this UNIX time. */
  fromTime?: number;
  /** Only transfers at or before this UNIX time. */
  toTime?: number;
  /** Upper bound on raw transactions fetched per address (protects against huge exchange wallets). */
  maxTransactions?: number;
}

export interface TransferPage {
  transfers: Transfer[];
  /** True when the address had more history than `maxTransactions` allowed us to read. */
  truncated: boolean;
}

/**
 * Every blockchain is wrapped by an adapter that turns its native data model
 * into normalized `Transfer`s. Add a chain = implement this interface.
 */
export interface ChainAdapter {
  readonly chain: ChainInfo;
  /** Identifier of the data source (recorded in every Transfer for provenance). */
  readonly sourceId: string;
  isValidAddress(address: string): boolean;
  /** Canonical form used as identity inside the core (e.g. lowercase for EVM). */
  normalizeAddress(address: string): string;
  /** All transfers in which the address is sender or receiver. */
  getTransfers(address: string, query?: TransferQuery): Promise<TransferPage>;
}

/** UTXO adapters also expose raw transactions so UTXO-specific heuristics can run. */
export interface UtxoChainAdapter extends ChainAdapter {
  getTransactions(address: string, query?: TransferQuery): Promise<{ txs: UtxoTransaction[]; truncated: boolean }>;
}

export const isUtxoAdapter = (a: ChainAdapter): a is UtxoChainAdapter =>
  typeof (a as UtxoChainAdapter).getTransactions === "function";
