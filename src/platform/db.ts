import Dexie, { type Table } from 'dexie';
import type { ReadingItem } from '../content/types';
import type { SessionRecord } from '../session/types';
import type { AppWord } from '../session/words';

/** Binary data is stored as a typed buffer rather than a Blob, which is more reliable in Safari. */
export interface Binary {
  type: string;
  data: ArrayBuffer;
}

export interface Patient {
  id: string;
  /** ID code, never a name. Unique. */
  code: string;
  dateAdded: string | null;
  archived: boolean;
  notes: string;
}

export interface KeyValue {
  key: string;
  value: unknown;
}

export interface CustomWordRow {
  id: string;
  word: AppWord;
  image: Binary | null;
  audio: Binary | null;
}

export interface CustomCategory {
  id: string;
  name: string;
}

export interface CustomReadingRow {
  id: string;
  item: ReadingItem;
  image: Binary | null;
}

export interface WordOverride {
  wordId: string;
  disabled: boolean;
  image: Binary | null;
}

export class SmrtDb extends Dexie {
  patients!: Table<Patient, string>;
  sessions!: Table<SessionRecord, string>;
  kv!: Table<KeyValue, string>;
  customWords!: Table<CustomWordRow, string>;
  customCategories!: Table<CustomCategory, string>;
  customReading!: Table<CustomReadingRow, string>;
  wordOverrides!: Table<WordOverride, string>;

  constructor(name = 'smrt-speech') {
    super(name);
    // Version 1: initial schema. Add later versions below with .upgrade() steps;
    // never edit a released version in place.
    this.version(1).stores({
      patients: 'id, &code, archived',
      sessions: 'id, patientId, activity, module, startedAt, [patientId+startedAt]',
      kv: 'key',
      customWords: 'id',
      customCategories: 'id',
      customReading: 'id',
      wordOverrides: 'wordId',
    });
  }
}

export const db = new SmrtDb();

export async function kvGet<T>(key: string, fallback: T, database: SmrtDb = db): Promise<T> {
  const row = await database.kv.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function kvSet(key: string, value: unknown, database: SmrtDb = db): Promise<void> {
  await database.kv.put({ key, value });
}

export async function blobToBinary(blob: Blob): Promise<Binary> {
  return { type: blob.type || 'application/octet-stream', data: await blob.arrayBuffer() };
}

export function binaryToBlob(bin: Binary): Blob {
  return new Blob([bin.data], { type: bin.type });
}
