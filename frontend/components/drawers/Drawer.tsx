"use client";

import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Drawer
 * A frosted-glass panel that glides in from the right edge over the canvas.
 * Dismiss by clicking the backdrop or the X.
 */
export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
}: DrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: "100%", opacity: 0.4 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.4 }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className="glass-strong fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col shadow-panel"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
          >
            {/* gradient accent line */}
            <div className="h-px w-full bg-accent-gradient opacity-70" />

            <header className="flex items-start justify-between px-6 pb-4 pt-6">
              <div className="flex items-center gap-3">
                {icon && (
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5 text-accent-cyan ring-1 ring-white/10">
                    {icon}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="text-xs text-white/40">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="grid h-9 w-9 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </header>

            <div className="scroll-thin flex-1 overflow-y-auto px-6 pb-8">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
