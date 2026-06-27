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
 */
export async function researchTask(
  authToken: string,
  taskContext: { title: string; notes?: string }
): Promise<{ results: ResearchResult[] }> {
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
  return (await res.json()) as { results: ResearchResult[] };
}
