// An extended search for words that still have no picture after the standard three attempts.
// Run at the owner's request (round 4 onwards). Keyword search on Wikimedia Commons ranks scenic
// "featured" photographs above plain pictures of an object, so this round draws on sources that
// editors have already matched to the concept:
//  - the lead picture and other pictures of the matching English Wikipedia article;
//  - the main picture (P18) and Commons category (P373) recorded for the concept on Wikidata;
//  - files placed directly in named Commons categories ("Wooden chairs", "Sneezing");
//  - Commons files with the search phrase in their title;
//  - Openverse, now including CC BY-SA.
// Every file's own licence is still checked, and the reviewer sees up to 16 candidates a word.
// CC BY-SA pictures stay a flagged last resort: apply-picks prefers any acceptable picture with a
// more permissive licence.
//
//   npx tsx tools/images/deep-search.ts --round 4 [--openverse-max 190] [--limit n] [--only id,id]
//
// tools/images/deep-queries.json:    { "<word id>": { "c": ["title phrase", ...], "o": "openverse phrase", "w": "Wikipedia title" } }
// tools/images/deep-categories.json: { "<word id>": { "cat": ["Commons category", ...], "w": "Wikipedia title" } }
import { existsSync, readFileSync } from 'node:fs';
import {
  commonsCategoryCounts,
  commonsCategoryFiles,
  commonsFiles,
  loadState,
  loadWords,
  measure,
  OUT_DIR,
  pool,
  ROOT,
  saveState,
  searchCommons,
  searchOpenverse,
  wikidataLinks,
  wikipediaArticles,
  type Candidate,
} from './lib.ts';

interface Query {
  c: string[];
  o?: string;
  w?: string;
  cat?: string[];
  anyTitle?: boolean;
}

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const round = Number(opt('--round'));
if (!Number.isInteger(round) || round < 4) {
  console.error('Usage: deep-search.ts --round <4 or more>');
  process.exit(1);
}
let ovBudget = Number(opt('--openverse-max') ?? 190);
const limit = Number(opt('--limit') ?? Infinity);
const only = opt('--only')?.split(',');
const SHOW = 16;

const read = <T>(name: string) => JSON.parse(readFileSync(ROOT + 'tools/images/' + name, 'utf8')) as Record<string, T>;
const base = read<Query>('deep-queries.json');
const extra = read<Partial<Query>>('deep-categories.json');
const queries: Record<string, Query> = {};
for (const id of Object.keys(base)) queries[id] = { ...base[id], ...extra[id], w: base[id].w ?? extra[id]?.w };

const state = loadState();
const todo = loadWords()
  .filter((w) => queries[w.id] && state[w.id] && state[w.id].note !== 'picked' && state[w.id].attempts < round && !existsSync(OUT_DIR + w.image))
  .filter((w) => !only || only.includes(w.id))
  .slice(0, limit);
console.log(`Round ${round}: searching again for ${todo.length} word(s)`);

// 1. Wikipedia articles and Wikidata links, in batches of 50.
const PICTURE = /\.(jpe?g|png|webp)$/i;
const NOT_A_PHOTO = /\b(logo|icon|diagram|map|drawing|illustration|coat of arms|flag|stamp|cartoon|clip ?art|sketch|engraving|painting|poster|chart|scheme|symbol|screenshot|commons-logo|wiktionary|question book|edit-clear|ambox|padlock)\b/i;
const titles = [...new Set(todo.map((w) => queries[w.id].w).filter((t): t is string => !!t))];
const articles = await wikipediaArticles(titles);
const links = await wikidataLinks([...new Set([...articles.values()].map((a) => a.item).filter((x): x is string => !!x))]);
console.log(`Wikipedia: ${articles.size} of ${titles.length} articles found`);

const namesFor = new Map<string, { lead: string[]; article: string[] }>();
const categoriesFor = new Map<string, string[]>();
const allNames = new Set<string>();
const allCats = new Set<string>();
for (const w of todo) {
  const q = queries[w.id];
  const art = q.w ? articles.get(q.w) : undefined;
  const link = art?.item ? links.get(art.item) : undefined;
  const keep = (n: string | undefined) => !!n && PICTURE.test(n) && (q.anyTitle || !NOT_A_PHOTO.test(n));
  const lead = [art?.lead, link?.image].filter((n): n is string => keep(n));
  const article = (art?.images ?? []).filter((n) => keep(n) && !lead.includes(n)).slice(0, 30);
  namesFor.set(w.id, { lead: [...new Set(lead)], article });
  for (const n of [...lead, ...article]) allNames.add(n);
  const cats = [...new Set([...(link?.category ? [link.category] : []), ...(q.cat ?? [])])];
  categoriesFor.set(w.id, cats);
  for (const c of cats) allCats.add(c);
}
const files = await commonsFiles([...allNames]);
const catCounts = await commonsCategoryCounts([...allCats]);
console.log(`Article pictures under an open licence: ${files.size} of ${allNames.size}. Commons categories found: ${catCounts.size} of ${allCats.size}`);

// 2. Per-word searches.
let ovFails = 0;
let found = 0;
let done = 0;

await pool(todo, 4, async (word) => {
  const st = state[word.id];
  const q = queries[word.id];
  const seen = new Set<string>(st.rejected);
  const fresh = (list: Candidate[]) => list.filter((c) => (seen.has(c.fileUrl) ? false : (seen.add(c.fileUrl), true)));
  const named = (names: string[]) => names.map((n) => files.get(n)).filter((c): c is Candidate => !!c).map((c) => ({ ...c }));
  try {
    const names = namesFor.get(word.id)!;
    const lead = fresh(named(names.lead));
    const article = fresh(named(names.article));

    const category: Candidate[] = [];
    const cats = (categoriesFor.get(word.id) ?? []).filter((c) => (catCounts.get(c) ?? 0) > 0);
    for (const c of cats.slice(0, 3)) {
      category.push(...fresh(await commonsCategoryFiles(c, 60, q.anyTitle === true)));
      if (category.filter((x) => x.score > -1.5).length >= 12) break;
    }

    const titled: Candidate[] = [];
    for (const phrase of q.c) {
      if (lead.length + article.length + category.length + titled.length >= 24) break;
      titled.push(...fresh(await searchCommons(`intitle:"${phrase}"`, 40, false, q.anyTitle === true)));
    }

    let openverse: Candidate[] = [];
    if (q.o && ovBudget > 0 && ovFails < 6) {
      ovBudget--;
      try {
        openverse = fresh(await searchOpenverse(q.o, 20, 'cc0,pdm,by,by-sa', false));
        ovFails = 0;
      } catch (err) {
        ovFails++;
        console.warn(`Openverse failed for ${word.id}: ${String(err).slice(0, 70)}${ovFails >= 6 ? ' - not using it again in this run' : ''}`);
      }
    }

    // Lead pictures first, then take turns between the sources. Museum pieces and old photographs go last.
    const modern = (list: Candidate[]) => list.filter((c) => c.score > -1.5);
    const lanes = [modern(category), modern(openverse), modern(article), modern(titled)];
    const short: Candidate[] = [...lead];
    for (let i = 0; short.length < SHOW + 4 && lanes.some((l) => l.length > i); i++) {
      for (const lane of lanes) if (lane[i] && short.length < SHOW + 4) short.push(lane[i]);
    }
    for (const c of [...category, ...openverse, ...article, ...titled]) {
      if (short.length >= SHOW + 4) break;
      if (!short.includes(c)) short.push(c);
    }
    st.candidates = (await measure(short)).slice(0, SHOW);
    st.query = q.c[0];
    st.attempts = round;
    st.note = st.candidates.length > 0 ? 'review' : 'none';
    if (st.candidates.length > 0) found++;
  } catch (err) {
    console.warn(`Search failed for ${word.id}: ${String(err).slice(0, 100)}`);
  }
  if (++done % 10 === 0) {
    saveState(state);
    console.log(`${done}/${todo.length} searched, ${found} with candidates`);
  }
});
saveState(state);
console.log(`Finished: ${found} of ${todo.length} have candidates to review.`);
