// Speech synthesis wrapper. Voices load asynchronously on iOS and the first utterance
// must come from a user gesture, so the engine is primed on the first tap.

export interface VoiceInfo {
  uri: string;
  name: string;
  lang: string;
  local: boolean;
  uk: boolean;
}

let voices: SpeechSynthesisVoice[] = [];
let primed = false;
let preferredUri: string | null = null;
let rate = 0.9;
const listeners = new Set<() => void>();

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function refresh() {
  const s = synth();
  if (!s) return;
  const list = s.getVoices();
  if (list.length > 0) {
    voices = list;
    listeners.forEach((l) => l());
  }
}

export function initSpeech() {
  const s = synth();
  if (!s) return;
  refresh();
  s.addEventListener?.('voiceschanged', refresh);
  // Some browsers never fire voiceschanged: poll briefly.
  let tries = 0;
  const timer = setInterval(() => {
    refresh();
    if (voices.length > 0 || ++tries > 20) clearInterval(timer);
  }, 250);
}

export function onVoicesChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function speechSupported(): boolean {
  return synth() !== null;
}

function isUk(v: SpeechSynthesisVoice): boolean {
  return /^en[-_]GB/i.test(v.lang);
}

export function englishVoices(): VoiceInfo[] {
  return voices
    .filter((v) => /^en/i.test(v.lang))
    .map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang, local: v.localService, uk: isUk(v) }))
    .sort((a, b) => Number(b.uk) - Number(a.uk) || Number(b.local) - Number(a.local) || a.name.localeCompare(b.name));
}

export function hasUkVoice(): boolean {
  return voices.some(isUk);
}

/** Chooses the saved voice, else a local en-GB voice, else any en-GB, else any English voice. */
export function chooseVoice(list: SpeechSynthesisVoice[] = voices, wanted: string | null = preferredUri): SpeechSynthesisVoice | null {
  if (wanted) {
    const exact = list.find((v) => v.voiceURI === wanted);
    if (exact) return exact;
  }
  return (
    list.find((v) => isUk(v) && v.localService) ??
    list.find(isUk) ??
    list.find((v) => /^en/i.test(v.lang) && v.localService) ??
    list.find((v) => /^en/i.test(v.lang)) ??
    null
  );
}

export function configureSpeech(opts: { voiceUri?: string | null; rate?: number }) {
  if (opts.voiceUri !== undefined) preferredUri = opts.voiceUri;
  if (opts.rate !== undefined) rate = opts.rate;
}

/** Call from the first user gesture: unlocks speech on iOS with a silent utterance. */
export function primeSpeech() {
  const s = synth();
  if (!s || primed) return;
  primed = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    s.speak(u);
  } catch {
    /* ignore */
  }
  refresh();
}

export function cancelSpeech() {
  synth()?.cancel();
}

export function speak(text: string, opts: { rate?: number; onEnd?: () => void } = {}): void {
  const s = synth();
  if (!s || !text.trim()) {
    opts.onEnd?.();
    return;
  }
  // Always cancel the current utterance before speaking a new one.
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = chooseVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = 'en-GB';
  }
  u.rate = opts.rate ?? rate;
  if (opts.onEnd) {
    u.onend = opts.onEnd;
    u.onerror = opts.onEnd;
  }
  s.speak(u);
}

/** A written blank is read aloud as a pause rather than "underscore". */
export function speakable(text: string): string {
  return text.replace(/_{2,}/g, ', blank, ');
}
