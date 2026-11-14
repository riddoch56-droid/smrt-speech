export const GROUP_IDS = [
  'food',
  'animals',
  'clothing',
  'household',
  'furniture',
  'body',
  'transport',
  'places',
  'people',
  'nature',
  'verbs',
  'adjectives',
] as const;

export type BuiltInGroupId = (typeof GROUP_IDS)[number];
/** A built-in group id, or the id of a custom category ("custom-…"). */
export type GroupId = BuiltInGroupId | (string & {});

export const GROUP_LABELS: Record<BuiltInGroupId, string> = {
  food: 'Food and drink',
  animals: 'Animals',
  clothing: 'Clothing and accessories',
  household: 'Household objects',
  furniture: 'Furniture and rooms',
  body: 'Body and personal care',
  transport: 'Transport and travel',
  places: 'Places and buildings',
  people: 'People and occupations',
  nature: 'Nature, weather and outdoors',
  verbs: 'Actions',
  adjectives: 'Describing words',
};

export const GROUP_TARGET_COUNTS: Record<BuiltInGroupId, number> = {
  food: 54,
  animals: 54,
  clothing: 54,
  household: 54,
  furniture: 54,
  body: 54,
  transport: 54,
  places: 54,
  people: 54,
  nature: 54,
  verbs: 100,
  adjectives: 60,
};

export type WordClass = 'noun' | 'verb' | 'adjective';

export interface WordCues {
  definition: string;
  sentenceCompletion: string;
  firstLetter: string;
  firstSoundSpoken: string;
  firstSyllable?: string;
}

export interface WordSemantic {
  category: string;
  use: string;
  action: string;
  properties: string;
  location: string;
  association: string;
}

export interface WordPhonological {
  firstSound: string;
  lastSound: string;
  syllables: number;
  rhyme: string | null;
  sameFirstSound: string;
}

export interface Word {
  id: string;
  word: string;
  group: GroupId;
  subgroup: string;
  wordClass: WordClass;
  letters: number;
  syllables: number;
  frequencyBand: 1 | 2 | 3;
  multiWord: boolean;
  childFriendly: boolean;
  image: string;
  imagePrompt: string;
  /** Short search phrase used by the image sourcing tools. */
  searchQuery?: string;
  /** False when no picture passed quality control. */
  hasImage?: boolean;
  cues: WordCues;
  semantic: WordSemantic;
  phonological: WordPhonological;
}

export type ReadingKind = 'phrase' | 'sentence';

export interface ReadingItem {
  id: string;
  kind: ReadingKind;
  /** Image file name in the image set. */
  image: string;
  /** Word whose picture this item uses, if any. */
  wordId?: string;
  group: GroupId;
  /** Full matching text, e.g. "a cup of tea" or "The man is reading a book." */
  text: string;
  /** Whole-text distractors for the Matching activities (at least three). */
  distractors: string[];
  /** Text with the missing word replaced by "___" for the Completion activities. */
  cloze: string;
  /** The missing word. */
  answer: string;
  /** Single-word distractors for the Completion activities (at least three). */
  answerDistractors: string[];
  childFriendly: boolean;
}

export interface ImageCredit {
  image: string;
  source: 'openverse' | 'wikimedia-commons' | 'generated' | 'project';
  sourceUrl: string;
  author: string;
  licence: string;
  licenceUrl: string;
  retrieved: string;
  modifications: string;
  prompt?: string;
  flagged?: string;
}

export interface ScreenerItem {
  wordId: string;
  order: number;
}

export interface Screener {
  version: number;
  frozen: string;
  items: ScreenerItem[];
}
