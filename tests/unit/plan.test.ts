import { describe, expect, it } from 'vitest';
import { ItemQueue, plannedTotal } from '../../src/session/plan';
import { pick, seededRng, shuffle } from '../../src/session/rng';

describe('seededRng', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const xs = Array.from({ length: 50 }, () => a());
    const ys = Array.from({ length: 50 }, () => b());
    expect(xs).toEqual(ys);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('different seeds give different streams', () => {
    expect(seededRng(1)()).not.toBe(seededRng(2)());
  });
});

describe('shuffle', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);

  it('is deterministic for a seed', () => {
    expect(shuffle(items, seededRng(5))).toEqual(shuffle(items, seededRng(5)));
  });

  it('is a permutation and does not mutate its input', () => {
    const copy = items.slice();
    const out = shuffle(items, seededRng(9));
    expect(items).toEqual(copy);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(out).not.toEqual(items);
  });

  it('different seeds give different orders', () => {
    expect(shuffle(items, seededRng(1))).not.toEqual(shuffle(items, seededRng(2)));
  });

  it('handles empty and single-item arrays', () => {
    expect(shuffle([], seededRng(1))).toEqual([]);
    expect(shuffle(['a'], seededRng(1))).toEqual(['a']);
  });

  it('pick is deterministic for a seed and returns a member', () => {
    expect(pick(items, seededRng(3))).toBe(pick(items, seededRng(3)));
    expect(items).toContain(pick(items, seededRng(4)));
  });
});

describe('ItemQueue', () => {
  const pool = Array.from({ length: 10 }, (_, i) => `w${i}`);

  it('returns null for an empty pool', () => {
    const q = new ItemQueue<string>([]);
    expect(q.next()).toBeNull();
    expect(q.size).toBe(0);
  });

  it('a session shorter than the pool has no repeats', () => {
    const q = new ItemQueue(pool, seededRng(1));
    const got = Array.from({ length: 10 }, () => q.next()!);
    expect(new Set(got).size).toBe(10);
  });

  it('is deterministic for a seeded rng', () => {
    const a = new ItemQueue(pool, seededRng(7));
    const b = new ItemQueue(pool, seededRng(7));
    expect(Array.from({ length: 25 }, () => a.next())).toEqual(Array.from({ length: 25 }, () => b.next()));
  });

  it('reshuffles when the pool is smaller than the session, using every item per pass', () => {
    const small = ['a', 'b', 'c'];
    const q = new ItemQueue(small, seededRng(2));
    const got = Array.from({ length: 12 }, () => q.next()!);
    for (let pass = 0; pass < 4; pass++) expect(got.slice(pass * 3, pass * 3 + 3).sort()).toEqual(['a', 'b', 'c']);
  });

  it('never shows the same item twice in a row across a reshuffle', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const q = new ItemQueue(['a', 'b', 'c'], seededRng(seed));
      let prev: string | null = null;
      for (let i = 0; i < 30; i++) {
        const n = q.next()!;
        expect(n).not.toBe(prev);
        prev = n;
      }
    }
  });

  it('ordered mode keeps the pool order (Naming Test screener)', () => {
    const q = new ItemQueue(pool, seededRng(1), true);
    expect(Array.from({ length: 10 }, () => q.next())).toEqual(pool);
    expect(q.next()).toBe('w0');
  });

  it('a single-item pool keeps returning that item', () => {
    const q = new ItemQueue(['only'], seededRng(1));
    expect([q.next(), q.next(), q.next()]).toEqual(['only', 'only', 'only']);
  });

  it('does not mutate the pool it was given', () => {
    const copy = pool.slice();
    const q = new ItemQueue(pool, seededRng(3));
    for (let i = 0; i < 15; i++) q.next();
    expect(pool).toEqual(copy);
  });
});

describe('plannedTotal', () => {
  it('fixed lengths use the chosen number, continuous has no total', () => {
    expect(plannedTotal(10, 50)).toBe(10);
    expect(plannedTotal(30, 5)).toBe(30);
    expect(plannedTotal('continuous', 50)).toBeNull();
  });

  it('an empty pool plans nothing; a fixed override wins', () => {
    expect(plannedTotal(10, 0)).toBe(0);
    expect(plannedTotal(10, 50, 30)).toBe(30);
    expect(plannedTotal('continuous', 50, 30)).toBe(30);
  });
});
