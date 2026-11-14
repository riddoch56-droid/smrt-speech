import { describe, expect, it } from 'vitest';
import { buildCustomWord, centredSquare, clampCrop, estimateSyllables } from '../../src/custom/imageTools';

describe('centredSquare', () => {
  it('centres a landscape image', () => {
    expect(centredSquare(800, 600)).toEqual({ x: 100, y: 0, size: 600 });
  });
  it('centres a portrait image', () => {
    expect(centredSquare(600, 800)).toEqual({ x: 0, y: 100, size: 600 });
  });
  it('returns the whole of a square image', () => {
    expect(centredSquare(500, 500)).toEqual({ x: 0, y: 0, size: 500 });
  });
});

describe('clampCrop', () => {
  it('keeps a valid crop unchanged', () => {
    expect(clampCrop({ x: 10, y: 20, size: 100 }, 400, 300)).toEqual({ x: 10, y: 20, size: 100 });
  });
  it('pulls a crop back inside the image', () => {
    expect(clampCrop({ x: 350, y: -5, size: 100 }, 400, 300)).toEqual({ x: 300, y: 0, size: 100 });
  });
  it('limits the size to the shorter side', () => {
    expect(clampCrop({ x: 50, y: 50, size: 900 }, 400, 300)).toEqual({ x: 50, y: 0, size: 300 });
  });
  it('never returns a size below 1', () => {
    expect(clampCrop({ x: 0, y: 0, size: 0 }, 400, 300).size).toBe(1);
  });
});

describe('estimateSyllables', () => {
  it('counts vowel groups', () => {
    expect(estimateSyllables('banana')).toBe(3);
    expect(estimateSyllables('apple')).toBe(2);
    expect(estimateSyllables('cat')).toBe(1);
  });
  it('ignores a silent final e', () => {
    expect(estimateSyllables('cake')).toBe(1);
    expect(estimateSyllables('house')).toBe(1);
  });
  it('sums over several words', () => {
    expect(estimateSyllables('ice cream')).toBe(2);
  });
  it('is at least 1', () => {
    expect(estimateSyllables('')).toBe(1);
    expect(estimateSyllables('the')).toBe(1);
    expect(estimateSyllables('hmm')).toBe(1);
  });
});

describe('buildCustomWord', () => {
  it('fills every required field', () => {
    const w = buildCustomWord({ id: 'custom-1', word: 'Teapot', group: 'household', syllables: 2, patientId: null });
    expect(w).toMatchObject({
      id: 'custom-1',
      word: 'Teapot',
      group: 'household',
      subgroup: '',
      wordClass: 'noun',
      letters: 6,
      syllables: 2,
      frequencyBand: 2,
      multiWord: false,
      childFriendly: true,
      image: '',
      imagePrompt: '',
      custom: true,
      patientId: null,
    });
    expect(w.cues).toEqual({ definition: '', sentenceCompletion: '', firstLetter: 't', firstSoundSpoken: '' });
    expect(w.semantic.category).toBe('');
    expect(w.phonological).toMatchObject({ firstSound: 't', lastSound: 't', syllables: 2, rhyme: null });
  });
  it('detects multi-word entries and counts letters only', () => {
    const w = buildCustomWord({ id: 'custom-2', word: 'ice cream', group: 'food', syllables: 2, patientId: 'p1' });
    expect(w.multiWord).toBe(true);
    expect(w.letters).toBe(8);
    expect(w.patientId).toBe('p1');
  });
  it('uses the cues given', () => {
    const w = buildCustomWord({
      id: 'custom-3',
      word: 'mug',
      group: 'household',
      syllables: 1,
      patientId: null,
      cues: { definition: 'You drink from it.', sentenceCompletion: 'A cup of tea in a ___.' },
    });
    expect(w.cues.definition).toBe('You drink from it.');
    expect(w.cues.sentenceCompletion).toContain('___');
    expect(w.cues.firstLetter).toBe('m');
  });
});
