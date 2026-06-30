"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { fetchContextSuggestion } from "@/lib/api-extended";

export interface AISuggestion {
  id: string;
  text: string;
  type: "info" | "action" | "warning";
  actions?: { label: string; action: string }[];
  timestamp: number;
  dismissed: boolean;
}

interface AIContextValue {
  reportAction: (actionType: string, actionData: Record<string, any>) => void;
  suggestions: AISuggestion[];
  dismissSuggestion: (id: string) => void;
  addNotification: (notification: AISuggestion) => void;
}

const AIContext = createContext<AIContextValue>({
  reportAction: () => {},
  suggestions: [],
  dismissSuggestion: () => {},
  addNotification: () => {},
});

export function AIContextProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionQueueRef = useRef<
    Array<{ actionType: string; actionData: Record<string, any> }>
  >([]);
  // Deduplication: track recently fired suggestion keys with cooldown (5 minutes)
  const firedSuggestionsRef = useRef<Map<string, number>>(new Map());

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, dismissed: true } : s))
    );
    // Remove after animation completes
    setTimeout(() => {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    }, 300);
  }, []);

  const addNotification = useCallback((notification: AISuggestion) => {
    setSuggestions((prev) => [...prev, notification]);

    // Auto-remove after 30 seconds
    setTimeout(() => {
      setSuggestions((prev) => prev.filter((s) => s.id !== notification.id));
    }, 30000);
  }, []);

  const reportAction = useCallback(
    (actionType: string, actionData: Record<string, any>) => {
      // ---- Local heuristic suggestions (fire immediately, no backend needed) ----
      const SUGGESTION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

      const fireLocal = (key: string, text: string, type: "info" | "action" | "warning") => {
        // Check deduplication cooldown
        const now = Date.now();
        const lastFired = firedSuggestionsRef.current.get(key);
        if (lastFired && now - lastFired < SUGGESTION_COOLDOWN_MS) {
          return; // Suppress duplicate within cooldown window
        }
        firedSuggestionsRef.current.set(key, now);

        // Clean up old entries to prevent unbounded growth
        if (firedSuggestionsRef.current.size > 100) {
          for (const [k, t] of firedSuggestionsRef.current) {
            if (now - t > SUGGESTION_COOLDOWN_MS) {
              firedSuggestionsRef.current.delete(k);
            }
          }
        }

        // Add a random delay (2-4s) so suggestions feel like the AI "thought about it"
        const delay = 2000 + Math.random() * 2000;
        setTimeout(() => {
          const localSuggestion: AISuggestion = {
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            text,
            type,
            actions: [],
            timestamp: Date.now(),
            dismissed: false,
          };
          addNotification(localSuggestion);
        }, delay);
      };

      // Task without deadline
      if (
        (actionType === "task_created" || actionType === "task_viewed") &&
        !actionData.due &&
        !actionData.deadline
      ) {
        const dedupKey = `no_deadline-${actionData.id || actionType}`;
        fireLocal(
          dedupKey,
          "This task has no deadline. Consider setting one for better planning.",
          "info"
        );
      }

      // Task dragged/moved
      if (actionType === "task_dragged" || actionType === "task_moved") {
        const dedupKey = `task_moved-${actionData.id || actionType}`;
        fireLocal(
          dedupKey,
          "Task moved! Need help rescheduling related events?",
          "action"
        );
      }

      // Event created with overlap
      if (actionType === "event_created" && actionData.overlap) {
        const dedupKey = `event_overlap-${actionData.id || actionData.summary || actionType}`;
        fireLocal(
          dedupKey,
          "Heads up: this event may overlap with another on your calendar.",
          "warning"
        );
      }

      // Multiple overdue tasks
      if (
        Array.isArray(actionData.overdueTasks) &&
        actionData.overdueTasks.length >= 3
      ) {
        const dedupKey = `overdue_tasks-${actionData.overdueTasks.length}`;
        fireLocal(
          dedupKey,
          "You have several overdue tasks. Want help catching up?",
          "warning"
        );
      }

      // ---- Backend call (debounced, non-blocking) ----
      // Queue the action instead of overwriting (batch approach)
      actionQueueRef.current.push({ actionType, actionData });

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        const batch = actionQueueRef.current;
        actionQueueRef.current = [];
        if (batch.length === 0) return;

        const accessToken = (session as any)?.accessToken;
        if (!accessToken) return;

        // Send the most recent action as primary, with earlier actions in context
        const primary = batch[batch.length - 1];
        const contextActions = batch.length > 1 ? batch.slice(0, -1) : [];

        try {
          const result = await fetchContextSuggestion(
            accessToken,
            primary.actionType,
            primary.actionData,
            contextActions.length > 0
              ? {
                  recentActions: contextActions.map((a) => ({
                    type: a.actionType,
                    data: a.actionData,
                  })),
                }
              : undefined
          );

          if (result && result.suggestion) {
            const newSuggestion: AISuggestion = {
              id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              text: result.suggestion,
              type: (result.type as "info" | "action" | "warning") || "info",
              actions: result.actions || [],
              timestamp: Date.now(),
              dismissed: false,
            };

            setSuggestions((prev) => [...prev, newSuggestion]);

            // Auto-remove after 12 seconds
            setTimeout(() => {
              setSuggestions((prev) =>
                prev.filter((s) => s.id !== newSuggestion.id)
              );
            }, 12000);
          }
        } catch {
          // Silently fail - AI suggestions are non-critical.
          // One failed API call (e.g. PATCH 405) must not prevent future suggestions.
        }
      }, 500);
    },
    [session, addNotification]
  );

  return (
    <AIContext.Provider
      value={{ reportAction, suggestions, dismissSuggestion, addNotification }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  return useContext(AIContext);
}
