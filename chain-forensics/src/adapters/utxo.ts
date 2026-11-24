import type { Asset, Transfer, UtxoTransaction } from "../model.js";

export const COINBASE = "coinbase";

/**
 * Convert a UTXO transaction into address→address transfers.
 *
 * A UTXO transaction has no inherent "from → to" pairing. When all inputs
 * belong to a single address the pairing is exact (attribution "direct").
 * With several input addresses each output is split across them in proportion
 * to their input value (attribution "proportional"); any rounding remainder
 * goes to the largest contributor so totals reconcile exactly.
 */
export function utxoToTransfers(tx: UtxoTransaction, asset: Asset, source: string): Transfer[] {
  const contributions = new Map<string, bigint>();
  if (tx.isCoinbase) {
    contributions.set(COINBASE, 1n);
  } else {
    for (const inp of tx.inputs) {
      const a = inp.address ?? `unknown:${inp.prevTxid ?? "?"}:${inp.prevVout ?? "?"}`;
      contributions.set(a, (contributions.get(a) ?? 0n) + inp.value);
    }
  }
  const senders = [...contributions.entries()].sort((x, y) => (y[1] > x[1] ? 1 : y[1] < x[1] ? -1 : x[0] < y[0] ? -1 : 1));
  const totalIn = senders.reduce((s, [, v]) => s + v, 0n);
  const attribution = senders.length === 1 ? "direct" : "proportional";

  const transfers: Transfer[] = [];
  tx.outputs.forEach((out, vout) => {
    if (!out.address || out.value === 0n) return; // OP_RETURN / non-standard
    let allocated = 0n;
    const shares = senders.map(([addr, v], i) => {
      let share = i === 0 ? 0n : totalIn === 0n ? 0n : (out.value * v) / totalIn;
      allocated += share;
      return { addr, share };
    });
    shares[0]!.share = out.value - allocated;
    shares.forEach(({ addr, share }, inIdx) => {
      if (share === 0n) return;
      transfers.push({
        id: `${tx.chain}:${tx.txid}:out:${vout}/in:${inIdx}`,
        chain: tx.chain,
        txHash: tx.txid,
        position: `out:${vout}/in:${inIdx}`,
        from: addr,
        to: out.address!,
        asset,
        amount: share,
        timestamp: tx.timestamp,
        blockNumber: tx.blockHeight,
        kind: "utxo",
        attribution,
        source,
      });
    });
  });
  return transfers;
}
