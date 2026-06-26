"use client";

import { motion } from "framer-motion";
import SettingsMenu from "@/components/settings/SettingsMenu";

interface TopBarProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  connected?: boolean;
}

/**
 * TopBar
 * A whisper-quiet top bar: the ChronAI wordmark on the left, a subtle live
 * connection indicator, and the account/settings avatar on the right.
 */
export default function TopBar({ name, email, image, connected }: TopBarProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-4"
    >
      <div className="pointer-events-auto flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-accent-gradient shadow-glow" />
        <span className="text-base font-semibold tracking-tight text-white">
          Chron<span className="gradient-text">AI</span>
        </span>
        <span
          className={`ml-2 hidden items-center gap-1.5 sm:flex`}
          title={connected ? "Connected" : "Reconnecting"}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              connected
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                : "animate-pulse bg-amber-400"
            }`}
          />
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
            {connected ? "Live" : "Linking"}
          </span>
        </span>
      </div>

      <div className="pointer-events-auto">
        <SettingsMenu name={name} email={email} image={image} />
      </div>
    </motion.header>
  );
}
