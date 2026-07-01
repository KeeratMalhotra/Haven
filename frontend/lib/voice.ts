/**
 * Voice utilities for Haven.
 * - Speech-to-text (STT) via MediaRecorder capture + backend Google Cloud
 *   Speech-to-Text. This replaces the browser Web Speech API
 *   (webkitSpeechRecognition), which depends on Google's private speech
 *   endpoint and throws "network" errors on non-Chrome browsers
 *   (Brave / Arc / Electron, etc.).
 * - Audio playback for base64-encoded TTS responses from the backend
 *   (used for the AI "talk back").
 * - Shared audio element for analyzer integration.
 */

import { getApiBase } from "./api";

/**
 * Persistent audio element used for TTS playback.
 * Exposed so the AudioAnalyzer can connect to it and
 * visualize voice output through the particle system.
 */
let sharedAudioElement: HTMLAudioElement | null = null;

/**
 * Get or create the shared audio element used for voice playback.
 * This element is reused across playback calls so the AudioAnalyzer
 * only needs to connect once.
 */
export function getVoiceAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioElement) {
    sharedAudioElement = new Audio();
  }
  return sharedAudioElement;
}

/* -------------------------------------------------------------------------- */
/*  Speech-to-Text (record -> upload -> transcribe)                            */
/* -------------------------------------------------------------------------- */

/**
 * Whether the current browser can record microphone audio for STT.
 * Requires getUserMedia and MediaRecorder, both widely supported across
 * Chromium-based browsers, Firefox, and recent Safari.
 */
export function isRecordingSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof window.MediaRecorder !== "undefined"
  );
}

/**
 * Pick the best MediaRecorder mime type supported by this browser and map it
 * to the matching Google Cloud Speech-to-Text encoding.
 */
function pickRecordingMime(): { mimeType: string; encoding: string } {
  const candidates: Array<{ mimeType: string; encoding: string }> = [
    { mimeType: "audio/webm;codecs=opus", encoding: "WEBM_OPUS" },
    { mimeType: "audio/webm", encoding: "WEBM_OPUS" },
    { mimeType: "audio/ogg;codecs=opus", encoding: "OGG_OPUS" },
  ];
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
    }
  }
  // Fall back to the most common Chromium default.
  return { mimeType: "", encoding: "WEBM_OPUS" };
}

/**
 * Convert a Blob to a base64 string (without the data: URL prefix).
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // result looks like "data:audio/webm;base64,XXXX" — strip the prefix.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read audio data"));
    reader.readAsDataURL(blob);
  });
}

interface ActiveRecording {
  stop: () => void;
  cancelled: boolean;
}

/** Module-level handle to the in-progress recording, enabling manual stop. */
let activeRecording: ActiveRecording | null = null;

// Silence-detection tuning.
const SILENCE_RMS_THRESHOLD = 0.015; // below this is treated as "quiet"
const SILENCE_HANG_MS = 1500; // stop after this much continuous silence
const MAX_RECORDING_MS = 15000; // hard cap so a stuck mic can't run forever
const MIN_SPEECH_MS = 400; // require a little speech before silence can stop

/**
 * Send recorded audio to the backend for transcription.
 */
async function transcribeAudio(
  base64Audio: string,
  encoding: string,
  authToken?: string
): Promise<string> {
  const res = await fetch(`${getApiBase()}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_base64: base64Audio,
      encoding,
      language: "en-US",
      auth_token: authToken || "",
    }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("auth: session expired, please sign in again");
    }
    throw new Error(`transcription failed (${res.status})`);
  }

  const data = (await res.json()) as { transcript?: string };
  return (data.transcript || "").trim();
}

/**
 * Stop the current recording, if any. Resolves the pending startListening()
 * promise with whatever has been captured so far.
 */
export function stopListening(): void {
  if (activeRecording) activeRecording.stop();
}

/**
 * Cancel the current recording without transcribing (used when the user
 * leaves voice mode mid-recording).
 */
export function cancelListening(): void {
  if (activeRecording) {
    activeRecording.cancelled = true;
    activeRecording.stop();
  }
}

/**
 * Options for {@link startListening}.
 */
export interface StartListeningOptions {
  /**
   * Called on every analyser frame with the live microphone amplitude,
   * mapped into a perceptual 0..1 range. Useful for driving an
   * audio-reactive UI (e.g. a glowing orb that swells with the voice).
   * Emits 0 once when recording stops so the UI can settle.
   */
  onLevel?: (level: number) => void;
}

/**
 * Capture microphone audio and transcribe it via the backend Google Cloud
 * Speech-to-Text endpoint. Recording stops automatically after a short period
 * of silence (hands-free), when the max duration is hit, or when
 * stopListening() is called.
 *
 * @param authToken Optional Google OAuth token forwarded to the backend.
 * @param options   Optional callbacks, e.g. {@link StartListeningOptions.onLevel}
 *                  for live microphone amplitude. The first positional
 *                  `authToken` argument is preserved for existing call sites.
 * @returns The recognized transcript (empty string if nothing was heard).
 */
export function startListening(
  authToken?: string,
  options?: StartListeningOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Recording not available on server"));
      return;
    }
    if (!isRecordingSupported()) {
      reject(new Error("Audio recording is not supported in this browser"));
      return;
    }

    const { mimeType, encoding } = pickRecordingMime();

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(
            stream,
            mimeType ? { mimeType } : undefined
          );
        } catch {
          recorder = new MediaRecorder(stream);
        }

        const chunks: BlobPart[] = [];
        let stopped = false;
        const state: ActiveRecording = { stop: () => {}, cancelled: false };
        activeRecording = state;

        // --- Silence detection via Web Audio analyser ---
        let audioCtx: AudioContext | null = null;
        let analyser: AnalyserNode | null = null;
        let silenceTimer: ReturnType<typeof setTimeout> | null = null;
        let maxTimer: ReturnType<typeof setTimeout> | null = null;
        let rafId: number | null = null;
        const startedAt = Date.now();
        let sawSpeech = false;

        const cleanupAnalysis = () => {
          if (silenceTimer) clearTimeout(silenceTimer);
          if (maxTimer) clearTimeout(maxTimer);
          if (rafId !== null) cancelAnimationFrame(rafId);
          silenceTimer = null;
          maxTimer = null;
          rafId = null;
          // Let the UI settle its audio-reactive visuals back to rest.
          if (options?.onLevel) {
            try {
              options.onLevel(0);
            } catch {
              /* no-op */
            }
          }
          if (audioCtx && audioCtx.state !== "closed") {
            audioCtx.close().catch(() => {});
          }
        };

        const doStop = () => {
          if (stopped) return;
          stopped = true;
          cleanupAnalysis();
          if (recorder.state !== "inactive") {
            try {
              recorder.stop();
            } catch {
              /* no-op */
            }
          }
        };
        state.stop = doStop;

        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as Record<string, unknown>)
              .webkitAudioContext;
          if (AudioCtx) {
            audioCtx = new (AudioCtx as typeof AudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            const data = new Uint8Array(analyser.fftSize);

            const tick = () => {
              if (stopped || !analyser) return;
              analyser.getByteTimeDomainData(data);
              // Compute RMS amplitude around the 128 midpoint.
              let sum = 0;
              for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v * v;
              }
              const rms = Math.sqrt(sum / data.length);
              const elapsed = Date.now() - startedAt;

              // Surface the live amplitude to the UI. RMS is typically
              // ~0.02–0.3 for speech, so map it into a perceptual 0..1 range.
              if (options?.onLevel) {
                try {
                  options.onLevel(Math.min(1, rms * 2.8));
                } catch {
                  /* callback errors must not break recording */
                }
              }

              if (rms > SILENCE_RMS_THRESHOLD) {
                if (elapsed > MIN_SPEECH_MS) sawSpeech = true;
                if (silenceTimer) {
                  clearTimeout(silenceTimer);
                  silenceTimer = null;
                }
              } else if (sawSpeech && !silenceTimer) {
                // Quiet after some speech -> arm the auto-stop timer.
                silenceTimer = setTimeout(doStop, SILENCE_HANG_MS);
              }
              rafId = requestAnimationFrame(tick);
            };
            rafId = requestAnimationFrame(tick);
          }
        } catch {
          // Analyser is best-effort; without it we still rely on the max timer
          // and manual stop.
        }

        // Hard cap on recording length.
        maxTimer = setTimeout(doStop, MAX_RECORDING_MS);

        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onerror = () => {
          cleanupAnalysis();
          activeRecording = null;
          stream.getTracks().forEach((t) => t.stop());
          reject(new Error("Recording failed"));
        };

        recorder.onstop = async () => {
          cleanupAnalysis();
          stream.getTracks().forEach((t) => t.stop());
          const wasCancelled = state.cancelled;
          activeRecording = null;

          if (wasCancelled) {
            resolve("");
            return;
          }

          try {
            const blob = new Blob(chunks, {
              type: recorder.mimeType || mimeType || "audio/webm",
            });
            if (blob.size === 0) {
              resolve("");
              return;
            }
            const base64 = await blobToBase64(blob);
            const transcript = await transcribeAudio(base64, encoding, authToken);
            resolve(transcript);
          } catch (err) {
            reject(err);
          }
        };

        // Start recording; collect data in 250ms timeslices so chunks exist
        // even for very short utterances.
        recorder.start(250);
      })
      .catch((err: unknown) => {
        activeRecording = null;
        const name =
          err instanceof DOMException ? err.name : (err as Error)?.message;
        if (
          name === "NotAllowedError" ||
          name === "SecurityError" ||
          name === "PermissionDeniedError"
        ) {
          reject(new Error("not-allowed: microphone permission denied"));
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          reject(new Error("no-mic: no microphone was found"));
        } else {
          reject(new Error("Could not access the microphone"));
        }
      });
  });
}

/* -------------------------------------------------------------------------- */
/*  Text-to-Speech playback (AI "talk back")                                   */
/* -------------------------------------------------------------------------- */

/**
 * Play base64-encoded audio data (from backend TTS).
 * Uses the shared audio element so the AudioAnalyzer can
 * visualize the voice output through the particle system.
 * Supports common audio formats (mp3, wav, ogg).
 */
export async function playAudioBase64(
  base64Audio: string,
  format = "audio/mp3"
): Promise<void> {
  if (typeof window === "undefined") return;

  const audioData = atob(base64Audio);
  const arrayBuffer = new ArrayBuffer(audioData.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < audioData.length; i++) {
    view[i] = audioData.charCodeAt(i);
  }

  const blob = new Blob([arrayBuffer], { type: format });
  const url = URL.createObjectURL(blob);

  const audio = getVoiceAudioElement();
  if (!audio) return;

  return new Promise<void>((resolve, reject) => {
    // Clean up previous object URL if any
    const previousSrc = audio.src;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to play audio"));
    };

    audio.src = url;
    audio.play().catch((err) => {
      URL.revokeObjectURL(url);
      reject(err);
    });

    // Revoke the old URL after setting the new one
    if (previousSrc && previousSrc.startsWith("blob:")) {
      URL.revokeObjectURL(previousSrc);
    }
  });
}

/**
 * Create an AudioContext for audio analysis (used by AudioAnalyzer).
 */
export function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as Record<string, unknown>).webkitAudioContext;

  if (!AudioContextClass) return null;

  return new (AudioContextClass as typeof AudioContext)();
}
