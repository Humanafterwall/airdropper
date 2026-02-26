import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import ClientProviders from "./client-providers";
import { SimControlPanel } from "@/lib/sim/control-panel";

export const metadata: Metadata = {
  title: "Airdropper",
  description: "Polygon • USDC — Transparent on-chain lottery with Chainlink VRF",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <ClientProviders>
          <Header />
          {children}
          <SimControlPanel />
        </ClientProviders>
      </body>
    </html>
  );
}
