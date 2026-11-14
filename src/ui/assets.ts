import type { ActivityId, ModuleId } from '../session/types';

/**
 * Address of a file from the visual asset pack, installed under public/smrt-assets/.
 * Built from the app's base path, so it works under any GitHub Pages sub-path and offline.
 */
export function asset(rel: string): string {
  return `${import.meta.env.BASE_URL}smrt-assets/${rel}`;
}

/** Paths are the pack manifest's own, relative to the pack root. */
export const BRAND_MARK = 'branding/app-icon.svg';

export const MODULE_ART: Record<ModuleId, string> = {
  comprehension: 'modules/comprehension.svg',
  naming: 'modules/naming.svg',
  reading: 'modules/reading.svg',
  writing: 'modules/writing.svg',
};

export const ACTIVITY_ART: Record<ActivityId, string> = {
  'comp-listen': 'activities/comprehension/listen.svg',
  'comp-read': 'activities/comprehension/read.svg',
  'comp-listen-read': 'activities/comprehension/listen-and-read.svg',
  'naming-practice': 'activities/naming/naming-practice.svg',
  'naming-describe': 'activities/naming/describe.svg',
  'naming-test': 'activities/naming/naming-test.svg',
  'naming-flashcards': 'activities/naming/flashcards.svg',
  'read-phrase-match': 'activities/reading/phrase-matching.svg',
  'read-phrase-complete': 'activities/reading/phrase-completion.svg',
  'read-sentence-match': 'activities/reading/sentence-matching.svg',
  'read-sentence-complete': 'activities/reading/sentence-completion.svg',
  'write-fill': 'activities/writing/fill-in-the-blank.svg',
  'write-copy': 'activities/writing/copy.svg',
  'write-see': 'activities/writing/spell-what-you-see.svg',
  'write-hear': 'activities/writing/spell-what-you-hear.svg',
};

export const SHELL_BACKGROUNDS = { light: 'backgrounds/light.jpg', dark: 'backgrounds/dark.jpg' } as const;
