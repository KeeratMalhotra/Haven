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
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/onboarding?auth_token=${encodeURIComponent(authToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }
  );
  if (!res.ok) {
    throw new Error(`Onboarding save failed (${res.status})`);
  }
}

export async function createCalendarEvent(
  authToken: string,
  data: { summary: string; start_time: string; duration_minutes: number }
): Promise<CalendarEvent> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/calendar/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      summary: data.summary,
      start_time: data.start_time,
      duration_minutes: data.duration_minutes,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create event (${res.status})`);
  }
  return (await res.json()) as CalendarEvent;
}

export async function deleteCalendarEvent(
  authToken: string,
  eventId: string
): Promise<void> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/calendar/events/${encodeURIComponent(eventId)}?auth_token=${encodeURIComponent(authToken)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(`Failed to delete event (${res.status})`);
  }
}

// --- Habits ---

export interface HabitHistoryEntry {
  completed_at: string;
}

export interface HabitItem {
  id: string;
  name: string;
  frequency: string;
  target_days: number;
  streak: number;
  last_completed: string | null;
  history: HabitHistoryEntry[];
}

export interface WeeklyReview {
  content: string;
}

export async function fetchHabits(authToken: string): Promise<HabitItem[]> {
  if (!authToken) return [];
  const data = await safeGet<{ habits: HabitItem[] }>(
    `/api/habits?auth_token=${encodeURIComponent(authToken)}`,
    { habits: [] }
  );
  return Array.isArray(data.habits) ? data.habits : [];
}

export async function checkinHabit(
  authToken: string,
  habitId: string
): Promise<HabitItem> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/habits/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_token: authToken, habit_id: habitId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to check in habit (${res.status})`);
  }
  const json = await res.json();
  return json.habit as HabitItem;
}

export async function createHabit(
  authToken: string,
  name: string,
  frequency: string,
  targetDays: number
): Promise<HabitItem> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/habits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      name,
      frequency,
      target_days: targetDays,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create habit (${res.status})`);
  }
  const json = await res.json();
  return json.habit as HabitItem;
}

export async function deleteHabit(
  authToken: string,
  habitId: string
): Promise<void> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/habits/${encodeURIComponent(habitId)}?auth_token=${encodeURIComponent(authToken)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(`Failed to delete habit (${res.status})`);
  }
}

export async function fetchWeeklyReview(
  authToken: string
): Promise<WeeklyReview> {
  if (!authToken) return { content: "" };
  const data = await safeGet<{ review: string }>(
    `/api/review/weekly?auth_token=${encodeURIComponent(authToken)}`,
    { review: "" }
  );
  return { content: data.review || "" };
}

// --- Chat History ---

export interface ChatHistoryMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

export async function fetchChatHistory(
  authToken: string,
  limit = 50
): Promise<ChatHistoryMessage[]> {
  if (!authToken) return [];
  const data = await safeGet<{ messages: ChatHistoryMessage[] }>(
    `/api/conversations/history?auth_token=${encodeURIComponent(authToken)}&limit=${limit}`,
    { messages: [] }
  );
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function checkTokenScopes(accessToken: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) return "";
    const data = await res.json();
    return (data.scope as string) || "";
  } catch {
    return "";
  }
}
