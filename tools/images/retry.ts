// Another attempt for words whose candidates were all rejected (up to three attempts per word).
//
//   npx tsx tools/images/retry.ts [--openverse] [--openverse-groups verbs,people] [--openverse-max 190] [--limit n]
//
// Openverse allows anonymous clients 200 searches a day, so it can be kept for the groups that
// need it most and capped. If it fails once it is left out for the rest of the run.
//
// New search phrases can be supplied in tools/images/retry-queries.json as { "<word id>": "query" }.
import { existsSync, readFileSync } from 'node:fs';
import {
  loadState,
  loadWords,
  MAX_ATTEMPTS,
  measure,
  OUT_DIR,
  rank,
  ROOT,
  saveState,
  searchCommons,
  searchOpenverse,
  shortlist,
  type Candidate,
} from './lib.ts';

const args = process.argv.slice(2);
let useOpenverse = args.includes('--openverse');
const ovGroupsArg = args.indexOf('--openverse-groups');
const ovGroups = ovGroupsArg >= 0 ? new Set(args[ovGroupsArg + 1].split(',')) : null;
const ovMaxArg = args.indexOf('--openverse-max');
let ovBudget = ovMaxArg >= 0 ? Number(args[ovMaxArg + 1]) : Infinity;
const limitArg = args.indexOf('--limit');
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
const queriesFile = ROOT + 'tools/images/retry-queries.json';
const queries: Record<string, string> = existsSync(queriesFile) ? JSON.parse(readFileSync(queriesFile, 'utf8')) : {};

const state = loadState();
const todo = loadWords()
  // A word marked "none" that still has a picture file was given one by the project (a colour swatch).
  .filter((w) => state[w.id]?.note === 'none' && state[w.id].attempts < MAX_ATTEMPTS && !existsSync(OUT_DIR + w.image))
  .slice(0, limit);
console.log(`Retrying ${todo.length} word(s)${useOpenverse ? ' with Openverse' : ''}`);

const FILLER = new Set(
  'a an the of on in at to up with and for from his her their its one man woman person people adult someone somebody being'.split(' '),
);

/**
 * Commons matches every word of a search, so a long descriptive phrase finds nothing.
 * Try the three most telling words first, then two.
 */
function commonsQueries(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w && !FILLER.has(w));
  if (words.length <= 2) return [words.join(' ') || query];
  return [words.slice(0, 3).join(' '), words.slice(0, 2).join(' ')];
}

let found = 0;
let done = 0;
for (const word of todo) {
  const st = state[word.id];
  const query = queries[word.id] ?? (st.attempts === 1 ? `${word.word} ${word.subgroup}` : word.word);
  try {
    const sets: Candidate[][] = [];
    if (useOpenverse && ovBudget > 0 && (!ovGroups || ovGroups.has(word.group))) {
      try {
        ovBudget--;
        sets.push(await searchOpenverse(query, 20));
      } catch (err) {
        console.warn('Openverse failed for', word.id, String(err).slice(0, 80), '- not using it again in this run');
        useOpenverse = false;
      }
    }
    // The last attempt also accepts CC BY-SA, which the credits then flag as a last resort.
    const lastAttempt = st.attempts + 1 >= MAX_ATTEMPTS;
    const fromCommons: Candidate[] = [];
    for (const q of commonsQueries(query)) {
      const got = await searchCommons(q, 30, !lastAttempt);
      for (const c of got) if (!fromCommons.some((m) => m.fileUrl === c.fileUrl)) fromCommons.push(c);
      if (fromCommons.filter((c) => !st.rejected.includes(c.fileUrl)).length >= 6) break;
    }
    sets.push(fromCommons);
    const merged: Candidate[] = [];
    for (const set of sets) {
      for (const c of set) {
        if (!st.rejected.includes(c.fileUrl) && !merged.some((m) => m.fileUrl === c.fileUrl)) merged.push(c);
      }
    }
    const ranked = rank(merged, `${query} ${word.word}`);
    const fromOpenverse = ranked.filter((c) => c.provider === 'openverse').sort((x, y) => y.rel - x.rel).slice(0, 5);
    const short = [...fromOpenverse, ...shortlist(ranked.filter((c) => c.provider !== 'openverse'), 8 - fromOpenverse.length)];
    st.candidates = await measure(short);
    st.query = query;
    st.attempts += 1;
    st.note = st.candidates.length > 0 ? 'review' : 'none';
    if (st.candidates.length > 0) found++;
  } catch (err) {
    console.warn(`Search failed for ${word.id}: ${String(err).slice(0, 100)}`);
  }
  done++;
  if (done % 10 === 0) {
    saveState(state);
    console.log(`${done}/${todo.length} retried, ${found} with new candidates`);
  }
}
saveState(state);
console.log(`Finished: ${found} of ${todo.length} have new candidates to review.`);
