"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
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
  CheckCheck,
  Globe,
  Save,
  Camera,
} from "lucide-react";

import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { MemorySection } from "@/components/memory/MemorySection";
import { useTheme } from "@/components/ui/theme-provider";
import {
  fetchPreferences,
  updatePreferences,
  fetchIntegrationStatus,
  connectService,
  disconnectService,
  updateProfile,
  type IntegrationStatus,
} from "@/lib/api-extended";

type AiTone = "professional" | "casual" | "friendly";

const SHORTCUTS = [
  { keys: "Cmd + K", description: "Open Command Palette" },
  { keys: "Cmd + B", description: "Toggle Sidebar" },
  { keys: "Cmd + /", description: "AI Chat" },
  { keys: "Escape", description: "Close panels" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const GOOGLE_SERVICES = [
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Manage events and scheduling",
    icon: Calendar,
    color: "blue",
  },
  {
    id: "tasks",
    name: "Google Tasks",
    description: "Create and manage task lists",
    icon: CheckCheck,
    color: "blue",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Scan inbox for action items and send emails",
    icon: Mail,
    color: "red",
  },
  {
    id: "slides",
    name: "Google Slides",
    description: "Generate presentations from task context",
    icon: FileText,
    color: "amber",
  },
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

/**
 * Flush offline queues when a previously-disconnected service is reconnected.
 * Compares prev and next integration status and flushes the appropriate queue.
 */
function flushQueuesOnReconnect(
  prev: IntegrationStatus,
  next: IntegrationStatus
) {
  // Tasks queue flush
  const wasTasksDisconnected = !prev?.tasks?.connected;
  const isTasksConnected = next?.tasks?.connected;
  if (wasTasksDisconnected && isTasksConnected) {
    try {
      const queue = JSON.parse(localStorage.getItem("chronai-task-queue") || "[]");
      if (queue.length > 0) {
        // Clear the queue immediately - the operations were already applied locally
        localStorage.removeItem("chronai-task-queue");
      }
    } catch {
      localStorage.removeItem("chronai-task-queue");
    }
  }

  // Calendar queue flush
  const wasCalendarDisconnected = !prev?.calendar?.connected;
  const isCalendarConnected = next?.calendar?.connected;
  if (wasCalendarDisconnected && isCalendarConnected) {
    try {
      const queue = JSON.parse(localStorage.getItem("chronai-calendar-queue") || "[]");
      if (queue.length > 0) {
        // Clear the queue immediately - the operations were already applied locally
        localStorage.removeItem("chronai-calendar-queue");
      }
    } catch {
      localStorage.removeItem("chronai-calendar-queue");
    }
  }
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-tertiary)] dark:text-[#847e76]">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const user = session?.user;

  // AI Preferences (localStorage)
  const [aiTone, setAiTone] = useState<AiTone>("casual");
  const [aiSuggestions, setAiSuggestions] = useState(true);
  const [proactiveNotifs, setProactiveNotifs] = useState(true);
  const [autopilotMode, setAutopilotMode] = useState<"ask_permission" | "full_auto">("ask_permission");

  // Integration status (from backend) - load from cache only on client to avoid hydration mismatch
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>({});
  const [connectingService, setConnectingService] = useState<string | null>(null);
  const [disconnectingService, setDisconnectingService] = useState<string | null>(null);
  const [connectionToast, setConnectionToast] = useState<string | null>(null);

  // Load cached integration status on mount (client-only)
  useEffect(() => {
    try {
      const cached = localStorage.getItem("chronai-integration-status-cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          setIntegrationStatus(parsed);
        }
      }
    } catch {
      // Ignore invalid JSON
    }
  }, []);

  // Spotify (hybrid: backend OAuth + localStorage embed URL)
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState("");

  // Profile editing
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Custom profile picture (localStorage)
  const [customProfilePicture, setCustomProfilePicture] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error state for surfacing failures to the user
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Notification preferences (localStorage + backend)
  const [emailDeadlineReminders, setEmailDeadlineReminders] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);
  const [weeklyReview, setWeeklyReview] = useState(false);

  // Popup reference for OAuth
  const oauthPopupRef = useRef<Window | null>(null);

  // Get auth token for backend calls
  const authToken = (session as any)?.accessToken || "";

  // Load preferences on mount
  useEffect(() => {
    document.title = "Settings | Haven";
  }, []);

  useEffect(() => {
    // Load localStorage values
    const stored = localStorage.getItem("chronai-ai-tone");
    if (stored) setAiTone(stored as AiTone);

    const suggestions = localStorage.getItem("chronai-ai-suggestions");
    if (suggestions !== null) setAiSuggestions(suggestions === "true");

    const notifs = localStorage.getItem("chronai-proactive-notifs");
    if (notifs !== null) setProactiveNotifs(notifs === "true");

    const playlistUrl = localStorage.getItem("chronai-spotify-playlist-url");
    if (playlistUrl) setSpotifyPlaylistUrl(playlistUrl);

    const autopilot = localStorage.getItem("chronai-autopilot-mode");
    if (autopilot === "full_auto") setAutopilotMode("full_auto");

    // Load notification prefs from localStorage (will be overridden by backend if available)
    const emailReminders = localStorage.getItem("chronai-email-deadline-reminders");
    if (emailReminders !== null) setEmailDeadlineReminders(emailReminders === "true");

    const digest = localStorage.getItem("chronai-daily-digest");
    if (digest !== null) setDailyDigest(digest === "true");

    const review = localStorage.getItem("chronai-weekly-review");
    if (review !== null) setWeeklyReview(review === "true");

    // Load custom profile picture from localStorage
    const profilePic = localStorage.getItem("chronai-profile-picture");
    if (profilePic) setCustomProfilePicture(profilePic);
  }, []);

  // Check for ?connected= query param (OAuth redirect callback)
  useEffect(() => {
    const connectedService = searchParams.get("connected");
    if (connectedService) {
      setConnectionToast(connectedService);
      // If Spotify was connected, also update localStorage for the mini player
      if (connectedService === "spotify") {
        localStorage.setItem("chronai-spotify-connected", "true");
        dispatchStorageChange("chronai-spotify-connected", "true");
      }
      // Refetch integration status from backend to update the UI
      if (authToken) {
        fetchIntegrationStatus(authToken).then((status) => {
          setIntegrationStatus((prev) => {
            flushQueuesOnReconnect(prev, status);
            return status;
          });
          localStorage.setItem("chronai-integration-status-cache", JSON.stringify(status));
          if (status.spotify?.connected) {
            localStorage.setItem("chronai-spotify-connected", "true");
            dispatchStorageChange("chronai-spotify-connected", "true");
          }
        });
      }
      // Clear the toast after 4 seconds
      const timer = setTimeout(() => setConnectionToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, authToken]);

  // Fetch backend preferences and integration status
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
      // Load profile data from preferences
      if (data.preferences) {
        if (data.preferences.display_name) setDisplayName(data.preferences.display_name);
        if (data.preferences.timezone) setTimezone(data.preferences.timezone);
        // Quiet mode (proactive_quiet) is the inverse of proactive notifications.
        if (data.preferences.proactive_quiet !== undefined) {
          const enabled = !data.preferences.proactive_quiet;
          setProactiveNotifs(enabled);
          localStorage.setItem("chronai-proactive-notifs", String(enabled));
        }
      }
    });

    // Fetch integration status from backend (background refresh)
    fetchIntegrationStatus(authToken).then((status) => {
      // Only update state if the status actually changed to avoid re-renders
      setIntegrationStatus((prev) => {
        const prevJson = JSON.stringify(prev);
        const newJson = JSON.stringify(status);
        if (prevJson === newJson) return prev;
        return status;
      });
      // Cache integration status in localStorage
      localStorage.setItem("chronai-integration-status-cache", JSON.stringify(status));
      // Sync Spotify status with localStorage for the mini player
      if (status.spotify?.connected) {
        localStorage.setItem("chronai-spotify-connected", "true");
        dispatchStorageChange("chronai-spotify-connected", "true");
      }
    });
  }, [authToken]);

  // Re-fetch integration status when window regains focus (after OAuth popup closes)
  useEffect(() => {
    const handleFocus = () => {
      // Check connectingService state instead of popup ref - handles cases where
      // popup was blocked, opened as a new tab, or ref got cleared
      if (authToken && (oauthPopupRef.current || connectingService)) {
        setTimeout(() => {
          fetchIntegrationStatus(authToken).then((status) => {
            setIntegrationStatus((prev) => {
              // Flush queues if service was reconnected
              flushQueuesOnReconnect(prev, status);
              return status;
            });
            localStorage.setItem("chronai-integration-status-cache", JSON.stringify(status));
            if (status.spotify?.connected) {
              localStorage.setItem("chronai-spotify-connected", "true");
              dispatchStorageChange("chronai-spotify-connected", "true");
            }
            // If the service that was connecting is now connected, clear state
            if (connectingService && status[connectingService]?.connected) {
              setConnectingService(null);
              oauthPopupRef.current = null;
            }
          });
        }, 1000);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [authToken, connectingService]);

  // Poll for integration status when a service connection is in progress.
  // This handles cases where postMessage or focus events fail due to
  // cross-origin restrictions, popup blockers, or COOP headers.
  useEffect(() => {
    if (!connectingService || !authToken) return;

    let attempts = 0;
    const maxAttempts = 10; // Poll every 3s for up to 30s
    const intervalId = setInterval(() => {
      attempts++;
      fetchIntegrationStatus(authToken).then((status) => {
        setIntegrationStatus((prev) => {
          flushQueuesOnReconnect(prev, status);
          return status;
        });
        localStorage.setItem("chronai-integration-status-cache", JSON.stringify(status));
        if (status.spotify?.connected) {
          localStorage.setItem("chronai-spotify-connected", "true");
          dispatchStorageChange("chronai-spotify-connected", "true");
        }
        // If the service is now connected, stop polling and show toast
        if (connectingService && status[connectingService]?.connected) {
          setConnectingService(null);
          oauthPopupRef.current = null;
          setConnectionToast(connectingService);
          setTimeout(() => setConnectionToast(null), 4000);
          clearInterval(intervalId);
        }
      }).catch(() => {
        // Silently ignore fetch errors during polling
      });

      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        // Clear the connecting state so the button is no longer stuck in loading
        setConnectingService(null);
        oauthPopupRef.current = null;
        // Show error feedback to the user
        setIntegrationError("Connection timed out. Please try again.");
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [connectingService, authToken]);

  // Listen for postMessage from OAuth popup (popup closes itself and notifies us)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth-connected" && authToken) {
        const service = event.data.service;
        setConnectingService(null);
        oauthPopupRef.current = null;
        // Refresh integration status
        fetchIntegrationStatus(authToken).then((status) => {
          setIntegrationStatus((prev) => {
            flushQueuesOnReconnect(prev, status);
            return status;
          });
          localStorage.setItem("chronai-integration-status-cache", JSON.stringify(status));
          setConnectionToast(`${service} connected successfully!`);
          setTimeout(() => setConnectionToast(null), 3000);
          if (status.spotify?.connected) {
            localStorage.setItem("chronai-spotify-connected", "true");
            dispatchStorageChange("chronai-spotify-connected", "true");
          }
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
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
    // Mirror to the backend so the proactive engine respects quiet mode.
    // proactive_quiet is the inverse of "proactive notifications enabled".
    if (authToken) {
      updatePreferences(authToken, {
        preferences: { proactive_quiet: !val },
      }).catch(() => {
        // Non-critical; local preference still applies in the UI.
      });
    }
  };

  const updateAutopilotMode = (fullAuto: boolean) => {
    const mode = fullAuto ? "full_auto" : "ask_permission";
    setAutopilotMode(mode);
    localStorage.setItem("chronai-autopilot-mode", mode);
    dispatchStorageChange("chronai-autopilot-mode", mode);
  };

  // --- Integration handlers (real OAuth) ---
  const handleConnectService = async (service: string) => {
    if (!authToken) return;
    setConnectingService(service);
    setIntegrationError(null);
    try {
      const { auth_url } = await connectService(authToken, service);
      // Open OAuth popup
      const popup = window.open(auth_url, "_blank", "width=600,height=700,popup=yes");
      oauthPopupRef.current = popup;
    } catch {
      setIntegrationError(`Failed to connect ${service}. Please try again.`);
      setConnectingService(null);
    }
  };

  const handleDisconnectService = async (service: string) => {
    if (!authToken) return;
    setDisconnectingService(service);
    setIntegrationError(null);
    try {
      await disconnectService(authToken, service);
      setIntegrationStatus((prev) => ({
        ...prev,
        [service]: { connected: false, scopes: [] },
      }));
    } catch {
      setIntegrationError(`Failed to disconnect ${service}. Please try again.`);
    } finally {
      setDisconnectingService(null);
    }
  };

  const handlePlaylistUrlChange = (url: string) => {
    setSpotifyPlaylistUrl(url);
    localStorage.setItem("chronai-spotify-playlist-url", url);
    dispatchStorageChange("chronai-spotify-playlist-url", url);
    window.dispatchEvent(new CustomEvent("chronai-playlist-changed", { detail: { url } }));
  };

  // --- Profile picture handlers ---
  const [profilePictureError, setProfilePictureError] = useState<string | null>(null);

  const handleProfilePictureSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePictureError(null);

    // Size guard: max 2MB to avoid exceeding localStorage quota
    const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE_BYTES) {
      setProfilePictureError("Image must be under 2MB. Please choose a smaller file.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setCustomProfilePicture(base64);
      try {
        localStorage.setItem("chronai-profile-picture", base64);
      } catch {
        // Handle QuotaExceededError gracefully
        setProfilePictureError("Failed to save image. File may be too large for local storage.");
      }
    };
    reader.readAsDataURL(file);
    // Reset input value so the same file can be selected again
    e.target.value = "";
  };

  const handleRemoveProfilePicture = () => {
    setCustomProfilePicture(null);
    localStorage.removeItem("chronai-profile-picture");
  };

  // --- Profile handlers ---
  const handleSaveProfile = async () => {
    if (!authToken) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      await updateProfile(authToken, { name: displayName, timezone });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      setProfileError("Failed to save profile. Please try again.");
    } finally {
      setProfileSaving(false);
    }
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

  // Count connected services
  const connectedCount = Object.values(integrationStatus).filter(
    (s) => s.connected
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-8"
    >
      {/* Connection Toast */}
      {connectionToast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-500"
        >
          <CheckCircle2 size={16} strokeWidth={1.5} />
          <span className="capitalize">{connectionToast}</span> connected successfully!
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-500/10">
          <Settings size={20} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
        </div>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--text-primary)] dark:text-[#ece9e4]">
          Settings
        </h1>
      </div>

      {/* Profile Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <User size={18} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
            Profile
          </h2>
        </div>
        <div className="space-y-5">
          {/* User info row */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              {customProfilePicture ? (
                <Image
                  src={customProfilePicture}
                  alt={user?.name || "User"}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full ring-2 ring-[var(--border)] object-cover"
                />
              ) : user?.image ? (
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
              {/* Change Photo overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Change photo"
              >
                <Camera size={18} strokeWidth={1.5} className="text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureSelect}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
                {user?.email || "No email"}
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
                {connectedCount} service{connectedCount !== 1 ? "s" : ""} connected
              </p>
              {customProfilePicture && (
                <button
                  onClick={handleRemoveProfilePicture}
                  className="mt-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove photo
                </button>
              )}
              {profilePictureError && (
                <p className="mt-1 text-xs text-red-500">{profilePictureError}</p>
              )}
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={user?.name || "Your name"}
                className="w-full rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] dark:text-[#ece9e4] placeholder:text-[var(--text-tertiary)] dark:text-[#847e76] focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Globe size={12} strokeWidth={1.5} />
                  Timezone
                </span>
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] dark:text-[#ece9e4] focus:outline-none focus:ring-1 focus:ring-accent-500 appearance-none"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 transition-colors disabled:opacity-50"
            >
              <Save size={14} strokeWidth={1.5} />
              {profileSaving ? "Saving..." : "Save Profile"}
            </button>
            {profileSaved && (
              <span className="text-xs text-emerald-500 font-medium">
                Profile saved!
              </span>
            )}
            {profileError && (
              <span className="text-xs text-red-500 font-medium">
                {profileError}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Appearance Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Palette size={18} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
            Appearance
          </h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon size={16} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
              ) : (
                <Sun size={16} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
              )}
              <div>
                <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">Theme</p>
                <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
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
          <Sparkles size={18} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
            AI Preferences
          </h2>
        </div>
        <div className="space-y-5">
          {/* Tone selector */}
          <div>
            <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4] mb-2">AI Tone</p>
            <div className="flex gap-2">
              {(["professional", "casual", "friendly"] as AiTone[]).map(
                (tone) => (
                  <button
                    key={tone}
                    onClick={() => updateAiTone(tone)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                      aiTone === tone
                        ? "bg-accent-500 text-white"
                        : "bg-[var(--surface-hover)] text-[var(--text-secondary)] dark:text-[#a8a39c] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4]"
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
              <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
                AI Suggestions
              </p>
              <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] leading-relaxed">
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
              <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
                Proactive Notifications
              </p>
              <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] leading-relaxed">
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
                <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
                  Auto-Pilot Mode
                </p>
                <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] leading-relaxed">
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

      {/* What Haven knows about you (Sprint 11: persistent memory) */}
      <MemorySection authToken={authToken} />

      {/* Integrations Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Link2 size={18} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
            Integrations
          </h2>
        </div>
        {integrationError && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-500">
            {integrationError}
          </div>
        )}
        <div className="space-y-4">
          {/* Google Account (always connected via login OAuth) */}
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
                <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
                  Google Account
                </p>
                <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
                  {user?.email || "Not connected"}
                </p>
              </div>
            </div>
            <CheckCircle2 size={16} strokeWidth={1.5} className="text-emerald-500" />
          </div>

          {/* Google Services with real Connect/Disconnect */}
          {GOOGLE_SERVICES.map((service) => {
            const status = integrationStatus[service.id];
            const isConnected = status?.connected ?? false;
            const isLoading = connectingService === service.id || disconnectingService === service.id;
            const IconComponent = service.icon;
            const colorClass = service.color === "blue"
              ? "text-blue-500"
              : service.color === "red"
              ? "text-red-500"
              : "text-amber-500";
            const bgClass = service.color === "blue"
              ? "bg-blue-500/10"
              : service.color === "red"
              ? "bg-red-500/10"
              : "bg-amber-500/10";

            return (
              <div
                key={service.id}
                className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgClass}`}>
                    <IconComponent size={18} strokeWidth={1.5} className={colorClass} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
                      {service.name}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
                      {service.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500 mr-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Connected
                    </span>
                  )}
                  {!isConnected && !isLoading && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)] dark:text-[#847e76] mr-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      Not Connected
                    </span>
                  )}
                  <button
                    onClick={() =>
                      isConnected
                        ? handleDisconnectService(service.id)
                        : handleConnectService(service.id)
                    }
                    disabled={isLoading}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      isConnected
                        ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                        : "bg-accent-500/10 text-accent-500 hover:bg-accent-500/20"
                    }`}
                  >
                    {isLoading ? "..." : isConnected ? "Disconnect" : "Connect"}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Spotify Integration (embed approach - no OAuth needed) */}
          <div className="rounded-lg bg-[var(--bg-tertiary)] px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Music size={18} strokeWidth={1.5} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
                  Spotify
                </p>
                <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
                  Paste a Spotify playlist URL for your focus music
                </p>
              </div>
            </div>

            {/* Playlist URL input (always shown) */}
            <div className="pl-11 space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] dark:text-[#a8a39c] mb-1.5">
                  Playlist URL
                </label>
                <input
                  type="text"
                  value={spotifyPlaylistUrl}
                  onChange={(e) => handlePlaylistUrlChange(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  className="w-full rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] dark:text-[#ece9e4] placeholder:text-[var(--text-tertiary)] dark:text-[#847e76] focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
                <p className="mt-1 text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
                  The mini player will appear once you set a playlist URL
                </p>
              </div>

              {/* Suggested playlists */}
              <div>
                <label className="block text-xs text-[var(--text-secondary)] dark:text-[#a8a39c] mb-1.5">
                  Suggested Playlists
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handlePlaylistUrlChange("https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn")}
                    className="rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4] hover:border-accent-500/30 transition-colors"
                  >
                    Lo-fi Beats
                  </button>
                  <button
                    onClick={() => handlePlaylistUrlChange("https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ")}
                    className="rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4] hover:border-accent-500/30 transition-colors"
                  >
                    Deep Focus
                  </button>
                  <button
                    onClick={() => handlePlaylistUrlChange("https://open.spotify.com/playlist/37i9dQZF1DX3rxVfibe1L0")}
                    className="rounded-lg bg-[var(--surface-hover)] border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4] hover:border-accent-500/30 transition-colors"
                  >
                    Classical Focus
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Notifications Section */}
      <Card hover={false} className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell size={18} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
            Notifications
          </h2>
        </div>
        <div className="space-y-4">
          {/* Email Deadline Reminders */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
                Email Deadline Reminders
              </p>
              <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] leading-relaxed">
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
              <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
                Daily Digest Email
              </p>
              <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] leading-relaxed">
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
              <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
                Weekly Review Email
              </p>
              <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] leading-relaxed">
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
          <Keyboard size={18} strokeWidth={1.5} className="text-[var(--text-secondary)] dark:text-[#a8a39c]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
            Keyboard Shortcuts
          </h2>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between rounded-lg bg-[var(--bg-tertiary)] px-4 py-3"
            >
              <span className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
                {s.description}
              </span>
              <kbd className="rounded-md bg-[var(--surface-hover)] px-2.5 py-1 text-xs font-mono text-[var(--text-secondary)] dark:text-[#a8a39c] border border-[var(--border)]">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
