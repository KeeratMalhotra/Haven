"use client";

import { SessionProvider } from "next-auth/react";
import OfflineOverlay from "@/components/ui/OfflineOverlay";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OfflineOverlay />
      {children}
    </SessionProvider>
  );
}
