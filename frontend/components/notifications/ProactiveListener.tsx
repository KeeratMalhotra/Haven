"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAI } from "@/components/ai/AIContextProvider";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";
import { fetchProactiveCheck, setProactiveFocus } from "@/lib/api-extended";

// How often to ask the backend for fresh interventions (ms). Conservative on
// purpose — better to nudge rarely and perfectly than often and annoyingly.
const CHECK_INTERVAL_MS = 10 * 60_000;

/**
 * ProactiveListener
 * Runs inside the AI context. It:
 *   - keeps the realtime notification socket alive (gentle toasts + inbox sync);
 *   - periodically asks the proactive engine what to surface, showing Tier 2+
 *     nudges as calm toasts (they're already persisted to the inbox server-side);
 *   - tracks Pomodoro session state so nudges are suppressed mid-flow.
 * Renders nothing.
 */
export default function ProactiveListener() {
  // Keep the existing realtime push channel running.
  useNotificationSocket();

  const { data: session } = useSession();
  const { addNotification } = useAI();
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";

  // Live Pomodoro session flag (set by PomodoroTimer via window events).
  const focusActiveRef = useRef(false);
  // Interventions we've already surfaced this session (avoid re-toasting).
  const shownRef = useRef<Set<string>>(new Set());

  // Track Pomodoro sessions and mirror the state to the backend so the engine
  // suppresses nudges while the user is in flow.
  useEffect(() => {
    const onStart = () => {
      focusActiveRef.current = true;
      if (accessToken) setProactiveFocus(accessToken, true);
    };
    const onStop = () => {
      focusActiveRef.current = false;
      if (accessToken) setProactiveFocus(accessToken, false);
    };
    window.addEventListener("chronai-start-focus", onStart);
    window.addEventListener("chronai-stop-focus", onStop);
    return () => {
      window.removeEventListener("chronai-start-focus", onStart);
      window.removeEventListener("chronai-stop-focus", onStop);
    };
  }, [accessToken]);

  // Listen for real-time proactive nudges pushed via the chat WebSocket.
  useEffect(() => {
    const handleNudge = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || !detail.content) return;

      // Defense-in-depth: suppress non-emergency nudges if the frontend is in
      // focus mode, even if the backend's stored state drifted momentarily.
      if (focusActiveRef.current && (detail.tier || 0) < 3) return;

      const nudgeId =
        detail.notification_id ||
        `push-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      if (shownRef.current.has(nudgeId)) return;
      shownRef.current.add(nudgeId);

      addNotification({
        id: `proactive-${nudgeId}`,
        text: detail.content,
        type: detail.tier >= 3 ? "warning" : "info",
        actions: detail.action
          ? [{ label: detail.action.label, action: detail.action.kind }]
          : [],
        timestamp: Date.now(),
        dismissed: false,
      });

      window.dispatchEvent(new CustomEvent("chronai-notifications-changed"));
    };

    window.addEventListener("chronai-proactive-nudge", handleNudge);
    return () => {
      window.removeEventListener("chronai-proactive-nudge", handleNudge);
    };
  }, [addNotification]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    const runCheck = async () => {
      // Respect Pomodoro mode on the client too — don't even ask while in flow.
      if (focusActiveRef.current) return;
      const { interventions } = await fetchProactiveCheck(
        accessToken,
        focusActiveRef.current
      );
      if (cancelled || !interventions || interventions.length === 0) return;

      let surfaced = false;
      for (const iv of interventions) {
        if (shownRef.current.has(iv.id)) continue;
        shownRef.current.add(iv.id);
        surfaced = true;
        addNotification({
          id: `proactive-${iv.id}`,
          text: iv.message,
          type: iv.tier >= 3 ? "warning" : "info",
          actions: iv.action
            ? [{ label: iv.action.label, action: iv.action.kind }]
            : [],
          timestamp: Date.now(),
          dismissed: false,
        });
      }

      if (surfaced) {
        // Newly delivered nudges were persisted to the inbox; refresh the bell.
        window.dispatchEvent(new CustomEvent("chronai-notifications-changed"));
      }
    };

    // Slight delay on first run so it doesn't compete with initial page load.
    const initial = setTimeout(runCheck, 4000);
    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [accessToken, addNotification]);

  return null;
}
