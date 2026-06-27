/**
 * Extended API helpers for task CRUD, AI priorities, and suggestions.
 * These complement the base helpers in lib/api.ts with endpoints
 * added for Sprint 3 (Google Tasks create/delete/update, AI prioritize).
 */

import { getApiBase } from "@/lib/api";

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
