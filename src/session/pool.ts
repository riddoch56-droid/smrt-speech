import { allReadingItems, allWords, disabledIds, findWord, replacedImageIds } from '../app/content';
import type { AppState } from '../app/store';
import { SCREENER } from '../content';
import type { ReadingItem } from '../content/types';
import { GUEST } from '../settings/model';
import { activityDef, type ActivityId, type SessionSettings } from './types';
import { filterWords, type AppWord } from './words';

export type SessionItem = { kind: 'word'; id: string; word: AppWord } | { kind: 'reading'; id: string; item: ReadingItem };

/** Activities where the patient must see the target's picture. */
export function needsPicture(activity: ActivityId, settings: SessionSettings): boolean {
  if (activity === 'comp-listen-read' || activity === 'write-hear') return false;
  if (activity === 'naming-flashcards') return settings.flashcards.showPicture;
  return true;
}

function patientOf(patientId: string): string | null {
  return patientId === GUEST ? null : patientId;
}

/** Words that pass the global switches, before any per-session choices. */
export function availableWords(state: AppState, patientId: string, requireImage: boolean): AppWord[] {
  return filterWords(allWords(state), {
    childFriendlyOnly: state.settings.childFriendly,
    disabledIds: disabledIds(state),
    requireImage,
    replacedImageIds: replacedImageIds(state),
    patientId: patientOf(patientId),
  });
}

export function buildPool(activity: ActivityId, settings: SessionSettings, state: AppState, patientId: string): SessionItem[] {
  const def = activityDef(activity);

  if (activity === 'naming-test') {
    return SCREENER.items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((i) => findWord(i.wordId, state))
      .filter((w): w is AppWord => w !== null)
      .map((word) => ({ kind: 'word', id: word.id, word }));
  }

  if (def.module === 'reading') {
    const kind = activity.startsWith('read-phrase') ? 'phrase' : 'sentence';
    const off = disabledIds(state);
    const groups = settings.groups.length > 0 ? new Set(settings.groups) : null;
    return allReadingItems(state)
      .filter((r) => r.kind === kind)
      .filter((r) => !groups || groups.has(r.group))
      .filter((r) => !state.settings.childFriendly || r.childFriendly)
      .filter((r) => !r.wordId || !off.has(r.wordId))
      .map((item) => ({ kind: 'reading', id: item.id, item }));
  }

  const words = filterWords(availableWords(state, patientId, needsPicture(activity, settings)), {
    groups: settings.groups,
    lettersOnly: def.module === 'writing',
    lengths: def.module === 'writing' ? settings.wordLengths : undefined,
    syllables: def.module === 'naming' ? settings.syllables : undefined,
  });
  return words.map((word) => ({ kind: 'word', id: word.id, word }));
}

export function lastSettingsKey(patientId: string, activity: ActivityId): string {
  return `lastSettings:${patientId}:${activity}`;
}
