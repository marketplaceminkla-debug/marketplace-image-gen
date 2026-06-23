// Tiny synthesized "bird tweet" for new-order notifications.
// Uses the Web Audio API so no audio asset is needed.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Resume the audio context after a user gesture so playback is allowed later. */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("ps-notif-muted") === "1";
}

export function setMuted(m: boolean) {
  try { localStorage.setItem("ps-notif-muted", m ? "1" : "0"); } catch { /* ignore */ }
}

/** Play a short two-note bird-like chirp. */
export function playChirp() {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});

  const tweet = (start: number, f0: number, f1: number, dur: number) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  };

  const now = c.currentTime;
  tweet(now, 1800, 2700, 0.12);        // ciu
  tweet(now + 0.17, 2100, 2900, 0.12); // ciu
}
