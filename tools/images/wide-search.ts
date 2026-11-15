// A fifth, wider search for words that still have no picture (run at the owner's request).
// Earlier rounds showed a reviewer 8 to 16 candidates a word. This round gathers a much larger
// pool, up to 48 a word, from:
//  - Wikimedia Commons full-text search, 50 results a phrase (earlier rounds read 20);
//  - the named Commons categories of round 4, in search-relevance order (round 4 read them
//    alphabetically, so only the first file names were ever seen);
//  - Openverse without its Wikimedia copies (mostly Flickr), CC0, public domain, CC BY and,
//    as a flagged last resort, CC BY-SA.
// Pictures a reviewer has already turned down are left out.
//
//   npx tsx tools/images/wide-search.ts --round 5 [--openverse-max 190] [--limit n] [--only id,id]
//   npx tsx tools/images/wide-search.ts --round 6 --openverse-cached --extra wide-queries-6.json
// A later round repeats the same searches from the cache and shows the candidates not yet seen.
//
// tools/images/wide-queries.json: { "<word id>": { "s": [Commons phrases], "o": [Openverse phrases] } }
import { existsSync, readFileSync } from 'node:fs';
import { loadState, loadWords, measure, OUT_DIR, ROOT, saveState, searchCommons, searchOpenverse, type Candidate } from './lib.ts';

interface Query {
  s: string[];
  o?: string[];
}

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const round = Number(opt('--round'));
if (!Number.isInteger(round) || round < 5) {
  console.error('Usage: wide-search.ts --round <5 or more>');
  process.exit(1);
}
let ovBudget = Number(opt('--openverse-max') ?? 190);
const limit = Number(opt('--limit') ?? Infinity);
const only = opt('--only')?.split(',');
const SHOW = 48;
// --openverse-cached reuses Openverse answers saved by an earlier round and asks for nothing new.
const ovCached = args.includes('--openverse-cached');

const read = <T>(name: string) => JSON.parse(readFileSync(ROOT + 'tools/images/' + name, 'utf8')) as Record<string, T>;
const queries = read<Query>('wide-queries.json');
// --extra <file> adds further Commons phrases, tried first: { "<word id>": ["phrase", ...] }
if (opt('--extra')) for (const [id, more] of Object.entries(read<string[]>(opt('--extra')!))) if (queries[id]) queries[id].s = [...more, ...queries[id].s];
const categories = read<{ cat?: string[] }>('deep-categories.json');

const state = loadState();
const todo = loadWords()
  .filter((w) => queries[w.id] && state[w.id] && state[w.id].note !== 'picked' && state[w.id].attempts < round && !existsSync(OUT_DIR + w.image))
  .filter((w) => !only || only.includes(w.id))
  .slice(0, limit);
console.log(`Round ${round}: searching again for ${todo.length} word(s)`);

const pools = new Map<string, { commons: Candidate[][]; openverse: Candidate[][] }>();
for (const w of todo) pools.set(w.id, { commons: [], openverse: [] });
const modern = (list: Candidate[]) => list.filter((c) => c.score > -1.5);

// Openverse allows 200 requests a day, so every word gets its first phrase before any gets a second.
async function openverse() {
  let fails = 0;
  for (const pass of [0, 1]) {
    for (const w of todo) {
      const phrase = queries[w.id].o?.[pass];
      if (!phrase || (!ovCached && ovBudget <= 0) || fails >= 6) continue;
      if (!ovCached) ovBudget--;
      try {
        pools.get(w.id)!.openverse.push(await searchOpenverse(phrase, 20, 'cc0,pdm,by,by-sa', false, true, ovCached));
        fails = 0;
      } catch (err) {
        fails++;
        console.warn(`Openverse failed for ${w.id}: ${String(err).slice(0, 70)}${fails >= 6 ? ' - not using it again in this run' : ''}`);
      }
    }
  }
  console.log(`Openverse done. Requests left in this run's budget: ${ovBudget}`);
}

// Take turns between the sources so that no single one fills a word's sheet.
let found = 0;
let shortlisted = 0;
async function finish(word: (typeof todo)[number]) {
  const st = state[word.id];
  const p = pools.get(word.id)!;
  const seen = new Set<string>(st.rejected);
  const lanes = [...p.openverse, ...p.commons].map((list) => list.filter((c) => (seen.has(c.fileUrl) ? false : (seen.add(c.fileUrl), true))));
  const short: Candidate[] = [];
  for (let i = 0; short.length < SHOW + 8 && lanes.some((l) => l.length > i); i++) {
    for (const lane of lanes) if (lane[i] && short.length < SHOW + 8) short.push(lane[i]);
  }
  st.candidates = (await measure(short)).slice(0, SHOW);
  st.query = queries[word.id].s[0];
  st.attempts = round;
  st.note = st.candidates.length > 0 ? 'review' : 'none';
  if (st.candidates.length > 0) found++;
  if (++shortlisted % 10 === 0) {
    saveState(state);
    console.log(`${shortlisted}/${todo.length} shortlisted, ${found} with candidates`);
  }
}

// Openverse finishes first; each word is then shortlisted as soon as its Commons search ends.
let queue: Promise<void> = openverse();

async function commons() {
  let done = 0;
  for (const w of todo) {
    const q = queries[w.id];
    const lanes = pools.get(w.id)!.commons;
    try {
      for (const phrase of q.s) lanes.push(modern(await searchCommons(phrase, 50)));
      const cats = categories[w.id]?.cat ?? [];
      if (cats.length > 0) lanes.push(modern(await searchCommons(`incategory:"${cats.join('|')}"`, 50)));
    } catch (err) {
      console.warn(`Commons failed for ${w.id}: ${String(err).slice(0, 100)}`);
    }
    queue = queue.then(() => finish(w));
    if (++done % 10 === 0) console.log(`Commons: ${done}/${todo.length} words searched`);
  }
  console.log('Commons done.');
}

await commons();
await queue;
saveState(state);
console.log(`Finished: ${found} of ${todo.length} have candidates to review.`);
