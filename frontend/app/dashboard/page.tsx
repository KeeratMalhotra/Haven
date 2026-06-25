"use client";

import EntityCanvas from "@/components/entity/EntityCanvas";
import ChatPanel from "@/components/chat/ChatPanel";

export default function DashboardPage() {
  return (
    <main className="relative w-screen h-screen bg-dark-900 flex overflow-hidden">
      {/* Entity Area */}
      <div className="flex-1 relative">
        <EntityCanvas />
      </div>

      {/* Chat Panel Sidebar */}
      <aside className="w-[400px] h-full border-l border-dark-600 bg-dark-800/80 backdrop-blur-sm">
        <ChatPanel />
      </aside>
    </main>
  );
}
