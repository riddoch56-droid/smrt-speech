import { describe, expect, it } from 'vitest';
import { localDate, reportFileName, safeFilePart } from '../../src/platform/share';
import { hashPin, isValidPin, verifyPin } from '../../src/platform/system';
import { chooseVoice } from '../../src/platform/speech';
import { pickMimeType } from '../../src/platform/recorder';

describe('safeFilePart and reportFileName', () => {
  it('keeps safe characters and replaces runs of others with a single hyphen', () => {
    expect(safeFilePart('AB12')).toBe('AB12');
    expect(safeFilePart('Naming Practice')).toBe('Naming-Practice');
    expect(safeFilePart('  a / b \\ c  ')).toBe('a-b-c');
    expect(safeFilePart('x___y-z')).toBe('x___y-z');
    expect(safeFilePart('../../etc/passwd')).toBe('etc-passwd');
    expect(safeFilePart('Ab:Cd*?"<>|')).toBe('Ab-Cd');
  });

  it('falls back to "file" when nothing is left', () => {
    expect(safeFilePart('')).toBe('file');
    expect(safeFilePart('   ')).toBe('file');
    expect(safeFilePart('///')).toBe('file');
  });

  it('follows SMRTSpeech_<patientID>_<activity>_<YYYY-MM-DD>.pdf', () => {
    expect(reportFileName('AB12', 'Listen', '2026-05-03T09:30:00.000Z', 'pdf')).toBe('SMRTSpeech_AB12_Listen_2026-05-03.pdf');
    expect(reportFileName('AB12', 'Naming Practice', '2026-05-03', 'pdf')).toBe('SMRTSpeech_AB12_Naming-Practice_2026-05-03.pdf');
    expect(reportFileName('AB12', 'progress', '2026-05-03', 'pdf')).toMatch(/^SMRTSpeech_[A-Za-z0-9_-]+_[A-Za-z0-9_-]+_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('uses the local calendar date of a Date, zero-padded', () => {
    const d = new Date(2026, 0, 5, 23, 59);
    expect(localDate(d)).toBe('2026-01-05');
    expect(reportFileName('P1', 'Copy', d, 'pdf')).toBe('SMRTSpeech_P1_Copy_2026-01-05.pdf');
  });

  it('sanitises a patient code with unsafe characters', () => {
    expect(reportFileName('A B/12', 'Read', '2026-02-03', 'pdf')).toBe('SMRTSpeech_A-B-12_Read_2026-02-03.pdf');
  });

  it('uses the requested extension', () => {
    expect(reportFileName('P', 'Backup', '2026-02-03', 'json').endsWith('.json')).toBe(true);
  });
});

describe('PIN helpers', () => {
  it('isValidPin accepts exactly four digits', () => {
    expect(isValidPin('0000')).toBe(true);
    expect(isValidPin('1234')).toBe(true);
    for (const bad of ['', '123', '12345', 'abcd', '12a4', ' 123', '123 ', '1.23', '१२३४']) expect(isValidPin(bad), bad).toBe(false);
  });

  it('hashPin stores a salt and hash, never the PIN', async () => {
    const rec = await hashPin('1234');
    expect(rec.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(rec.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rec)).not.toContain('1234');
  });

  it('verifyPin accepts the right PIN and rejects a wrong one', async () => {
    const rec = await hashPin('4821');
    expect(await verifyPin('4821', rec)).toBe(true);
    expect(await verifyPin('4822', rec)).toBe(false);
    expect(await verifyPin('', rec)).toBe(false);
  });

  it('salts differently each time, so equal PINs give different records', async () => {
    const a = await hashPin('1111');
    const b = await hashPin('1111');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPin('1111', a)).toBe(true);
    expect(await verifyPin('1111', b)).toBe(true);
  });

  it('a record made with one salt does not verify with another record’s hash', async () => {
    const a = await hashPin('1111');
    const b = await hashPin('1111');
    expect(await verifyPin('1111', { salt: a.salt, hash: b.hash })).toBe(false);
  });
});

describe('chooseVoice', () => {
  const v = (voiceURI: string, lang: string, localService: boolean) => ({ voiceURI, name: voiceURI, lang, localService, default: false }) as SpeechSynthesisVoice;

  const fr = v('fr-local', 'fr-FR', true);
  const usLocal = v('us-local', 'en-US', true);
  const usRemote = v('us-remote', 'en-US', false);
  const gbRemote = v('gb-remote', 'en-GB', false);
  const gbLocal = v('gb-local', 'en-GB', true);
  const gbLocalUnderscore = v('gb-under', 'en_GB', true);

  it('prefers the saved voice when it is installed', () => {
    expect(chooseVoice([fr, usLocal, usRemote, gbLocal], 'us-remote')?.voiceURI).toBe('us-remote');
    expect(chooseVoice([usLocal, gbLocal], 'us-local')?.voiceURI).toBe('us-local');
  });

  it('then a local en-GB voice', () => {
    expect(chooseVoice([fr, usLocal, gbRemote, gbLocal], null)?.voiceURI).toBe('gb-local');
    expect(chooseVoice([usLocal, gbRemote, gbLocal], 'not-installed')?.voiceURI).toBe('gb-local');
  });

  it('then any en-GB voice', () => {
    expect(chooseVoice([fr, usLocal, usRemote, gbRemote], null)?.voiceURI).toBe('gb-remote');
  });

  it('then an English voice, local first', () => {
    expect(chooseVoice([fr, usRemote, usLocal], null)?.voiceURI).toBe('us-local');
    expect(chooseVoice([fr, usRemote], null)?.voiceURI).toBe('us-remote');
  });

  it('recognises en_GB written with an underscore', () => {
    expect(chooseVoice([usLocal, gbLocalUnderscore], null)?.voiceURI).toBe('gb-under');
  });

  it('returns null when no English voice exists', () => {
    expect(chooseVoice([fr], null)).toBeNull();
    expect(chooseVoice([], null)).toBeNull();
  });
});

describe('pickMimeType', () => {
  it('takes the first supported candidate, preferring audio/mp4 (Safari)', () => {
    expect(pickMimeType(() => true)).toBe('audio/mp4');
    expect(pickMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMimeType((t) => t === 'audio/webm')).toBe('audio/webm');
  });

  it('returns an empty string when nothing is supported', () => {
    expect(pickMimeType(() => false)).toBe('');
  });

  it('survives a support check that throws', () => {
    expect(
      pickMimeType((t) => {
        if (t === 'audio/mp4') throw new Error('boom');
        return t === 'audio/webm';
      }),
    ).toBe('audio/webm');
  });
});
