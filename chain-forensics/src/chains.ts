import type { ChainInfo } from "./model.js";

const evm = (id: string, name: string, evmChainId: number, symbol: string): ChainInfo => ({
  id,
  name,
  family: "evm",
  evmChainId,
  nativeAsset: { chain: id, symbol, decimals: 18 },
});

const utxo = (id: string, name: string, symbol: string): ChainInfo => ({
  id,
  name,
  family: "utxo",
  nativeAsset: { chain: id, symbol, decimals: 8 },
});

/** Built-in chain definitions. More can be registered at runtime. */
export const CHAINS = {
  bitcoin: utxo("bitcoin", "Bitcoin", "BTC"),
  bitcoinTestnet: utxo("bitcoin-testnet", "Bitcoin Testnet", "tBTC"),
  ethereum: evm("ethereum", "Ethereum", 1, "ETH"),
  bsc: evm("bsc", "BNB Smart Chain", 56, "BNB"),
  polygon: evm("polygon", "Polygon PoS", 137, "POL"),
  arbitrum: evm("arbitrum", "Arbitrum One", 42161, "ETH"),
  optimism: evm("optimism", "OP Mainnet", 10, "ETH"),
  base: evm("base", "Base", 8453, "ETH"),
  avalanche: evm("avalanche", "Avalanche C-Chain", 43114, "AVAX"),
} as const satisfies Record<string, ChainInfo>;
