// Colour words are shown as a plain paint-blob swatch generated for this project,
// which is clearer and more consistent than any photograph of a coloured object.
//
//   npx tsx tools/images/make-swatches.ts
import sharp from 'sharp';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { ImageCredit } from '../../src/content/types.ts';
import { loadWords, OUT_DIR, ROOT } from './lib.ts';

const COLOURS: Record<string, string> = {
  red: '#d7191c',
  blue: '#1f5fbf',
  green: '#2e9e3f',
  yellow: '#f7d417',
  purple: '#7b2d9b',
  pink: '#f48fb1',
  brown: '#7a4a21',
  grey: '#8e8e8e',
  black: '#111111',
  white: '#ffffff',
  orange: '#f28c1b',
};

// An irregular rounded blob, so a colour swatch is never mistaken for the word "square" or "round".
const BLOB =
  'M256 58c62-10 118 14 150 62 30 44 52 96 36 150-14 50-52 92-98 118-48 28-108 40-160 18-50-22-92-66-106-120-14-52-2-112 34-154 36-42 92-66 144-74z';

const creditsFile = ROOT + 'src/content/image-credits.json';
const credits: ImageCredit[] = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, 'utf8')) : [];
const today = new Date().toISOString().slice(0, 10);
let made = 0;

for (const word of loadWords().filter((w) => w.group === 'adjectives' && w.word in COLOURS)) {
  const fill = COLOURS[word.word];
  const stroke = word.word === 'white' ? '#9a9a9a' : 'none';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#ffffff"/><path d="${BLOB}" fill="${fill}" stroke="${stroke}" stroke-width="4"/></svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 90 }).toFile(OUT_DIR + word.image);
  const credit: ImageCredit = {
    image: word.image,
    source: 'project',
    sourceUrl: '',
    author: 'SMRT Speech project',
    licence: 'Generated for SMRT Speech',
    licenceUrl: '',
    retrieved: today,
    modifications: 'None. Drawn by a build script as a plain colour swatch.',
    prompt: `A plain ${word.word} paint swatch on a white background`,
  };
  const i = credits.findIndex((c) => c.image === word.image);
  if (i >= 0) credits[i] = credit;
  else credits.push(credit);
  made++;
}

writeFileSync(creditsFile, JSON.stringify(credits, null, 1) + '\n');
console.log(`Made ${made} colour swatch(es).`);
