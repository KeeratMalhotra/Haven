"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Sparkles,
  Lightbulb,
  Clock,
  TrendingUp,
  Repeat,
  BookOpen,
  BarChart3,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { Card } from "@/components/ui/Card";
import {
  fetchMemory,
  refreshMemory,
  forgetMemoryItem,
  clearAllMemory,
  type MemoryView,
  type MemoryInsight,
} from "@/lib/api-extended";

/** Render an hour (0-23) as a friendly 12h label, e.g. 9 -> "9 AM". */
function hourLabel(hour: number): string {
  const h12 = hour % 12 || 12;
  return `${h12} ${hour < 12 ? "AM" : "PM"}`;
}

const CATEGORY_STYLES: Record<string, string> = {
  productivity: "text-emerald-500 bg-emerald-500/10",
  pattern: "text-blue-500 bg-blue-500/10",
  preference: "text-amber-500 bg-amber-500/10",
  behavior: "text-purple-500 bg-purple-500/10",
};

function categoryStyle(category: string): string {
  return CATEGORY_STYLES[category] ?? "text-[var(--text-secondary)] dark:text-[#a8a39c] bg-[var(--surface-hover)]";
}

interface StatChipProps {
  label: string;
  value: string;
}

function StatChip({ label, value }: StatChipProps) {
  return (
    <div className="rounded-lg bg-[var(--bg-tertiary)] px-3 py-2">
      <p className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">{value}</p>
      <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">{label}</p>
    </div>
  );
}

/**
 * "What Haven knows about you" — the Sprint 11 memory transparency panel.
 *
 * Surfaces everything Haven has learned (insights, productive hours,
 * patterns, preferences, vocabulary, behavioural stats) in a clean, readable
 * list, and gives the user full control: forget any single item or clear all
 * memory. Builds trust for the persistent-memory feature.
 */
export function MemorySection({ authToken }: { authToken: string }) {
  const [memory, setMemory] = useState<MemoryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchMemory(authToken);
    setMemory(data);
    setLoading(false);
  }, [authToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    if (!authToken) return;
    setRefreshing(true);
    setError(null);
    try {
      const updated = await refreshMemory(authToken);
      setMemory(updated);
    } catch {
      setError("Couldn't refresh memory. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleForgetInsight = async (insight: MemoryInsight) => {
    if (!authToken) return;
    // Optimistic removal for snappy UX.
    setMemory((prev) =>
      prev ? { ...prev, insights: prev.insights.filter((i) => i.id !== insight.id) } : prev
    );
    try {
      const { view } = await forgetMemoryItem(authToken, {
        kind: "insight",
        id: insight.id,
      });
      setMemory(view);
    } catch {
      setError("Couldn't forget that item. Please try again.");
      load();
    }
  };

  const handleForgetPattern = async (value: string) => {
    if (!authToken) return;
    setMemory((prev) =>
      prev ? { ...prev, task_patterns: prev.task_patterns.filter((p) => p !== value) } : prev
    );
    try {
      const { view } = await forgetMemoryItem(authToken, { kind: "pattern", value });
      setMemory(view);
    } catch {
      setError("Couldn't forget that pattern. Please try again.");
      load();
    }
  };

  const handleForgetPreference = async (key: string) => {
    if (!authToken) return;
    try {
      const { view } = await forgetMemoryItem(authToken, { kind: "preference", key });
      setMemory(view);
    } catch {
      setError("Couldn't forget that preference. Please try again.");
    }
  };

  const handleForgetVocab = async (key: string) => {
    if (!authToken) return;
    try {
      const { view } = await forgetMemoryItem(authToken, { kind: "vocabulary", key });
      setMemory(view);
    } catch {
      setError("Couldn't forget that alias. Please try again.");
    }
  };

  const handleClearAll = async () => {
    if (!authToken) return;
    setClearing(true);
    setError(null);
    try {
      await clearAllMemory(authToken);
      setConfirmClear(false);
      await load();
    } catch {
      setError("Couldn't clear memory. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  const stats = memory?.behavioral_stats;
  const hasAnything =
    !!memory &&
    (memory.insights.length > 0 ||
      memory.task_patterns.length > 0 ||
      memory.productive_hours.length > 0 ||
      memory.avoided_hours.length > 0 ||
      Object.keys(memory.learned_preferences || {}).length > 0 ||
      Object.keys(memory.vocabulary || {}).length > 0 ||
      (memory.observation_count ?? 0) > 0);

  return (
    <Card hover={false} className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/10">
            <Brain size={18} strokeWidth={1.5} className="text-accent-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
              What Haven knows about you
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] leading-relaxed">
              Learned from how you actually work. You&apos;re always in control.
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4] transition-colors disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            strokeWidth={1.5}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-tertiary)] dark:text-[#847e76] py-6 text-center">
          Loading what Haven has learned...
        </p>
      ) : !hasAnything ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Sparkles size={22} strokeWidth={1.5} className="text-[var(--text-tertiary)] dark:text-[#847e76]" />
          <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c]">
            Haven hasn&apos;t learned anything about you yet.
          </p>
          <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] max-w-sm">
            As you complete tasks, run focus sessions, and reschedule events,
            Haven builds a private picture of how you work — and uses it to
            plan smarter days.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Behavioural stats */}
          {stats && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={14} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#a8a39c]">
                  Your numbers
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatChip
                  label="Completion rate"
                  value={`${Math.round((stats.completion_rate || 0) * 100)}%`}
                />
                <StatChip
                  label="Estimate accuracy"
                  value={
                    stats.estimate_samples > 0
                      ? `${Math.round((stats.estimate_accuracy || 0) * 100)}%`
                      : "—"
                  }
                />
                <StatChip label="Tasks completed" value={String(stats.tasks_completed)} />
                <StatChip label="Focus sessions" value={String(stats.focus_sessions)} />
              </div>
            </div>
          )}

          {/* Productive / avoided hours */}
          {(memory!.productive_hours.length > 0 || memory!.avoided_hours.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {memory!.productive_hours.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={14} strokeWidth={1.5} className="text-emerald-500" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#a8a39c]">
                      Most productive
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...memory!.productive_hours].sort((a, b) => a - b).map((h) => (
                      <span
                        key={`p-${h}`}
                        className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500"
                      >
                        {hourLabel(h)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {memory!.avoided_hours.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={14} strokeWidth={1.5} className="text-amber-500 rotate-180" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#a8a39c]">
                      Tends to avoid
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...memory!.avoided_hours].sort((a, b) => a - b).map((h) => (
                      <span
                        key={`a-${h}`}
                        className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500"
                      >
                        {hourLabel(h)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Insights */}
          {memory!.insights.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={14} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#a8a39c]">
                  Insights
                </h3>
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {memory!.insights.map((insight) => (
                    <motion.li
                      key={insight.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="group flex items-start justify-between gap-3 rounded-lg bg-[var(--bg-tertiary)] px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${categoryStyle(
                            insight.category
                          )}`}
                        >
                          {insight.category}
                        </span>
                        <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4] leading-snug">
                          {insight.text}
                        </p>
                      </div>
                      <button
                        onClick={() => handleForgetInsight(insight)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-tertiary)] dark:text-[#847e76] opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        aria-label="Forget this insight"
                      >
                        <X size={12} strokeWidth={1.5} />
                        Forget
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          )}

          {/* Patterns */}
          {memory!.task_patterns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Repeat size={14} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#a8a39c]">
                  Patterns
                </h3>
              </div>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {memory!.task_patterns.map((pattern) => (
                    <motion.li
                      key={pattern}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="group flex items-start justify-between gap-3 rounded-lg bg-[var(--bg-tertiary)] px-3 py-2.5"
                    >
                      <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4] leading-snug">
                        {pattern}
                      </p>
                      <button
                        onClick={() => handleForgetPattern(pattern)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-tertiary)] dark:text-[#847e76] opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        aria-label="Forget this pattern"
                      >
                        <X size={12} strokeWidth={1.5} />
                        Forget
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          )}

          {/* Learned preferences */}
          {Object.keys(memory!.learned_preferences || {}).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#a8a39c]">
                  Preferences
                </h3>
              </div>
              <ul className="space-y-2">
                {Object.entries(memory!.learned_preferences).map(([key, value]) => (
                  <li
                    key={key}
                    className="group flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-tertiary)] px-3 py-2.5"
                  >
                    <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
                      <span className="text-[var(--text-secondary)] dark:text-[#a8a39c]">
                        {key.replace(/_/g, " ")}:
                      </span>{" "}
                      {String(value)}
                    </p>
                    <button
                      onClick={() => handleForgetPreference(key)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-tertiary)] dark:text-[#847e76] opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      aria-label="Forget this preference"
                    >
                      <X size={12} strokeWidth={1.5} />
                      Forget
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Vocabulary / aliases */}
          {Object.keys(memory!.vocabulary || {}).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#a8a39c]">
                  Vocabulary
                </h3>
              </div>
              <ul className="space-y-2">
                {Object.entries(memory!.vocabulary).map(([key, value]) => (
                  <li
                    key={key}
                    className="group flex items-center justify-between gap-3 rounded-lg bg-[var(--bg-tertiary)] px-3 py-2.5"
                  >
                    <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
                      <span className="font-medium">&ldquo;{key}&rdquo;</span>{" "}
                      <span className="text-[var(--text-tertiary)] dark:text-[#847e76]">means</span> {value}
                    </p>
                    <button
                      onClick={() => handleForgetVocab(key)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-tertiary)] dark:text-[#847e76] opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      aria-label="Forget this alias"
                    >
                      <X size={12} strokeWidth={1.5} />
                      Forget
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer: observation count + clear all */}
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
            <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
              {memory!.observation_count} signal
              {memory!.observation_count === 1 ? "" : "s"} learned from
            </p>
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={13} strokeWidth={1.5} />
                Clear all memory
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-secondary)] dark:text-[#a8a39c]">Are you sure?</span>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {clearing ? "Clearing..." : "Yes, forget everything"}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg bg-[var(--surface-hover)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default MemorySection;
