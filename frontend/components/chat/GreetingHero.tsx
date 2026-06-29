"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const GREETINGS = [
  "What's on your mind today?",
  "How can I help you focus?",
  "Where should we begin?",
  "What would you like to plan?",
  "Let's make today count.",
  "What's next for you?",
];

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * GreetingHero
 * A clean, matte greeting centered on the canvas. It dissolves upward
 * (handled by the parent via AnimatePresence) the moment a conversation starts.
 */
export default function GreetingHero({ name }: { name?: string }) {
  // Hydration-safe: compute random/time values only on the client
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [timeGreeting, setTimeGreeting] = useState("Hello");

  useEffect(() => {
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    setTimeGreeting(getTimeOfDayGreeting());
  }, []);
  const firstName = name?.split(" ")[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -40, scale: 0.98, filter: "blur(6px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none flex flex-col items-center justify-center px-6 text-center"
    >
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mb-5 font-mono text-xs uppercase tracking-[0.35em] text-[var(--text-tertiary)] dark:text-[#847e76]"
      >
        {firstName ? `${timeGreeting}, ${firstName}` : timeGreeting}
      </motion.p>
      <h1 className="text-[var(--text-primary)] dark:text-[#ece9e4] max-w-3xl text-balance text-2xl font-semibold leading-[1.12] tracking-tight sm:text-3xl md:text-4xl">
        {greeting}
      </h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="mt-6 max-w-md text-base text-[var(--text-tertiary)] dark:text-[#847e76]"
      >
        Ask anything, or open a panel to see your day take shape.
      </motion.p>
    </motion.div>
  );
}
