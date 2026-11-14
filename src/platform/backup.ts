import type { Binary, SmrtDb } from './db';

export const BACKUP_FORMAT = 'smrt-speech-backup';
export const BACKUP_VERSION = 1;

/** Keys that describe this device rather than the therapist's data: never restored. */
const DEVICE_KEYS = new Set(['offlineReady', 'lastBackup']);

const TABLES = ['patients', 'sessions', 'kv', 'customWords', 'customCategories', 'customReading', 'wordOverrides'] as const;
type TableName = (typeof TABLES)[number];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  created: string;
  appVersion: string;
  tables: Record<TableName, unknown[]>;
}

interface EncodedBinary {
  __binary: true;
  type: string;
  base64: string;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(out);
}

function fromBase64(text: string): ArrayBuffer {
  const bin = atob(text);
  const buf = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return buf;
}

function isBinary(v: unknown): v is Binary {
  return !!v && typeof v === 'object' && (v as Binary).data instanceof ArrayBuffer && typeof (v as Binary).type === 'string';
}

function encode(value: unknown): unknown {
  if (isBinary(value)) return { __binary: true, type: value.type, base64: toBase64(value.data) } satisfies EncodedBinary;
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

function decode(value: unknown): unknown {
  if (value && typeof value === 'object' && (value as EncodedBinary).__binary === true) {
    const e = value as EncodedBinary;
    return { type: e.type, data: fromBase64(e.base64) } satisfies Binary;
  }
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

/** Everything: patients, sessions, settings, custom words, custom images and audio. */
export async function exportBackup(database: SmrtDb, appVersion: string, now = new Date()): Promise<BackupFile> {
  const tables = {} as Record<TableName, unknown[]>;
  for (const name of TABLES) {
    const rows = await database.table(name).toArray();
    tables[name] = (name === 'kv' ? rows.filter((r) => !DEVICE_KEYS.has(r.key)) : rows).map(encode);
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, created: now.toISOString(), appVersion, tables };
}

export function backupToBlob(file: BackupFile): Blob {
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a SMRT Speech backup.');
  }
  const file = data as BackupFile;
  if (!file || file.format !== BACKUP_FORMAT || !file.tables || typeof file.tables !== 'object' || Array.isArray(file.tables)) {
    throw new Error('This file is not a SMRT Speech backup.');
  }
  if (file.version > BACKUP_VERSION) throw new Error('This backup was made by a newer version of SMRT Speech.');
  return file;
}

export type RestoreMode = 'merge' | 'replace';

export interface RestoreResult {
  patients: number;
  sessions: number;
  customWords: number;
}

/**
 * Replace: wipes this device's data and loads the backup.
 * Merge: keeps what is here and adds what is missing. Records with the same id are
 * taken from the backup; a patient whose ID code already exists here keeps the local
 * record and that patient's backed-up sessions are attached to it.
 */
export async function restoreBackup(database: SmrtDb, file: BackupFile, mode: RestoreMode): Promise<RestoreResult> {
  const decoded = Object.fromEntries(TABLES.map((n) => [n, (file.tables[n] ?? []).map(decode)])) as Record<TableName, any[]>; // eslint-disable-line @typescript-eslint/no-explicit-any
  await database.transaction('rw', TABLES.map((n) => database.table(n)), async () => {
    if (mode === 'replace') {
      for (const name of TABLES) {
        if (name === 'kv') {
          const keep = await database.kv.where('key').anyOf([...DEVICE_KEYS]).toArray();
          await database.kv.clear();
          await database.kv.bulkPut(keep);
        } else {
          await database.table(name).clear();
        }
      }
      for (const name of TABLES) await database.table(name).bulkPut(decoded[name]);
      return;
    }
    // Merge.
    const idMap = new Map<string, string>();
    const local = await database.patients.toArray();
    const byCode = new Map(local.map((p) => [p.code.trim().toLowerCase(), p]));
    for (const p of decoded.patients) {
      const existing = byCode.get(String(p.code).trim().toLowerCase());
      if (existing && existing.id !== p.id) idMap.set(p.id, existing.id);
      else await database.patients.put(p);
    }
    for (const s of decoded.sessions) {
      await database.sessions.put(idMap.has(s.patientId) ? { ...s, patientId: idMap.get(s.patientId) } : s);
    }
    for (const name of ['customWords', 'customCategories', 'customReading', 'wordOverrides'] as const) {
      await database.table(name).bulkPut(decoded[name]);
    }
    // Settings on this device win in a merge; only fill in keys that are missing.
    for (const row of decoded.kv) {
      if ((await database.kv.get(row.key)) === undefined) await database.kv.put(row);
    }
  });
  return { patients: decoded.patients.length, sessions: decoded.sessions.length, customWords: decoded.customWords.length };
}
