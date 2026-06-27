"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import CommandPalette from "@/components/CommandPalette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/");
    },
  });

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <CommandPalette />
      <AppShell>{children}</AppShell>
    </>
  );
}
