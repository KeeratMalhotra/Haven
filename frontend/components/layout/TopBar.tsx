"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, MessageCircle, Plus, CheckSquare, Calendar, Timer, Sparkles } from "lucide-react";
import Image from "next/image";
import NotificationBell from "./NotificationBell";

interface TopBarProps {
  title?: string;
  connected?: boolean;
  userImage?: string | null;
  onMenuClick?: () => void;
  chatOpen?: boolean;
  onChatToggle?: () => void;
}

const quickActions = [
  {
    label: "Add Task",
    icon: CheckSquare,
    href: "/dashboard/tasks",
  },
  {
    label: "Add Event",
    icon: Calendar,
    href: "/dashboard/calendar",
  },
  {
    label: "Start Pomodoro",
    icon: Timer,
    href: null,
  },
];

/**
 * TopBar
 * Notion-style minimal top bar spanning the content area.
 * Shows page title, search trigger (Cmd+K), connection status, and user avatar.
 */
export default function TopBar({
  title = "Dashboard",
  connected,
  userImage,
  onMenuClick,
  chatOpen,
  onChatToggle,
}: TopBarProps) {
  const router = useRouter();
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

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

  const handleSearchClick = () => {
    // Open the universal Quick Capture
    window.dispatchEvent(new CustomEvent("chronai-open-quick-capture"));
  };

  // Close dropdown on click outside
  useEffect(() => {
    if (!actionsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionsOpen]);

  const handleActionClick = (action: (typeof quickActions)[number]) => {
    setActionsOpen(false);
    if (action.href) {
      router.push(action.href);
    } else if (action.label === "Start Pomodoro") {
      // Dispatch a custom event that PomodoroTimer can listen for
      window.dispatchEvent(new CustomEvent("chronai-start-focus"));
    }
  };

  const handleQuickCapture = () => {
    setActionsOpen(false);
    // QuickCapture lives inside AIContextProvider (TopBar is outside it), so
    // bridge the open request via a window CustomEvent like chronai-open-chat.
    window.dispatchEvent(new CustomEvent("chronai-open-quick-capture"));
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-[100] flex h-14 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg)]/90 px-4 backdrop-blur-sm md:px-6"
    >
      {/* Left section: mobile menu + page title */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <motion.button
            onClick={onMenuClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="rounded-lg p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] md:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} strokeWidth={1.5} />
          </motion.button>
        )}
        <motion.h1
          key={title}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="text-base font-semibold text-[var(--text-primary)]"
        >
          {title}
        </motion.h1>
      </div>

      {/* Right section: actions, search, chat, connection, avatar */}
      <div className="flex items-center gap-3">
        {/* Quick Actions "+" button */}
        <div className="relative" ref={actionsRef}>
          <motion.button
            onClick={() => setActionsOpen((o) => !o)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center justify-center rounded-lg p-2 border border-[var(--border)] bg-[var(--surface)] transition-colors hover:bg-[var(--surface-hover)] ${
              actionsOpen
                ? "text-accent-500"
                : "text-[var(--text-secondary)]"
            }`}
            aria-label="Quick actions"
          >
            <Plus size={16} strokeWidth={1.5} />
          </motion.button>

          <AnimatePresence>
            {actionsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-full mt-2 z-[999] border border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-lg p-2 min-w-[200px]"
              >
                {/* Universal Quick Capture — primary, frictionless capture */}
                <button
                  onClick={handleQuickCapture}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Sparkles size={16} strokeWidth={1.5} className="text-accent-500 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
                    Quick Capture
                  </span>
                  <kbd className="rounded-md bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
                    n
                  </kbd>
                </button>

                <div className="my-1 h-px bg-[var(--border-subtle)]" />

                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => handleActionClick(action)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <Icon size={16} strokeWidth={1.5} className="text-accent-500 shrink-0" />
                      <span className="text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
                        {action.label}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search / Command Palette trigger */}
        <motion.button
          onClick={handleSearchClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-tertiary)] transition-all duration-200 hover:border-[var(--text-tertiary)]/30 hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)] hover:shadow-sm sm:flex"
        >
          <Search size={14} strokeWidth={1.5} />
          <span>Search</span>
          <kbd className="ml-2 rounded-md bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
            &#8984;K
          </kbd>
        </motion.button>

        {/* AI Chat toggle */}
        {onChatToggle && (
          <motion.button
            onClick={onChatToggle}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative flex items-center justify-center rounded-lg p-2 border border-[var(--border)] bg-[var(--surface)] transition-colors hover:bg-[var(--surface-hover)] ${
              chatOpen
                ? "text-accent-500"
                : "text-[var(--text-secondary)]"
            }`}
            aria-label={chatOpen ? "Close AI chat" : "Open AI chat"}
          >
            <MessageCircle size={16} strokeWidth={1.5} />
            <span className="absolute -top-1 -right-1 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-accent-500/20">
              <Sparkles size={8} className="text-accent-500" />
            </span>
          </motion.button>
        )}

        {/* Notification bell + inbox */}
        <NotificationBell />

        {/* Connection status indicator */}
        <div
          className="flex items-center gap-1.5 rounded-full px-2 py-1"
          title={connectionLabel}
        >
          <span
            className={`h-2 w-2 rounded-full ${connectionColor} shadow-sm`}
          />
        </div>

        {/* User avatar */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          {userImage ? (
            <Image
              src={userImage}
              alt="User avatar"
              width={30}
              height={30}
              className="rounded-full ring-2 ring-[var(--border)] ring-offset-1 ring-offset-[var(--bg)] transition-all hover:ring-accent-500/30"
            />
          ) : (
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent-500/15 text-xs font-semibold text-accent-400 ring-2 ring-[var(--border)] ring-offset-1 ring-offset-[var(--bg)]">
              U
            </div>
          )}
        </motion.div>
      </div>
    </motion.header>
  );
}
