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
  const pendingActionRef = useRef<{
    actionType: string;
    actionData: Record<string, any>;
  } | null>(null);

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

    // Auto-remove after 12 seconds
    setTimeout(() => {
      setSuggestions((prev) => prev.filter((s) => s.id !== notification.id));
    }, 12000);
  }, []);

  const reportAction = useCallback(
    (actionType: string, actionData: Record<string, any>) => {
      pendingActionRef.current = { actionType, actionData };

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        const pending = pendingActionRef.current;
        if (!pending) return;

        const accessToken = (session as any)?.accessToken;
        if (!accessToken) return;

        try {
          const result = await fetchContextSuggestion(
            accessToken,
            pending.actionType,
            pending.actionData
          );

          if (result.suggestion) {
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
          // Silently fail - AI suggestions are non-critical
        }

        pendingActionRef.current = null;
      }, 500);
    },
    [session]
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
