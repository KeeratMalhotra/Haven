"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  GraduationCap,
  Rocket,
  Palette,
  User,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
} from "lucide-react";
import { postOnboarding } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Types & constants                                                    */
/* ------------------------------------------------------------------ */

const ROLES = [
  { id: "professional", label: "Professional", icon: Briefcase },
  { id: "student", label: "Student", icon: GraduationCap },
  { id: "entrepreneur", label: "Entrepreneur", icon: Rocket },
  { id: "freelancer", label: "Freelancer", icon: Palette },
  { id: "other", label: "Other", icon: User },
] as const;

const PRIORITIES = [
  "Deep Work",
  "Meetings",
  "Exercise",
  "Learning",
  "Family Time",
  "Side Projects",
  "Health",
  "Networking",
  "Creative Work",
  "Rest & Recovery",
] as const;

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, "0");
  return { value: i, label: `${h}:00` };
});

/* ------------------------------------------------------------------ */
/* Transition variants                                                 */
/* ------------------------------------------------------------------ */

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [role, setRole] = useState("");
  const [occupation, setOccupation] = useState("");
  const [workStart, setWorkStart] = useState(9);
  const [workEnd, setWorkEnd] = useState(17);
  const [wakeTime, setWakeTime] = useState(7);
  const [sleepTime, setSleepTime] = useState(23);
  const [dailyRoutine, setDailyRoutine] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [goals, setGoals] = useState("");

  const totalSteps = 4;

  const next = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }, []);

  const prev = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const togglePriority = (p: string) => {
    setPriorities((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await postOnboarding(accessToken, {
      role,
      occupation,
      work_hours_start: workStart,
      work_hours_end: workEnd,
      wake_time: wakeTime,
      sleep_time: sleepTime,
      daily_routine: dailyRoutine,
      priorities,
      goals: goals
        .split("\n")
        .map((g) => g.trim())
        .filter(Boolean),
      onboarding_complete: true,
    });
    router.push("/dashboard");
  };

  /* ---------------------------------------------------------------- */
  /* Step renderers                                                    */
  /* ---------------------------------------------------------------- */

  const renderStep0 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          What best describes you?
        </h2>
        <p className="mt-2 text-sm text-white/50">
          This helps ChronAI understand your workflow.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ROLES.map((r) => {
          const Icon = r.icon;
          const active = role === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                active
                  ? "border-indigo-500/60 bg-indigo-500/10 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/8"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-sm font-medium">{r.label}</span>
            </button>
          );
        })}
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-white/60">
          Your occupation or field
        </label>
        <input
          type="text"
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          placeholder="e.g. Software Engineer, Marketing Manager"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
        />
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          Tell us about your schedule
        </h2>
        <p className="mt-2 text-sm text-white/50">
          We will use this to time suggestions and structure your day.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm text-white/60">
            Work starts
          </label>
          <select
            value={workStart}
            onChange={(e) => setWorkStart(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
          >
            {HOURS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/60">
            Work ends
          </label>
          <select
            value={workEnd}
            onChange={(e) => setWorkEnd(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
          >
            {HOURS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/60">
            Wake time
          </label>
          <select
            value={wakeTime}
            onChange={(e) => setWakeTime(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
          >
            {HOURS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/60">
            Sleep time
          </label>
          <select
            value={sleepTime}
            onChange={(e) => setSleepTime(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
          >
            {HOURS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-white/60">
          Describe your typical daily routine (optional)
        </label>
        <textarea
          value={dailyRoutine}
          onChange={(e) => setDailyRoutine(e.target.value)}
          rows={3}
          placeholder="e.g. Morning run, deep work 9-12, meetings after lunch..."
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          What matters most to you?
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Select your priorities so we can focus on what counts.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRIORITIES.map((p) => {
          const active = priorities.includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePriority(p)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
                active
                  ? "border-indigo-500/60 bg-indigo-500/15 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/8"
              }`}
            >
              {active && <Check className="mr-1 inline h-3.5 w-3.5" />}
              {p}
            </button>
          );
        })}
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-white/60">
          Your goals (one per line)
        </label>
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={4}
          placeholder={"Ship my side project by March\nExercise 4x per week\nRead 2 books per month"}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          You are all set!
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Here is a summary of your profile. You can always update this later.
        </p>
      </div>
      <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
        <SummaryRow label="Role" value={role || "Not set"} />
        <SummaryRow label="Occupation" value={occupation || "Not set"} />
        <SummaryRow
          label="Work hours"
          value={`${workStart.toString().padStart(2, "0")}:00 - ${workEnd.toString().padStart(2, "0")}:00`}
        />
        <SummaryRow
          label="Wake / Sleep"
          value={`${wakeTime.toString().padStart(2, "0")}:00 / ${sleepTime.toString().padStart(2, "0")}:00`}
        />
        <SummaryRow
          label="Priorities"
          value={priorities.length > 0 ? priorities.join(", ") : "None selected"}
        />
        <SummaryRow
          label="Goals"
          value={goals.trim() || "None set"}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-indigo-500/30 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {submitting ? "Setting up..." : "Start using ChronAI"}
      </button>
    </div>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3];

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-base-950 px-4">
      {/* Ambient gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-8 bg-indigo-500"
                  : i < step
                    ? "w-4 bg-indigo-500/50"
                    : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Glass panel */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {steps[step]()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          {step < totalSteps - 1 && (
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={prev}
                disabled={step === 0}
                className="flex items-center gap-1 text-sm text-white/40 transition hover:text-white/70 disabled:invisible"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={next}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {step === totalSteps - 1 && step > 0 && (
            <div className="mt-8">
              <button
                onClick={prev}
                className="flex items-center gap-1 text-sm text-white/40 transition hover:text-white/70"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Subcomponents                                                        */
/* ------------------------------------------------------------------ */

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-white/40">{label}</span>
      <span className="text-right text-sm text-white/80">{value}</span>
    </div>
  );
}
