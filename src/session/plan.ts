import { shuffle, type Rng } from './rng';
import type { TrialCount } from './types';

/**
 * Supplies the items for a session. A fixed-length session takes a shuffled run of the
 * pool, repeating (reshuffled) only if the pool is smaller than the session. A continuous
 * session keeps cycling until stopped.
 */
export class ItemQueue<T> {
  private bag: T[] = [];
  private last: T | null = null;

  constructor(
    private readonly pool: readonly T[],
    private readonly rng: Rng = Math.random,
    private readonly ordered = false,
  ) {}

  get size(): number {
    return this.pool.length;
  }

  next(): T | null {
    if (this.pool.length === 0) return null;
    if (this.bag.length === 0) {
      this.bag = this.ordered ? this.pool.slice() : shuffle(this.pool, this.rng);
      // Avoid showing the same item twice in a row across a reshuffle.
      if (!this.ordered && this.bag.length > 1 && this.bag[0] === this.last) this.bag.push(this.bag.shift()!);
    }
    this.last = this.bag.shift()!;
    return this.last;
  }
}

export function plannedTotal(trials: TrialCount, poolSize: number, fixed?: number): number | null {
  if (fixed !== undefined) return fixed;
  if (trials === 'continuous') return null;
  return poolSize === 0 ? 0 : trials;
}
