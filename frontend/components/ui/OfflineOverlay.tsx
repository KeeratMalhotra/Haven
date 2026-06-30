"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";

export default function OfflineOverlay() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--bg)]"
          role="alert"
          aria-live="assertive"
        >
          {/* Pixel grid background */}
          <div className="absolute inset-0 pixel-grid opacity-60" />

          {/* Ambient warm blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[20vh] -left-[10vw] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(232,168,124,0.15),transparent_65%)] blur-[100px]" />
            <div className="absolute -bottom-[20vh] -right-[10vw] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(129,140,248,0.1),transparent_65%)] blur-[100px]" />
          </div>

          {/* Grain texture */}
          <div className="grain-fixed" />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative z-10 flex flex-col items-center gap-6 px-6 text-center max-w-md"
          >
            {/* Pixel-art cabin icon area */}
            <motion.div
              className="pixel-panel bg-[var(--surface)] p-6 flex items-center justify-center"
              animate={{ y: [0, -4, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <WifiOff
                size={48}
                className="text-[var(--warm)] opacity-80"
                strokeWidth={1.5}
              />
            </motion.div>

            {/* Heading */}
            <h1 className="font-pixel text-2xl sm:text-3xl text-[var(--text-primary)] tracking-wide">
              Looks like you&apos;re offline
            </h1>

            {/* Subtext */}
            <p className="font-terminal text-lg text-[var(--text-secondary)] leading-relaxed max-w-sm">
              Haven needs an internet connection to keep your day running
              smoothly. We&apos;ll bring you right back once you reconnect.
            </p>

            {/* Pixel-styled waiting indicator */}
            <div className="flex items-center gap-2 mt-4">
              <motion.span
                className="inline-block w-2 h-2 bg-[var(--warm)] pixel-corners"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: 0 }}
              />
              <motion.span
                className="inline-block w-2 h-2 bg-[var(--warm)] pixel-corners"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
              />
              <motion.span
                className="inline-block w-2 h-2 bg-[var(--warm)] pixel-corners"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }}
              />
            </div>

            <p className="font-terminal text-sm text-[var(--text-tertiary)] mt-2">
              Waiting for connection...
            </p>
          </motion.div>

          {/* CRT scanlines for retro feel */}
          <div className="absolute inset-0 pixel-scanlines pointer-events-none opacity-30" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
