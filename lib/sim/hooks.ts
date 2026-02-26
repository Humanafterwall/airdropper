"use client";

import { useState } from "react";
import {
  useAccount as useRealAccount,
  useChainId as useRealChainId,
  useReadContract as useRealReadContract,
  useWriteContract as useRealWriteContract,
  useWaitForTransactionReceipt as useRealWaitForTx,
} from "wagmi";
import { polygonAmoy } from "wagmi/chains";
import { useSimulation } from "./context";
import { PROJECT_CONTRACT, USDC_CONTRACT } from "@/lib/contracts";

/** Demo wallet address used when sim mode is active but no real wallet is connected */
export const SIM_DEMO_ADDRESS = "0xDe1A0000000000000000000000000000000dEm01" as const;

/* ─── useAccount shim ─── */

export function useAccount() {
  const { isSimMode } = useSimulation();
  const real = useRealAccount();

  if (isSimMode && !real.isConnected) {
    // Fake a connected wallet in sim mode
    return {
      ...real,
      address: SIM_DEMO_ADDRESS as `0x${string}`,
      isConnected: true as const,
      isConnecting: false as const,
      isDisconnected: false as const,
      isReconnecting: false as const,
      status: "connected" as const,
    };
  }
  return real;
}

/* ─── useChainId shim ─── */

export function useChainId() {
  const { isSimMode } = useSimulation();
  const real = useRealChainId();

  if (isSimMode) {
    return polygonAmoy.id; // Always return correct chain in sim mode
  }
  return real;
}

/* ─── useReadContract shim ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useReadContract(config: any) {
  const { isSimMode, engine } = useSimulation();

  const realResult = useRealReadContract(
    isSimMode
      ? { ...config, query: { ...config?.query, enabled: false } }
      : config
  );

  if (!isSimMode || !engine) {
    return realResult;
  }

  const addr = (config?.address as string)?.toLowerCase?.();
  const fn = config?.functionName as string;
  const args = config?.args as unknown[] | undefined;

  const projectAddr = PROJECT_CONTRACT.address.toLowerCase();
  const usdcAddr = USDC_CONTRACT.address.toLowerCase();

  let data: unknown = undefined;

  if (addr === projectAddr) {
    switch (fn) {
      case "currentRoundId":
        data = engine.readCurrentRoundId();
        break;
      case "getRoundInfo":
        data = args?.[0] !== undefined
          ? engine.readGetRoundInfo(args[0] as bigint)
          : undefined;
        break;
      case "roundCfg":
        data = engine.readRoundCfg();
        break;
      case "jackpotBalance":
        data = engine.readJackpotBalance();
        break;
      case "devBalance":
        data = engine.readDevBalance();
        break;
      case "aggregatorBalance":
        data = engine.readAggregatorBalance();
        break;
      case "entriesOf":
        data = args
          ? engine.readEntriesOf(args[0] as bigint, args[1] as string)
          : undefined;
        break;
      case "payoutOf":
        data = args
          ? engine.readPayoutOf(args[0] as bigint, args[1] as string)
          : undefined;
        break;
      case "payoutClaimed":
        data = args
          ? engine.readPayoutClaimed(args[0] as bigint, args[1] as string)
          : undefined;
        break;
      case "owner":
        data = engine.readOwner();
        break;
      case "paused":
        data = engine.readPaused();
        break;
      case "cycleId":
        data = engine.readCycleId();
        break;
      case "cycleCfg":
        data = engine.readCycleCfg();
        break;
      case "participants":
        data = args
          ? engine.readParticipants(args[0] as bigint)
          : undefined;
        break;
      case "roundWinners":
        data = args
          ? engine.readRoundWinners(args[0] as bigint, args[1] as bigint)
          : undefined;
        break;
      case "jackDropWinner":
        data = args
          ? engine.readJackDropWinner(args[0] as bigint)
          : undefined;
        break;
      case "jackDropAmount":
        data = args
          ? engine.readJackDropAmount(args[0] as bigint)
          : undefined;
        break;
      case "jackDropClaimed":
        data = args
          ? engine.readJackDropClaimed(args[0] as bigint)
          : undefined;
        break;
      case "devWallet":
        data = engine.readDevWallet();
        break;
      case "aggregatorAdmin":
        data = engine.readAggregatorAdmin();
        break;
      case "referrerOf":
        data = args ? engine.readReferrerOf(args[0] as string) : undefined;
        break;
      case "isInfluencer":
        data = args ? engine.readIsInfluencer(args[0] as string) : undefined;
        break;
      case "hasEverDeposited":
        data = args ? engine.readHasEverDeposited(args[0] as string) : undefined;
        break;
      case "jackDropResults":
        data = args
          ? engine.readJackDropResults(args[0] as bigint)
          : undefined;
        break;
      case "cycleUniqueWallets":
        data = engine.readCycleUniqueWallets();
        break;
      case "lifetimeUniqueWallets":
        data = engine.readLifetimeUniqueWallets();
        break;
      case "userJackDropTickets":
        data = args
          ? engine.readUserJackDropTickets(args[0] as string)
          : undefined;
        break;
      case "totalJackDropTickets":
        data = engine.readTotalJackDropTickets();
        break;
      // Security mitigation reads
      case "pendingRoundConfig":
        data = engine.readPendingConfig();
        break;
      case "pauseInfo":
        data = engine.readPauseInfo();
        break;
      case "spaRewardResults":
        data = args ? engine.readSpaRewardResults(args[0] as bigint) : undefined;
        break;
      // Membership & early adopter reads
      case "userProfile":
        data = args ? engine.getUserProfile(args[0] as string) : undefined;
        break;
      case "allProfiles":
        data = engine.getAllProfiles();
        break;
      case "earlyAdopters":
        data = engine.getEarlyAdopters();
        break;
      case "profilesByTier":
        data = args ? engine.getProfilesByTier(args[0] as 0 | 1 | 2 | 3) : undefined;
        break;
      // Airdrop reads
      case "airdropCampaigns":
        data = engine.getAirdropCampaigns();
        break;
      case "userAirdrops":
        data = args ? engine.getUserAirdrops(args[0] as string) : undefined;
        break;
      default:
        data = undefined;
    }
  } else if (addr === usdcAddr) {
    switch (fn) {
      case "balanceOf":
        data = args ? engine.readBalanceOf(args[0] as string) : undefined;
        break;
      case "allowance":
        data = args
          ? engine.readAllowance(args[0] as string, args[1] as string)
          : undefined;
        break;
      case "decimals":
        data = 6;
        break;
      case "symbol":
        data = "USDC";
        break;
      default:
        data = undefined;
    }
  }

  return {
    ...realResult,
    data,
    isLoading: false,
    isError: false,
    error: null,
    isSuccess: data !== undefined,
    refetch: async () => ({ data }),
  };
}

/* ─── useWriteContract shim ─── */

export function useWriteContract() {
  const { isSimMode, controls } = useSimulation();
  const realResult = useRealWriteContract();
  const [simTxHash, setSimTxHash] = useState<`0x${string}` | undefined>();
  const [simError, setSimError] = useState<Error | null>(null);

  if (!isSimMode) {
    return realResult;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const writeContract = (config: any) => {
    try {
      const fn = config?.functionName as string;
      const args = config?.args as unknown[] | undefined;

      switch (fn) {
        case "approve":
          controls.userApprove(args?.[1] as bigint ?? 0n);
          break;
        case "deposit":
          controls.userDeposit(Number(args?.[0] ?? 1));
          break;
        case "depositWithReferrer":
          controls.userDeposit(Number(args?.[0] ?? 1), args?.[1] as string);
          break;
        case "claimPayout":
          controls.userClaim(args?.[0] as bigint ?? 0n);
          break;
        case "claimJackDrop":
          controls.userClaimJackDrop(args?.[0] as bigint ?? 0n);
          break;
        case "closeRound":
          controls.advancePhase();
          break;
        case "setJackTarget":
          controls.setJackTarget(args?.[0] as bigint ?? 0n);
          break;
        case "pause":
          // handled through engine
          break;
        case "unpause":
          // handled through engine
          break;
        case "claimAirdrop":
          controls.userClaimAirdrop(Number(args?.[0] ?? 0));
          break;
        default:
          break;
      }

      // Generate fake tx hash
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const fakeHash = ("0x" +
        Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
          ""
        )) as `0x${string}`;

      setSimTxHash(fakeHash);
      setSimError(null);
    } catch (e) {
      setSimError(e as Error);
    }
  };

  return {
    ...realResult,
    writeContract,
    data: simTxHash,
    error: simError,
    reset: () => {
      setSimTxHash(undefined);
      setSimError(null);
    },
    isPending: false,
    isSuccess: !!simTxHash,
    isError: !!simError,
  };
}

/* ─── useWaitForTransactionReceipt shim ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useWaitForTransactionReceipt(config: any) {
  const { isSimMode } = useSimulation();

  const realResult = useRealWaitForTx(
    isSimMode ? { hash: undefined } : config
  );

  if (!isSimMode) {
    return realResult;
  }

  // In sim mode, any hash is immediately "confirmed"
  return {
    ...realResult,
    isLoading: false,
    isSuccess: !!config?.hash,
    isError: false,
    data: config?.hash ? { status: "success" as const } : undefined,
  };
}
