import type { SimRoundState, SimRoundConfig, SimGlobalState, SimPhase, JackDropWinnerEntry, SpaRewardEntry, UserProfile, MembershipTier, AirdropCampaign } from "./types";
import { pickRandomWallet, pickRandomEntries } from "./addresses";

const ONE_USDC = 1_000_000n; // 6 decimals

// ─── Membership epoch constants ───
const SIM_EPOCH_DURATION = 15;        // 15 seconds per epoch in simulation
const REAL_EPOCH_DURATION = 604_800;  // 7 days in production
const EARLY_ADOPTER_CUTOFF = 1000;    // first 1000 users
const STREAK_FOR_MEMBER = 4;          // 4 consecutive active epochs → Member
const STREAK_FOR_VETERAN = 12;        // 12 → Veteran
const STREAK_FOR_OG = 26;            // 26 + early adopter → OG

// JackDrop prize BPS (basis points of jackTarget):
// 1st: 75%, 2nd: 10%, 3rd-17th: 1% each = 100% total
const JACKDROP_PRIZE_BPS = [
  7500n,  // 1st place  (75%)
  1000n,  // 2nd place  (10%)
  ...Array(15).fill(100n),  // 3rd-17th  (1% each = 15%)
] as const; // Total: 10000 BPS = 100%

function defaultRoundCfg(): SimRoundConfig {
  return {
    entryPrice: ONE_USDC,
    maxEntriesPerWalletPerRound: 10n,
    minPool: 100n * ONE_USDC,
    minTime: 60n, // 60 seconds for sim (real: 3600)
    maxTotalEntries: 1000n,
    winnersPerRound: 2n,
    maxRoundDuration: 120n, // 2 min for sim (real: 86400 = 24h)
    minEntriesForJackDropTicket: 3n, // min 3 entries per round to earn a JackDrop ticket (Sybil mitigation)
  };
}

function createRound(roundId: bigint, cfg: SimRoundConfig): SimRoundState {
  return {
    roundId,
    startTime: Math.floor(Date.now() / 1000),
    minPoolSnap: cfg.minPool,
    minTimeSnap: Number(cfg.minTime),
    entryPriceSnap: cfg.entryPrice,
    totalPool: 0n,
    totalEntries: 0n,
    uniquePlayers: 0n,
    isOpen: true,
    isEmergency: false,
    jackTriggered: false,
    winnersResolved: false,
    participants: [],
    entriesPerWallet: new Map(),
    winners: [],
    payouts: new Map(),
    payoutsClaimed: new Map(),
  };
}

export class SimulationEngine {
  state: SimGlobalState;
  phase: SimPhase = "idle";
  speed = 1;

  private depositTimer: ReturnType<typeof setInterval> | null = null;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private connectedAddress: string | undefined;
  private version = 0; // bump on each change for snapshot identity

  constructor(connectedAddress?: string) {
    this.connectedAddress = connectedAddress;
    const cfg = defaultRoundCfg();
    const round1 = createRound(1n, cfg);

    const JACK_TARGET = 100_000n * ONE_USDC; // 100K USDC initial JackDrop target (admin-configurable)

    this.state = {
      currentRoundId: 1n,
      rounds: new Map([[1, round1]]),
      roundCfg: cfg,
      jackpotBalance: 99_950n * ONE_USDC, // Pre-filled near target for demo (100K target)
      devBalance: 0n,
      aggregatorBalance: 0n,
      cycleId: 1n,
      paused: false,
      owner: connectedAddress ?? "0x0000000000000000000000000000000000000000",
      usdcBalances: new Map(),
      usdcAllowances: new Map(),
      referrerOf: new Map(),
      referralsByInfluencer: new Map(),
      isInfluencer: new Map(),
      hasEverDeposited: new Map(),
      totalDepositedByUser: new Map(),
      // JackDrop (multi-winner)
      jackDropResults: new Map(),
      jackTarget: JACK_TARGET,
      // Cycle-scoped tracking
      cycleRoundParticipation: new Map(),
      cycleUniqueWallets: new Set(),
      lifetimeUniqueWallets: new Set(),
      cycleReferralsByInfluencer: new Map(),
      // ─── SPA (Self-Propelled Aggregator) reward tracking ───
      spaRewardResults: new Map(),
      // ─── Security mitigations ───
      maxJackDropTicketsPerWallet: 100n,      // raised to 100 to reward loyal players
      minCycleParticipantsForJackDrop: 50n,   // min 50 unique wallets before JackDrop can trigger
      pausedAt: null,
      maxPauseDuration: 120,                  // 2min for sim (real: 604800 = 7 days)
      pendingRoundCfg: null,
      pendingCfgActivateTime: null,
      configTimelockDelay: 30,                // 30s for sim (real: 86400 = 24h)
      payoutExpiryRounds: 100,                // 100 for sim (real: 1000)
      // ─── Membership & Early Adopter tracking ───
      userProfiles: new Map(),
      nextSerialNumber: 1,                    // first depositor gets serial #1
      earlyAdopterCutoff: EARLY_ADOPTER_CUTOFF,
      epochDuration: SIM_EPOCH_DURATION,      // 15s for sim (real: 604800 = 7 days)
      memberStreakForMember: STREAK_FOR_MEMBER,
      memberStreakForVeteran: STREAK_FOR_VETERAN,
      memberStreakForOG: STREAK_FOR_OG,
      // ─── Airdrop campaigns ───
      airdropCampaigns: new Map(),
      nextAirdropId: 1,
    };

    // Give connected wallet 10,000 USDC
    if (connectedAddress) {
      this.state.usdcBalances.set(connectedAddress.toLowerCase(), 10_000n * ONE_USDC);
    }
  }

  /* ─── Subscription (for useSyncExternalStore) ─── */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SimGlobalState => this.state;
  getVersion = (): number => this.version;

  private notify() {
    this.version++;
    for (const l of this.listeners) l();
  }

  /* ─── Current round helper ─── */

  private currentRound(): SimRoundState {
    return this.state.rounds.get(Number(this.state.currentRoundId))!;
  }

  /* ─── Auto-deposit ticker ─── */

  startAutoDeposits() {
    this.stopAutoDeposits();
    this.phase = "open";
    const interval = Math.max(200, 2000 / this.speed);
    this.depositTimer = setInterval(() => this.tickDeposit(), interval);

    // Duration watchdog: check every second if maxRoundDuration exceeded + pause timeout
    this.durationTimer = setInterval(() => {
      // Auto-unpause check (security mitigation: prevents indefinite pause)
      if (this.state.paused && this.state.pausedAt) {
        const pauseElapsed = Math.floor(Date.now() / 1000) - this.state.pausedAt;
        if (pauseElapsed >= this.state.maxPauseDuration) {
          this.setPaused(false);
          // Restart deposits after auto-unpause
          if (!this.depositTimer) {
            const interval = Math.max(200, 2000 / this.speed);
            this.depositTimer = setInterval(() => this.tickDeposit(), interval);
          }
        }
      }

      const round = this.currentRound();
      if (round.isOpen && !this.state.paused) {
        this.checkPhaseTransition(round);
      }
    }, 1000);

    this.notify();
  }

  stopAutoDeposits() {
    if (this.depositTimer) {
      clearInterval(this.depositTimer);
      this.depositTimer = null;
    }
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  setSpeed(s: number) {
    this.speed = s;
    if (this.depositTimer) {
      this.startAutoDeposits(); // restart with new interval
    }
  }

  private tickDeposit() {
    const round = this.currentRound();
    if (!round.isOpen || this.state.paused) return;

    const wallet = pickRandomWallet();
    let entries = BigInt(pickRandomEntries());
    const existing = round.entriesPerWallet.get(wallet.toLowerCase()) ?? 0n;
    const maxPer = this.state.roundCfg.maxEntriesPerWalletPerRound;

    // Clamp to max per wallet
    if (existing + entries > maxPer) {
      entries = maxPer - existing;
    }
    if (entries <= 0n) return; // wallet is full, skip

    // Clamp to max total
    if (round.totalEntries + entries > this.state.roundCfg.maxTotalEntries) {
      entries = this.state.roundCfg.maxTotalEntries - round.totalEntries;
    }
    if (entries <= 0n) return;

    // 30% chance a new depositor uses the connected wallet as referrer (demo)
    let referrer: string | undefined;
    if (this.connectedAddress && !this.state.referrerOf.has(wallet.toLowerCase())) {
      const rand = new Uint8Array(1);
      crypto.getRandomValues(rand);
      if (rand[0] % 100 < 30) {
        referrer = this.connectedAddress.toLowerCase();
      } else {
        // 15% chance to use another random wallet as referrer
        if (rand[0] % 100 < 45) {
          referrer = pickRandomWallet().toLowerCase();
        }
      }
    }

    this.applyDeposit(wallet.toLowerCase(), entries, round, referrer);
    this.checkPhaseTransition(round);
    this.notify();
  }

  private applyDeposit(wallet: string, entries: bigint, round: SimRoundState, referrer?: string) {
    const cost = entries * round.entryPriceSnap;
    const existing = round.entriesPerWallet.get(wallet) ?? 0n;

    if (existing === 0n) {
      round.participants.push(wallet);
      round.uniquePlayers++;

      // Unique wallet counters
      this.state.cycleUniqueWallets.add(wallet);
      this.state.lifetimeUniqueWallets.add(wallet);
    }

    // ─── JackDrop ticket (Sybil mitigation) ───
    // Ticket earned ONLY when wallet crosses minEntriesForJackDropTicket threshold in this round
    const newTotal = existing + entries;
    const minForTicket = this.state.roundCfg.minEntriesForJackDropTicket;
    if (existing < minForTicket && newTotal >= minForTicket) {
      const participation = this.state.cycleRoundParticipation.get(wallet) ?? new Set();
      // Enforce per-wallet cap across the cycle
      if (BigInt(participation.size) < this.state.maxJackDropTicketsPerWallet) {
        participation.add(Number(round.roundId));
        this.state.cycleRoundParticipation.set(wallet, participation);
      }
    }

    round.entriesPerWallet.set(wallet, existing + entries);
    round.totalEntries += entries;
    round.totalPool += cost;

    // Track deposit history and influencer status
    this.state.hasEverDeposited.set(wallet, true);
    this.state.isInfluencer.set(wallet, true);
    const prev = this.state.totalDepositedByUser.get(wallet) ?? 0n;
    this.state.totalDepositedByUser.set(wallet, prev + cost);

    // ─── UserProfile: serial number + epoch/streak tracking ───
    const isFirstEntryInRound = existing === 0n;
    this.updateUserProfile(wallet, Number(round.roundId), isFirstEntryInRound);

    // Record referral (only on first deposit with referrer)
    if (referrer && !this.state.referrerOf.has(wallet) && referrer !== wallet) {
      const ref = referrer.toLowerCase();
      this.state.referrerOf.set(wallet, ref);
      // Lifetime referral tracking
      const refs = this.state.referralsByInfluencer.get(ref) ?? new Set();
      refs.add(wallet);
      this.state.referralsByInfluencer.set(ref, refs);
      // Cycle-scoped referral tracking (for leaderboard)
      const cycleRefs = this.state.cycleReferralsByInfluencer.get(ref) ?? new Set();
      cycleRefs.add(wallet);
      this.state.cycleReferralsByInfluencer.set(ref, cycleRefs);
    }
  }

  /* ─── Phase transitions ─── */

  private checkPhaseTransition(round: SimRoundState) {
    const elapsed = Math.floor(Date.now() / 1000) - round.startTime;
    const poolMet = round.totalPool >= round.minPoolSnap;
    const timeMet = elapsed >= round.minTimeSnap;
    const maxMet = round.totalEntries >= this.state.roundCfg.maxTotalEntries;
    const durationExpired = elapsed >= Number(this.state.roundCfg.maxRoundDuration);

    if ((poolMet && timeMet) || maxMet || durationExpired) {
      this.closeRound();
    }
  }

  private closeRound() {
    const round = this.currentRound();
    if (!round.isOpen) return;

    round.isOpen = false;
    this.phase = "closing";
    this.stopAutoDeposits();
    this.notify();

    // Simulate VRF delay then resolve
    const delay = Math.max(500, 2000 / this.speed);
    setTimeout(() => this.resolveWinners(), delay);
  }

  closeRoundManually() {
    this.closeRound();
  }

  private resolveWinners() {
    const round = this.currentRound();
    this.phase = "resolving";
    this.notify();

    // Pool split: 75% rewards, 10% jackpot, 10% dev, 5% aggregator
    const rewardsPool = (round.totalPool * 75n) / 100n;
    const jackpotCut = (round.totalPool * 10n) / 100n;
    const devCut = (round.totalPool * 10n) / 100n;
    const aggCut = round.totalPool - rewardsPool - jackpotCut - devCut; // 5%

    this.state.jackpotBalance += jackpotCut;
    this.state.devBalance += devCut;
    this.state.aggregatorBalance += aggCut;

    // Select winners
    const winnerCount = Number(this.state.roundCfg.winnersPerRound);
    const winners = this.selectWinners(round, winnerCount);
    round.winners = winners;

    // Assign payouts (default split: 75/25 for 2 winners)
    if (winners.length >= 2) {
      const first = (rewardsPool * 75n) / 100n;
      const second = rewardsPool - first;
      round.payouts.set(winners[0], first);
      round.payouts.set(winners[1], second);
    } else if (winners.length === 1) {
      round.payouts.set(winners[0], rewardsPool);
    }

    // ── JackDrop trigger check ──
    if (this.state.jackpotBalance >= this.state.jackTarget) {
      this.triggerJackDrop(round);
    }

    round.winnersResolved = true;
    this.phase = "resolved";
    this.notify();

    // Open next round after delay
    const nextDelay = Math.max(500, 1500 / this.speed);
    setTimeout(() => this.openNextRound(), nextDelay);
  }

  private selectWinners(round: SimRoundState, count: number): string[] {
    // Build weighted ticket array (more entries = more chances for round winners)
    const tickets: string[] = [];
    for (const addr of round.participants) {
      const entries = Number(round.entriesPerWallet.get(addr) ?? 0n);
      for (let i = 0; i < entries; i++) tickets.push(addr);
    }

    if (tickets.length === 0) return [];

    // Fisher-Yates shuffle with crypto.getRandomValues
    const randBuf = new Uint32Array(tickets.length);
    crypto.getRandomValues(randBuf);
    for (let i = tickets.length - 1; i > 0; i--) {
      const j = randBuf[i] % (i + 1);
      [tickets[i], tickets[j]] = [tickets[j], tickets[i]];
    }

    // Pick first N unique addresses
    const winners: string[] = [];
    const seen = new Set<string>();
    for (const addr of tickets) {
      if (!seen.has(addr)) {
        winners.push(addr);
        seen.add(addr);
        if (winners.length >= count) break;
      }
    }
    return winners;
  }

  /** Compute JackDrop prizes from current jackTarget using BPS */
  computeJackDropPrizes(): bigint[] {
    const target = this.state.jackTarget;
    return JACKDROP_PRIZE_BPS.map(bps => (target * bps) / 10000n);
  }

  private triggerJackDrop(round: SimRoundState) {
    // ─── Min participants guard (Sybil mitigation) ───
    if (BigInt(this.state.cycleUniqueWallets.size) < this.state.minCycleParticipantsForJackDrop) {
      // Not enough unique participants - JackDrop deferred to next round
      return;
    }

    // Build ticket pool: 1 ticket per round participated (loyalty-based, NOT amount-based)
    const tickets: string[] = [];
    for (const [wallet, rounds] of this.state.cycleRoundParticipation) {
      for (let i = 0; i < rounds.size; i++) {
        tickets.push(wallet);
      }
    }

    if (tickets.length === 0) return;

    // Fisher-Yates shuffle with crypto.getRandomValues
    const randBuf = new Uint32Array(tickets.length);
    crypto.getRandomValues(randBuf);
    for (let i = tickets.length - 1; i > 0; i--) {
      const j = randBuf[i] % (i + 1);
      [tickets[i], tickets[j]] = [tickets[j], tickets[i]];
    }

    // Pick first 17 unique addresses
    const JACKDROP_COUNT = 17;
    const winners: string[] = [];
    const seen = new Set<string>();
    for (const addr of tickets) {
      if (!seen.has(addr)) {
        winners.push(addr);
        seen.add(addr);
        if (winners.length >= JACKDROP_COUNT) break;
      }
    }

    // Compute prizes dynamically from jackTarget
    const prizes = this.computeJackDropPrizes();

    // Build JackDropWinnerEntry array with prize distribution
    const results: JackDropWinnerEntry[] = winners.map((addr, i) => ({
      address: addr,
      amount: prizes[i] ?? 0n,
      claimed: false,
    }));

    round.jackTriggered = true;
    this.state.jackDropResults.set(Number(round.roundId), results);

    // ─── Carry-forward unawarded prizes ───
    const totalAwarded = results.reduce((sum, w) => sum + w.amount, 0n);
    const totalPrizePool = prizes.reduce((sum, p) => sum + p, 0n);
    const unawarded = totalPrizePool - totalAwarded;
    // Unawarded goes to next cycle's jackpot (instead of being locked forever)
    this.state.jackpotBalance = unawarded;

    // ─── Distribute SPA referral rewards ───
    this.distributeReferralRewards(Number(this.state.cycleId));

    // Cycle reset
    this.resetCycle();
  }

  private resetCycle() {
    this.state.cycleId += 1n;
    this.state.cycleRoundParticipation.clear();
    this.state.cycleUniqueWallets.clear();
    this.state.cycleReferralsByInfluencer.clear();
  }

  /* ─── User JackDrop claim ─── */

  userClaimJackDrop(address: string, roundId: bigint) {
    const rId = Number(roundId);
    const results = this.state.jackDropResults.get(rId);
    if (!results) return;

    const addr = address.toLowerCase();
    const entry = results.find(w => w.address === addr);
    if (!entry || entry.claimed) return;

    entry.claimed = true;
    const balance = this.state.usdcBalances.get(addr) ?? 0n;
    this.state.usdcBalances.set(addr, balance + entry.amount);
    this.notify();
  }

  private openNextRound() {
    // Apply pending config if timelock has elapsed
    this.applyPendingConfig();

    const nextId = this.state.currentRoundId + 1n;
    const round = createRound(nextId, this.state.roundCfg);
    this.state.rounds.set(Number(nextId), round);
    this.state.currentRoundId = nextId;
    this.phase = "open";
    this.startAutoDeposits();
    this.notify();
  }

  /* ─── Config timelock (security mitigation) ─── */

  scheduleRoundConfig(newCfg: SimRoundConfig) {
    this.state.pendingRoundCfg = { ...newCfg };
    this.state.pendingCfgActivateTime = Math.floor(Date.now() / 1000) + this.state.configTimelockDelay;
    this.notify();
  }

  cancelPendingConfig() {
    this.state.pendingRoundCfg = null;
    this.state.pendingCfgActivateTime = null;
    this.notify();
  }

  private applyPendingConfig() {
    if (this.state.pendingRoundCfg && this.state.pendingCfgActivateTime) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= this.state.pendingCfgActivateTime) {
        this.state.roundCfg = this.state.pendingRoundCfg;
        this.state.pendingRoundCfg = null;
        this.state.pendingCfgActivateTime = null;
      }
    }
  }

  /* ─── SPA (Self-Propelled Aggregator) — automated referral reward distribution ─── */

  /** SPA tier definitions: BPS out of 10000 = 100% of SPA pool */
  private static readonly SPA_TIERS = [
    { name: "champion" as const, maxRank: 1, totalBps: 4000n },   // 40% to #1
    { name: "elite" as const, maxRank: 10, totalBps: 3000n },     // 30% split among #2-10
    { name: "rising" as const, maxRank: 30, totalBps: 2000n },    // 20% split among #11-30
    { name: "community" as const, maxRank: 100, totalBps: 1000n },// 10% split among #31-100
  ];

  /**
   * Distribute the entire SPA (aggregator) pool to top 100 referrers at cycle end.
   * Called from triggerJackDrop() before resetCycle().
   */
  private distributeReferralRewards(cycleId: number) {
    const spaPool = this.state.aggregatorBalance;
    if (spaPool <= 0n) return;

    // Get top 100 leaderboard ranked by active referral count
    const leaderboard = this.getLeaderboard(100);
    if (leaderboard.length === 0) {
      // No referrers — SPA balance carries forward to next cycle
      return;
    }

    const results: SpaRewardEntry[] = [];

    for (const tier of SimulationEngine.SPA_TIERS) {
      const prevMax = SimulationEngine.SPA_TIERS[
        SimulationEngine.SPA_TIERS.indexOf(tier) - 1
      ]?.maxRank ?? 0;
      const tierMembers = leaderboard.filter(
        (e) => e.rank > prevMax && e.rank <= tier.maxRank
      );

      if (tierMembers.length === 0) continue; // BPS redistributed via dust catch

      const perPersonBps = tier.totalBps / BigInt(tierMembers.length);

      for (const member of tierMembers) {
        const amount = (spaPool * perPersonBps) / 10000n;
        results.push({
          address: member.address,
          rank: member.rank,
          tier: tier.name,
          activeRefs: member.activeReferralCount,
          amount,
          claimed: false,
        });
      }
    }

    // Dust catch: remainder (from BPS division + unused tier slots) goes to #1
    const distributed = results.reduce((s, r) => s + r.amount, 0n);
    const remainder = spaPool - distributed;
    if (remainder > 0n && results.length > 0) {
      results[0].amount += remainder;
    }

    // Store results and zero out SPA balance
    this.state.spaRewardResults.set(cycleId, results);
    this.state.aggregatorBalance = 0n;

    // Auto-credit each winner's USDC balance (no manual claim needed)
    for (const entry of results) {
      const bal = this.state.usdcBalances.get(entry.address) ?? 0n;
      this.state.usdcBalances.set(entry.address, bal + entry.amount);
      entry.claimed = true;
    }
  }

  /**
   * Preview estimated SPA rewards if JackDrop triggered now (read-only).
   */
  getEstimatedSpaRewards(): SpaRewardEntry[] {
    const spaPool = this.state.aggregatorBalance;
    if (spaPool <= 0n) return [];

    const leaderboard = this.getLeaderboard(100);
    if (leaderboard.length === 0) return [];

    const results: SpaRewardEntry[] = [];

    for (const tier of SimulationEngine.SPA_TIERS) {
      const prevMax = SimulationEngine.SPA_TIERS[
        SimulationEngine.SPA_TIERS.indexOf(tier) - 1
      ]?.maxRank ?? 0;
      const tierMembers = leaderboard.filter(
        (e) => e.rank > prevMax && e.rank <= tier.maxRank
      );

      if (tierMembers.length === 0) continue;

      const perPersonBps = tier.totalBps / BigInt(tierMembers.length);

      for (const member of tierMembers) {
        const amount = (spaPool * perPersonBps) / 10000n;
        results.push({
          address: member.address,
          rank: member.rank,
          tier: tier.name,
          activeRefs: member.activeReferralCount,
          amount,
          claimed: false,
        });
      }
    }

    // Dust catch
    const distributed = results.reduce((s, r) => s + r.amount, 0n);
    const remainder = spaPool - distributed;
    if (remainder > 0n && results.length > 0) {
      results[0].amount += remainder;
    }

    return results;
  }

  /* ─── Sweep expired payouts (security mitigation: prevents permanent fund lockup) ─── */

  sweepExpiredPayouts(roundId: bigint): bigint {
    const rId = Number(roundId);
    const currentRId = Number(this.state.currentRoundId);

    // Must have passed payoutExpiryRounds since that round
    if (currentRId - rId < this.state.payoutExpiryRounds) {
      return 0n; // too early
    }

    const round = this.state.rounds.get(rId);
    if (!round || !round.winnersResolved) return 0n;

    let swept = 0n;
    for (const [addr, payout] of round.payouts) {
      if (!round.payoutsClaimed.get(addr) && payout > 0n) {
        swept += payout;
        round.payoutsClaimed.set(addr, true); // mark as swept
      }
    }

    // Swept funds go to jackpot pool (benefits all participants)
    this.state.jackpotBalance += swept;
    this.notify();
    return swept;
  }

  /* ─── Manual advance (skip phase) ─── */

  advancePhase() {
    switch (this.phase) {
      case "idle":
        this.startAutoDeposits();
        break;
      case "open":
        this.closeRound();
        break;
      case "closing":
      case "resolving":
        // Already in transition, do nothing
        break;
      case "resolved":
        this.openNextRound();
        break;
    }
  }

  /* ─── Bulk deposit for pressure testing ─── */

  bulkDeposit(count: number) {
    const round = this.currentRound();
    if (!round.isOpen) return;

    for (let i = 0; i < count; i++) {
      const wallet = pickRandomWallet().toLowerCase();
      let entries = BigInt(pickRandomEntries());
      const existing = round.entriesPerWallet.get(wallet) ?? 0n;
      const maxPer = this.state.roundCfg.maxEntriesPerWalletPerRound;

      if (existing + entries > maxPer) entries = maxPer - existing;
      if (entries <= 0n) continue;
      if (round.totalEntries + entries > this.state.roundCfg.maxTotalEntries) {
        entries = this.state.roundCfg.maxTotalEntries - round.totalEntries;
      }
      if (entries <= 0n) break;

      this.applyDeposit(wallet, entries, round);
    }

    this.checkPhaseTransition(round);
    this.notify();
  }

  /* ─── User actions ─── */

  userDeposit(address: string, entries: number, referrer?: string) {
    const round = this.currentRound();
    if (!round.isOpen) return;

    const addr = address.toLowerCase();
    const entryBig = BigInt(entries);
    const cost = entryBig * round.entryPriceSnap;
    const balance = this.state.usdcBalances.get(addr) ?? 0n;

    if (balance < cost) return; // insufficient balance

    this.state.usdcBalances.set(addr, balance - cost);
    this.applyDeposit(addr, entryBig, round, referrer?.toLowerCase());
    this.checkPhaseTransition(round);
    this.notify();
  }

  userApprove(address: string, amount: bigint) {
    const key = `${address.toLowerCase()}:project`;
    this.state.usdcAllowances.set(key, amount);
    this.notify();
  }

  userClaim(address: string, roundId: bigint) {
    const round = this.state.rounds.get(Number(roundId));
    if (!round) return;
    const addr = address.toLowerCase();
    const payout = round.payouts.get(addr) ?? 0n;
    if (payout === 0n || round.payoutsClaimed.get(addr)) return;

    round.payoutsClaimed.set(addr, true);
    const balance = this.state.usdcBalances.get(addr) ?? 0n;
    this.state.usdcBalances.set(addr, balance + payout);
    this.notify();
  }

  /* ─── Membership: epoch/streak tracking ─── */

  private getCurrentEpoch(): number {
    return Math.floor(Date.now() / 1000 / this.state.epochDuration);
  }

  private updateUserProfile(wallet: string, roundId: number, isFirstEntryInRound: boolean) {
    const now = Math.floor(Date.now() / 1000);
    const currentEpoch = this.getCurrentEpoch();

    let profile = this.state.userProfiles.get(wallet);

    if (!profile) {
      // New user — assign serial number
      profile = {
        serialNumber: this.state.nextSerialNumber,
        firstDepositTime: now,
        totalRoundsPlayed: 0,
        activeEpochs: 0,
        currentStreak: 0,
        longestStreak: 0,
        membershipTier: 0,
        lastActiveEpoch: 0,
      };
      this.state.nextSerialNumber++;
    }

    // Increment rounds played (once per round)
    // This is called from applyDeposit which already checked existing === 0n for first entry
    // We track it via a flag: if wallet was just added to participants, it's first entry
    if (isFirstEntryInRound) {
      profile.totalRoundsPlayed++;
    }

    // Epoch/streak logic
    if (currentEpoch > profile.lastActiveEpoch) {
      if (profile.lastActiveEpoch === 0) {
        // First ever epoch
        profile.currentStreak = 1;
        profile.activeEpochs = 1;
      } else if (currentEpoch === profile.lastActiveEpoch + 1) {
        // Consecutive epoch — streak continues
        profile.currentStreak++;
        profile.activeEpochs++;
      } else {
        // Streak broken — gap of 1+ epochs
        profile.currentStreak = 1;
        profile.activeEpochs++;
      }

      profile.lastActiveEpoch = currentEpoch;

      // Update longest streak
      if (profile.currentStreak > profile.longestStreak) {
        profile.longestStreak = profile.currentStreak;
      }

      // Check membership tier promotion (tiers only go up, never down)
      this.evaluateMembershipTier(wallet, profile);
    }

    this.state.userProfiles.set(wallet, profile);
  }

  private evaluateMembershipTier(wallet: string, profile: UserProfile) {
    const isEarlyAdopter = profile.serialNumber <= this.state.earlyAdopterCutoff;

    // OG: requires early adopter + longest streak threshold
    if (profile.membershipTier < 3 && isEarlyAdopter &&
        profile.longestStreak >= this.state.memberStreakForOG) {
      profile.membershipTier = 3;
      return;
    }

    // Veteran: longest streak threshold
    if (profile.membershipTier < 2 &&
        profile.longestStreak >= this.state.memberStreakForVeteran) {
      profile.membershipTier = 2;
      return;
    }

    // Member: longest streak threshold
    if (profile.membershipTier < 1 &&
        profile.longestStreak >= this.state.memberStreakForMember) {
      profile.membershipTier = 1;
    }
  }

  /* ─── Airdrop campaign management (admin) ─── */

  /**
   * Create an airdrop campaign from DEV fund.
   * Deducts totalAmount from devBalance and allocates to eligible wallets.
   */
  createAirdropCampaign(
    name: string,
    eligibleWallets: Map<string, bigint>,
  ): AirdropCampaign | null {
    const totalAmount = Array.from(eligibleWallets.values()).reduce((s, v) => s + v, 0n);

    // Check sufficient DEV fund balance
    if (totalAmount > this.state.devBalance) return null;

    const campaign: AirdropCampaign = {
      id: this.state.nextAirdropId,
      name,
      totalAmount,
      eligibleCount: eligibleWallets.size,
      claimedCount: 0,
      createdAt: Math.floor(Date.now() / 1000),
      eligible: new Map(eligibleWallets),
      claimed: new Map(),
    };

    // Deduct from DEV fund
    this.state.devBalance -= totalAmount;

    this.state.airdropCampaigns.set(campaign.id, campaign);
    this.state.nextAirdropId++;
    this.notify();
    return campaign;
  }

  /**
   * Create an airdrop for early adopters (serial 1..N) with equal distribution.
   */
  createEarlyAdopterAirdrop(
    name: string,
    maxSerial: number,
    totalBudget: bigint,
  ): AirdropCampaign | null {
    // Find all eligible wallets
    const eligible = new Map<string, bigint>();
    for (const [wallet, profile] of this.state.userProfiles) {
      if (profile.serialNumber >= 1 && profile.serialNumber <= maxSerial) {
        eligible.set(wallet, 0n); // placeholder
      }
    }

    if (eligible.size === 0) return null;

    // Equal distribution
    const perWallet = totalBudget / BigInt(eligible.size);
    const remainder = totalBudget - perWallet * BigInt(eligible.size);

    let first = true;
    for (const [wallet] of eligible) {
      eligible.set(wallet, perWallet + (first ? remainder : 0n));
      first = false;
    }

    return this.createAirdropCampaign(name, eligible);
  }

  /**
   * Create an airdrop for wallets with a specific membership tier or higher.
   */
  createTierAirdrop(
    name: string,
    minTier: MembershipTier,
    totalBudget: bigint,
  ): AirdropCampaign | null {
    const eligible = new Map<string, bigint>();
    for (const [wallet, profile] of this.state.userProfiles) {
      if (profile.membershipTier >= minTier) {
        eligible.set(wallet, 0n);
      }
    }

    if (eligible.size === 0) return null;

    const perWallet = totalBudget / BigInt(eligible.size);
    const remainder = totalBudget - perWallet * BigInt(eligible.size);

    let first = true;
    for (const [wallet] of eligible) {
      eligible.set(wallet, perWallet + (first ? remainder : 0n));
      first = false;
    }

    return this.createAirdropCampaign(name, eligible);
  }

  /**
   * User claims their airdrop (Merkle-proof-based in production, direct in sim).
   */
  userClaimAirdrop(address: string, campaignId: number): boolean {
    const campaign = this.state.airdropCampaigns.get(campaignId);
    if (!campaign) return false;

    const addr = address.toLowerCase();
    const amount = campaign.eligible.get(addr);
    if (amount === undefined || amount === 0n) return false;
    if (campaign.claimed.get(addr)) return false;

    // Mark as claimed
    campaign.claimed.set(addr, true);
    campaign.claimedCount++;

    // Credit user's USDC balance
    const balance = this.state.usdcBalances.get(addr) ?? 0n;
    this.state.usdcBalances.set(addr, balance + amount);

    this.notify();
    return true;
  }

  /* ─── Membership read helpers ─── */

  getUserProfile(address: string): UserProfile | null {
    return this.state.userProfiles.get(address.toLowerCase()) ?? null;
  }

  getAllProfiles(): Array<{ address: string; profile: UserProfile }> {
    const result: Array<{ address: string; profile: UserProfile }> = [];
    for (const [addr, profile] of this.state.userProfiles) {
      result.push({ address: addr, profile });
    }
    // Sort by serial number
    result.sort((a, b) => a.profile.serialNumber - b.profile.serialNumber);
    return result;
  }

  getProfilesByTier(minTier: MembershipTier): Array<{ address: string; profile: UserProfile }> {
    return this.getAllProfiles().filter(e => e.profile.membershipTier >= minTier);
  }

  getEarlyAdopters(): Array<{ address: string; profile: UserProfile }> {
    return this.getAllProfiles().filter(
      e => e.profile.serialNumber <= this.state.earlyAdopterCutoff
    );
  }

  getAirdropCampaigns(): AirdropCampaign[] {
    return Array.from(this.state.airdropCampaigns.values()).sort((a, b) => b.id - a.id);
  }

  getUserAirdrops(address: string): Array<{ campaign: AirdropCampaign; amount: bigint; claimed: boolean }> {
    const addr = address.toLowerCase();
    const result: Array<{ campaign: AirdropCampaign; amount: bigint; claimed: boolean }> = [];
    for (const campaign of this.state.airdropCampaigns.values()) {
      const amount = campaign.eligible.get(addr);
      if (amount !== undefined && amount > 0n) {
        result.push({
          campaign,
          amount,
          claimed: campaign.claimed.get(addr) ?? false,
        });
      }
    }
    return result;
  }

  /* ─── Admin actions ─── */

  setJackTarget(target: bigint) {
    this.state.jackTarget = target;
    this.notify();
  }

  setPaused(paused: boolean) {
    this.state.paused = paused;
    if (paused) {
      this.state.pausedAt = Math.floor(Date.now() / 1000);
      this.stopAutoDeposits();
    } else {
      this.state.pausedAt = null;
    }
    this.notify();
  }

  reset(connectedAddress?: string) {
    this.stopAutoDeposits();
    const engine = new SimulationEngine(connectedAddress);
    this.state = engine.state;
    this.phase = "idle";
    this.version = 0;
    this.notify();
  }

  /* ─── Read dispatchers (match contract function signatures) ─── */

  readCurrentRoundId(): bigint {
    return this.state.currentRoundId;
  }

  readGetRoundInfo(roundId: bigint): readonly unknown[] {
    const round = this.state.rounds.get(Number(roundId));
    if (!round) {
      return [0n, 0n, 0n, 0n, 0n, 0n, 0n, false, false, false, false];
    }
    return [
      BigInt(round.startTime),    // 0: startTime
      round.minPoolSnap,          // 1: minPoolSnap
      BigInt(round.minTimeSnap),  // 2: minTimeSnap
      round.entryPriceSnap,       // 3: entryPriceSnap
      round.totalPool,            // 4: totalPool
      round.totalEntries,         // 5: totalEntries
      round.uniquePlayers,        // 6: uniquePlayers
      round.isOpen,               // 7: isOpen
      round.isEmergency,          // 8: isEmergency
      round.jackTriggered,        // 9: jackTriggered
      round.winnersResolved,      // 10: winnersResolved
    ] as const;
  }

  readRoundCfg(): readonly unknown[] {
    const c = this.state.roundCfg;
    return [
      c.entryPrice,
      c.maxEntriesPerWalletPerRound,
      c.minPool,
      c.minTime,
      c.maxTotalEntries,
      c.winnersPerRound,
    ] as const;
  }

  readJackpotBalance(): bigint {
    return this.state.jackpotBalance;
  }

  readDevBalance(): bigint {
    return this.state.devBalance;
  }

  readAggregatorBalance(): bigint {
    return this.state.aggregatorBalance;
  }

  readEntriesOf(roundId: bigint, address: string): bigint {
    const round = this.state.rounds.get(Number(roundId));
    return round?.entriesPerWallet.get(address.toLowerCase()) ?? 0n;
  }

  readPayoutOf(roundId: bigint, address: string): bigint {
    const round = this.state.rounds.get(Number(roundId));
    return round?.payouts.get(address.toLowerCase()) ?? 0n;
  }

  readPayoutClaimed(roundId: bigint, address: string): boolean {
    const round = this.state.rounds.get(Number(roundId));
    return round?.payoutsClaimed.get(address.toLowerCase()) ?? false;
  }

  readOwner(): string {
    return this.state.owner;
  }

  readPaused(): boolean {
    return this.state.paused;
  }

  readBalanceOf(address: string): bigint {
    return this.state.usdcBalances.get(address.toLowerCase()) ?? 0n;
  }

  readAllowance(owner: string, _spender: string): bigint {
    const key = `${owner.toLowerCase()}:project`;
    return this.state.usdcAllowances.get(key) ?? 0n;
  }

  readCycleId(): bigint {
    return this.state.cycleId;
  }

  readCycleCfg(): readonly unknown[] {
    // 17 fields - includes SPA tier BPS + security mitigation params
    return [
      this.state.jackTarget,                          // [0] jackTarget
      this.state.maxJackDropTicketsPerWallet,          // [1] maxJackDropTicketsPerWallet
      true,                                            // [2] referralProgramActive
      100n * ONE_USDC,                                 // [3] activeRefUsdcThreshold
      5n,                                              // [4] minActiveRefForRandom
      4000n,                                           // [5] spaChampionBps (40% to #1)
      3000n,                                           // [6] spaEliteBps (30% to #2-10)
      2000n,                                           // [7] spaRisingBps (20% to #11-30)
      1000n,                                           // [8] spaCommunityBps (10% to #31-100)
      0n,                                              // [9] reserved
      0n,                                              // [10] reserved
      100n,                                            // [11] maxActiveRefsCountedPerInfluencer
      0n,                                              // [12] reserved (was aggregatorAirdropTriggerBalance)
      0n,                                              // [13] reserved (was aggregatorAirdropBudget)
      this.state.minCycleParticipantsForJackDrop,      // [14] minCycleParticipantsForJackDrop (50)
      this.state.roundCfg.minEntriesForJackDropTicket, // [15] minEntriesForJackDropTicket (3)
      BigInt(this.state.configTimelockDelay),           // [16] configTimelockDelay (30s sim)
    ] as const;
  }

  readDevWallet(): string {
    return this.state.owner;
  }

  readAggregatorAdmin(): string {
    return this.state.owner;
  }

  /* ─── JackDrop read dispatchers (multi-winner) ─── */

  readJackDropResults(roundId: bigint): JackDropWinnerEntry[] {
    return this.state.jackDropResults.get(Number(roundId)) ?? [];
  }

  // Backward-compatible: returns first winner address
  readJackDropWinner(roundId: bigint): string {
    const results = this.state.jackDropResults.get(Number(roundId));
    return results?.[0]?.address ?? "0x0000000000000000000000000000000000000000";
  }

  // Backward-compatible: returns total amount across all winners
  readJackDropAmount(roundId: bigint): bigint {
    const results = this.state.jackDropResults.get(Number(roundId));
    return results?.reduce((sum, w) => sum + w.amount, 0n) ?? 0n;
  }

  // Backward-compatible: returns true only if ALL winners claimed
  readJackDropClaimed(roundId: bigint): boolean {
    const results = this.state.jackDropResults.get(Number(roundId));
    if (!results || results.length === 0) return false;
    return results.every(w => w.claimed);
  }

  readParticipants(roundId: bigint): string[] {
    const round = this.state.rounds.get(Number(roundId));
    return round?.participants ?? [];
  }

  readRoundWinners(roundId: bigint, index: bigint): string {
    const round = this.state.rounds.get(Number(roundId));
    return round?.winners[Number(index)] ?? "0x0000000000000000000000000000000000000000";
  }

  /* ─── Cycle / Counter read dispatchers ─── */

  readCycleUniqueWallets(): bigint {
    return BigInt(this.state.cycleUniqueWallets.size);
  }

  readLifetimeUniqueWallets(): bigint {
    return BigInt(this.state.lifetimeUniqueWallets.size);
  }

  readUserJackDropTickets(address: string): bigint {
    const participation = this.state.cycleRoundParticipation.get(address.toLowerCase());
    return BigInt(participation?.size ?? 0);
  }

  readTotalJackDropTickets(): bigint {
    let total = 0;
    for (const [, rounds] of this.state.cycleRoundParticipation) {
      total += rounds.size;
    }
    return BigInt(total);
  }

  /* ─── Referral reads ─── */

  readReferrerOf(address: string): string {
    return this.state.referrerOf.get(address.toLowerCase()) ?? "0x0000000000000000000000000000000000000000";
  }

  readIsInfluencer(address: string): boolean {
    return this.state.isInfluencer.get(address.toLowerCase()) ?? false;
  }

  readHasEverDeposited(address: string): boolean {
    return this.state.hasEverDeposited.get(address.toLowerCase()) ?? false;
  }

  getReferralCount(address: string): number {
    const refs = this.state.referralsByInfluencer.get(address.toLowerCase());
    return refs?.size ?? 0;
  }

  getActiveReferralCount(address: string): number {
    const refs = this.state.referralsByInfluencer.get(address.toLowerCase());
    if (!refs) return 0;
    const threshold = 100n * ONE_USDC; // activeRefUsdcThreshold
    let count = 0;
    for (const ref of refs) {
      const deposited = this.state.totalDepositedByUser.get(ref) ?? 0n;
      if (deposited >= threshold) count++;
    }
    return count;
  }

  getReferrals(address: string): Array<{ address: string; deposited: bigint; active: boolean }> {
    const refs = this.state.referralsByInfluencer.get(address.toLowerCase());
    if (!refs) return [];
    const threshold = 100n * ONE_USDC;
    return Array.from(refs).map((ref) => {
      const deposited = this.state.totalDepositedByUser.get(ref) ?? 0n;
      return { address: ref, deposited, active: deposited >= threshold };
    });
  }

  /* ─── Leaderboard ─── */

  getLeaderboard(topN = 10): Array<{ address: string; activeReferralCount: number; rank: number }> {
    const entries: Array<{ address: string; count: number }> = [];
    const threshold = 100n * ONE_USDC;

    for (const [influencer, refs] of this.state.cycleReferralsByInfluencer) {
      let activeCount = 0;
      for (const ref of refs) {
        const deposited = this.state.totalDepositedByUser.get(ref) ?? 0n;
        if (deposited >= threshold) activeCount++;
      }
      if (activeCount > 0) {
        entries.push({ address: influencer, count: activeCount });
      }
    }

    entries.sort((a, b) => b.count - a.count);

    return entries.slice(0, topN).map((e, i) => ({
      address: e.address,
      activeReferralCount: e.count,
      rank: i + 1,
    }));
  }

  getUserLeaderboardRank(address: string): number {
    const leaderboard = this.getLeaderboard(1000);
    const entry = leaderboard.find(e => e.address === address.toLowerCase());
    return entry?.rank ?? 0;
  }

  /* ─── Security info read dispatchers ─── */

  readPendingConfig(): { cfg: SimRoundConfig | null; activateTime: number | null } {
    return {
      cfg: this.state.pendingRoundCfg,
      activateTime: this.state.pendingCfgActivateTime,
    };
  }

  readPauseInfo(): { paused: boolean; pausedAt: number | null; maxDuration: number; remaining: number } {
    let remaining = 0;
    if (this.state.paused && this.state.pausedAt) {
      const elapsed = Math.floor(Date.now() / 1000) - this.state.pausedAt;
      remaining = Math.max(0, this.state.maxPauseDuration - elapsed);
    }
    return {
      paused: this.state.paused,
      pausedAt: this.state.pausedAt,
      maxDuration: this.state.maxPauseDuration,
      remaining,
    };
  }

  readSpaRewardResults(cycleId: bigint): SpaRewardEntry[] {
    return this.state.spaRewardResults.get(Number(cycleId)) ?? [];
  }

  getUserRoundHistory(address: string): Array<{
    roundId: number;
    entries: bigint;
    won: boolean;
    payout: bigint;
    claimed: boolean;
  }> {
    const addr = address.toLowerCase();
    const history: Array<{
      roundId: number;
      entries: bigint;
      won: boolean;
      payout: bigint;
      claimed: boolean;
    }> = [];
    for (const [roundNum, round] of this.state.rounds) {
      const entries = round.entriesPerWallet.get(addr) ?? 0n;
      if (entries > 0n) {
        const payout = round.payouts.get(addr) ?? 0n;
        history.push({
          roundId: roundNum,
          entries,
          won: payout > 0n,
          payout,
          claimed: round.payoutsClaimed.get(addr) ?? false,
        });
      }
    }
    return history;
  }
}
