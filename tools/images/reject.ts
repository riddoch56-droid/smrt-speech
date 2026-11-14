// Withdraws pictures that failed the final contact-sheet check, so the words get another attempt.
//
// tools/images/picks/qc-rejects.json is { "<word id>": "<reason>" }.
// Each rejection is acted on once and then recorded in qc-rejects-done.json, so a replacement
// picture chosen in a later round is not withdrawn by mistake. To reject a replacement too,
// change the word's reason text.
//
//   npx tsx tools/images/reject.ts
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { loadState, loadWords, OUT_DIR, ROOT, saveState } from './lib.ts';

const file = ROOT + 'tools/images/picks/qc-rejects.json';
const rejects: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const doneFile = ROOT + 'tools/images/picks/qc-rejects-done.json';
const done: Record<string, string> = existsSync(doneFile) ? JSON.parse(readFileSync(doneFile, 'utf8')) : {};
const state = loadState();
const words = new Map(loadWords().map((w) => [w.id, w]));
let n = 0;

for (const id of Object.keys(rejects)) {
  if (done[id] === rejects[id]) continue;
  done[id] = rejects[id];
  const st = state[id];
  const word = words.get(id);
  if (!st || !word) {
    console.warn(`Unknown word id: ${id}`);
    continue;
  }
  // Only a picture that is currently chosen can be withdrawn; anything else has moved on already.
  if (st.note !== 'picked' || !st.chosen) continue;
  if (!st.rejected.includes(st.chosen)) st.rejected.push(st.chosen);
  for (const c of st.candidates) if (!st.rejected.includes(c.fileUrl)) st.rejected.push(c.fileUrl);
  st.chosen = null;
  st.status = 'todo';
  st.note = 'none';
  if (existsSync(OUT_DIR + word.image)) unlinkSync(OUT_DIR + word.image);
  n++;
}

saveState(state);
writeFileSync(doneFile, JSON.stringify(done, null, 1));
console.log(`Withdrew ${n} picture(s).`);
