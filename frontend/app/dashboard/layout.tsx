"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/layout/AppShell";
import SpotifyMiniPlayer from "@/components/SpotifyMiniPlayer";
import {
  ConnectionProvider,
  useConnectionState,
} from "@/components/chat/ConnectionContext";
import { AIContextProvider } from "@/components/ai/AIContextProvider";
import AIToast from "@/components/ai/AIToast";
import AIChatPanel from "@/components/chat/AIChatPanel";
import { useNotificationSocket } from "@/hooks/useNotificationSocket";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";

function NotificationSocketListener() {
  useNotificationSocket();
  return null;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { connection } = useConnectionState();
  const userImage = session?.user?.image ?? null;
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";
  const userName = session?.user?.name ?? undefined;

  const connected =
    connection === "connected"
      ? true
      : connection === "disconnected"
        ? false
        : undefined;

  const [chatOpen, setChatOpen] = useState(false);
  const [detached, setDetached] = useState(false);

  const handleDetach = () => {
    setDetached(true);
  };

  const handleAttach = () => {
    setDetached(false);
  };

  return (
    <AppShell connected={connected} userImage={userImage}>
      <AIContextProvider>
        <NotificationSocketListener />
        {children}
        <AIToast />

        {/* Persistent AI Chat FAB - available on all dashboard pages */}
        <div className="fixed bottom-24 right-6 z-40">
          <motion.button
            onClick={() => setChatOpen((o) => !o)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-gradient shadow-lg shadow-accent-500/25 transition-shadow hover:shadow-xl hover:shadow-accent-500/30"
            aria-label={chatOpen ? "Close AI chat" : "Open AI chat"}
          >
            <AnimatePresence mode="wait" initial={false}>
              {chatOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X size={20} className="text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="chat"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <MessageCircle size={20} className="text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* AI Chat Panel */}
        <AIChatPanel
          open={chatOpen}
          onClose={() => {
            setChatOpen(false);
            setDetached(false);
          }}
          accessToken={accessToken}
          userName={userName}
          detached={detached}
          onDetach={handleDetach}
          onAttach={handleAttach}
        />
      </AIContextProvider>
      <SpotifyMiniPlayer />
    </AppShell>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConnectionProvider>
      <DashboardShell>{children}</DashboardShell>
    </ConnectionProvider>
  );
}
