export interface SimRoundState {
  roundId: bigint;
  startTime: number; // unix seconds
  minPoolSnap: bigint;
  minTimeSnap: number; // seconds
  entryPriceSnap: bigint;
  totalPool: bigint;
  totalEntries: bigint;
  uniquePlayers: bigint;
  isOpen: boolean;
  isEmergency: boolean;
  jackTriggered: boolean;
  winnersResolved: boolean;
  participants: string[];
  entriesPerWallet: Map<string, bigint>;
  winners: string[];
  payouts: Map<string, bigint>;
  payoutsClaimed: Map<string, boolean>;
}

export interface SimRoundConfig {
  entryPrice: bigint; // 1_000_000n = 1 USDC
  maxEntriesPerWalletPerRound: bigint;
  minPool: bigint;
  minTime: bigint; // seconds
  maxTotalEntries: bigint;
  winnersPerRound: bigint;
  maxRoundDuration: bigint; // seconds - auto-close after this duration
  minEntriesForJackDropTicket: bigint; // min entries in a round to earn a JackDrop ticket (Sybil mitigation)
}

export interface JackDropWinnerEntry {
  address: string;
  amount: bigint;
  claimed: boolean;
}

export interface SpaRewardEntry {
  address: string;
  rank: number;
  tier: "champion" | "elite" | "rising" | "community";
  activeRefs: number;
  amount: bigint;
  claimed: boolean;
}

export interface SimGlobalState {
  currentRoundId: bigint;
  rounds: Map<number, SimRoundState>;
  roundCfg: SimRoundConfig;
  jackpotBalance: bigint;
  devBalance: bigint;
  aggregatorBalance: bigint;
  cycleId: bigint;
  paused: boolean;
  owner: string;
  usdcBalances: Map<string, bigint>;
  usdcAllowances: Map<string, bigint>; // key = "owner:spender"
  // Referral tracking
  referrerOf: Map<string, string>;                // user → referrer address
  referralsByInfluencer: Map<string, Set<string>>; // influencer → set of referred users (lifetime)
  isInfluencer: Map<string, boolean>;              // anyone who has ever deposited
  hasEverDeposited: Map<string, boolean>;          // deposit history flag
  totalDepositedByUser: Map<string, bigint>;       // user → cumulative USDC deposited
  // JackDrop tracking
  jackDropResults: Map<number, JackDropWinnerEntry[]>; // roundId → array of winners
  jackTarget: bigint;                                   // target balance to trigger JackDrop
  // Cycle-scoped tracking (resets on JackDrop trigger)
  cycleRoundParticipation: Map<string, Set<number>>;    // wallet → set of roundIds played this cycle
  cycleUniqueWallets: Set<string>;                       // unique wallets this cycle
  lifetimeUniqueWallets: Set<string>;                    // unique wallets all time (never resets)
  cycleReferralsByInfluencer: Map<string, Set<string>>;  // cycle-scoped referrals for leaderboard
  // ─── SPA (Self-Propelled Aggregator) reward tracking ───
  spaRewardResults: Map<number, SpaRewardEntry[]>;       // cycleId → array of SPA reward entries
  // ─── Security mitigations ───
  maxJackDropTicketsPerWallet: bigint;       // per-wallet cap on JackDrop tickets per cycle (Sybil mitigation)
  minCycleParticipantsForJackDrop: bigint;   // min unique wallets required to trigger JackDrop
  // Pause timeout
  pausedAt: number | null;                    // unix timestamp when paused (null if not paused)
  maxPauseDuration: number;                   // auto-unpause after this many seconds
  // Config timelock
  pendingRoundCfg: SimRoundConfig | null;     // scheduled config change (waiting for activation)
  pendingCfgActivateTime: number | null;      // unix timestamp when pending config becomes active
  configTimelockDelay: number;                // delay in seconds before config change takes effect
  // Payout expiry
  payoutExpiryRounds: number;                 // unclaimed payouts recycled after this many rounds
  // ─── Membership & Early Adopter tracking ───
  userProfiles: Map<string, UserProfile>;      // wallet → profile
  nextSerialNumber: number;                    // counter for serial assignment (starts at 1)
  earlyAdopterCutoff: number;                  // first N users eligible for OG tier (default: 1000)
  epochDuration: number;                       // seconds per epoch (real: 604800 = 7 days, sim: 15s)
  memberStreakForMember: number;               // consecutive epochs for Member tier (default: 4)
  memberStreakForVeteran: number;              // consecutive epochs for Veteran tier (default: 12)
  memberStreakForOG: number;                   // consecutive epochs for OG tier (default: 26)
  // ─── Airdrop campaigns ───
  airdropCampaigns: Map<number, AirdropCampaign>; // campaignId → campaign
  nextAirdropId: number;                       // counter for campaign IDs
}

// ─── Membership & Early Adopter types ───

export type MembershipTier = 0 | 1 | 2 | 3; // None, Member, Veteran, OG

export const MEMBERSHIP_TIER_NAMES: Record<MembershipTier, string> = {
  0: "None",
  1: "Member",
  2: "Veteran",
  3: "OG",
};

export interface UserProfile {
  serialNumber: number;           // 0 = not registered, 1+ = order of first deposit
  firstDepositTime: number;       // unix timestamp of first ever deposit
  totalRoundsPlayed: number;      // lifetime rounds participated
  activeEpochs: number;           // total distinct epochs with activity
  currentStreak: number;          // consecutive active epochs (resets on miss)
  longestStreak: number;          // best streak ever achieved
  membershipTier: MembershipTier; // 0=None, 1=Member, 2=Veteran, 3=OG (only goes up)
  lastActiveEpoch: number;        // last epoch number where wallet deposited
}

// ─── Airdrop Campaign types ───

export interface AirdropCampaign {
  id: number;
  name: string;
  totalAmount: bigint;            // total USDC allocated from DEV fund
  eligibleCount: number;          // number of eligible wallets
  claimedCount: number;           // number of wallets that have claimed
  createdAt: number;              // unix timestamp
  eligible: Map<string, bigint>;  // wallet → claimable amount
  claimed: Map<string, boolean>;  // wallet → has claimed
}

export type SimPhase =
  | "idle"
  | "open"
  | "closing"
  | "resolving"
  | "resolved"
  | "next_round";
