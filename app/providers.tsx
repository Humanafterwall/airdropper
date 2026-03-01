"use client";

import * as React from "react";
import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { polygon, polygonAmoy } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "c4f643d4ff7cc1379bc82404e5d2e988"; // fallback for dev/testnet

// Override Amoy with higher gas fees so MetaMask doesn't under-price txs
const amoyWithGas = defineChain({
  ...polygonAmoy,
  fees: {
    defaultPriorityFee: () => 30_000_000_000n, // 30 gwei
  },
});

function makeConfig() {
  return getDefaultConfig({
    appName: "Airdropper",
    projectId,
    chains: [amoyWithGas, polygon],
    ssr: false,
  });
}

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [config] = React.useState(makeConfig);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={amoyWithGas}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
