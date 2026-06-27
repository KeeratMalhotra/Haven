"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/layout/AppShell";
import type { ConnectionState } from "@/hooks/useChatSocket";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [connection] = useState<ConnectionState>("connecting");
  const userImage = session?.user?.image ?? null;

  return (
    <AppShell
      connected={connection === "connected"}
      userImage={userImage}
    >
      {children}
    </AppShell>
  );
}
