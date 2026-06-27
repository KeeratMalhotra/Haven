"use client";

import { useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Maximize2, Minimize2 } from "lucide-react";
import ChatExperience from "./ChatExperience";
import { useConnectionState } from "./ConnectionContext";

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  userName?: string;
  detached?: boolean;
  onDetach?: () => void;
  onAttach?: () => void;
}

const SUGGESTIONS = [
  "Plan my day",
  "Prioritize tasks",
  "What's next?",
];

export default function AIChatPanel({
  open,
  onClose,
  accessToken,
  userName,
  detached = false,
  onDetach,
  onAttach,
}: AIChatPanelProps) {
  const { setConnection } = useConnectionState();
  const sendRef = useRef<((content: string) => void) | null>(null);
  const dragConstraintsRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    },
    [open, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSendReady = useCallback((sendFn: (content: string) => void) => {
    sendRef.current = sendFn;
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    if (sendRef.current) {
      sendRef.current(suggestion);
    }
  }, []);

  // Detached floating window mode
  if (detached) {
    return (
      <AnimatePresence>
        {open && (
          <>
            {/* Invisible constraint boundary for drag */}
            <div
              ref={dragConstraintsRef}
              className="fixed inset-0 pointer-events-none z-[89]"
            />
            <motion.div
              key="detached-panel"
              drag
              dragMomentum={false}
              dragConstraints={dragConstraintsRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed z-[90] flex flex-col rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
              style={{
                width: 400,
                height: 550,
                top: "calc(50% - 275px)",
                left: "calc(50% - 200px)",
              }}
            >
            {/* Drag handle / Title bar */}
            <div
              className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 cursor-grab active:cursor-grabbing rounded-t-xl"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-accent-500" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  AI Assistant
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Re-attach button */}
                <button
                  onClick={onAttach}
                  className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  title="Attach to side panel"
                >
                  <Minimize2 size={14} />
                </button>
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Chat body */}
            <div className="flex-1 overflow-hidden">
              <ChatExperience
                accessToken={accessToken}
                userName={userName}
                onConnectionChange={setConnection}
                onSendReady={handleSendReady}
              />
            </div>

            {/* Suggestion chips */}
            <div className="border-t border-[var(--border-subtle)] px-4 py-3 rounded-b-xl">
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="inline-flex items-center rounded-full bg-[var(--surface-hover)] px-3 py-1.5 text-xs text-[var(--text-secondary)] cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Attached slide-from-right panel mode (existing behavior)
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-[81] flex h-full w-[400px] max-w-[90vw] flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-accent-500" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  AI Assistant
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Detach button */}
                <button
                  onClick={onDetach}
                  className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  title="Detach as floating window"
                >
                  <Maximize2 size={14} />
                </button>
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Chat body */}
            <div className="flex-1 overflow-hidden">
              <ChatExperience
                accessToken={accessToken}
                userName={userName}
                onConnectionChange={setConnection}
                onSendReady={handleSendReady}
              />
            </div>

            {/* Suggestion chips */}
            <div className="border-t border-[var(--border-subtle)] px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="inline-flex items-center rounded-full bg-[var(--surface-hover)] px-3 py-1.5 text-xs text-[var(--text-secondary)] cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
