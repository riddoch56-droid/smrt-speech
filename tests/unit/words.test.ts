import { describe, expect, it } from 'vitest';
import { countLetters, filterWords, isLettersOnly, lengthBucket, syllableBucket, wordHasPicture, type AppWord } from '../../src/session/words';
import { makeWord } from './helpers';

const ids = (ws: readonly AppWord[]) => ws.map((w) => w.id).sort();

describe('filterWords', () => {
  const words: AppWord[] = [
    makeWord('apple', { group: 'food', syllables: 2 }),
    makeWord('beer', { group: 'food', childFriendly: false }),
    makeWord('dog', { group: 'animals' }),
    makeWord('ice cream', { group: 'food', syllables: 2 }),
    makeWord('t-shirt', { group: 'clothing' }),
    makeWord('hedgehog', { group: 'animals', syllables: 3, hasImage: false }),
    makeWord('refrigerator', { group: 'household', syllables: 5 }),
    makeWord('television', { group: 'household', syllables: 4 }),
  ];

  it('returns everything with an empty filter', () => {
    expect(filterWords(words, {})).toHaveLength(words.length);
  });

  it('filters by groups; an empty list means all groups', () => {
    expect(ids(filterWords(words, { groups: ['animals'] }))).toEqual(['animals-dog', 'animals-hedgehog']);
    expect(filterWords(words, { groups: ['animals', 'clothing'] })).toHaveLength(3);
    expect(filterWords(words, { groups: [] })).toHaveLength(words.length);
  });

  it('child-friendly hides words where childFriendly is false', () => {
    const out = filterWords(words, { childFriendlyOnly: true });
    expect(out.map((w) => w.word)).not.toContain('beer');
    expect(out).toHaveLength(words.length - 1);
    expect(filterWords(words, { childFriendlyOnly: false })).toHaveLength(words.length);
  });

  it('hides disabled ids', () => {
    const out = filterWords(words, { disabledIds: new Set(['animals-dog', 'food-apple']) });
    expect(out.map((w) => w.word)).not.toContain('dog');
    expect(out.map((w) => w.word)).not.toContain('apple');
    expect(out).toHaveLength(words.length - 2);
  });

  it('requireImage drops words without a picture, unless the picture has been replaced', () => {
    const out = filterWords(words, { requireImage: true });
    expect(out.map((w) => w.word)).not.toContain('hedgehog');
    expect(out).toHaveLength(words.length - 1);
    const replaced = filterWords(words, { requireImage: true, replacedImageIds: new Set(['animals-hedgehog']) });
    expect(replaced.map((w) => w.word)).toContain('hedgehog');
    expect(filterWords(words, {})).toHaveLength(words.length);
  });

  it('wordHasPicture treats hasImage undefined as having a picture', () => {
    expect(wordHasPicture(makeWord('cat'))).toBe(true);
    expect(wordHasPicture(makeWord('cat', { hasImage: true }))).toBe(true);
    expect(wordHasPicture(makeWord('cat', { hasImage: false }))).toBe(false);
    expect(wordHasPicture(makeWord('cat', { hasImage: false, id: 'x' }), new Set(['x']))).toBe(true);
  });

  it('lettersOnly drops multi-word and hyphenated words', () => {
    const out = filterWords(words, { lettersOnly: true }).map((w) => w.word);
    expect(out).not.toContain('ice cream');
    expect(out).not.toContain('t-shirt');
    expect(out).toContain('apple');
    expect(out).toHaveLength(words.length - 2);
  });

  it('lettersOnly drops a multiWord word even if its text looks like letters', () => {
    expect(filterWords([makeWord('icecream', { multiWord: true })], { lettersOnly: true })).toHaveLength(0);
  });

  it('length buckets: 3 to 9 match exactly, 10 means ten or more', () => {
    expect(filterWords(words, { lengths: [5] }).map((w) => w.word)).toEqual(['apple']);
    expect(filterWords(words, { lengths: [3] }).map((w) => w.word)).toEqual(['dog']);
    const ten = filterWords(words, { lengths: [10] }).map((w) => w.word);
    expect(ten).toEqual(['refrigerator', 'television']);
    expect(filterWords(words, { lengths: [3, 4] }).map((w) => w.word).sort()).toEqual(['beer', 'dog']);
    expect(filterWords(words, { lengths: [] })).toHaveLength(words.length);
  });

  it('words shorter than three letters fall in the 3 bucket', () => {
    expect(filterWords([makeWord('an')], { lengths: [3] })).toHaveLength(1);
    expect(lengthBucket(2)).toBe(3);
  });

  it('syllable buckets: 1 to 4 exact, 5 means five or more', () => {
    expect(filterWords(words, { syllables: [2] }).map((w) => w.word).sort()).toEqual(['apple', 'ice cream']);
    expect(filterWords(words, { syllables: [5] }).map((w) => w.word)).toEqual(['refrigerator']);
    const six = makeWord('extraordinary', { syllables: 6 });
    expect(filterWords([...words, six], { syllables: [5] }).map((w) => w.word).sort()).toEqual(['extraordinary', 'refrigerator']);
    expect(filterWords(words, { syllables: [1] }).map((w) => w.word)).toEqual(['beer', 'dog', 't-shirt']);
    expect(filterWords(words, { syllables: [] })).toHaveLength(words.length);
  });

  it('combines filters', () => {
    const out = filterWords(words, { groups: ['food'], childFriendlyOnly: true, lettersOnly: true, syllables: [2] });
    expect(out.map((w) => w.word)).toEqual(['apple']);
  });

  it('does not mutate its input', () => {
    const copy = words.slice();
    filterWords(words, { groups: ['food'] });
    expect(words).toEqual(copy);
  });
});

describe('custom words and patients', () => {
  const builtIn = makeWord('apple');
  const forEveryone = makeWord('quokka', { group: 'custom-x', custom: true, patientId: null });
  const unassigned = makeWord('okapi', { group: 'custom-x', custom: true });
  const forP1 = makeWord('wombat', { group: 'custom-x', custom: true, patientId: 'p1' });
  const forP2 = makeWord('numbat', { group: 'custom-x', custom: true, patientId: 'p2' });
  const all = [builtIn, forEveryone, unassigned, forP1, forP2];

  it('hides custom words assigned to another patient', () => {
    expect(filterWords(all, { patientId: 'p1' }).map((w) => w.word).sort()).toEqual(['apple', 'okapi', 'quokka', 'wombat']);
    expect(filterWords(all, { patientId: 'p2' }).map((w) => w.word).sort()).toEqual(['apple', 'numbat', 'okapi', 'quokka']);
  });

  it('guest (no patient) sees only built-in and unassigned custom words', () => {
    expect(filterWords(all, { patientId: null }).map((w) => w.word).sort()).toEqual(['apple', 'okapi', 'quokka']);
    expect(filterWords(all, {}).map((w) => w.word).sort()).toEqual(['apple', 'okapi', 'quokka']);
  });

  it('assignment never hides built-in words', () => {
    const b = makeWord('pear', { patientId: 'p9' });
    expect(filterWords([b], { patientId: 'p1' })).toHaveLength(1);
  });
});

describe('small helpers', () => {
  it('isLettersOnly', () => {
    expect(isLettersOnly('apple')).toBe(true);
    expect(isLettersOnly('Apple')).toBe(true);
    expect(isLettersOnly('ice cream')).toBe(false);
    expect(isLettersOnly('t-shirt')).toBe(false);
    expect(isLettersOnly('')).toBe(false);
  });

  it('countLetters excludes spaces and hyphens', () => {
    expect(countLetters('ice cream')).toBe(8);
    expect(countLetters('t-shirt')).toBe(6);
    expect(countLetters('apple')).toBe(5);
  });

  it('buckets', () => {
    expect([2, 3, 9, 10, 14].map(lengthBucket)).toEqual([3, 3, 9, 10, 10]);
    expect([0, 1, 4, 5, 7].map(syllableBucket)).toEqual([1, 1, 4, 5, 5]);
  });
});
