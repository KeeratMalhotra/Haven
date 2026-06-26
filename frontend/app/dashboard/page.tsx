"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AmbientBackground from "@/components/ui/AmbientBackground";
import TopBar from "@/components/layout/TopBar";
import SideDock, { type PanelKey } from "@/components/layout/SideDock";
import ChatExperience from "@/components/chat/ChatExperience";
import CalendarDrawer from "@/components/drawers/CalendarDrawer";
import TasksDrawer from "@/components/drawers/TasksDrawer";
import ScheduleDrawer from "@/components/drawers/ScheduleDrawer";
import HabitsDrawer from "@/components/drawers/HabitsDrawer";
import type { ConnectionState } from "@/hooks/useChatSocket";
import { fetchOnboardingStatus } from "@/lib/api";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";
  const user = session?.user;

  // Onboarding gate: redirect to /onboarding if profile is not complete
  useEffect(() => {
    if (status !== "authenticated" || !accessToken) return;
    fetchOnboardingStatus(accessToken).then((data) => {
      if (!data.complete) {
        router.push("/onboarding");
      }
    });
  }, [status, accessToken, router]);

  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");

  const openPanel = (key: PanelKey) =>
    setActivePanel((cur) => (cur === key ? null : key));
  const close = () => setActivePanel(null);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-base-950">
      <AmbientBackground />

      <TopBar
        name={user?.name}
        email={user?.email}
        image={user?.image}
        connected={connection === "connected"}
      />

      <SideDock active={activePanel} onOpen={openPanel} />

      <div className="relative z-10 h-full pt-16">
        <ChatExperience
          accessToken={accessToken}
          userName={user?.name ?? undefined}
          onConnectionChange={setConnection}
        />
      </div>

      {/* Slide-in drawers */}
      <CalendarDrawer
        open={activePanel === "calendar"}
        onClose={close}
        accessToken={accessToken}
      />
      <TasksDrawer
        open={activePanel === "tasks"}
        onClose={close}
        accessToken={accessToken}
      />
      <ScheduleDrawer open={activePanel === "schedule"} onClose={close} />
      <HabitsDrawer open={activePanel === "habits"} onClose={close} />
    </main>
  );
}
