"use client";

import * as React from "react";
import { Providers } from "./providers";
import { SimulationProvider } from "@/lib/sim/context";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Providers>
      <SimulationProvider>{children}</SimulationProvider>
    </Providers>
  );
}
