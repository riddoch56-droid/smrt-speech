import { describe, expect, it } from 'vitest';
import { seededRng } from '../../src/session/rng';
import {
  applyHint,
  createBoard,
  currentSpelling,
  isFull,
  isSolved,
  leftmostEmptySlot,
  placeTile,
  poolTiles,
  returnTile,
  submitBoard,
  type TileBoard,
} from '../../src/session/tiles';

const sorted = (s: string) => s.split('').sort().join('');
const letters = (b: TileBoard) => b.tiles.map((t) => t.letter);

/** Taps the tile carrying `letter` that is still in the pool. */
function tapLetter(b: TileBoard, letter: string): TileBoard {
  const t = poolTiles(b).find((x) => x.letter === letter);
  if (!t) throw new Error(`no pool tile ${letter}`);
  return placeTile(b, t.id);
}

describe('createBoard tile levels', () => {
  it('Easy gives only the letters needed', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const b = createBoard('banana', { level: 'easy', rng: seededRng(seed) });
      expect(sorted(letters(b).join(''))).toBe(sorted('banana'));
      expect(b.tiles.every((t) => !t.extra)).toBe(true);
      expect(b.slots).toHaveLength(6);
      expect(b.slots.every((s) => s === null)).toBe(true);
    }
  });

  it('Easy does not hand the word over already in order', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(letters(createBoard('cat', { level: 'easy', rng: seededRng(seed) })).join('')).not.toBe('cat');
    }
  });

  it('Medium adds three or four extra letters not in the word', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const b = createBoard('table', { level: 'medium', rng: seededRng(seed) });
      const extras = b.tiles.filter((t) => t.extra);
      counts.add(extras.length);
      expect(extras.length === 3 || extras.length === 4).toBe(true);
      for (const e of extras) expect('table').not.toContain(e.letter);
      expect(new Set(extras.map((e) => e.letter)).size).toBe(extras.length);
      expect(b.tiles.filter((t) => !t.extra).map((t) => t.letter).sort().join('')).toBe(sorted('table'));
    }
    expect([...counts].sort()).toEqual([3, 4]);
  });

  it('Hard gives the full alphabet', () => {
    const b = createBoard('table', { level: 'hard' });
    const set = new Set(letters(b));
    expect(set.size).toBe(26);
    for (const l of 'abcdefghijklmnopqrstuvwxyz') expect(set.has(l)).toBe(true);
  });

  it('Hard can spell words with repeated letters', () => {
    for (const word of ['banana', 'coffee', 'balloon', 'mummy']) {
      let b = createBoard(word, { level: 'hard' });
      for (const ch of word) b = tapLetter(b, ch);
      expect(isFull(b)).toBe(true);
      const r = submitBoard(b);
      expect(r.allCorrect).toBe(true);
      expect(isSolved(r.board)).toBe(true);
    }
  });

  it('Easy and Medium can spell words with repeated letters', () => {
    for (const level of ['easy', 'medium'] as const) {
      let b = createBoard('balloon', { level, rng: seededRng(4) });
      for (const ch of 'balloon') b = tapLetter(b, ch);
      expect(submitBoard(b).allCorrect).toBe(true);
    }
  });

  it('lower-cases the target', () => {
    expect(createBoard('Table', { level: 'easy' }).target).toBe('table');
  });
});

describe('placing and returning tiles', () => {
  const base = () => createBoard('cat', { level: 'easy', rng: seededRng(2) });

  it('a tap fills the leftmost empty slot', () => {
    let b = tapLetter(base(), 't');
    expect(b.slots[0]).not.toBeNull();
    expect(currentSpelling(b)).toBe('t__');
    b = tapLetter(b, 'a');
    expect(currentSpelling(b)).toBe('ta_');
  });

  it('after a placed tile is returned, the next tap fills that gap', () => {
    let b = tapLetter(tapLetter(base(), 't'), 'a'); // "ta_"
    b = returnTile(b, 0); // "_a_"
    expect(currentSpelling(b)).toBe('_a_');
    expect(leftmostEmptySlot(b)).toBe(0);
    b = tapLetter(b, 'c');
    expect(currentSpelling(b)).toBe('ca_');
  });

  it('tapping a placed tile returns it to the pool', () => {
    let b = tapLetter(base(), 'c');
    const id = b.slots[0]!;
    expect(poolTiles(b).map((t) => t.id)).not.toContain(id);
    b = returnTile(b, 0);
    expect(b.slots[0]).toBeNull();
    expect(b.tiles[id].slot).toBeNull();
    expect(poolTiles(b).map((t) => t.id)).toContain(id);
  });

  it('returning an empty slot does nothing', () => {
    const b = base();
    expect(returnTile(b, 1)).toBe(b);
  });

  it('drag places a tile in the chosen slot', () => {
    const b0 = base();
    const t = poolTiles(b0).find((x) => x.letter === 'a')!;
    const b = placeTile(b0, t.id, 2);
    expect(b.slots).toEqual([null, null, t.id]);
    expect(currentSpelling(b)).toBe('__a');
    // A following tap still fills the leftmost empty slot.
    expect(currentSpelling(tapLetter(b, 'c'))).toBe('c_a');
  });

  it('dragging a placed tile to another empty slot moves it', () => {
    let b = tapLetter(base(), 'c');
    const id = b.slots[0]!;
    b = placeTile(b, id, 2);
    expect(b.slots).toEqual([null, null, id]);
    expect(b.tiles[id].slot).toBe(2);
  });

  it('dropping a pool tile onto an occupied slot sends the old tile back to the pool', () => {
    let b = tapLetter(base(), 'c');
    const first = b.slots[0]!;
    const other = poolTiles(b).find((x) => x.letter === 'a')!;
    b = placeTile(b, other.id, 0);
    expect(b.slots[0]).toBe(other.id);
    expect(b.tiles[first].slot).toBeNull();
    expect(poolTiles(b).map((t) => t.id)).toContain(first);
  });

  it('dragging one placed tile onto another swaps them', () => {
    let b = tapLetter(tapLetter(base(), 'c'), 'a');
    const [x, y] = [b.slots[0]!, b.slots[1]!];
    b = placeTile(b, x, 1);
    expect(b.slots.slice(0, 2)).toEqual([y, x]);
    expect(b.tiles[x].slot).toBe(1);
    expect(b.tiles[y].slot).toBe(0);
  });

  it('ignores out-of-range slots and does not mutate the previous board', () => {
    const b = base();
    const snapshot = JSON.stringify(b);
    expect(placeTile(b, poolTiles(b)[0].id, 9)).toBe(b);
    expect(placeTile(b, poolTiles(b)[0].id, -1)).toBe(b);
    placeTile(b, poolTiles(b)[0].id);
    expect(JSON.stringify(b)).toBe(snapshot);
  });

  it('a full board does not accept another tap', () => {
    let b = base();
    for (const ch of 'tac') b = tapLetter(b, ch);
    expect(isFull(b)).toBe(true);
    expect(leftmostEmptySlot(b)).toBe(-1);
    expect(placeTile(b, 0)).toBe(b);
  });
});

describe('Submit', () => {
  it('locks correct letters and returns wrong ones to the pool', () => {
    let b = createBoard('cat', { level: 'easy', rng: seededRng(5) });
    for (const ch of 'cta') b = tapLetter(b, ch); // c right, t and a swapped
    expect(isFull(b)).toBe(true);
    const r = submitBoard(b);
    expect(r.allCorrect).toBe(false);
    expect(r.wrongSlots).toEqual([1, 2]);
    expect(r.board.locked).toEqual([true, false, false]);
    expect(currentSpelling(r.board)).toBe('c__');
    expect(poolTiles(r.board).map((t) => t.letter).sort()).toEqual(['a', 't']);
    expect(isSolved(r.board)).toBe(false);
  });

  it('locked letters cannot be moved or returned', () => {
    let b = createBoard('cat', { level: 'easy', rng: seededRng(5) });
    for (const ch of 'cta') b = tapLetter(b, ch);
    b = submitBoard(b).board;
    expect(returnTile(b, 0)).toBe(b);
    const t = poolTiles(b)[0];
    expect(placeTile(b, t.id, 0)).toBe(b);
    // New taps fill the first unlocked slot.
    expect(leftmostEmptySlot(b)).toBe(1);
  });

  it('the patient continues until correct, and every trial can end on success', () => {
    let b = createBoard('cat', { level: 'easy', rng: seededRng(5) });
    for (const ch of 'cta') b = tapLetter(b, ch);
    let r = submitBoard(b);
    b = r.board;
    b = tapLetter(b, 'a');
    b = tapLetter(b, 't');
    r = submitBoard(b);
    expect(r.allCorrect).toBe(true);
    expect(isSolved(r.board)).toBe(true);
    expect(r.board.submits).toBe(2);
  });

  it('flags only the first Submit as the scored one', () => {
    let b = createBoard('cat', { level: 'easy', rng: seededRng(5) });
    for (const ch of 'cta') b = tapLetter(b, ch);
    const first = submitBoard(b);
    expect(first.first).toBe(true);
    b = first.board;
    b = tapLetter(tapLetter(b, 't'), 'a');
    const second = submitBoard(b);
    expect(second.first).toBe(false);
    expect(second.board.submits).toBe(2);
  });

  it('a correct first Submit is flagged first and allCorrect', () => {
    let b = createBoard('dog', { level: 'medium', rng: seededRng(1) });
    for (const ch of 'dog') b = tapLetter(b, ch);
    const r = submitBoard(b);
    expect(r.first).toBe(true);
    expect(r.allCorrect).toBe(true);
    expect(r.wrongSlots).toEqual([]);
  });

  it('does not mutate the board that was submitted', () => {
    let b = createBoard('cat', { level: 'easy', rng: seededRng(5) });
    for (const ch of 'cta') b = tapLetter(b, ch);
    const before = JSON.stringify(b);
    submitBoard(b);
    expect(JSON.stringify(b)).toBe(before);
  });
});

describe('Hint', () => {
  it('first removes the extra tiles', () => {
    const b0 = createBoard('table', { level: 'medium', rng: seededRng(3) });
    const extrasBefore = b0.tiles.filter((t) => t.extra).length;
    expect(extrasBefore).toBeGreaterThanOrEqual(3);
    const { board, effect } = applyHint(b0);
    expect(effect).toBe('removed-extras');
    expect(board.tiles.filter((t) => t.extra && !t.removed)).toHaveLength(0);
    expect(poolTiles(board).map((t) => t.letter).sort().join('')).toBe(sorted('table'));
    expect(board.slots.every((s) => s === null)).toBe(true);
  });

  it('also removes an extra tile that had already been placed', () => {
    let b = createBoard('cat', { level: 'hard' });
    b = tapLetter(b, 'z'); // wrong extra into slot 0
    const { board } = applyHint(b);
    expect(board.slots[0]).toBeNull();
    expect(poolTiles(board).some((t) => t.letter === 'z')).toBe(false);
  });

  it('then places the next correct letter, locked, on each further press', () => {
    let b = createBoard('table', { level: 'medium', rng: seededRng(3) });
    b = applyHint(b).board; // extras removed
    let r = applyHint(b);
    expect(r.effect).toBe('placed-letter');
    expect(currentSpelling(r.board)).toBe('t____');
    expect(r.board.locked[0]).toBe(true);
    r = applyHint(r.board);
    expect(currentSpelling(r.board)).toBe('ta___');
    r = applyHint(r.board);
    expect(currentSpelling(r.board)).toBe('tab__');
    // The placed letter is a real tile, taken out of the pool.
    expect(poolTiles(r.board)).toHaveLength(2);
  });

  it('replaces a wrong tile sitting in the next slot', () => {
    let b = createBoard('cat', { level: 'easy', rng: seededRng(5) });
    b = tapLetter(b, 't'); // wrong in slot 0
    const r = applyHint(b);
    expect(r.effect).toBe('placed-letter');
    expect(currentSpelling(r.board)).toBe('c__');
    expect(poolTiles(r.board).map((t) => t.letter).sort()).toEqual(['a', 't']);
  });

  it('works with repeated letters', () => {
    let b = createBoard('mummy', { level: 'easy', rng: seededRng(1) });
    for (let i = 0; i < 5; i++) b = applyHint(b).board;
    expect(currentSpelling(b)).toBe('mummy');
    expect(isSolved(b)).toBe(true);
  });

  it('does nothing when the word is already complete', () => {
    let b = createBoard('at', { level: 'easy', rng: seededRng(1) });
    b = applyHint(applyHint(b).board).board;
    const r = applyHint(b);
    expect(r.effect).toBe('none');
  });

  it('hinted boards can still be finished and submitted', () => {
    let b = createBoard('dog', { level: 'medium', rng: seededRng(8) });
    b = applyHint(b).board;
    b = applyHint(b).board; // d
    b = tapLetter(tapLetter(b, 'o'), 'g');
    const r = submitBoard(b);
    expect(r.allCorrect).toBe(true);
  });
});

describe('Fill in the Blank boards', () => {
  it('give the other letters as locked and given', () => {
    const b = createBoard('table', { level: 'easy', blankIndex: 2, rng: seededRng(1) });
    expect(b.given).toEqual([true, true, false, true, true]);
    expect(b.locked).toEqual([true, true, false, true, true]);
    expect(currentSpelling(b)).toBe('ta_le');
  });

  it('the needed letter is among the tiles, and the given letters are not offered', () => {
    for (const level of ['easy', 'medium'] as const) {
      const b = createBoard('table', { level, blankIndex: 2, rng: seededRng(1) });
      expect(letters(b)).toContain('b');
      expect(b.tiles.filter((t) => !t.extra).map((t) => t.letter)).toEqual(['b']);
    }
  });

  it('a tap fills the blank, never a given slot', () => {
    let b = createBoard('table', { level: 'easy', blankIndex: 2, rng: seededRng(1) });
    expect(leftmostEmptySlot(b)).toBe(2);
    b = tapLetter(b, 'b');
    expect(b.slots).toEqual([null, null, b.tiles.find((t) => t.letter === 'b')!.id, null, null]);
    expect(isFull(b)).toBe(true);
    expect(currentSpelling(b)).toBe('table');
  });

  it('given slots cannot be overwritten or returned', () => {
    const b = createBoard('table', { level: 'easy', blankIndex: 2, rng: seededRng(1) });
    const t = poolTiles(b)[0];
    expect(placeTile(b, t.id, 0)).toBe(b);
    expect(returnTile(b, 0)).toBe(b);
  });

  it('a wrong letter goes back to the pool on Submit; the right one solves it', () => {
    let b = createBoard('table', { level: 'easy', blankIndex: 2, rng: seededRng(1) });
    const wrong = poolTiles(b).find((t) => t.extra)!;
    b = placeTile(b, wrong.id);
    let r = submitBoard(b);
    expect(r.allCorrect).toBe(false);
    expect(r.wrongSlots).toEqual([2]);
    expect(r.first).toBe(true);
    b = tapLetter(r.board, 'b');
    r = submitBoard(b);
    expect(r.allCorrect).toBe(true);
    expect(r.first).toBe(false);
    expect(isSolved(r.board)).toBe(true);
  });

  it('Hard offers the whole alphabet for the single blank', () => {
    const b = createBoard('table', { level: 'hard', blankIndex: 0 });
    expect(new Set(letters(b)).size).toBe(26);
  });

  it('a hint places the missing letter', () => {
    let b = createBoard('table', { level: 'medium', blankIndex: 2, rng: seededRng(2) });
    b = applyHint(b).board;
    const r = applyHint(b);
    expect(r.effect).toBe('placed-letter');
    expect(currentSpelling(r.board)).toBe('table');
    expect(isSolved(r.board)).toBe(true);
  });
});
