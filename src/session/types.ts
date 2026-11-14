export type ModuleId = 'comprehension' | 'naming' | 'reading' | 'writing';

export const ACTIVITY_IDS = [
  'comp-listen',
  'comp-read',
  'comp-listen-read',
  'naming-practice',
  'naming-describe',
  'naming-test',
  'naming-flashcards',
  'read-phrase-match',
  'read-phrase-complete',
  'read-sentence-match',
  'read-sentence-complete',
  'write-fill',
  'write-copy',
  'write-see',
  'write-hear',
] as const;

export type ActivityId = (typeof ACTIVITY_IDS)[number];

export interface ActivityDef {
  id: ActivityId;
  module: ModuleId;
  title: string;
  blurb: string;
  /** Position within the module, easiest first. */
  order: number;
}

export const MODULES: { id: ModuleId; title: string; blurb: string }[] = [
  { id: 'comprehension', title: 'Comprehension', blurb: 'Understand single words' },
  { id: 'naming', title: 'Naming', blurb: 'Find and say words' },
  { id: 'reading', title: 'Reading', blurb: 'Read phrases and sentences' },
  { id: 'writing', title: 'Writing', blurb: 'Spell words with tiles' },
];

export const ACTIVITIES: ActivityDef[] = [
  { id: 'comp-listen', module: 'comprehension', title: 'Listen', blurb: 'Hear a word, choose the picture', order: 1 },
  { id: 'comp-read', module: 'comprehension', title: 'Read', blurb: 'Read a word, choose the picture', order: 2 },
  { id: 'comp-listen-read', module: 'comprehension', title: 'Listen and Read', blurb: 'Hear a word, choose the written word', order: 3 },
  { id: 'naming-flashcards', module: 'naming', title: 'Flashcards', blurb: 'Free practice with pictures and words', order: 1 },
  { id: 'naming-practice', module: 'naming', title: 'Naming Practice', blurb: 'Name the picture, with cues if needed', order: 2 },
  { id: 'naming-describe', module: 'naming', title: 'Describe', blurb: 'Talk about meaning and sounds', order: 3 },
  { id: 'naming-test', module: 'naming', title: 'Naming Test', blurb: 'Informal 30-picture screen, no cues', order: 4 },
  { id: 'read-phrase-match', module: 'reading', title: 'Phrase Matching', blurb: 'Choose the phrase for the picture', order: 1 },
  { id: 'read-phrase-complete', module: 'reading', title: 'Phrase Completion', blurb: 'Choose the missing word', order: 2 },
  { id: 'read-sentence-match', module: 'reading', title: 'Sentence Matching', blurb: 'Choose the sentence for the picture', order: 3 },
  { id: 'read-sentence-complete', module: 'reading', title: 'Sentence Completion', blurb: 'Choose the missing word', order: 4 },
  { id: 'write-copy', module: 'writing', title: 'Copy', blurb: 'Copy the word with tiles', order: 1 },
  { id: 'write-fill', module: 'writing', title: 'Fill in the Blank', blurb: 'Add the missing letter', order: 2 },
  { id: 'write-see', module: 'writing', title: 'Spell What You See', blurb: 'Spell the picture', order: 3 },
  { id: 'write-hear', module: 'writing', title: 'Spell What You Hear', blurb: 'Spell the spoken word', order: 4 },
];

export function activityDef(id: ActivityId): ActivityDef {
  const def = ACTIVITIES.find((a) => a.id === id);
  if (!def) throw new Error(`Unknown activity ${id}`);
  return def;
}

export function activitiesFor(module: ModuleId): ActivityDef[] {
  return ACTIVITIES.filter((a) => a.module === module).sort((a, b) => a.order - b.order);
}

export type Difficulty = 'easy' | 'hard';
export type FieldSize = 2 | 3 | 4 | 5 | 6 | 'auto';
export type TrialCount = 10 | 20 | 30 | 'continuous';
export type TileLevel = 'easy' | 'medium' | 'hard';
export type DescribePrompts = 'meaning' | 'sound' | 'both';
export type ReadAloud = 'hint' | 'always';

export interface FlashcardOptions {
  showPicture: boolean;
  showWord: boolean;
  speakOnReveal: boolean;
  shuffle: boolean;
  scoring: boolean;
}

export interface SessionSettings {
  groups: string[];
  trials: TrialCount;
  choices: FieldSize;
  difficulty: Difficulty;
  /** Syllable filter for Naming: 1 to 5, where 5 means five or more. Empty means all. */
  syllables: number[];
  describePrompts: DescribePrompts;
  flashcards: FlashcardOptions;
  readAloud: ReadAloud;
  tileLevel: TileLevel;
  /** Word length toggles for Writing: 3 to 10, where 10 means ten or more. Empty means all. */
  wordLengths: number[];
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  groups: [],
  trials: 10,
  choices: 4,
  difficulty: 'easy',
  syllables: [],
  describePrompts: 'both',
  flashcards: { showPicture: true, showWord: true, speakOnReveal: true, shuffle: true, scoring: false },
  readAloud: 'hint',
  tileLevel: 'easy',
  wordLengths: [],
};

export type CueType = 'definition' | 'sentence' | 'firstLetter' | 'firstSound' | 'written' | 'spoken';

export const CUE_ORDER: CueType[] = ['definition', 'sentence', 'firstLetter', 'firstSound', 'written', 'spoken'];

export const CUE_LABELS: Record<CueType, string> = {
  definition: 'Description',
  sentence: 'Sentence',
  firstLetter: 'First letter',
  firstSound: 'First sound',
  written: 'Written word',
  spoken: 'Spoken word',
};

export interface TrialResponse {
  value: string;
  correct: boolean;
  /** Milliseconds since the trial started. */
  at: number;
}

export type DescribeStatus = 'independent' | 'afterReveal' | 'notSaid';

export interface DescribeMark {
  card: string;
  status: DescribeStatus;
}

export type TrialOutcome = 'correct' | 'cued' | 'incorrect';

export interface TrialRecord {
  index: number;
  itemId: string;
  /** The target as shown in reports. */
  label: string;
  group: string;
  activity: ActivityId;
  choices: string[];
  responses: TrialResponse[];
  firstAttemptCorrect: boolean;
  hintsUsed: number;
  cuesUsed: CueType[];
  attempts: number;
  /** Time to the first response. */
  responseTimeMs: number;
  durationMs: number;
  /** True only when the first response was right and no hint or cue was used. */
  correct: boolean;
  outcome: TrialOutcome;
  skipped?: boolean;
  fieldSize?: number;
  describe?: DescribeMark[];
}

export interface GroupTally {
  total: number;
  correct: number;
}

export interface SessionSummary {
  total: number;
  correct: number;
  cued: number;
  incorrect: number;
  percent: number;
  hints: number;
  cues: Record<CueType, number>;
  /** How often each cue type was the last cue taken before a successful naming response. */
  cuesBeforeSuccess: Record<CueType, number>;
  byGroup: Record<string, GroupTally>;
  missed: string[];
  meanResponseMs: number;
}

export type RecommendationLevel = 'up' | 'down' | 'stay';

export interface Recommendation {
  level: RecommendationLevel;
  text: string;
}

export interface SessionRecord {
  id: string;
  patientId: string;
  activity: ActivityId;
  module: ModuleId;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  settings: SessionSettings;
  trials: TrialRecord[];
  summary: SessionSummary;
  recommendation: Recommendation;
  note: string;
  screenerVersion?: number;
}
