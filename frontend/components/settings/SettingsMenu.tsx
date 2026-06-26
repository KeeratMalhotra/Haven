"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  CheckSquare,
  Mail,
  LogOut,
  type LucideIcon,
} from "lucide-react";

interface SettingsMenuProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface Service {
  key: string;
  label: string;
  icon: LucideIcon;
  connected: boolean;
}

/**
 * SettingsMenu
 * Top-right avatar that opens a frosted dropdown: profile, connected services
 * with live status dots + a Connect/Disconnect toggle, and sign out.
 */
export default function SettingsMenu({ name, email, image }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Calendar + Tasks are granted by the Google OAuth scopes; Gmail is opt-in.
  const [services, setServices] = useState<Service[]>([
    { key: "calendar", label: "Google Calendar", icon: Calendar, connected: true },
    { key: "tasks", label: "Google Tasks", icon: CheckSquare, connected: true },
    { key: "gmail", label: "Gmail", icon: Mail, connected: false },
  ]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggleService = (key: string) =>
    setServices((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, connected: !s.connected } : s
      )
    );

  const initial = (name || email || "U").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account and settings"
        className="grid h-10 w-10 place-items-center overflow-hidden rounded-full ring-1 ring-white/10 transition-all hover:ring-white/25"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name || "Account"} className="h-full w-full object-cover" />
        ) : (
          <span className="bg-accent-gradient bg-clip-text text-sm font-semibold text-transparent">
            {initial}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="glass-strong absolute right-0 mt-3 w-80 origin-top-right overflow-hidden rounded-3xl shadow-panel"
          >
            <div className="h-px w-full bg-accent-gradient opacity-70" />

            {/* Profile */}
            <div className="flex items-center gap-3 px-5 pb-4 pt-5">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-white/10">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt={name || "Account"} className="h-full w-full object-cover" />
                ) : (
                  <span className="bg-accent-gradient bg-clip-text text-base font-semibold text-transparent">
                    {initial}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {name || "Signed in"}
                </p>
                <p className="truncate text-xs text-white/45">
                  {email || "—"}
                </p>
              </div>
            </div>

            <div className="mx-5 h-px bg-white/[0.07]" />

            {/* Connected services */}
            <div className="px-5 py-4">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-white/35">
                Connected services
              </p>
              <div className="flex flex-col gap-1">
                {services.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between rounded-xl px-2 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <s.icon size={16} className="text-white/55" />
                      <span className="text-sm text-white/80">{s.label}</span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          s.connected
                            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                            : "bg-white/25"
                        }`}
                      />
                    </div>
                    <button
                      onClick={() => toggleService(s.key)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        s.connected
                          ? "text-white/50 hover:text-white/80"
                          : "bg-white/10 text-white hover:bg-white/15"
                      }`}
                    >
                      {s.connected ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-5 h-px bg-white/[0.07]" />

            {/* Sign out */}
            <div className="p-3">
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
