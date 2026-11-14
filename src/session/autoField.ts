export const MIN_FIELD = 2;
export const MAX_FIELD = 6;
export const STEP_UP_AFTER = 3;
export const STEP_DOWN_AFTER = 2;

export interface AutoFieldState {
  size: number;
  correctRun: number;
  incorrectRun: number;
}

export function initialAutoField(): AutoFieldState {
  return { size: MIN_FIELD, correctRun: 0, incorrectRun: 0 };
}

/**
 * Auto field size: starts at 2, goes up by one after three consecutive correct trials,
 * down by one after two consecutive incorrect trials, clamped to 2 to 6.
 */
export function nextAutoField(state: AutoFieldState, trialCorrect: boolean): AutoFieldState {
  if (trialCorrect) {
    const run = state.correctRun + 1;
    if (run >= STEP_UP_AFTER) return { size: Math.min(MAX_FIELD, state.size + 1), correctRun: 0, incorrectRun: 0 };
    return { size: state.size, correctRun: run, incorrectRun: 0 };
  }
  const run = state.incorrectRun + 1;
  if (run >= STEP_DOWN_AFTER) return { size: Math.max(MIN_FIELD, state.size - 1), correctRun: 0, incorrectRun: 0 };
  return { size: state.size, correctRun: 0, incorrectRun: run };
}

/**
 * Picks where the target goes so positions are used evenly across a session.
 * `counts` holds how often each position has been used so far and is updated in place.
 */
export function balancedPosition(counts: number[], size: number, rng: () => number): number {
  while (counts.length < size) counts.push(0);
  let min = Infinity;
  for (let i = 0; i < size; i++) min = Math.min(min, counts[i]);
  const candidates: number[] = [];
  for (let i = 0; i < size; i++) if (counts[i] === min) candidates.push(i);
  const chosen = candidates[Math.floor(rng() * candidates.length)];
  counts[chosen]++;
  return chosen;
}

/** Rows for a balanced grid: 2 side by side, 3 in a row, 4 as 2x2, 5 and 6 in two rows. */
export function gridColumns(size: number): number {
  if (size <= 3) return size;
  if (size === 4) return 2;
  return 3;
}
