export type LetterSounds = 'names' | 'click' | 'silent';
export type CustomFoils = 'full' | 'limited';
/** Theme of the app chrome. Activities always stay light. */
export type { ThemeChoice } from '../ui/theme';
import type { ThemeChoice } from '../ui/theme';

export interface GlobalSettings {
  autoAdvance: boolean;
  showScore: boolean;
  childFriendly: boolean;
  soundEffects: boolean;
  voiceUri: string | null;
  speechRate: number;
  letterSounds: LetterSounds;
  customFoils: CustomFoils;
  theme: ThemeChoice;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  autoAdvance: true,
  showScore: false,
  childFriendly: false,
  soundEffects: true,
  voiceUri: null,
  speechRate: 0.9,
  letterSounds: 'names',
  customFoils: 'full',
  theme: 'light',
};

export interface Practitioner {
  name: string;
  credentials: string;
  practice: string;
  contact: string;
}

export const EMPTY_PRACTITIONER: Practitioner = { name: '', credentials: '', practice: '', contact: '' };

export const GUEST = 'guest';

export const BACKUP_REMINDER_DAYS = 14;
export const BACKUP_REMINDER_SESSIONS = 20;

export interface BackupState {
  /** When the last backup was made, or null if never. */
  lastBackup: string | null;
  /** Start time of the oldest session saved since the last backup, or null if none. */
  oldestUnsaved: string | null;
  /** Number of sessions saved since the last backup. */
  sessionsSince: number;
}

/** True when it has been 14 days or 20 sessions since the last backup. */
export function backupDue(state: BackupState, now: Date): boolean {
  if (state.sessionsSince === 0) return false;
  if (state.sessionsSince >= BACKUP_REMINDER_SESSIONS) return true;
  const since = state.lastBackup ?? state.oldestUnsaved;
  if (!since) return false;
  const days = (now.getTime() - new Date(since).getTime()) / 86_400_000;
  return days >= BACKUP_REMINDER_DAYS;
}
