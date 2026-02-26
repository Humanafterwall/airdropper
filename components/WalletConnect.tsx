"use client";

import * as React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function WalletConnect() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        className="rounded-2xl bg-white px-5 py-3 font-semibold text-black opacity-70"
        disabled
      >
        Loading wallet…
      </button>
    );
  }

  return <ConnectButton />;
}
