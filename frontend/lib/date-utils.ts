/**
 * Safe date parsing and formatting helpers.
 *
 * Calendar/task data coming from the backend can occasionally contain empty,
 * malformed, or date-only ("2026-06-28") values. Passing those straight into
 * `new Date(...)` or date-fns `format()` throws "RangeError: Invalid time
 * value", which unmounts React and blanks out the page.
 *
 * These helpers never throw: they return `null`/a fallback instead, so callers
 * can render gracefully or skip bad data.
 */

import { format as dateFnsFormat } from "date-fns";

// Matches a date-only ISO string like "2026-06-28" (no time component).
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a value into a valid Date, or return null.
 *
 * Handles:
 *  - null / undefined / empty string            -> null
 *  - date-only strings ("2026-06-28")           -> local midnight Date
 *  - full ISO dateTime strings                  -> parsed Date
 *  - any value that yields an Invalid Date       -> null
 */
export function safeParseDate(
  value: string | null | undefined
): Date | null {
  if (value === null || value === undefined) return null;

  const trimmed = String(value).trim();
  if (trimmed === "") return null;

  // Date-only strings: construct at local midnight so they don't shift across
  // timezones (e.g. all-day events).
  if (DATE_ONLY_RE.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a date value using date-fns without ever throwing.
 *
 * @param value     A date string (ISO dateTime or date-only) or Date.
 * @param formatStr A date-fns format string (e.g. "h:mm a").
 * @param fallback  Returned when the value cannot be parsed/formatted.
 */
export function safeFormat(
  value: string | Date | null | undefined,
  formatStr: string,
  fallback = ""
): string {
  const date =
    value instanceof Date
      ? Number.isNaN(value.getTime())
        ? null
        : value
      : safeParseDate(value);

  if (!date) return fallback;

  try {
    return dateFnsFormat(date, formatStr);
  } catch {
    return fallback;
  }
}

/**
 * Convenience guard: true when the value parses to a usable Date.
 */
export function isValidDate(value: string | null | undefined): boolean {
  return safeParseDate(value) !== null;
}

/**
 * True when the value is a date-only string ("2026-06-28") with no time,
 * which typically represents an all-day event.
 */
export function isDateOnly(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return DATE_ONLY_RE.test(String(value).trim());
}
