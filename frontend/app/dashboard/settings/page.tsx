"use client";

import { motion } from "framer-motion";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-500/10">
          <Settings size={20} className="text-gray-500" />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Settings
        </h1>
      </div>
      <p className="mt-3 text-sm text-[var(--text-tertiary)]">
        Your preferences and account settings will appear here. This page is being built.
      </p>
    </motion.div>
  );
}
