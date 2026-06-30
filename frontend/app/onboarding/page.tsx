"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
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
  Mic,
  MicOff,
  Calendar,
  CheckSquare,
  Flame,
  Loader2,
  Wand2,
} from "lucide-react";
import { postOnboarding } from "@/lib/api";
import { parseBraindump, type BrainDumpResult } from "@/lib/api-extended";
import { startListening } from "@/lib/voice";
import { Confetti } from "@/components/ui/Confetti";

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

// Conversational form steps (the reveal is a separate phase, not counted here).
const totalSteps = 5;

const BRAINDUMP_PLACEHOLDER =
  "Dentist Tuesday at 3pm, finish the Q3 report by Friday, gym 3x this week, mom's birthday next Wednesday, read 20 min every night...";

/* ------------------------------------------------------------------ */
/* Animation variants                                                  */
/* ------------------------------------------------------------------ */

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 120 : -120, opacity: 0, scale: 0.95 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -120 : 120, opacity: 0, scale: 0.95 }),
};

/* ------------------------------------------------------------------ */
/* Extracted stable components                                         */
/* ------------------------------------------------------------------ */

function Assistant({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-start gap-3">
      <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-warm-300 to-warm-600 shadow-sm ring-2 ring-warm-400/30 ring-offset-2 ring-offset-[var(--bg)]">
        <Sparkles className="h-5 w-5 text-[#3a2418]" />
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 text-left">
        <p className="text-sm leading-relaxed text-[var(--text-primary)] dark:text-[#ece9e4] sm:text-base">
          {children}
        </p>
      </div>
    </div>
  );
}

function ProgressBar({ step, totalSteps: total }: { step: number; totalSteps: number }) {
  return (
    <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 px-6 py-6">
      <div className="flex items-center gap-2 pixel-corners border-[2px] border-[#3a2418]/20 bg-[var(--surface)]/80 px-4 py-2.5 backdrop-blur-xl">
        <span
          className="pixelated grid place-items-center bg-gradient-to-br from-warm-300 to-warm-600 shadow-pixel-sm"
          style={{ width: 22, height: 22, imageRendering: "pixelated" }}
        >
          <svg width={14} height={14} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
            <g fill="#3a2418">
              <rect x="1" y="1" width="2" height="6" />
              <rect x="5" y="1" width="2" height="6" />
              <rect x="3" y="3" width="2" height="2" />
            </g>
          </svg>
        </span>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <div key={i} className="relative flex items-center">
              <motion.div
                className="relative h-1.5 overflow-hidden bg-[var(--border-subtle)] pixel-corners"
                animate={{ width: i === step ? "2.5rem" : "1rem" }}
                transition={spring}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-warm-400 to-warm-500"
                  initial={{ width: "0%" }}
                  animate={{ width: i <= step ? "100%" : "0%" }}
                  transition={spring}
                />
              </motion.div>
            </div>
          ))}
        </div>
        <span className="ml-2 font-mono text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
          {step + 1}/{total}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";
  const sessionFirstName = session?.user?.name?.split(" ")[0] || "";

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  // Reveal phase
  const [result, setResult] = useState<BrainDumpResult | null>(null);

  // Voice capture
  const [listening, setListening] = useState(false);

  // Form state
  const [name, setName] = useState(sessionFirstName);
  const [role, setRole] = useState("");
  const [occupation, setOccupation] = useState("");
  const [workStart, setWorkStart] = useState(9);
  const [workEnd, setWorkEnd] = useState(17);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [braindump, setBraindump] = useState("");

  const displayName = (name || sessionFirstName || "there").trim();

  // Override body overflow:hidden for onboarding page scrollability
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

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

  const handleVoice = useCallback(async () => {
    if (listening) return;
    setListening(true);
    try {
      const transcript = await startListening();
      if (transcript) {
        setBraindump((cur) => (cur ? `${cur} ${transcript}` : transcript));
      }
    } catch {
      // Speech not supported / denied — silently ignore, typing still works.
    } finally {
      setListening(false);
    }
  }, [listening]);

  const saveProfile = useCallback(async () => {
    await postOnboarding(accessToken, {
      role,
      occupation,
      work_hours_start: workStart,
      work_hours_end: workEnd,
      wake_time: 7,
      sleep_time: 23,
      daily_routine: "",
      priorities,
      goals: [],
      onboarding_complete: true,
    });
  }, [accessToken, role, occupation, workStart, workEnd, priorities]);

  // Brain-dump -> save profile -> parse -> reveal.
  const handlePlanWeek = useCallback(async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await saveProfile();
      const parsed = await parseBraindump(accessToken, braindump.trim());
      setResult(parsed);
      setShowConfetti(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong while planning your week. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [accessToken, braindump, saveProfile]);

  // Skip the brain-dump but still complete onboarding.
  const handleSkip = useCallback(async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      await saveProfile();
      router.push("/dashboard");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save your profile."
      );
      setSubmitting(false);
    }
  }, [saveProfile, router]);

  /* ---------------------------------------------------------------- */
  /* Step 0: Welcome + name                                            */
  /* ---------------------------------------------------------------- */

  const renderStep0 = () => (
    <div className="flex flex-col items-center">
      <Assistant>
        Hi{sessionFirstName ? `, ${sessionFirstName}` : ""}! I&apos;m Haven.
        I&apos;ll help you plan your week in a couple of minutes. First — what
        should I call you?
      </Assistant>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.15 }}
        className="w-full max-w-md"
      >
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") next();
          }}
          placeholder="Your name"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-center text-base text-[var(--text-primary)] dark:text-[#ece9e4] placeholder-[var(--text-tertiary)] outline-none transition-all duration-200 focus:border-warm-400/50 focus:ring-2 focus:ring-warm-400/20"
        />
      </motion.div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /* Step 1: Role + occupation                                         */
  /* ---------------------------------------------------------------- */

  const renderStep1 = () => (
    <div className="flex flex-col items-center">
      <Assistant>
        Nice to meet you, {displayName}. What best describes what you do? This
        helps me understand your workflow.
      </Assistant>

      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-3">
        {ROLES.map((r, i) => {
          const Icon = r.icon;
          const active = role === r.id;
          return (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring, delay: i * 0.06 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setRole(r.id)}
              className={`relative flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all duration-200 ${
                active
                  ? "border-warm-400/60 bg-warm-400/10 text-[var(--text-primary)] dark:text-[#ece9e4] shadow-sm"
                  : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] dark:text-[#a8a39c] hover:border-[var(--border)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-sm font-medium">{r.label}</span>
              {active && (
                <motion.div
                  layoutId="role-check"
                  className="absolute -top-1.5 -right-1.5"
                  transition={spring}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-warm-300 to-warm-500 shadow-sm">
                    <Check className="h-3 w-3 text-[#3a2418]" />
                  </div>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.3 }}
        className="mt-8 w-full max-w-md"
      >
        <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
          Your occupation or field
        </label>
        <input
          type="text"
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          placeholder="e.g. Software Engineer, Marketing Manager"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] dark:text-[#ece9e4] placeholder-[var(--text-tertiary)] outline-none transition-all duration-200 focus:border-warm-400/50 focus:ring-2 focus:ring-warm-400/20"
        />
      </motion.div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /* Step 2: Work hours                                                */
  /* ---------------------------------------------------------------- */

  const renderStep2 = () => (
    <div className="flex flex-col items-center">
      <Assistant>
        When are your working hours? I&apos;ll protect your mornings for deep
        work and time my suggestions around your day.
      </Assistant>

      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          <TimeSelect label="Work starts" value={workStart} onChange={setWorkStart} />
          <TimeSelect label="Work ends" value={workEnd} onChange={setWorkEnd} />
        </motion.div>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /* Step 3: Priorities                                                */
  /* ---------------------------------------------------------------- */

  const renderStep3 = () => (
    <div className="flex flex-col items-center">
      <Assistant>
        What matters most to you right now? Pick a few — I&apos;ll focus your
        plan around them.
      </Assistant>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
        className="flex w-full max-w-md flex-wrap justify-center gap-2.5"
      >
        {PRIORITIES.map((p, i) => {
          const active = priorities.includes(p);
          return (
            <motion.button
              key={p}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring, delay: i * 0.04 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => togglePriority(p)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                active
                  ? "border-warm-400/60 bg-warm-400/15 text-warm-300 shadow-sm"
                  : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] dark:text-[#a8a39c] hover:border-[var(--border)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <motion.span
                initial={false}
                animate={{
                  width: active ? 14 : 0,
                  opacity: active ? 1 : 0,
                }}
                transition={spring}
                className="inline-flex overflow-hidden"
              >
                <Check className="h-3.5 w-3.5 flex-shrink-0" />
              </motion.span>
              {p}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /* Step 4: Brain-dump                                                */
  /* ---------------------------------------------------------------- */

  const renderStep4 = () => (
    <div className="flex flex-col items-center">
      <Assistant>
        Now the magic part. Just dump everything on your mind for the week —
        appointments, deadlines, routines, anything. I&apos;ll turn it into a
        real plan. Type it however you think it.
      </Assistant>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
        className="relative w-full max-w-xl"
      >
        <textarea
          value={braindump}
          autoFocus
          onChange={(e) => setBraindump(e.target.value)}
          rows={6}
          placeholder={BRAINDUMP_PLACEHOLDER}
          className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 pr-14 text-sm leading-relaxed text-[var(--text-primary)] dark:text-[#ece9e4] placeholder-[var(--text-tertiary)] outline-none transition-all duration-200 focus:border-warm-400/50 focus:ring-2 focus:ring-warm-400/20"
        />
        <button
          type="button"
          onClick={handleVoice}
          aria-label={listening ? "Listening..." : "Dictate with your voice"}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 ${
            listening
              ? "animate-pulse border-warm-500/60 bg-warm-500/20 text-warm-300"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-tertiary)] dark:text-[#847e76] hover:border-warm-400/40 hover:text-warm-400"
          }`}
        >
          {listening ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.2 }}
        className="mt-6 flex w-full max-w-xl flex-col items-center gap-3"
      >
        <button
          onClick={handlePlanWeek}
          disabled={submitting || !braindump.trim()}
          className="pixel-corners pixel-press group relative flex w-full items-center justify-center gap-2.5 border-[3px] border-[#3a2418]/20 bg-gradient-to-br from-warm-300 to-warm-500 px-6 py-4 text-base font-semibold text-[#3a2418] shadow-pixel-sm transition-all duration-200 hover:from-warm-400 hover:to-warm-600 active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
        >
          {submitting ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <Wand2 className="h-4.5 w-4.5" />
          )}
          <span>
            {submitting ? "Planning your week..." : "Plan my week"}
          </span>
        </button>

        <button
          onClick={handleSkip}
          disabled={submitting}
          className="text-sm text-[var(--text-tertiary)] dark:text-[#847e76] transition-colors hover:text-[var(--text-secondary)] dark:hover:text-[#a8a39c] disabled:opacity-50"
        >
          Skip for now
        </button>
      </motion.div>

      {submitError && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-center text-sm text-danger-400"
        >
          {submitError}
        </motion.p>
      )}
    </div>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  /* ---------------------------------------------------------------- */
  /* Reveal phase                                                      */
  /* ---------------------------------------------------------------- */

  if (result) {
    return (
      <RevealView
        result={result}
        displayName={displayName}
        showConfetti={showConfetti}
        onContinue={() => router.push("/dashboard")}
      />
    );
  }

  /* ---------------------------------------------------------------- */
  /* Form Render                                                       */
  /* ---------------------------------------------------------------- */

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-y-auto bg-[var(--bg)]">
      {/* Subtle pixel-grid background */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='1' height='1' fill='%23a8572f'/%3E%3C/svg%3E\")", backgroundSize: "16px 16px" }} />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[25%] left-[30%] h-[500px] w-[500px] rounded-full bg-warm-500/[0.06] blur-[100px] animate-breathe" />
        <div className="absolute -bottom-[15%] right-[20%] h-[400px] w-[400px] rounded-full bg-warm-700/[0.04] blur-[80px] animate-float" />
        <div className="absolute top-[50%] -left-[10%] h-[300px] w-[300px] rounded-full bg-clay-400/[0.03] blur-[60px] animate-float" />
      </div>

      <ProgressBar step={step} totalSteps={totalSteps} />

      <div className="relative z-10 flex w-full max-w-2xl flex-1 items-center justify-center px-6 py-24">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            className="w-full"
          >
            {steps[step]()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation — hidden on the brain-dump step which has its own CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg)]/80 px-6 py-4 backdrop-blur-xl">
        <button
          onClick={prev}
          disabled={step === 0}
          className={`pixel-corners inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-all duration-200 hover:border-warm-400/40 hover:bg-warm-400/5 disabled:opacity-50 ${step === 0 ? "invisible" : ""}`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {step < totalSteps - 1 && (
          <button
            onClick={next}
            className="pixel-corners inline-flex items-center gap-2 border-[2px] border-[#3a2418]/20 bg-gradient-to-br from-warm-300 to-warm-500 px-5 py-2.5 text-sm font-semibold text-[#3a2418] transition-all duration-200 hover:from-warm-400 hover:to-warm-600 active:scale-[0.97]"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Reveal View — the WOW moment                                         */
/* ------------------------------------------------------------------ */

function RevealView({
  result,
  displayName,
  showConfetti,
  onContinue,
}: {
  result: BrainDumpResult;
  displayName: string;
  showConfetti: boolean;
  onContinue: () => void;
}) {
  const { counts } = result;
  const totalCreated = counts.tasks + counts.events + counts.habits;

  const summaryStats = useMemo(
    () => [
      {
        icon: CheckSquare,
        count: counts.tasks,
        label: counts.tasks === 1 ? "task" : "tasks",
        color: "text-warning-500",
        bg: "bg-warning-500/10",
      },
      {
        icon: Calendar,
        count: counts.events,
        label: counts.events === 1 ? "event" : "events",
        color: "text-accent-500",
        bg: "bg-accent-500/10",
      },
      {
        icon: Flame,
        count: counts.habits,
        label: counts.habits === 1 ? "habit" : "habits",
        color: "text-success-500",
        bg: "bg-success-500/10",
      },
    ],
    [counts]
  );

  const listContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
  };
  const listItem = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    },
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-y-auto bg-[var(--bg)]">
      <Confetti active={showConfetti} />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[25%] left-[30%] h-[500px] w-[500px] rounded-full bg-accent-500/[0.07] blur-[100px] animate-breathe" />
        <div className="absolute -bottom-[15%] right-[20%] h-[400px] w-[400px] rounded-full bg-accent-700/[0.05] blur-[80px] animate-float" />
      </div>

      <div className="relative z-10 w-full max-w-2xl px-6 py-20">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
            className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500 shadow-sm"
          >
            <Sparkles className="h-7 w-7 text-white" />
          </motion.div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] dark:text-[#ece9e4] sm:text-4xl">
            Here&apos;s your week, planned.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-[var(--text-secondary)] dark:text-[#a8a39c]">
            {totalCreated > 0
              ? result.summary
              : "I couldn't find anything to plan just yet — you can add things any time from your dashboard."}
          </p>
        </motion.div>

        {/* Stat counters */}
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="mt-10 grid grid-cols-3 gap-3"
        >
          {summaryStats.map((s) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                variants={listItem}
                className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg}`}>
                  <Icon className={`h-5 w-5 ${s.color}`} strokeWidth={1.5} />
                </div>
                <span className="text-2xl font-bold tabular-nums text-[var(--text-primary)] dark:text-[#ece9e4]">
                  {s.count}
                </span>
                <span className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">{s.label}</span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Detailed lists */}
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="mt-8 space-y-6"
        >
          {result.events.length > 0 && (
            <RevealSection
              title="Scheduled"
              icon={Calendar}
              iconColor="text-accent-500"
              variants={listItem}
            >
              {result.events.map((e, i) => (
                <RevealRow key={e.id || i} accent="bg-accent-500" title={e.summary}>
                  {formatEventTime(e.start)}
                </RevealRow>
              ))}
            </RevealSection>
          )}

          {result.tasks.length > 0 && (
            <RevealSection
              title="To do"
              icon={CheckSquare}
              iconColor="text-warning-500"
              variants={listItem}
            >
              {result.tasks.map((t, i) => (
                <RevealRow key={i} accent="bg-warning-500" title={t.title}>
                  {t.due_days_from_now === 0
                    ? "Due today"
                    : `Due in ${t.due_days_from_now} day${t.due_days_from_now === 1 ? "" : "s"}`}
                </RevealRow>
              ))}
            </RevealSection>
          )}

          {result.habits.length > 0 && (
            <RevealSection
              title="Habits"
              icon={Flame}
              iconColor="text-success-500"
              variants={listItem}
            >
              {result.habits.map((h, i) => (
                <RevealRow key={h.id || i} accent="bg-success-500" title={h.name}>
                  {h.frequency === "daily"
                    ? "Daily"
                    : `${h.target_days}x / week`}
                </RevealRow>
              ))}
            </RevealSection>
          )}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, ...{ type: "spring", stiffness: 300, damping: 30 } }}
          className="mt-10"
        >
          <button
            onClick={onContinue}
            className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-accent-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:bg-accent-600 hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>Take me to my dashboard</span>
            <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </motion.div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Subcomponents                                                        */
/* ------------------------------------------------------------------ */

function RevealSection({
  title,
  icon: Icon,
  iconColor,
  variants,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  iconColor: string;
  variants: Variants;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={variants}>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon size={15} strokeWidth={1.5} className={iconColor} />
        <h2 className="text-sm font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </motion.section>
  );
}

function RevealRow({
  accent,
  title,
  children,
}: {
  accent: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
      <div className={`h-8 w-[3px] flex-shrink-0 rounded-full ${accent}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">{title}</p>
        <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">{children}</p>
      </div>
    </div>
  );
}

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 pr-10 text-sm text-[var(--text-primary)] dark:text-[#ece9e4] outline-none transition-all duration-200 focus:border-warm-400/50 focus:ring-2 focus:ring-warm-400/20 cursor-pointer"
        >
          {HOURS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--text-tertiary)] dark:text-[#847e76]">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function formatEventTime(iso: string): string {
  if (!iso) return "Scheduled";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Scheduled";
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
