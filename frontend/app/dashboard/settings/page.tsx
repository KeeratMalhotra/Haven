"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Settings,
  User,
  Palette,
  Sparkles,
  Link2,
  Keyboard,
  Sun,
  Moon,
  CheckCircle2,
  Music,
  Zap,
  Bell,
  Mail,
  FileText,
  Calendar,
} from "lucide-react";

import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { useTheme } from "@/components/ui/theme-provider";
import { fetchPreferences, updatePreferences } from "@/lib/api-extended";

type AiTone = "professional" | "casual" | "friendly";

const SHORTCUTS = [
  { keys: "Cmd + K", description: "Open Command Palette" },
  { keys: "Cmd + B", description: "Toggle Sidebar" },
  { keys: "Cmd + /", description: "AI Chat" },
  { keys: "Escape", description: "Close panels" },
];

/**
 * Helper to dispatch a StorageEvent so other components can react to changes.
 */
function dispatchStorageChange(key: string, newValue: string) {
  window.dispatchEvent(
    new StorageEvent("storage", {
      key,
      newValue,
    })
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const user = session?.user;

  // AI Preferences (localStorage)
  const [aiTone, setAiTone] = useState<AiTone>("casual");
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [proactiveNotifs, setProactiveNotifs] = useState(true);
  const [autopilotMode, setAutopilotMode] = useState<"ask_permission" | "full_auto">("ask_permission");

  // Integrations (localStorage)
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState("");
  const [gmailEnabled, setGmailEnabled] = useState(true);
  const [slidesEnabled, setSlidesEnabled] = useState(true);

  // Notification preferences (localStorage + backend)
  const [emailDeadlineReminders, setEmailDeadlineReminders] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [weeklyReview, setWeeklyReview] = useState(false);

  // Get auth token for backend calls
  const authToken = (session as any)?.accessToken || "";

  // Load preferences on mount
  useEffect(() => {
    // Load localStorage values
    const stored = localStorage.getItem("chronai-ai-tone");
    if (stored) setAiTone(stored as AiTone);

    const suggestions = localStorage.getItem("chronai-ai-suggestions");
    if (suggestions !== null) setAiSuggestions(suggestions === "true");

    const notifs = localStorage.getItem("chronai-proactive-notifs");
    if (notifs !== null) setProactiveNotifs(notifs === "true");

    const spotify = localStorage.getItem("chronai-spotify-connected");
    setSpotifyConnected(spotify === "true");

    const playlistUrl = localStorage.getItem("chronai-spotify-playlist-url");
    if (playlistUrl) setSpotifyPlaylistUrl(playlistUrl);

    const autopilot = localStorage.getItem("chronai-autopilot-mode");
    if (autopilot === "full_auto") setAutopilotMode("full_auto");

    const gmail = localStorage.getItem("chronai-gmail-enabled");
    // Default to true if not set
    setGmailEnabled(gmail === null ? true : gmail === "true");

    const slides = localStorage.getItem("chronai-slides-enabled");
    // Default to true if not set
    setSlidesEnabled(slides === null ? true : slides === "true");

    // Load notification prefs from localStorage (will be overridden by backend if available)
    const emailReminders = localStorage.getItem("chronai-email-deadline-reminders");
    if (emailReminders !== null) setEmailDeadlineReminders(emailReminders === "true");

    const digest = localStorage.getItem("chronai-daily-digest");
    if (digest !== null) setDailyDigest(digest === "true");

    const review = localStorage.getItem("chronai-weekly-review");
    if (review !== null) setWeeklyReview(review === "true");
  }, []);

  // Fetch backend preferences and sync to state + localStorage
  useEffect(() => {
    if (!authToken) return;

    fetchPreferences(authToken).then((data) => {
      if (data.notification_preferences) {
        const np = data.notification_preferences;

        if (np.email_deadline_reminders !== undefined) {
          setEmailDeadlineReminders(np.email_deadline_reminders);
          localStorage.setItem("chronai-email-deadline-reminders", String(np.email_deadline_reminders));
        }
        if (np.daily_digest !== undefined) {
          setDailyDigest(np.daily_digest);
          localStorage.setItem("chronai-daily-digest", String(np.daily_digest));
        }
        if (np.weekly_review !== undefined) {
          setWeeklyReview(np.weekly_review);
          localStorage.setItem("chronai-weekly-review", String(np.weekly_review));
        }
      }
    });
  }, [authToken]);

  // --- AI Preferences handlers ---
  const updateAiTone = (tone: AiTone) => {
    setAiTone(tone);
    localStorage.setItem("chronai-ai-tone", tone);
  };

  const updateAiSuggestions = (val: boolean) => {
    setAiSuggestions(val);
    localStorage.setItem("chronai-ai-suggestions", String(val));
    dispatchStorageChange("chronai-ai-suggestions", String(val));
  };

  const updateProactiveNotifs = (val: boolean) => {
    setProactiveNotifs(val);
    localStorage.setItem("chronai-proactive-notifs", String(val));
    dispatchStorageChange("chronai-proactive-notifs", String(val));
  };

  const updateAutopilotMode = (fullAuto: boolean) => {
    const mode = fullAuto ? "full_auto" : "ask_permission";
    setAutopilotMode(mode);
    localStorage.setItem("chronai-autopilot-mode", mode);
    dispatchStorageChange("chronai-autopilot-mode", mode);
  };

  // --- Integration handlers ---
  const toggleSpotifyConnection = () => {
    const newVal = !spotifyConnected;
    setSpotifyConnected(newVal);
    localStorage.setItem("chronai-spotify-connected", String(newVal));
    dispatchStorageChange("chronai-spotify-connected", String(newVal));
  };

  const handlePlaylistUrlChange = (url: string) => {
    setSpotifyPlaylistUrl(url);
    localStorage.setItem("chronai-spotify-playlist-url", url);
    dispatchStorageChange("chronai-spotify-playlist-url", url);
    // Also dispatch custom event for components listening specifically for playlist changes
    window.dispatchEvent(new CustomEvent("chronai-playlist-changed", { detail: { url } }));
  };

  const toggleGmailEnabled = (val: boolean) => {
    setGmailEnabled(val);
    localStorage.setItem("chronai-gmail-enabled", String(val));
    dispatchStorageChange("chronai-gmail-enabled", String(val));
  };

  const toggleSlidesEnabled = (val: boolean) => {
    setSlidesEnabled(val);
    localStorage.setItem("chronai-slides-enabled", String(val));
    dispatchStorageChange("chronai-slides-enabled", String(val));
  };

  // --- Notification handlers (save to localStorage + backend) ---
  const updateNotificationPref = useCallback(
    (key: string, value: boolean, setter: (v: boolean) => void) => {
      setter(value);
      localStorage.setItem(key, String(value));
      dispatchStorageChange(key, String(value));

      // Persist to backend
      if (authToken) {
        const backendKey = key.replace("chronai-", "").replace(/-/g, "_");
        updatePreferences(authToken, {
          notification_preferences: { [backendKey]: value },
        }).catch(() => {
          // Silent fail - localStorage still has the value
        });
      }
    },
    [authToken]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-500/10">
          <Settings size={20} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Settings
        </h1>
      </div>

      {/* Profile Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <User size={18} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Profile
          </h2>
        </div>
        <div className="flex items-center gap-4">
          {user?.image ? (
            <Image
              src={user.image}
              alt={user.name || "User"}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full ring-2 ring-[var(--border)]"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-500/10 text-accent-500 font-semibold text-lg">
              {user?.name?.[0] || "U"}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {user?.email || "No email"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Connected via Google OAuth (read-only)
            </p>
          </div>
        </div>
      </Card>

      {/* Appearance Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Palette size={18} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Appearance
          </h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon size={16} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              ) : (
                <Sun size={16} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
              )}
              <div>
                <p className="text-sm text-[var(--text-primary)]">Theme</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {theme === "dark" ? "Dark mode" : "Light mode"}
                </p>
              </div>
            </div>
            <Toggle
              checked={theme === "dark"}
              onChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </div>
        </div>
      </Card>

      {/* AI Preferences Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles size={18} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            AI Preferences
          </h2>
        </div>
        <div className="space-y-5">
          {/* Tone selector */}
          <div>
            <p className="text-sm text-[var(--text-primary)] mb-2">AI Tone</p>
            <div className="flex gap-2">
              {(["professional", "casual", "friendly"] as AiTone[]).map(
                (tone) => (
                  <button
                    key={tone}
                    onClick={() => updateAiTone(tone)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                      aiTone === tone
                        ? "bg-accent-500 text-white"
                        : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {tone}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Suggestions toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)]">
                AI Suggestions
              </p>
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                Show AI-powered suggestions throughout the app
              </p>
            </div>
            <Toggle
              checked={aiSuggestions}
              onChange={updateAiSuggestions}
            />
          </div>

          {/* Proactive notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)]">
                Proactive Notifications
              </p>
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                Let AI proactively suggest actions and reminders
              </p>
            </div>
            <Toggle
              checked={proactiveNotifs}
              onChange={updateProactiveNotifs}
            />
          </div>

          {/* Auto-Pilot mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Zap size={16} strokeWidth={1.5} className="text-accent-500" />
              <div>
                <p className="text-sm text-[var(--text-primary)]">
                  Auto-Pilot Mode
                </p>
                <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                  {autopilotMode === "full_auto"
                    ? "Full Auto: AI plans and executes automatically"
                    : "Ask Permission: AI shows plan for your approval"}
                </p>
              </div>
            </div>
            <Toggle
              checked={autopilotMode === "full_auto"}
              onChange={updateAutopilotMode}
            />
          </div>
        </div>
      </Card>

      {/* Integrations Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Link2 size={18} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Integrations
          </h2>
        </div>
        <div className="space-y-4">
          {/* Gmail Integration Toggle */}
          <div className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                <Mail size={18} strokeWidth={1.5} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Gmail Integration
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Scan inbox for action items and create tasks from emails
                </p>
              </div>
            </div>
            <Toggle
              checked={gmailEnabled}
              onChange={toggleGmailEnabled}
            />
          </div>

          {/* Google Slides Integration Toggle */}
          <div className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <FileText size={18} strokeWidth={1.5} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Google Slides
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Generate presentations from task context using AI
                </p>
              </div>
            </div>
            <Toggle
              checked={slidesEnabled}
              onChange={toggleSlidesEnabled}
            />
          </div>

          {/* Spotify Integration */}
          <div className="rounded-lg bg-[var(--bg-tertiary)] px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Music size={18} strokeWidth={1.5} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Spotify
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {spotifyConnected ? "Connected - Mini player active" : "Connect for focus music player"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {spotifyConnected && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500 mr-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                )}
                <button
                  onClick={toggleSpotifyConnection}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    spotifyConnected
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                  }`}
                >
                  {spotifyConnected ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>

            {/* Playlist URL input */}
            {spotifyConnected && (
              <div className="pl-11">
                <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                  Custom Playlist URL
                </label>
                <input
                  type="text"
                  value={spotifyPlaylistUrl}
                  onChange={(e) => handlePlaylistUrlChange(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  className="w-full rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Paste a Spotify playlist URL for the focus music mini-player
                </p>
              </div>
            )}
          </div>

          {/* Google Account (always connected via OAuth) */}
          <div className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Google Account
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {user?.email || "Not connected"}
                </p>
              </div>
            </div>
            <CheckCircle2 size={16} strokeWidth={1.5} className="text-emerald-500" />
          </div>

          {["Calendar", "Tasks"].map((service) => (
            <div
              key={service}
              className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Calendar size={18} strokeWidth={1.5} className="text-blue-500" />
                </div>
                <p className="text-sm text-[var(--text-primary)]">{service}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Notifications Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell size={18} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Notifications
          </h2>
        </div>
        <div className="space-y-4">
          {/* Email Deadline Reminders */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)]">
                Email Deadline Reminders
              </p>
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                Receive an email reminder 4 hours before task deadlines
              </p>
            </div>
            <Toggle
              checked={emailDeadlineReminders}
              onChange={(val) =>
                updateNotificationPref("chronai-email-deadline-reminders", val, setEmailDeadlineReminders)
              }
            />
          </div>

          {/* Daily Digest */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)]">
                Daily Digest Email
              </p>
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                Get a morning summary of your tasks and schedule for the day
              </p>
            </div>
            <Toggle
              checked={dailyDigest}
              onChange={(val) =>
                updateNotificationPref("chronai-daily-digest", val, setDailyDigest)
              }
            />
          </div>

          {/* Weekly Review */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)]">
                Weekly Review Email
              </p>
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                Receive a weekly productivity review with insights and trends
              </p>
            </div>
            <Toggle
              checked={weeklyReview}
              onChange={(val) =>
                updateNotificationPref("chronai-weekly-review", val, setWeeklyReview)
              }
            />
          </div>
        </div>
      </Card>

      {/* Keyboard Shortcuts Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Keyboard size={18} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Keyboard Shortcuts
          </h2>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-4 py-3"
            >
              <span className="text-sm text-[var(--text-primary)]">
                {s.description}
              </span>
              <kbd className="rounded-md bg-[var(--surface-hover)] px-2.5 py-1 text-xs font-mono text-[var(--text-secondary)] border border-[var(--border)]">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
