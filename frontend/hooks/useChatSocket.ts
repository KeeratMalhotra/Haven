"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WebSocketClient } from "@/lib/ws";
import { playAudioBase64 } from "@/lib/voice";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: number;
  streaming?: boolean;
  isError?: boolean;
}

export type ConnectionState = "connecting" | "connected" | "disconnected";

interface IncomingMessage {
  type: "text" | "audio" | "status" | "error" | "task_update";
  content: string;
  agent?: string;
}

/**
 * Internal terms that must never surface in the UI. We translate raw backend
 * status/agent chatter into calm, human-friendly progress text.
 */
const INTERNAL_TERMS = [
  "orchestrator",
  "planner",
  "scheduler",
  "notification",
  "agent",
  "registry",
  "mcp",
  "voice agent",
  "email agent",
];

/**
 * Map a raw status payload to a friendly, abstract progress label.
 * Never exposes agent/orchestrator/scheduler names.
 */
export function humanizeStatus(raw: string | undefined): string {
  const text = (raw || "").trim();
  const lower = text.toLowerCase();

  if (lower.includes("calendar")) return "Checking your calendar";
  if (lower.includes("event")) return "Looking at your schedule";
  if (lower.includes("task") || lower.includes("todo"))
    return "Organizing your tasks";
  if (lower.includes("schedul") || lower.includes("time"))
    return "Finding the right time";
  if (lower.includes("habit")) return "Reviewing your habits";
  if (lower.includes("goal")) return "Aligning with your goals";
  if (
    lower.includes("email") ||
    lower.includes("gmail") ||
    lower.includes("inbox")
  )
    return "Looking through your inbox";

  // If the status contains only internal jargon, fall back to a calm default.
  const containsInternal = INTERNAL_TERMS.some((t) => lower.includes(t));
  if (!text || containsInternal) return "Thinking it through";

  // Otherwise it's already a human-friendly phrase — trim trailing dots.
  return text.replace(/[.\u2026]+$/, "");
}

interface UseChatSocketOptions {
  accessToken: string;
  onAudio?: (base64: string) => void;
}

export function useChatSocket({ accessToken, onAudio }: UseChatSocketOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [statusLabel, setStatusLabel] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  const wsRef = useRef<WebSocketClient | null>(null);
  const tokenRef = useRef(accessToken);
  const onAudioRef = useRef(onAudio);

  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    onAudioRef.current = onAudio;
  }, [onAudio]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
    const ws = new WebSocketClient(wsUrl);
    wsRef.current = ws;

    ws.on("open", () => setConnection("connected"));
    ws.on("close", () => setConnection("disconnected"));

    ws.on("message", (data: IncomingMessage) => {
      if (data.type === "text" || data.type === "task_update") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "ai",
            content: data.content,
            timestamp: Date.now(),
            streaming: true,
          },
        ]);
        setThinking(false);
        setStatusLabel("");
      } else if (data.type === "status") {
        setThinking(true);
        setStatusLabel(humanizeStatus(data.content));
      } else if (data.type === "error") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "ai",
            content: data.content,
            timestamp: Date.now(),
            isError: true,
          },
        ]);
        setThinking(false);
        setStatusLabel("");
      } else if (data.type === "audio") {
        if (onAudioRef.current) onAudioRef.current(data.content);
        else playAudioBase64(data.content);
      }
    });

    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, []);

  const send = useCallback(
    (content: string, type: "chat" | "voice" = "chat") => {
      const trimmed = content.trim();
      if (!trimmed || !wsRef.current) return;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: trimmed,
          timestamp: Date.now(),
        },
      ]);

      wsRef.current.send({
        type,
        content: trimmed,
        auth_token: tokenRef.current || "",
      });

      setThinking(true);
      setStatusLabel("");
    },
    []
  );

  /** Mark a streaming message as fully revealed (used by the typewriter UI). */
  const finishStreaming = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, streaming: false } : m))
    );
  }, []);

  return {
    messages,
    thinking,
    statusLabel,
    connection,
    send,
    finishStreaming,
    hasMessages: messages.length > 0,
  };
}
