"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const pageTitles: Record<string, string> = {
  "/dashboard": "Today",
  "/dashboard/calendar": "Calendar",
  "/dashboard/tasks": "Tasks",
  "/dashboard/habits": "Habits",
  "/dashboard/settings": "Settings",
};

export default function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Dashboard";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
