import { describe, expect, it } from "vitest";
import { AuditLog, verifyAuditChain } from "../src/audit.js";
import { HttpClient, redactUrl } from "../src/http.js";
import { fakeFetch, fixedClock, makeCtx, noSleep } from "./helpers.js";

describe("audit log", () => {
  it("builds a verifiable hash chain", () => {
    const log = new AuditLog({ clock: fixedClock });
    log.append("C1", "a", "x", { n: 1n });
    log.append("C1", "a", "y");
    log.append("C2", "b", "z");
    expect(log.verify()).toEqual({ valid: true });
    expect(log.forCase("C1")).toHaveLength(2);
    expect(log.all()[1]!.prevHash).toBe(log.all()[0]!.hash);
  });

  it("detects tampering, deletion and reordering", () => {
    const log = new AuditLog({ clock: fixedClock });
    for (let i = 0; i < 4; i++) log.append("C1", "a", `step${i}`);
    const entries = log.all().map((e) => ({ ...e, details: { ...e.details } }));

    const edited = entries.map((e) => ({ ...e }));
    edited[1]!.action = "something-else";
    expect(verifyAuditChain(edited)).toMatchObject({ valid: false, brokenAt: 1 });

    const removed = [...entries.slice(0, 1), ...entries.slice(2)];
    expect(verifyAuditChain(removed).valid).toBe(false);

    const swapped = [entries[0]!, entries[2]!, entries[1]!, entries[3]!];
    expect(verifyAuditChain(swapped).valid).toBe(false);
  });

  it("requires a case id and actor", () => {
    const log = new AuditLog();
    expect(() => log.append("", "a", "x")).toThrow(/caseId/);
    expect(() => log.append("C", "", "x")).toThrow(/actor/);
  });

  it("can continue a stored chain and refuses a corrupted one", () => {
    const log = new AuditLog({ clock: fixedClock });
    log.append("C1", "a", "x");
    const resumed = new AuditLog({ clock: fixedClock, existing: [...log.all()] });
    resumed.append("C1", "a", "y");
    expect(resumed.verify().valid).toBe(true);
    const bad = [{ ...log.all()[0]!, actor: "mallory" }];
    expect(() => new AuditLog({ existing: bad })).toThrow(/invalid/);
  });
});

describe("http client", () => {
  it("redacts secrets from URLs", () => {
    expect(redactUrl("https://x/api?module=a&apikey=SECRET&b=1")).toBe("https://x/api?module=a&apikey=REDACTED&b=1");
    expect(redactUrl("https://x/api?token=abc")).toBe("https://x/api?token=REDACTED");
  });

  it("logs each request with response hash and never the api key", async () => {
    const ctx = makeCtx();
    const f = fakeFetch([["/ok", { hello: "world" }]]);
    const http = new HttpClient(ctx, "test", { fetch: f, ...noSleep });
    expect(await http.getJson("https://h/ok?apikey=SECRET")).toEqual({ hello: "world" });
    const e = ctx.audit.all()[0]!;
    expect(e.action).toBe("http.get");
    expect(e.details.url).toBe("https://h/ok?apikey=REDACTED");
    expect(e.details.responseSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ctx.audit.all())).not.toContain("SECRET");
  });

  it("retries on 429/5xx and fails fast on 4xx", async () => {
    const ctx = makeCtx();
    let n = 0;
    const flaky = async () => {
      n++;
      return n < 3
        ? { status: 503, ok: false, text: async () => "busy" }
        : { status: 200, ok: true, text: async () => "[1]" };
    };
    const http = new HttpClient(ctx, "t", { fetch: flaky, ...noSleep, retries: 3 });
    expect(await http.getJson("https://h/x")).toEqual([1]);
    expect(n).toBe(3);

    const http2 = new HttpClient(ctx, "t", { fetch: fakeFetch([]), ...noSleep });
    await expect(http2.getJson("https://h/missing?apikey=K")).rejects.toThrow(/HTTP 404 .*apikey=REDACTED/);
  });
});
