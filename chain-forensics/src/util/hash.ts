import { sha256 } from "@noble/hashes/sha2";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export { sha256, keccak_256, bytesToHex, utf8ToBytes };

export const sha256Hex = (data: string | Uint8Array): string =>
  bytesToHex(sha256(typeof data === "string" ? utf8ToBytes(data) : data));

/**
 * Deterministic JSON: object keys sorted, bigint serialized as decimal string.
 * Used wherever a hash must be reproducible (audit log, reports).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Map) return normalize(Object.fromEntries(value));
  if (value instanceof Set) return [...value].map(normalize);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = normalize(v);
    }
    return out;
  }
  return value;
}
