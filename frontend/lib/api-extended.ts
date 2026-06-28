/**
 * Extended API helpers for task CRUD, AI priorities, and suggestions.
 * These complement the base helpers in lib/api.ts with endpoints
 * added for Sprint 3 (Google Tasks create/delete/update, AI prioritize).
 */

import { getApiBase, type CalendarEvent } from "@/lib/api";

/**
 * Create a task in Google Tasks via the backend.
 */
export async function createTask(
  authToken: string,
  data: { title: string; notes?: string; due_days_from_now?: number }
): Promise<any> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      title: data.title,
      notes: data.notes || "",
      due_days_from_now: data.due_days_from_now ?? 7,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create task (${res.status})`);
  }
  return await res.json();
}

/**
 * Delete a task from Google Tasks via the backend.
 */
export async function deleteTask(
  authToken: string,
  taskId: string
): Promise<void> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/tasks/${encodeURIComponent(taskId)}?auth_token=${encodeURIComponent(authToken)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(`Failed to delete task (${res.status})`);
  }
}

/**
 * Update/complete a task in Google Tasks via the backend.
 */
export async function updateTask(
  authToken: string,
  taskId: string,
  data: { completed?: boolean }
): Promise<void> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        completed: data.completed ?? false,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to update task (${res.status})`);
  }
}

/**
 * Fetch AI-prioritized task rankings from the backend.
 */
export async function fetchAiPriorities(
  authToken: string
): Promise<{ priorities: any[]; content: string }> {
  if (!authToken) return { priorities: [], content: "" };
  try {
    const res = await fetch(
      `${getApiBase()}/api/priorities?auth_token=${encodeURIComponent(authToken)}`,
      { method: "GET", cache: "no-store" }
    );
    if (!res.ok) return { priorities: [], content: "" };
    return (await res.json()) as { priorities: any[]; content: string };
  } catch {
    return { priorities: [], content: "" };
  }
}

/**
 * Fetch proactive suggestions from the backend (placeholder for FEAT-005).
 */
export async function fetchSuggestions(
  authToken: string
): Promise<{ suggestions: any[] }> {
  if (!authToken) return { suggestions: [] };
  try {
    const res = await fetch(
      `${getApiBase()}/api/suggestions?auth_token=${encodeURIComponent(authToken)}`,
      { method: "GET", cache: "no-store" }
    );
    if (!res.ok) return { suggestions: [] };
    return (await res.json()) as { suggestions: any[] };
  } catch {
    return { suggestions: [] };
  }
}

/**
 * Update a calendar event via the backend.
 */
export async function updateCalendarEvent(
  authToken: string,
  eventId: string,
  data: { summary?: string; start_time?: string; duration_minutes?: number }
): Promise<CalendarEvent> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/calendar/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        ...data,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to update event (${res.status})`);
  }
  return (await res.json()) as CalendarEvent;
}

/**
 * Fetch a contextual AI suggestion based on a user action.
 */
export async function fetchContextSuggestion(
  authToken: string,
  actionType: string,
  actionData: Record<string, any>,
  context?: Record<string, any>
): Promise<{ suggestion: string | null; type: string; actions: any[] }> {
  if (!authToken) return { suggestion: null, type: "info", actions: [] };
  try {
    const res = await fetch(`${getApiBase()}/api/context-suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        action_type: actionType,
        action_data: actionData,
        context: context || {},
      }),
    });
    if (!res.ok) return { suggestion: null, type: "info", actions: [] };
    return (await res.json()) as {
      suggestion: string | null;
      type: string;
      actions: any[];
    };
  } catch {
    return { suggestion: null, type: "info", actions: [] };
  }
}

/**
 * Fetch an AI-generated autopilot day plan.
 */
export async function fetchAutopilotPlan(
  authToken: string
): Promise<{ plan_id: string; actions: any[]; summary: string }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/autopilot/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_token: authToken }),
  });
  if (!res.ok) {
    throw new Error(`Failed to generate plan (${res.status})`);
  }
  return (await res.json()) as { plan_id: string; actions: any[]; summary: string };
}

/**
 * Generate a custom template from a goal description using AI.
 */
export async function generateTemplate(
  authToken: string,
  goalDescription: string
): Promise<{
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  tasks: {
    title: string;
    notes: string;
    due_days_from_now: number;
    priority: "high" | "medium" | "low" | "none";
  }[];
}> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/templates/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      goal_description: goalDescription,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to generate template (${res.status})`);
  }
  return await res.json();
}

/**
 * Execute an autopilot day plan (create events, schedule tasks, etc).
 */
export async function executeAutopilotPlan(
  authToken: string,
  planId: string,
  actions: any[]
): Promise<{ plan_id: string; executed: number; failed: number; changes: any[] }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/autopilot/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      plan_id: planId,
      actions,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to execute plan (${res.status})`);
  }
  return (await res.json()) as { plan_id: string; executed: number; failed: number; changes: any[] };
}

// --- User Preferences ---

export interface UserPreferences {
  preferences: Record<string, any>;
  notification_preferences: {
    email_notifications?: boolean;
    email_for_urgent_only?: boolean;
    email_deadline_reminders?: boolean;
    daily_digest?: boolean;
    weekly_review?: boolean;
  };
}

/**
 * Fetch user preferences and notification_preferences from the backend.
 * Uses POST to avoid leaking auth token in query parameters.
 */
export async function fetchPreferences(
  authToken: string
): Promise<UserPreferences> {
  if (!authToken) {
    return {
      preferences: {},
      notification_preferences: {
        email_deadline_reminders: true,
        daily_digest: false,
        weekly_review: false,
      },
    };
  }
  try {
    const res = await fetch(`${getApiBase()}/api/preferences/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_token: authToken }),
    });
    if (!res.ok) {
      return {
        preferences: {},
        notification_preferences: {
          email_deadline_reminders: true,
          daily_digest: false,
          weekly_review: false,
        },
      };
    }
    return (await res.json()) as UserPreferences;
  } catch {
    return {
      preferences: {},
      notification_preferences: {
        email_deadline_reminders: true,
        daily_digest: false,
        weekly_review: false,
      },
    };
  }
}

/**
 * Update user preferences and/or notification_preferences on the backend.
 */
export async function updatePreferences(
  authToken: string,
  prefs: {
    preferences?: Record<string, any>;
    notification_preferences?: Record<string, any>;
  }
): Promise<UserPreferences> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      ...prefs,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update preferences (${res.status})`);
  }
  return (await res.json()) as UserPreferences;
}

// --- Gmail Integration ---

export interface GmailActionItem {
  email_id: string;
  email_subject: string;
  email_from: string;
  suggested_title: string;
  suggested_notes: string;
  source_email_id: string;
}

/**
 * Scan the user's Gmail inbox and extract action items using AI.
 */
export async function scanGmailInbox(
  authToken: string
): Promise<{ action_items: GmailActionItem[] }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/gmail/scan-inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_token: authToken }),
  });
  if (!res.ok) {
    throw new Error(`Failed to scan inbox (${res.status})`);
  }
  return (await res.json()) as { action_items: GmailActionItem[] };
}

/**
 * Reply to an email by email ID.
 */
export async function replyToEmail(
  authToken: string,
  emailId: string,
  body: string
): Promise<{ status: string; message_id: string; thread_id: string }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/gmail/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      email_id: emailId,
      body,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to reply to email (${res.status})`);
  }
  return (await res.json()) as { status: string; message_id: string; thread_id: string };
}

// --- Google Slides Integration ---

export interface SlideOutline {
  title: string;
  slides: { title: string; bullets: string[] }[];
}

/**
 * Generate a presentation outline from task context using AI.
 */
export async function generateSlidesOutline(
  authToken: string,
  taskContext: { task_title: string; task_notes?: string; task_subtasks?: string[] }
): Promise<SlideOutline> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/slides/generate-outline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      task_title: taskContext.task_title,
      task_notes: taskContext.task_notes || "",
      task_subtasks: taskContext.task_subtasks || [],
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to generate outline (${res.status})`);
  }
  return (await res.json()) as SlideOutline;
}

/**
 * Create a Google Slides presentation from an outline.
 */
export async function createPresentation(
  authToken: string,
  outline: SlideOutline
): Promise<{ presentation_id: string; presentation_url: string }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/slides/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      outline,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create presentation (${res.status})`);
  }
  return (await res.json()) as { presentation_id: string; presentation_url: string };
}

// --- Web Research Integration ---

export interface ResearchResult {
  title: string;
  summary: string;
  source_url: string;
  relevance_snippet: string;
}

/**
 * Research the web for context relevant to a task using AI.
 * Results are AI-generated suggestions; URLs may not point to real pages.
 */
export async function researchTask(
  authToken: string,
  taskContext: { title: string; notes?: string }
): Promise<{ results: ResearchResult[]; disclaimer?: string }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      task_context: {
        title: taskContext.title,
        notes: taskContext.notes || "",
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to research task (${res.status})`);
  }
  return (await res.json()) as { results: ResearchResult[]; disclaimer?: string };
}

// --- OAuth Integrations ---

export interface IntegrationStatus {
  [service: string]: {
    connected: boolean;
    scopes: string[];
  };
}

/**
 * Fetch the connection status of all integrable services from the backend.
 */
export async function fetchIntegrationStatus(
  authToken: string
): Promise<IntegrationStatus> {
  if (!authToken) return {};
  try {
    const res = await fetch(
      `${getApiBase()}/api/integrations/status?auth_token=${encodeURIComponent(authToken)}`,
      { method: "GET", cache: "no-store" }
    );
    if (!res.ok) return {};
    return (await res.json()) as IntegrationStatus;
  } catch {
    return {};
  }
}

/**
 * Get the OAuth authorization URL for connecting a specific Google service.
 */
export async function connectService(
  authToken: string,
  service: string
): Promise<{ auth_url: string }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/integrations/connect/${encodeURIComponent(service)}?auth_token=${encodeURIComponent(authToken)}`,
    { method: "GET" }
  );
  if (!res.ok) {
    throw new Error(`Failed to get auth URL for ${service} (${res.status})`);
  }
  return (await res.json()) as { auth_url: string };
}

/**
 * Disconnect a specific Google service by removing its stored tokens.
 */
export async function disconnectService(
  authToken: string,
  service: string
): Promise<{ status: string }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/integrations/disconnect/${encodeURIComponent(service)}?auth_token=${encodeURIComponent(authToken)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(`Failed to disconnect ${service} (${res.status})`);
  }
  return (await res.json()) as { status: string };
}

/**
 * Get the Spotify OAuth authorization URL.
 */
export async function getSpotifyAuthUrl(
  authToken: string
): Promise<{ auth_url: string }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/integrations/spotify/auth-url?auth_token=${encodeURIComponent(authToken)}`,
    { method: "GET" }
  );
  if (!res.ok) {
    throw new Error(`Failed to get Spotify auth URL (${res.status})`);
  }
  return (await res.json()) as { auth_url: string };
}

/**
 * Disconnect Spotify by clearing stored tokens.
 */
export async function disconnectSpotify(
  authToken: string
): Promise<{ status: string }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/integrations/spotify/disconnect?auth_token=${encodeURIComponent(authToken)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(`Failed to disconnect Spotify (${res.status})`);
  }
  return (await res.json()) as { status: string };
}

/**
 * Update user profile (display name and timezone) via preferences endpoint.
 */
export async function updateProfile(
  authToken: string,
  data: { name?: string; timezone?: string }
): Promise<UserPreferences> {
  if (!authToken) throw new Error("No auth token provided");
  const preferences: Record<string, string> = {};
  if (data.name !== undefined) preferences.display_name = data.name;
  if (data.timezone !== undefined) preferences.timezone = data.timezone;

  const res = await fetch(`${getApiBase()}/api/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      preferences,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update profile (${res.status})`);
  }
  return (await res.json()) as UserPreferences;
}



// --- Sprint 9: Brain-dump onboarding ---

export interface BrainDumpTask {
  title: string;
  notes?: string;
  due_days_from_now: number;
  priority: "high" | "medium" | "low";
}

export interface BrainDumpEvent {
  id?: string;
  summary: string;
  start: string;
}

export interface BrainDumpHabit {
  id?: string;
  name: string;
  frequency: string;
  target_days: number;
}

export interface BrainDumpResult {
  summary: string;
  counts: { tasks: number; events: number; habits: number };
  tasks: BrainDumpTask[];
  events: BrainDumpEvent[];
  habits: BrainDumpHabit[];
}

/**
 * Parse a free-text brain-dump into tasks, events, and habits, creating them
 * server-side and returning a summary for the onboarding reveal.
 */
export async function parseBraindump(
  authToken: string,
  braindump: string
): Promise<BrainDumpResult> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/onboarding/parse-braindump`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_token: authToken, braindump }),
  });
  if (!res.ok) {
    throw new Error(`Failed to parse brain-dump (${res.status})`);
  }
  return (await res.json()) as BrainDumpResult;
}

// --- Sprint 10: Morning briefing & streak ---

export interface BriefingMeeting {
  summary: string;
  start: string;
  end: string;
  start_label: string;
}

export interface BriefingDeadline {
  title: string;
  due: string;
  due_label: string;
}

export interface TodayBriefing {
  greeting: string;
  time_of_day: "morning" | "afternoon" | "evening";
  date: string;
  narrative: string;
  meetings: BriefingMeeting[];
  deadlines: BriefingDeadline[];
  top_priority: string;
  warnings: string[];
  stats: { meetings: number; deadlines: number; tasks_pending: number };
  suggested_actions: string[];
}

/**
 * Fetch the structured, AI-narrated briefing for the user's day.
 */
export async function fetchTodayBriefing(
  authToken: string
): Promise<TodayBriefing | null> {
  if (!authToken) return null;
  try {
    const res = await fetch(
      `${getApiBase()}/api/briefing/today?auth_token=${encodeURIComponent(authToken)}`,
      { method: "GET", cache: "no-store" }
    );
    if (!res.ok) return null;
    return (await res.json()) as TodayBriefing;
  } catch {
    return null;
  }
}

export interface StreakResult {
  streak: number;
  longest_streak: number;
  last_active_date: string;
  incremented?: boolean;
}

/**
 * Record a daily engagement and return the updated streak.
 * Idempotent within the same day.
 */
export async function checkinStreak(
  authToken: string
): Promise<StreakResult> {
  if (!authToken) {
    return { streak: 0, longest_streak: 0, last_active_date: "" };
  }
  try {
    const res = await fetch(
      `${getApiBase()}/api/streak/checkin?auth_token=${encodeURIComponent(authToken)}`,
      { method: "POST" }
    );
    if (!res.ok) {
      return { streak: 0, longest_streak: 0, last_active_date: "" };
    }
    return (await res.json()) as StreakResult;
  } catch {
    return { streak: 0, longest_streak: 0, last_active_date: "" };
  }
}



// --- Sprint 11: Persistent memory & learning ("The Brain Gets Real") ---

export interface MemoryInsight {
  id: string;
  text: string;
  category: "productivity" | "pattern" | "preference" | "behavior" | string;
  source: "computed" | "distilled" | string;
  created_at?: string;
}

export interface MemoryBehavioralStats {
  tasks_created: number;
  tasks_completed: number;
  tasks_rescheduled: number;
  focus_sessions: number;
  completion_rate: number;
  estimate_accuracy: number;
  estimate_samples: number;
}

export interface MemoryView {
  productive_hours: number[];
  avoided_hours: number[];
  task_patterns: string[];
  learned_preferences: Record<string, unknown>;
  vocabulary: Record<string, string>;
  behavioral_stats: MemoryBehavioralStats;
  insights: MemoryInsight[];
  observation_count: number;
  updated_at: string | null;
  last_distilled_at: string | null;
}

const EMPTY_STATS: MemoryBehavioralStats = {
  tasks_created: 0,
  tasks_completed: 0,
  tasks_rescheduled: 0,
  focus_sessions: 0,
  completion_rate: 0,
  estimate_accuracy: 0,
  estimate_samples: 0,
};

const EMPTY_MEMORY: MemoryView = {
  productive_hours: [],
  avoided_hours: [],
  task_patterns: [],
  learned_preferences: {},
  vocabulary: {},
  behavioral_stats: EMPTY_STATS,
  insights: [],
  observation_count: 0,
  updated_at: null,
  last_distilled_at: null,
};

/**
 * Fetch the full learned-memory view for the transparency page.
 * Degrades gracefully to an empty memory on any failure.
 */
export async function fetchMemory(authToken: string): Promise<MemoryView> {
  if (!authToken) return EMPTY_MEMORY;
  try {
    const res = await fetch(
      `${getApiBase()}/api/memory?auth_token=${encodeURIComponent(authToken)}`,
      { method: "GET", cache: "no-store" }
    );
    if (!res.ok) return EMPTY_MEMORY;
    return (await res.json()) as MemoryView;
  } catch {
    return EMPTY_MEMORY;
  }
}

/**
 * Fetch the user's learned insights as readable strings.
 */
export async function fetchMemoryInsights(
  authToken: string
): Promise<{ insights: string[]; detailed: MemoryInsight[] }> {
  if (!authToken) return { insights: [], detailed: [] };
  try {
    const res = await fetch(
      `${getApiBase()}/api/memory/insights?auth_token=${encodeURIComponent(authToken)}`,
      { method: "GET", cache: "no-store" }
    );
    if (!res.ok) return { insights: [], detailed: [] };
    return (await res.json()) as { insights: string[]; detailed: MemoryInsight[] };
  } catch {
    return { insights: [], detailed: [] };
  }
}

/**
 * Record a behavioural observation so ChronAI can learn from it.
 * Best-effort: failures are swallowed so the UI flow is never blocked.
 */
export async function recordObservation(
  authToken: string,
  type: "task_completed" | "task_rescheduled" | "focus_session" | "task_created",
  data: Record<string, unknown> = {},
  timestamp?: string
): Promise<void> {
  if (!authToken) return;
  try {
    await fetch(`${getApiBase()}/api/memory/observe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_token: authToken, type, data, timestamp }),
    });
  } catch {
    // Learning is best-effort; never surface this to the user.
  }
}

/**
 * Force a fresh distillation pass and return the updated memory view.
 */
export async function refreshMemory(authToken: string): Promise<MemoryView> {
  if (!authToken) return EMPTY_MEMORY;
  try {
    const res = await fetch(`${getApiBase()}/api/memory/distill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_token: authToken }),
    });
    if (!res.ok) return EMPTY_MEMORY;
    return (await res.json()) as MemoryView;
  } catch {
    return EMPTY_MEMORY;
  }
}

/**
 * Forget a single piece of learned memory (insight / preference / alias / pattern).
 */
export async function forgetMemoryItem(
  authToken: string,
  payload:
    | { kind: "insight"; id: string }
    | { kind: "preference"; key: string }
    | { kind: "vocabulary"; key: string }
    | { kind: "pattern"; value: string }
): Promise<{ status: string; view: MemoryView }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(`${getApiBase()}/api/memory/forget`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_token: authToken, ...payload }),
  });
  if (!res.ok) {
    throw new Error(`Failed to forget memory item (${res.status})`);
  }
  return (await res.json()) as { status: string; view: MemoryView };
}

/**
 * Clear ALL learned memory for the user.
 */
export async function clearAllMemory(
  authToken: string
): Promise<{ status: string }> {
  if (!authToken) throw new Error("No auth token provided");
  const res = await fetch(
    `${getApiBase()}/api/memory?auth_token=${encodeURIComponent(authToken)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(`Failed to clear memory (${res.status})`);
  }
  return (await res.json()) as { status: string };
}
