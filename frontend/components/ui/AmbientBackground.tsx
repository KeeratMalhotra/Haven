"use client";

/**
 * AmbientBackground
 * A subtle, always-on ambient field for the deep-space canvas: two slow-drifting
 * gradient blobs (magenta + cyan) anchored to opposite screen edges, plus a faint
 * dotted grid that fades toward the edges. Purely decorative, no interactivity,
 * and crucially NOT a 3D entity — that only appears in voice mode.
 */
export default function AmbientBackground() {
  return (
    <div className="ambient-canvas" aria-hidden="true">
      <div className="ambient-blob ambient-blob--magenta" />
      <div className="ambient-blob ambient-blob--cyan" />
      <div className="ambient-grid" />
      {/* Vignette to deepen the corners */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, transparent 40%, rgba(3,4,9,0.55) 100%)",
        }}
      />
    </div>
  );
}
