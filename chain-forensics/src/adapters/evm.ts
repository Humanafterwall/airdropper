import type { InvestigationContext } from "../audit.js";
import { HttpClient, type HttpClientOptions } from "../http.js";
import type { ChainInfo, Transfer } from "../model.js";
import { isValidEvmAddress, normalizeEvmAddress } from "../util/address.js";
import type { ChainAdapter, TransferPage, TransferQuery } from "./types.js";

/**
 * EVM adapter backed by the Etherscan v2 multichain API
 * (one API key, `chainid` selects the network). Reads three record types:
 *   txlist          – native value transfers
 *   txlistinternal  – native value moved by contracts (internal calls)
 *   tokentx         – ERC-20 Transfer events
 *
 * Coverage of chains on a given Etherscan plan varies; check your licence.
 * The same interface can be implemented on top of your own archive node +
 * indexer, which is preferable for evidence work.
 */

interface EtherscanResponse<T> {
  status: string;
  message: string;
  result: T[] | string;
}

interface EsNormalTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  blockNumber: string;
  isError?: string;
}

interface EsInternalTx extends EsNormalTx {
  traceId?: string;
}

interface EsTokenTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  blockNumber: string;
  contractAddress: string;
  tokenSymbol: string;
  tokenDecimal: string;
  logIndex: string;
}

export interface EtherscanAdapterOptions extends HttpClientOptions {
  chain: ChainInfo;
  apiKey: string;
  baseUrl?: string;
  sourceId?: string;
  /** Include zero-value transfers (often address-poisoning spam). Default false. */
  includeZeroValue?: boolean;
}

/** Etherscan returns at most 10,000 records per query window. */
const MAX_PAGE = 1000;

export class EtherscanEvmAdapter implements ChainAdapter {
  readonly chain: ChainInfo;
  readonly sourceId: string;
  private readonly http: HttpClient;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly includeZeroValue: boolean;

  constructor(ctx: InvestigationContext, opts: EtherscanAdapterOptions) {
    if (opts.chain.family !== "evm" || opts.chain.evmChainId === undefined) {
      throw new Error(`${opts.chain.id} is not an EVM chain`);
    }
    this.chain = opts.chain;
    this.baseUrl = (opts.baseUrl ?? "https://api.etherscan.io/v2/api").replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.sourceId = opts.sourceId ?? `etherscan-v2:${opts.chain.evmChainId}`;
    this.includeZeroValue = opts.includeZeroValue ?? false;
    this.http = new HttpClient(ctx, this.sourceId, opts);
  }

  isValidAddress(address: string): boolean {
    return isValidEvmAddress(address.trim());
  }

  normalizeAddress(address: string): string {
    return normalizeEvmAddress(address);
  }

  async getTransfers(address: string, query: TransferQuery = {}): Promise<TransferPage> {
    if (!this.isValidAddress(address)) throw new Error(`Invalid EVM address: ${address}`);
    const addr = this.normalizeAddress(address);
    const max = query.maxTransactions ?? 1000;
    const offset = Math.min(max, MAX_PAGE);

    const [normal, internal, tokens] = await Promise.all([
      this.list<EsNormalTx>("txlist", addr, offset),
      this.list<EsInternalTx>("txlistinternal", addr, offset),
      this.list<EsTokenTx>("tokentx", addr, offset),
    ]);
    const truncated = normal.length >= offset || internal.length >= offset || tokens.length >= offset;

    const transfers: Transfer[] = [];
    for (const t of normal) {
      if (t.isError === "1" || !t.to) continue; // failed tx or contract creation
      this.push(transfers, t, "native", "native", BigInt(t.value), this.chain.nativeAsset);
    }
    internal.forEach((t, i) => {
      if (t.isError === "1" || !t.to) return;
      this.push(transfers, t, "internal", `internal:${t.traceId ?? i}`, BigInt(t.value), this.chain.nativeAsset);
    });
    for (const t of tokens) {
      const asset = {
        chain: this.chain.id,
        symbol: t.tokenSymbol,
        decimals: Number(t.tokenDecimal) || 0,
        contract: t.contractAddress.toLowerCase(),
      };
      this.push(transfers, t, "token", `token:${t.logIndex}`, BigInt(t.value), asset);
    }

    const filtered = transfers.filter(
      (t) =>
        (query.fromTime === undefined || t.timestamp >= query.fromTime) &&
        (query.toTime === undefined || t.timestamp <= query.toTime),
    );
    filtered.sort((a, b) => a.timestamp - b.timestamp || (a.id < b.id ? -1 : 1));
    return { transfers: filtered, truncated };
  }

  private push(
    out: Transfer[],
    t: { hash: string; from: string; to: string; timeStamp: string; blockNumber: string },
    kind: Transfer["kind"],
    position: string,
    amount: bigint,
    asset: Transfer["asset"],
  ): void {
    if (amount === 0n && !this.includeZeroValue) return;
    out.push({
      id: `${this.chain.id}:${t.hash.toLowerCase()}:${position}`,
      chain: this.chain.id,
      txHash: t.hash.toLowerCase(),
      position,
      from: normalizeEvmAddress(t.from),
      to: normalizeEvmAddress(t.to),
      asset,
      amount,
      timestamp: Number(t.timeStamp),
      blockNumber: Number(t.blockNumber),
      kind,
      attribution: "direct",
      source: this.sourceId,
    });
  }

  private async list<T>(action: string, address: string, offset: number): Promise<T[]> {
    const params = new URLSearchParams({
      chainid: String(this.chain.evmChainId),
      module: "account",
      action,
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: String(offset),
      sort: "asc",
      apikey: this.apiKey,
    });
    const res = await this.http.getJson<EtherscanResponse<T>>(`${this.baseUrl}?${params}`);
    if (res.status === "1" && Array.isArray(res.result)) return res.result;
    if (res.message?.startsWith("No transactions found") || (Array.isArray(res.result) && res.result.length === 0)) return [];
    throw new Error(`Etherscan ${action} error: ${res.message} ${typeof res.result === "string" ? res.result : ""}`.trim());
  }
}
