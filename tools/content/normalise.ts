// Turns authored vocabulary files into complete Word records, in place.
// Derived fields (id, group, wordClass, letters, multiWord, image, firstLetter) are
// computed here so authors never have to keep them in step by hand. Idempotent.
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GROUP_IDS, type BuiltInGroupId, type Word } from '../../src/content/types.ts';

const dir = fileURLToPath(new URL('../../src/content/words/', import.meta.url));

export function slug(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Authored = Partial<Word> & { word: string };

function complete(group: BuiltInGroupId, a: Authored): Word {
  const word = a.word.trim().toLowerCase();
  const id = `${group}-${slug(word)}`;
  const syllables = a.syllables ?? a.phonological?.syllables ?? 1;
  const cues = a.cues!;
  const rec: Word = {
    id,
    word,
    group,
    subgroup: a.subgroup!.trim().toLowerCase(),
    wordClass: group === 'verbs' ? 'verb' : group === 'adjectives' ? 'adjective' : 'noun',
    letters: word.replace(/[^a-z]/g, '').length,
    syllables,
    frequencyBand: a.frequencyBand!,
    multiWord: /\s/.test(word),
    childFriendly: a.childFriendly!,
    image: `${id}.webp`,
    imagePrompt: a.imagePrompt!,
    searchQuery: a.searchQuery,
    ...(a.hasImage === false ? { hasImage: false } : {}),
    cues: {
      definition: cues.definition,
      sentenceCompletion: cues.sentenceCompletion,
      firstLetter: word[0],
      firstSoundSpoken: cues.firstSoundSpoken,
      ...(syllables >= 2 && cues.firstSyllable ? { firstSyllable: cues.firstSyllable } : {}),
    },
    semantic: {
      category: a.semantic!.category,
      use: a.semantic!.use,
      action: a.semantic!.action,
      properties: a.semantic!.properties,
      location: a.semantic!.location,
      association: a.semantic!.association,
    },
    phonological: {
      firstSound: a.phonological!.firstSound,
      lastSound: a.phonological!.lastSound,
      syllables,
      rhyme: a.phonological!.rhyme ?? null,
      sameFirstSound: a.phonological!.sameFirstSound,
    },
  };
  return rec;
}

function read(name: string): Authored[] {
  return JSON.parse(readFileSync(dir + name, 'utf8')) as Authored[];
}

// Verbs are authored in two halves: merge them once.
if (existsSync(dir + 'verbs-a.json') && existsSync(dir + 'verbs-b.json')) {
  const merged = [...read('verbs-a.json'), ...read('verbs-b.json')];
  writeFileSync(dir + 'verbs.json', JSON.stringify(merged, null, 2) + '\n');
  unlinkSync(dir + 'verbs-a.json');
  unlinkSync(dir + 'verbs-b.json');
}

let total = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const group = file.replace('.json', '') as BuiltInGroupId;
  if (!GROUP_IDS.includes(group)) {
    console.warn(`Skipping ${file}: not a known group`);
    continue;
  }
  const words = read(file).map((a) => complete(group, a));
  writeFileSync(dir + file, JSON.stringify(words, null, 2) + '\n');
  total += words.length;
  console.log(`${group}: ${words.length}`);
}
console.log(`Normalised ${total} words`);
