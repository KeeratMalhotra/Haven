/**
 * Voice utilities for ChronAI.
 * - Web Speech API for speech-to-text (STT)
 * - Audio playback for base64-encoded TTS responses from backend
 * - Shared audio element for analyzer integration
 */

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

/**
 * Start listening via Web Speech API.
 * Returns a promise that resolves with the transcript string.
 */
export function startListening(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Speech recognition not available on server"));
      return;
    }

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; // eslint-disable-line

    if (!SpeechRecognitionAPI) {
      reject(new Error("Speech recognition not supported in this browser"));
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let resolved = false;

    recognition.onresult = (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
      resolved = true;
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };

    recognition.onerror = (event: { error: string }) => {
      resolved = true;
      reject(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.onend = () => {
      // If no result was captured, resolve with empty string
      if (!resolved) {
        resolve("");
      }
    };

    recognition.start();
  });
}

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
