import { describe, expect, it } from "vitest";
import { bitcoinAddressType, isValidEvmAddress, toEvmChecksumAddress } from "../src/util/address.js";

describe("bitcoin address validation", () => {
  it.each([
    ["1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "p2pkh"],
    ["3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "p2sh"],
    ["bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", "p2wpkh"],
    ["BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4", "p2wpkh"],
    ["bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3", "p2wsh"],
    ["bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0", "p2tr"],
  ])("%s is %s", (addr, type) => {
    expect(bitcoinAddressType(addr)).toBe(type);
  });

  it.each([
    "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3", // bad checksum
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5", // bad bech32 checksum
    "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd", // taproot with corrupted checksum
    "bc1qW508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", // mixed case
    "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    "",
  ])("%s is invalid", (addr) => {
    expect(bitcoinAddressType(addr)).toBeNull();
  });

  it("distinguishes testnet", () => {
    expect(bitcoinAddressType("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", "testnet")).toBe("p2wpkh");
    expect(bitcoinAddressType("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", "mainnet")).toBeNull();
  });
});

describe("EVM address validation (EIP-55)", () => {
  it("accepts correct checksums and all-lower/upper", () => {
    for (const a of [
      "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
      "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
      "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
      "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
    ]) {
      expect(isValidEvmAddress(a)).toBe(true);
    }
  });
  it("rejects wrong checksum and bad shapes", () => {
    expect(isValidEvmAddress("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD")).toBe(false);
    expect(isValidEvmAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1bea")).toBe(false);
    expect(isValidEvmAddress("5aaeb6053f3e94c9b9a09f33669435e7ef1beaed")).toBe(false);
  });
  it("computes checksum", () => {
    expect(toEvmChecksumAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed")).toBe("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
  });
});
