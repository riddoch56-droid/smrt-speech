import { describe, expect, it } from 'vitest';
import { balancedPosition, gridColumns, initialAutoField, nextAutoField, type AutoFieldState } from '../../src/session/autoField';
import { seededRng } from '../../src/session/rng';

function run(results: boolean[], from: AutoFieldState = initialAutoField()): AutoFieldState[] {
  const out: AutoFieldState[] = [];
  let s = from;
  for (const r of results) {
    s = nextAutoField(s, r);
    out.push(s);
  }
  return out;
}

describe('auto field size', () => {
  it('starts at 2', () => {
    expect(initialAutoField().size).toBe(2);
  });

  it('goes up by one after three consecutive correct trials', () => {
    const sizes = run([true, true, true]).map((s) => s.size);
    expect(sizes).toEqual([2, 2, 3]);
  });

  it('goes down by one after two consecutive incorrect trials', () => {
    const start = { size: 4, correctRun: 0, incorrectRun: 0 };
    expect(run([false, false], start).map((s) => s.size)).toEqual([4, 3]);
  });

  it('one incorrect trial does not change the size', () => {
    expect(run([false], { size: 4, correctRun: 0, incorrectRun: 0 })[0].size).toBe(4);
  });

  it('an incorrect trial resets the correct run', () => {
    const sizes = run([true, true, false, true, true]).map((s) => s.size);
    expect(sizes).toEqual([2, 2, 2, 2, 2]);
    expect(run([true, true, false, true, true, true]).pop()!.size).toBe(3);
  });

  it('a correct trial resets the incorrect run', () => {
    const start = { size: 4, correctRun: 0, incorrectRun: 0 };
    expect(run([false, true, false], start).map((s) => s.size)).toEqual([4, 4, 4]);
    expect(run([false, true, false, false], start).pop()!.size).toBe(3);
  });

  it('runs reset after a change, so a second step needs a full new run', () => {
    const sizes = run([true, true, true, true, true, true]).map((s) => s.size);
    expect(sizes).toEqual([2, 2, 3, 3, 3, 4]);
    const down = run([false, false, false, false], { size: 5, correctRun: 0, incorrectRun: 0 }).map((s) => s.size);
    expect(down).toEqual([5, 4, 4, 3]);
  });

  it('is clamped to 2 at the bottom', () => {
    expect(run([false, false, false, false, false, false]).every((s) => s.size === 2)).toBe(true);
  });

  it('is clamped to 6 at the top', () => {
    const states = run(Array.from({ length: 30 }, () => true));
    expect(Math.max(...states.map((s) => s.size))).toBe(6);
    expect(states[states.length - 1].size).toBe(6);
  });

  it('does not mutate the previous state', () => {
    const s = initialAutoField();
    nextAutoField(s, true);
    expect(s).toEqual({ size: 2, correctRun: 0, incorrectRun: 0 });
  });
});

describe('balancedPosition', () => {
  it('uses every position equally over a full cycle', () => {
    const counts: number[] = [];
    const rng = seededRng(7);
    const seen: number[] = [];
    for (let i = 0; i < 12; i++) seen.push(balancedPosition(counts, 4, rng));
    expect(counts).toEqual([3, 3, 3, 3]);
    for (let block = 0; block < 3; block++) expect(new Set(seen.slice(block * 4, block * 4 + 4)).size).toBe(4);
  });

  it('keeps positions within 1 of each other at every point of a session', () => {
    for (const size of [2, 3, 4, 5, 6]) {
      const counts: number[] = [];
      const rng = seededRng(size);
      for (let i = 0; i < 40; i++) {
        const p = balancedPosition(counts, size, rng);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(size);
        const used = counts.slice(0, size);
        expect(Math.max(...used) - Math.min(...used)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('copes with the field size growing mid-session', () => {
    const counts: number[] = [];
    const rng = seededRng(11);
    for (let i = 0; i < 4; i++) balancedPosition(counts, 2, rng);
    expect(counts).toEqual([2, 2]);
    // New positions have never been used, so they are chosen first.
    const next = [balancedPosition(counts, 3, rng), balancedPosition(counts, 3, rng)];
    expect(next[0]).toBe(2);
    expect(counts.length).toBe(3);
  });

  it('is varied, not a fixed rotation, for different seeds', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const counts: number[] = [];
      const rng = seededRng(seed);
      orders.add(Array.from({ length: 4 }, () => balancedPosition(counts, 4, rng)).join(''));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('gridColumns', () => {
  it('2 side by side, 3 in a row, 4 as 2x2, 5 and 6 in two rows', () => {
    expect(gridColumns(2)).toBe(2);
    expect(gridColumns(3)).toBe(3);
    expect(gridColumns(4)).toBe(2);
    expect(Math.ceil(5 / gridColumns(5))).toBe(2);
    expect(Math.ceil(6 / gridColumns(6))).toBe(2);
    expect(gridColumns(6)).toBe(3);
  });
});
