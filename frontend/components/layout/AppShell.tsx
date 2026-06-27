"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface AppShellProps {
  children: React.ReactNode;
  connected?: boolean;
  userImage?: string | null;
}

/**
 * AppShell
 * Main layout wrapper: Sidebar (left) + TopBar (top) + scrollable content area.
 * On mobile, sidebar is hidden and accessible via hamburger menu overlay.
 */

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/tasks": "Tasks",
  "/dashboard/calendar": "Calendar",
  "/dashboard/habits": "Habits",
  "/dashboard/settings": "Settings",
};

export default function AppShell({
  children,
  connected,
  userImage,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const title = PAGE_TITLES[pathname] || "Dashboard";

  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)]">
      {/* Sidebar */}
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={handleMobileClose} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar
          title={title}
          connected={connected}
          userImage={userImage}
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
