"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ChatMessage } from "@/hooks/useChatSocket";

interface MessageBubbleProps {
  message: ChatMessage;
  onStreamComplete?: (id: string) => void;
}

/**
 * Reveals AI text token-by-token to create a calm "streaming" feel, even though
 * the backend delivers the full answer in one frame. User messages render instantly.
 */
export default function MessageBubble({
  message,
  onStreamComplete,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const shouldStream = !isUser && message.streaming;
  const [revealed, setRevealed] = useState(shouldStream ? "" : message.content);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!shouldStream) {
      setRevealed(message.content);
      return;
    }

    const tokens = message.content.split(/(\s+)/); // keep whitespace tokens
    let i = 0;
    let current = "";
    const interval = window.setInterval(() => {
      if (i >= tokens.length) {
        window.clearInterval(interval);
        if (!completedRef.current) {
          completedRef.current = true;
          onStreamComplete?.(message.id);
        }
        return;
      }
      current += tokens[i];
      i += 1;
      setRevealed(current);
    }, 22);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      {isUser ? (
        <div className="max-w-[78%] rounded-2xl rounded-br-md bg-white/[0.06] px-4 py-2.5 text-[15px] leading-relaxed text-white/90 ring-1 ring-white/10">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      ) : (
        <div className="flex max-w-[88%] gap-3">
          {/* AI presence dot */}
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-accent-magenta to-accent-cyan shadow-glow" />
          <div
            className={`text-[15px] leading-relaxed ${
              message.isError ? "text-rose-300/90" : "text-white/85"
            }`}
          >
            <p
              className={`whitespace-pre-wrap ${
                shouldStream && revealed !== message.content
                  ? "stream-caret"
                  : ""
              }`}
            >
              {revealed}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
