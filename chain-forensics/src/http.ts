import type { InvestigationContext } from "./audit.js";
import { sha256Hex } from "./util/hash.js";

/**
 * Minimal fetch abstraction so the core runs on Node, Electron (Windows) and
 * React Native (Android) alike, and so tests can inject a fake.
 */
export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  status: number;
  ok: boolean;
  text(): Promise<string>;
}>;

export interface HttpClientOptions {
  fetch?: FetchLike;
  /** Minimum milliseconds between requests (per client). Respect provider rate limits / ToS. */
  minIntervalMs?: number;
  retries?: number;
  /** Query-string parameter names whose values must never be written to the audit log. */
  secretParams?: string[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export class HttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    body: string,
  ) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
  }
}

const DEFAULT_SECRET_PARAMS = ["apikey", "api_key", "key", "token", "access_token"];

export function redactUrl(url: string, secretParams: string[] = DEFAULT_SECRET_PARAMS): string {
  const lower = new Set(secretParams.map((p) => p.toLowerCase()));
  return url.replace(/([?&])([^=&#]+)=([^&#]*)/g, (m, sep: string, k: string) =>
    lower.has(decodeURIComponent(k).toLowerCase()) ? `${sep}${k}=REDACTED` : m,
  );
}

/**
 * HTTP client that records every request in the audit log together with the
 * SHA-256 of the raw response body. That hash lets anyone later prove which
 * exact data an analysis was based on.
 */
export class HttpClient {
  private readonly fetchFn: FetchLike;
  private readonly minIntervalMs: number;
  private readonly retries: number;
  private readonly secretParams: string[];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private lastRequestAt = -Infinity;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly ctx: InvestigationContext,
    private readonly sourceId: string,
    opts: HttpClientOptions = {},
  ) {
    const f = opts.fetch ?? (globalThis.fetch as unknown as FetchLike | undefined);
    if (!f) throw new Error("No fetch implementation available");
    this.fetchFn = f;
    this.minIntervalMs = opts.minIntervalMs ?? 250;
    this.retries = opts.retries ?? 2;
    this.secretParams = opts.secretParams ?? DEFAULT_SECRET_PARAMS;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? (() => Date.now());
  }

  /** GET and parse JSON. Requests are serialized to honour the rate limit. */
  getJson<T>(url: string): Promise<T> {
    const run = this.queue.then(() => this.doGet<T>(url));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async doGet<T>(url: string): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const wait = this.lastRequestAt + this.minIntervalMs - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastRequestAt = this.now();
      try {
        const res = await this.fetchFn(url, { headers: { accept: "application/json" } });
        const body = await res.text();
        this.ctx.audit.append(this.ctx.caseId, this.ctx.actor, "http.get", {
          source: this.sourceId,
          url: redactUrl(url, this.secretParams),
          status: res.status,
          bytes: body.length,
          responseSha256: sha256Hex(body),
          attempt,
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new HttpError(url, res.status, body);
          await this.sleep(this.minIntervalMs * 2 ** (attempt + 1));
          continue;
        }
        if (!res.ok) throw new HttpError(redactUrl(url, this.secretParams), res.status, body);
        return JSON.parse(body) as T;
      } catch (err) {
        if (err instanceof HttpError && err.status < 500 && err.status !== 429) throw err;
        if (err instanceof SyntaxError) throw err;
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}
