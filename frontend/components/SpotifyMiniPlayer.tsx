"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, X, Play, Pause } from "lucide-react";

const CONNECTED_KEY = "chronai-spotify-connected";
const PLAYLIST_URL_KEY = "chronai-spotify-playlist-url";

const DEFAULT_EMBED_URL =
  "https://open.spotify.com/embed/playlist/37i9dQZF1DX3rxVfibe1L0?utm_source=generator&theme=0";

function toSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    if (url.includes("open.spotify.com/embed/")) return url;
    const match = url.match(
      /open\.spotify\.com\/(playlist|track|album|episode|show)\/([a-zA-Z0-9]+)/
    );
    if (match) return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
    const uriMatch = url.match(
      /spotify:(playlist|track|album|episode|show):([a-zA-Z0-9]+)/
    );
    if (uriMatch) return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}?utm_source=generator&theme=0`;
    return null;
  } catch {
    return null;
  }
}

/**
 * SpotifyMiniPlayer
 * A simple music widget:
 * - Collapsed: a small button on the right edge (click to expand)
 * - Expanded: a floating card with Spotify embed (click X to collapse)
 * - The iframe is always mounted so music never stops.
 */
export default function SpotifyMiniPlayer() {
  const [connected, setConnected] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [embedUrl, setEmbedUrl] = useState(DEFAULT_EMBED_URL);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConnected(localStorage.getItem(CONNECTED_KEY) === "true");
    const customUrl = localStorage.getItem(PLAYLIST_URL_KEY);
    if (customUrl) {
      const converted = toSpotifyEmbedUrl(customUrl);
      if (converted) setEmbedUrl(converted);
    }
  }, []);

  // Listen for changes from settings
  useEffect(() => {
    const handleStorage = () => {
      setConnected(localStorage.getItem(CONNECTED_KEY) === "true");
      const customUrl = localStorage.getItem(PLAYLIST_URL_KEY);
      if (customUrl) {
        const converted = toSpotifyEmbedUrl(customUrl);
        if (converted) setEmbedUrl(converted);
      } else {
        setEmbedUrl(DEFAULT_EMBED_URL);
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("chronai-playlist-changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("chronai-playlist-changed", handleStorage);
    };
  }, []);

  if (!mounted || !connected) return null;

  return (
    <>
      {/* Iframe always mounted — offscreen when collapsed so music persists */}
      <div
        style={{
          position: "fixed",
          top: expanded ? undefined : -9999,
          left: expanded ? undefined : -9999,
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? "auto" : "none",
          zIndex: expanded ? 60 : -1,
        }}
      >
        {/* Expanded card */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed bottom-20 right-4 z-[60] w-[320px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Now Playing
                  </span>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                  aria-label="Close player"
                >
                  <X size={14} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Collapsed button — fixed on right edge */}
      <AnimatePresence>
        {!expanded && (
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            onClick={() => setExpanded(true)}
            className="fixed right-0 bottom-32 z-[60] flex h-10 w-10 items-center justify-center rounded-l-xl border border-r-0 border-[var(--border)] bg-[var(--surface)] shadow-sm hover:bg-[var(--surface-hover)] transition-colors"
            aria-label="Open Spotify player"
          >
            <Music size={16} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
            <span className="absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full bg-emerald-400" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
