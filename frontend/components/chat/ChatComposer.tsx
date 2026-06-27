"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, AudioLines } from "lucide-react";

interface ChatComposerProps {
  onSend: (value: string) => void;
  onVoice: () => void;
  centered?: boolean;
  disabled?: boolean;
}

/**
 * ChatComposer
 * The single input affordance. Floats centered under the greeting on the home
 * canvas, then docks to the bottom once a conversation is underway.
 */
export default function ChatComposer({
  onSend,
  onVoice,
  centered = false,
  disabled = false,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  return (
    <motion.div
      layout
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`w-full ${centered ? "max-w-2xl" : "max-w-3xl"}`}
    >
      <div
        className={`relative flex items-end gap-2 rounded-2xl border bg-[var(--surface)] p-2 pl-5 transition-all duration-300 ${
          focused
            ? "border-[var(--border-focus)]"
            : "border-[var(--border)]"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message ChronAI"
          className="max-h-[200px] flex-1 resize-none self-center bg-transparent py-2.5 text-[15px] leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none scroll-thin"
        />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onVoice}
            aria-label="Start voice conversation"
            className="grid h-10 w-10 place-items-center rounded-xl text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-accent-500"
          >
            <AudioLines size={19} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Send message"
            className="grid h-10 w-10 place-items-center rounded-xl bg-accent-500 text-white transition-all enabled:hover:brightness-110 disabled:opacity-25 disabled:saturate-0"
          >
            <ArrowUp size={19} strokeWidth={2.2} />
          </button>
        </div>
      </div>
      <p className="mt-2.5 text-center font-mono text-[10px] tracking-wide text-[var(--text-tertiary)]">
        ChronAI can make mistakes. Press the wave to talk.
      </p>
    </motion.div>
  );
}
