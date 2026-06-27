"use client";

import Greeting from "@/components/today/Greeting";
import UpcomingEvents from "@/components/today/UpcomingEvents";
import TodayTasks from "@/components/today/TodayTasks";
import HabitCheckins from "@/components/today/HabitCheckins";

export default function DashboardPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <Greeting />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Events + Tasks */}
        <div className="space-y-6 lg:col-span-2">
          <UpcomingEvents />
          <TodayTasks />
        </div>

        {/* Right column: Habits */}
        <div className="space-y-6">
          <HabitCheckins />
        </div>
      </div>
    </div>
  );
}
