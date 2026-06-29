"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Music, X } from "lucide-react";

const PLAYLIST_URL_KEY = "chronai-spotify-playlist-url";
const BUTTON_POS_KEY = "chronai-spotify-button-pos";

const DEFAULT_EMBED_URL =
  "https://open.spotify.com/embed/playlist/37i9dQZF1DX3rxVfibe1L0?utm_source=generator&theme=0";

function toSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    if (url.includes("open.spotify.com/embed/")) return url;
    const match = url.match(
      /open\.spotify\.com\/(playlist|track|album|episode|show)\/([a-zA-Z0-9]+)/
    );
    if (match)
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
    const uriMatch = url.match(
      /spotify:(playlist|track|album|episode|show):([a-zA-Z0-9]+)/
    );
    if (uriMatch)
      return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}?utm_source=generator&theme=0`;
    return null;
  } catch {
    return null;
  }
}

function getDefaultButtonPos() {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return {
    x: window.innerWidth - 60,
    y: window.innerHeight - 160,
  };
}

function loadButtonPos(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(BUTTON_POS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (
        typeof parsed.x === "number" &&
        typeof parsed.y === "number"
      ) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveButtonPos(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(BUTTON_POS_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function clampButtonPos(x: number, y: number): { x: number; y: number } {
  const minX = Math.floor(window.innerWidth / 2);
  const maxX = window.innerWidth - 48;
  const minY = 8;
  const maxY = window.innerHeight - 48;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

function clampWindowPos(x: number, y: number): { x: number; y: number } {
  const maxX = window.innerWidth - 100;
  const maxY = window.innerHeight - 60;
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  };
}

/**
 * SpotifyMiniPlayer
 * - Draggable music button on the right half of the screen
 * - Clicking opens a draggable floating Spotify player window
 * - z-[110] so it stays above FocusMode/Pomodoro overlays
 * - Iframe always mounted so music never stops
 */
export default function SpotifyMiniPlayer() {
  const [embedUrl, setEmbedUrl] = useState(DEFAULT_EMBED_URL);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Button position state
  const [buttonPos, setButtonPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Window position state
  const [windowPos, setWindowPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Ref tracking current button position to avoid stale closure in pointer-up
  const buttonPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Ref tracking current window position to avoid stale closure
  const windowPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Defer iframe rendering until the player has been expanded at least once
  const hasEverExpanded = useRef(false);

  // Drag tracking refs
  const buttonDragRef = useRef(false);
  const buttonDragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const buttonMovedRef = useRef(false);

  const windowDragRef = useRef(false);
  const windowDragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Initialize positions on mount
  useEffect(() => {
    setMounted(true);
    const saved = loadButtonPos();
    if (saved) {
      const clamped = clampButtonPos(saved.x, saved.y);
      setButtonPos(clamped);
      buttonPosRef.current = clamped;
    } else {
      const defaultPos = getDefaultButtonPos();
      setButtonPos(defaultPos);
      buttonPosRef.current = defaultPos;
    }
    // Center the window initially
    const initialWindowPos = {
      x: Math.max(0, Math.floor(window.innerWidth / 2 - 170)),
      y: Math.max(0, Math.floor(window.innerHeight / 2 - 150)),
    };
    setWindowPos(initialWindowPos);
    windowPosRef.current = initialWindowPos;
  }, []);

  // Listen for playlist changes
  useEffect(() => {
    const handleStorage = () => {
      const customUrl = localStorage.getItem(PLAYLIST_URL_KEY);
      if (customUrl) {
        const converted = toSpotifyEmbedUrl(customUrl);
        if (converted) {
          setEmbedUrl(converted);
        } else {
          setEmbedUrl(DEFAULT_EMBED_URL);
        }
      } else {
        setEmbedUrl(DEFAULT_EMBED_URL);
      }
    };
    handleStorage();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("chronai-playlist-changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("chronai-playlist-changed", handleStorage);
    };
  }, []);

  // --- Button drag handlers ---
  const handleButtonPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      buttonDragRef.current = true;
      buttonMovedRef.current = false;
      const currentPos = buttonPosRef.current;
      buttonDragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: currentPos.x,
        posY: currentPos.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handleButtonPointerMove = useCallback((e: React.PointerEvent) => {
    if (!buttonDragRef.current) return;
    const dx = e.clientX - buttonDragStartRef.current.x;
    const dy = e.clientY - buttonDragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      buttonMovedRef.current = true;
    }
    const newX = buttonDragStartRef.current.posX + dx;
    const newY = buttonDragStartRef.current.posY + dy;
    const clamped = clampButtonPos(newX, newY);
    setButtonPos(clamped);
    buttonPosRef.current = clamped;
  }, []);

  const handleButtonPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!buttonDragRef.current) return;
      buttonDragRef.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      saveButtonPos(buttonPosRef.current);
      if (!buttonMovedRef.current) {
        hasEverExpanded.current = true;
        setExpanded(true);
      }
    },
    []
  );

  const handleButtonPointerCancel = useCallback((e: React.PointerEvent) => {
    buttonDragRef.current = false;
    buttonMovedRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handleButtonKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      hasEverExpanded.current = true;
      setExpanded(true);
    }
  }, []);

  // --- Window drag handlers ---
  const handleWindowPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      windowDragRef.current = true;
      const currentPos = windowPosRef.current;
      windowDragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: currentPos.x,
        posY: currentPos.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handleWindowPointerMove = useCallback((e: React.PointerEvent) => {
    if (!windowDragRef.current) return;
    const dx = e.clientX - windowDragStartRef.current.x;
    const dy = e.clientY - windowDragStartRef.current.y;
    const newX = windowDragStartRef.current.posX + dx;
    const newY = windowDragStartRef.current.posY + dy;
    const clamped = clampWindowPos(newX, newY);
    setWindowPos(clamped);
    windowPosRef.current = clamped;
  }, []);

  const handleWindowPointerUp = useCallback((e: React.PointerEvent) => {
    if (!windowDragRef.current) return;
    windowDragRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handleWindowPointerCancel = useCallback((e: React.PointerEvent) => {
    windowDragRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Player window - only rendered after first expand; stays mounted thereafter */}
      {hasEverExpanded.current && (
        <div
          className="fixed z-[110]"
          style={{
            top: expanded ? windowPos.y : -9999,
            left: expanded ? windowPos.x : -9999,
            opacity: expanded ? 1 : 0,
            pointerEvents: expanded ? "auto" : "none",
          }}
        >
          {/* Player window */}
          <div className="w-[340px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
            {/* Drag handle / header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] cursor-grab active:cursor-grabbing select-none"
              onPointerDown={handleWindowPointerDown}
              onPointerMove={handleWindowPointerMove}
              onPointerUp={handleWindowPointerUp}
              onPointerCancel={handleWindowPointerCancel}
              onLostPointerCapture={handleWindowPointerCancel}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
                  Now Playing
                </span>
              </div>
              <button
                onClick={() => setExpanded(false)}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                aria-label="Close player"
              >
                <X
                  size={14}
                  strokeWidth={1.5}
                  className="text-[var(--text-tertiary)] dark:text-[#847e76]"
                />
              </button>
            </div>

            {/* Spotify embed */}
            <div className="p-3">
              <iframe
                src={embedUrl}
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
        </div>
      )}

      {/* Draggable music button */}
      {!expanded && (
        <div
          className="fixed z-[110] flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500/30 bg-emerald-500/15 shadow-[0_0_12px_2px_rgba(16,185,129,0.2)] hover:bg-emerald-500/25 hover:shadow-[0_0_16px_4px_rgba(16,185,129,0.3)] transition-all cursor-grab active:cursor-grabbing select-none touch-none"
          style={{
            left: buttonPos.x,
            top: buttonPos.y,
          }}
          onPointerDown={handleButtonPointerDown}
          onPointerMove={handleButtonPointerMove}
          onPointerUp={handleButtonPointerUp}
          onPointerCancel={handleButtonPointerCancel}
          onLostPointerCapture={handleButtonPointerCancel}
          onKeyDown={handleButtonKeyDown}
          role="button"
          aria-label="Open Spotify player"
          tabIndex={0}
        >
          <Music
            size={24}
            strokeWidth={1.5}
            className="text-emerald-500 pointer-events-none"
          />
          <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse pointer-events-none" />
        </div>
      )}
    </>
  );
}
