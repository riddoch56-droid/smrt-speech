import { afterEach, describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, backupToBlob, exportBackup, parseBackup, restoreBackup, type BackupFile } from '../../src/platform/backup';
import { SmrtDb, kvGet, kvSet, type Binary, type Patient } from '../../src/platform/db';
import { BACKUP_REMINDER_DAYS, BACKUP_REMINDER_SESSIONS, backupDue, type BackupState } from '../../src/settings/model';
import { DEFAULT_SESSION_SETTINGS, type SessionRecord } from '../../src/session/types';
import { makeWord } from './helpers';

const opened: SmrtDb[] = [];
function newDb(): SmrtDb {
  const d = new SmrtDb('test-' + Math.random());
  opened.push(d);
  return d;
}
afterEach(async () => {
  while (opened.length) await opened.pop()!.delete();
});

function bin(type: string, bytes: number[]): Binary {
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  return { type, data: buf };
}

function patient(id: string, code: string): Patient {
  return { id, code, dateAdded: '2026-01-02', archived: false, notes: `notes for ${code}` };
}

function session(id: string, patientId: string, startedAt = '2026-02-01T10:00:00.000Z'): SessionRecord {
  return {
    id,
    patientId,
    activity: 'comp-listen',
    module: 'comprehension',
    startedAt,
    endedAt: startedAt,
    durationMs: 60_000,
    settings: DEFAULT_SESSION_SETTINGS,
    trials: [
      {
        index: 0,
        itemId: 'food-apple',
        label: 'apple',
        group: 'food',
        activity: 'comp-listen',
        choices: ['apple', 'pear'],
        responses: [{ value: 'apple', correct: true, at: 800 }],
        firstAttemptCorrect: true,
        hintsUsed: 0,
        cuesUsed: [],
        attempts: 1,
        responseTimeMs: 800,
        durationMs: 900,
        correct: true,
        outcome: 'correct',
        fieldSize: 2,
      },
    ],
    summary: {
      total: 1,
      correct: 1,
      cued: 0,
      incorrect: 0,
      percent: 100,
      hints: 0,
      cues: { definition: 0, sentence: 0, firstLetter: 0, firstSound: 0, written: 0, spoken: 0 },
      cuesBeforeSuccess: { definition: 0, sentence: 0, firstLetter: 0, firstSound: 0, written: 0, spoken: 0 },
      byGroup: { food: { total: 1, correct: 1 } },
      missed: [],
      meanResponseMs: 800,
    },
    recommendation: { level: 'stay', text: 'Continue.' },
    note: 'a note',
  };
}

const IMAGE = bin('image/webp', [0, 1, 2, 3, 250, 251, 252, 253, 254, 255]);
const AUDIO = bin('audio/mp4', Array.from({ length: 300 }, (_, i) => (i * 7) % 256));

async function fill(db: SmrtDb) {
  await db.patients.bulkPut([patient('p1', 'AB12'), patient('p2', 'CD34')]);
  await db.sessions.bulkPut([session('s1', 'p1'), session('s2', 'p1', '2026-02-02T10:00:00.000Z'), session('s3', 'p2')]);
  await kvSet('settings', { autoAdvance: false, voiceUri: 'voice-1', speechRate: 0.8 }, db);
  await kvSet('practitioner', { name: 'A Therapist', credentials: 'MRCSLT' }, db);
  await db.customCategories.put({ id: 'custom-pets', name: 'Pets' });
  await db.customWords.put({
    id: 'custom-pets-rex',
    word: makeWord('rex', { group: 'custom-pets', custom: true, patientId: 'p1', hasAudio: true, id: 'custom-pets-rex' }),
    image: IMAGE,
    audio: AUDIO,
  });
  await db.customWords.put({ id: 'custom-pets-tom', word: makeWord('tom', { group: 'custom-pets', custom: true, id: 'custom-pets-tom' }), image: null, audio: null });
  await db.customReading.put({
    id: 'custom-read-1',
    item: {
      id: 'custom-read-1',
      kind: 'phrase',
      image: 'custom-read-1.webp',
      group: 'custom-pets',
      text: 'a brown dog',
      distractors: ['a black dog', 'a brown cat', 'a white dog'],
      cloze: 'a brown ___',
      answer: 'dog',
      answerDistractors: ['cat', 'hat', 'log'],
      childFriendly: true,
    },
    image: bin('image/png', [9, 8, 7]),
  });
  await db.wordOverrides.bulkPut([
    { wordId: 'food-apple', disabled: true, image: null },
    { wordId: 'animals-hedgehog', disabled: false, image: bin('image/jpeg', [1, 1, 2, 3, 5, 8]) },
  ]);
}

async function dump(db: SmrtDb) {
  const names = ['patients', 'sessions', 'kv', 'customWords', 'customCategories', 'customReading', 'wordOverrides'] as const;
  const out: Record<string, unknown[]> = {};
  for (const n of names) {
    const rows = await db.table(n).toArray();
    out[n] = rows.sort((a, b) => String(a.id ?? a.key ?? a.wordId).localeCompare(String(b.id ?? b.key ?? b.wordId)));
  }
  return out;
}

describe('backup round trip', () => {
  it('exports a well-formed file', async () => {
    const db = newDb();
    await fill(db);
    const file = await exportBackup(db, '1.2.3', new Date('2026-03-04T05:06:07.000Z'));
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.appVersion).toBe('1.2.3');
    expect(file.created).toBe('2026-03-04T05:06:07.000Z');
    expect(file.tables.patients).toHaveLength(2);
    expect(file.tables.sessions).toHaveLength(3);
    expect(file.tables.customWords).toHaveLength(2);
    expect(file.tables.customCategories).toHaveLength(1);
    expect(file.tables.customReading).toHaveLength(1);
    expect(file.tables.wordOverrides).toHaveLength(2);
  });

  it('survives JSON.stringify and parseBackup', async () => {
    const db = newDb();
    await fill(db);
    const file = await exportBackup(db, '1.0.0');
    const text = JSON.stringify(file);
    expect(() => JSON.parse(text)).not.toThrow();
    const parsed = parseBackup(text);
    expect(parsed).toEqual(file);
    // Binary data is encoded as text, never left as an ArrayBuffer.
    expect(text).toContain('__binary');
    const blob = backupToBlob(file);
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toBe(text);
  });

  it('replace restores every table deeply equal, including binary bytes, into an empty database', async () => {
    const a = newDb();
    await fill(a);
    const text = JSON.stringify(await exportBackup(a, '1.0.0'));

    const b = newDb();
    const result = await restoreBackup(b, parseBackup(text), 'replace');
    expect(result).toEqual({ patients: 2, sessions: 3, customWords: 2 });

    expect(await dump(b)).toEqual(await dump(a));

    const rex = await b.customWords.get('custom-pets-rex');
    expect(rex!.image!.type).toBe('image/webp');
    expect([...new Uint8Array(rex!.image!.data)]).toEqual([...new Uint8Array(IMAGE.data)]);
    expect(rex!.audio!.type).toBe('audio/mp4');
    expect([...new Uint8Array(rex!.audio!.data)]).toEqual([...new Uint8Array(AUDIO.data)]);
    expect(rex!.image!.data).toBeInstanceOf(ArrayBuffer);
    expect((await b.customWords.get('custom-pets-tom'))!.image).toBeNull();
    const override = await b.wordOverrides.get('animals-hedgehog');
    expect([...new Uint8Array(override!.image!.data)]).toEqual([1, 1, 2, 3, 5, 8]);
    const reading = await b.customReading.get('custom-read-1');
    expect([...new Uint8Array(reading!.image!.data)]).toEqual([9, 8, 7]);

    expect(await kvGet('settings', null, b)).toEqual({ autoAdvance: false, voiceUri: 'voice-1', speechRate: 0.8 });
  });

  it('replace wipes what was on the device before', async () => {
    const a = newDb();
    await fill(a);
    const file = await exportBackup(a, '1.0.0');
    const b = newDb();
    await b.patients.put(patient('local', 'LOCAL1'));
    await b.sessions.put(session('local-s', 'local'));
    await kvSet('settings', { autoAdvance: true }, b);
    await b.customCategories.put({ id: 'custom-old', name: 'Old' });
    await restoreBackup(b, file, 'replace');
    expect(await b.patients.get('local')).toBeUndefined();
    expect(await b.sessions.get('local-s')).toBeUndefined();
    expect(await b.customCategories.get('custom-old')).toBeUndefined();
    expect(await b.patients.count()).toBe(2);
    expect(await kvGet('settings', null, b)).toEqual({ autoAdvance: false, voiceUri: 'voice-1', speechRate: 0.8 });
  });

  it('device-only keys are not exported and survive a replace', async () => {
    const a = newDb();
    await fill(a);
    await kvSet('lastBackup', '2026-01-01T00:00:00.000Z', a);
    await kvSet('offlineReady', true, a);
    const file = await exportBackup(a, '1.0.0');
    const keys = (file.tables.kv as { key: string }[]).map((r) => r.key).sort();
    expect(keys).toEqual(['practitioner', 'settings']);

    const b = newDb();
    await kvSet('lastBackup', 'device-b-value', b);
    await restoreBackup(b, file, 'replace');
    expect(await kvGet('lastBackup', null, b)).toBe('device-b-value');
  });

  it('restores into the same database after clearing it', async () => {
    const a = newDb();
    await fill(a);
    const before = await dump(a);
    const file = parseBackup(JSON.stringify(await exportBackup(a, '1.0.0')));
    await a.patients.clear();
    await a.sessions.clear();
    await restoreBackup(a, file, 'replace');
    expect(await dump(a)).toEqual(before);
  });

  it('round-trips a large binary (over the chunk size used for base64)', async () => {
    const a = newDb();
    const big = new Uint8Array(100_000).map((_, i) => (i * 31 + 7) % 256);
    await a.customWords.put({
      id: 'big',
      word: makeWord('big', { group: 'custom-x', custom: true, id: 'big' }),
      image: { type: 'image/webp', data: big.buffer },
      audio: null,
    });
    const b = newDb();
    await restoreBackup(b, parseBackup(JSON.stringify(await exportBackup(a, '1.0.0'))), 'replace');
    const row = await b.customWords.get('big');
    expect(new Uint8Array(row!.image!.data)).toEqual(big);
  });
});

describe('merge', () => {
  it('keeps existing data and adds what is missing', async () => {
    const a = newDb();
    await fill(a);
    const file = parseBackup(JSON.stringify(await exportBackup(a, '1.0.0')));

    const b = newDb();
    await b.patients.put(patient('local-1', 'ZZ99'));
    await b.sessions.put(session('local-s1', 'local-1'));
    await b.customCategories.put({ id: 'custom-local', name: 'Local' });
    await kvSet('settings', { autoAdvance: true, local: true }, b);

    await restoreBackup(b, file, 'merge');

    expect(await b.patients.count()).toBe(3);
    expect(await b.patients.get('local-1')).toBeDefined();
    expect(await b.patients.get('p1')).toBeDefined();
    expect(await b.sessions.count()).toBe(4);
    expect(await b.sessions.get('local-s1')).toBeDefined();
    expect(await b.customCategories.count()).toBe(2);
    expect(await b.customWords.count()).toBe(2);
    expect(await b.wordOverrides.count()).toBe(2);
    // Settings already on the device win; missing keys are filled in.
    expect(await kvGet('settings', null, b)).toEqual({ autoAdvance: true, local: true });
    expect(await kvGet('practitioner', null, b)).toEqual({ name: 'A Therapist', credentials: 'MRCSLT' });
    const rex = await b.customWords.get('custom-pets-rex');
    expect([...new Uint8Array(rex!.audio!.data)]).toEqual([...new Uint8Array(AUDIO.data)]);
  });

  it('does not duplicate a patient with the same ID code and re-attaches their sessions', async () => {
    const a = newDb();
    await fill(a); // p1 = AB12 with s1, s2
    const file = parseBackup(JSON.stringify(await exportBackup(a, '1.0.0')));

    const b = newDb();
    await b.patients.put({ ...patient('different-id', 'AB12'), notes: 'local notes' });
    await b.sessions.put(session('existing', 'different-id'));
    await restoreBackup(b, file, 'merge');

    const all = await b.patients.toArray();
    expect(all.filter((p) => p.code === 'AB12')).toHaveLength(1);
    expect(all).toHaveLength(2); // AB12 (local) and CD34
    // The local record is kept.
    expect((await b.patients.get('different-id'))!.notes).toBe('local notes');
    expect(await b.patients.get('p1')).toBeUndefined();
    // Backed-up sessions now belong to the local patient.
    const sessions = await b.sessions.where('patientId').equals('different-id').toArray();
    expect(sessions.map((s) => s.id).sort()).toEqual(['existing', 's1', 's2']);
    expect(await b.sessions.where('patientId').equals('p1').count()).toBe(0);
    // The other patient is untouched.
    expect((await b.sessions.where('patientId').equals('p2').toArray()).map((s) => s.id)).toEqual(['s3']);
  });

  it('matches ID codes ignoring case and surrounding spaces', async () => {
    const a = newDb();
    await a.patients.put(patient('p1', ' ab12 '));
    await a.sessions.put(session('s1', 'p1'));
    const file = parseBackup(JSON.stringify(await exportBackup(a, '1.0.0')));
    const b = newDb();
    await b.patients.put(patient('local', 'AB12'));
    await restoreBackup(b, file, 'merge');
    expect(await b.patients.count()).toBe(1);
    expect((await b.sessions.get('s1'))!.patientId).toBe('local');
  });

  it('merging the same backup twice adds nothing new', async () => {
    const a = newDb();
    await fill(a);
    const file = parseBackup(JSON.stringify(await exportBackup(a, '1.0.0')));
    const b = newDb();
    await restoreBackup(b, file, 'merge');
    await restoreBackup(b, file, 'merge');
    expect(await b.patients.count()).toBe(2);
    expect(await b.sessions.count()).toBe(3);
    expect(await b.customWords.count()).toBe(2);
  });
});

describe('parseBackup rejects bad input', () => {
  const good = (): BackupFile => ({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created: '2026-01-01T00:00:00.000Z',
    appVersion: '1',
    tables: { patients: [], sessions: [], kv: [], customWords: [], customCategories: [], customReading: [], wordOverrides: [] },
  });

  it('accepts a minimal valid file', () => {
    expect(parseBackup(JSON.stringify(good())).format).toBe(BACKUP_FORMAT);
  });

  it('rejects junk text', () => {
    expect(() => parseBackup('')).toThrow(/not a SMRT Speech backup/);
    expect(() => parseBackup('hello world')).toThrow(/not a SMRT Speech backup/);
    expect(() => parseBackup('{"unterminated":')).toThrow(/not a SMRT Speech backup/);
  });

  it('rejects valid JSON that is not a backup', () => {
    for (const text of ['null', '42', '"text"', '[]', '{}', '{"patients":[]}']) {
      expect(() => parseBackup(text), text).toThrow(/not a SMRT Speech backup/);
    }
  });

  it('rejects the wrong format name', () => {
    expect(() => parseBackup(JSON.stringify({ ...good(), format: 'something-else' }))).toThrow(/not a SMRT Speech backup/);
  });

  it('rejects a file with no tables', () => {
    const { tables: _tables, ...rest } = good();
    expect(() => parseBackup(JSON.stringify(rest))).toThrow(/not a SMRT Speech backup/);
    expect(() => parseBackup(JSON.stringify({ ...good(), tables: 'nope' }))).toThrow(/not a SMRT Speech backup/);
  });

  it('rejects a backup from a newer version of the app', () => {
    expect(() => parseBackup(JSON.stringify({ ...good(), version: BACKUP_VERSION + 1 }))).toThrow(/newer version/);
  });

  // parseBackup only checks `typeof tables === 'object'`, which is also true for null, so a file
  // with "tables": null is accepted and then crashes inside restoreBackup.
  it('rejects a file whose tables is null', () => {
    expect(() => parseBackup(JSON.stringify({ ...good(), tables: null }))).toThrow(/not a SMRT Speech backup/);
  });
});

describe('backupDue', () => {
  const now = new Date('2026-06-30T12:00:00.000Z');
  const state = (over: Partial<BackupState>): BackupState => ({ lastBackup: null, oldestUnsaved: null, sessionsSince: 1, ...over });
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  it('uses the documented thresholds', () => {
    expect(BACKUP_REMINDER_DAYS).toBe(14);
    expect(BACKUP_REMINDER_SESSIONS).toBe(20);
  });

  it('is never due when nothing has changed since the last backup', () => {
    expect(backupDue(state({ sessionsSince: 0, lastBackup: daysAgo(100) }), now)).toBe(false);
    expect(backupDue(state({ sessionsSince: 0 }), now)).toBe(false);
  });

  it('is due at 20 sessions, not at 19', () => {
    expect(backupDue(state({ sessionsSince: 20, lastBackup: daysAgo(1) }), now)).toBe(true);
    expect(backupDue(state({ sessionsSince: 35, lastBackup: daysAgo(1) }), now)).toBe(true);
    expect(backupDue(state({ sessionsSince: 19, lastBackup: daysAgo(1) }), now)).toBe(false);
  });

  it('is due after 14 days since the last backup, not at 13', () => {
    expect(backupDue(state({ lastBackup: daysAgo(14) }), now)).toBe(true);
    expect(backupDue(state({ lastBackup: daysAgo(30) }), now)).toBe(true);
    expect(backupDue(state({ lastBackup: daysAgo(13) }), now)).toBe(false);
  });

  it('with no backup ever, counts from the oldest unsaved session', () => {
    expect(backupDue(state({ lastBackup: null, oldestUnsaved: daysAgo(15) }), now)).toBe(true);
    expect(backupDue(state({ lastBackup: null, oldestUnsaved: daysAgo(3) }), now)).toBe(false);
    expect(backupDue(state({ lastBackup: null, oldestUnsaved: null }), now)).toBe(false);
  });
});
