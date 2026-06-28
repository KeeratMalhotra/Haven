"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Trash2, X, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import type { NotificationItem } from "@/lib/api-extended";

/** Format an ISO timestamp as a short relative label (e.g. "5m ago"). */
function relativeTime(iso: string): string {
  try {
    const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
    if (Number.isNaN(d.getTime())) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

/** True when the timestamp falls on the local "today". */
function isToday(iso: string): boolean {
  try {
    const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
}

function NotificationRow({
  notification,
  onAction,
  onRemove,
  onMarkRead,
}: {
  notification: NotificationItem;
  onAction: (n: NotificationItem) => void;
  onRemove: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const { title, message, action, read, created_at } = notification;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative rounded-xl border px-3.5 py-3 transition-colors ${
        read
          ? "border-[var(--border-subtle)] bg-transparent"
          : "border-accent-500/20 bg-accent-500/[0.05]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Unread dot */}
        <span
          className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
            read ? "bg-transparent" : "bg-accent-500"
          }`}
        />
        <div className="min-w-0 flex-1">
          {title && (
            <p className="text-[13px] font-medium text-[var(--text-primary)]">
              {title}
            </p>
          )}
          <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {message}
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-[11px] text-[var(--text-tertiary)]">
              {relativeTime(created_at)}
            </span>
            {action && action.kind !== "none" && (
              <button
                onClick={() => onAction(notification)}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-500 transition-colors hover:text-accent-400"
              >
                <Sparkles size={11} strokeWidth={1.5} />
                {action.label}
              </button>
            )}
            {!read && (
              <button
                onClick={() => onMarkRead(notification.id)}
                className="text-[12px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
              >
                Mark read
              </button>
            )}
          </div>
        </div>
        {/* Delete */}
        <button
          onClick={() => onRemove(notification.id)}
          className="shrink-0 rounded-md p-1 text-[var(--text-tertiary)] opacity-0 transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)] group-hover:opacity-100"
          aria-label="Remove notification"
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      </div>
    </motion.div>
  );
}

/**
 * NotificationBell
 * Bell icon with an unread-count badge that opens a calm, matte inbox panel.
 * Notifications are grouped Today / Earlier, unread highlighted, each with its
 * one-tap action still available. Firestore-backed via the notification context.
 */
export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    remove,
    clearAll,
    runAction,
    refresh,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Pull a fresh copy whenever the panel is opened.
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleAction = (n: NotificationItem) => {
    runAction(n);
    setOpen(false);
  };

  const todays = notifications.filter((n) => isToday(n.created_at));
  const earlier = notifications.filter((n) => !isToday(n.created_at));

  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div className="relative" ref={panelRef}>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative flex items-center justify-center rounded-lg p-2 border border-[var(--border)] bg-[var(--surface)] transition-colors hover:bg-[var(--surface-hover)] ${
          open ? "text-accent-500" : "text-[var(--text-secondary)]"
        }`}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
      >
        <Bell size={16} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-semibold leading-none text-white"
          >
            {badge}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-500">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    title="Mark all read"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
                  >
                    <CheckCheck size={13} strokeWidth={1.5} />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    title="Clear all"
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[420px] overflow-y-auto p-2.5">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-hover)]">
                    <Check
                      size={18}
                      strokeWidth={1.5}
                      className="text-[var(--text-tertiary)]"
                    />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    You&apos;re all caught up
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    I&apos;ll let you know if anything needs you.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todays.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="px-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                        Today
                      </p>
                      <AnimatePresence mode="popLayout">
                        {todays.map((n) => (
                          <NotificationRow
                            key={n.id}
                            notification={n}
                            onAction={handleAction}
                            onRemove={remove}
                            onMarkRead={markRead}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                  {earlier.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="px-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                        Earlier
                      </p>
                      <AnimatePresence mode="popLayout">
                        {earlier.map((n) => (
                          <NotificationRow
                            key={n.id}
                            notification={n}
                            onAction={handleAction}
                            onRemove={remove}
                            onMarkRead={markRead}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
