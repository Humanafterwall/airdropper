import type { InvestigationContext } from "../audit.js";
import { CHAINS } from "../chains.js";
import { HttpClient, type HttpClientOptions } from "../http.js";
import type { ChainInfo, UtxoTransaction } from "../model.js";
import { bitcoinAddressType, normalizeBitcoinAddress, type BitcoinNetwork } from "../util/address.js";
import type { TransferPage, TransferQuery, UtxoChainAdapter } from "./types.js";
import { utxoToTransfers } from "./utxo.js";

/** Subset of the Esplora REST API transaction format (Blockstream / mempool.space / self-hosted electrs). */
interface EsploraTx {
  txid: string;
  fee: number;
  vin: {
    txid: string;
    vout: number;
    is_coinbase: boolean;
    prevout: { scriptpubkey_address?: string; scriptpubkey_type?: string; value: number } | null;
  }[];
  vout: { scriptpubkey_address?: string; scriptpubkey_type?: string; value: number }[];
  status: { confirmed: boolean; block_height?: number; block_time?: number };
}

export interface EsploraAdapterOptions extends HttpClientOptions {
  /** e.g. "https://mempool.space/api" or your own electrs instance (recommended for evidence work). */
  baseUrl: string;
  network?: BitcoinNetwork;
  chain?: ChainInfo;
  sourceId?: string;
}

/** Esplora returns 25 confirmed txs per page. */
const PAGE_SIZE = 25;

export class EsploraBitcoinAdapter implements UtxoChainAdapter {
  readonly chain: ChainInfo;
  readonly sourceId: string;
  private readonly http: HttpClient;
  private readonly baseUrl: string;
  private readonly network: BitcoinNetwork;

  constructor(ctx: InvestigationContext, opts: EsploraAdapterOptions) {
    this.network = opts.network ?? "mainnet";
    this.chain = opts.chain ?? (this.network === "mainnet" ? CHAINS.bitcoin : CHAINS.bitcoinTestnet);
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.sourceId = opts.sourceId ?? `esplora:${new URL(this.baseUrl).host}`;
    this.http = new HttpClient(ctx, this.sourceId, opts);
  }

  isValidAddress(address: string): boolean {
    return bitcoinAddressType(address.trim(), this.network) !== null;
  }

  normalizeAddress(address: string): string {
    return normalizeBitcoinAddress(address);
  }

  async getTransactions(address: string, query: TransferQuery = {}): Promise<{ txs: UtxoTransaction[]; truncated: boolean }> {
    const addr = this.normalizeAddress(address);
    if (!this.isValidAddress(addr)) throw new Error(`Invalid ${this.chain.name} address: ${address}`);
    const max = query.maxTransactions ?? 500;
    const out: UtxoTransaction[] = [];
    let lastTxid: string | undefined;
    let truncated = false;

    // Esplora pages newest → oldest over confirmed transactions.
    for (;;) {
      const url = lastTxid
        ? `${this.baseUrl}/address/${addr}/txs/chain/${lastTxid}`
        : `${this.baseUrl}/address/${addr}/txs/chain`;
      const page = await this.http.getJson<EsploraTx[]>(url);
      let reachedStart = false;
      for (const raw of page) {
        if (!raw.status.confirmed) continue; // only confirmed data is evidence-grade
        const tx = this.toUtxoTx(raw);
        if (query.toTime !== undefined && tx.timestamp > query.toTime) continue;
        if (query.fromTime !== undefined && tx.timestamp < query.fromTime) {
          reachedStart = true;
          break;
        }
        if (out.length >= max) {
          truncated = true;
          break;
        }
        out.push(tx);
      }
      if (reachedStart || truncated || page.length < PAGE_SIZE) break;
      lastTxid = page[page.length - 1]!.txid;
    }
    out.sort((a, b) => a.timestamp - b.timestamp || (a.txid < b.txid ? -1 : 1));
    return { txs: out, truncated };
  }

  async getTransfers(address: string, query: TransferQuery = {}): Promise<TransferPage> {
    const addr = this.normalizeAddress(address);
    const { txs, truncated } = await this.getTransactions(addr, query);
    const transfers = txs
      .flatMap((tx) => utxoToTransfers(tx, this.chain.nativeAsset, this.sourceId))
      .filter((t) => t.from === addr || t.to === addr);
    return { transfers, truncated };
  }

  private toUtxoTx(raw: EsploraTx): UtxoTransaction {
    const isCoinbase = raw.vin.some((v) => v.is_coinbase);
    return {
      chain: this.chain.id,
      txid: raw.txid,
      timestamp: raw.status.block_time ?? 0,
      blockHeight: raw.status.block_height,
      fee: BigInt(raw.fee ?? 0),
      isCoinbase,
      inputs: isCoinbase
        ? []
        : raw.vin.map((v) => ({
            address: v.prevout?.scriptpubkey_address ? normalizeBitcoinAddress(v.prevout.scriptpubkey_address) : undefined,
            value: BigInt(v.prevout?.value ?? 0),
            prevTxid: v.txid,
            prevVout: v.vout,
            scriptType: v.prevout?.scriptpubkey_type,
          })),
      outputs: raw.vout.map((o) => ({
        address: o.scriptpubkey_address ? normalizeBitcoinAddress(o.scriptpubkey_address) : undefined,
        value: BigInt(o.value),
        scriptType: o.scriptpubkey_type,
      })),
    };
  }
}
