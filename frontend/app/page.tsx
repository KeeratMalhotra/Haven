"use client";

import { signIn } from "next-auth/react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/* ------------------------------------------------------------------ */
/* Motion helpers — snappy, slightly stepped pixel reveals             */
/* ------------------------------------------------------------------ */

const EASE_CALM = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_CALM },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.14, delayChildren: 0.08 },
  },
};

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.6, ease: EASE_CALM, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Wordmark — chunky pixel "H" badge                                   */
/* ------------------------------------------------------------------ */

function PixelLogo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="pixelated grid place-items-center bg-gradient-to-br from-warm-300 to-warm-600 shadow-pixel-sm"
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 8 8"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <g fill="#3a2418">
          <rect x="1" y="1" width="2" height="6" />
          <rect x="5" y="1" width="2" height="6" />
          <rect x="3" y="3" width="2" height="2" />
        </g>
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The AI caretaker sprite — a glowing pixel companion with eyes       */
/* ------------------------------------------------------------------ */

function AiSprite({
  size = 56,
  className = "",
  float = true,
}: {
  size?: number;
  className?: string;
  float?: boolean;
}) {
  return (
    <div
      className={`pixelated relative ${float ? "animate-pixel-bob" : ""} ${className}`}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    >
      {/* soft glow pool */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 bg-accent-400/30 blur-xl animate-pixel-flicker" />
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        role="img"
        aria-label="Haven, the AI caretaker sprite"
      >
        {/* body — rounded pixel orb */}
        <g>
          <rect x="5" y="2" width="6" height="1" fill="#a5b4fc" />
          <rect x="4" y="3" width="8" height="1" fill="#a5b4fc" />
          <rect x="3" y="4" width="10" height="8" fill="#818cf8" />
          <rect x="4" y="12" width="8" height="1" fill="#6366f1" />
          <rect x="5" y="13" width="6" height="1" fill="#6366f1" />
          {/* inner light */}
          <rect x="4" y="4" width="3" height="3" fill="#c7d2fe" />
        </g>
        {/* eyes — blink via scaleY */}
        <g
          fill="#1e1b4b"
          className="animate-pixel-blink"
          style={{ transformOrigin: "8px 8px" }}
        >
          <rect x="5" y="7" width="2" height="3" />
          <rect x="9" y="7" width="2" height="3" />
        </g>
        {/* little antenna spark */}
        <rect x="7" y="0" width="2" height="2" fill="#fcd34d" className="animate-pixel-twinkle" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Google icon                                                          */
/* ------------------------------------------------------------------ */

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Pixel CTA button                                                    */
/* ------------------------------------------------------------------ */

function GetStartedButton({
  size = "lg",
  label = "Enter Haven",
}: {
  size?: "md" | "lg";
  label?: string;
}) {
  const pad = size === "lg" ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm";
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className={`pixel-press pixel-corners group relative inline-flex items-center gap-3 border-[3px] border-[#3a2418] bg-gradient-to-br from-warm-300 to-warm-500 font-pixel font-semibold tracking-wide text-[#3a2418] shadow-pixel focus-ring ${pad}`}
    >
      <span className="grid h-5 w-5 place-items-center border border-[#3a2418]/40 bg-white/95">
        <GoogleIcon />
      </span>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Hero scene — a cozy pixel cottage at dusk                           */
/* ------------------------------------------------------------------ */

function PixelCottage() {
  // alternating shingle shades for the stepped roof
  const roof = [
    { x: 150, w: 20 },
    { x: 142, w: 36 },
    { x: 134, w: 52 },
    { x: 126, w: 68 },
    { x: 118, w: 84 },
    { x: 110, w: 100 },
    { x: 102, w: 116 },
  ];

  return (
    <div className="relative w-full">
      {/* warm glow behind the screen */}
      <div className="pointer-events-none absolute -inset-8 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 bg-warm-500/20 blur-[80px] animate-pixel-flicker" />
      </div>

      <div className="pixel-scanlines pixel-corners relative overflow-hidden border-[4px] border-[#3a342d] bg-[#221d38] shadow-pixel-lg">
        <svg
          viewBox="0 0 320 200"
          className="pixelated relative block w-full"
          shapeRendering="crispEdges"
          role="img"
          aria-label="A cozy pixel-art cottage glowing at dusk, watched over by Haven"
          style={{ imageRendering: "pixelated" }}
        >
          {/* ---- dusk sky, banded ---- */}
          <rect x="0" y="0" width="320" height="34" fill="#221d38" />
          <rect x="0" y="34" width="320" height="28" fill="#3b2f52" />
          <rect x="0" y="62" width="320" height="26" fill="#5e4360" />
          <rect x="0" y="88" width="320" height="24" fill="#8a5158" />
          <rect x="0" y="112" width="320" height="22" fill="#b9705a" />
          <rect x="0" y="134" width="320" height="22" fill="#e3936a" />

          {/* ---- stars ---- */}
          <g fill="#fff0d0">
            <rect x="36" y="18" width="2" height="2" className="animate-pixel-twinkle" />
            <rect x="78" y="10" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "0.6s" }} />
            <rect x="120" y="24" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "1.1s" }} />
            <rect x="210" y="14" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "0.3s" }} />
            <rect x="262" y="28" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "1.4s" }} />
            <rect x="292" y="12" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "0.9s" }} />
            <rect x="156" y="8" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "1.8s" }} />
          </g>

          {/* ---- pixel moon ---- */}
          <g>
            <rect x="246" y="30" width="24" height="24" fill="#ffeccb" />
            <rect x="242" y="34" width="4" height="16" fill="#ffeccb" />
            <rect x="270" y="34" width="4" height="16" fill="#ffeccb" />
            <rect x="250" y="26" width="16" height="4" fill="#ffeccb" />
            <rect x="250" y="54" width="16" height="4" fill="#ffeccb" />
            {/* craters */}
            <rect x="252" y="38" width="4" height="4" fill="#f1d6a8" />
            <rect x="260" y="44" width="3" height="3" fill="#f1d6a8" />
          </g>

          {/* ---- back hills ---- */}
          <rect x="0" y="148" width="320" height="52" fill="#3a5a40" />
          <rect x="0" y="142" width="120" height="8" fill="#3a5a40" />
          <rect x="200" y="138" width="120" height="12" fill="#3a5a40" />
          {/* front grass */}
          <rect x="0" y="158" width="320" height="42" fill="#48703f" />

          {/* ---- left pine tree ---- */}
          <g>
            <rect x="44" y="150" width="6" height="14" fill="#5a3b27" />
            <rect x="34" y="140" width="26" height="8" fill="#2f5132" />
            <rect x="38" y="130" width="18" height="10" fill="#356039" />
            <rect x="42" y="122" width="10" height="8" fill="#3a6b3e" />
          </g>

          {/* ---- right bush ---- */}
          <g>
            <rect x="276" y="150" width="30" height="12" fill="#356039" />
            <rect x="282" y="144" width="18" height="8" fill="#3a6b3e" />
          </g>

          {/* ---- the cottage ---- */}
          <g>
            {/* stepped roof */}
            {roof.map((r, i) => (
              <rect
                key={i}
                x={r.x}
                y={56 + i * 8}
                width={r.w}
                height={8}
                fill={i % 2 === 0 ? "#9c3f2f" : "#bb4f37"}
              />
            ))}
            {/* roof underline */}
            <rect x="102" y="112" width="116" height="4" fill="#7a2f24" />

            {/* chimney */}
            <rect x="184" y="64" width="14" height="22" fill="#7a4a3a" />
            <rect x="182" y="62" width="18" height="4" fill="#5e372b" />
            {/* smoke puffs */}
            <g fill="#cdbfe0">
              <rect x="188" y="56" width="5" height="5" className="animate-pixel-smoke" />
              <rect x="190" y="52" width="4" height="4" className="animate-pixel-smoke" style={{ animationDelay: "1.3s" }} />
              <rect x="187" y="48" width="4" height="4" className="animate-pixel-smoke" style={{ animationDelay: "2.6s" }} />
            </g>

            {/* house body */}
            <rect x="108" y="116" width="104" height="60" fill="#e8c79c" />
            <rect x="108" y="116" width="104" height="6" fill="#f2d7af" />
            <rect x="108" y="170" width="104" height="6" fill="#cda878" />
            {/* outline */}
            <rect x="106" y="114" width="108" height="2" fill="#7a5a3a" />
            <rect x="106" y="176" width="108" height="2" fill="#7a5a3a" />
            <rect x="106" y="114" width="2" height="64" fill="#7a5a3a" />
            <rect x="212" y="114" width="2" height="64" fill="#7a5a3a" />

            {/* left window — glowing */}
            <g className="animate-pixel-flicker" style={{ transformOrigin: "130px 138px" }}>
              <rect x="120" y="128" width="24" height="24" fill="#3a2a1c" />
              <rect x="123" y="131" width="18" height="18" fill="#ffd27a" />
              <rect x="123" y="131" width="18" height="8" fill="#ffe2a3" />
              <rect x="131" y="131" width="2" height="18" fill="#3a2a1c" />
              <rect x="123" y="139" width="18" height="2" fill="#3a2a1c" />
            </g>

            {/* right window — glowing */}
            <g className="animate-pixel-flicker" style={{ animationDelay: "0.8s", transformOrigin: "190px 138px" }}>
              <rect x="176" y="128" width="24" height="24" fill="#3a2a1c" />
              <rect x="179" y="131" width="18" height="18" fill="#ffd27a" />
              <rect x="179" y="131" width="18" height="8" fill="#ffe2a3" />
              <rect x="187" y="131" width="2" height="18" fill="#3a2a1c" />
              <rect x="179" y="139" width="18" height="2" fill="#3a2a1c" />
            </g>

            {/* door — warm light spilling out */}
            <rect x="150" y="142" width="20" height="34" fill="#8a4a2a" />
            <rect x="152" y="144" width="16" height="32" fill="#a85a32" />
            <rect x="150" y="176" width="20" height="2" fill="#5e3320" />
            <rect x="164" y="158" width="3" height="3" fill="#ffd27a" />
            {/* warm light pooling from the door onto grass */}
            <rect x="146" y="176" width="28" height="6" fill="#e8a87c" opacity="0.5" />
          </g>

          {/* ---- the AI sprite, hovering by the cottage ---- */}
          <g className="animate-pixel-bob" style={{ transformOrigin: "238px 132px" }}>
            <rect x="232" y="124" width="14" height="14" fill="#818cf8" />
            <rect x="234" y="122" width="10" height="2" fill="#a5b4fc" />
            <rect x="234" y="138" width="10" height="2" fill="#6366f1" />
            <rect x="233" y="126" width="3" height="3" fill="#c7d2fe" />
            <g fill="#1e1b4b" className="animate-pixel-blink" style={{ transformOrigin: "239px 131px" }}>
              <rect x="235" y="129" width="2" height="3" />
              <rect x="241" y="129" width="2" height="3" />
            </g>
            <rect x="238" y="118" width="2" height="2" fill="#fcd34d" className="animate-pixel-twinkle" />
          </g>

          {/* ---- fireflies in the yard ---- */}
          <g fill="#ffe98a">
            <rect x="70" y="168" width="2" height="2" className="animate-pixel-firefly" />
            <rect x="100" y="178" width="2" height="2" className="animate-pixel-firefly" style={{ animationDelay: "2s" }} />
            <rect x="250" y="172" width="2" height="2" className="animate-pixel-firefly" style={{ animationDelay: "3.5s" }} />
          </g>
        </svg>

        {/* HUD caption strip */}
        <div className="flex items-center justify-between border-t-[3px] border-[#3a342d] bg-[#1a1614] px-4 py-2">
          <span className="font-terminal text-lg leading-none text-warm-300">
            haven.exe — home is awake
          </span>
          <span className="flex items-center gap-1.5 font-terminal text-lg leading-none text-success-400">
            <span className="h-2 w-2 bg-success-400 animate-pixel-twinkle" />
            online
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pixel icons for the pillars                                          */
/* ------------------------------------------------------------------ */

function PixelIcon({ kind }: { kind: "calendar" | "heart" | "bell" }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 16 16",
    shapeRendering: "crispEdges" as const,
    style: { imageRendering: "pixelated" as const },
  };
  if (kind === "calendar") {
    return (
      <svg {...common} fill="currentColor" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" />
        <rect x="3" y="6" width="10" height="7" fill="#1a1614" />
        <rect x="4" y="1" width="2" height="3" />
        <rect x="10" y="1" width="2" height="3" />
        <rect x="5" y="8" width="2" height="2" />
        <rect x="9" y="8" width="2" height="2" />
      </svg>
    );
  }
  if (kind === "heart") {
    return (
      <svg {...common} fill="currentColor" aria-hidden="true">
        <rect x="2" y="4" width="4" height="2" />
        <rect x="10" y="4" width="4" height="2" />
        <rect x="2" y="6" width="12" height="3" />
        <rect x="3" y="9" width="10" height="2" />
        <rect x="5" y="11" width="6" height="2" />
        <rect x="7" y="13" width="2" height="1" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="currentColor" aria-hidden="true">
      <rect x="7" y="1" width="2" height="2" />
      <rect x="5" y="3" width="6" height="2" />
      <rect x="4" y="5" width="8" height="6" />
      <rect x="3" y="11" width="10" height="2" />
      <rect x="7" y="13" width="2" height="2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                                 */
/* ------------------------------------------------------------------ */

const pillars = [
  {
    icon: "calendar" as const,
    title: "It plans your day",
    body: "Haven quietly shapes your hours around what matters — meetings, deep work, and rest — so you wake up to a day that already makes sense.",
  },
  {
    icon: "heart" as const,
    title: "It learns your rhythm",
    body: "The more you live with Haven, the better it knows your focus hours, your habits, and your pace — and gently adapts to the way you actually work.",
  },
  {
    icon: "bell" as const,
    title: "It speaks up when it matters",
    body: "No noise, no nagging. Haven only reaches out for the moments worth a nudge — a slipping deadline, an overbooked afternoon, a chance to breathe.",
  },
];

const featureDepth = [
  {
    eyebrow: "TASKS",
    title: "Everything on your mind, gently organised",
    body: "Drop in a thought in plain language and Haven turns it into the right task, on the right day, with the right priority. No forms, no friction — just a clear head.",
    art: "tasks" as const,
  },
  {
    eyebrow: "CALENDAR",
    title: "A calendar that protects your time",
    body: "Haven guards your mornings for focus and arranges the rest around your energy. Your week stops feeling like a battle and starts feeling like a plan.",
    art: "calendar" as const,
  },
  {
    eyebrow: "FOCUS",
    title: "A calm room for deep work",
    body: "Slip into a focus session and let the world fade. Soft timing, gentle music, and zero clutter — so the work feels less like effort and more like flow.",
    art: "focus" as const,
  },
  {
    eyebrow: "INTELLIGENCE",
    title: "An assistant that has your back",
    body: "Haven watches the edges of your day so you don't have to. It remembers what you tend to forget and steps in right before things slip.",
    art: "ai" as const,
  },
];

const testimonials = [
  {
    quote:
      "It feels less like an app and more like a calm friend who keeps my day from falling apart. I finally stopped dreading my mornings.",
    name: "Maya R.",
    role: "Product Designer",
  },
  {
    quote:
      "Haven quietly handles the planning I used to spend an hour on. I just show up and the day already makes sense.",
    name: "Daniel K.",
    role: "Founder",
  },
  {
    quote:
      "The nudges are never annoying — they arrive exactly when I need them. It's the first tool that actually respects my attention.",
    name: "Priya S.",
    role: "Researcher",
  },
];

/* ------------------------------------------------------------------ */
/* Feature mini-art — tiny pixel screens                                */
/* ------------------------------------------------------------------ */

function FeatureArt({ art }: { art: "tasks" | "calendar" | "focus" | "ai" }) {
  return (
    <div className="pixel-scanlines pixel-corners relative aspect-[4/3] w-full overflow-hidden border-[4px] border-[#3a342d] bg-[#1d1a17] shadow-pixel">
      <div className="pixel-grid absolute inset-0 opacity-60" />
      <div className="relative z-[1] flex h-full w-full items-center justify-center p-5">
        {art === "tasks" && (
          <div className="w-full space-y-2.5">
            {[
              { done: true, w: "w-3/4" },
              { done: true, w: "w-2/3" },
              { done: false, w: "w-5/6" },
              { done: false, w: "w-1/2" },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span
                  className={`pixelated h-4 w-4 border-2 ${
                    row.done
                      ? "border-success-500 bg-success-500/80"
                      : "border-warm-400/60 bg-transparent"
                  }`}
                />
                <span
                  className={`h-2.5 ${row.w} ${
                    row.done ? "bg-warm-400/25" : "bg-warm-300/50"
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        {art === "calendar" && (
          <div className="grid w-full grid-cols-5 gap-1.5">
            {Array.from({ length: 20 }).map((_, i) => {
              const busy = [3, 6, 7, 12, 16, 17].includes(i);
              const focus = [8, 13].includes(i);
              return (
                <span
                  key={i}
                  className={`pixelated aspect-square border ${
                    focus
                      ? "border-accent-400 bg-accent-500/50"
                      : busy
                        ? "border-warm-400/50 bg-warm-400/40"
                        : "border-[#3a342d] bg-[#221f1b]"
                  }`}
                />
              );
            })}
          </div>
        )}

        {art === "focus" && (
          <div className="flex flex-col items-center gap-4">
            <div className="pixelated relative grid h-20 w-20 place-items-center border-4 border-warm-400/70 bg-[#221f1b]">
              <span className="font-pixel text-xl text-warm-300">25:00</span>
              <span className="absolute -right-1.5 -top-1.5 h-3 w-3 bg-success-500 animate-pixel-twinkle" />
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 ${i < 4 ? "bg-warm-400" : "bg-warm-400/25"}`}
                />
              ))}
            </div>
          </div>
        )}

        {art === "ai" && (
          <div className="flex flex-col items-center gap-3">
            <AiSprite size={64} />
            <div className="pixel-corners border-2 border-accent-400/50 bg-[#221f1b] px-3 py-1.5">
              <span className="font-terminal text-lg leading-none text-accent-300">
                i moved your 3pm. rest easy.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                             */
/* ------------------------------------------------------------------ */

function Pillars() {
  const reduce = useReducedMotion();
  return (
    <section className="relative z-10 mx-auto mt-32 w-full max-w-5xl px-6">
      <Reveal className="mb-12 text-center">
        <p className="mb-3 font-terminal text-xl uppercase tracking-[0.25em] text-warm-400">
          {"// why haven"}
        </p>
        <h2 className="font-pixel mx-auto max-w-2xl text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl">
          A quieter way to stay on top of everything
        </h2>
      </Reveal>

      <motion.div
        variants={reduce ? undefined : stagger}
        initial={reduce ? undefined : "hidden"}
        whileInView={reduce ? undefined : "visible"}
        viewport={{ once: true, amount: 0.3 }}
        className="grid grid-cols-1 gap-6 md:grid-cols-3"
      >
        {pillars.map((p) => (
          <motion.div
            key={p.title}
            variants={reduce ? undefined : fadeUp}
            className="pixel-corners group relative border-[3px] border-[#3a342d] bg-[var(--surface)] p-6 shadow-pixel transition-transform duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5"
          >
            <div className="pixelated mb-5 grid h-12 w-12 place-items-center border-[3px] border-warm-400/50 bg-warm-400/12 text-warm-400">
              <PixelIcon kind={p.icon} />
            </div>
            <h3 className="font-pixel mb-2.5 text-xl font-semibold text-[var(--text-primary)]">
              {p.title}
            </h3>
            <p className="text-[15px] leading-[1.75] text-[var(--text-secondary)]">
              {p.body}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function FeatureDepth() {
  return (
    <section className="relative z-10 mx-auto mt-36 w-full max-w-4xl px-6">
      <div className="flex flex-col gap-24">
        {featureDepth.map((f, i) => (
          <Reveal key={f.eyebrow}>
            <div
              className={`flex flex-col items-center gap-10 md:flex-row ${
                i % 2 === 1 ? "md:flex-row-reverse" : ""
              }`}
            >
              <div className="flex-1 text-center md:text-left">
                <p className="mb-3 font-terminal text-xl uppercase tracking-[0.2em] text-warm-400">
                  [ {f.eyebrow} ]
                </p>
                <h3 className="font-pixel mb-4 text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
                  {f.title}
                </h3>
                <p className="mx-auto max-w-md text-[15px] leading-[1.75] text-[var(--text-secondary)] md:mx-0">
                  {f.body}
                </p>
              </div>
              <div className="flex-1">
                <FeatureArt art={f.art} />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="relative z-10 mx-auto mt-36 w-full max-w-5xl px-6">
      <Reveal className="mb-12 text-center">
        <p className="font-pixel text-4xl font-bold text-warm-400 sm:text-5xl">
          Save 45 minutes a day
        </p>
        <p className="mt-4 text-base text-[var(--text-secondary)]">
          That&apos;s how much planning and second-guessing Haven quietly takes
          off your plate.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.08}>
            <figure className="pixel-corners relative h-full border-[3px] border-[#3a342d] bg-[var(--surface)] p-6 shadow-pixel">
              <blockquote className="text-[15px] leading-[1.75] text-[var(--text-primary)]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="pixelated grid h-9 w-9 place-items-center border-2 border-[#3a2418] bg-gradient-to-br from-warm-300 to-warm-500 font-pixel text-sm font-bold text-[#3a2418]">
                  {t.name.charAt(0)}
                </span>
                <span className="text-sm">
                  <span className="block font-medium text-[var(--text-primary)]">
                    {t.name}
                  </span>
                  <span className="block text-[var(--text-tertiary)]">
                    {t.role}
                  </span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function EmotionalClose() {
  return (
    <section className="relative z-10 mx-auto mt-36 w-full max-w-3xl px-6 text-center">
      <Reveal>
        <div className="mb-8 flex justify-center">
          <AiSprite size={72} />
        </div>
        <h2 className="font-pixel text-3xl font-bold text-[var(--text-primary)] sm:text-5xl">
          Stop managing your life.
          <br />
          <span className="gradient-text-pixel">Start living it.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-base leading-[1.75] text-[var(--text-secondary)]">
          Let Haven hold the logistics of your days, so you can spend your
          attention on the things that actually matter.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <GetStartedButton />
          <p className="font-terminal text-lg tracking-wide text-[var(--text-tertiary)]">
            free to start &middot; private by design
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Landing Page                                                        */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const reduce = useReducedMotion();

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden overflow-y-auto bg-[var(--bg)]">
      {/* warm ambient background + dither */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[25%] left-[12%] h-[640px] w-[640px] rounded-full bg-warm-400/[0.1] blur-[130px] animate-drift" />
        <div className="absolute top-[35%] -right-[8%] h-[520px] w-[520px] rounded-full bg-clay-400/[0.08] blur-[120px] animate-aurora" />
        <div className="absolute bottom-[2%] left-[28%] h-[460px] w-[460px] rounded-full bg-accent-500/[0.06] blur-[110px] animate-float-slow" />
        <div className="pixel-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(circle_at_50%_25%,black,transparent_72%)]" />
      </div>

      {/* top nav */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <PixelLogo size={26} />
          <span className="font-pixel text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Haven
          </span>
        </div>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="font-terminal text-xl text-[var(--text-secondary)] transition-colors hover:text-warm-400"
        >
          sign in &gt;
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center justify-center px-6 pb-20 pt-10 text-center">
        <motion.div
          initial={reduce ? undefined : "hidden"}
          animate={reduce ? undefined : "visible"}
          variants={reduce ? undefined : stagger}
          className="flex w-full flex-col items-center"
        >
          {/* status pill */}
          <motion.div
            variants={reduce ? undefined : fadeUp}
            className="pixel-corners mb-7 inline-flex items-center gap-2 border-2 border-warm-400/40 bg-warm-400/10 px-3 py-1.5"
          >
            <span className="h-2 w-2 bg-success-500 animate-pixel-twinkle" />
            <span className="font-terminal text-lg leading-none text-warm-300">
              your AI home, always awake
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={reduce ? undefined : fadeUp}
            className="font-pixel max-w-3xl text-balance text-4xl font-bold leading-[1.15] text-[var(--text-primary)] sm:text-5xl md:text-6xl"
          >
            Your calm place to{" "}
            <span className="gradient-text-pixel">get things done</span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            variants={reduce ? undefined : fadeUp}
            className="mt-6 max-w-xl text-balance text-lg leading-[1.7] text-[var(--text-secondary)]"
          >
            Haven is the AI that plans your day, protects your time, and learns
            your rhythm. Every task, every deadline, quietly watched over — so
            the chaos quiets down and your focus comes home.
          </motion.p>

          {/* CTA */}
          <motion.div
            variants={reduce ? undefined : fadeUp}
            className="mt-9 flex flex-col items-center gap-4"
          >
            <GetStartedButton />
            <p className="font-terminal text-lg tracking-wide text-[var(--text-tertiary)]">
              calm in the chaos &middot; no credit card needed
            </p>
          </motion.div>

          {/* Hero scene */}
          <motion.div
            variants={reduce ? undefined : fadeUp}
            className="mt-14 w-full max-w-3xl"
          >
            <PixelCottage />
          </motion.div>
        </motion.div>
      </section>

      <Pillars />
      <FeatureDepth />
      <SocialProof />
      <EmotionalClose />

      {/* Footer */}
      <footer className="relative z-10 mt-36 pb-14 text-center">
        <div className="mx-auto mb-7 h-1 w-16 bg-[var(--border)]" />
        <div className="flex items-center justify-center gap-2.5">
          <PixelLogo size={22} />
          <span className="font-pixel text-base font-semibold tracking-tight text-[var(--text-primary)]">
            Haven
          </span>
        </div>
        <p className="mt-4 text-xs text-[var(--text-tertiary)]">
          Built with care. Your day, handled — your data stays yours.
        </p>
        <p className="mt-2 font-terminal text-base text-[var(--text-tertiary)] opacity-70">
          haven {new Date().getFullYear()} — home is awake
        </p>
      </footer>
    </main>
  );
}
