import { shuffle, type Rng } from './rng';
import type { Difficulty } from './types';
import type { AppWord } from './words';

export type FoilMode = 'picture' | 'written';
export type CustomFoilPolicy = 'full' | 'limited';

export interface FoilRequest {
  target: AppWord;
  pool: readonly AppWord[];
  /** Number of wrong choices wanted. */
  count: number;
  difficulty: Difficulty;
  mode: FoilMode;
  customPolicy?: CustomFoilPolicy;
  rng?: Rng;
}

/**
 * Words allowed as wrong choices for a target.
 * Limited policy: custom categories only use their own words, and built-in targets
 * never show custom words. Full policy: everything mixes.
 */
export function eligibleFoils(target: AppWord, pool: readonly AppWord[], policy: CustomFoilPolicy): AppWord[] {
  const seen = new Set<string>([target.word.toLowerCase()]);
  const out: AppWord[] = [];
  for (const w of pool) {
    if (w.id === target.id) continue;
    const key = w.word.toLowerCase();
    if (seen.has(key)) continue;
    if (policy === 'limited') {
      if (target.custom ? !(w.custom && w.group === target.group) : !!w.custom) continue;
    }
    seen.add(key);
    out.push(w);
  }
  return out;
}

/** Higher is a closer written match: same first letter and similar length. */
export function writtenSimilarity(a: string, b: string): number {
  let score = 0;
  if (a[0]?.toLowerCase() === b[0]?.toLowerCase()) score += 3;
  const diff = Math.abs(a.length - b.length);
  if (diff <= 1) score += 2;
  else if (diff <= 2) score += 1;
  return score;
}

function takeRandom(items: AppWord[], n: number, rng: Rng): AppWord[] {
  return shuffle(items, rng).slice(0, Math.max(0, n));
}

/**
 * Easy draws foils from different groups. Hard draws from the same subgroup, then the
 * same group. In written mode on Hard, foils are also ranked by spelling similarity.
 * Returns fewer than `count` only when the pool is too small.
 */
export function selectFoils(req: FoilRequest): AppWord[] {
  const rng = req.rng ?? Math.random;
  const { target, count, difficulty, mode } = req;
  const candidates = eligibleFoils(target, req.pool, req.customPolicy ?? 'full');
  if (count <= 0) return [];
  const chosen: AppWord[] = [];
  const add = (items: AppWord[]) => {
    for (const w of items) {
      if (chosen.length >= count) return;
      if (!chosen.includes(w)) chosen.push(w);
    }
  };

  if (difficulty === 'easy') {
    const other = candidates.filter((w) => w.group !== target.group);
    // Spread across groups: no more than one foil per group while choice allows.
    const byGroup = new Map<string, AppWord[]>();
    for (const w of shuffle(other, rng)) {
      const list = byGroup.get(w.group) ?? [];
      list.push(w);
      byGroup.set(w.group, list);
    }
    const firsts = shuffle([...byGroup.values()].map((l) => l[0]), rng);
    add(firsts);
    add(shuffle(other, rng));
    add(takeRandom(candidates, count, rng));
    return chosen;
  }

  const sameSub = candidates.filter((w) => w.group === target.group && w.subgroup === target.subgroup);
  const sameGroup = candidates.filter((w) => w.group === target.group && w.subgroup !== target.subgroup);
  const rest = candidates.filter((w) => w.group !== target.group);

  if (mode === 'written') {
    const rank = (items: AppWord[], bonus: number) =>
      shuffle(items, rng).map((w) => ({ w, score: writtenSimilarity(target.word, w.word) + bonus }));
    // Hard foils stay within the target's group; spelling similarity orders them inside it.
    // Other groups are used only when the group cannot fill the field.
    const inGroup = [...rank(sameSub, 2), ...rank(sameGroup, 0)].sort((a, b) => b.score - a.score);
    add(inGroup.map((r) => r.w));
    add(
      rank(rest, 0)
        .sort((a, b) => b.score - a.score)
        .map((r) => r.w),
    );
    return chosen;
  }

  add(shuffle(sameSub, rng));
  add(shuffle(sameGroup, rng));
  add(shuffle(rest, rng));
  return chosen;
}

/** Places the target at `position` among the foils. */
export function arrangeChoices<T>(target: T, foils: readonly T[], position: number): T[] {
  const out = foils.slice();
  out.splice(Math.min(Math.max(0, position), out.length), 0, target);
  return out;
}
