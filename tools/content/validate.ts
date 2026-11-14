// Content validation CLI. Usage: npm run validate:content [-- --allow-incomplete]
// Exits 1 when any error is found. With --allow-incomplete, unfinished work (empty screener,
// reading content still being written, images not yet sourced) is reported as warnings so
// the check can run mid-build.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GROUP_IDS, type ImageCredit, type ReadingItem, type Screener, type Word } from '../../src/content/types.ts';
import { validateContent } from './validate-lib.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const allowIncomplete = process.argv.includes('--allow-incomplete');
const loadErrors: string[] = [];
const loadWarnings: string[] = [];

function readJson<T>(rel: string, fallback: T): T {
  const file = root + rel;
  if (!existsSync(file)) {
    (allowIncomplete ? loadWarnings : loadErrors).push(`${rel}: file not found`);
    return fallback;
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch (e) {
    loadErrors.push(`${rel}: invalid JSON (${(e as Error).message})`);
    return fallback;
  }
}

function readArray<T>(rel: string): T[] {
  const data = readJson<unknown>(rel, []);
  if (!Array.isArray(data)) {
    loadErrors.push(`${rel}: top level must be an array`);
    return [];
  }
  return data as T[];
}

const words: Word[] = GROUP_IDS.flatMap((g) => readArray<Word>(`src/content/words/${g}.json`));
const readingItems: ReadingItem[] = [...readArray<ReadingItem>('src/content/reading/phrases.json'), ...readArray<ReadingItem>('src/content/reading/sentences.json')];
const screener = readJson<Screener>('src/content/screener.json', { version: 1, frozen: '', items: [] });
const credits = readArray<ImageCredit>('src/content/image-credits.json');

const imageFiles = new Map<string, number>();
const imageDir = root + 'public/images';
if (existsSync(imageDir)) {
  for (const name of readdirSync(imageDir)) {
    const stat = statSync(`${imageDir}/${name}`);
    if (stat.isFile()) imageFiles.set(name, stat.size);
  }
} else {
  (allowIncomplete ? loadWarnings : loadErrors).push('public/images: folder not found');
}

const result = validateContent({ words, readingItems, screener, credits, imageFiles }, { requireReading: !allowIncomplete, allowIncomplete });
const errors = [...loadErrors, ...result.errors];
const warnings = [...loadWarnings, ...result.warnings];

const MAX_SHOWN = 200;
function print(label: string, list: string[], log: (s: string) => void) {
  if (list.length === 0) return;
  log(`\n${label} (${list.length})`);
  for (const m of list.slice(0, MAX_SHOWN)) log(`  - ${m}`);
  if (list.length > MAX_SHOWN) log(`  ... and ${list.length - MAX_SHOWN} more`);
}

print('Warnings', warnings, console.warn);
print('Errors', errors, console.error);

const s = result.stats;
console.log('\nSummary');
console.log(`  Words: ${s.words} (${GROUP_IDS.map((g) => `${g} ${s[`group:${g}`] ?? 0}`).join(', ')})`);
console.log(`  Multi-word: ${s.multiWord}, without a picture: ${s.wordsWithoutPicture}`);
console.log(`  Images: ${s.imageFiles} files, ${(s.imageBytes / 1048576).toFixed(2)} MB, ${s.imagesOverTarget} over 60 KB, ${s.missingImageFiles} still missing`);
console.log(`  Credits: ${s.credits} entries, ${s.missingCredits} words without one, ${s.shareAlikeImages} share-alike`);
console.log(`  Screener: ${s.screenerItems} items (version ${screener.version})`);
console.log(`  Reading: ${s.phrases} phrases, ${s.sentences} sentences`);
console.log(`  ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}${allowIncomplete ? ' (incomplete content allowed)' : ''}`);

if (errors.length > 0) {
  console.error('\nContent validation FAILED');
  process.exit(1);
}
console.log('\nContent validation passed');
