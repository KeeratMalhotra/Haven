"use client";

import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import AmbientBackground from "@/components/ui/AmbientBackground";

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.9 36 44 30.6 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-base-950">
      <AmbientBackground />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mb-8 flex items-center gap-2"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-accent-gradient shadow-glow" />
          <span className="font-mono text-xs uppercase tracking-[0.4em] text-white/40">
            ChronAI
          </span>
        </motion.div>

        <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
          A calmer way to
          <br />
          <span className="gradient-text-soft">move through your day</span>
        </h1>

        <p className="mt-7 max-w-md text-lg text-white/45">
          An intelligent companion for your time, tasks, and intentions — quiet
          until you need it, present when you do.
        </p>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="group mt-10 flex items-center gap-3 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-base-950 shadow-panel transition-shadow hover:shadow-glow"
        >
          <GoogleGlyph />
          Continue with Google
        </motion.button>

        <p className="mt-6 font-mono text-[11px] tracking-wide text-white/25">
          Private by design · You stay in control
        </p>
      </motion.div>

      {/* faint bottom gradient line */}
      <div className="absolute bottom-0 left-1/2 z-10 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </main>
  );
}
