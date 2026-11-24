import { canonicalJson, sha256Hex } from "./util/hash.js";

/**
 * Tamper-evident, append-only audit log.
 *
 * Every entry contains the hash of the previous entry, so changing, removing
 * or reordering any entry breaks verification of everything after it.
 * Persist entries (e.g. to a database or WORM storage) via the `sink` callback.
 */

export interface AuditEntry {
  seq: number;
  timestamp: string; // ISO-8601 UTC
  caseId: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH = "0".repeat(64);

export interface AuditLogOptions {
  clock?: () => Date;
  sink?: (entry: AuditEntry) => void;
  /** Continue an existing chain (e.g. loaded from storage). Verified on construction. */
  existing?: AuditEntry[];
}

export class AuditLog {
  private readonly entries: AuditEntry[] = [];
  private readonly clock: () => Date;
  private readonly sink?: (entry: AuditEntry) => void;

  constructor(opts: AuditLogOptions = {}) {
    this.clock = opts.clock ?? (() => new Date());
    this.sink = opts.sink;
    if (opts.existing?.length) {
      const res = verifyAuditChain(opts.existing);
      if (!res.valid) throw new Error(`Existing audit chain invalid at seq ${res.brokenAt}: ${res.reason}`);
      this.entries.push(...opts.existing);
    }
  }

  append(caseId: string, actor: string, action: string, details: Record<string, unknown> = {}): AuditEntry {
    if (!caseId) throw new Error("caseId is required for every audited action");
    if (!actor) throw new Error("actor is required for every audited action");
    const prev = this.entries[this.entries.length - 1];
    const body = {
      seq: prev ? prev.seq + 1 : 0,
      timestamp: this.clock().toISOString(),
      caseId,
      actor,
      action,
      details: JSON.parse(canonicalJson(details)) as Record<string, unknown>,
      prevHash: prev ? prev.hash : GENESIS_HASH,
    };
    const entry: AuditEntry = { ...body, hash: sha256Hex(canonicalJson(body)) };
    this.entries.push(entry);
    this.sink?.(entry);
    return entry;
  }

  all(): readonly AuditEntry[] {
    return this.entries;
  }

  forCase(caseId: string): AuditEntry[] {
    return this.entries.filter((e) => e.caseId === caseId);
  }

  head(): string {
    return this.entries[this.entries.length - 1]?.hash ?? GENESIS_HASH;
  }

  verify(): AuditVerification {
    return verifyAuditChain(this.entries);
  }
}

export interface AuditVerification {
  valid: boolean;
  brokenAt?: number;
  reason?: string;
}

export function verifyAuditChain(entries: readonly AuditEntry[]): AuditVerification {
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.seq !== i) return { valid: false, brokenAt: i, reason: "sequence gap or reorder" };
    if (e.prevHash !== prevHash) return { valid: false, brokenAt: i, reason: "prevHash mismatch" };
    const { hash, ...body } = e;
    if (sha256Hex(canonicalJson(body)) !== hash) return { valid: false, brokenAt: i, reason: "content hash mismatch" };
    prevHash = hash;
  }
  return { valid: true };
}

/** Who is acting, for which case. Required by every network-touching component. */
export interface InvestigationContext {
  caseId: string;
  actor: string;
  audit: AuditLog;
}
