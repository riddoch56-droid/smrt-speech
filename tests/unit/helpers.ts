import type { AppWord } from '../../src/session/words';

/** Builds a complete AppWord with sensible defaults. */
export function makeWord(word: string, over: Partial<AppWord> = {}): AppWord {
  const group = over.group ?? 'food';
  const base: AppWord = {
    id: `${group}-${word.replace(/[^a-z0-9]+/gi, '-')}`,
    word,
    group,
    subgroup: 'fruit',
    wordClass: 'noun',
    letters: word.replace(/[^a-z]/gi, '').length,
    syllables: 1,
    frequencyBand: 1,
    multiWord: /\s/.test(word),
    childFriendly: true,
    image: `${group}-${word}.webp`,
    imagePrompt: `A ${word}`,
    cues: { definition: 'A thing.', sentenceCompletion: 'I see a ___.', firstLetter: word[0], firstSoundSpoken: 'x' },
    semantic: { category: 'c', use: 'u', action: 'a', properties: 'p', location: 'l', association: 's' },
    phonological: { firstSound: word[0], lastSound: word[word.length - 1], syllables: 1, rhyme: null, sameFirstSound: 'y' },
  };
  return { ...base, ...over };
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Unique letters-only word for a numeric index (no digits, so lettersOnly stays true). */
export function nameFor(n: number, prefix = ''): string {
  let s = '';
  let v = n;
  do {
    s = LETTERS[v % 26] + s;
    v = Math.floor(v / 26);
  } while (v > 0);
  return prefix + s;
}

/** A synthetic pool: `perSub` words in each of `subs` subgroups in each of the given groups. */
export function makePool(groups: string[], subs = 2, perSub = 4): AppWord[] {
  const out: AppWord[] = [];
  let n = 0;
  for (const g of groups) {
    for (let s = 0; s < subs; s++) {
      for (let i = 0; i < perSub; i++) {
        out.push(makeWord(nameFor(n++, 'zz'), { group: g, subgroup: `${g}-sub${s}`, id: `${g}-${s}-${i}` }));
      }
    }
  }
  return out;
}
