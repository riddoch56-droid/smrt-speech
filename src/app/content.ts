import { useMemo } from 'react';
import { READING_ITEMS, WORDS, WORDS_BY_ID } from '../content';
import { GROUP_IDS, GROUP_LABELS, type BuiltInGroupId, type ReadingItem } from '../content/types';
import { blobUrl } from '../platform/blobUrls';
import { binaryToBlob } from '../platform/db';
import { imageUrl } from '../platform/offline';
import { speak } from '../platform/speech';
import type { AppWord } from '../session/words';
import { useApp, type AppState } from './store';

export interface GroupOption {
  id: string;
  label: string;
  custom: boolean;
}

export function groupOptions(state: Pick<AppState, 'categories'>): GroupOption[] {
  return [
    ...GROUP_IDS.map((id) => ({ id, label: GROUP_LABELS[id], custom: false })),
    ...state.categories.map((c) => ({ id: c.id, label: c.name, custom: true })),
  ];
}

export function groupLabel(id: string, state: Pick<AppState, 'categories'> = useApp.getState()): string {
  if (id in GROUP_LABELS) return GROUP_LABELS[id as BuiltInGroupId];
  return state.categories.find((c) => c.id === id)?.name ?? 'My words';
}

/** Built-in words plus the therapist's own words. */
export function allWords(state: Pick<AppState, 'customWords'>): AppWord[] {
  return [...WORDS, ...state.customWords.map((r) => ({ ...r.word, custom: true, hasAudio: !!r.audio }))];
}

export function useAllWords(): AppWord[] {
  const customWords = useApp((s) => s.customWords);
  return useMemo(() => allWords({ customWords }), [customWords]);
}

export function disabledIds(state: Pick<AppState, 'overrides'>): Set<string> {
  return new Set(Object.values(state.overrides).filter((o) => o.disabled).map((o) => o.wordId));
}

export function replacedImageIds(state: Pick<AppState, 'overrides'>): Set<string> {
  return new Set(Object.values(state.overrides).filter((o) => o.image).map((o) => o.wordId));
}

export function findWord(id: string, state: Pick<AppState, 'customWords'> = useApp.getState()): AppWord | null {
  const builtIn = WORDS_BY_ID.get(id);
  if (builtIn) return builtIn;
  const row = state.customWords.find((r) => r.id === id);
  return row ? { ...row.word, custom: true, hasAudio: !!row.audio } : null;
}

/** The picture for a word: a replacement photo, a custom photo, or the bundled image. */
export function wordImageSrc(word: AppWord, state: AppState = useApp.getState()): string | null {
  const override = state.overrides[word.id];
  if (override?.image) return blobUrl(`override:${word.id}`, override.image);
  if (word.custom) {
    const row = state.customWords.find((r) => r.id === word.id);
    return row?.image ? blobUrl(`word:${word.id}`, row.image) : null;
  }
  return word.hasImage === false ? null : imageUrl(word.image);
}

export function allReadingItems(state: Pick<AppState, 'customReading'>): ReadingItem[] {
  return [...READING_ITEMS, ...state.customReading.map((r) => r.item)];
}

export function readingImageSrc(item: ReadingItem, state: AppState = useApp.getState()): string | null {
  const row = state.customReading.find((r) => r.id === item.id);
  if (row) return row.image ? blobUrl(`reading:${row.id}`, row.image) : null;
  if (item.wordId) {
    const override = state.overrides[item.wordId];
    if (override?.image) return blobUrl(`override:${item.wordId}`, override.image);
  }
  return imageUrl(item.image);
}

let clip: HTMLAudioElement | null = null;

/** Speaks a word: a recorded clip for custom words that have one, otherwise the synthesised voice. */
export function speakWord(word: AppWord, onEnd?: () => void) {
  if (word.custom && word.hasAudio) {
    const row = useApp.getState().customWords.find((r) => r.id === word.id);
    if (row?.audio) {
      try {
        clip?.pause();
        const url = URL.createObjectURL(binaryToBlob(row.audio));
        clip = new Audio(url);
        clip.onended = () => {
          URL.revokeObjectURL(url);
          onEnd?.();
        };
        void clip.play();
        return;
      } catch {
        /* fall back to speech */
      }
    }
  }
  speak(word.word, { onEnd });
}
