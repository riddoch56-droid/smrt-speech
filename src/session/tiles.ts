import { shuffle, type Rng } from './rng';
import type { TileLevel } from './types';

export interface Tile {
  id: number;
  letter: string;
  /** True for a distractor tile that is not part of the word. */
  extra: boolean;
  /** Slot the tile sits in, or null when it is in the pool. */
  slot: number | null;
  /** Removed from play by a hint. */
  removed: boolean;
}

export interface TileBoard {
  target: string;
  tiles: Tile[];
  /** Tile id in each slot, or null. */
  slots: (number | null)[];
  /** Locked slots hold a confirmed letter and cannot be changed. */
  locked: boolean[];
  /** Letters shown as given (Fill in the Blank). Locked from the start. */
  given: boolean[];
  submits: number;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

export interface BoardOptions {
  level: TileLevel;
  /** Index of the single missing letter for Fill in the Blank. Omit to spell the whole word. */
  blankIndex?: number;
  rng?: Rng;
}

function distractors(target: string, n: number, rng: Rng): string[] {
  const unused = ALPHABET.split('').filter((l) => !target.includes(l));
  return shuffle(unused, rng).slice(0, n);
}

/**
 * Easy: only the letters needed. Medium: needed letters plus three or four extras.
 * Hard: the full alphabet (with spare copies of any letter the word repeats).
 * Fill in the Blank always offers at least three tiles so there is a real choice.
 */
export function createBoard(word: string, opts: BoardOptions): TileBoard {
  const rng = opts.rng ?? Math.random;
  const target = word.toLowerCase();
  const letters = target.split('');
  const fill = opts.blankIndex !== undefined;
  const needed = fill ? [letters[opts.blankIndex!]] : letters;

  let pool: { letter: string; extra: boolean }[] = needed.map((letter) => ({ letter, extra: false }));
  if (opts.level === 'hard') {
    const counts = new Map<string, number>();
    for (const l of needed) counts.set(l, (counts.get(l) ?? 0) + 1);
    for (const l of ALPHABET) if (!counts.has(l)) pool.push({ letter: l, extra: true });
    pool.sort((a, b) => a.letter.localeCompare(b.letter));
  } else {
    const extraCount = opts.level === 'medium' ? 3 + Math.floor(rng() * 2) : fill ? 2 : 0;
    pool = shuffle([...pool, ...distractors(target, extraCount, rng).map((letter) => ({ letter, extra: true }))], rng);
    // Avoid handing the word over already in order.
    if (!fill && pool.length > 1 && pool.map((p) => p.letter).join('') === target) pool.reverse();
  }

  const tiles: Tile[] = pool.map((p, id) => ({ id, letter: p.letter, extra: p.extra, slot: null, removed: false }));
  const slots: (number | null)[] = letters.map(() => null);
  const given = letters.map((_, i) => fill && i !== opts.blankIndex);
  return { target, tiles, slots, locked: given.slice(), given, submits: 0 };
}

/** Chooses which letter to blank out: prefer an interior position when the word allows. */
export function chooseBlankIndex(word: string, rng: Rng = Math.random): number {
  if (word.length <= 2) return Math.floor(rng() * word.length);
  return Math.floor(rng() * word.length);
}

export function letterAt(board: TileBoard, slot: number): string | null {
  if (board.given[slot]) return board.target[slot];
  const id = board.slots[slot];
  return id === null ? null : board.tiles[id].letter;
}

export function currentSpelling(board: TileBoard): string {
  return board.slots.map((_, i) => letterAt(board, i) ?? '_').join('');
}

export function poolTiles(board: TileBoard): Tile[] {
  return board.tiles.filter((t) => t.slot === null && !t.removed);
}

function isFree(board: TileBoard, slot: number): boolean {
  return !board.given[slot] && !board.locked[slot] && board.slots[slot] === null;
}

export function leftmostEmptySlot(board: TileBoard): number {
  return board.slots.findIndex((_, i) => isFree(board, i));
}

export function isFull(board: TileBoard): boolean {
  return leftmostEmptySlot(board) === -1;
}

function clone(board: TileBoard): TileBoard {
  return {
    ...board,
    tiles: board.tiles.map((t) => ({ ...t })),
    slots: board.slots.slice(),
    locked: board.locked.slice(),
  };
}

/**
 * Puts a tile in a slot. With no slot given (a tap), it fills the leftmost empty slot.
 * Dropping onto an occupied, unlocked slot swaps the old tile back to the pool.
 */
export function placeTile(board: TileBoard, tileId: number, slot?: number): TileBoard {
  const tile = board.tiles[tileId];
  if (!tile || tile.removed) return board;
  const dest = slot ?? leftmostEmptySlot(board);
  if (dest < 0 || dest >= board.slots.length) return board;
  if (board.given[dest] || board.locked[dest]) return board;
  if (tile.slot !== null && board.locked[tile.slot]) return board;
  if (tile.slot === dest) return board;
  const next = clone(board);
  const moving = next.tiles[tileId];
  const from = moving.slot;
  const occupant = next.slots[dest];
  if (from !== null) next.slots[from] = null;
  if (occupant !== null) {
    // Swap when the tile came from another slot, otherwise send the occupant home.
    next.tiles[occupant].slot = from;
    if (from !== null) next.slots[from] = occupant;
  }
  next.slots[dest] = tileId;
  moving.slot = dest;
  return next;
}

/** Tapping a placed tile returns it to the pool. Locked letters stay put. */
export function returnTile(board: TileBoard, slot: number): TileBoard {
  const id = board.slots[slot];
  if (id === null || id === undefined || board.locked[slot] || board.given[slot]) return board;
  const next = clone(board);
  next.slots[slot] = null;
  next.tiles[id].slot = null;
  return next;
}

export interface SubmitResult {
  board: TileBoard;
  allCorrect: boolean;
  /** True when this was the first Submit of the trial: the one that is scored. */
  first: boolean;
  wrongSlots: number[];
}

/** Marks the word. Correct letters lock in place and wrong letters go back to the pool. */
export function submitBoard(board: TileBoard): SubmitResult {
  const next = clone(board);
  const wrongSlots: number[] = [];
  next.slots.forEach((id, i) => {
    if (next.given[i] || next.locked[i]) return;
    if (id !== null && next.tiles[id].letter === next.target[i]) {
      next.locked[i] = true;
    } else {
      wrongSlots.push(i);
      if (id !== null) {
        next.tiles[id].slot = null;
        next.slots[i] = null;
      }
    }
  });
  next.submits = board.submits + 1;
  return { board: next, allCorrect: wrongSlots.length === 0, first: board.submits === 0, wrongSlots };
}

export function isSolved(board: TileBoard): boolean {
  return board.slots.every((_, i) => board.given[i] || board.locked[i]);
}

export type HintEffect = 'removed-extras' | 'placed-letter' | 'none';

/**
 * Hint: the first press removes the extra tiles. Later presses place the next correct
 * letter in the leftmost unconfirmed slot and lock it.
 */
export function applyHint(board: TileBoard): { board: TileBoard; effect: HintEffect } {
  const next = clone(board);
  const extras = next.tiles.filter((t) => t.extra && !t.removed);
  if (extras.length > 0) {
    for (const t of extras) {
      if (t.slot !== null) next.slots[t.slot] = null;
      t.slot = null;
      t.removed = true;
    }
    return { board: next, effect: 'removed-extras' };
  }
  const slot = next.slots.findIndex((_, i) => !next.given[i] && !next.locked[i]);
  if (slot === -1) return { board, effect: 'none' };
  const want = next.target[slot];
  const occupant = next.slots[slot];
  if (occupant !== null && next.tiles[occupant].letter !== want) {
    next.tiles[occupant].slot = null;
    next.slots[slot] = null;
  }
  if (next.slots[slot] === null) {
    const tile =
      next.tiles.find((t) => !t.removed && t.letter === want && t.slot === null) ??
      next.tiles.find((t) => !t.removed && t.letter === want && t.slot !== null && !next.locked[t.slot]);
    if (!tile) return { board, effect: 'none' };
    if (tile.slot !== null) next.slots[tile.slot] = null;
    tile.slot = slot;
    next.slots[slot] = tile.id;
  }
  next.locked[slot] = true;
  return { board: next, effect: 'placed-letter' };
}
