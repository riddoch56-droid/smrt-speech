// Builds labelled contact sheets of the final processed pictures, 20 per sheet,
// for the last visual check and for writing reading content against the real pictures.
//
//   npx tsx tools/images/sheets.ts [--group food] [--cols 4 --rows 3 --cell 420]
//       [--out reading1]      write into tools/images/sheets/<name>/ instead of the sheets folder
//       [--skip file.json]    leave out the word ids that are keys of this JSON object
//       [--only file.json]    include only the word ids in this JSON array
//       [--ids]               label each picture with its word id as well as the word
import sharp, { type OverlayOptions } from 'sharp';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { loadWords, OUT_DIR, SHEETS_DIR } from './lib.ts';

const opt = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const COLS = Number(opt('--cols') ?? 5);
const ROWS = Number(opt('--rows') ?? 4);
const CELL = Number(opt('--cell') ?? 280);
const LABEL = 40;
const group = opt('--group') ?? null;
const showIds = process.argv.includes('--ids');
const DIR = opt('--out') ? SHEETS_DIR + opt('--out') + '/' : SHEETS_DIR;
const skip = new Set<string>(opt('--skip') ? Object.keys(JSON.parse(readFileSync(opt('--skip')!, 'utf8')) as object) : []);
const only = opt('--only') ? new Set<string>(JSON.parse(readFileSync(opt('--only')!, 'utf8')) as string[]) : null;

mkdirSync(DIR, { recursive: true });
for (const f of readdirSync(DIR)) if (f.startsWith('sheet-')) unlinkSync(DIR + f);

const words = loadWords().filter(
  (w) => (!group || w.group === group) && !skip.has(w.id) && (!only || only.has(w.id)) && existsSync(OUT_DIR + w.image),
);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const index: Record<string, string[]> = {};
const per = COLS * ROWS;

for (let s = 0; s * per < words.length; s++) {
  const batch = words.slice(s * per, s * per + per);
  const rows = Math.ceil(batch.length / COLS);
  const width = COLS * CELL;
  const height = rows * (CELL + LABEL);
  const composites: OverlayOptions[] = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  for (let i = 0; i < batch.length; i++) {
    const w = batch[i];
    const x = (i % COLS) * CELL;
    const y = Math.floor(i / COLS) * (CELL + LABEL);
    const img = await sharp(OUT_DIR + w.image).resize(CELL - 8, CELL - 8, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
    composites.push({ input: img, left: x + 4, top: y + 4 });
    svg += `<text x="${x + 8}" y="${y + CELL + 27}" font-family="Arial" font-size="22" font-weight="bold" fill="#000">${showIds ? esc(`${w.id} (${w.word})`) : `${s * per + i + 1}. ${esc(w.word)}`}</text>`;
  }
  svg += '</svg>';
  const name = `sheet-${String(s + 1).padStart(2, '0')}.jpg`;
  await sharp({ create: { width, height, channels: 3, background: '#cccccc' } })
    .composite([...composites, { input: Buffer.from(svg), left: 0, top: 0 }])
    .jpeg({ quality: 84 })
    .toFile(DIR + name);
  index[name] = batch.map((w) => w.id);
}

writeFileSync(DIR + 'sheet-index.json', JSON.stringify(index, null, 1));
console.log(`Wrote ${Object.keys(index).length} contact sheet(s) for ${words.length} picture(s)`);
