/**
 * Alert sound for refused scans (block list / defaulter): public/sounds/scan-error.mp3.
 * Played right after a scanner keystroke, so the browser allows audio. If the file can't be
 * played (missing file, autoplay policy), a short synthesized double-beep is used instead.
 * Audio is a nice-to-have and must never break scanning.
 */
const SOUND_URL = '/sounds/scan-error.mp3';

let audio: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;

function fallbackBeep(): void {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime;
    [0, 0.28].forEach(offset => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'square';
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02);
      gain.gain.setValueAtTime(0.35, start + offset + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.24);
    });
  } catch {
    /* ignore */
  }
}

/** Call once when a session page opens so the first alert plays without delay. */
export function preloadErrorBeep(): void {
  try {
    if (!audio) {
      audio = new Audio(SOUND_URL);
      audio.preload = 'auto';
    }
  } catch {
    /* ignore */
  }
}

export function playErrorBeep(): void {
  try {
    preloadErrorBeep();
    if (!audio) { fallbackBeep(); return; }
    audio.currentTime = 0;
    audio.volume = 1;
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => fallbackBeep());
  } catch {
    fallbackBeep();
  }
}
