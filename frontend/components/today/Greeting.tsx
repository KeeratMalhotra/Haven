"use client";

import { useSession } from "next-auth/react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function Greeting() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div>
      <h2 className="text-2xl font-semibold text-foreground">
        {getGreeting()}, {firstName}
      </h2>
      <p className="mt-1 text-muted-foreground">{formatDate()}</p>
    </div>
  );
}
