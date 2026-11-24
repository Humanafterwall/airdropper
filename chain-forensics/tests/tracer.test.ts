import { describe, expect, it } from "vitest";
import { AdapterRegistry } from "../src/adapters/registry.js";
import { CHAINS } from "../src/chains.js";
import { LabelStore, parseOfacSdnAddresses } from "../src/labels.js";
import { buildCaseReport, verifyCaseReport } from "../src/report.js";
import { assessRisk } from "../src/risk.js";
import { traceFunds } from "../src/tracer.js";
import { MemoryAdapter, makeCtx, tr } from "./helpers.js";

const eth = CHAINS.ethereum;

/**
 *  victim ──(t=10, 100)──▶ thief ──(t=20, 60)──▶ hop1a ──(t=30, 60)──▶ EXCHANGE ──▶ exchUser (t=40)
 *                            │                     └──(t=5, 1)  ◀── (pre-dates arrival)  noise
 *                            └──(t=25, 40)──▶ hop1b ──(t=35, 40)──▶ MIXER
 *                                               └──(t=36, 1)──▶ dust
 *  thief ◀──(t=1, 3)── funder
 */
function scenario() {
  const transfers = [
    tr(eth, "victim", "thief", 100n, 10),
    tr(eth, "funder", "thief", 3n, 1),
    tr(eth, "thief", "hop1a", 60n, 20),
    tr(eth, "thief", "hop1b", 40n, 25),
    tr(eth, "hop1a", "noise", 1n, 5),
    tr(eth, "hop1a", "exchange", 60n, 30),
    tr(eth, "exchange", "exchuser", 60n, 40),
    tr(eth, "hop1b", "mixer", 39n, 35),
    tr(eth, "hop1b", "dust", 1n, 36),
  ];
  const adapter = new MemoryAdapter(eth, transfers);
  const registry = new AdapterRegistry().register(adapter);
  const labels = new LabelStore([
    { chain: "ethereum", address: "exchange", entity: "Example Exchange", category: "exchange", source: "analyst", confidence: 0.9 },
    { chain: "evm", address: "mixer", entity: "Example Mixer", category: "mixer", source: "public list", confidence: 1 },
  ]);
  return { adapter, registry, labels };
}

describe("traceFunds", () => {
  it("follows funds forward, respects time, stops at labeled services", async () => {
    const { adapter, registry, labels } = scenario();
    const ctx = makeCtx();
    const r = await traceFunds({ chain: "ethereum", address: "THIEF" }, registry, labels, ctx, { direction: "forward", maxHops: 5 });

    expect([...r.graph.nodes.keys()].sort()).toEqual(
      ["dust", "exchange", "hop1a", "hop1b", "mixer", "thief"].map((a) => `ethereum:${a}`),
    );
    expect(r.graph.nodes.has("ethereum:noise")).toBe(false); // left hop1a before funds arrived
    expect(r.graph.nodes.has("ethereum:exchuser")).toBe(false); // not followed past exchange
    expect(r.endpoints.map((e) => e.address).sort()).toEqual(["exchange", "mixer"]);
    expect(r.graph.nodes.get("ethereum:exchange")!.stopReason).toBe("labeled_entity");
    expect(adapter.calls).not.toContain("exchange");
    expect(r.graph.nodes.get("ethereum:mixer")!.labels[0]!.entity).toBe("Example Mixer"); // evm-wide label
    expect(r.incomplete).toBe(false);

    const actions = ctx.audit.all().map((e) => e.action);
    expect(actions).toEqual(["trace.start", "trace.end"]);
    expect(ctx.audit.verify().valid).toBe(true);
  });

  it("without time constraint, includes earlier transfers", async () => {
    const { registry, labels } = scenario();
    const r = await traceFunds({ chain: "ethereum", address: "thief" }, registry, labels, makeCtx(), { direction: "forward", respectTime: false });
    expect(r.graph.nodes.has("ethereum:noise")).toBe(true);
  });

  it("applies min amount and max hops", async () => {
    const { registry, labels } = scenario();
    const r = await traceFunds({ chain: "ethereum", address: "thief" }, registry, labels, makeCtx(), {
      direction: "forward", maxHops: 1, minAmount: () => 2n,
    });
    expect([...r.graph.nodes.keys()].sort()).toEqual(["ethereum:hop1a", "ethereum:hop1b", "ethereum:thief"]);
    expect(r.graph.nodes.get("ethereum:hop1a")!.stopReason).toBe("max_hops");
    expect(r.incomplete).toBe(true);
  });

  it("traces backward to the source of funds", async () => {
    const { registry, labels } = scenario();
    const r = await traceFunds({ chain: "ethereum", address: "exchange" }, registry, labels, makeCtx(), { direction: "backward", maxHops: 4 });
    // exchange ← hop1a (t30) ← thief (t20) ← victim(t10), funder(t1)
    expect([...r.graph.nodes.keys()].sort()).toEqual(
      ["exchange", "funder", "hop1a", "thief", "victim"].map((a) => `ethereum:${a}`),
    );
  });

  it("does not expand addresses with oversized history (likely services)", async () => {
    const { labels } = scenario();
    const adapter = new MemoryAdapter(eth, scenario().adapter["transfers"], new Set(["hop1a"]));
    const registry = new AdapterRegistry().register(adapter);
    const r = await traceFunds({ chain: "ethereum", address: "thief" }, registry, labels, makeCtx(), { direction: "forward" });
    expect(r.graph.nodes.get("ethereum:hop1a")!.stopReason).toBe("too_many_transactions");
    expect(r.graph.nodes.has("ethereum:exchange")).toBe(false);
    expect(r.incomplete).toBe(true);
  });

  it("records fetch errors instead of failing the whole trace", async () => {
    const { adapter, labels } = scenario();
    const orig = adapter.getTransfers.bind(adapter);
    adapter.getTransfers = async (a, q) => (a === "hop1b" ? Promise.reject(new Error("timeout")) : orig(a, q));
    const r = await traceFunds({ chain: "ethereum", address: "thief" }, new AdapterRegistry().register(adapter), labels, makeCtx(), { direction: "forward" });
    expect(r.graph.nodes.get("ethereum:hop1b")).toMatchObject({ stopReason: "fetch_error", error: "timeout" });
    expect(r.endpoints.map((e) => e.address)).toEqual(["exchange"]);
  });
});

describe("risk + report", () => {
  it("scores exposure explainably and produces a verifiable report", async () => {
    const { registry, labels } = scenario();
    const ctx = makeCtx();
    const trace = await traceFunds({ chain: "ethereum", address: "thief" }, registry, labels, ctx, { direction: "forward" });
    const risk = assessRisk(trace);

    expect(risk.contributions.map((c) => [c.entity, c.hop, c.weight])).toEqual([
      ["Example Mixer", 2, 0.4],
      ["Example Exchange", 2, 0.045],
    ]);
    expect(risk.contributions[0]!.amounts).toEqual([{ asset: "ethereum:native", symbol: "ETH", amount: "0.000000000000000039" }]);
    expect(risk.score).toBe(43);
    expect(risk.level).toBe("medium");

    const report = buildCaseReport({ caseId: ctx.caseId, actor: ctx.actor, trace, risk, audit: ctx.audit, now: new Date("2026-01-02T00:00:00Z") });
    expect(verifyCaseReport(report)).toBe(true);
    expect(report.auditHead).toBe(ctx.audit.head());
    expect(JSON.parse(JSON.stringify(report)).graph.edges[0].amount).toMatch(/^\d+$/);
    expect(verifyCaseReport({ ...report, incomplete: !report.incomplete })).toBe(false);
  });

  it("sanctioned subject is severe", async () => {
    const { registry } = scenario();
    const labels = new LabelStore(parseOfacSdnAddresses(
      "...Digital Currency Address - ETH thief; Digital Currency Address - XBT 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2; Digital Currency Address - FOO abc;",
    ));
    expect(labels.size()).toBe(2);
    const trace = await traceFunds({ chain: "ethereum", address: "thief" }, registry, labels, makeCtx(), { direction: "forward", maxHops: 1 });
    expect(assessRisk(trace)).toMatchObject({ score: 100, level: "severe" });
  });
});
