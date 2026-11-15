// Shared code for the build-time image pipeline: searching openly licensed sources,
// ranking candidates, processing to 512x512 WebP and keeping a licence record.
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Word } from '../../src/content/types.ts';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const WORDS_DIR = ROOT + 'src/content/words/';
export const OUT_DIR = ROOT + 'public/images/';
export const CACHE_DIR = ROOT + 'tools/images/cache/';
export const RAW_DIR = ROOT + 'tools/images/raw/';
export const SHEETS_DIR = ROOT + 'tools/images/sheets/';
export const STATE_FILE = ROOT + 'tools/images/state.json';

// A descriptive client name with no personal details.
export const USER_AGENT = 'SMRTSpeechImageBuild/1.0 (open-licence image sourcing for a non-commercial-data therapy app build)';

export const MAX_ATTEMPTS = 3;
export const TARGET_BYTES = 60 * 1024;

for (const d of [OUT_DIR, CACHE_DIR, RAW_DIR, SHEETS_DIR]) mkdirSync(d, { recursive: true });

export type LicenceKind = 'cc0' | 'pd' | 'by' | 'by-sa';

export interface Candidate {
  provider: 'wikimedia-commons' | 'openverse';
  title: string;
  /** Page describing the image and its licence. */
  sourceUrl: string;
  /** Direct file URL to download for processing. */
  fileUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  author: string;
  licence: string;
  licenceKind: LicenceKind;
  licenceUrl: string;
  score: number;
  plain: number;
  /** Position in the provider's own relevance order (0 is best, then negative). */
  rel: number;
}

export interface WordState {
  query: string;
  candidates: Candidate[];
  rejected: string[];
  chosen: string | null;
  attempts: number;
  status: 'ok' | 'todo' | 'pending';
  retrieved?: string;
  trimmed?: boolean;
  bytes?: number;
  note?: string;
}

export type State = Record<string, WordState>;

export function loadState(): State {
  return existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as State) : {};
}

export function saveState(state: State) {
  const sorted = Object.fromEntries(Object.keys(state).sort().map((k) => [k, state[k]]));
  writeFileSync(STATE_FILE, JSON.stringify(sorted, null, 1) + '\n');
}

export function loadWords(): Word[] {
  return readdirSync(WORDS_DIR)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(WORDS_DIR + f, 'utf8')) as Word[]);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function cacheKey(url: string): string {
  return createHash('sha1').update(url).digest('hex');
}

// Minimum gap between requests to each host, so the build stays a polite client.
const SPACING_MS: Record<string, number> = {
  // Wikimedia allows clients that send no contact details 10 API requests a minute.
  'commons.wikimedia.org': 6600,
  'en.wikipedia.org': 6600,
  'www.wikidata.org': 6600,
  'upload.wikimedia.org': 400,
  // Resized pictures are served from their own host, which throttles bursts.
  'thumb.wikimedia.org': 600,
  'api.openverse.org': 3500,
};
const gates = new Map<string, Promise<void>>();

async function gate(url: string): Promise<void> {
  const host = new URL(url).host;
  const ms = SPACING_MS[host];
  if (!ms) return;
  const prev = gates.get(host) ?? Promise.resolve();
  gates.set(
    host,
    prev.then(() => sleep(ms)),
  );
  await prev;
}

/**
 * Search APIs are worth waiting for (their limits are counted per minute). A single picture
 * file is not: if one will not download after a short retry, the caller moves on to another.
 */
async function fetchRetry(url: string, patient: boolean): Promise<Response> {
  const tries = patient ? 6 : 2;
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      await gate(url);
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, signal: AbortSignal.timeout(40_000) });
      if (res.status === 429 || res.status >= 500) {
        const wait = patient ? Math.max(Number(res.headers.get('retry-after')) || 0, 65 + i * 30) : 12;
        console.warn(`HTTP ${res.status} from ${new URL(url).host}; waiting ${wait}s (attempt ${i + 1} of ${tries})`);
        lastErr = `HTTP ${res.status}`;
        await sleep(Math.min(120, wait) * 1000);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      await sleep(patient ? 2 ** i * 1000 : 2000);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${String(lastErr ?? 'too many retries')}`);
}

export async function fetchJson<T>(url: string, useCache = true, patient = true): Promise<T> {
  const file = CACHE_DIR + cacheKey(url) + '.json';
  if (useCache && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as T;
  const res = await fetchRetry(url, patient);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const data = (await res.json()) as T;
  writeFileSync(file, JSON.stringify(data));
  return data;
}

export async function fetchBinary(url: string, dir = CACHE_DIR): Promise<Buffer | null> {
  const file = dir + cacheKey(url) + '.bin';
  if (existsSync(file)) return readFileSync(file);
  let res: Response;
  try {
    res = await fetchRetry(url, false);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, buf);
  return buf;
}

/**
 * Downloads a candidate for processing. Wikimedia limits freshly resized pictures, so if the
 * resized version is refused, the original upload (a static file) is fetched instead.
 */
export async function fetchCandidateFile(c: Candidate): Promise<Buffer | null> {
  const urls: string[] = [];
  if (c.provider === 'wikimedia-commons' && c.thumbUrl.includes('/330px-')) {
    // Wikimedia serves its standard resized widths freely but refuses bulk requests for
    // original uploads, so work down the standard sizes that fit this picture.
    for (const size of [960, 500]) if (c.width >= size) urls.push(c.thumbUrl.replace('/330px-', `/${size}px-`));
    urls.push(c.thumbUrl);
  } else {
    urls.push(c.fileUrl);
  }
  for (const url of urls) {
    const buf = await fetchBinary(url, RAW_DIR);
    if (buf) return buf;
  }
  return null;
}

/** Credit the author by name; do not keep or republish an email address found in a source's metadata. */
export function cleanAuthor(author: string): string {
  return author
    .replace(/,?\s*e?-?mail:\s*\S+(\s+(at|\(at\))\s+[^\s\]]+)?/gi, '')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '')
    .replace(/\s+\]/g, ']')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Accept only CC0, public domain and CC BY. CC BY-SA is a flagged last resort. Never NC or ND. */
export function classifyLicence(short: string): LicenceKind | null {
  const s = short.trim().toLowerCase().replace(/[_]/g, ' ');
  if (!s) return null;
  if (/\bnc\b|\bnd\b|non-?commercial|no ?deriv/.test(s)) return null;
  if (/^cc0|cc zero/.test(s)) return 'cc0';
  if (/^public domain|^pd\b|^pdm\b|no restrictions/.test(s)) return 'pd';
  if (/^cc[ -]by[ -]sa/.test(s)) return 'by-sa';
  if (/^cc[ -]by([ -]\d|$)/.test(s)) return 'by';
  return null;
}

const BAD_TITLE = /\b(logo|icon|diagram|map|drawing|illustration|coat of arms|flag|stamp|sign(age)?|cartoon|clip ?art|sketch|engraving|painting|poster|chart|svg|scheme|symbol|plan|screenshot|text|label|advert)\b/i;

interface CommonsPage {
  title: string;
  index: number;
  imageinfo?: {
    url: string;
    descriptionurl: string;
    thumburl?: string;
    width: number;
    height: number;
    mime: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
}

/** Structured-data filter for files licensed CC0 or CC BY (2.0, 2.5, 3.0, 4.0). */
export const PERMISSIVE = 'haswbstatement:P275=Q6938433|P275=Q20007257|P275=Q14947546|P275=Q19125117|P275=Q18810333';

// Museum objects, prints and old photographs make poor naming pictures.
const OLD_OR_MUSEUM =
  /\b(MET|LACMA|NARA|LOC|AM)\b|\b(museum|rijksmuseum|wellcome|smithsonian|century|dynasty|print|engraving|etching|lithograph|album|archives?|collectie|tropenmuseum|bundesarchiv|nationaal|18\d\d|19[0-8]\d)\b|\d+\.\d+\.\d+|\(\w{2}\d{4,}\)/;

/** Turns one Commons file page into a candidate, or null if its type, size, title or licence rules it out. */
export function commonsCandidate(p: CommonsPage, keepAnyTitle = false): Candidate | null {
  const info = p.imageinfo?.[0];
  if (!info || !info.thumburl) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(info.mime)) return null;
  if (Math.min(info.width, info.height) < 450) return null;
  if (!keepAnyTitle && BAD_TITLE.test(p.title)) return null;
  const meta = info.extmetadata ?? {};
  const licence = stripHtml(meta.LicenseShortName?.value ?? '');
  const kind = classifyLicence(licence);
  if (!kind) return null;
  const author = stripHtml(meta.Artist?.value ?? '') || stripHtml(meta.Credit?.value ?? '') || 'Unknown author';
  const fileUrl = info.width > 1100 ? info.thumburl.replace(/\/330px-/, '/960px-') : info.url;
  return {
    provider: 'wikimedia-commons',
    title: p.title.replace(/^File:/, ''),
    sourceUrl: info.descriptionurl,
    fileUrl,
    thumbUrl: info.thumburl,
    width: info.width,
    height: info.height,
    author: cleanAuthor(author).slice(0, 200),
    licence,
    licenceKind: kind,
    licenceUrl:
      meta.LicenseUrl?.value ||
      (kind === 'cc0' ? 'https://creativecommons.org/publicdomain/zero/1.0/' : 'https://creativecommons.org/publicdomain/mark/1.0/'),
    score: OLD_OR_MUSEUM.test(p.title) ? -2 : 0,
    plain: 0,
    rel: 0,
  };
}

const IMAGEINFO = {
  prop: 'imageinfo',
  iiprop: 'url|size|mime|extmetadata',
  iiurlwidth: '330',
  iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit|Restrictions',
};

export async function searchCommons(query: string, limit = 20, permissiveOnly = false, keepAnyTitle = false): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${query} filetype:bitmap${permissiveOnly ? ' ' + PERMISSIVE : ''}`,
    gsrlimit: String(limit),
    ...IMAGEINFO,
  });
  const data = await fetchJson<{ query?: { pages?: Record<string, CommonsPage> } }>(
    'https://commons.wikimedia.org/w/api.php?' + params.toString(),
  );
  const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const out: Candidate[] = [];
  for (const p of pages) {
    const c = commonsCandidate(p, keepAnyTitle);
    if (!c) continue;
    c.score += -out.length * 0.06;
    c.rel = -out.length;
    out.push(c);
  }
  return out;
}

/** Licence and file details for named Commons files, 50 to a request. Keys are file names without "File:". */
export async function commonsFiles(names: string[]): Promise<Map<string, Candidate>> {
  const out = new Map<string, Candidate>();
  for (let i = 0; i < names.length; i += 50) {
    const titles = names.slice(i, i + 50).map((n) => 'File:' + n).join('|');
    const params = new URLSearchParams({ action: 'query', format: 'json', titles, ...IMAGEINFO });
    const data = await fetchJson<{ query?: { pages?: Record<string, CommonsPage>; normalized?: { from: string; to: string }[] } }>(
      'https://commons.wikimedia.org/w/api.php?' + params.toString(),
    );
    const back = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(data.query?.pages ?? {})) {
      const c = commonsCandidate(p, true);
      if (c) out.set((back.get(p.title) ?? p.title).replace(/^File:/, '').replace(/_/g, ' '), c);
    }
  }
  return out;
}

/** Files placed directly in a Commons category (not its sub-categories), in the category's own order. */
export async function commonsCategoryFiles(category: string, limit = 60, keepAnyTitle = false): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'categorymembers',
    gcmtitle: 'Category:' + category,
    gcmtype: 'file',
    gcmlimit: String(limit),
    ...IMAGEINFO,
  });
  const data = await fetchJson<{ query?: { pages?: Record<string, CommonsPage> } }>('https://commons.wikimedia.org/w/api.php?' + params.toString());
  const out: Candidate[] = [];
  for (const p of Object.values(data.query?.pages ?? {}).sort((a, b) => a.title.localeCompare(b.title))) {
    const c = commonsCandidate(p, keepAnyTitle);
    if (!c) continue;
    c.rel = -out.length;
    out.push(c);
  }
  return out;
}

/** How many files sit directly in each named Commons category (missing categories are left out). */
export async function commonsCategoryCounts(categories: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < categories.length; i += 50) {
    const batch = categories.slice(i, i + 50);
    const params = new URLSearchParams({ action: 'query', format: 'json', prop: 'categoryinfo', titles: batch.map((c) => 'Category:' + c).join('|') });
    const data = await fetchJson<{
      query?: { pages?: Record<string, { title: string; missing?: string; categoryinfo?: { files: number } }>; normalized?: { from: string; to: string }[] };
    }>('https://commons.wikimedia.org/w/api.php?' + params.toString());
    const back = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(data.query?.pages ?? {})) {
      if (p.missing !== undefined || !p.categoryinfo) continue;
      out.set((back.get(p.title) ?? p.title).replace(/^Category:/, ''), p.categoryinfo.files);
    }
  }
  return out;
}

export interface ArticleInfo {
  /** Lead picture: usually a clear, typical example of the thing. */
  lead?: string;
  /** Wikidata item for the article's subject. */
  item?: string;
  /** Other pictures used in the article. */
  images: string[];
}

type WikiHops = { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] };

function resolver(q: WikiHops | undefined): (title: string) => string {
  const hop = new Map<string, string>();
  for (const n of [...(q?.normalized ?? []), ...(q?.redirects ?? [])]) hop.set(n.from, n.to);
  return (title) => {
    let end = title;
    for (let k = 0; k < 3 && hop.has(end); k++) end = hop.get(end)!;
    return end;
  };
}

/** Lead picture, Wikidata item and in-article pictures for English Wikipedia articles, 50 titles a request. */
export async function wikipediaArticles(titles: string[]): Promise<Map<string, ArticleInfo>> {
  const out = new Map<string, ArticleInfo>();
  const api = 'https://en.wikipedia.org/w/api.php?';
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const base = { action: 'query', format: 'json', redirects: '1', titles: batch.join('|') };
    const head = await fetchJson<{
      query?: WikiHops & { pages?: Record<string, { title: string; pageimage?: string; pageprops?: { wikibase_item?: string } }> };
    }>(api + new URLSearchParams({ ...base, prop: 'pageimages|pageprops', piprop: 'name', pilicense: 'any', pilimit: '50', ppprop: 'wikibase_item' }).toString());
    const end = resolver(head.query);
    const byTitle = new Map<string, ArticleInfo>();
    for (const p of Object.values(head.query?.pages ?? {})) {
      byTitle.set(p.title, { lead: p.pageimage?.replace(/_/g, ' '), item: p.pageprops?.wikibase_item, images: [] });
    }
    let cont: Record<string, string> = {};
    for (let page = 0; page < 12; page++) {
      const more = await fetchJson<{
        continue?: Record<string, string>;
        query?: { pages?: Record<string, { title: string; images?: { title: string }[] }> };
      }>(api + new URLSearchParams({ ...base, prop: 'images', imlimit: '500', ...cont }).toString());
      for (const p of Object.values(more.query?.pages ?? {})) {
        const info = byTitle.get(p.title);
        if (info) for (const im of p.images ?? []) info.images.push(im.title.replace(/^File:/, ''));
      }
      if (!more.continue) break;
      cont = more.continue;
    }
    for (const t of batch) {
      const info = byTitle.get(end(t));
      if (info) out.set(t, info);
    }
  }
  return out;
}

/** The Commons category (P373) and main picture (P18) recorded for Wikidata items. */
export async function wikidataLinks(ids: string[]): Promise<Map<string, { category?: string; image?: string }>> {
  const out = new Map<string, { category?: string; image?: string }>();
  type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'claims', ids: ids.slice(i, i + 50).join('|') });
    const data = await fetchJson<{ entities?: Record<string, { claims?: Record<string, Claim[]> }> }>('https://www.wikidata.org/w/api.php?' + params.toString());
    for (const [id, e] of Object.entries(data.entities ?? {})) {
      const first = (prop: string) => {
        const v = e.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
        return typeof v === 'string' ? v.replace(/_/g, ' ') : undefined;
      };
      out.set(id, { category: first('P373'), image: first('P18') });
    }
  }
  return out;
}

interface OpenverseResult {
  title: string | null;
  foreign_landing_url: string;
  url: string;
  thumbnail: string;
  creator: string | null;
  license: string;
  license_version: string | null;
  license_url: string;
  width: number | null;
  height: number | null;
}

/** Openverse allows anonymous clients 20 requests a minute and 200 a day: use sparingly. */
export async function searchOpenverse(query: string, limit = 20, licences = 'cc0,pdm,by', patient = true, skipWikimedia = false, cachedOnly = false): Promise<Candidate[]> {
  const params = new URLSearchParams({ q: query, license: licences, page_size: String(limit), mature: 'false' });
  // Wikimedia Commons is searched directly, so its copies in Openverse only repeat those results.
  if (skipWikimedia) params.set('excluded_source', 'wikimedia');
  const url = 'https://api.openverse.org/v1/images/?' + params.toString();
  // cachedOnly reuses an earlier answer and never spends the day's request allowance.
  if (cachedOnly && !existsSync(CACHE_DIR + cacheKey(url) + '.json')) return [];
  const data = await fetchJson<{ results?: OpenverseResult[] }>(url, true, patient);
  const out: Candidate[] = [];
  for (const r of data.results ?? []) {
    const kind: LicenceKind | null =
      r.license === 'cc0' ? 'cc0' : r.license === 'pdm' ? 'pd' : r.license === 'by' ? 'by' : r.license === 'by-sa' ? 'by-sa' : null;
    if (!kind) continue;
    if (r.width && r.height && Math.min(r.width, r.height) < 450) continue;
    if (BAD_TITLE.test(r.title ?? '')) continue;
    const name =
      kind === 'cc0' ? 'CC0 1.0' : kind === 'pd' ? 'Public Domain Mark 1.0' : `CC BY${kind === 'by-sa' ? '-SA' : ''} ${r.license_version ?? ''}`.trim();
    out.push({
      provider: 'openverse',
      title: r.title ?? 'Untitled',
      sourceUrl: r.foreign_landing_url,
      fileUrl: r.url,
      thumbUrl: r.url.includes('staticflickr.com') && r.url.endsWith('_b.jpg') ? r.url.slice(0, -6) + '_n.jpg' : r.url,
      width: r.width ?? 0,
      height: r.height ?? 0,
      author: cleanAuthor(r.creator ?? 'Unknown author').slice(0, 200),
      licence: name,
      licenceKind: kind,
      licenceUrl: r.license_url,
      score: -out.length * 0.06,
      plain: 0,
      rel: -out.length,
    });
  }
  return out;
}

/** How plain and light the border of an image is, from 0 to 1. */
export async function plainness(buf: Buffer): Promise<number> {
  const size = 64;
  const ring = 5;
  const { data } = await sharp(buf).flatten({ background: '#ffffff' }).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let white = 0;
  let light = 0;
  let n = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x >= ring && x < size - ring && y >= ring && y < size - ring) continue;
      const i = (y * size + x) * 3;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const min = Math.min(r, g, b);
      const max = Math.max(r, g, b);
      n++;
      if (min > 218 && max - min < 26) white++;
      else if (min > 175 && max - min < 34) light++;
    }
  }
  return (white + light * 0.5) / n;
}

const LICENCE_BONUS: Record<LicenceKind, number> = { cc0: 0.5, pd: 0.5, by: 0.3, 'by-sa': -3 };

/** Ranks on metadata alone (relevance, licence, shape, title), with no downloads. */
export function rank(cands: Candidate[], query: string): Candidate[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  for (const c of cands) {
    const ratio = c.width && c.height ? Math.max(c.width, c.height) / Math.min(c.width, c.height) : 1.3;
    const title = c.title.toLowerCase();
    c.score =
      Math.round(
        (c.score +
          LICENCE_BONUS[c.licenceKind] +
          (ratio > 2 ? -1.5 : ratio > 1.6 ? -0.5 : 0) +
          (words.some((w) => title.includes(w)) ? 0.5 : 0) +
          (/white background|isolated|studio/.test(title) ? 0.6 : 0)) *
          100,
      ) / 100;
  }
  const seen = new Set<string>();
  return cands
    .slice()
    .sort((a, b) => b.score - a.score)
    .filter((c) => (seen.has(c.fileUrl) ? false : (seen.add(c.fileUrl), true)));
}

/** Downloads thumbnails for a shortlist and measures how plain each background is. */
export async function measure(cands: Candidate[]): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const c of cands) {
    try {
      const thumb = await fetchBinary(c.thumbUrl);
      if (!thumb) continue;
      c.plain = Math.round((await plainness(thumb)) * 100) / 100;
      out.push(c);
    } catch {
      /* drop a candidate whose thumbnail cannot be read */
    }
  }
  return out;
}

/**
 * A shortlist for visual review: the best by overall score, topped up with the most
 * relevant results that the plain-background preference would otherwise push out.
 */
export function shortlist(ranked: Candidate[], size = 8): Candidate[] {
  const ok = ranked.filter((c) => c.licenceKind !== 'by-sa');
  const top = ok.slice(0, Math.ceil(size / 2));
  const rest = ok
    .filter((c) => !top.includes(c) && c.score > -1.5)
    .sort((a, b) => b.rel - a.rel)
    .slice(0, size - top.length);
  const out = [...top, ...rest];
  // CC BY-SA only fills gaps, as a flagged last resort.
  for (const c of ranked) if (out.length < size && c.licenceKind === 'by-sa') out.push(c);
  return out;
}

export async function pool<T>(items: readonly T[], size: number, fn: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await fn(items[i], i);
      }
    }),
  );
}

export interface Processed {
  bytes: number;
  trimmed: boolean;
}

/** 512x512 WebP, the whole subject fitted (never cropped) on white, about quality 78, 60 KB or less. */
export async function processImage(input: Buffer, outFile: string, plain: number): Promise<Processed> {
  let base = sharp(input, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' });
  let trimmed = false;
  if (plain >= 0.7) {
    try {
      const t = await base.clone().trim({ background: '#ffffff', threshold: 14 }).toBuffer({ resolveWithObject: true });
      if (t.info.width >= 120 && t.info.height >= 120) {
        base = sharp(t.data);
        trimmed = true;
      }
    } catch {
      /* keep the untrimmed image */
    }
  }
  const inner = trimmed ? 472 : 512;
  const pad = (512 - inner) / 2;
  const square = await base
    .resize(inner, inner, { fit: 'contain', background: '#ffffff' })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' })
    .png()
    .toBuffer();
  let out = Buffer.alloc(0);
  for (const quality of [78, 70, 62, 54, 46, 38]) {
    out = await sharp(square).webp({ quality, effort: 5 }).toBuffer();
    if (out.length <= TARGET_BYTES) break;
  }
  writeFileSync(outFile, out);
  return { bytes: out.length, trimmed };
}

/** Picks the best candidate not yet rejected and writes the processed picture. */
export async function chooseAndProcess(word: Word, st: WordState): Promise<boolean> {
  const usable = (allowSa: boolean) =>
    st.candidates.filter((c) => !st.rejected.includes(c.fileUrl) && (allowSa || c.licenceKind !== 'by-sa'));
  for (const c of [...usable(false), ...usable(true).filter((x) => x.licenceKind === 'by-sa')]) {
    try {
      const buf = await fetchCandidateFile(c);
      if (!buf) throw new Error('download failed');
      const res = await processImage(buf, OUT_DIR + word.image, c.plain);
      st.chosen = c.fileUrl;
      st.status = 'ok';
      st.trimmed = res.trimmed;
      st.bytes = res.bytes;
      st.retrieved = new Date().toISOString().slice(0, 10);
      return true;
    } catch {
      st.rejected.push(c.fileUrl);
    }
  }
  st.chosen = null;
  st.status = 'todo';
  return false;
}

export function chosenCandidate(st: WordState): Candidate | null {
  return st.candidates.find((c) => c.fileUrl === st.chosen) ?? null;
}
