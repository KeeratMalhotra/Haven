"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAI } from "@/components/ai/AIContextProvider";

export function useNotificationSocket() {
  const { data: session } = useSession();
  const { addNotification } = useAI();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const accessToken = (session as { accessToken?: string } | null)?.accessToken;
    if (!accessToken) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

    function connect() {
      if (!mountedRef.current) return;

      // Get a fresh token at connection time to avoid using stale tokens
      const currentToken = (session as { accessToken?: string } | null)?.accessToken;
      if (!currentToken) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send ping with auth token to authenticate
        ws.send(
          JSON.stringify({
            type: "ping",
            auth_token: currentToken,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle auth failure: close and retry with backoff
          if (message.type === "error" && typeof message.content === "string" &&
              message.content.toLowerCase().includes("authentication")) {
            ws.close();
            // Reconnect after a longer delay to allow token refresh
            if (mountedRef.current) {
              reconnectTimeoutRef.current = setTimeout(connect, 10000);
            }
            return;
          }

          if (message.type === "notification") {
            addNotification({
              id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              text: message.content,
              type: message.metadata?.urgency === "critical" ? "warning" : "info",
              actions: [],
              timestamp: Date.now(),
              dismissed: false,
            });
            // A push was also persisted to the inbox server-side; tell the
            // notification provider to re-sync so the bell badge updates.
            try {
              window.dispatchEvent(
                new CustomEvent("chronai-notifications-changed")
              );
            } catch {
              // Non-critical.
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Reconnect after 5 seconds if still mounted
        if (mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      };

      ws.onerror = () => {
        // Error will trigger onclose, which handles reconnection
        ws.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [session, addNotification]);
}
