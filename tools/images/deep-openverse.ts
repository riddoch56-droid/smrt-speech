// Adds Openverse candidates to words waiting for review in an extended round, for use when
// Openverse was not answering during deep-search.ts. Up to six Openverse pictures replace the
// last candidates of each word, so a review sheet still shows at most 16.
//
//   npx tsx tools/images/deep-openverse.ts --round 4 [--max 110]
//
// Run it before building review sheets: it changes the candidate numbers.
import { readFileSync } from 'node:fs';
import { loadState, loadWords, measure, ROOT, saveState, searchOpenverse, type Candidate } from './lib.ts';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const round = Number(opt('--round'));
let budget = Number(opt('--max') ?? 110);
const queries = JSON.parse(readFileSync(ROOT + 'tools/images/deep-queries.json', 'utf8')) as Record<string, { o?: string }>;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const state = loadState();
const todo = loadWords().filter((w) => {
  const st = state[w.id];
  return queries[w.id]?.o && st?.attempts === round && st.note === 'review' && !st.candidates.some((c) => c.provider === 'openverse');
});
console.log(`Topping up ${todo.length} word(s) from Openverse (budget ${budget})`);

let added = 0;
let done = 0;
let failsInARow = 0;
for (const word of todo) {
  if (budget <= 0 || failsInARow >= 5) break;
  const st = state[word.id];
  let found: Candidate[] | null = null;
  for (let attempt = 0; attempt < 3 && !found; attempt++) {
    budget--;
    try {
      found = await searchOpenverse(queries[word.id].o!, 20, 'cc0,pdm,by,by-sa', false);
    } catch {
      await sleep(8000);
    }
  }
  if (!found) {
    failsInARow++;
    console.warn(`Openverse gave no answer for ${word.id}`);
    continue;
  }
  failsInARow = 0;
  const fresh = found.filter((c) => !st.rejected.includes(c.fileUrl) && !st.candidates.some((m) => m.fileUrl === c.fileUrl)).slice(0, 8);
  const best = (await measure(fresh)).slice(0, 6);
  if (best.length > 0) {
    // Keep the lead pictures in front, then alternate would be ideal; simply keep the first ten.
    st.candidates = [...st.candidates.slice(0, 16 - best.length), ...best];
    added++;
  }
  if (++done % 10 === 0) {
    saveState(state);
    console.log(`${done}/${todo.length} searched, ${added} topped up`);
  }
}
saveState(state);
console.log(`Finished: ${added} word(s) gained Openverse candidates. Budget left: ${budget}`);
