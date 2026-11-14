// Applies visual review decisions for one review round.
//
// Each file tools/images/picks/round<N>-*.json is JSON of the form
// { "<word id>": <candidate number> }, where the number is the yellow label on the review
// sheet and 0 means "none is good enough". Round N covers words on their Nth attempt.
//
//   npx tsx tools/images/apply-picks.ts --round 1
//   npx tsx tools/images/apply-picks.ts --round 2 --file round2-restore.json   (one picks file only)
import { existsSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { fetchCandidateFile, loadState, loadWords, OUT_DIR, processImage, ROOT, saveState } from './lib.ts';

const roundArg = process.argv.indexOf('--round');
const round = roundArg >= 0 ? Number(process.argv[roundArg + 1]) : NaN;
if (!Number.isInteger(round) || round < 1) {
  console.error('Usage: apply-picks.ts --round <n>');
  process.exit(1);
}

const fileArg = process.argv.indexOf('--file');
const onlyFile = fileArg >= 0 ? process.argv[fileArg + 1] : null;
const dir = ROOT + 'tools/images/picks/';
const state = loadState();
const words = new Map(loadWords().map((w) => [w.id, w]));
const picks: Record<string, number> = {};
for (const f of existsSync(dir) ? readdirSync(dir).filter((x) => (onlyFile ? x === onlyFile : x.startsWith(`round${round}-`) && x.endsWith('.json'))).sort() : []) {
  Object.assign(picks, JSON.parse(readFileSync(dir + f, 'utf8')) as Record<string, number>);
}

let chosen = 0;
let none = 0;
let failed = 0;
let touched = 0;

for (const [id, n] of Object.entries(picks)) {
  const st = state[id];
  const word = words.get(id);
  if (!st || !word) {
    console.warn(`Unknown word id in picks: ${id}`);
    continue;
  }
  // Picks belong to the candidates of their own round only.
  if (st.attempts !== round || st.note === 'picked') continue;
  const cand = n > 0 ? st.candidates[n - 1] : undefined;
  if (!cand) {
    if (st.note === 'none') continue;
    for (const c of st.candidates) if (!st.rejected.includes(c.fileUrl)) st.rejected.push(c.fileUrl);
    st.chosen = null;
    st.status = 'todo';
    st.note = 'none';
    if (existsSync(OUT_DIR + word.image)) unlinkSync(OUT_DIR + word.image);
    none++;
    continue;
  }
  try {
    const buf = await fetchCandidateFile(cand);
    if (!buf) throw new Error('download failed');
    const res = await processImage(buf, OUT_DIR + word.image, cand.plain);
    st.rejected = st.rejected.filter((u) => u !== cand.fileUrl);
    st.chosen = cand.fileUrl;
    st.status = 'ok';
    st.note = 'picked';
    st.trimmed = res.trimmed;
    st.bytes = res.bytes;
    st.retrieved = new Date().toISOString().slice(0, 10);
    chosen++;
  } catch (err) {
    // Leave the word undecided so the same pick is tried again on the next run.
    console.warn(`Could not process ${id}: ${String(err).slice(0, 100)}`);
    st.note = 'review';
    failed++;
  }
  if (++touched % 20 === 0) saveState(state);
}

saveState(state);
const all = Object.values(state);
console.log(`Round ${round}: ${chosen} chosen, ${none} with no good candidate, ${failed} failed to download (run again to retry).`);
console.log(`Overall: ${all.filter((s) => s.note === 'picked').length} words have a reviewed picture, ${all.filter((s) => s.note === 'none').length} need another attempt.`);
