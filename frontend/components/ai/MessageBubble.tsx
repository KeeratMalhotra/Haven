"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/useChatSocket";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          message.isError && "bg-destructive/10 text-destructive"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.streaming && (
          <span className="ml-1 inline-block h-3 w-1 animate-pulse rounded-sm bg-current opacity-70" />
        )}
      </div>
    </div>
  );
}
