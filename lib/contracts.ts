// ============================================================
// Airdropper V01.3 — Contract config for Polygon PoS
// ============================================================

// Polygon mainnet USDC (Circle native): 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
// Polygon Amoy testnet: deploy and set address
// PolygonScan: https://polygonscan.com

export const POLYGON_CHAIN_ID = 137;
export const POLYGON_AMOY_CHAIN_ID = 80002;

// ============================================================
// Project contract (Airdropper V01.3)
// ============================================================
export const PROJECT_CONTRACT = {
  // Deployed on Polygon Amoy testnet (2026-02-27)
  address: "0xcFEacFD2F5B3Ee260D567528853Fe13946Da401a",
  abi: [
    // ---- Read functions (views) ----
    { type: "function", name: "currentRoundId", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "getRoundInfo", inputs: [{ name: "roundId", type: "uint256" }], outputs: [{ name: "startTime", type: "uint256" }, { name: "minPoolSnap", type: "uint256" }, { name: "minTimeSnap", type: "uint32" }, { name: "entryPriceSnap", type: "uint256" }, { name: "totalPool", type: "uint256" }, { name: "totalEntries", type: "uint256" }, { name: "uniquePlayers", type: "uint256" }, { name: "isOpen", type: "bool" }, { name: "isEmergency", type: "bool" }, { name: "jackTriggered", type: "bool" }, { name: "winnersResolved", type: "bool" }], stateMutability: "view" },
    { type: "function", name: "jackpotBalance", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "devBalance", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "aggregatorBalance", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "cycleId", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "cycleTotalWeight", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "entriesOf", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "payoutOf", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "payoutClaimed", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
    { type: "function", name: "jackDropWinner", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
    { type: "function", name: "jackDropAmount", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "jackDropClaimed", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
    { type: "function", name: "owner", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
    { type: "function", name: "paused", inputs: [], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
    { type: "function", name: "token", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
    { type: "function", name: "participants", inputs: [{ name: "roundId", type: "uint256" }], outputs: [{ name: "", type: "address[]" }], stateMutability: "view" },
    { type: "function", name: "hasEverDeposited", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
    { type: "function", name: "referrerOf", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
    { type: "function", name: "isInfluencer", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
    { type: "function", name: "blacklist", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
    { type: "function", name: "devWallet", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
    { type: "function", name: "aggregatorAdmin", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
    { type: "function", name: "roundWinners", inputs: [{ name: "", type: "uint256" }, { name: "", type: "uint256" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
    { type: "function", name: "REWARDS_BPS", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "JACKPOT_BPS", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "DEV_BPS", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "AGG_BPS", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "BPS_DENOM", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "AUTHOR_DNA_HASH", inputs: [], outputs: [{ name: "", type: "bytes32" }], stateMutability: "view" },
    { type: "function", name: "LICENSE_HASH", inputs: [], outputs: [{ name: "", type: "bytes32" }], stateMutability: "view" },
    { type: "function", name: "cycleCfg", inputs: [], outputs: [{ name: "jackTarget", type: "uint256" }, { name: "maxJackEntriesCountedPerWallet", type: "uint16" }, { name: "referralProgramActive", type: "bool" }, { name: "activeRefUsdcThreshold", type: "uint256" }, { name: "minActiveRefForRandom", type: "uint16" }, { name: "topN", type: "uint16" }, { name: "nextM", type: "uint16" }, { name: "randomK", type: "uint32" }, { name: "topRewardEach", type: "uint256" }, { name: "nextRewardEach", type: "uint256" }, { name: "randomRewardEach", type: "uint256" }, { name: "maxActiveRefsCountedPerInfluencer", type: "uint32" }, { name: "aggregatorAirdropTriggerBalance", type: "uint256" }, { name: "aggregatorAirdropBudget", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "roundCfg", inputs: [], outputs: [{ name: "entryPrice", type: "uint256" }, { name: "maxEntriesPerWalletPerRound", type: "uint16" }, { name: "minPool", type: "uint256" }, { name: "minTime", type: "uint32" }, { name: "maxTotalEntries", type: "uint32" }, { name: "winnersPerRound", type: "uint8" }], stateMutability: "view" },
    { type: "function", name: "refundLiability", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "refundClaimed", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },

    // ---- Write functions (user actions) ----
    { type: "function", name: "deposit", inputs: [{ name: "entries", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "depositWithReferrer", inputs: [{ name: "entries", type: "uint256" }, { name: "referrer", type: "address" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "claimPayout", inputs: [{ name: "roundId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "claimJackDrop", inputs: [{ name: "roundId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "claimRefund", inputs: [{ name: "roundId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },

    // ---- Admin functions ----
    { type: "function", name: "closeRound", inputs: [], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "pause", inputs: [], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "unpause", inputs: [], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "activateEmergencyRefund", inputs: [{ name: "roundId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "resolveRoundFallback", inputs: [{ name: "roundId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "setBlacklist", inputs: [{ name: "user", type: "address" }, { name: "onOff", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "scheduleRoundConfig", inputs: [{ name: "entryPrice_", type: "uint256" }, { name: "minPool_", type: "uint256" }, { name: "minTime_", type: "uint32" }, { name: "maxTotalEntries_", type: "uint32" }, { name: "winnersPerRound_", type: "uint8" }, { name: "payoutBps_", type: "uint16[]" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "spendAggregator", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "reasonHash", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "sweepExpiredRefunds", inputs: [{ name: "roundId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  ],
} as const;

// ============================================================
// USDC contract (ERC20 — for approve + balanceOf)
// ============================================================
export const USDC_CONTRACT = {
  // TestUSDC on Polygon Amoy testnet (2026-02-27)
  // Mainnet: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
  address: "0xe67A5aa7e6AD435A67f52274b32467B3c2509a41",
  abi: [
    { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
    { type: "function", name: "decimals", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
    { type: "function", name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
  ],
} as const;

// Backward compatibility alias
export const ROUND_CONTRACT = PROJECT_CONTRACT;
