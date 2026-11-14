import { describe, expect, it } from 'vitest';
import { arrangeChoices, eligibleFoils, selectFoils, writtenSimilarity } from '../../src/session/foils';
import { seededRng } from '../../src/session/rng';
import { makePool, makeWord } from './helpers';

const GROUPS = ['food', 'animals', 'clothing', 'household', 'furniture', 'body'];

describe('selectFoils: Easy', () => {
  const pool = makePool(GROUPS, 2, 4);
  const target = pool[0];

  it('draws every foil from a different group', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const foils = selectFoils({ target, pool, count: 5, difficulty: 'easy', mode: 'picture', rng: seededRng(seed) });
      expect(foils).toHaveLength(5);
      for (const f of foils) expect(f.group).not.toBe(target.group);
    }
  });

  it('spreads foils across groups while there is choice', () => {
    const foils = selectFoils({ target, pool, count: 5, difficulty: 'easy', mode: 'picture', rng: seededRng(3) });
    expect(new Set(foils.map((f) => f.group)).size).toBe(5);
  });

  it('never returns the target or duplicate words', () => {
    const dupPool = [...pool, makeWord(target.word, { group: 'animals', id: 'animals-dupe' })];
    for (let seed = 1; seed <= 15; seed++) {
      const foils = selectFoils({ target, pool: dupPool, count: 6, difficulty: 'easy', mode: 'picture', rng: seededRng(seed) });
      const words = foils.map((f) => f.word);
      expect(words).not.toContain(target.word);
      expect(foils.map((f) => f.id)).not.toContain(target.id);
      expect(new Set(words).size).toBe(words.length);
    }
  });

  it('is deterministic for a seeded rng', () => {
    const a = selectFoils({ target, pool, count: 4, difficulty: 'easy', mode: 'picture', rng: seededRng(9) });
    const b = selectFoils({ target, pool, count: 4, difficulty: 'easy', mode: 'picture', rng: seededRng(9) });
    expect(a.map((w) => w.id)).toEqual(b.map((w) => w.id));
  });

  it('returns nothing for a count of zero', () => {
    expect(selectFoils({ target, pool, count: 0, difficulty: 'easy', mode: 'picture' })).toEqual([]);
  });
});

describe('selectFoils: Hard', () => {
  const pool = makePool(GROUPS, 2, 4);
  const target = pool[0]; // food, food-sub0
  const sameSub = pool.filter((w) => w.group === target.group && w.subgroup === target.subgroup && w.id !== target.id);
  const sameGroupOtherSub = pool.filter((w) => w.group === target.group && w.subgroup !== target.subgroup);

  it('uses the same subgroup first', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const foils = selectFoils({ target, pool, count: 3, difficulty: 'hard', mode: 'picture', rng: seededRng(seed) });
      expect(foils).toHaveLength(3);
      for (const f of foils) expect(sameSub.map((w) => w.id)).toContain(f.id);
    }
  });

  it('then the same group when the subgroup runs out, then anything else', () => {
    const foils = selectFoils({ target, pool, count: 5, difficulty: 'hard', mode: 'picture', rng: seededRng(4) });
    expect(foils).toHaveLength(5);
    expect(foils.slice(0, 3).every((f) => f.subgroup === target.subgroup)).toBe(true);
    expect(sameGroupOtherSub.map((w) => w.id)).toContain(foils[3].id);

    const many = selectFoils({ target, pool, count: 9, difficulty: 'hard', mode: 'picture', rng: seededRng(4) });
    expect(many).toHaveLength(9);
    // 3 same subgroup, 4 same group, then other groups.
    expect(many.slice(0, 7).every((f) => f.group === target.group)).toBe(true);
    expect(many.slice(7).every((f) => f.group !== target.group)).toBe(true);
  });

  it('never returns the target or duplicates', () => {
    const foils = selectFoils({ target, pool, count: 40, difficulty: 'hard', mode: 'picture', rng: seededRng(2) });
    const ids = foils.map((f) => f.id);
    expect(ids).not.toContain(target.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(foils.map((f) => f.word)).size).toBe(foils.length);
  });

  it('returns fewer than asked only when the pool is too small', () => {
    const small = [target, ...sameSub.slice(0, 2)];
    expect(selectFoils({ target, pool: small, count: 5, difficulty: 'hard', mode: 'picture' })).toHaveLength(2);
    expect(selectFoils({ target, pool: small, count: 5, difficulty: 'easy', mode: 'picture' })).toHaveLength(2);
    // And not fewer when the pool is big enough.
    expect(selectFoils({ target, pool, count: pool.length - 1, difficulty: 'hard', mode: 'picture' })).toHaveLength(pool.length - 1);
  });
});

describe('selectFoils: written mode on Hard', () => {
  it('prefers the same first letter and similar length within the same subgroup', () => {
    const target = makeWord('table', { group: 'furniture', subgroup: 'tables', id: 't' });
    const close1 = makeWord('tablet', { group: 'furniture', subgroup: 'tables', id: 'c1' });
    const close2 = makeWord('tabby', { group: 'furniture', subgroup: 'tables', id: 'c2' });
    const far1 = makeWord('cupboard', { group: 'furniture', subgroup: 'tables', id: 'f1' });
    const far2 = makeWord('wardrobe', { group: 'furniture', subgroup: 'tables', id: 'f2' });
    const far3 = makeWord('ottoman', { group: 'furniture', subgroup: 'tables', id: 'f3' });
    const pool = [target, far1, close1, far2, close2, far3];
    for (let seed = 1; seed <= 15; seed++) {
      const foils = selectFoils({ target, pool, count: 2, difficulty: 'hard', mode: 'written', rng: seededRng(seed) });
      expect(foils.map((f) => f.id).sort()).toEqual(['c1', 'c2']);
    }
  });

  it('still prefers the same subgroup over the same group among equally similar words', () => {
    const target = makeWord('plate', { group: 'household', subgroup: 'tableware', id: 't' });
    const sub = makeWord('plank', { group: 'household', subgroup: 'tableware', id: 'sub' });
    const grp = makeWord('plant', { group: 'household', subgroup: 'garden', id: 'grp' });
    const foils = selectFoils({ target, pool: [target, grp, sub], count: 1, difficulty: 'hard', mode: 'written', rng: seededRng(1) });
    expect(foils[0].id).toBe('sub');
  });

  // Brief 7.1: Hard draws foils from the same subgroup or group; for Listen and Read the foils are
  // ALSO similar in spelling. In written mode the code ranks by similarity + a bonus of only 2/1/0
  // for subgroup/group/other, while similarity can reach 5, so a look-alike from another group
  // outranks same-subgroup words (src/session/foils.ts, the `ranked` sort in selectFoils).
  it('never draws a written Hard foil from another group while same-subgroup words are available', () => {
    const target = makeWord('plate', { group: 'household', subgroup: 'tableware', id: 't' });
    const mate = makeWord('cup', { group: 'household', subgroup: 'tableware', id: 'mate' });
    const lookalike = makeWord('plant', { group: 'nature', subgroup: 'plants', id: 'look' });
    const foils = selectFoils({ target, pool: [target, mate, lookalike], count: 1, difficulty: 'hard', mode: 'written', rng: seededRng(1) });
    expect(foils[0].group).toBe('household');
  });

  it('writtenSimilarity rewards first letter and closeness of length', () => {
    expect(writtenSimilarity('table', 'tablet')).toBeGreaterThan(writtenSimilarity('table', 'wardrobe'));
    expect(writtenSimilarity('table', 'tab')).toBeGreaterThan(writtenSimilarity('table', 'ab'));
    expect(writtenSimilarity('Table', 'tape')).toBe(writtenSimilarity('table', 'tape'));
  });
});

describe('custom foil policy', () => {
  const builtIn = makePool(['food', 'animals', 'clothing'], 1, 5);
  const customA = [0, 1, 2, 3].map((i) => makeWord(`quirk${'abcd'[i]}`, { group: 'custom-pets', custom: true, id: `custom-pets-${i}`, subgroup: 'x' }));
  const customB = [0, 1, 2].map((i) => makeWord(`vexed${'abc'[i]}`, { group: 'custom-trips', custom: true, id: `custom-trips-${i}`, subgroup: 'x' }));
  const pool = [...builtIn, ...customA, ...customB];

  it('Full: custom words may appear alongside built-in words', () => {
    const el = eligibleFoils(builtIn[0], pool, 'full');
    expect(el.some((w) => w.custom)).toBe(true);
    expect(el.some((w) => !w.custom)).toBe(true);
  });

  it('Limited: a built-in target never gets custom words as foils', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const foils = selectFoils({ target: builtIn[0], pool, count: 6, difficulty: 'easy', mode: 'picture', customPolicy: 'limited', rng: seededRng(seed) });
      expect(foils.some((f) => f.custom)).toBe(false);
      const hard = selectFoils({ target: builtIn[0], pool, count: 6, difficulty: 'hard', mode: 'picture', customPolicy: 'limited', rng: seededRng(seed) });
      expect(hard.some((f) => f.custom)).toBe(false);
    }
  });

  it('Limited: a custom target only gets words from its own custom category', () => {
    const foils = selectFoils({ target: customA[0], pool, count: 6, difficulty: 'easy', mode: 'picture', customPolicy: 'limited', rng: seededRng(5) });
    expect(foils).toHaveLength(3);
    for (const f of foils) {
      expect(f.custom).toBe(true);
      expect(f.group).toBe('custom-pets');
    }
  });

  it('Full: a custom target can be shown against built-in words', () => {
    const foils = selectFoils({ target: customA[0], pool, count: 4, difficulty: 'easy', mode: 'picture', customPolicy: 'full', rng: seededRng(5) });
    expect(foils).toHaveLength(4);
    expect(foils.some((f) => !f.custom)).toBe(true);
  });

  it('defaults to Full when no policy is given', () => {
    const foils = selectFoils({ target: customA[0], pool, count: 6, difficulty: 'easy', mode: 'picture', rng: seededRng(5) });
    expect(foils.some((f) => !f.custom)).toBe(true);
  });
});

describe('arrangeChoices', () => {
  it('places the target at the requested position', () => {
    expect(arrangeChoices('T', ['a', 'b', 'c'], 0)).toEqual(['T', 'a', 'b', 'c']);
    expect(arrangeChoices('T', ['a', 'b', 'c'], 2)).toEqual(['a', 'b', 'T', 'c']);
    expect(arrangeChoices('T', ['a', 'b', 'c'], 3)).toEqual(['a', 'b', 'c', 'T']);
  });

  it('clamps out-of-range positions and does not mutate the foils', () => {
    const foils = ['a', 'b'];
    expect(arrangeChoices('T', foils, 99)).toEqual(['a', 'b', 'T']);
    expect(arrangeChoices('T', foils, -4)).toEqual(['T', 'a', 'b']);
    expect(foils).toEqual(['a', 'b']);
  });
});
