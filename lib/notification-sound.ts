import { Platform } from "react-native";

/**
 * Notification sound utility using Web Audio API.
 * Generates synthetic alert tones without needing audio files.
 */

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

/**
 * Play a sequence of tones to create an alert sound.
 */
function playTones(
  frequencies: number[],
  durations: number[],
  volume: number = 0.3,
  type: OscillatorType = "sine"
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
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

/**
 * New order alert - attention-grabbing ascending chime (plays twice)
 */
export function playNewOrderSound() {
  if (Platform.OS !== "web") return;

  // First chime
  playTones(
    [523, 659, 784, 1047],  // C5, E5, G5, C6 - ascending major chord
    [0.15, 0.15, 0.15, 0.3],
    0.35,
    "sine"
  );

  // Second chime after a short pause
  setTimeout(() => {
    playTones(
      [523, 659, 784, 1047],
      [0.15, 0.15, 0.15, 0.3],
      0.35,
      "sine"
    );
  }, 1000);
}

/**
 * Driver arrived alert - two quick pings
 */
export function playDriverArrivedSound() {
  if (Platform.OS !== "web") return;

  playTones(
    [880, 1100],  // A5, ~C#6 - two quick high pings
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
    [660],  // E5 - single soft note
    [0.15],
    0.2,
    "sine"
  );
}
