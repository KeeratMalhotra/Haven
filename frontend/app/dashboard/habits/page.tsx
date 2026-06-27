"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

export default function HabitsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
          <Flame size={20} className="text-success-500" />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Habits
        </h1>
      </div>
      <p className="mt-3 text-sm text-[var(--text-tertiary)]">
        Your habits and streaks will appear here. This page is being built.
      </p>
    </motion.div>
  );
}
