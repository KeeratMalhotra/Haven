"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/* ------------------------------------------------------------------ */
/* Motion helpers                                                      */
/* ------------------------------------------------------------------ */

const EASE_CALM = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_CALM } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.06 } },
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
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: EASE_CALM, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Crisp pixel digits — drawn as a 3x5 bitmap so numbers never blur    */
/* ------------------------------------------------------------------ */

const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  ":": ["0", "1", "0", "1", "0"],
  "+": ["000", "010", "111", "010", "000"],
};

function PixelNumber({
  value,
  scale = 5,
  color = "currentColor",
  className = "",
}: {
  value: string;
  scale?: number;
  color?: string;
  className?: string;
}) {
  const rects: { x: number; y: number }[] = [];
  let cursor = 0;
  for (const ch of value.split("")) {
    const glyph = GLYPHS[ch];
    if (!glyph) {
      cursor += 2;
      continue;
    }
    const w = glyph[0].length;
    glyph.forEach((row, ry) =>
      row.split("").forEach((c, cx) => {
        if (c === "1") rects.push({ x: cursor + cx, y: ry });
      }),
    );
    cursor += w + 1;
  }
  const totalW = Math.max(cursor - 1, 1);
  return (
    <svg
      viewBox={`0 0 ${totalW} 5`}
      width={totalW * scale}
      height={5 * scale}
      shapeRendering="crispEdges"
      className={`pixelated ${className}`}
      style={{ imageRendering: "pixelated" }}
      aria-label={value}
      role="img"
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={1} height={1} fill={color} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Wordmark                                                            */
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
/* AI caretaker sprite                                                 */
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
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 bg-accent-400/30 blur-xl animate-pixel-flicker" />
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        role="img"
        aria-label="Haven, the AI caretaker sprite"
      >
        <g>
          <rect x="5" y="2" width="6" height="1" fill="#a5b4fc" />
          <rect x="4" y="3" width="8" height="1" fill="#a5b4fc" />
          <rect x="3" y="4" width="10" height="8" fill="#818cf8" />
          <rect x="4" y="12" width="8" height="1" fill="#6366f1" />
          <rect x="5" y="13" width="6" height="1" fill="#6366f1" />
          <rect x="4" y="4" width="3" height="3" fill="#c7d2fe" />
        </g>
        <g fill="#1e1b4b" className="animate-pixel-blink">
          <rect x="5" y="7" width="2" height="3" />
          <rect x="9" y="7" width="2" height="3" />
        </g>
        <rect x="7" y="0" width="2" height="2" fill="#fcd34d" className="animate-pixel-twinkle" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Google + CTA                                                        */
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

function GetStartedButton({
  size = "lg",
  label = "Enter Haven",
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const pad =
    size === "lg"
      ? "px-7 py-3.5 text-base"
      : size === "md"
        ? "px-5 py-2.5 text-sm"
        : "px-4 py-2 text-xs";
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

/* ================================================================== */
/* THE HERO SCENE — a cozy jungle cabin at dusk, bonfire, sleeping dog */
/* ================================================================== */

function JungleCabinScene({ className = "" }: { className?: string }) {
  // helper for the bumpy far treeline
  const canopy = [
    { x: 0, w: 46, t: 100 },
    { x: 40, w: 34, t: 92 },
    { x: 70, w: 44, t: 104 },
    { x: 110, w: 40, t: 94 },
    { x: 148, w: 44, t: 100 },
    { x: 188, w: 38, t: 90 },
    { x: 222, w: 48, t: 102 },
    { x: 266, w: 56, t: 96 },
  ];
  // cabin roof steps (stepped triangle), apex ~ x=110
  const roof = [
    { x: 104, w: 12 },
    { x: 98, w: 24 },
    { x: 92, w: 36 },
    { x: 86, w: 48 },
    { x: 80, w: 60 },
    { x: 74, w: 72 },
    { x: 68, w: 84 },
  ];

  return (
    <svg
      viewBox="0 0 320 200"
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      className={`pixelated ${className}`}
      style={{ imageRendering: "pixelated" }}
      role="img"
      aria-label="A pixel-art jungle at dusk: a glowing log cabin, a flickering bonfire, and a dog sleeping happily beside it."
    >
      {/* ---------------- SKY ---------------- */}
      <rect x="0" y="0" width="320" height="200" fill="#15132e" />
      <rect x="0" y="0" width="320" height="30" fill="#15132e" />
      <rect x="0" y="30" width="320" height="22" fill="#221a40" />
      <rect x="0" y="52" width="320" height="20" fill="#352350" />
      <rect x="0" y="72" width="320" height="18" fill="#532c54" />
      <rect x="0" y="90" width="320" height="16" fill="#83384c" />
      <rect x="0" y="106" width="320" height="10" fill="#b65a44" />

      {/* stars */}
      <g fill="#fff3d6">
        <rect x="28" y="14" width="2" height="2" className="animate-pixel-twinkle" />
        <rect x="62" y="22" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "0.7s" }} />
        <rect x="96" y="10" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "1.3s" }} />
        <rect x="150" y="18" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "0.4s" }} />
        <rect x="190" y="12" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "1.6s" }} />
        <rect x="300" y="20" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "0.9s" }} />
        <rect x="44" y="34" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "2s" }} />
        <rect x="124" y="30" width="2" height="2" className="animate-pixel-twinkle" style={{ animationDelay: "1.1s" }} />
      </g>

      {/* moon */}
      <g>
        <rect x="252" y="16" width="22" height="20" fill="#ffeccb" />
        <rect x="248" y="20" width="4" height="12" fill="#ffeccb" />
        <rect x="274" y="20" width="4" height="12" fill="#ffeccb" />
        <rect x="256" y="12" width="14" height="4" fill="#ffeccb" />
        <rect x="256" y="36" width="14" height="4" fill="#ffeccb" />
        <rect x="257" y="22" width="4" height="4" fill="#f0d3a4" />
        <rect x="265" y="28" width="3" height="3" fill="#f0d3a4" />
        <rect x="248" y="36" width="32" height="2" fill="#ffeccb" opacity="0.25" />
      </g>

      {/* ---------------- FAR TREELINE ---------------- */}
      {canopy.map((c, i) => (
        <rect key={`c${i}`} x={c.x} y={c.t} width={c.w} height={150 - c.t} fill="#142a1f" />
      ))}
      <rect x="0" y="128" width="320" height="22" fill="#142a1f" />

      {/* ---------------- MID JUNGLE ---------------- */}
      <rect x="0" y="138" width="320" height="20" fill="#1d3a2a" />
      <g fill="#27512f">
        <rect x="0" y="132" width="34" height="10" />
        <rect x="48" y="130" width="40" height="12" />
        <rect x="150" y="134" width="44" height="10" />
        <rect x="250" y="130" width="50" height="12" />
      </g>
      {/* highlight leaf clumps */}
      <g fill="#316b3a">
        <rect x="10" y="130" width="16" height="6" />
        <rect x="58" y="128" width="18" height="6" />
        <rect x="160" y="132" width="18" height="6" />
        <rect x="262" y="128" width="20" height="6" />
      </g>

      {/* tall left palm */}
      <g>
        <rect x="16" y="120" width="6" height="40" fill="#4a3320" />
        <rect x="14" y="120" width="2" height="40" fill="#3a2718" />
        <g fill="#2f6b3e">
          <rect x="6" y="112" width="14" height="4" />
          <rect x="18" y="112" width="16" height="4" />
          <rect x="2" y="116" width="10" height="3" />
          <rect x="24" y="116" width="12" height="3" />
        </g>
        <rect x="12" y="108" width="14" height="5" fill="#3a7a47" />
      </g>

      {/* tall right tree + hanging vines */}
      <g>
        <rect x="298" y="118" width="7" height="42" fill="#4a3320" />
        <g fill="#2f6b3e">
          <rect x="284" y="110" width="20" height="6" />
          <rect x="300" y="112" width="18" height="6" />
          <rect x="288" y="116" width="14" height="4" />
        </g>
        <rect x="290" y="106" width="18" height="5" fill="#3a7a47" />
      </g>
      <g fill="#2a5a36">
        <rect x="120" y="128" width="2" height="14" />
        <rect x="119" y="142" width="4" height="3" />
        <rect x="208" y="128" width="2" height="12" />
        <rect x="207" y="140" width="4" height="3" />
        <rect x="70" y="130" width="2" height="10" />
      </g>

      {/* ---------------- GROUND ---------------- */}
      <rect x="0" y="150" width="320" height="50" fill="#2f4a2c" />
      <rect x="0" y="158" width="320" height="42" fill="#284326" />
      {/* dirt clearing */}
      <rect x="70" y="168" width="180" height="32" fill="#473625" />
      <rect x="70" y="168" width="180" height="4" fill="#54422e" />

      {/* ---------------- CABIN ---------------- */}
      <g>
        {/* roof */}
        {roof.map((r, i) => (
          <rect key={`r${i}`} x={r.x} y={94 + i * 6} width={r.w} height={6} fill={i % 2 === 0 ? "#52371f" : "#633f22"} />
        ))}
        <rect x="68" y="135" width="84" height="3" fill="#3a2718" />
        {/* chimney + smoke */}
        <rect x="130" y="104" width="12" height="20" fill="#6b6660" />
        <rect x="128" y="102" width="16" height="4" fill="#544f49" />
        <g fill="#c7bcd6">
          <rect x="133" y="96" width="5" height="5" className="animate-pixel-smoke" />
          <rect x="135" y="92" width="4" height="4" className="animate-pixel-smoke" style={{ animationDelay: "1.2s" }} />
          <rect x="132" y="88" width="4" height="4" className="animate-pixel-smoke" style={{ animationDelay: "2.4s" }} />
        </g>

        {/* log walls */}
        <rect x="70" y="138" width="80" height="32" fill="#7a4e2e" />
        <g fill="#5e3a20">
          <rect x="70" y="144" width="80" height="2" />
          <rect x="70" y="152" width="80" height="2" />
          <rect x="70" y="160" width="80" height="2" />
        </g>
        {/* corner posts */}
        <rect x="68" y="138" width="4" height="32" fill="#4a2f1c" />
        <rect x="148" y="138" width="4" height="32" fill="#4a2f1c" />
        <rect x="70" y="168" width="80" height="2" fill="#3a2718" />

        {/* warm light pooling from door */}
        <rect x="98" y="170" width="26" height="18" fill="#ffce6b" opacity="0.16" />

        {/* left window */}
        <g className="animate-pixel-flicker">
          <rect x="80" y="142" width="16" height="16" fill="#2a1c10" />
          <rect x="82" y="144" width="12" height="12" fill="#ffce6b" />
          <rect x="82" y="144" width="12" height="5" fill="#ffe2a3" />
          <rect x="87" y="144" width="2" height="12" fill="#2a1c10" />
          <rect x="82" y="149" width="12" height="2" fill="#2a1c10" />
        </g>
        {/* right window */}
        <g className="animate-pixel-flicker" style={{ animationDelay: "0.7s" }}>
          <rect x="124" y="142" width="16" height="16" fill="#2a1c10" />
          <rect x="126" y="144" width="12" height="12" fill="#ffce6b" />
          <rect x="126" y="144" width="12" height="5" fill="#ffe2a3" />
          <rect x="131" y="144" width="2" height="12" fill="#2a1c10" />
          <rect x="126" y="149" width="12" height="2" fill="#2a1c10" />
        </g>
        {/* door */}
        <rect x="102" y="148" width="18" height="22" fill="#3a2718" />
        <rect x="104" y="150" width="14" height="20" fill="#5e3a20" />
        <rect x="114" y="159" width="2" height="2" fill="#ffce6b" />
      </g>

      {/* ---------------- BONFIRE ---------------- */}
      <g>
        {/* glow pool */}
        <g className="animate-pixel-glow">
          <rect x="186" y="178" width="56" height="14" fill="#f0742e" opacity="0.18" />
          <rect x="194" y="174" width="40" height="18" fill="#ffae3a" opacity="0.15" />
        </g>
        {/* stone ring */}
        <g fill="#6f6a63">
          <rect x="190" y="182" width="6" height="5" />
          <rect x="198" y="184" width="6" height="4" />
          <rect x="224" y="184" width="6" height="4" />
          <rect x="232" y="182" width="6" height="5" />
        </g>
        <g fill="#8a847b">
          <rect x="191" y="182" width="3" height="2" />
          <rect x="233" y="182" width="3" height="2" />
        </g>
        {/* logs */}
        <g>
          <rect x="200" y="180" width="28" height="5" fill="#6b4329" />
          <rect x="200" y="180" width="28" height="2" fill="#82542f" />
          <rect x="206" y="176" width="6" height="10" fill="#5e3a23" transform="rotate(20 209 181)" />
          <rect x="198" y="183" width="4" height="3" fill="#ff8a3a" className="animate-pixel-flicker" />
          <rect x="226" y="183" width="4" height="3" fill="#ff8a3a" className="animate-pixel-flicker" style={{ animationDelay: "0.4s" }} />
        </g>
        {/* flames */}
        <g className="animate-pixel-fire" style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}>
          {/* outer red */}
          <rect x="206" y="166" width="16" height="14" fill="#d8392a" />
          <rect x="208" y="160" width="12" height="8" fill="#d8392a" />
          <rect x="211" y="154" width="6" height="8" fill="#d8392a" />
          {/* mid orange */}
          <rect x="208" y="168" width="12" height="12" fill="#f0742e" />
          <rect x="210" y="162" width="8" height="8" fill="#f0742e" />
          <rect x="212" y="157" width="4" height="6" fill="#f0742e" />
          {/* inner yellow */}
          <rect x="210" y="170" width="8" height="10" fill="#ffc23a" />
          <rect x="212" y="164" width="4" height="8" fill="#ffc23a" />
          {/* core */}
          <rect x="212" y="172" width="4" height="8" fill="#fff0a8" />
        </g>
        {/* a flickering side tongue */}
        <g className="animate-pixel-fire-slow" style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}>
          <rect x="220" y="166" width="5" height="12" fill="#f0742e" />
          <rect x="221" y="162" width="3" height="6" fill="#ffc23a" />
          <rect x="203" y="168" width="4" height="10" fill="#d8392a" />
        </g>
        {/* embers */}
        <g fill="#ffce6b">
          <rect x="212" y="156" width="2" height="2" className="animate-pixel-ember" />
          <rect x="218" y="160" width="2" height="2" className="animate-pixel-ember" style={{ animationDelay: "1s" }} />
          <rect x="208" y="158" width="2" height="2" className="animate-pixel-ember" style={{ animationDelay: "1.8s" }} />
        </g>
      </g>

      {/* ---------------- SLEEPING DOG ---------------- */}
      <g>
        {/* body */}
        <rect x="160" y="184" width="30" height="8" fill="#b5763f" />
        <rect x="162" y="182" width="26" height="3" fill="#c2864c" />
        <rect x="160" y="190" width="30" height="2" fill="#8a5630" />
        {/* curled tail */}
        <rect x="158" y="183" width="5" height="4" fill="#8a5630" />
        <rect x="156" y="185" width="3" height="3" fill="#a06a3a" />
        {/* head resting on the right */}
        <rect x="184" y="181" width="11" height="9" fill="#b5763f" />
        <rect x="184" y="181" width="11" height="2" fill="#c2864c" />
        {/* ear */}
        <rect x="190" y="178" width="5" height="6" fill="#8a5630" />
        {/* snout */}
        <rect x="193" y="186" width="4" height="3" fill="#a06a3a" />
        <rect x="196" y="187" width="2" height="2" fill="#3a241a" />
        {/* closed happy eye (small upward arc) */}
        <g fill="#3a241a">
          <rect x="186" y="185" width="1" height="1" />
          <rect x="187" y="186" width="2" height="1" />
          <rect x="189" y="185" width="1" height="1" />
        </g>
        {/* little smile */}
        <rect x="191" y="188" width="3" height="1" fill="#5a3a28" />
        {/* belly highlight */}
        <rect x="166" y="186" width="16" height="2" fill="#c98a4e" />
        {/* zzz drifting up */}
        <g fill="#ece9e4">
          <g className="animate-pixel-zzz">
            <rect x="198" y="174" width="4" height="1" />
            <rect x="200" y="175" width="1" height="1" />
            <rect x="199" y="176" width="1" height="1" />
            <rect x="198" y="177" width="4" height="1" />
          </g>
          <g className="animate-pixel-zzz" style={{ animationDelay: "1.3s" }}>
            <rect x="204" y="170" width="3" height="1" />
            <rect x="205" y="171" width="1" height="1" />
            <rect x="204" y="172" width="3" height="1" />
          </g>
          <g className="animate-pixel-zzz" style={{ animationDelay: "2.6s" }}>
            <rect x="209" y="167" width="2" height="1" />
            <rect x="209" y="169" width="2" height="1" />
          </g>
        </g>
      </g>

      {/* ---------------- FOREGROUND FOLIAGE ---------------- */}
      <g fill="#16301d">
        <rect x="0" y="178" width="40" height="22" />
        <rect x="38" y="184" width="22" height="16" />
        <rect x="282" y="180" width="38" height="20" />
        <rect x="262" y="186" width="24" height="14" />
      </g>
      {/* ferns */}
      <g fill="#2a5a32">
        <rect x="6" y="172" width="3" height="10" />
        <rect x="2" y="174" width="5" height="2" />
        <rect x="9" y="174" width="5" height="2" />
        <rect x="300" y="174" width="3" height="10" />
        <rect x="296" y="176" width="5" height="2" />
        <rect x="303" y="176" width="5" height="2" />
      </g>
      {/* tall grass */}
      <g fill="#316b3a">
        <rect x="54" y="174" width="2" height="8" />
        <rect x="58" y="172" width="2" height="10" />
        <rect x="248" y="174" width="2" height="8" />
        <rect x="252" y="172" width="2" height="10" />
        <rect x="150" y="190" width="2" height="8" />
      </g>
      {/* flower pops of colour */}
      <g>
        <rect x="46" y="184" width="3" height="3" fill="#ef6f9e" />
        <rect x="47" y="185" width="1" height="1" fill="#ffd34d" />
        <rect x="258" y="182" width="3" height="3" fill="#e2483b" />
        <rect x="259" y="183" width="1" height="1" fill="#ffd34d" />
        <rect x="240" y="192" width="3" height="3" fill="#f0a6d0" />
        <rect x="241" y="193" width="1" height="1" fill="#ffd34d" />
      </g>

      {/* fireflies */}
      <g fill="#ffe98a">
        <rect x="86" y="150" width="2" height="2" className="animate-pixel-firefly" />
        <rect x="160" y="158" width="2" height="2" className="animate-pixel-firefly" style={{ animationDelay: "2.2s" }} />
        <rect x="60" y="160" width="2" height="2" className="animate-pixel-firefly" style={{ animationDelay: "4s" }} />
        <rect x="270" y="152" width="2" height="2" className="animate-pixel-firefly" style={{ animationDelay: "3s" }} />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Pixel icons                                                          */
/* ------------------------------------------------------------------ */

function PixelIcon({
  kind,
}: {
  kind: "calendar" | "heart" | "bell" | "key" | "moon" | "leaf";
}) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 16 16",
    shapeRendering: "crispEdges" as const,
    style: { imageRendering: "pixelated" as const },
    fill: "currentColor",
    "aria-hidden": true,
  };
  switch (kind) {
    case "calendar":
      return (
        <svg {...common}>
          <rect x="2" y="3" width="12" height="11" />
          <rect x="3" y="6" width="10" height="7" fill="#1a1614" />
          <rect x="4" y="1" width="2" height="3" />
          <rect x="10" y="1" width="2" height="3" />
          <rect x="5" y="8" width="2" height="2" />
          <rect x="9" y="8" width="2" height="2" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <rect x="2" y="4" width="4" height="2" />
          <rect x="10" y="4" width="4" height="2" />
          <rect x="2" y="6" width="12" height="3" />
          <rect x="3" y="9" width="10" height="2" />
          <rect x="5" y="11" width="6" height="2" />
          <rect x="7" y="13" width="2" height="1" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <rect x="7" y="1" width="2" height="2" />
          <rect x="5" y="3" width="6" height="2" />
          <rect x="4" y="5" width="8" height="6" />
          <rect x="3" y="11" width="10" height="2" />
          <rect x="7" y="13" width="2" height="2" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <rect x="2" y="3" width="6" height="6" />
          <rect x="4" y="5" width="2" height="2" fill="#1a1614" />
          <rect x="8" y="5" width="6" height="2" />
          <rect x="11" y="7" width="2" height="2" />
          <rect x="13" y="7" width="2" height="3" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <rect x="5" y="2" width="6" height="2" />
          <rect x="3" y="4" width="4" height="8" />
          <rect x="5" y="12" width="6" height="2" />
          <rect x="7" y="4" width="6" height="2" />
          <rect x="9" y="6" width="4" height="6" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="10" height="2" />
          <rect x="3" y="5" width="8" height="2" />
          <rect x="3" y="7" width="6" height="2" />
          <rect x="3" y="9" width="4" height="4" />
        </svg>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Data                                                                 */
/* ------------------------------------------------------------------ */

const pillars = [
  { icon: "calendar" as const, title: "It plans your day", body: "Haven quietly shapes your hours around what matters — meetings, deep work, and rest — so you wake up to a day that already makes sense." },
  { icon: "heart" as const, title: "It learns your rhythm", body: "The more you live with Haven, the better it knows your focus hours, your habits, and your pace — and gently adapts to the way you actually work." },
  { icon: "bell" as const, title: "It speaks up when it matters", body: "No noise, no nagging. Haven only reaches out for the moments worth a nudge — a slipping deadline, an overbooked afternoon, a chance to breathe." },
];

const steps = [
  { icon: "key" as const, n: "01", title: "Open the door", body: "Sign in and connect your calendar and tasks. Haven moves in, tidies up, and gets to know your world." },
  { icon: "moon" as const, n: "02", title: "Let it keep watch", body: "Haven quietly learns your rhythm, plans your days, and watches the edges so nothing slips while you rest." },
  { icon: "leaf" as const, n: "03", title: "Come home to calm", body: "Open Haven to a day that already makes sense. Less managing, more living — the home has the rest handled." },
];

const integrations = ["Google Calendar", "Gmail", "Notion", "Slack", "Spotify", "Todoist"];

const featureDepth = [
  { eyebrow: "TASKS", title: "Everything on your mind, gently organised", body: "Drop in a thought in plain language and Haven turns it into the right task, on the right day, with the right priority. No forms, no friction — just a clear head.", art: "tasks" as const },
  { eyebrow: "CALENDAR", title: "A calendar that protects your time", body: "Haven guards your mornings for focus and arranges the rest around your energy. Your week stops feeling like a battle and starts feeling like a plan.", art: "calendar" as const },
  { eyebrow: "FOCUS", title: "A calm room for deep work", body: "Slip into a focus session and let the world fade. Soft timing, gentle music, and zero clutter — so the work feels less like effort and more like flow.", art: "focus" as const },
  { eyebrow: "INTELLIGENCE", title: "An assistant that has your back", body: "Haven watches the edges of your day so you don't have to. It remembers what you tend to forget and steps in right before things slip.", art: "ai" as const },
];

const testimonials = [
  { quote: "It feels less like an app and more like a calm friend who keeps my day from falling apart. I finally stopped dreading my mornings.", name: "Maya R.", role: "Product Designer" },
  { quote: "Haven quietly handles the planning I used to spend an hour on. I just show up and the day already makes sense.", name: "Daniel K.", role: "Founder" },
  { quote: "The nudges are never annoying — they arrive exactly when I need them. It's the first tool that actually respects my attention.", name: "Priya S.", role: "Researcher" },
];

const faqs = [
  { q: "Is my data private?", a: "Yes. Your tasks, calendar, and habits stay yours. Haven uses them only to plan and protect your day — never sold, never shared. Private by design." },
  { q: "Do I have to set everything up manually?", a: "No. Connect your calendar and tasks once and Haven settles in on its own — learning your rhythm and organising your days without endless configuration." },
  { q: "What does the AI actually do?", a: "It plans your day around what matters, reshuffles when life changes, watches for slipping deadlines, and gently nudges you only when it's truly worth it." },
  { q: "What can Haven connect to?", a: "Google Calendar, Gmail, Notion, Slack, Spotify, Todoist and more — so Haven works inside the tools you already live in, not beside them." },
  { q: "Is it free to start?", a: "Yep. You can move into Haven for free, no credit card needed. Stay as long as it feels like home." },
];

/* ------------------------------------------------------------------ */
/* Feature mini-art                                                     */
/* ------------------------------------------------------------------ */

function FeatureArt({ art }: { art: "tasks" | "calendar" | "focus" | "ai" }) {
  return (
    <div className="pixel-corners relative aspect-[4/3] w-full overflow-hidden border-[4px] border-[#3a342d] bg-[#1d1a17] shadow-pixel">
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
                <span className={`pixelated h-4 w-4 border-2 ${row.done ? "border-success-500 bg-success-500/80" : "border-warm-400/60 bg-transparent"}`} />
                <span className={`h-2.5 ${row.w} ${row.done ? "bg-warm-400/25" : "bg-warm-300/60"}`} />
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
                  className={`pixelated aspect-square border ${focus ? "border-accent-400 bg-accent-500/50" : busy ? "border-warm-400/50 bg-warm-400/40" : "border-[#3a342d] bg-[#221f1b]"}`}
                />
              );
            })}
          </div>
        )}

        {art === "focus" && (
          <div className="flex flex-col items-center gap-4">
            <div className="pixelated relative grid h-24 w-28 place-items-center border-4 border-warm-400/70 bg-[#221f1b]">
              <PixelNumber value="25:00" scale={4} color="#ffce6b" />
              <span className="absolute -right-1.5 -top-1.5 h-3 w-3 bg-success-500 animate-pixel-twinkle" />
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} className={`h-2 w-2 ${i < 4 ? "bg-warm-400" : "bg-warm-400/25"}`} />
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
/* Bits                                                                 */
/* ------------------------------------------------------------------ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-terminal text-xl uppercase tracking-[0.25em] text-warm-400">
      {children}
    </p>
  );
}

/* full-width tinted band for colour variety between sections */
function Band({
  children,
  tint,
  className = "",
}: {
  children: React.ReactNode;
  tint?: string;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${tint ?? ""} ${className}`}>{children}</div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                             */
/* ------------------------------------------------------------------ */

function IntegrationsStrip() {
  return (
    <section className="relative z-10 mx-auto mt-20 w-full max-w-4xl px-6">
      <Reveal className="text-center">
        <p className="font-terminal text-xl tracking-[0.15em] text-[var(--text-tertiary)]">
          works inside the tools you already live in
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {integrations.map((name) => (
            <span
              key={name}
              className="pixel-corners flex items-center gap-2 border-2 border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--text-secondary)] shadow-pixel-sm"
            >
              <span className="h-2.5 w-2.5 bg-warm-400" />
              {name}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Pillars() {
  const reduce = useReducedMotion();
  return (
    <section id="features" className="relative z-10 mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-28">
      <Reveal className="mb-12 text-center">
        <SectionLabel>{"// why haven"}</SectionLabel>
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
        {pillars.map((p, i) => {
          const tints = ["text-warm-500", "text-clay-400", "text-accent-400"];
          const borders = ["border-warm-400/50 bg-warm-400/12", "border-clay-400/50 bg-clay-400/12", "border-accent-400/50 bg-accent-400/12"];
          return (
            <motion.div
              key={p.title}
              variants={reduce ? undefined : fadeUp}
              className="pixel-corners group relative border-[3px] border-[#3a342d] bg-[var(--surface)] p-6 shadow-pixel transition-transform duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5"
            >
              <div className={`pixelated mb-5 grid h-12 w-12 place-items-center border-[3px] ${borders[i]} ${tints[i]}`}>
                <PixelIcon kind={p.icon} />
              </div>
              <h3 className="font-pixel mb-2.5 text-xl font-semibold text-[var(--text-primary)]">
                {p.title}
              </h3>
              <p className="text-[15px] leading-[1.75] text-[var(--text-secondary)]">{p.body}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}

function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how" className="relative z-10 mx-auto w-full max-w-5xl scroll-mt-24 px-6 py-28">
      <Reveal className="mb-12 text-center">
        <SectionLabel>{"// moving in"}</SectionLabel>
        <h2 className="font-pixel mx-auto max-w-2xl text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl">
          From chaos to calm in three steps
        </h2>
      </Reveal>

      <motion.div
        variants={reduce ? undefined : stagger}
        initial={reduce ? undefined : "hidden"}
        whileInView={reduce ? undefined : "visible"}
        viewport={{ once: true, amount: 0.3 }}
        className="grid grid-cols-1 gap-6 md:grid-cols-3"
      >
        {steps.map((s) => (
          <motion.div
            key={s.n}
            variants={reduce ? undefined : fadeUp}
            className="pixel-corners relative border-[3px] border-[#3a342d] bg-[var(--surface)] p-6 shadow-pixel"
          >
            <span className="absolute right-3 top-2 opacity-30">
              <PixelNumber value={s.n} scale={4} color="#48703f" />
            </span>
            <div className="pixelated mb-5 grid h-12 w-12 place-items-center border-[3px] border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PixelIcon kind={s.icon} />
            </div>
            <h3 className="font-pixel mb-2.5 text-xl font-semibold text-[var(--text-primary)]">{s.title}</h3>
            <p className="text-[15px] leading-[1.75] text-[var(--text-secondary)]">{s.body}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function FeatureDepth() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-4xl px-6 py-28">
      <div className="flex flex-col gap-24">
        {featureDepth.map((f, i) => (
          <Reveal key={f.eyebrow}>
            <div className={`flex flex-col items-center gap-10 md:flex-row ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
              <div className="flex-1 text-center md:text-left">
                <p className="mb-3 font-terminal text-xl uppercase tracking-[0.2em] text-warm-400">
                  [ {f.eyebrow} ]
                </p>
                <h3 className="font-pixel mb-4 text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">{f.title}</h3>
                <p className="mx-auto max-w-md text-[15px] leading-[1.75] text-[var(--text-secondary)] md:mx-0">{f.body}</p>
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

function CozyBand() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10">
      <Reveal>
        <div className="pixel-corners pixel-dither relative overflow-hidden border-[4px] border-[#5e3a26] bg-gradient-to-br from-warm-200/70 via-clay-200/50 to-accent-400/20 px-8 py-14 text-center shadow-pixel-lg dark:from-warm-500/15 dark:via-clay-500/10 dark:to-accent-500/10">
          <div className="mb-6 flex justify-center">
            <AiSprite size={60} />
          </div>
          <h2 className="font-pixel mx-auto max-w-2xl text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
            The home that has your back
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-[1.8] text-[var(--text-secondary)]">
            Haven isn&apos;t another dashboard to manage. It&apos;s a warm,
            lamp-lit place that notices everything — every task, every
            reschedule, every late night — and quietly keeps things in order, so
            you can finally exhale.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-5xl px-6 py-28">
      <Reveal className="mb-12 flex flex-col items-center text-center">
        <div className="flex items-end gap-3">
          <PixelNumber value="45" scale={9} color="#e8893f" />
          <span className="font-pixel pb-1 text-3xl font-bold text-warm-500">min / day</span>
        </div>
        <p className="mt-5 max-w-md text-base text-[var(--text-secondary)]">
          That&apos;s how much planning and second-guessing Haven quietly takes
          off your plate.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {testimonials.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.08}>
            <figure className="pixel-corners relative h-full border-[3px] border-[#3a342d] bg-[var(--surface)] p-6 shadow-pixel">
              <div className="mb-3 flex gap-0.5 text-warm-400">
                {Array.from({ length: 5 }).map((_, s) => (
                  <span key={s} className="h-3 w-3 bg-warm-400" />
                ))}
              </div>
              <blockquote className="text-[15px] leading-[1.75] text-[var(--text-primary)]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="pixelated grid h-9 w-9 place-items-center border-2 border-[#3a2418] bg-gradient-to-br from-warm-300 to-warm-500 font-pixel text-sm font-bold text-[#3a2418]">
                  {t.name.charAt(0)}
                </span>
                <span className="text-sm">
                  <span className="block font-medium text-[var(--text-primary)]">{t.name}</span>
                  <span className="block text-[var(--text-tertiary)]">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative z-10 mx-auto w-full max-w-3xl scroll-mt-24 px-6 py-28">
      <Reveal className="mb-10 text-center">
        <SectionLabel>{"// before you move in"}</SectionLabel>
        <h2 className="font-pixel text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl">
          Questions, answered
        </h2>
      </Reveal>

      <div className="flex flex-col gap-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={f.q} delay={i * 0.04}>
              <div className="pixel-corners border-[3px] border-[#3a342d] bg-[var(--surface)] shadow-pixel-sm">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-pixel text-lg font-semibold text-[var(--text-primary)]">{f.q}</span>
                  <span className={`pixelated grid h-6 w-6 flex-shrink-0 place-items-center border-2 border-warm-400/60 font-pixel text-warm-400 transition-transform duration-150 ${isOpen ? "rotate-45" : ""}`}>
                    +
                  </span>
                </button>
                {isOpen && (
                  <p className="border-t-2 border-[var(--border)] px-5 py-4 text-[15px] leading-[1.75] text-[var(--text-secondary)]">
                    {f.a}
                  </p>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function EmotionalClose() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl px-6 py-28 text-center">
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
/* Nav — transparent over the hero, solid pixel bar once scrolled      */
/* ------------------------------------------------------------------ */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full">
      <div
        className={`mx-auto flex w-full max-w-6xl items-center justify-between px-6 transition-all duration-200 ${
          scrolled
            ? "my-2 border-2 border-[var(--border)] bg-[var(--surface)]/90 py-2.5 shadow-pixel-sm backdrop-blur-md"
            : "py-5"
        }`}
      >
        <a href="#top" className="flex items-center gap-2.5">
          <PixelLogo size={26} />
          <span className={`font-pixel text-lg font-semibold tracking-tight ${scrolled ? "text-[var(--text-primary)]" : "text-warm-50"}`}>
            Haven
          </span>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {[
            { label: "features", href: "#features" },
            { label: "how it works", href: "#how" },
            { label: "faq", href: "#faq" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`font-terminal text-xl transition-colors hover:text-warm-400 ${scrolled ? "text-[var(--text-secondary)]" : "text-warm-100/90"}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className={`hidden font-terminal text-xl transition-colors hover:text-warm-400 sm:block ${scrolled ? "text-[var(--text-secondary)]" : "text-warm-100/90"}`}
          >
            sign in &gt;
          </button>
          <GetStartedButton size="sm" label="Enter" />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Landing Page                                                        */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const reduce = useReducedMotion();

  // The app shell locks scrolling globally (body { overflow: hidden }).
  // Unlock the document while the landing page is mounted.
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const prev = {
      bo: body.style.overflow,
      ho: html.style.overflow,
      bh: body.style.height,
      hh: html.style.height,
    };
    body.style.overflow = "auto";
    html.style.overflow = "auto";
    body.style.height = "auto";
    html.style.height = "auto";
    return () => {
      body.style.overflow = prev.bo;
      html.style.overflow = prev.ho;
      body.style.height = prev.bh;
      html.style.height = prev.hh;
    };
  }, []);

  return (
    <div id="top" className="relative w-full bg-[var(--bg)]">
      {/* ambient warm wash behind the content sections */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[40%] -right-[8%] h-[520px] w-[520px] rounded-full bg-clay-400/[0.1] blur-[120px] animate-aurora" />
        <div className="absolute bottom-[8%] left-[26%] h-[460px] w-[460px] rounded-full bg-accent-500/[0.07] blur-[110px] animate-float-slow" />
        <div className="absolute top-[68%] left-[2%] h-[420px] w-[420px] rounded-full bg-warm-400/[0.1] blur-[120px] animate-drift" />
      </div>

      <Nav />

      {/* ===================== HERO (full-bleed scene) ===================== */}
      <section className="relative flex min-h-[94vh] w-full flex-col items-center justify-center overflow-hidden">
        {/* the pixel world */}
        <JungleCabinScene className="absolute inset-0 h-full w-full" />

        {/* top scrim so nav + headline stay readable */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#100c24]/85 via-[#160f2a]/35 to-transparent" />
        {/* bottom fade into the page */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--bg)]" />

        {/* hero content */}
        <motion.div
          initial={reduce ? undefined : "hidden"}
          animate={reduce ? undefined : "visible"}
          variants={reduce ? undefined : stagger}
          className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 pb-24 pt-28 text-center"
        >
          <motion.div
            variants={reduce ? undefined : fadeUp}
            className="pixel-corners mb-7 inline-flex items-center gap-2 border-2 border-warm-300/40 bg-[#100c24]/40 px-3 py-1.5 backdrop-blur-sm"
          >
            <span className="h-2 w-2 bg-success-400 animate-pixel-twinkle" />
            <span className="font-terminal text-lg leading-none text-warm-100">
              your AI home, always awake
            </span>
          </motion.div>

          <motion.h1
            variants={reduce ? undefined : fadeUp}
            className="font-pixel text-balance text-4xl font-bold leading-[1.15] text-warm-50 drop-shadow-[3px_3px_0_rgba(16,12,36,0.8)] sm:text-5xl md:text-6xl"
          >
            Your calm place to{" "}
            <span className="gradient-text-pixel">get things done</span>
          </motion.h1>

          <motion.p
            variants={reduce ? undefined : fadeUp}
            className="mt-6 max-w-xl text-balance text-lg leading-[1.7] text-warm-100/90 drop-shadow-[1px_1px_0_rgba(16,12,36,0.9)]"
          >
            Haven is the AI that plans your day, protects your time, and learns
            your rhythm. Every task, every deadline, quietly watched over — so
            the chaos quiets down and your focus comes home.
          </motion.p>

          <motion.div variants={reduce ? undefined : fadeUp} className="mt-9 flex flex-col items-center gap-4">
            <GetStartedButton />
            <p className="font-terminal text-lg tracking-wide text-warm-100/80">
              calm in the chaos &middot; no credit card needed
            </p>
          </motion.div>
        </motion.div>

        {/* welcome-home placard */}
        <div className="pixel-corners absolute bottom-8 left-1/2 z-10 -translate-x-1/2 border-2 border-[#5e3a26] bg-warm-100 px-4 py-1 shadow-pixel-sm">
          <span className="font-pixel text-sm font-semibold text-[#5e3a26]">welcome home</span>
        </div>
      </section>

      <IntegrationsStrip />

      {/* warm band */}
      <Band tint="bg-warm-400/[0.05]">
        <Pillars />
      </Band>

      {/* jungle-green band */}
      <Band tint="bg-emerald-500/[0.06] dark:bg-emerald-500/[0.04]">
        <HowItWorks />
      </Band>

      <FeatureDepth />

      <CozyBand />

      {/* warm band */}
      <Band tint="bg-warm-400/[0.06]">
        <SocialProof />
      </Band>

      {/* periwinkle band */}
      <Band tint="bg-accent-500/[0.05]">
        <Faq />
      </Band>

      <EmotionalClose />

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-[var(--border)] bg-[var(--bg-secondary)] pb-14 pt-14">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-10 px-6 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <PixelLogo size={24} />
              <span className="font-pixel text-base font-semibold tracking-tight text-[var(--text-primary)]">Haven</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-[1.7] text-[var(--text-secondary)]">
              The cozy AI home for your tasks, time, and focus. Come home to calm.
            </p>
          </div>

          {[
            { title: "Product", links: ["Features", "How it works", "FAQ"] },
            { title: "Company", links: ["About", "Privacy", "Contact"] },
            { title: "Get started", links: ["Sign in", "Enter Haven"] },
          ].map((col) => (
            <div key={col.title}>
              <p className="font-terminal text-lg uppercase tracking-[0.15em] text-warm-400">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <button
                      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                      className="text-sm text-[var(--text-secondary)] transition-colors hover:text-warm-400"
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 flex w-full max-w-5xl flex-col items-center justify-between gap-3 border-t-2 border-[var(--border)] px-6 pt-6 sm:flex-row">
          <p className="text-xs text-[var(--text-tertiary)]">
            Built with care. Your day, handled — your data stays yours.
          </p>
          <p className="font-terminal text-base text-[var(--text-tertiary)] opacity-70">
            haven {new Date().getFullYear()} — the porch light is on
          </p>
        </div>
      </footer>
    </div>
  );
}
