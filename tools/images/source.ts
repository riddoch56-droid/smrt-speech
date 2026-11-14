// Sources one picture per word from openly licensed collections.
//
//   npx tsx tools/images/source.ts                 every word with no picture yet
//   npx tsx tools/images/source.ts --only id,id    just these words
//   npx tsx tools/images/source.ts --group food    one group
//
// If OPENAI_API_KEY is set, generation is the preferred route (see generate.ts);
// this script is the open-licence route used otherwise.
import {
  loadState,
  loadWords,
  pool,
  measure,
  rank,
  saveState,
  searchCommons,
  searchOpenverse,
  shortlist,
  type Candidate,
  type WordState,
} from './lib.ts';

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = arg('--only')?.split(',');
const group = arg('--group');
const useOpenverse = !args.includes('--no-openverse');
const OPENVERSE_GROUPS = new Set(['verbs', 'people']);

const state = loadState();
const words = loadWords().filter((w) => {
  if (only) return only.includes(w.id);
  if (group && w.group !== group) return false;
  return !state[w.id] || state[w.id].status === 'pending';
});

console.log(`Sourcing ${words.length} word(s)`);
let done = 0;
let ok = 0;

await pool(words, 2, async (word) => {
  const query = word.searchQuery || word.word;
  const st: WordState = state[word.id] ?? { query, candidates: [], rejected: [], chosen: null, attempts: 0, status: 'pending' };
  try {
    const sets: Candidate[][] = [];
    // Licence-filtered searches first (CC0 and CC BY), then an unfiltered search that
    // also finds public-domain files and, as a last resort, CC BY-SA.
    sets.push(await searchCommons(query, 30, true));
    // A second search on the bare word only when the first found little: API calls are scarce.
    if (query !== word.word && sets[0].length < 6) sets.push(await searchCommons(word.word, 30, true));
    // Openverse (mostly Flickr) is far better for actions, properties and people, but
    // anonymous use is capped at 200 searches a day, so it is kept for those groups.
    if (useOpenverse && OPENVERSE_GROUPS.has(word.group)) {
      try {
        sets.push(await searchOpenverse(query, 20));
      } catch (err) {
        console.warn('Openverse failed for', word.id, String(err).slice(0, 80));
      }
    }
    const merged: Candidate[] = [];
    for (const set of sets) for (const c of set) if (!merged.some((m) => m.fileUrl === c.fileUrl)) merged.push(c);
    st.query = query;
    const ranked = rank(merged, `${query} ${word.word}`);
    const fromOpenverse = ranked.filter((c) => c.provider === 'openverse').sort((x, y) => y.rel - x.rel).slice(0, 5);
    // Where Openverse was searched, its results lead: Commons is weak for actions and people.
    const short = [...fromOpenverse, ...shortlist(ranked.filter((c) => c.provider !== 'openverse'), 8 - fromOpenverse.length)];
    // A plain, light background nudges a candidate up the shortlist, but relevance still leads.
    st.candidates = (await measure(short)).sort((x, y) => y.score + y.plain * 1.5 - (x.score + x.plain * 1.5));
    st.attempts = Math.max(1, st.attempts);
    // Nothing is downloaded at full size until a candidate has been chosen by eye.
    st.status = st.candidates.length > 0 ? 'ok' : 'todo';
    st.note = st.candidates.length > 0 ? 'review' : 'none';
    if (st.candidates.length > 0) ok++;
  } catch (err) {
    st.status = 'pending';
    st.note = String(err).slice(0, 200);
  }
  state[word.id] = st;
  done++;
  if (done % 10 === 0) {
    saveState(state);
    console.log(`${new Date().toTimeString().slice(0, 8)} ${done}/${words.length} searched, ${ok} with candidates`);
  }
});

saveState(state);
console.log(`Finished: ${ok} of ${words.length} have a picture.`);
