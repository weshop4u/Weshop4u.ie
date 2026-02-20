import { Platform } from "react-native";

/**
 * Notification sound utility.
 * - Web: Uses HTML5 Audio API with the actual alarm MP3 file
 * - Native: Uses expo-audio (handled separately in components)
 * 
 * Also provides a persistent looping alarm manager for urgent alerts
 * (new orders on store screen, new offers on driver screen).
 */

// ============================================================
// Web Audio Context (for synthetic tones as fallback)
// ============================================================
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== "web") return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported");
      return null;
    }
  }
  return audioContext;
}

function playTones(
  frequencies: number[],
  durations: number[],
  volume: number = 0.3,
  type: OscillatorType = "sine"
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume();
  }

  let startTime = ctx.currentTime;

  frequencies.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, startTime);

    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + durations[i]);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + durations[i]);

    startTime += durations[i];
  });
}

// ============================================================
// Persistent Looping Alarm (Web) — uses HTML5 Audio for the MP3
// ============================================================
const ALARM_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

let webAlarmAudio: HTMLAudioElement | null = null;
let webAlarmInterval: ReturnType<typeof setInterval> | null = null;
let webAlarmActive = false;

/**
 * Start a persistent looping alarm on web.
 * The alarm sound plays immediately and repeats every `intervalMs` milliseconds
 * until stopWebAlarm() is called.
 */
export function startWebAlarm(intervalMs: number = 8000) {
  if (Platform.OS !== "web") return;
  if (webAlarmActive) return; // Already playing
  
  webAlarmActive = true;

  try {
    if (!webAlarmAudio) {
      webAlarmAudio = new Audio(ALARM_SOUND_URL);
      webAlarmAudio.volume = 0.8;
    }

    // Play immediately
    webAlarmAudio.currentTime = 0;
    webAlarmAudio.play().catch(() => {
      // Browser may block autoplay — user interaction needed
      console.log("[WebAlarm] Autoplay blocked, will retry on next interval");
    });

    // Repeat at interval
    webAlarmInterval = setInterval(() => {
      if (webAlarmAudio && webAlarmActive) {
        webAlarmAudio.currentTime = 0;
        webAlarmAudio.play().catch(() => {});
      }
    }, intervalMs);
  } catch (e) {
    console.warn("[WebAlarm] Failed to start:", e);
  }
}

/**
 * Stop the persistent looping alarm on web.
 */
export function stopWebAlarm() {
  if (Platform.OS !== "web") return;
  
  webAlarmActive = false;
  
  if (webAlarmInterval) {
    clearInterval(webAlarmInterval);
    webAlarmInterval = null;
  }
  
  if (webAlarmAudio) {
    webAlarmAudio.pause();
    webAlarmAudio.currentTime = 0;
  }
}

/**
 * Check if the web alarm is currently active.
 */
export function isWebAlarmActive(): boolean {
  return webAlarmActive;
}

// ============================================================
// One-shot sound effects (web only, for non-urgent alerts)
// ============================================================

/**
 * New order alert - plays the classic alarm sound once on web.
 * For persistent alerts, use startWebAlarm() instead.
 */
export function playNewOrderSound() {
  if (Platform.OS !== "web") return;

  try {
    const audio = new Audio(ALARM_SOUND_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {
      // Fallback to synthetic tones if audio file fails
      playTones(
        [523, 659, 784, 1047],
        [0.15, 0.15, 0.15, 0.3],
        0.35,
        "sine"
      );
    });
  } catch (e) {
    // Fallback to synthetic tones
    playTones(
      [523, 659, 784, 1047],
      [0.15, 0.15, 0.15, 0.3],
      0.35,
      "sine"
    );
  }
}

/**
 * Driver arrived alert - two quick pings
 */
export function playDriverArrivedSound() {
  if (Platform.OS !== "web") return;

  playTones(
    [880, 1100],
    [0.2, 0.3],
    0.3,
    "sine"
  );
}

/**
 * New chat message alert - single soft ping
 */
export function playChatMessageSound() {
  if (Platform.OS !== "web") return;

  playTones(
    [660],
    [0.15],
    0.2,
    "sine"
  );
}
