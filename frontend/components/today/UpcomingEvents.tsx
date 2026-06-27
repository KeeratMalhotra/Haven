"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Calendar, MapPin } from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { fetchCalendarEvents, CalendarEvent } from "@/lib/api";

function formatEventTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function UpcomingEvents() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = (session as unknown as { accessToken?: string })
          ?.accessToken;
        if (!token) {
          setLoading(false);
          return;
        }
        const data = await fetchCalendarEvents(token, 2);
        setEvents(data.slice(0, 5));
      } catch (err) {
        setError("Unable to load events");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  return (
    <Card title="Upcoming Events">
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      )}

      {error && <p className="text-sm text-muted-foreground">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <div className="flex flex-col items-center py-4 text-center">
          <Calendar className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No upcoming events. Enjoy your free time!
          </p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <ul className="space-y-3">
          {events.map((event, idx) => (
            <li
              key={event.id || idx}
              className="flex items-start gap-3 rounded-lg border border-border/50 p-3"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {event.summary}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatEventTime(event.start)} &ndash;{" "}
                  {formatEventTime(event.end)}
                </p>
                {event.location && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {event.location}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
