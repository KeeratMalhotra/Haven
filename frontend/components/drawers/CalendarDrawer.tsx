"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Plus } from "lucide-react";
import Drawer from "./Drawer";
import {
  fetchCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  type CalendarEvent,
} from "@/lib/api";
import ViewTabs from "./calendar/ViewTabs";
import DateNav from "./calendar/DateNav";
import DayView from "./calendar/DayView";
import WeekView from "./calendar/WeekView";
import MonthView from "./calendar/MonthView";
import ListView from "./calendar/ListView";
import AddEventForm from "./calendar/AddEventForm";
import type { CalendarView } from "./calendar/types";

interface CalendarDrawerProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
}

export default function CalendarDrawer({
  open,
  onClose,
  accessToken,
}: CalendarDrawerProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<CalendarView>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const daysAhead = view === "month" ? 30 : 14;
      const data = await fetchCalendarEvents(accessToken, daysAhead);
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, [accessToken, view]);

  useEffect(() => {
    if (!open) return;
    loadEvents();
  }, [open, loadEvents]);

  const handleCreateEvent = async (data: {
    summary: string;
    start_time: string;
    duration_minutes: number;
  }) => {
    await createCalendarEvent(accessToken, data);
    setShowAddForm(false);
    await loadEvents();
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteCalendarEvent(accessToken, eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const handleSelectDate = (date: Date) => {
    setCurrentDate(date);
    setView("day");
  };

  const handleSelectEvent = (_event: CalendarEvent) => {
    // Event expansion is handled within EventCard via its own state
  };

  const navigatePrev = () => {
    const next = new Date(currentDate);
    if (view === "day") next.setDate(next.getDate() - 1);
    else if (view === "week") next.setDate(next.getDate() - 7);
    else if (view === "month") next.setMonth(next.getMonth() - 1);
    else next.setDate(next.getDate() - 7);
    setCurrentDate(next);
  };

  const navigateNext = () => {
    const next = new Date(currentDate);
    if (view === "day") next.setDate(next.getDate() + 1);
    else if (view === "week") next.setDate(next.getDate() + 7);
    else if (view === "month") next.setMonth(next.getMonth() + 1);
    else next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const viewProps = {
    events,
    currentDate,
    onSelectDate: handleSelectDate,
    onSelectEvent: handleSelectEvent,
    onDeleteEvent: handleDeleteEvent,
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Calendar"
      subtitle="Plan your time"
      icon={<CalendarDays size={18} />}
    >
      <div className="relative flex min-h-full flex-col gap-4 pb-20">
        {/* View Tabs */}
        <ViewTabs active={view} onChange={setView} />

        {/* Date Navigation */}
        <DateNav
          currentDate={currentDate}
          view={view}
          onPrev={navigatePrev}
          onNext={navigateNext}
          onToday={navigateToday}
        />

        {/* Add Event Form */}
        <AnimatePresence>
          {showAddForm && (
            <AddEventForm
              onSubmit={handleCreateEvent}
              onCancel={() => setShowAddForm(false)}
              defaultDate={currentDate}
            />
          )}
        </AnimatePresence>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.05]"
              />
            ))}
          </div>
        ) : (
          /* Calendar Views */
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {view === "day" && <DayView {...viewProps} />}
              {view === "week" && <WeekView {...viewProps} />}
              {view === "month" && <MonthView {...viewProps} />}
              {view === "list" && <ListView {...viewProps} />}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Floating Add Button */}
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="absolute bottom-6 right-6 z-[60] grid h-12 w-12 place-items-center rounded-full bg-accent-gradient shadow-glow transition-transform hover:scale-110 active:scale-95"
          >
            <Plus size={20} className="text-white" />
          </button>
        )}
      </div>
    </Drawer>
  );
}
