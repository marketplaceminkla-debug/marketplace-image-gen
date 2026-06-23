// New-order notification sound. Uses a real <audio> element (not Web Audio)
// so it can still play when the tab is in the background — once unlocked by
// a user gesture.

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio("/notif-chirp.wav");
    audio.preload = "auto";
    audio.volume = 0.9;
  }
  return audio;
}

/** Unlock playback on the first user gesture (play muted once, then reset). */
export function unlockAudio() {
  const a = getAudio();
  if (!a) return;
  a.muted = true;
  a.play()
    .then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
    .catch(() => { a.muted = false; });
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("ps-notif-muted") === "1";
}

export function setMuted(m: boolean) {
  try { localStorage.setItem("ps-notif-muted", m ? "1" : "0"); } catch { /* ignore */ }
}

/** Play the chirp (no-op if muted). */
export function playChirp() {
  if (isMuted()) return;
  const a = getAudio();
  if (!a) return;
  try { a.currentTime = 0; } catch { /* ignore */ }
  a.play().catch(() => {});
}
