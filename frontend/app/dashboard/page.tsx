"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import AmbientBackground from "@/components/ui/AmbientBackground";
import TopBar from "@/components/layout/TopBar";
import SideDock, { type PanelKey } from "@/components/layout/SideDock";
import ChatExperience from "@/components/chat/ChatExperience";
import CalendarDrawer from "@/components/drawers/CalendarDrawer";
import TasksDrawer from "@/components/drawers/TasksDrawer";
import ScheduleDrawer from "@/components/drawers/ScheduleDrawer";
import HabitsDrawer from "@/components/drawers/HabitsDrawer";
import type { ConnectionState } from "@/hooks/useChatSocket";

export default function DashboardPage() {
  const { data: session } = useSession();
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";
  const user = session?.user;

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
