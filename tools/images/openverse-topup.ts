// Adds Openverse candidates to words that are waiting for review, for the groups where
// Wikimedia Commons is weakest (actions, describing words, people).
//
//   npx tsx tools/images/openverse-topup.ts --groups verbs,adjectives [--max 120]
//
// Openverse allows anonymous clients 200 searches a day. The run stops using it at the first failure.
import { existsSync, readFileSync } from 'node:fs';
import { loadState, loadWords, measure, rank, ROOT, saveState, searchOpenverse } from './lib.ts';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const groups = new Set((opt('--groups') ?? 'verbs,adjectives').split(','));
let budget = Number(opt('--max') ?? 120);
const queriesFile = ROOT + 'tools/images/retry-queries.json';
const queries: Record<string, string> = existsSync(queriesFile) ? JSON.parse(readFileSync(queriesFile, 'utf8')) : {};

const state = loadState();
const todo = loadWords().filter((w) => groups.has(w.group) && state[w.id]?.note === 'review' && !state[w.id].candidates.some((c) => c.provider === 'openverse'));
console.log(`Topping up ${todo.length} word(s) from Openverse (budget ${budget})`);

let added = 0;
let done = 0;
for (const word of todo) {
  if (budget <= 0) break;
  const st = state[word.id];
  // Openverse copes with a short natural phrase; strip anything unusual from it.
  const query = (queries[word.id] ?? word.searchQuery ?? word.word).replace(/[^a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    budget--;
    const found = (await searchOpenverse(query, 20)).filter((c) => !st.rejected.includes(c.fileUrl) && !st.candidates.some((m) => m.fileUrl === c.fileUrl));
    const best = await measure(rank(found, `${query} ${word.word}`).sort((x, y) => y.rel - x.rel).slice(0, 5));
    if (best.length > 0) {
      // Openverse results lead; the sheet still shows at most eight candidates.
      st.candidates = [...best, ...st.candidates].slice(0, 8);
      added++;
    }
  } catch (err) {
    console.warn(`Openverse failed for ${word.id}: ${String(err).slice(0, 90)} - stopping`);
    break;
  }
  if (++done % 10 === 0) {
    saveState(state);
    console.log(`${done}/${todo.length} searched, ${added} topped up`);
  }
}
saveState(state);
console.log(`Finished: ${added} word(s) gained Openverse candidates.`);
