"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useAnimationControls } from "framer-motion";
import { Music, X } from "lucide-react";

const STORAGE_KEY = "chronai-spotify-player";
const CONNECTED_KEY = "chronai-spotify-connected";
const BUTTON_Y_STORAGE_KEY = "chronai-spotify-button-y";

interface PlayerState {
  visible: boolean;
  snapped: boolean;
  position: { x: number; y: number };
}

const DEFAULT_STATE: PlayerState = {
  visible: true,
  snapped: true,
  position: { x: 0, y: 0 },
};

const CARD_WIDTH = 320;
const CARD_HEIGHT = 200;
const SNAPPED_BUTTON_SIZE = 40;

export default function SpotifyMiniPlayer() {
  const [connected, setConnected] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>(DEFAULT_STATE);
  const [mounted, setMounted] = useState(false);
  const [buttonY, setButtonY] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number>(typeof window !== "undefined" ? window.innerHeight : 800);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const motionX = useMotionValue(0);
  const motionY = useMotionValue(0);
  const buttonMotionY = useMotionValue(0);
  const isDraggingRef = useRef(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const isConnected = localStorage.getItem(CONNECTED_KEY) === "true";
    setConnected(isConnected);

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PlayerState;
        setPlayerState(parsed);
      } catch {
        // Use default state
      }
    }

    // Load button Y position
    const storedY = localStorage.getItem(BUTTON_Y_STORAGE_KEY);
    if (storedY) {
      const parsedY = parseFloat(storedY);
      if (!isNaN(parsedY)) {
        setButtonY(parsedY);
      }
    }

    setMounted(true);
  }, []);

  // Listen for storage changes (from settings page)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CONNECTED_KEY) {
        setConnected(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Update viewport height on resize to keep drag constraints fresh
  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Persist state to localStorage
  const saveState = (newState: PlayerState) => {
    setPlayerState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  // Set initial position for card using animation controls
  useEffect(() => {
    if (!mounted) return;
    if (!playerState.snapped) {
      const pos = playerState.position;
      if (pos.x === 0 && pos.y === 0) {
        // Default bottom-right positioning
        const defaultX = typeof window !== "undefined" ? window.innerWidth - CARD_WIDTH - 24 : 800;
        const defaultY = typeof window !== "undefined" ? window.innerHeight - CARD_HEIGHT - 100 : 500;
        controls.set({ x: defaultX, y: defaultY });
      } else {
        controls.set({ x: pos.x, y: pos.y });
      }
    }
  }, [mounted, playerState.snapped, controls, playerState.position]);

  if (!mounted || !connected || !playerState.visible) return null;

  const handleCardDragEnd = () => {
    const currentX = motionX.get();
    const currentY = motionY.get();
    saveState({
      ...playerState,
      snapped: false,
      position: { x: currentX, y: currentY },
    });
  };

  const handleExpand = () => {
    // Skip if a drag just occurred
    if (isDraggingRef.current) return;

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const expandX = viewportWidth - CARD_WIDTH - 24;
    const currentButtonY = buttonY ?? (typeof window !== "undefined" ? window.innerHeight / 2 : 300);
    const expandY = Math.max(20, currentButtonY - CARD_HEIGHT / 2);
    saveState({
      ...playerState,
      snapped: false,
      position: { x: expandX, y: expandY },
    });
    controls.start({ x: expandX, y: expandY });
  };

  const handleCollapse = () => {
    saveState({
      ...playerState,
      snapped: true,
    });
  };

  const handleButtonDragEnd = () => {
    // Mark that a drag just occurred to prevent click from firing
    isDraggingRef.current = true;
    setTimeout(() => { isDraggingRef.current = false; }, 200);

    const currentY = buttonMotionY.get();
    const baseY = buttonY ?? (typeof window !== "undefined" ? window.innerHeight / 2 - SNAPPED_BUTTON_SIZE / 2 : 300);
    const newY = baseY + currentY;
    // Clamp to viewport
    const maxY = (typeof window !== "undefined" ? window.innerHeight : 800) - SNAPPED_BUTTON_SIZE;
    const clampedY = Math.max(0, Math.min(newY, maxY));
    setButtonY(clampedY);
    localStorage.setItem(BUTTON_Y_STORAGE_KEY, String(clampedY));
    // Reset motion value since we update the top position directly
    buttonMotionY.set(0);
  };

  // Snapped (collapsed) state - small button on right edge, draggable vertically only
  if (playerState.snapped) {
    const topPosition = buttonY ?? (typeof window !== "undefined" ? window.innerHeight / 2 - SNAPPED_BUTTON_SIZE / 2 : 300);
    const maxDragUp = -topPosition;
    const maxDragDown = viewportHeight - SNAPPED_BUTTON_SIZE - topPosition;

    return (
      <motion.div
        drag="y"
        dragMomentum={false}
        dragConstraints={{ top: maxDragUp, bottom: maxDragDown }}
        onDragEnd={handleButtonDragEnd}
        style={{
          y: buttonMotionY,
          width: SNAPPED_BUTTON_SIZE,
          height: SNAPPED_BUTTON_SIZE,
          right: 0,
          top: topPosition,
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={handleExpand}
        className="fixed z-[60] flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-grab active:cursor-grabbing"
        role="button"
        tabIndex={0}
        aria-label="Expand Spotify player"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleExpand(); }}
      >
        <Music size={18} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
      </motion.div>
    );
  }

  // Expanded card state
  return (
    <>
      {/* Invisible constraint boundary */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[59]" />

      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        onDragEnd={handleCardDragEnd}
        animate={controls}
        style={{ x: motionX, y: motionY }}
        className="fixed top-0 left-0 z-[60] cursor-grab active:cursor-grabbing"
      >
        <div
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden"
          style={{ width: CARD_WIDTH }}
        >
          {/* Drag handle */}
          <div className="flex items-center justify-center pt-2 pb-1">
            <div className="h-1 w-8 rounded-full bg-[var(--text-tertiary)] opacity-40" />
          </div>

          {/* Close/minimize button */}
          <div className="flex justify-end px-3 pb-1">
            <button
              onClick={handleCollapse}
              className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--surface-hover)] transition-colors"
              aria-label="Minimize Spotify player"
            >
              <X size={14} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Spotify embed */}
          <div className="px-3 pb-3">
            <iframe
              src="https://open.spotify.com/embed/playlist/37i9dQZF1DX3rxVfibe1L0?utm_source=generator&theme=0"
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              loading="lazy"
              style={{ borderRadius: "12px" }}
              title="Spotify Player"
            />
          </div>
        </div>
      </motion.div>
    </>
  );
}
