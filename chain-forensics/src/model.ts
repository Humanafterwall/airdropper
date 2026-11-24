/**
 * Core, chain-agnostic data model.
 *
 * All amounts are integers in the asset's smallest unit (satoshi, wei, ...)
 * stored as bigint so nothing is ever lost to floating-point rounding.
 * Timestamps are UNIX seconds (UTC).
 */

export type ChainFamily = "utxo" | "evm";

export interface Asset {
  chain: string;
  symbol: string;
  decimals: number;
  /** Token contract address (lowercase). Undefined for the chain's native asset. */
  contract?: string;
}

export interface ChainInfo {
  /** Stable identifier used everywhere in the core, e.g. "bitcoin", "ethereum", "polygon". */
  id: string;
  name: string;
  family: ChainFamily;
  nativeAsset: Asset;
  /** EVM chain id (EIP-155), if applicable. */
  evmChainId?: number;
}

export type TransferKind = "utxo" | "native" | "internal" | "token";

/**
 * How the sender→receiver link was established.
 * - direct: the chain itself records this exact value moving from `from` to `to`
 *   (account-model chains, or a UTXO tx whose inputs all belong to one address).
 * - proportional: a UTXO tx with several input addresses; the output value was
 *   attributed to each input address in proportion to its contribution.
 *   This is an analytical model, NOT a fact recorded on-chain, and must be
 *   presented as such in reports.
 */
export type Attribution = "direct" | "proportional";

export interface Transfer {
  /** Globally unique: `${chain}:${txHash}:${position}` */
  id: string;
  chain: string;
  txHash: string;
  /** Position inside the transaction, e.g. "native", "out:1/in:0", "token:17", "internal:0_1". */
  position: string;
  from: string;
  to: string;
  asset: Asset;
  amount: bigint;
  timestamp: number;
  blockNumber?: number;
  kind: TransferKind;
  attribution: Attribution;
  /** Identifier of the data source this was read from (for evidence provenance). */
  source: string;
}

export interface UtxoInput {
  address?: string;
  value: bigint;
  prevTxid?: string;
  prevVout?: number;
  scriptType?: string;
}

export interface UtxoOutput {
  address?: string;
  value: bigint;
  scriptType?: string;
}

export interface UtxoTransaction {
  chain: string;
  txid: string;
  timestamp: number;
  blockHeight?: number;
  fee: bigint;
  isCoinbase: boolean;
  inputs: UtxoInput[];
  outputs: UtxoOutput[];
}

export interface AddressRef {
  chain: string;
  address: string;
}

export const addressKey = (ref: AddressRef): string => `${ref.chain}:${ref.address}`;

export function parseAddressKey(key: string): AddressRef {
  const i = key.indexOf(":");
  if (i < 0) throw new Error(`Invalid address key: ${key}`);
  return { chain: key.slice(0, i), address: key.slice(i + 1) };
}

export const assetKey = (a: Asset): string => `${a.chain}:${a.contract ?? "native"}`;

/** Format a base-unit amount as a decimal string, e.g. 150000000n / 8 decimals -> "1.5". */
export function formatAmount(amount: bigint, decimals: number): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  let s = whole.toString();
  if (decimals > 0 && frac > 0n) {
    s += "." + frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  }
  return neg ? "-" + s : s;
}
