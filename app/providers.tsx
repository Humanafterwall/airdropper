"use client";

import * as React from "react";
import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { polygon, polygonAmoy } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
  "c4f643d4ff7cc1379bc82404e5d2e988"; // fallback for dev/testnet

function makeConfig() {
  return getDefaultConfig({
    appName: "Airdropper",
    projectId,
    chains: [polygonAmoy, polygon],
    ssr: false,
  });
}

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [config] = React.useState(makeConfig);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={polygonAmoy}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
