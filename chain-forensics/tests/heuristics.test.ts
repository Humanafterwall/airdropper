import { describe, expect, it } from "vitest";
import { assessCoinJoin, clusterByCommonInputs, detectChangeOutput } from "../src/heuristics/utxo.js";
import type { UtxoTransaction } from "../src/model.js";

const tx = (txid: string, ins: [string, bigint, string?][], outs: [string, bigint, string?][]): UtxoTransaction => ({
  chain: "bitcoin", txid, timestamp: 0, fee: 0n, isCoinbase: false,
  inputs: ins.map(([address, value, scriptType]) => ({ address, value, scriptType })),
  outputs: outs.map(([address, value, scriptType]) => ({ address, value, scriptType })),
});

describe("CoinJoin detection", () => {
  it("flags many equal outputs from many inputs", () => {
    const cj = tx("cj", [["a", 6n], ["b", 6n], ["c", 6n], ["d", 6n]], [["w", 5n], ["x", 5n], ["y", 5n], ["z", 5n], ["ch", 3n]]);
    expect(assessCoinJoin(cj)).toMatchObject({ likelyCoinJoin: true, equalOutputCount: 4, denomination: 5n });
    expect(assessCoinJoin(tx("n", [["a", 10n]], [["b", 5n], ["c", 4n]])).likelyCoinJoin).toBe(false);
  });
});

describe("common-input clustering", () => {
  it("links co-spent addresses transitively and skips CoinJoins", () => {
    const res = clusterByCommonInputs([
      tx("t1", [["a", 1n], ["b", 1n]], [["x", 2n]]),
      tx("t2", [["b", 1n], ["c", 1n]], [["y", 2n]]),
      tx("t3", [["d", 1n]], [["z", 1n]]),
      tx("cj", [["c", 6n], ["e", 6n], ["f", 6n]], [["p", 5n], ["q", 5n], ["r", 5n]]),
    ]);
    expect(res.clusters).toEqual([{ id: "cluster:a", addresses: ["a", "b", "c"], evidenceTxids: ["t1", "t2"] }]);
    expect(res.excludedTxids).toEqual(["cj"]);
  });
});

describe("change detection", () => {
  it("address reuse is strongest signal", () => {
    const r = detectChangeOutput(tx("t", [["a", 1_000_000n, "p2wpkh"]], [["b", 300_000n, "p2wpkh"], ["a", 690_000n, "p2wpkh"]]));
    expect(r).toMatchObject({ outputIndex: 1, address: "a" });
    expect(r!.reasons[0]).toMatch(/address reuse/);
  });

  it("combines script type and round amount", () => {
    const r = detectChangeOutput(tx("t", [["a", 1_000_000n, "p2wpkh"]], [["pay", 500_000n, "p2pkh"], ["chg", 499_123n, "p2wpkh"]]));
    expect(r).toMatchObject({ outputIndex: 1, address: "chg", confidence: 0.6 });
    expect(r!.reasons).toHaveLength(2);
  });

  it("returns null when ambiguous", () => {
    expect(detectChangeOutput(tx("t", [["a", 10n, "p2wpkh"]], [["b", 3n, "p2wpkh"], ["c", 4n, "p2wpkh"]]))).toBeNull();
  });
});
