"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/hooks/useChatSocket";

interface MessageBubbleProps {
  message: ChatMessage;
  onStreamComplete?: (id: string) => void;
}

/** Renders markdown content with appropriate styling for AI messages. */
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-3 mt-4 text-xl font-bold text-[var(--text-primary)] dark:text-[#ece9e4] first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-lg font-semibold text-[var(--text-primary)] dark:text-[#ece9e4] first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-3 text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4] first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mb-2 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className={`block text-sm ${className || ""}`}>
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-sm font-mono text-accent-500">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm last:mb-0">
            {children}
          </pre>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-500 underline decoration-accent-500/30 hover:decoration-accent-500"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-accent-500/40 pl-3 italic text-[var(--text-secondary)] dark:text-[#a8a39c] last:mb-0">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-[var(--border)]" />,
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-[var(--border)] px-3 py-1.5">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/**
 * Reveals AI text token-by-token to create a calm "streaming" feel, even though
 * the backend delivers the full answer in one frame. User messages render instantly.
 *
 * For truly streamed messages (content growing via chunks from the backend),
 * the typewriter interval is skipped and revealed content tracks props directly.
 */
export default function MessageBubble({
  message,
  onStreamComplete,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const shouldStream = !isUser && message.streaming;
  const [revealed, setRevealed] = useState(shouldStream ? "" : message.content);
  const completedRef = useRef(false);
  const prevContentRef = useRef(message.content);
  const isExternallyStreamingRef = useRef(false);

  // Detect externally streamed messages: if content grows between renders while
  // streaming is true, we are receiving real-time chunks from the backend.
  useEffect(() => {
    if (shouldStream && message.content !== prevContentRef.current) {
      // Content changed externally (new chunk arrived) -- render directly
      isExternallyStreamingRef.current = true;
      setRevealed(message.content);
    }
    prevContentRef.current = message.content;
  }, [message.content, shouldStream]);

  // When streaming becomes false (text_end received), fire onStreamComplete
  useEffect(() => {
    if (!message.streaming && isExternallyStreamingRef.current && !completedRef.current) {
      completedRef.current = true;
      onStreamComplete?.(message.id);
    }
  }, [message.streaming, message.id, onStreamComplete]);

  useEffect(() => {
    if (!shouldStream) {
      setRevealed(message.content);
      return;
    }

    // If this message is being externally streamed, don't run the interval
    if (isExternallyStreamingRef.current) {
      return;
    }

    // Client-side typewriter for non-streamed full responses
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
        <div className="max-w-[78%] rounded-2xl rounded-br-md border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5 text-[15px] leading-relaxed text-[var(--text-primary)] dark:text-[#ece9e4]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      ) : (
        <div className="flex max-w-[88%] gap-3">
          {/* AI presence dot */}
          <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
          <div
            className={`text-[15px] leading-relaxed ${
              message.isError
                ? "text-rose-400"
                : "text-[var(--text-primary)] dark:text-[#ece9e4]"
            }`}
          >
            <div
              className={
                shouldStream && revealed !== message.content
                  ? "stream-caret"
                  : ""
              }
            >
              <MarkdownContent content={revealed} />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
