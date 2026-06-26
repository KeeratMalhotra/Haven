"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

const GREETINGS = [
  "What's on your mind today?",
  "How can I help you focus?",
  "Where should we begin?",
  "What would you like to plan?",
  "Let's make today count.",
  "What's next for you?",
];

/**
 * GreetingHero
 * A huge, soft gradient greeting centered on the canvas. It dissolves upward
 * (handled by the parent via AnimatePresence) the moment a conversation starts.
 */
export default function GreetingHero({ name }: { name?: string }) {
  const greeting = useMemo(
    () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -56, scale: 0.97, filter: "blur(8px)" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none flex flex-col items-center justify-center px-6 text-center"
    >
      {name && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-5 font-mono text-xs uppercase tracking-[0.35em] text-white/35"
        >
          Hello, {name.split(" ")[0]}
        </motion.p>
      )}
      <h1 className="gradient-text-soft max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
        {greeting}
      </h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.6 }}
        className="mt-6 max-w-md text-base text-white/40"
      >
        Ask anything, or open a panel to see your day take shape.
      </motion.p>
    </motion.div>
  );
}
