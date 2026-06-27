"use client";

import { useSession } from "next-auth/react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          {getGreeting()}, {firstName}
        </h2>
        <p className="mt-1 text-muted-foreground">
          Here is your day at a glance.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Your schedule is clear. Time to plan your day!
        </p>
      </div>
    </div>
  );
}
