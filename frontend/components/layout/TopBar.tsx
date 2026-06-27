"use client";

import { motion } from "framer-motion";
import { Search, Menu } from "lucide-react";
import Image from "next/image";

interface TopBarProps {
  title?: string;
  connected?: boolean;
  userImage?: string | null;
  onMenuClick?: () => void;
}

/**
 * TopBar
 * Minimal Notion-style top bar spanning the content area.
 * Shows page title, search trigger, connection status, and user avatar.
 */
export default function TopBar({
  title = "Dashboard",
  connected,
  userImage,
  onMenuClick,
}: TopBarProps) {
  const connectionColor =
    connected === true
      ? "bg-emerald-400"
      : connected === false
        ? "bg-red-400"
        : "bg-amber-400 animate-pulse";

  const connectionLabel =
    connected === true
      ? "Connected"
      : connected === false
        ? "Disconnected"
        : "Connecting";

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg)]/80 px-4 backdrop-blur-sm md:px-6"
    >
      {/* Left: mobile menu + page title */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] md:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        )}
        <h1 className="text-base font-semibold text-[var(--text-primary)]">
          {title}
        </h1>
      </div>

      {/* Right: search trigger, connection, avatar */}
      <div className="flex items-center gap-3">
        {/* Search / Command Palette trigger */}
        <button
          onClick={() => {
            // Dispatch Cmd+K to open command palette
            const event = new KeyboardEvent("keydown", {
              key: "k",
              metaKey: true,
              bubbles: true,
            });
            document.dispatchEvent(event);
          }}
          className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)] sm:flex"
        >
          <Search size={14} />
          <span>Search</span>
          <kbd className="ml-2 rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">
            ⌘K
          </kbd>
        </button>

        {/* Connection status */}
        <div className="flex items-center gap-1.5" title={connectionLabel}>
          <span
            className={`h-2 w-2 rounded-full ${connectionColor}`}
          />
        </div>

        {/* User avatar */}
        {userImage ? (
          <Image
            src={userImage}
            alt="User avatar"
            width={28}
            height={28}
            className="rounded-full ring-1 ring-[var(--border)]"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-500/20 text-xs font-medium text-accent-400 ring-1 ring-[var(--border)]">
            U
          </div>
        )}
      </div>
    </motion.header>
  );
}
