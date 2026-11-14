import { SMRT_GLYPHS, type SmrtGlyph } from './smrt-icons';

// Interface icons come from the SMRT Speech visual asset pack (see tools/assets/sync.ts).
// The drawings are the pack's own; only the stroke colour is replaced with currentColor so an
// icon takes the colour of its button or label in both the light and the dark theme.
//
// The names on the left are the ones used throughout the app. Each maps to one pack asset,
// written as its manifest path without the file extension.
const NAMES = {
  // Navigation
  home: 'ui/navigation/home',
  users: 'ui/navigation/users',
  chart: 'ui/navigation/chart',
  settings: 'ui/navigation/gear',
  back: 'ui/navigation/back',
  next: 'ui/navigation/next',
  info: 'ui/navigation/info',
  help: 'ui/navigation/help',
  grid: 'ui/navigation/grid',
  list: 'ui/navigation/list',
  search: 'ui/navigation/search',
  lock: 'ui/navigation/lock',
  // Actions
  repeat: 'ui/actions/repeat',
  speaker: 'ui/actions/speaker',
  mute: 'ui/actions/mute',
  hint: 'ui/actions/hint',
  mic: 'ui/actions/microphone',
  play: 'ui/actions/play',
  pause: 'ui/actions/pause',
  stop: 'ui/actions/stop',
  tick: 'ui/actions/check',
  save: 'ui/actions/check',
  cross: 'ui/actions/cross',
  close: 'ui/actions/cross',
  plus: 'ui/actions/plus',
  minus: 'ui/actions/minus',
  edit: 'ui/actions/edit',
  trash: 'ui/actions/delete',
  camera: 'ui/actions/camera',
  download: 'ui/actions/download',
  share: 'ui/actions/upload',
  upload: 'ui/actions/upload',
  filter: 'ui/actions/filter',
  eye: 'ui/actions/eye',
  eyeOff: 'ui/actions/eye-off',
  flip: 'ui/actions/shuffle',
  shuffle: 'ui/actions/shuffle',
  backup: 'ui/actions/backup',
  print: 'ui/actions/print',
  calendar: 'ui/actions/calendar',
  archive: 'ui/actions/archive',
  star: 'ui/actions/star',
  flag: 'ui/actions/flag',
  word: 'ui/actions/word',
  letter: 'ui/actions/letter',
  syllable: 'ui/actions/syllable',
  progress: 'ui/actions/progress',
  keyboard: 'ui/actions/keyboard',
  wifiOff: 'ui/actions/cloud-off',
  category: 'ui/actions/category',
  // Feedback and scoring
  correct: 'ui/feedback/correct',
  tryAgain: 'ui/feedback/try-again',
  completed: 'ui/feedback/completed',
  incorrect: 'ui/feedback/incorrect',
  half: 'ui/feedback/hint-used',
  skip: 'ui/feedback/skipped',
  // Patients and reports
  user: 'ui/patients/patient-id',
  patientHistory: 'ui/patients/patient-history',
  patientLock: 'ui/patients/patient-lock',
  addPatient: 'ui/patients/add-patient',
  archivePatient: 'ui/patients/archive-patient',
  sessionReport: 'ui/reports/session-report',
  progressReport: 'ui/reports/progress-report',
  exportPdf: 'ui/reports/export-pdf',
  exportCsv: 'ui/reports/export-csv',
  printReport: 'ui/reports/print-report',
  // Settings
  voice: 'ui/settings/voice',
  offline: 'ui/settings/offline',
  privacy: 'ui/settings/privacy',
  customWords: 'ui/settings/custom-words',
  image: 'ui/settings/image-credits',
  accessibility: 'ui/settings/accessibility',
  // Controls
  tile: 'ui/controls/tile',
  answerSlot: 'ui/controls/answer-slot',
  choice: 'ui/controls/choice',
  // Module and activity drawings, for the few places they appear inline
  ear: 'activities/comprehension/listen',
  book: 'modules/reading',
  chat: 'modules/naming',
  pencil: 'modules/writing',
  cards: 'activities/naming/flashcards',
} as const satisfies Record<string, SmrtGlyph>;

export type IconName = keyof typeof NAMES;

export const ICON_NAMES = NAMES as Record<string, SmrtGlyph>;

export function Icon({ name, size }: { name: string; size?: number }) {
  const key = ICON_NAMES[name] ?? ICON_NAMES.info;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      // Trusted, build-time markup generated from the asset pack.
      dangerouslySetInnerHTML={{ __html: SMRT_GLYPHS[key] }}
    />
  );
}
