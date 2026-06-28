"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface AppShellProps {
  children: React.ReactNode;
  connected?: boolean;
  userImage?: string | null;
  chatOpen?: boolean;
  onChatToggle?: () => void;
}

/**
 * AppShell
 * Premium multi-panel workspace layout.
 * Flex layout: Sidebar (left) + main area (right).
 * Main area: TopBar (top) + scrollable content.
 * Mobile sidebar is hidden behind a hamburger overlay.
 */

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/tasks": "Tasks",
  "/dashboard/calendar": "Calendar",
  "/dashboard/planner": "Planner",
  "/dashboard/habits": "Habits",
  "/dashboard/analytics": "Analytics",
  "/dashboard/settings": "Settings",
};

export default function AppShell({
  children,
  connected,
  userImage,
  chatOpen,
  onChatToggle,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const title = PAGE_TITLES[pathname] || "Dashboard";

  const handleMobileClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleMenuClick = useCallback(() => {
    setMobileMenuOpen(true);
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
          onMenuClick={handleMenuClick}
          chatOpen={chatOpen}
          onChatToggle={onChatToggle}
        />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
