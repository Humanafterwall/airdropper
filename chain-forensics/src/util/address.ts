import { keccak_256, sha256, bytesToHex, utf8ToBytes } from "./hash.js";

// ---------------------------------------------------------------- base58check

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(s: string): Uint8Array | null {
  let n = 0n;
  for (const c of s) {
    const v = B58.indexOf(c);
    if (v < 0) return null;
    n = n * 58n + BigInt(v);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** Returns the version byte if `s` is a valid base58check string with a 20-byte payload. */
export function base58CheckVersion(s: string): number | null {
  const raw = base58Decode(s);
  if (!raw || raw.length !== 25) return null;
  const payload = raw.slice(0, 21);
  const check = sha256(sha256(payload)).slice(0, 4);
  for (let i = 0; i < 4; i++) if (check[i] !== raw[21 + i]) return null;
  return payload[0]!;
}

// ------------------------------------------------------------ bech32 / bech32m

const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

function polymod(values: number[]): number {
  const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= G[i]!;
  }
  return chk >>> 0;
}

const hrpExpand = (hrp: string): number[] => [
  ...[...hrp].map((c) => c.charCodeAt(0) >> 5),
  0,
  ...[...hrp].map((c) => c.charCodeAt(0) & 31),
];

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const maxv = (1 << to) - 1;
  for (const v of data) {
    if (v >> from) return null;
    acc = (acc << from) | v;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits) out.push((acc << (to - bits)) & maxv);
  } else if (bits >= from || ((acc << (to - bits)) & maxv)) {
    return null;
  }
  return out;
}

/** Decode a SegWit address (BIP-173 / BIP-350). Returns null if invalid. */
export function decodeSegwit(addr: string, expectedHrp: string): { version: number; program: Uint8Array } | null {
  if (addr.length > 90) return null;
  if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) return null;
  const s = addr.toLowerCase();
  const pos = s.lastIndexOf("1");
  if (pos < 1 || pos + 7 > s.length) return null;
  const hrp = s.slice(0, pos);
  if (hrp !== expectedHrp) return null;
  const data: number[] = [];
  for (const c of s.slice(pos + 1)) {
    const v = BECH32.indexOf(c);
    if (v < 0) return null;
    data.push(v);
  }
  const constant = polymod([...hrpExpand(hrp), ...data]);
  const version = data[0]!;
  if (version > 16) return null;
  if (version === 0 && constant !== BECH32_CONST) return null;
  if (version !== 0 && constant !== BECH32M_CONST) return null;
  const program = convertBits(data.slice(1, -6), 5, 8, false);
  if (!program || program.length < 2 || program.length > 40) return null;
  if (version === 0 && program.length !== 20 && program.length !== 32) return null;
  return { version, program: Uint8Array.from(program) };
}

// ------------------------------------------------------------------- Bitcoin

export type BitcoinNetwork = "mainnet" | "testnet";
export type BitcoinAddressType = "p2pkh" | "p2sh" | "p2wpkh" | "p2wsh" | "p2tr" | "witness_unknown";

export function bitcoinAddressType(addr: string, network: BitcoinNetwork = "mainnet"): BitcoinAddressType | null {
  const hrp = network === "mainnet" ? "bc" : "tb";
  if (addr.toLowerCase().startsWith(hrp + "1")) {
    const sw = decodeSegwit(addr, hrp);
    if (!sw) return null;
    if (sw.version === 0) return sw.program.length === 20 ? "p2wpkh" : "p2wsh";
    if (sw.version === 1 && sw.program.length === 32) return "p2tr";
    return "witness_unknown";
  }
  const v = base58CheckVersion(addr);
  if (v === null) return null;
  if (network === "mainnet") return v === 0x00 ? "p2pkh" : v === 0x05 ? "p2sh" : null;
  return v === 0x6f ? "p2pkh" : v === 0xc4 ? "p2sh" : null;
}

/** Bech32 addresses are case-insensitive; store them lowercase. Base58 is case-sensitive. */
export function normalizeBitcoinAddress(addr: string): string {
  const t = addr.trim();
  return /^(bc|tb)1/i.test(t) ? t.toLowerCase() : t;
}

// ----------------------------------------------------------------------- EVM

export function toEvmChecksumAddress(addr: string): string {
  const lower = addr.toLowerCase().replace(/^0x/, "");
  const hash = bytesToHex(keccak_256(utf8ToBytes(lower)));
  let out = "0x";
  for (let i = 0; i < 40; i++) {
    out += parseInt(hash[i]!, 16) >= 8 ? lower[i]!.toUpperCase() : lower[i]!;
  }
  return out;
}

/** Valid if 0x + 40 hex; when mixed-case, the EIP-55 checksum must also match. */
export function isValidEvmAddress(addr: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return false;
  const body = addr.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  return toEvmChecksumAddress(addr) === addr;
}

export const normalizeEvmAddress = (addr: string): string => addr.trim().toLowerCase();
