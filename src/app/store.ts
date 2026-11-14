import { create } from 'zustand';
import {
  db,
  kvGet,
  kvSet,
  type CustomCategory,
  type CustomReadingRow,
  type CustomWordRow,
  type Patient,
  type WordOverride,
} from '../platform/db';
import { configureSpeech } from '../platform/speech';
import { setSoundEnabled } from '../platform/audio';
import { requestPersistence, type PinRecord } from '../platform/system';
import {
  DEFAULT_GLOBAL_SETTINGS,
  EMPTY_PRACTITIONER,
  GUEST,
  type GlobalSettings,
  type Practitioner,
} from '../settings/model';
import { applyTheme } from '../ui/theme';
import { clearBlobUrls } from '../platform/blobUrls';

export interface AppState {
  ready: boolean;
  firstRunDone: boolean;
  settings: GlobalSettings;
  practitioner: Practitioner;
  patients: Patient[];
  /** A patient id, "guest", or null when nobody has been chosen yet. */
  currentPatientId: string | null;
  pin: PinRecord | null;
  /** True once the PIN has been entered. Reset whenever a session starts. */
  unlocked: boolean;
  customWords: CustomWordRow[];
  categories: CustomCategory[];
  customReading: CustomReadingRow[];
  overrides: Record<string, WordOverride>;
  /** Bumped whenever custom content changes so derived word lists refresh. */
  contentVersion: number;

  load(): Promise<void>;
  updateSettings(patch: Partial<GlobalSettings>): Promise<void>;
  setPractitioner(p: Practitioner): Promise<void>;
  completeFirstRun(): Promise<void>;
  setCurrentPatient(id: string | null): Promise<void>;
  refreshPatients(): Promise<void>;
  refreshCustom(): Promise<void>;
  setPin(pin: PinRecord | null): Promise<void>;
  lock(): void;
  unlock(): void;
}

function applySideEffects(s: GlobalSettings) {
  configureSpeech({ voiceUri: s.voiceUri, rate: s.speechRate });
  setSoundEnabled(s.soundEffects);
  applyTheme(s.theme);
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  firstRunDone: false,
  settings: DEFAULT_GLOBAL_SETTINGS,
  practitioner: EMPTY_PRACTITIONER,
  patients: [],
  currentPatientId: null,
  pin: null,
  unlocked: true,
  customWords: [],
  categories: [],
  customReading: [],
  overrides: {},
  contentVersion: 0,

  async load() {
    const settings = { ...DEFAULT_GLOBAL_SETTINGS, ...(await kvGet<Partial<GlobalSettings>>('settings', {})) };
    const practitioner = { ...EMPTY_PRACTITIONER, ...(await kvGet<Partial<Practitioner>>('practitioner', {})) };
    const firstRunDone = await kvGet('firstRunDone', false);
    const pin = await kvGet<PinRecord | null>('pin', null);
    const patients = await db.patients.toArray();
    let currentPatientId = await kvGet<string | null>('currentPatient', null);
    if (currentPatientId && currentPatientId !== GUEST && !patients.some((p) => p.id === currentPatientId)) {
      currentPatientId = null;
    }
    applySideEffects(settings);
    set({ settings, practitioner, firstRunDone, pin, unlocked: pin === null, patients, currentPatientId });
    await get().refreshCustom();
    set({ ready: true });
    if (!firstRunDone) void requestPersistence();
  },

  async updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    applySideEffects(settings);
    set({ settings });
    await kvSet('settings', settings);
  },

  async setPractitioner(practitioner) {
    set({ practitioner });
    await kvSet('practitioner', practitioner);
  },

  async completeFirstRun() {
    set({ firstRunDone: true });
    await kvSet('firstRunDone', true);
  },

  async setCurrentPatient(id) {
    set({ currentPatientId: id });
    await kvSet('currentPatient', id);
  },

  async refreshPatients() {
    const patients = await db.patients.toArray();
    const current = get().currentPatientId;
    const stillThere = current === null || current === GUEST || patients.some((p) => p.id === current);
    set({ patients, currentPatientId: stillThere ? current : null });
  },

  async refreshCustom() {
    const [customWords, categories, customReading, overrideRows] = await Promise.all([
      db.customWords.toArray(),
      db.customCategories.toArray(),
      db.customReading.toArray(),
      db.wordOverrides.toArray(),
    ]);
    clearBlobUrls();
    set({
      customWords,
      categories,
      customReading,
      overrides: Object.fromEntries(overrideRows.map((o) => [o.wordId, o])),
      contentVersion: get().contentVersion + 1,
    });
  },

  async setPin(pin) {
    set({ pin, unlocked: true });
    await kvSet('pin', pin);
  },

  lock() {
    if (get().pin) set({ unlocked: false });
  },

  unlock() {
    set({ unlocked: true });
  },
}));

export function currentPatient(state: AppState): Patient | null {
  return state.patients.find((p) => p.id === state.currentPatientId) ?? null;
}

export function patientLabel(state: AppState): string {
  if (state.currentPatientId === GUEST) return 'Guest (nothing saved)';
  return currentPatient(state)?.code ?? 'No patient selected';
}
