"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import MessageBubble from "./MessageBubble";
import ThinkingShimmer from "./ThinkingShimmer";
import type { ChatMessage } from "@/hooks/useChatSocket";

interface MessageListProps {
  messages: ChatMessage[];
  thinking: boolean;
  statusLabel: string;
  onStreamComplete: (id: string) => void;
}

export default function MessageList({
  messages,
  thinking,
  statusLabel,
  onStreamComplete,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking, statusLabel]);

  return (
    <div className="scroll-thin mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-40 pt-10">
      <AnimatePresence initial={false}>
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onStreamComplete={onStreamComplete}
          />
        ))}
      </AnimatePresence>

      {thinking && (
        <div className="flex w-full justify-start">
          <div className="flex max-w-[88%] gap-3 pl-5">
            <ThinkingShimmer label={statusLabel} />
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
