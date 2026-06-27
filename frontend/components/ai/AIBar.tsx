"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ChevronDown, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatSocket } from "@/hooks/useChatSocket";
import { startListening } from "@/lib/voice";
import MessageBubble from "./MessageBubble";
import ThinkingIndicator from "./ThinkingIndicator";

export default function AIBar() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? "";

  const { messages, thinking, statusLabel, send } = useChatSocket({
    accessToken,
  });

  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-expand when messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setExpanded(true);
    }
  }, [messages.length]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (expanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, thinking, expanded]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    send(trimmed, "chat");
    setInput("");
  }, [input, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleMic = useCallback(async () => {
    if (listening) return;
    setListening(true);
    try {
      const transcript = await startListening();
      if (transcript) {
        send(transcript, "voice");
      }
    } catch {
      // Voice recognition failed or was cancelled
    } finally {
      setListening(false);
    }
  }, [listening, send]);

  return (
    <div className="border-t border-border bg-card shadow-sm">
      {/* Expanded message panel */}
      <AnimatePresence>
        {expanded && messages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                ChronAI Chat
              </span>
              <button
                onClick={() => setExpanded(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Collapse chat"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
              <div className="flex flex-col gap-3">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {thinking && <ThinkingIndicator statusLabel={statusLabel} />}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        {/* Expand trigger when collapsed and there are messages */}
        {!expanded && messages.length > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Expand chat"
          >
            <ChevronDown className="h-4 w-4 rotate-180" />
          </button>
        )}

        <div className="relative flex flex-1 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ChronAI anything..."
            className="h-10 w-full rounded-full border border-input bg-background px-4 pr-20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          <div className="absolute right-1 flex items-center gap-1">
            <button
              onClick={handleMic}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                listening
                  ? "bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-label={listening ? "Listening..." : "Voice input"}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
