import type { ImageCredit, ReadingItem, Screener, Word } from './types';
import food from './words/food.json';
import animals from './words/animals.json';
import clothing from './words/clothing.json';
import household from './words/household.json';
import furniture from './words/furniture.json';
import body from './words/body.json';
import transport from './words/transport.json';
import places from './words/places.json';
import people from './words/people.json';
import nature from './words/nature.json';
import verbs from './words/verbs.json';
import adjectives from './words/adjectives.json';
import phrases from './reading/phrases.json';
import sentences from './reading/sentences.json';
import screener from './screener.json';
import credits from './image-credits.json';

export const WORDS: Word[] = [
  food,
  animals,
  clothing,
  household,
  furniture,
  body,
  transport,
  places,
  people,
  nature,
  verbs,
  adjectives,
].flat() as Word[];

export const WORDS_BY_ID: Map<string, Word> = new Map(WORDS.map((w) => [w.id, w]));

export const READING_ITEMS: ReadingItem[] = [...(phrases as ReadingItem[]), ...(sentences as ReadingItem[])];

export const SCREENER = screener as Screener;

export const IMAGE_CREDITS = credits as ImageCredit[];

/** Every bundled image file the app can show, for the offline download step. */
export function bundledImageFiles(): string[] {
  const files = new Set<string>();
  for (const w of WORDS) if (w.hasImage !== false) files.add(w.image);
  for (const r of READING_ITEMS) files.add(r.image);
  return [...files].sort();
}
