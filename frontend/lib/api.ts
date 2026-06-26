/**
 * Lightweight REST helpers for the existing backend endpoints.
 * These reuse the same origin as the WebSocket URL so no extra config is needed.
 *
 *  - GET /api/tasks?auth_token=...            -> { tasks: [...] }
 *  - GET /api/calendar/events?auth_token=...  -> { events: [...] }
 */

export interface TaskItem {
  id?: string;
  title: string;
  notes?: string;
  due?: string | null;
  completed?: boolean;
  subtasks?: TaskItem[];
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
}

/**
 * Derive the HTTP API base from the WebSocket URL (ws://host/ws -> http://host),
 * with an optional explicit override.
 */
export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  const ws = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
  return ws
    .replace(/^ws/, "http")
    .replace(/\/ws\/?$/, "")
    .replace(/\/$/, "");
}

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function fetchTasks(authToken: string): Promise<TaskItem[]> {
  if (!authToken) return [];
  const data = await safeGet<{ tasks: TaskItem[] }>(
    `/api/tasks?auth_token=${encodeURIComponent(authToken)}`,
    { tasks: [] }
  );
  return Array.isArray(data.tasks) ? data.tasks : [];
}

export async function fetchCalendarEvents(
  authToken: string,
  daysAhead = 7
): Promise<CalendarEvent[]> {
  if (!authToken) return [];
  const data = await safeGet<{ events: CalendarEvent[] }>(
    `/api/calendar/events?auth_token=${encodeURIComponent(
      authToken
    )}&days_ahead=${daysAhead}`,
    { events: [] }
  );
  return Array.isArray(data.events) ? data.events : [];
}

export async function fetchOnboardingStatus(
  authToken: string
): Promise<{ complete: boolean }> {
  if (!authToken) return { complete: false };
  return safeGet<{ complete: boolean }>(
    `/api/onboarding/status?auth_token=${encodeURIComponent(authToken)}`,
    { complete: false }
  );
}

export async function postOnboarding(
  authToken: string,
  profile: object
): Promise<void> {
  if (!authToken) return;
  try {
    await fetch(
      `${getApiBase()}/api/onboarding?auth_token=${encodeURIComponent(authToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      }
    );
  } catch {
    // silently fail
  }
}
