// Builds src/content/reading/phrases.json and sentences.json from the authored files in
// tools/content/reading-authored/. Derived fields (id, image, group, cloze) are computed here.
//
//   npx tsx tools/content/build-reading.ts
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ReadingItem, Word } from '../../src/content/types.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const srcDir = root + 'tools/content/reading-authored/';
const wordsDir = root + 'src/content/words/';

interface Authored {
  wordId: string;
  kind: 'phrase' | 'sentence';
  text: string;
  distractors: string[];
  answer: string;
  answerDistractors: string[];
}

const words = new Map<string, Word>();
for (const f of readdirSync(wordsDir).filter((x) => x.endsWith('.json'))) {
  for (const w of JSON.parse(readFileSync(wordsDir + f, 'utf8')) as Word[]) words.set(w.id, w);
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function makeCloze(kind: 'phrase' | 'sentence', text: string, answer: string): string {
  if (kind === 'phrase') return text.replace(new RegExp(`${esc(answer)}$`), '___');
  return text.replace(new RegExp(`\\b${esc(answer)}\\b`), '___');
}

const items: ReadingItem[] = [];
const seen = new Set<string>();
let skipped = 0;
for (const f of existsSync(srcDir) ? readdirSync(srcDir).filter((x) => x.endsWith('.json')).sort() : []) {
  for (const a of JSON.parse(readFileSync(srcDir + f, 'utf8')) as Authored[]) {
    const word = words.get(a.wordId);
    const id = `${a.kind}-${a.wordId}`;
    // Only words with a reviewed picture can carry a reading item.
    if (!word || word.hasImage === false || !existsSync(root + 'public/images/' + word.image) || seen.has(id)) {
      skipped++;
      continue;
    }
    seen.add(id);
    const cloze = makeCloze(a.kind, a.text, a.answer);
    if (!cloze.includes('___')) {
      skipped++;
      continue;
    }
    items.push({
      id,
      kind: a.kind,
      image: word.image,
      wordId: word.id,
      group: word.group,
      text: a.text,
      distractors: a.distractors,
      cloze,
      answer: a.answer,
      answerDistractors: a.answerDistractors,
      childFriendly: word.childFriendly,
    });
  }
}

items.sort((a, b) => a.id.localeCompare(b.id));
const phrases = items.filter((i) => i.kind === 'phrase');
const sentences = items.filter((i) => i.kind === 'sentence');
writeFileSync(root + 'src/content/reading/phrases.json', JSON.stringify(phrases, null, 1) + '\n');
writeFileSync(root + 'src/content/reading/sentences.json', JSON.stringify(sentences, null, 1) + '\n');
console.log(`Reading content: ${phrases.length} phrases, ${sentences.length} sentences (${skipped} skipped).`);
