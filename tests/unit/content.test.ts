import { describe, expect, it } from 'vitest';
import type { ImageCredit, ReadingItem, Word } from '../../src/content/types';
import {
  containsTarget,
  hasSingleBlank,
  validateContent,
  wordForms,
  type ValidateInput,
  type ValidateOptions,
} from '../../tools/content/validate-lib';

// ---- Fixtures ------------------------------------------------------------------------------

interface Fixture {
  input: ValidateInput;
  opts: ValidateOptions;
}

function word(text: string, group: string, wordClass: Word['wordClass'], extra: Partial<Word> = {}, syllables = 1): Word {
  const id = `${group}-${text.replace(/\s+/g, '-')}`;
  return {
    id,
    word: text,
    group,
    subgroup: 'basics',
    wordClass,
    letters: text.replace(/[\s-]/g, '').length,
    syllables,
    frequencyBand: 1,
    multiWord: /\s/.test(text),
    childFriendly: true,
    image: `${id}.webp`,
    imagePrompt: 'A plain picture on a white background',
    cues: {
      definition: 'You can see it in many homes.',
      sentenceCompletion: 'Yesterday I noticed the ___ again.',
      firstLetter: text[0],
      firstSoundSpoken: 'buh',
      ...(syllables >= 2 ? { firstSyllable: text.slice(0, 2) } : {}),
    },
    semantic: {
      category: 'It belongs to a familiar group.',
      use: 'People talk about it often.',
      action: 'It does not do very much.',
      properties: 'It is easy to recognise.',
      location: 'You find it nearby.',
      association: 'It reminds me of home.',
    },
    phonological: { firstSound: text[0], lastSound: text[text.length - 1], syllables, rhyme: 'wug', sameFirstSound: 'zebra' },
    ...extra,
  };
}

function credit(image: string, extra: Partial<ImageCredit> = {}): ImageCredit {
  return {
    image,
    source: 'wikimedia-commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
    author: 'A. Photographer',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    retrieved: '2026-10-01',
    modifications: 'Cropped and converted to WebP',
    ...extra,
  };
}

function reading(id: string, kind: 'phrase' | 'sentence', extra: Partial<ReadingItem> = {}): ReadingItem {
  const text = kind === 'phrase' ? 'a cup of tea' : 'The man is reading a book.';
  const answer = kind === 'phrase' ? 'tea' : 'book';
  return {
    id,
    kind,
    image: `${id}.webp`,
    group: 'household',
    text,
    distractors: kind === 'phrase' ? ['a cup of milk', 'a glass of tea', 'a bowl of tea'] : ['The woman is reading a book.', 'The man is eating a book.', 'The man is reading a letter.'],
    cloze: text.replace(answer, '___'),
    answer,
    answerDistractors: kind === 'phrase' ? ['milk', 'juice', 'water'] : ['letter', 'paper', 'menu'],
    childFriendly: true,
    ...extra,
  };
}

function clean(): Fixture {
  const words = [
    word('apple', 'food', 'noun', {}, 2),
    word('pear', 'food', 'noun'),
    word('cat', 'animals', 'noun'),
    word('dog', 'animals', 'noun'),
    word('run', 'verbs', 'verb'),
    word('jump', 'verbs', 'verb'),
  ];
  const readingItems = [reading('p1', 'phrase'), reading('p2', 'phrase'), reading('s1', 'sentence'), reading('s2', 'sentence')];
  const images = [...words.map((w) => w.image), ...readingItems.map((r) => r.image)];
  return {
    input: {
      words,
      readingItems,
      screener: {
        version: 1,
        frozen: '2026-11-14',
        items: [
          { wordId: 'food-apple', order: 1 },
          { wordId: 'animals-cat', order: 2 },
          { wordId: 'verbs-run', order: 3 },
        ],
      },
      credits: images.map((i) => credit(i)),
      imageFiles: new Map(images.map((i) => [i, 40 * 1024])),
    },
    opts: { expected: { total: 6, perGroup: { food: 2, animals: 2, verbs: 2 }, screener: 3, minReading: 2 } },
  };
}

function run(mutate?: (f: Fixture) => void, optsOverride: Partial<ValidateOptions> = {}) {
  const f = clean();
  mutate?.(f);
  return validateContent(f.input, { ...f.opts, ...optsOverride });
}

const has = (list: string[], text: string | RegExp) =>
  list.some((m) => (typeof text === 'string' ? m.includes(text) : text.test(m)));

/** Expect exactly this kind of error and nothing else. */
function expectOnlyError(result: ReturnType<typeof run>, text: string | RegExp) {
  expect(result.errors.length, result.errors.join('\n')).toBeGreaterThan(0);
  expect(has(result.errors, text), result.errors.join('\n')).toBe(true);
}

const word0 = (f: Fixture) => f.input.words[0];

// ---- Tests ---------------------------------------------------------------------------------

describe('validateContent: clean fixture', () => {
  it('passes with no errors or warnings', () => {
    const r = run();
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats.words).toBe(6);
    expect(r.stats['group:food']).toBe(2);
    expect(r.stats.screenerItems).toBe(3);
    expect(r.stats.phrases).toBe(2);
    expect(r.stats.sentences).toBe(2);
    expect(r.stats.imageFiles).toBe(10);
    expect(r.stats.imageBytes).toBe(10 * 40 * 1024);
  });

  it('fails the real defaults (700 words, 30 screener items, 200+200 reading) for a small fixture', () => {
    const f = clean();
    const r = validateContent(f.input);
    expect(has(r.errors, 'Expected exactly 700 words, found 6')).toBe(true);
    expect(has(r.errors, 'Group "food" has 2 words, expected 54')).toBe(true);
    expect(has(r.errors, 'Group "verbs" has 2 words, expected 100')).toBe(true);
    expect(has(r.errors, 'expected exactly 30 items')).toBe(true);
    expect(has(r.errors, 'at least 200 phrase')).toBe(true);
    expect(has(r.errors, 'at least 200 sentence')).toBe(true);
  });
});

describe('validateContent: word counts and identity', () => {
  it('wrong total', () => {
    expectOnlyError(run((f) => f.input.words.pop()), /Expected exactly 6 words, found 5/);
  });

  it('wrong count in a group', () => {
    expectOnlyError(run((f) => (word0(f).group = 'animals')), /Group "food" has 1 words, expected 2/);
  });

  it('a group that is not in the expected list', () => {
    expectOnlyError(run((f) => (word0(f).group = 'mystery')), /Unknown group "mystery"/);
  });

  it('duplicate id', () => {
    expectOnlyError(run((f) => (f.input.words[1].id = word0(f).id)), 'duplicate id');
  });

  it('duplicate word string, case-insensitively', () => {
    expectOnlyError(run((f) => (f.input.words[1].word = 'Apple')), /duplicate word "Apple"/);
  });
});

describe('validateContent: required fields', () => {
  it.each([
    ['id', (w: Word) => ((w as unknown as Record<string, unknown>).id = ''), 'missing id'],
    ['word', (w: Word) => (w.word = ' '), 'missing word'],
    ['subgroup', (w: Word) => (w.subgroup = ''), 'missing subgroup'],
    ['image', (w: Word) => (w.image = ''), 'missing image'],
    ['imagePrompt', (w: Word) => (w.imagePrompt = ''), 'missing imagePrompt'],
    ['cues.definition', (w: Word) => (w.cues.definition = ''), 'missing cues.definition'],
    ['cues.sentenceCompletion', (w: Word) => (w.cues.sentenceCompletion = ''), 'missing cues.sentenceCompletion'],
    ['cues.firstLetter', (w: Word) => (w.cues.firstLetter = ''), 'missing cues.firstLetter'],
    ['cues.firstSoundSpoken', (w: Word) => (w.cues.firstSoundSpoken = ''), 'missing cues.firstSoundSpoken'],
    ['semantic.use', (w: Word) => (w.semantic.use = ''), 'missing semantic.use'],
    ['semantic.association', (w: Word) => (w.semantic.association = '  '), 'missing semantic.association'],
    ['phonological.firstSound', (w: Word) => (w.phonological.firstSound = ''), 'missing phonological.firstSound'],
    ['phonological.sameFirstSound', (w: Word) => (w.phonological.sameFirstSound = ''), 'missing phonological.sameFirstSound'],
  ])('%s empty is an error', (_name, mutate, message) => {
    // Use the second word so an empty id or word does not disturb the first word's tag.
    expectOnlyError(
      run((f) => mutate(f.input.words[1])),
      message,
    );
  });

  it('wrong types', () => {
    expectOnlyError(run((f) => ((word0(f) as unknown as Record<string, unknown>).letters = '5')), 'letters must be a number');
    expectOnlyError(run((f) => ((word0(f) as unknown as Record<string, unknown>).childFriendly = 'yes')), 'childFriendly must be true or false');
    expectOnlyError(run((f) => ((word0(f) as unknown as Record<string, unknown>).frequencyBand = 4)), 'frequencyBand');
    expectOnlyError(run((f) => ((word0(f) as unknown as Record<string, unknown>).wordClass = 'pronoun')), 'wordClass');
    expectOnlyError(run((f) => ((word0(f) as unknown as Record<string, unknown>).multiWord = 'no')), 'multiWord must be true or false');
    expectOnlyError(run((f) => ((word0(f).phonological as unknown as Record<string, unknown>).syllables = '2')), 'phonological.syllables must be a number');
  });

  it('missing blocks', () => {
    expectOnlyError(run((f) => ((f.input.words[1] as unknown as Record<string, unknown>).semantic = undefined)), 'missing semantic');
  });

  it('rhyme may be null but not an empty string', () => {
    expect(run((f) => (word0(f).phonological.rhyme = null)).errors).toEqual([]);
    expectOnlyError(run((f) => (word0(f).phonological.rhyme = '')), 'phonological.rhyme');
  });

  it('firstSyllable is required for 2+ syllables only', () => {
    expectOnlyError(run((f) => delete word0(f).cues.firstSyllable), 'missing cues.firstSyllable');
    // One-syllable words do not need it.
    expect(run().errors).toEqual([]);
    expect(run((f) => delete f.input.words[1].cues.firstSyllable).errors).toEqual([]);
  });
});

describe('validateContent: derived fields', () => {
  it('letters must equal the count excluding spaces and hyphens', () => {
    expectOnlyError(run((f) => (word0(f).letters = 6)), 'letters is 6 but "apple" has 5');
    const spaced = run((f) => {
      Object.assign(f.input.words[1], { word: 'ice cream', letters: 9, multiWord: true, cues: { ...f.input.words[1].cues, firstLetter: 'i' } });
    });
    expect(has(spaced.errors, 'letters is 9 but "ice cream" has 8')).toBe(true);
    const hyphen = run((f) => {
      Object.assign(f.input.words[1], { word: 't-shirt', letters: 7, cues: { ...f.input.words[1].cues, firstLetter: 't' } });
    });
    expect(has(hyphen.errors, 'letters is 7 but "t-shirt" has 6')).toBe(true);
    const ok = run((f) => {
      Object.assign(f.input.words[1], { word: 't-shirt', letters: 6, cues: { ...f.input.words[1].cues, firstLetter: 't' } });
    });
    expect(ok.errors).toEqual([]);
  });

  it('multiWord must match the presence of a space', () => {
    expectOnlyError(run((f) => (word0(f).multiWord = true)), 'multiWord is true but "apple" has no space');
    const r = run((f) => {
      Object.assign(f.input.words[1], { word: 'ice cream', letters: 8, multiWord: false, cues: { ...f.input.words[1].cues, firstLetter: 'i' } });
    });
    expect(has(r.errors, 'multiWord is false but "ice cream" contains space')).toBe(true);
    const ok = run((f) => {
      Object.assign(f.input.words[1], { word: 'ice cream', letters: 8, multiWord: true, cues: { ...f.input.words[1].cues, firstLetter: 'i' } });
    });
    expect(ok.errors).toEqual([]);
    expect(ok.stats.multiWord).toBe(1);
  });

  it('firstLetter must match the word', () => {
    expectOnlyError(run((f) => (word0(f).cues.firstLetter = 'b')), 'cues.firstLetter "b" does not match "apple"');
  });

  it('phonological.syllables must equal syllables', () => {
    expectOnlyError(run((f) => (word0(f).phonological.syllables = 3)), 'phonological.syllables (3) differs from syllables (2)');
  });

  it('sentenceCompletion has exactly one ___', () => {
    expectOnlyError(run((f) => (word0(f).cues.sentenceCompletion = 'There is no blank here.')), 'exactly one ___');
    expectOnlyError(run((f) => (word0(f).cues.sentenceCompletion = 'The ___ and the ___ again.')), 'exactly one ___');
    expectOnlyError(run((f) => (word0(f).cues.sentenceCompletion = 'The ____ was here.')), 'exactly one ___');
    expectOnlyError(run((f) => (word0(f).cues.sentenceCompletion = 'The __ was here.')), 'exactly one ___');
  });
});

describe('validateContent: cues must not give the answer away', () => {
  const fields: [string, (w: Word, t: string) => void][] = [
    ['cues.definition', (w, t) => (w.cues.definition = t)],
    ['cues.sentenceCompletion', (w, t) => (w.cues.sentenceCompletion = `${t} ___ here.`)],
    ['semantic.category', (w, t) => (w.semantic.category = t)],
    ['semantic.use', (w, t) => (w.semantic.use = t)],
    ['semantic.action', (w, t) => (w.semantic.action = t)],
    ['semantic.properties', (w, t) => (w.semantic.properties = t)],
    ['semantic.location', (w, t) => (w.semantic.location = t)],
    ['semantic.association', (w, t) => (w.semantic.association = t)],
    ['phonological.rhyme', (w, t) => (w.phonological.rhyme = t)],
    ['phonological.sameFirstSound', (w, t) => (w.phonological.sameFirstSound = t)],
  ];

  it.each(fields)('%s containing the target word is an error', (field, set) => {
    expectOnlyError(
      run((f) => set(word0(f), 'You can eat an apple')),
      `${field} contains the target word`,
    );
  });

  it('is case-insensitive and whole-word only', () => {
    expectOnlyError(run((f) => (word0(f).cues.definition = 'APPLE pie is nice.')), 'cues.definition contains the target word');
    // "pineapple" and "applause" are different words.
    expect(run((f) => (word0(f).cues.definition = 'Tastes a bit like pineapple, to applause.')).errors).toEqual([]);
  });

  it.each([
    ['plural', 'apple', 'Two apples sit on the table.'],
    ['-ed form', 'jump', 'The dog jumped over the gate.'],
    ['-ing form', 'jump', 'You are jumping over a puddle.'],
    ['-er form', 'jump', 'A jumper clears the bar.'],
    ['doubled consonant -ing', 'run', 'Someone is running for the bus.'],
    ['doubled consonant -er', 'run', 'A runner crosses the line.'],
    ['e-drop -ing', 'apple', 'Someone is appling.'],
    ['-s form', 'cat', 'Cats sleep a lot.'],
  ])('catches a simple inflection: %s', (_name, target, text) => {
    const r = run((f) => {
      const w = f.input.words.find((x) => x.word === target)!;
      w.cues.definition = text;
    });
    expect(has(r.errors, 'cues.definition contains the target word'), r.errors.join('\n')).toBe(true);
  });

  it('catches a component of a multi-word target (3+ letters)', () => {
    const base = (f: Fixture) =>
      Object.assign(f.input.words[1], { word: 'ice cream', letters: 8, multiWord: true, cues: { ...f.input.words[1].cues, firstLetter: 'i' } });
    expect(has(run((f) => { base(f); f.input.words[1].semantic.use = 'You put it in a cone with some cream.'; }).errors, 'semantic.use contains the target word')).toBe(true);
    expect(has(run((f) => { base(f); f.input.words[1].semantic.use = 'It is as cold as ice.'; }).errors, 'semantic.use contains the target word')).toBe(true);
    expect(has(run((f) => { base(f); f.input.words[1].semantic.use = 'It is a sweet frozen dessert.'; }).errors, 'contains the target word')).toBe(false);
  });

  it('ignores components shorter than three letters', () => {
    const r = run((f) => {
      Object.assign(f.input.words[1], { word: 'ox cart', letters: 6, multiWord: true, cues: { ...f.input.words[1].cues, firstLetter: 'o' } });
      f.input.words[1].semantic.use = 'You see an ox in a field.'; // "ox" is only 2 letters
    });
    expect(has(r.errors, 'contains the target word')).toBe(false);
  });

  it('does not flag the same text when it is for another word', () => {
    expect(run((f) => (f.input.words[1].cues.definition = 'It looks a bit like an apple.')).errors).toEqual([]);
  });
});

describe('containsTarget, wordForms and hasSingleBlank helpers', () => {
  it('wordForms includes parts and inflections', () => {
    const forms = wordForms('ice cream');
    for (const f of ['ice cream', 'ice', 'cream', 'creams', 'icing', 'iced', 'icer', 'ice creams']) expect(forms).toContain(f);
    expect(wordForms('baby')).toEqual(expect.arrayContaining(['babies', 'babied']));
    expect(wordForms('run')).toEqual(expect.arrayContaining(['running', 'runner', 'runned']));
  });

  it('containsTarget', () => {
    expect(containsTarget('I like Cats.', 'cat')).toBe(true);
    expect(containsTarget('A catalogue.', 'cat')).toBe(false);
    expect(containsTarget('Anything else', '')).toBe(false);
    expect(containsTarget('a (c++) thing', 'c++')).toBe(false);
  });

  it('hasSingleBlank', () => {
    expect(hasSingleBlank('a ___ b')).toBe(true);
    expect(hasSingleBlank('___')).toBe(true);
    expect(hasSingleBlank('a b')).toBe(false);
    expect(hasSingleBlank('a ___ b ___')).toBe(false);
    expect(hasSingleBlank('a __ b')).toBe(false);
    expect(hasSingleBlank('a ____ b')).toBe(false);
  });
});

describe('validateContent: images and credits', () => {
  it('a word with no image file is an error', () => {
    expectOnlyError(run((f) => f.input.imageFiles.delete(word0(f).image)), 'food-apple: no image file "food-apple.webp"');
  });

  it('a word with no credits entry is an error', () => {
    expectOnlyError(run((f) => (f.input.credits = f.input.credits.filter((c) => c.image !== word0(f).image))), 'food-apple: no credits entry');
  });

  it('hasImage: false needs no file or credit, is counted, and is a warning', () => {
    const r = run((f) => {
      word0(f).hasImage = false;
      f.input.imageFiles.delete(word0(f).image);
      f.input.credits = f.input.credits.filter((c) => c.image !== word0(f).image);
      f.input.screener.items = [
        { wordId: 'animals-cat', order: 1 },
        { wordId: 'verbs-run', order: 2 },
      ];
    }, { expected: { total: 6, perGroup: { food: 2, animals: 2, verbs: 2 }, screener: 2, minReading: 2 } });
    expect(r.errors).toEqual([]);
    expect(r.stats.wordsWithoutPicture).toBe(1);
    expect(has(r.warnings, /1 word flagged hasImage: false.*food-apple/)).toBe(true);
  });

  it('allowIncomplete turns missing image files and credits into warnings', () => {
    const r = run((f) => {
      f.input.imageFiles.delete(word0(f).image);
      f.input.credits = [];
    }, { allowIncomplete: true });
    expect(r.errors).toEqual([]);
    expect(has(r.warnings, 'no image file yet')).toBe(true);
    expect(has(r.warnings, 'no credits entry yet')).toBe(true);
    expect(r.stats.missingImageFiles).toBeGreaterThan(0);
  });

  it('image size: fine at 60 KB, a warning above 60 KB, an error only above 80 KB', () => {
    const at = (kb: number) => run((f) => f.input.imageFiles.set(word0(f).image, Math.round(kb * 1024)));
    expect(at(60).errors).toEqual([]);
    expect(at(60).warnings).toEqual([]);
    const warn = at(60.5);
    expect(warn.errors).toEqual([]);
    expect(has(warn.warnings, 'food-apple.webp')).toBe(true);
    expect(at(80).errors).toEqual([]);
    expect(at(80).warnings.length).toBe(1);
    const bad = at(81);
    expectOnlyError(bad, /food-apple\.webp is 81\.0 KB, over the 80 KB limit/);
    expect(bad.warnings).toEqual([]);
  });

  it('total image bytes must stay under 60 MB', () => {
    const per = Math.floor((60 * 1024 * 1024) / 10);
    // Individually these would be errors too, so use a big set of small files instead.
    const r = run((f) => {
      for (let i = 0; i < 1000; i++) f.input.imageFiles.set(`extra-${i}.webp`, 62 * 1024);
    });
    expect(per).toBeGreaterThan(80 * 1024);
    expect(has(r.errors, /Images total .* MB, which must stay under 60 MB/)).toBe(true);
    const under = run((f) => {
      for (let i = 0; i < 900; i++) f.input.imageFiles.set(`extra-${i}.webp`, 62 * 1024);
    });
    expect(has(under.errors, 'Images total')).toBe(false);
  });

  it('flags unreferenced image files as a warning', () => {
    const r = run((f) => f.input.imageFiles.set('stray.webp', 1000));
    expect(r.errors).toEqual([]);
    expect(has(r.warnings, 'stray.webp')).toBe(true);
    expect(r.stats.unreferencedImages).toBe(1);
  });
});

describe('validateContent: credits entries', () => {
  const c0 = (f: Fixture) => f.input.credits[0];

  it.each(['source', 'sourceUrl', 'author', 'licence', 'licenceUrl', 'retrieved', 'modifications'] as const)('missing %s is an error', (field) => {
    expectOnlyError(run((f) => ((c0(f) as unknown as Record<string, unknown>)[field] = '')), `missing ${field}`);
  });

  it('a generated image needs a prompt instead of a source URL', () => {
    const generated = (f: Fixture, prompt?: string) =>
      Object.assign(c0(f), { source: 'generated', sourceUrl: '', ...(prompt ? { prompt } : {}) });
    expect(run((f) => generated(f, 'A red apple on white')).errors).toEqual([]);
    expectOnlyError(run((f) => generated(f)), 'needs the prompt or description that made it');
  });

  it('a picture drawn by the project needs a description, but no web source or licence page', () => {
    const own = (f: Fixture, prompt?: string) =>
      Object.assign(c0(f), { source: 'project', sourceUrl: '', licenceUrl: '', ...(prompt ? { prompt } : {}) });
    expect(run((f) => own(f, 'A plain red paint swatch on a white background')).errors).toEqual([]);
    expectOnlyError(run((f) => own(f)), 'needs the prompt or description that made it');
  });

  it('an unknown source is an error', () => {
    expectOnlyError(run((f) => ((c0(f) as unknown as Record<string, unknown>).source = 'flickr')), 'unknown source "flickr"');
  });

  it('a duplicate entry for one image is an error', () => {
    expectOnlyError(run((f) => f.input.credits.push({ ...c0(f) })), 'duplicate credits entry');
  });

  it.each(['CC BY-NC 4.0', 'CC BY-NC-SA 4.0', 'CC BY-ND 2.0', 'CC BY-NC-ND 3.0', 'CC NC', 'Non-Commercial use only'])('licence "%s" is an error', (licence) => {
    const r = run((f) => (c0(f).licence = licence));
    expectOnlyError(r, `licence "${licence}" is not allowed`);
  });

  it.each(['CC0 1.0', 'Public Domain Mark 1.0', 'CC BY 4.0', 'CC BY 2.0'])('licence "%s" is fine', (licence) => {
    const r = run((f) => (c0(f).licence = licence));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('CC BY-SA is a warning, not an error', () => {
    const r = run((f) => (c0(f).licence = 'CC BY-SA 4.0'));
    expect(r.errors).toEqual([]);
    expect(has(r.warnings, 'share-alike')).toBe(true);
    expect(r.stats.shareAlikeImages).toBe(1);
  });
});

describe('validateContent: naming screener', () => {
  const opts = (screener: number) => ({ expected: { total: 6, perGroup: { food: 2, animals: 2, verbs: 2 }, screener, minReading: 2 } });

  it('needs exactly the expected number of items', () => {
    expectOnlyError(run((f) => f.input.screener.items.pop()), 'expected exactly 3 items, found 2');
    expectOnlyError(
      run((f) => f.input.screener.items.push({ wordId: 'animals-dog', order: 4 })),
      'expected exactly 3 items, found 4',
    );
  });

  it('a screener word that does not exist is an error', () => {
    expectOnlyError(run((f) => (f.input.screener.items[1].wordId = 'animals-unicorn')), 'screener animals-unicorn: no such word');
  });

  it('duplicate wordIds are an error', () => {
    expectOnlyError(run((f) => (f.input.screener.items[1].wordId = 'food-apple')), 'duplicate wordId');
  });

  it('only nouns and verbs', () => {
    const r = run((f) => {
      f.input.words[3].wordClass = 'adjective';
      f.input.screener.items[1].wordId = 'animals-dog';
    });
    expectOnlyError(r, 'screener animals-dog: must be a noun or a verb, not adjective');
  });

  it('every item needs a picture', () => {
    const r = run((f) => {
      f.input.words[2].hasImage = false;
      f.input.imageFiles.delete(f.input.words[2].image);
      f.input.credits = f.input.credits.filter((c) => c.image !== f.input.words[2].image);
    });
    expectOnlyError(r, 'screener animals-cat: has no picture');
  });

  it('a screener word whose picture file is missing is an error', () => {
    expectOnlyError(run((f) => f.input.imageFiles.delete('animals-cat.webp')), 'screener animals-cat: picture file');
  });

  it('orders must be whole numbers within 1 to the number of items, and unique', () => {
    expectOnlyError(run((f) => (f.input.screener.items[2].order = 4)), 'order must be a whole number from 1 to 3');
    expectOnlyError(run((f) => (f.input.screener.items[2].order = 0)), 'order must be a whole number from 1 to 3');
    expectOnlyError(run((f) => (f.input.screener.items[2].order = 1.5)), 'order must be a whole number from 1 to 3');
    expectOnlyError(run((f) => (f.input.screener.items[2].order = 1)), 'order 1 is used twice');
  });

  it('needs a version and a frozen date', () => {
    expectOnlyError(run((f) => ((f.input.screener as unknown as Record<string, unknown>).version = undefined)), 'version must be a number');
    expectOnlyError(run((f) => (f.input.screener.frozen = '')), 'frozen date is missing');
  });

  it('an empty screener is an error, or a warning with allowIncomplete', () => {
    const empty = (f: Fixture) => (f.input.screener.items = []);
    expectOnlyError(run(empty), 'expected exactly 3 items, found 0');
    const r = run(empty, { allowIncomplete: true });
    expect(r.errors).toEqual([]);
    expect(has(r.warnings, 'expected exactly 3 items, found 0')).toBe(true);
    // A partly filled screener is still an error with allowIncomplete.
    expectOnlyError(run((f) => f.input.screener.items.pop(), { allowIncomplete: true }), 'found 2');
  });

  it('the real default is 30 items', () => {
    const f = clean();
    const r = validateContent(f.input, { expected: { total: 6, perGroup: { food: 2, animals: 2, verbs: 2 }, minReading: 2 } });
    expect(has(r.errors, 'expected exactly 30 items, found 3')).toBe(true);
    expect(opts(3).expected.screener).toBe(3);
  });
});

describe('validateContent: reading items', () => {
  const r0 = (f: Fixture) => f.input.readingItems[0];

  it('requires the minimum number of phrases and of sentences', () => {
    expectOnlyError(run((f) => f.input.readingItems.shift()), 'at least 2 phrase items are required, found 1');
    expectOnlyError(run((f) => f.input.readingItems.pop()), 'at least 2 sentence items are required, found 1');
  });

  it('requireReading: false skips the minimum, allowIncomplete downgrades it', () => {
    const none = (f: Fixture) => (f.input.readingItems = []);
    expect(run(none, { requireReading: false }).errors).toEqual([]);
    const r = run(none, { allowIncomplete: true });
    expect(r.errors).toEqual([]);
    expect(has(r.warnings, 'at least 2 phrase items')).toBe(true);
    expectOnlyError(run(none), 'at least 2 phrase items');
  });

  it('still checks the items that exist when the minimum is skipped', () => {
    const r = run((f) => (r0(f).distractors = ['one']), { requireReading: false });
    expectOnlyError(r, 'distractors needs at least 3 entries');
  });

  it('unique ids', () => {
    expectOnlyError(run((f) => (f.input.readingItems[1].id = 'p1')), 'reading p1: duplicate id');
  });

  it('the image must exist in imageFiles', () => {
    expectOnlyError(run((f) => f.input.imageFiles.delete(r0(f).image)), 'reading p1: no image file "p1.webp"');
    expectOnlyError(run((f) => (r0(f).image = '')), 'missing image');
  });

  it('at least three distractors and three answer distractors', () => {
    expectOnlyError(run((f) => (r0(f).distractors = ['a cup of milk', 'a glass of tea'])), 'distractors needs at least 3 entries, found 2');
    expectOnlyError(run((f) => (r0(f).answerDistractors = ['milk', 'juice'])), 'answerDistractors needs at least 3 entries, found 2');
  });

  it('the cloze contains exactly one ___', () => {
    expectOnlyError(run((f) => (r0(f).cloze = 'a cup of tea')), 'cloze needs exactly one ___');
    expectOnlyError(run((f) => (r0(f).cloze = 'a ___ of ___')), 'cloze needs exactly one ___');
  });

  it('the cloze filled with the answer reproduces the text', () => {
    expectOnlyError(run((f) => (r0(f).cloze = 'a ___ of tea')), /does not reproduce text/);
    expectOnlyError(run((f) => (r0(f).answer = 'milk')), /does not reproduce text/);
    expectOnlyError(run((f) => (f.input.readingItems[2].cloze = 'The man is ___ a book.')), /does not reproduce text/);
  });

  it('no distractor equals the target text, and no answer distractor equals the answer', () => {
    expectOnlyError(run((f) => (r0(f).distractors = ['a cup of tea', 'a cup of milk', 'a glass of tea'])), 'distractors contains the target text');
    expectOnlyError(run((f) => (r0(f).distractors = ['A Cup of Tea ', 'a cup of milk', 'a glass of tea'])), 'distractors contains the target text');
    expectOnlyError(run((f) => (r0(f).answerDistractors = ['tea', 'juice', 'water'])), 'answerDistractors contains the answer');
    expectOnlyError(run((f) => (r0(f).answerDistractors = ['Tea', 'juice', 'water'])), 'answerDistractors contains the answer');
  });

  it('no duplicate options', () => {
    expectOnlyError(run((f) => (r0(f).distractors = ['a cup of milk', 'a cup of milk', 'a glass of tea'])), 'distractors has a duplicate');
    expectOnlyError(run((f) => (r0(f).answerDistractors = ['milk', 'juice', 'Milk'])), 'answerDistractors has a duplicate');
  });

  it('empty options are an error', () => {
    expectOnlyError(run((f) => (r0(f).answerDistractors = ['milk', 'juice', ' ', 'water'])), 'answerDistractors has an empty');
  });

  it('kind must be phrase or sentence', () => {
    expectOnlyError(run((f) => ((r0(f) as unknown as Record<string, unknown>).kind = 'paragraph')), 'kind must be');
  });

  it('a wordId must refer to a real word', () => {
    expectOnlyError(run((f) => (r0(f).wordId = 'food-nothing')), 'wordId "food-nothing" is not a word');
    expect(run((f) => (r0(f).wordId = 'food-apple')).errors).toEqual([]);
  });
});
