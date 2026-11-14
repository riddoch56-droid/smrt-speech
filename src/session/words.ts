import type { Word } from '../content/types';

/** A word as used at runtime: a built-in word or one the therapist added. */
export interface AppWord extends Word {
  custom?: boolean;
  /** For custom words: the patient this word is assigned to, or null for everyone. */
  patientId?: string | null;
  /** For custom words: true when a recorded clip replaces the synthesised voice. */
  hasAudio?: boolean;
}

export interface WordFilter {
  groups?: readonly string[];
  childFriendlyOnly?: boolean;
  disabledIds?: ReadonlySet<string>;
  /** Drop words with no usable picture (picture-dependent activities). */
  requireImage?: boolean;
  /** Ids of built-in words whose missing picture has been replaced in the app. */
  replacedImageIds?: ReadonlySet<string>;
  /** Writing: single words made only of letters. */
  lettersOnly?: boolean;
  /** Word length toggles, 3 to 10 where 10 means ten or more. Empty or absent means all. */
  lengths?: readonly number[];
  /** Syllable toggles, 1 to 5 where 5 means five or more. Empty or absent means all. */
  syllables?: readonly number[];
  /** Current patient. Custom words assigned to another patient are hidden. */
  patientId?: string | null;
}

export function isLettersOnly(word: string): boolean {
  return /^[a-z]+$/i.test(word);
}

export function countLetters(word: string): number {
  return word.replace(/[^a-z]/gi, '').length;
}

export function lengthBucket(letters: number): number {
  return Math.min(10, Math.max(3, letters));
}

export function syllableBucket(syllables: number): number {
  return Math.min(5, Math.max(1, syllables));
}

export function wordHasPicture(word: AppWord, replaced?: ReadonlySet<string>): boolean {
  return word.hasImage !== false || !!replaced?.has(word.id);
}

export function filterWords<T extends AppWord>(words: readonly T[], f: WordFilter): T[] {
  const groups = f.groups && f.groups.length > 0 ? new Set(f.groups) : null;
  const lengths = f.lengths && f.lengths.length > 0 ? new Set(f.lengths) : null;
  const syllables = f.syllables && f.syllables.length > 0 ? new Set(f.syllables) : null;
  return words.filter((w) => {
    if (groups && !groups.has(w.group)) return false;
    if (f.childFriendlyOnly && !w.childFriendly) return false;
    if (f.disabledIds?.has(w.id)) return false;
    if (f.requireImage && !wordHasPicture(w, f.replacedImageIds)) return false;
    if (f.lettersOnly && (w.multiWord || !isLettersOnly(w.word))) return false;
    if (lengths && !lengths.has(lengthBucket(w.letters))) return false;
    if (syllables && !syllables.has(syllableBucket(w.syllables))) return false;
    if (w.custom && w.patientId && w.patientId !== (f.patientId ?? null)) return false;
    return true;
  });
}
