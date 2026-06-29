"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Calendar,
  CheckSquare,
  Timer,
  AlertTriangle,
  X,
  Check,
  Loader2,
  Eye,
} from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { fetchAutopilotPlan, executeAutopilotPlan } from "@/lib/api-extended";

type AutopilotMode = "ask_permission" | "full_auto";

interface PlanAction {
  type: "create_event" | "schedule_task" | "move_event";
  details: Record<string, any>;
  enabled?: boolean;
}

interface PlanResult {
  plan_id: string;
  actions: PlanAction[];
  summary: string;
}

interface ExecuteResult {
  plan_id: string;
  executed: number;
  failed: number;
  changes: any[];
}

const STORAGE_KEY = "chronai-autopilot-mode";

function getStoredMode(): AutopilotMode {
  if (typeof window === "undefined") return "ask_permission";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "full_auto") return "full_auto";
  return "ask_permission";
}

function getActionIcon(type: string) {
  switch (type) {
    case "create_event":
      return { Icon: Calendar, color: "text-accent-500", bg: "bg-accent-500/10" };
    case "schedule_task":
      return { Icon: CheckSquare, color: "text-warning-500", bg: "bg-warning-500/10" };
    case "move_event":
      return { Icon: Timer, color: "text-success-500", bg: "bg-success-500/10" };
    default:
      return { Icon: Zap, color: "text-accent-500", bg: "bg-accent-500/10" };
  }
}

function getActionLabel(action: PlanAction): string {
  const { type, details } = action;
  switch (type) {
    case "create_event":
      return `Create event: "${details.summary || "Event"}" at ${details.start_time || "TBD"}`;
    case "schedule_task":
      return `Schedule task: "${details.task_title || "Task"}" at ${details.start_time || "TBD"}`;
    case "move_event":
      return `Move event to ${details.new_start_time || "new time"}`;
    default:
      return `Action: ${type}`;
  }
}

export default function AutoPilotPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";

  const [mode, setMode] = useState<AutopilotMode>("ask_permission");
  const [phase, setPhase] = useState<
    "idle" | "loading" | "plan_ready" | "confirming_auto" | "executing" | "done"
  >("idle");
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [actionToggles, setActionToggles] = useState<boolean[]>([]);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load mode from localStorage
  useEffect(() => {
    setMode(getStoredMode());
  }, []);

  const updateMode = useCallback((newMode: AutopilotMode) => {
    setMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const resetState = useCallback(() => {
    setPhase("idle");
    setPlan(null);
    setActionToggles([]);
    setExecuteResult(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handlePlanMyDay = useCallback(async () => {
    if (!accessToken) {
      setError("Please sign in to use Auto-Pilot.");
      return;
    }

    setError(null);

    if (mode === "full_auto") {
      // Show warning first
      setPhase("confirming_auto");
      return;
    }

    // Ask Permission mode: generate plan
    setPhase("loading");
    try {
      const result = await fetchAutopilotPlan(accessToken);
      setPlan(result);
      setActionToggles(result.actions.map(() => true));
      setPhase("plan_ready");
    } catch (e: any) {
      setError(e.message || "Failed to generate plan");
      setPhase("idle");
    }
  }, [accessToken, mode]);

  const handleConfirmAuto = useCallback(async () => {
    if (!accessToken) return;
    setPhase("loading");
    try {
      const planResult = await fetchAutopilotPlan(accessToken);
      setPlan(planResult);

      // Immediately execute all actions
      setPhase("executing");
      const execResult = await executeAutopilotPlan(
        accessToken,
        planResult.plan_id,
        planResult.actions
      );
      setExecuteResult(execResult);
      setPhase("done");
    } catch (e: any) {
      setError(e.message || "Failed to execute plan");
      setPhase("idle");
    }
  }, [accessToken]);

  const handleAcceptPlan = useCallback(async () => {
    if (!accessToken || !plan) return;

    // Filter to only enabled actions
    const enabledActions = plan.actions.filter((_, i) => actionToggles[i]);
    if (enabledActions.length === 0) {
      setError("No actions selected. Toggle at least one action to proceed.");
      return;
    }

    setPhase("executing");
    setError(null);
    try {
      const execResult = await executeAutopilotPlan(
        accessToken,
        plan.plan_id,
        enabledActions
      );
      setExecuteResult(execResult);
      setPhase("done");
    } catch (e: any) {
      setError(e.message || "Failed to execute plan");
      setPhase("plan_ready");
    }
  }, [accessToken, plan, actionToggles]);

  const toggleAction = useCallback((index: number) => {
    setActionToggles((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  return (
    <Modal open={open} onClose={handleClose} className="max-w-xl">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10">
              <Zap size={20} strokeWidth={1.5} className="text-accent-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
                Auto-Pilot
              </h2>
              <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
                AI-powered day planning
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-[var(--text-tertiary)] dark:text-[#847e76] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Mode Selection Cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Suggest Mode Card */}
          <button
            onClick={() => updateMode("ask_permission")}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              mode === "ask_permission"
                ? "border-accent-500 bg-accent-500/5 shadow-sm shadow-accent-500/10"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-tertiary)]/30"
            }`}
          >
            {mode === "ask_permission" && (
              <div className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500">
                <Check size={12} strokeWidth={2.5} className="text-white" />
              </div>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 mb-3">
              <Eye size={16} strokeWidth={1.5} className="text-accent-500" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
              Suggest Mode
            </p>
            <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] mt-1 leading-relaxed">
              AI plans your day and asks for your approval before making changes
            </p>
          </button>

          {/* Auto Mode Card */}
          <button
            onClick={() => updateMode("full_auto")}
            className={`relative rounded-xl border-2 p-4 text-left transition-all ${
              mode === "full_auto"
                ? "border-warning-500 bg-warning-500/5 shadow-sm shadow-warning-500/10"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-tertiary)]/30"
            }`}
          >
            {mode === "full_auto" && (
              <div className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-warning-500">
                <Check size={12} strokeWidth={2.5} className="text-white" />
              </div>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-500/10 mb-3">
              <Zap size={16} strokeWidth={1.5} className="text-warning-500" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
              Auto Mode
            </p>
            <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] mt-1 leading-relaxed">
              AI automatically plans and executes changes
            </p>
          </button>
        </div>

        {/* Auto Mode Warning - always visible when auto mode is selected */}
        <AnimatePresence>
          {mode === "full_auto" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-5"
            >
              <div className="flex items-start gap-2.5 rounded-lg border border-warning-500/20 bg-warning-500/5 px-3.5 py-2.5">
                <AlertTriangle
                  size={14}
                  strokeWidth={1.5}
                  className="text-warning-500 flex-shrink-0 mt-0.5"
                />
                <p className="text-xs text-warning-600 dark:text-warning-400 leading-relaxed">
                  This may change your current schedules
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 rounded-lg border border-danger-500/20 bg-danger-500/5 px-4 py-3"
            >
              <p className="text-sm text-danger-500">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase: Idle - Plan My Day button */}
        {phase === "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c] leading-relaxed">
              Let AI analyze your tasks, events, and priorities to create an
              optimal schedule for today.
            </p>
            <Button
              onClick={handlePlanMyDay}
              className="w-full flex items-center justify-center gap-2 py-3"
            >
              <Zap size={16} strokeWidth={1.5} />
              Plan My Day
            </Button>
          </motion.div>
        )}

        {/* Phase: Confirming Full Auto */}
        {phase === "confirming_auto" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3 rounded-xl border border-danger-500/20 bg-danger-500/5 p-4">
              <AlertTriangle
                size={20}
                strokeWidth={1.5}
                className="text-danger-500 flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
                  Full Auto Mode Warning
                </p>
                <p className="text-xs text-[var(--text-secondary)] dark:text-[#a8a39c] mt-1 leading-relaxed">
                  This may change your current schedules in the calendar. AI will
                  plan and immediately execute changes to your calendar and tasks
                  without asking for confirmation.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPhase("idle")}
                className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={handleConfirmAuto}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <Zap size={14} strokeWidth={1.5} />
                Proceed
              </Button>
            </div>
          </motion.div>
        )}

        {/* Phase: Loading */}
        {phase === "loading" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Loader2
              size={32}
              strokeWidth={1.5}
              className="text-accent-500 animate-spin"
            />
            <p className="mt-4 text-sm text-[var(--text-secondary)] dark:text-[#a8a39c]">
              Analyzing your day and generating plan...
            </p>
          </motion.div>
        )}

        {/* Phase: Executing */}
        {phase === "executing" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <Loader2
              size={32}
              strokeWidth={1.5}
              className="text-success-500 animate-spin"
            />
            <p className="mt-4 text-sm text-[var(--text-secondary)] dark:text-[#a8a39c]">
              Executing plan changes...
            </p>
          </motion.div>
        )}

        {/* Phase: Plan Ready (Ask Permission mode) */}
        {phase === "plan_ready" && plan && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Plan summary */}
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
              <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4] leading-relaxed">
                {plan.summary}
              </p>
            </div>

            {/* Action cards */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {plan.actions.map((action, index) => {
                const { Icon, color, bg } = getActionIcon(action.type);
                const enabled = actionToggles[index] ?? true;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                      enabled
                        ? "border-[var(--border)] bg-[var(--surface)]"
                        : "border-transparent bg-[var(--surface)] opacity-50"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} flex-shrink-0`}
                    >
                      <Icon size={16} strokeWidth={1.5} className={color} />
                    </div>
                    <p className="flex-1 text-sm text-[var(--text-primary)] dark:text-[#ece9e4] truncate">
                      {getActionLabel(action)}
                    </p>
                    <Toggle
                      checked={enabled}
                      onChange={() => toggleAction(index)}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Accept / Reject */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={resetState}
                className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Reject
              </button>
              <Button
                onClick={handleAcceptPlan}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <Check size={14} strokeWidth={1.5} />
                Accept & Execute
              </Button>
            </div>
          </motion.div>
        )}

        {/* Phase: Done */}
        {phase === "done" && executeResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Summary stats */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl bg-success-500/10 border border-success-500/20 p-4 text-center">
                <p className="text-2xl font-bold text-success-500">
                  {executeResult.executed}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] mt-1">
                  Executed
                </p>
              </div>
              {executeResult.failed > 0 && (
                <div className="flex-1 rounded-xl bg-danger-500/10 border border-danger-500/20 p-4 text-center">
                  <p className="text-2xl font-bold text-danger-500">
                    {executeResult.failed}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] mt-1">
                    Failed
                  </p>
                </div>
              )}
            </div>

            {/* Plan summary */}
            {plan && (
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4] leading-relaxed">
                  {plan.summary}
                </p>
              </div>
            )}

            {/* Changes list */}
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {executeResult.changes.map((change, index) => {
                const isSuccess = change.status === "success";
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-[var(--surface)]"
                  >
                    {isSuccess ? (
                      <Check
                        size={14}
                        strokeWidth={2}
                        className="text-success-500 flex-shrink-0"
                      />
                    ) : (
                      <X
                        size={14}
                        strokeWidth={2}
                        className="text-danger-500 flex-shrink-0"
                      />
                    )}
                    <p className="text-xs text-[var(--text-secondary)] dark:text-[#a8a39c] truncate">
                      {change.summary || change.task_title || change.action}
                      {change.start_time && ` at ${change.start_time}`}
                      {change.reason && ` - ${change.reason}`}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Done button */}
            <Button
              onClick={handleClose}
              className="w-full flex items-center justify-center gap-2 py-3"
            >
              Done
            </Button>
          </motion.div>
        )}
      </div>
    </Modal>
  );
}
