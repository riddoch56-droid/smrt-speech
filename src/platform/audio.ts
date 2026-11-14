// Sound effects are synthesised with the Web Audio API: no audio files are bundled.

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** Call from the first touch so later sounds are allowed to play. */
export function unlockAudio() {
  const c = context();
  if (c && c.state === 'suspended') void c.resume();
}

function tone(freq: number, start: number, duration: number, gain: number, type: OscillatorType = 'sine') {
  const c = context();
  if (!c || !enabled) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** Soft two-note chime for a correct answer. */
export function playCorrect() {
  tone(660, 0, 0.35, 0.12);
  tone(880, 0.12, 0.5, 0.12);
}

/** Soft, low, neutral tone for a wrong choice. Never a buzzer. */
export function playIncorrect() {
  tone(220, 0, 0.28, 0.07);
}

export function playClick() {
  tone(520, 0, 0.06, 0.05, 'triangle');
}

export function playDone() {
  tone(523, 0, 0.3, 0.1);
  tone(659, 0.14, 0.3, 0.1);
  tone(784, 0.28, 0.6, 0.1);
}
