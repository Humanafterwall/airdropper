"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
  Suspense,
} from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { SimulationEngine } from "./engine";
import type { SimGlobalState, SimPhase, MembershipTier } from "./types";

/** Demo wallet address used when sim mode is active but no real wallet is connected */
const SIM_DEMO_ADDRESS = "0xDe1A0000000000000000000000000000000dEm01";

/* ─── Public interface ─── */

export interface SimControls {
  isActive: boolean;
  phase: SimPhase;
  speed: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  setSpeed: (s: number) => void;
  advancePhase: () => void;
  reset: () => void;
  bulkDeposit: (count: number) => void;
  userDeposit: (entries: number, referrer?: string) => void;
  userApprove: (amount: bigint) => void;
  userClaim: (roundId: bigint) => void;
  userClaimJackDrop: (roundId: bigint) => void;
  setJackTarget: (target: bigint) => void;
  // Airdrop actions
  createEarlyAdopterAirdrop: (name: string, maxSerial: number, totalBudget: bigint) => boolean;
  createTierAirdrop: (name: string, minTier: MembershipTier, totalBudget: bigint) => boolean;
  userClaimAirdrop: (campaignId: number) => boolean;
}

interface SimContextValue {
  isSimMode: boolean;
  engine: SimulationEngine | null;
  state: SimGlobalState | null;
  controls: SimControls;
}

const noop = () => {};
const defaultControls: SimControls = {
  isActive: false,
  phase: "idle",
  speed: 1,
  start: noop,
  pause: noop,
  resume: noop,
  setSpeed: noop,
  advancePhase: noop,
  reset: noop,
  bulkDeposit: noop,
  userDeposit: noop,
  userApprove: noop,
  userClaim: noop,
  userClaimJackDrop: noop,
  setJackTarget: noop,
  createEarlyAdopterAirdrop: () => false,
  createTierAirdrop: () => false,
  userClaimAirdrop: () => false,
};

const SimContext = createContext<SimContextValue>({
  isSimMode: false,
  engine: null,
  state: null,
  controls: defaultControls,
});

/* ─── Inner provider (needs Suspense boundary for useSearchParams) ─── */

function SimProviderInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const simParam = searchParams.get("sim");
  const [simEnabled, setSimEnabled] = useState(false);
  const { address: realAddress } = useAccount();
  const engineRef = useRef<SimulationEngine | null>(null);
  const [, forceRender] = useState(0);

  // Use real address if connected, otherwise demo address in sim mode
  const address = realAddress ?? (simEnabled ? SIM_DEMO_ADDRESS : undefined);

  // Activate from URL param
  useEffect(() => {
    if (simParam === "true") setSimEnabled(true);
  }, [simParam]);

  // Create/destroy engine
  useEffect(() => {
    if (simEnabled) {
      const eng = new SimulationEngine(address ?? SIM_DEMO_ADDRESS);
      engineRef.current = eng;
      eng.startAutoDeposits();
      forceRender((n) => n + 1);
    } else {
      engineRef.current?.stopAutoDeposits();
      engineRef.current = null;
    }
    return () => {
      engineRef.current?.stopAutoDeposits();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simEnabled]);

  // Update owner if wallet connects/changes
  useEffect(() => {
    if (engineRef.current && address) {
      engineRef.current.state.owner = address;
      if (!engineRef.current.state.usdcBalances.has(address.toLowerCase())) {
        engineRef.current.state.usdcBalances.set(
          address.toLowerCase(),
          10_000_000_000n // 10,000 USDC
        );
      }
    }
  }, [address]);

  // Subscribe to engine state
  const subscribe = useCallback(
    (cb: () => void) => engineRef.current?.subscribe(cb) ?? (() => {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [simEnabled]
  );
  const getSnapshot = useCallback(
    () => engineRef.current?.getSnapshot() ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [simEnabled]
  );
  const getServerSnapshot = useCallback(() => null, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Re-read version to trigger re-renders on engine state changes
  const version = useSyncExternalStore(
    subscribe,
    () => engineRef.current?.getVersion() ?? 0,
    () => 0
  );
  // Suppress unused var warning - version is used to trigger re-renders
  void version;

  const controls: SimControls = {
    isActive: simEnabled && !!engineRef.current,
    phase: engineRef.current?.phase ?? "idle",
    speed: engineRef.current?.speed ?? 1,
    start: () => {
      setSimEnabled(true);
      engineRef.current?.startAutoDeposits();
    },
    pause: () => engineRef.current?.stopAutoDeposits(),
    resume: () => engineRef.current?.startAutoDeposits(),
    setSpeed: (s) => engineRef.current?.setSpeed(s),
    advancePhase: () => engineRef.current?.advancePhase(),
    reset: () => {
      engineRef.current?.reset(address);
      engineRef.current?.startAutoDeposits();
    },
    bulkDeposit: (count) => engineRef.current?.bulkDeposit(count),
    userDeposit: (entries, referrer?) => {
      if (address) engineRef.current?.userDeposit(address, entries, referrer);
    },
    userApprove: (amount) => {
      if (address) engineRef.current?.userApprove(address, amount);
    },
    userClaim: (roundId) => {
      if (address) engineRef.current?.userClaim(address, roundId);
    },
    userClaimJackDrop: (roundId) => {
      if (address) engineRef.current?.userClaimJackDrop(address, roundId);
    },
    setJackTarget: (target) => {
      engineRef.current?.setJackTarget(target);
    },
    createEarlyAdopterAirdrop: (name, maxSerial, totalBudget) => {
      const result = engineRef.current?.createEarlyAdopterAirdrop(name, maxSerial, totalBudget);
      return !!result;
    },
    createTierAirdrop: (name, minTier, totalBudget) => {
      const result = engineRef.current?.createTierAirdrop(name, minTier, totalBudget);
      return !!result;
    },
    userClaimAirdrop: (campaignId) => {
      if (address) return engineRef.current?.userClaimAirdrop(address, campaignId) ?? false;
      return false;
    },
  };

  return (
    <SimContext.Provider
      value={{ isSimMode: simEnabled, engine: engineRef.current, state, controls }}
    >
      {children}
    </SimContext.Provider>
  );
}

/* ─── Exported provider with Suspense ─── */

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SimProviderInner>{children}</SimProviderInner>
    </Suspense>
  );
}

export function useSimulation() {
  return useContext(SimContext);
}
