// Closes the image pipeline:
//  - writes src/content/image-credits.json (source, author, licence for every picture)
//  - flags words without a reviewed picture as hasImage: false in the vocabulary files
//  - removes picture files that never passed review
//  - writes IMAGE_TODO.md
//
//   npx tsx tools/images/finalise.ts
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { GROUP_IDS, GROUP_LABELS, type ImageCredit, type Word } from '../../src/content/types.ts';
import { chosenCandidate, cleanAuthor, loadState, OUT_DIR, ROOT, WORDS_DIR } from './lib.ts';

const state = loadState();
const credits: ImageCredit[] = [];
const todo: Word[] = [];
const keep = new Set<string>();
let total = 0;
let bytes = 0;
const licences = new Map<string, number>();
const providers = new Map<string, number>();

// Pictures added by hand (for example extra reading pictures) keep their existing credit lines.
const creditsFile = ROOT + 'src/content/image-credits.json';
const previous: ImageCredit[] = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, 'utf8')) : [];
const manual = previous.filter((c) => c.source === 'project' || c.source === 'generated');

for (const group of GROUP_IDS) {
  const file = WORDS_DIR + group + '.json';
  const words = JSON.parse(readFileSync(file, 'utf8')) as Word[];
  for (const word of words) {
    total++;
    const st = state[word.id];
    const cand = st?.note === 'picked' ? chosenCandidate(st) : null;
    const manualCredit = manual.find((c) => c.image === word.image);
    const hasFile = existsSync(OUT_DIR + word.image);
    if (manualCredit && hasFile) {
      delete word.hasImage;
      keep.add(word.image);
      credits.push(manualCredit);
      bytes += statSync(OUT_DIR + word.image).size;
      continue;
    }
    if (cand && hasFile) {
      delete word.hasImage;
      keep.add(word.image);
      bytes += statSync(OUT_DIR + word.image).size;
      const mods = ['Resized to fit 512 x 512 pixels on a white background', 'converted to WebP'];
      if (st.trimmed) mods.splice(0, 0, 'plain border trimmed');
      credits.push({
        image: word.image,
        source: cand.provider,
        sourceUrl: cand.sourceUrl,
        author: cleanAuthor(cand.author),
        licence: cand.licence,
        licenceUrl: cand.licenceUrl,
        retrieved: st.retrieved ?? new Date().toISOString().slice(0, 10),
        modifications: mods.join('; ') + '.',
        ...(cand.licenceKind === 'by-sa' ? { flagged: 'CC BY-SA: used as a last resort. Share-alike terms apply to this picture.' } : {}),
      });
      licences.set(cand.licence, (licences.get(cand.licence) ?? 0) + 1);
      providers.set(cand.provider, (providers.get(cand.provider) ?? 0) + 1);
    } else {
      word.hasImage = false;
      todo.push(word);
    }
  }
  writeFileSync(file, JSON.stringify(words, null, 2) + '\n');
}

// Extra pictures (not tied to a vocabulary word) keep their manual credits too.
for (const c of manual) {
  if (!credits.some((x) => x.image === c.image) && existsSync(OUT_DIR + c.image)) {
    credits.push(c);
    keep.add(c.image);
  }
}

for (const f of readdirSync(OUT_DIR)) if (f.endsWith('.webp') && !keep.has(f)) unlinkSync(OUT_DIR + f);

credits.sort((a, b) => a.image.localeCompare(b.image));
writeFileSync(creditsFile, JSON.stringify(credits, null, 1) + '\n');

const lines: string[] = [
  '# Words still needing a picture',
  '',
  `${todo.length} of ${total} words have no picture that passed visual review. They are flagged`,
  '`hasImage: false` and are left out of picture-dependent activities automatically. They still',
  'appear in activities that do not need a picture (Listen and Read, Spell What You Hear).',
  '',
  'To add a picture in the app: Settings > Word management > find the word > Replace picture.',
  'To add one at build time: put a 512 x 512 WebP in `public/images/` named as shown, add a credit',
  'line to `src/content/image-credits.json`, and remove `"hasImage": false` from the word.',
  '',
];
for (const group of GROUP_IDS) {
  const mine = todo.filter((w) => w.group === group);
  if (mine.length === 0) continue;
  lines.push(`## ${GROUP_LABELS[group]} (${mine.length})`, '', '| Word | File | Picture wanted | Attempts |', '|---|---|---|---|');
  for (const w of mine) lines.push(`| ${w.word} | \`${w.image}\` | ${w.imagePrompt.replace(/\|/g, '/')} | ${state[w.id]?.attempts ?? 0} |`);
  lines.push('');
}
writeFileSync(ROOT + 'IMAGE_TODO.md', lines.join('\n'));

console.log(`Pictures: ${credits.length} of ${total} words (${(bytes / 1048576).toFixed(1)} MB). Without a picture: ${todo.length}.`);
console.log('By source:', Object.fromEntries(providers));
console.log('By licence:', Object.fromEntries([...licences.entries()].sort((a, b) => b[1] - a[1])));
