// Writes CONTENT_REVIEW.csv in the project root, for the therapist's clinical review of the
// vocabulary and reading content outside the app. Usage: npm run export:review
// UTF-8 with a byte order mark (so Excel opens it correctly), CRLF line endings, RFC 4180 quoting.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GROUP_IDS, type ReadingItem, type Word } from '../../src/content/types.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

const WORD_HEADER = [
  'ID',
  'Word',
  'Group',
  'Subgroup',
  'Word class',
  'Syllables',
  'Letters',
  'Frequency band',
  'Child friendly',
  'Has picture',
  'Cue: description',
  'Cue: sentence completion',
  'Cue: first letter',
  'Cue: first sound (spoken)',
  'Cue: first syllable',
  'Meaning: category',
  'Meaning: use',
  'Meaning: action',
  'Meaning: properties',
  'Meaning: location',
  'Meaning: association',
  'Sound: first sound',
  'Sound: last sound',
  'Sound: syllables',
  'Sound: rhyme',
  'Sound: same first sound',
];

const READING_HEADER = ['ID', 'Kind', 'Text', 'Distractors', 'Cloze', 'Answer', 'Answer distractors'];

const yesNo = (b: boolean | undefined) => (b === false ? 'No' : 'Yes');

export function wordRow(w: Word): unknown[] {
  return [
    w.id,
    w.word,
    w.group,
    w.subgroup,
    w.wordClass,
    w.syllables,
    w.letters,
    w.frequencyBand,
    w.childFriendly ? 'Yes' : 'No',
    yesNo(w.hasImage),
    w.cues.definition,
    w.cues.sentenceCompletion,
    w.cues.firstLetter,
    w.cues.firstSoundSpoken,
    w.cues.firstSyllable ?? '',
    w.semantic.category,
    w.semantic.use,
    w.semantic.action,
    w.semantic.properties,
    w.semantic.location,
    w.semantic.association,
    w.phonological.firstSound,
    w.phonological.lastSound,
    w.phonological.syllables,
    w.phonological.rhyme ?? '',
    w.phonological.sameFirstSound,
  ];
}

export function readingRow(r: ReadingItem): unknown[] {
  return [r.id, r.kind, r.text, r.distractors.join(' | '), r.cloze, r.answer, r.answerDistractors.join(' | ')];
}

export function buildCsv(words: Word[], reading: ReadingItem[]): string {
  const lines: string[] = [csvRow(WORD_HEADER), ...words.map((w) => csvRow(wordRow(w)))];
  lines.push('', csvRow(['READING ITEMS']), csvRow(READING_HEADER), ...reading.map((r) => csvRow(readingRow(r))));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function readArray<T>(rel: string): T[] {
  const file = root + rel;
  if (!existsSync(file)) {
    console.warn(`Skipping ${rel}: file not found`);
    return [];
  }
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${rel}: top level must be an array`);
  return data as T[];
}

function main() {
  const words = GROUP_IDS.flatMap((g) => readArray<Word>(`src/content/words/${g}.json`));
  const reading = [...readArray<ReadingItem>('src/content/reading/phrases.json'), ...readArray<ReadingItem>('src/content/reading/sentences.json')];
  writeFileSync(root + 'CONTENT_REVIEW.csv', buildCsv(words, reading), 'utf8');
  console.log(`Wrote CONTENT_REVIEW.csv: ${words.length} words, ${reading.length} reading items`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
