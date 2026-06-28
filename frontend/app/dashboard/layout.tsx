"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import SpotifyMiniPlayer from "@/components/SpotifyMiniPlayer";
import {
  ConnectionProvider,
  useConnectionState,
} from "@/components/chat/ConnectionContext";
import { AIContextProvider } from "@/components/ai/AIContextProvider";
import AIToast from "@/components/ai/AIToast";
import AIChatPanel from "@/components/chat/AIChatPanel";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import ProactiveListener from "@/components/notifications/ProactiveListener";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

function NotificationSocketListener() {
  return <ProactiveListener />;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { connection } = useConnectionState();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
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

  // Allow pages (e.g. the morning briefing "Adjust" action) to open the chat
  // panel by dispatching a window event.
  useEffect(() => {
    const openChat = () => setChatOpen(true);
    window.addEventListener("chronai-open-chat", openChat);
    return () => window.removeEventListener("chronai-open-chat", openChat);
  }, []);

  const handleDetach = () => {
    setDetached(true);
  };

  const handleAttach = () => {
    setDetached(false);
  };

  return (
    <NotificationProvider>
      <AppShell
        connected={connected}
        userImage={userImage}
        chatOpen={chatOpen}
        onChatToggle={() => setChatOpen((o) => !o)}
      >
        <AIContextProvider>
          <NotificationSocketListener />
          {prefersReducedMotion ? (
            <div key={pathname}>{children}</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          )}
          <AIToast />

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
    </NotificationProvider>
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
