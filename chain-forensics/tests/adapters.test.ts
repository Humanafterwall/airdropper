import { describe, expect, it } from "vitest";
import { EsploraBitcoinAdapter } from "../src/adapters/bitcoin.js";
import { EtherscanEvmAdapter } from "../src/adapters/evm.js";
import { AdapterRegistry } from "../src/adapters/registry.js";
import { utxoToTransfers } from "../src/adapters/utxo.js";
import { CHAINS } from "../src/chains.js";
import type { UtxoTransaction } from "../src/model.js";
import { fakeFetch, makeCtx, noSleep } from "./helpers.js";

const A = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const B = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";
const C = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy";

describe("utxoToTransfers", () => {
  const base: Omit<UtxoTransaction, "inputs" | "outputs"> = {
    chain: "bitcoin", txid: "t1", timestamp: 100, fee: 1000n, isCoinbase: false,
  };

  it("single input address → direct transfers", () => {
    const tx = { ...base, inputs: [{ address: A, value: 10_000n }, { address: A, value: 5_000n }],
      outputs: [{ address: B, value: 9_000n }, { address: A, value: 5_000n }] };
    const ts = utxoToTransfers(tx, CHAINS.bitcoin.nativeAsset, "s");
    expect(ts.map((t) => [t.from, t.to, t.amount, t.attribution])).toEqual([
      [A, B, 9_000n, "direct"],
      [A, A, 5_000n, "direct"],
    ]);
  });

  it("multiple input addresses → proportional split that reconciles exactly", () => {
    const tx = { ...base, inputs: [{ address: A, value: 2n }, { address: B, value: 1n }],
      outputs: [{ address: C, value: 100n }, { value: 0n }] };
    const ts = utxoToTransfers(tx, CHAINS.bitcoin.nativeAsset, "s");
    expect(ts.every((t) => t.attribution === "proportional")).toBe(true);
    expect(ts.find((t) => t.from === A)!.amount).toBe(67n);
    expect(ts.find((t) => t.from === B)!.amount).toBe(33n);
    expect(ts.reduce((s, t) => s + t.amount, 0n)).toBe(100n);
    expect(new Set(ts.map((t) => t.id)).size).toBe(ts.length);
  });

  it("coinbase", () => {
    const ts = utxoToTransfers({ ...base, isCoinbase: true, inputs: [], outputs: [{ address: A, value: 50n }] },
      CHAINS.bitcoin.nativeAsset, "s");
    expect(ts).toMatchObject([{ from: "coinbase", to: A, amount: 50n, attribution: "direct" }]);
  });
});

const esploraTx = (txid: string, time: number, vin: [string, number, string][], vout: [string, number, string][]) => ({
  txid, fee: 100,
  vin: vin.map(([a, v, t]) => ({ txid: "prev", vout: 0, is_coinbase: false, prevout: { scriptpubkey_address: a, value: v, scriptpubkey_type: t } })),
  vout: vout.map(([a, v, t]) => ({ scriptpubkey_address: a, value: v, scriptpubkey_type: t })),
  status: { confirmed: true, block_height: 800000, block_time: time },
});

describe("EsploraBitcoinAdapter", () => {
  it("reads and paginates address history, filters by time", async () => {
    const page1 = Array.from({ length: 25 }, (_, i) => esploraTx(`n${i}`, 2000 - i, [[A, 1000, "v0_p2wpkh"]], [[B, 900, "p2pkh"]]));
    const page2 = [esploraTx("old", 500, [[C, 5000, "p2sh"]], [[A, 4900, "v0_p2wpkh"]])];
    const f = fakeFetch([[`/txs/chain/n24`, page2], [`/address/${A}/txs/chain`, page1]]);
    const btc = new EsploraBitcoinAdapter(makeCtx(), { baseUrl: "https://esplora.local/api/", fetch: f, ...noSleep });

    const all = await btc.getTransfers(A);
    expect(f.calls).toHaveLength(2);
    expect(all.transfers).toHaveLength(26);
    expect(all.transfers[0]).toMatchObject({ txHash: "old", from: C, to: A, amount: 4900n, source: "esplora:esplora.local" });

    const recent = await btc.getTransactions(A, { fromTime: 1990 });
    expect(recent.txs.map((t) => t.timestamp)).toEqual([1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000]);

    const capped = await btc.getTransactions(A, { maxTransactions: 5 });
    expect(capped).toMatchObject({ truncated: true });
    expect(capped.txs).toHaveLength(5);
  });

  it("rejects invalid addresses before any network call", async () => {
    const f = fakeFetch([]);
    const btc = new EsploraBitcoinAdapter(makeCtx(), { baseUrl: "https://e/api", fetch: f, ...noSleep });
    await expect(btc.getTransfers("not-an-address")).rejects.toThrow(/Invalid/);
    expect(f.calls).toHaveLength(0);
  });
});

describe("EtherscanEvmAdapter", () => {
  const X = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
  const x = X.toLowerCase();
  const y = "0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359";
  const usdt = "0xdac17f958d2ee523a2206206994597c13d831ec7";

  const routes = (): Parameters<typeof fakeFetch>[0] => [
    ["action=txlistinternal", { status: "1", message: "OK", result: [
      { hash: "0xI", from: y, to: x, value: "5", timeStamp: "30", blockNumber: "3", isError: "0", traceId: "0_1" },
    ] }],
    ["action=txlist", { status: "1", message: "OK", result: [
      { hash: "0xA", from: x, to: y, value: "1000000000000000000", timeStamp: "10", blockNumber: "1", isError: "0" },
      { hash: "0xF", from: x, to: y, value: "7", timeStamp: "11", blockNumber: "1", isError: "1" },
      { hash: "0xZ", from: x, to: y, value: "0", timeStamp: "12", blockNumber: "1", isError: "0" },
      { hash: "0xC", from: x, to: "", value: "0", timeStamp: "13", blockNumber: "1", isError: "0" },
    ] }],
    ["action=tokentx", { status: "0", message: "No transactions found", result: [] }],
  ];

  it("normalizes native, internal and token transfers", async () => {
    const f = fakeFetch(routes());
    const eth = new EtherscanEvmAdapter(makeCtx(), { chain: CHAINS.ethereum, apiKey: "K", fetch: f, ...noSleep });
    const { transfers } = await eth.getTransfers(X);
    expect(transfers.map((t) => [t.txHash, t.kind, t.amount])).toEqual([
      ["0xa", "native", 10n ** 18n],
      ["0xi", "internal", 5n],
    ]);
    expect(f.calls.every((u) => u.includes("chainid=1"))).toBe(true);
  });

  it("parses ERC-20 transfers", async () => {
    const r = routes();
    r[2] = ["action=tokentx", { status: "1", message: "OK", result: [
      { hash: "0xT", from: y, to: x, value: "2500000", timeStamp: "40", blockNumber: "4", contractAddress: usdt.toUpperCase().replace("0X", "0x"), tokenSymbol: "USDT", tokenDecimal: "6", logIndex: "17" },
    ] }];
    const eth = new EtherscanEvmAdapter(makeCtx(), { chain: CHAINS.ethereum, apiKey: "K", fetch: fakeFetch(r), ...noSleep });
    const tok = (await eth.getTransfers(x)).transfers.find((t) => t.kind === "token")!;
    expect(tok).toMatchObject({ id: "ethereum:0xt:token:17", amount: 2_500_000n, asset: { symbol: "USDT", decimals: 6, contract: usdt } });
  });

  it("surfaces API errors", async () => {
    const r = routes();
    r[1] = ["action=txlist", { status: "0", message: "NOTOK", result: "Invalid API Key" }];
    const eth = new EtherscanEvmAdapter(makeCtx(), { chain: CHAINS.ethereum, apiKey: "K", fetch: fakeFetch(r), ...noSleep });
    await expect(eth.getTransfers(x)).rejects.toThrow(/Invalid API Key/);
  });
});

describe("AdapterRegistry", () => {
  it("detects which chains an address belongs to and caches histories", async () => {
    const ctx = makeCtx();
    const f = fakeFetch([["/txs/chain", []]]);
    const reg = new AdapterRegistry()
      .register(new EsploraBitcoinAdapter(ctx, { baseUrl: "https://e/api", fetch: f, ...noSleep }))
      .register(new EtherscanEvmAdapter(ctx, { chain: CHAINS.ethereum, apiKey: "K", fetch: f, ...noSleep }))
      .register(new EtherscanEvmAdapter(ctx, { chain: CHAINS.polygon, apiKey: "K", fetch: f, ...noSleep }));
    expect(reg.detectChains(A).map((c) => c.id)).toEqual(["bitcoin"]);
    expect(reg.detectChains("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed").map((c) => c.id)).toEqual(["ethereum", "polygon"]);

    await reg.getTransfers({ chain: "bitcoin", address: A });
    await reg.getTransfers({ chain: "bitcoin", address: A.toUpperCase() });
    expect(f.calls).toHaveLength(1);
  });
});
