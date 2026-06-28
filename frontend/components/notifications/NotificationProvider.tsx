"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  sendProactiveFeedback,
  type NotificationItem,
} from "@/lib/api-extended";

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  /** Run a notification's one-tap action and record positive feedback. */
  runAction: (notification: NotificationItem) => void;
  /** Dismiss a proactive nudge from a toast (records calibration feedback). */
  dismissNudge: (notificationId: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refresh: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
  remove: async () => {},
  clearAll: async () => {},
  runAction: () => {},
  dismissNudge: () => {},
});

// How often to quietly re-sync the inbox with the server (ms).
const POLL_INTERVAL_MS = 60_000;

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(accessToken);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Initial load + polling + refresh when the tab regains focus.
  useEffect(() => {
    if (!accessToken) return;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [accessToken, refresh]);

  // When a proactive check / socket push delivers new notifications, the
  // provider refreshes so the badge and panel stay in sync.
  useEffect(() => {
    const onNew = () => refresh();
    window.addEventListener("chronai-notifications-changed", onNew);
    return () =>
      window.removeEventListener("chronai-notifications-changed", onNew);
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationRead(accessToken, id);
    },
    [accessToken]
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await markAllNotificationsRead(accessToken);
  }, [accessToken]);

  const remove = useCallback(
    async (id: string) => {
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === id);
        if (target) {
          if (!target.read) {
            setUnreadCount((c) => Math.max(0, c - 1));
          }
          // Removing an unread proactive nudge is a soft dismissal — feed it
          // back so future nudge frequency self-calibrates downward.
          if (target.source && !target.read) {
            sendProactiveFeedback(accessToken, false, id);
          }
        }
        return prev.filter((n) => n.id !== id);
      });
      await deleteNotification(accessToken, id);
    },
    [accessToken]
  );

  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    await clearAllNotifications(accessToken);
  }, [accessToken]);

  const dismissNudge = useCallback(
    (notificationId: string) => {
      // A dismissal is calibration signal: nudge a little less next time.
      if (notificationId) {
        sendProactiveFeedback(accessToken, false, notificationId);
      }
    },
    [accessToken]
  );

  const runAction = useCallback(
    (notification: NotificationItem) => {
      const action = notification.action;
      // Acting on a nudge is strong positive signal + marks it handled.
      markRead(notification.id);
      if (notification.source) {
        sendProactiveFeedback(accessToken, true, notification.id);
      }

      if (!action) return;
      switch (action.kind) {
        case "open_chat":
          window.dispatchEvent(
            new CustomEvent("chronai-open-chat", {
              detail: { message: action.message },
            })
          );
          break;
        case "plan_day":
          // Ensure we're on the dashboard, then open the day planner.
          router.push("/dashboard");
          window.dispatchEvent(new CustomEvent("chronai-plan-day"));
          break;
        case "navigate":
          if (action.target) router.push(action.target);
          break;
        case "none":
        default:
          break;
      }
    },
    [accessToken, markRead, router]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refresh,
        markRead,
        markAllRead,
        remove,
        clearAll,
        runAction,
        dismissNudge,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
