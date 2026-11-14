// Builds candidate review sheets: one row per word, one numbered thumbnail per candidate.
// A reviewer looks at each row and records the best candidate number (or 0 for none).
//
//   npx tsx tools/images/strips.ts              words still awaiting a pick
//   npx tsx tools/images/strips.ts --all
import sharp, { type OverlayOptions } from 'sharp';
import { readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fetchBinary, loadState, loadWords, pool, SHEETS_DIR } from './lib.ts';

const ROWS = 6;
const COLS = 8;
const CELL = 176;
const LABEL_H = 34;
const ROW_H = CELL + LABEL_H + 8;
const W = COLS * CELL;

const all = process.argv.includes('--all');
const state = loadState();
const words = loadWords().filter((w) => {
  const st = state[w.id];
  if (!st || st.candidates.length === 0) return false;
  // Words already decided (a pick was made, or every candidate was rejected) are skipped.
  return all || (st.note !== 'picked' && st.note !== 'none');
});

for (const f of readdirSync(SHEETS_DIR)) if (f.startsWith('strip-')) unlinkSync(SHEETS_DIR + f);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const index: Record<string, string[]> = {};

for (let s = 0; s * ROWS < words.length; s++) {
  const rows = words.slice(s * ROWS, s * ROWS + ROWS);
  const composites: OverlayOptions[] = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${rows.length * ROW_H}">`;
  await pool(rows, 3, async (word, r) => {
    const st = state[word.id];
    const top = r * ROW_H;
    const live = st.candidates.filter((c) => !st.rejected.includes(c.fileUrl)).slice(0, COLS);
    svg += `<text x="6" y="${top + 24}" font-family="Arial" font-size="20" font-weight="bold" fill="#000">${esc(word.id)}: "${esc(word.word)}" ${esc(word.imagePrompt.slice(0, 95))}</text>`;
    for (let i = 0; i < live.length; i++) {
      const c = live[i];
      const n = st.candidates.indexOf(c) + 1;
      try {
        const buf = await fetchBinary(c.thumbUrl);
        if (!buf) continue;
        const img = await sharp(buf, { failOn: 'none' })
          .rotate()
          .flatten({ background: '#ffffff' })
          .resize(CELL - 6, CELL - 6, { fit: 'contain', background: '#ffffff' })
          .png()
          .toBuffer();
        composites.push({ input: img, left: i * CELL + 3, top: top + LABEL_H + 3 });
        svg += `<rect x="${i * CELL + 3}" y="${top + LABEL_H + 3}" width="34" height="30" fill="#000"/><text x="${i * CELL + 12}" y="${top + LABEL_H + 26}" font-family="Arial" font-size="24" font-weight="bold" fill="#ff0">${n}</text>`;
      } catch {
        /* skip a thumbnail that will not decode */
      }
    }
  });
  svg += '</svg>';
  const name = `strip-${String(s + 1).padStart(3, '0')}.jpg`;
  await sharp({ create: { width: W, height: rows.length * ROW_H, channels: 3, background: '#dddddd' } })
    .composite([...composites, { input: Buffer.from(svg), left: 0, top: 0 }])
    .jpeg({ quality: 82 })
    .toFile(SHEETS_DIR + name);
  index[name] = rows.map((w) => w.id);
}

writeFileSync(SHEETS_DIR + 'strip-index.json', JSON.stringify(index, null, 1));
console.log(`Wrote ${Object.keys(index).length} review sheet(s) for ${words.length} word(s)`);
