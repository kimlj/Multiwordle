// Sound and vibration utilities

// Audio context for generating sounds
let audioContext = null;
let isAudioUnlocked = false;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// Vibrate if supported
export function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// Initialize audio on user interaction (required for mobile)
// Call this on first touch/click in the app
export function initAudio() {
  if (isAudioUnlocked) return;

  try {
    const ctx = getAudioContext();

    // Resume if suspended
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Play a silent sound to unlock audio
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime); // Silent
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.001);

    isAudioUnlocked = true;
    console.log('Audio unlocked for notifications');
  } catch (e) {
    console.warn('Could not init audio:', e);
  }
}

// Generate a notification beep sound
export function playNudgeSound() {
  try {
    const ctx = getAudioContext();

    // Resume context if suspended (required for mobile)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Two-tone alert sound
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2); // A5

    oscillator.type = 'sine';

    // Quick fade in/out
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.25);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);

    // Vibrate pattern: short-pause-short
    vibrate([100, 50, 100]);
  } catch (e) {
    console.warn('Could not play nudge sound:', e);
  }
}

// Generate a pleasant "ding" for solve notification
export function playSolveSound() {
  try {
    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Pleasant rising ding
    oscillator.frequency.setValueAtTime(523, ctx.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + 0.1); // G5

    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);

    // Short vibrate
    vibrate(50);
  } catch (e) {
    console.warn('Could not play solve sound:', e);
  }
}

// Play the wow sound file (for special occasions)
let wowAudio = null;
export function playWowSound() {
  try {
    if (!wowAudio) {
      wowAudio = new Audio(new URL('../sound/omgwow.mp3', import.meta.url).href);
      wowAudio.volume = 0.5;
    }
    wowAudio.currentTime = 0;
    wowAudio.play().catch(() => {});

    // Long vibrate
    vibrate([100, 50, 200]);
  } catch (e) {
    console.warn('Could not play wow sound:', e);
  }
}
