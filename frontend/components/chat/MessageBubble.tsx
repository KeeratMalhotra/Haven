"use client";

interface MessageBubbleProps {
  content: string;
  role: "user" | "ai";
  agent?: string;
  timestamp?: Date;
}

export default function MessageBubble({
  content,
  role,
  agent,
  timestamp,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-neon-cyan/10 border border-neon-cyan/30 text-white"
            : "bg-dark-700 border border-dark-600 text-gray-200"
        }`}
      >
        {/* Agent name badge */}
        {!isUser && agent && (
          <div className="text-xs text-neon-purple font-medium mb-1">
            {agent}
          </div>
        )}

        {/* Message content */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <div className="text-xs text-gray-500 mt-1">
            {timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    </div>
  );
}
