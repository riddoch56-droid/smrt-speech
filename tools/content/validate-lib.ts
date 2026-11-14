// Pure content validation for SMRT Speech. No file system access: validate.ts loads the files
// and hands them in, and the unit tests pass small synthetic fixtures.
import { GROUP_TARGET_COUNTS, type ImageCredit, type ReadingItem, type Screener, type Word } from '../../src/content/types.ts';

export const EXPECTED_TOTAL_WORDS = 700;
export const EXPECTED_SCREENER_ITEMS = 30;
export const MIN_READING_PER_KIND = 200;
export const IMAGE_WARN_BYTES = 60 * 1024;
export const IMAGE_ERROR_BYTES = 80 * 1024;
export const IMAGE_TOTAL_LIMIT_BYTES = 60 * 1024 * 1024;

export interface ValidateInput {
  words: Word[];
  readingItems: ReadingItem[];
  screener: Screener;
  credits: ImageCredit[];
  /** Image file name to size in bytes. */
  imageFiles: Map<string, number>;
}

export interface ValidateOptions {
  /** Require the minimum amount of reading content (default true). */
  requireReading?: boolean;
  /**
   * Downgrade work that is legitimately unfinished mid-build to warnings: an empty screener, too
   * little reading content, and words with no image file or credits entry.
   */
  allowIncomplete?: boolean;
  /** Override the expected counts (used by the unit tests). Defaults to the real 700-word brief. */
  expected?: {
    total: number;
    perGroup?: Record<string, number>;
    /** Number of naming screener items (default 30). */
    screener?: number;
    /** Minimum phrase items and minimum sentence items (default 200 each). */
    minReading?: number;
  };
}

export interface ValidateResult {
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
}

const WORD_CLASSES = ['noun', 'verb', 'adjective'];
const CREDIT_SOURCES = ['openverse', 'wikimedia-commons', 'generated', 'project'];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The word, each part of a multi-word target (3+ letters) and simple inflections of them.
 * Mirrors forms() in tools/content/check-authored.mjs so both checkers agree.
 */
export function wordForms(word: string): string[] {
  const parts = word.split(/[\s-]+/).filter((p) => p.length >= 3);
  const all = new Set([word, ...parts]);
  const out = new Set<string>();
  for (const w of all) {
    out.add(w);
    for (const suf of ['s', 'es', 'ed', 'd', 'ing', 'er']) out.add(w + suf);
    if (w.endsWith('e')) {
      out.add(w.slice(0, -1) + 'ing');
      out.add(w + 'r');
    }
    if (w.endsWith('y')) {
      out.add(w.slice(0, -1) + 'ies');
      out.add(w.slice(0, -1) + 'ied');
    }
    const last = w[w.length - 1];
    for (const suf of ['ing', 'ed', 'er']) out.add(w + last + suf);
  }
  return [...out];
}

/** True when `text` contains the target word, a component of it, or a simple inflection. */
export function containsTarget(text: string, word: string): boolean {
  if (!word.trim()) return false;
  const re = new RegExp(`\\b(${wordForms(word.toLowerCase()).map(esc).join('|')})\\b`, 'i');
  return re.test(text);
}

/** True when the text holds exactly one blank, written as three underscores. */
export function hasSingleBlank(text: string): boolean {
  const runs = text.match(/_+/g) ?? [];
  return runs.length === 1 && runs[0] === '___';
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function describeList(items: string[], max = 6): string {
  const shown = items.slice(0, max).join(', ');
  return items.length > max ? `${shown} and ${items.length - max} more` : shown;
}

export function validateContent(input: ValidateInput, opts: ValidateOptions = {}): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, number> = {};
  const requireReading = opts.requireReading ?? true;
  const lenient = opts.allowIncomplete === true;
  const expectedTotal = opts.expected?.total ?? EXPECTED_TOTAL_WORDS;
  const expectedPerGroup: Record<string, number> | undefined = opts.expected ? opts.expected.perGroup : GROUP_TARGET_COUNTS;
  const expectedScreener = opts.expected?.screener ?? EXPECTED_SCREENER_ITEMS;
  const minReading = opts.expected?.minReading ?? MIN_READING_PER_KIND;
  const { words, readingItems, screener, credits, imageFiles } = input;

  // Problems that are errors normally but only warnings while content is still being built.
  const unfinished: Record<string, string[]> = {};
  const defer = (key: string, message: string) => {
    (unfinished[key] ??= []).push(message);
  };

  // ---- Word counts -------------------------------------------------------------------------
  stats.words = words.length;
  if (words.length !== expectedTotal) errors.push(`Expected exactly ${expectedTotal} words, found ${words.length}`);

  const perGroup: Record<string, number> = {};
  for (const w of words) perGroup[String(w.group)] = (perGroup[String(w.group)] ?? 0) + 1;
  for (const [g, n] of Object.entries(perGroup)) stats[`group:${g}`] = n;
  if (expectedPerGroup) {
    for (const [g, want] of Object.entries(expectedPerGroup)) {
      const have = perGroup[g] ?? 0;
      if (have !== want) errors.push(`Group "${g}" has ${have} words, expected ${want}`);
    }
    for (const g of Object.keys(perGroup)) if (!(g in expectedPerGroup)) errors.push(`Unknown group "${g}" (${perGroup[g]} words)`);
  }

  // ---- Per-word checks ---------------------------------------------------------------------
  const ids = new Set<string>();
  const spellings = new Set<string>();
  const usedImages = new Set<string>();
  const creditByImage = new Map<string, ImageCredit>();
  for (const c of credits) if (c && isStr(c.image) && !creditByImage.has(c.image)) creditByImage.set(c.image, c);
  let multiWord = 0;
  let noPicture = 0;
  const noPictureWords: string[] = [];

  for (const w of words) {
    const tag = isStr(w?.id) ? w.id : `word "${String(w?.word)}"`;
    const err = (m: string) => errors.push(`${tag}: ${m}`);
    if (!w || typeof w !== 'object') {
      errors.push(`${tag}: not an object`);
      continue;
    }

    if (isStr(w.id)) {
      if (ids.has(w.id)) err('duplicate id');
      ids.add(w.id);
    } else err('missing id');

    if (isStr(w.word)) {
      const key = w.word.trim().toLowerCase();
      if (spellings.has(key)) err(`duplicate word "${w.word}"`);
      spellings.add(key);
    } else err('missing word');

    for (const k of ['group', 'subgroup', 'image', 'imagePrompt'] as const) if (!isStr(w[k])) err(`missing ${k}`);
    if (!WORD_CLASSES.includes(w.wordClass)) err(`wordClass must be one of ${WORD_CLASSES.join(', ')}`);
    if (!isNum(w.letters)) err('letters must be a number');
    if (!isNum(w.syllables) || !Number.isInteger(w.syllables) || w.syllables < 1) err('syllables must be a whole number of at least 1');
    if (![1, 2, 3].includes(w.frequencyBand)) err('frequencyBand must be 1, 2 or 3');
    if (typeof w.multiWord !== 'boolean') err('multiWord must be true or false');
    if (typeof w.childFriendly !== 'boolean') err('childFriendly must be true or false');
    if (w.hasImage !== undefined && typeof w.hasImage !== 'boolean') err('hasImage must be true or false when present');

    const c = (w.cues ?? {}) as Partial<Word['cues']>;
    const s = (w.semantic ?? {}) as Partial<Word['semantic']>;
    const p = (w.phonological ?? {}) as Partial<Word['phonological']>;
    if (!w.cues) err('missing cues');
    if (!w.semantic) err('missing semantic');
    if (!w.phonological) err('missing phonological');

    for (const k of ['definition', 'sentenceCompletion', 'firstLetter', 'firstSoundSpoken'] as const) if (!isStr(c[k])) err(`missing cues.${k}`);
    if (isNum(w.syllables) && w.syllables >= 2 && !isStr(c.firstSyllable)) err('missing cues.firstSyllable (needed for 2+ syllables)');
    if (c.firstSyllable !== undefined && !isStr(c.firstSyllable)) err('cues.firstSyllable must be a non-empty string when present');
    for (const k of ['category', 'use', 'action', 'properties', 'location', 'association'] as const) if (!isStr(s[k])) err(`missing semantic.${k}`);
    for (const k of ['firstSound', 'lastSound', 'sameFirstSound'] as const) if (!isStr(p[k])) err(`missing phonological.${k}`);
    if (!isNum(p.syllables)) err('phonological.syllables must be a number');
    if (!(p.rhyme === null || isStr(p.rhyme))) err('phonological.rhyme must be a non-empty string or null');

    if (isStr(w.word)) {
      const letters = w.word.replace(/[\s-]/g, '').length;
      if (isNum(w.letters) && w.letters !== letters) err(`letters is ${w.letters} but "${w.word}" has ${letters}`);
      const hasSpace = /\s/.test(w.word);
      if (typeof w.multiWord === 'boolean' && w.multiWord !== hasSpace) err(`multiWord is ${w.multiWord} but "${w.word}" ${hasSpace ? 'contains' : 'has no'} space`);
      if (isStr(c.firstLetter) && c.firstLetter !== w.word[0]) err(`cues.firstLetter "${c.firstLetter}" does not match "${w.word}"`);
    }
    if (isNum(p.syllables) && isNum(w.syllables) && p.syllables !== w.syllables) {
      err(`phonological.syllables (${p.syllables}) differs from syllables (${w.syllables})`);
    }
    if (isStr(c.sentenceCompletion) && !hasSingleBlank(c.sentenceCompletion)) err('cues.sentenceCompletion needs exactly one ___ (three underscores)');

    if (w.multiWord === true) multiWord++;

    // No cue or prompt text may give the answer away.
    if (isStr(w.word)) {
      const texts: [string, unknown][] = [
        ['cues.definition', c.definition],
        ['cues.sentenceCompletion', c.sentenceCompletion],
        ...(['category', 'use', 'action', 'properties', 'location', 'association'] as const).map((k): [string, unknown] => [`semantic.${k}`, s[k]]),
        ['phonological.rhyme', p.rhyme],
        ['phonological.sameFirstSound', p.sameFirstSound],
      ];
      for (const [field, text] of texts) {
        if (isStr(text) && containsTarget(text, w.word)) err(`${field} contains the target word: "${text}"`);
      }
    }

    // Pictures.
    if (w.hasImage === false) {
      noPicture++;
      noPictureWords.push(isStr(w.id) ? w.id : String(w.word));
    } else if (isStr(w.image)) {
      usedImages.add(w.image);
      if (!imageFiles.has(w.image)) defer('image', `${tag}: no image file "${w.image}"`);
      if (!creditByImage.has(w.image)) defer('credit', `${tag}: no credits entry for "${w.image}"`);
    }
  }

  stats.multiWord = multiWord;
  stats.wordsWithoutPicture = noPicture;
  if (noPicture > 0) {
    warnings.push(`${noPicture} word${noPicture === 1 ? '' : 's'} flagged hasImage: false (excluded from picture activities): ${describeList(noPictureWords)}`);
  }

  // ---- Image files -------------------------------------------------------------------------
  let totalBytes = 0;
  let overWarn = 0;
  for (const [name, bytes] of imageFiles) {
    totalBytes += bytes;
    if (bytes > IMAGE_ERROR_BYTES) errors.push(`Image ${name} is ${(bytes / 1024).toFixed(1)} KB, over the ${IMAGE_ERROR_BYTES / 1024} KB limit`);
    else if (bytes > IMAGE_WARN_BYTES) {
      overWarn++;
      warnings.push(`Image ${name} is ${(bytes / 1024).toFixed(1)} KB, over the ${IMAGE_WARN_BYTES / 1024} KB target`);
    }
  }
  stats.imageFiles = imageFiles.size;
  stats.imageBytes = totalBytes;
  stats.imagesOverTarget = overWarn;
  if (totalBytes >= IMAGE_TOTAL_LIMIT_BYTES) {
    errors.push(`Images total ${(totalBytes / 1048576).toFixed(1)} MB, which must stay under ${IMAGE_TOTAL_LIMIT_BYTES / 1048576} MB`);
  }

  // ---- Credits -----------------------------------------------------------------------------
  stats.credits = credits.length;
  const seenCredit = new Set<string>();
  let shareAlike = 0;
  for (const c of credits) {
    const tag = `credits ${isStr(c?.image) ? c.image : '(no image)'}`;
    const err = (m: string) => errors.push(`${tag}: ${m}`);
    if (!c || typeof c !== 'object') {
      errors.push(`${tag}: not an object`);
      continue;
    }
    if (!isStr(c.image)) err('missing image');
    else {
      if (seenCredit.has(c.image)) err('duplicate credits entry');
      seenCredit.add(c.image);
      if (!imageFiles.has(c.image) && !lenient) warnings.push(`${tag}: no matching image file`);
    }
    if (!isStr(c.source)) err('missing source');
    else if (!CREDIT_SOURCES.includes(c.source)) err(`unknown source "${c.source}"`);
    // Pictures made for the app (generated, or drawn by a build script) have no web page or
    // licence page to point to; they need a description of how they were made instead.
    const ownWork = c.source === 'generated' || c.source === 'project';
    if (ownWork) {
      if (!isStr(c.prompt)) err('a picture made for the app needs the prompt or description that made it');
    } else if (!isStr(c.sourceUrl)) err('missing sourceUrl');
    const required = ownWork ? (['author', 'licence', 'retrieved', 'modifications'] as const) : (['author', 'licence', 'licenceUrl', 'retrieved', 'modifications'] as const);
    for (const k of required) if (!isStr(c[k])) err(`missing ${k}`);
    if (isStr(c.licence)) {
      if (/(^|[^a-z])(nc|nd)([^a-z]|$)/i.test(c.licence) || /non-?commercial|no-?deriv/i.test(c.licence)) {
        err(`licence "${c.licence}" is not allowed (no NC or ND licences)`);
      } else if (/(^|[^a-z])sa([^a-z]|$)/i.test(c.licence) || /share-?alike/i.test(c.licence)) {
        shareAlike++;
        warnings.push(`${tag}: licence "${c.licence}" is share-alike; use only as a last resort`);
      }
    }
  }
  stats.shareAlikeImages = shareAlike;

  // ---- Naming screener ---------------------------------------------------------------------
  const items = Array.isArray(screener?.items) ? screener.items : [];
  stats.screenerItems = items.length;
  if (!screener || !isNum(screener.version)) errors.push('screener: version must be a number');
  if (screener && !isStr(screener.frozen)) errors.push('screener: frozen date is missing');
  if (items.length !== expectedScreener) {
    const m = `screener: expected exactly ${expectedScreener} items, found ${items.length}`;
    if (lenient && items.length === 0) warnings.push(m);
    else errors.push(m);
  }
  const byId = new Map(words.filter((w) => w && isStr(w.id)).map((w) => [w.id, w]));
  const screenerIds = new Set<string>();
  const orders = new Set<number>();
  for (const it of items) {
    const tag = `screener ${String(it?.wordId)}`;
    if (!it || !isStr(it.wordId)) {
      errors.push('screener: item without a wordId');
      continue;
    }
    if (screenerIds.has(it.wordId)) errors.push(`${tag}: duplicate wordId`);
    screenerIds.add(it.wordId);
    const w = byId.get(it.wordId);
    if (!w) errors.push(`${tag}: no such word`);
    else {
      if (w.wordClass !== 'noun' && w.wordClass !== 'verb') errors.push(`${tag}: must be a noun or a verb, not ${w.wordClass}`);
      if (w.hasImage === false) errors.push(`${tag}: has no picture`);
      else if (isStr(w.image) && !imageFiles.has(w.image)) defer('image', `${tag}: picture file "${w.image}" is missing`);
    }
    if (!Number.isInteger(it.order) || it.order < 1 || it.order > expectedScreener) errors.push(`${tag}: order must be a whole number from 1 to ${expectedScreener}`);
    else {
      if (orders.has(it.order)) errors.push(`${tag}: order ${it.order} is used twice`);
      orders.add(it.order);
    }
  }

  // ---- Reading items -----------------------------------------------------------------------
  const readingIds = new Set<string>();
  let phrases = 0;
  let sentences = 0;
  for (const r of readingItems) {
    const tag = `reading ${isStr(r?.id) ? r.id : '(no id)'}`;
    const err = (m: string) => errors.push(`${tag}: ${m}`);
    if (!r || typeof r !== 'object') {
      errors.push(`${tag}: not an object`);
      continue;
    }
    if (r.kind === 'phrase') phrases++;
    else if (r.kind === 'sentence') sentences++;
    else err('kind must be "phrase" or "sentence"');
    if (!isStr(r.id)) err('missing id');
    else {
      if (readingIds.has(r.id)) err('duplicate id');
      readingIds.add(r.id);
    }
    if (!isStr(r.group)) err('missing group');
    if (typeof r.childFriendly !== 'boolean') err('childFriendly must be true or false');
    if (r.wordId !== undefined && !byId.has(r.wordId)) err(`wordId "${r.wordId}" is not a word`);
    if (!isStr(r.image)) err('missing image');
    else {
      usedImages.add(r.image);
      if (!imageFiles.has(r.image)) defer('image', `${tag}: no image file "${r.image}"`);
      if (!creditByImage.has(r.image)) warnings.push(`${tag}: no credits entry for "${r.image}"`);
    }
    if (!isStr(r.text)) err('missing text');
    if (!isStr(r.answer)) err('missing answer');
    if (!isStr(r.cloze)) err('missing cloze');
    else if (!hasSingleBlank(r.cloze)) err('cloze needs exactly one ___ (three underscores)');
    else if (isStr(r.text) && isStr(r.answer) && r.cloze.replace('___', r.answer) !== r.text) {
      err(`cloze "${r.cloze}" filled with "${r.answer}" does not reproduce text "${r.text}"`);
    }

    const checkOptions = (field: 'distractors' | 'answerDistractors', target: unknown, targetName: string) => {
      const list = r[field];
      if (!Array.isArray(list)) {
        err(`${field} must be a list`);
        return;
      }
      if (list.length < 3) err(`${field} needs at least 3 entries, found ${list.length}`);
      const seen = new Set<string>();
      if (isStr(target)) seen.add(norm(target));
      for (const d of list) {
        if (!isStr(d)) {
          err(`${field} has an empty or non-text entry`);
          continue;
        }
        const k = norm(d);
        if (isStr(target) && k === norm(target)) err(`${field} contains the ${targetName} "${d}"`);
        else if (seen.has(k)) err(`${field} has a duplicate "${d}"`);
        seen.add(k);
      }
    };
    checkOptions('distractors', r.text, 'target text');
    checkOptions('answerDistractors', r.answer, 'answer');
  }
  stats.phrases = phrases;
  stats.sentences = sentences;
  stats.readingItems = readingItems.length;
  if (requireReading) {
    for (const [kind, n] of [
      ['phrase', phrases],
      ['sentence', sentences],
    ] as const) {
      if (n < minReading) {
        const m = `Reading content: at least ${minReading} ${kind} items are required, found ${n}`;
        if (lenient) warnings.push(m);
        else errors.push(m);
      }
    }
  }

  // ---- Unreferenced images -----------------------------------------------------------------
  const orphans = [...imageFiles.keys()].filter((f) => !usedImages.has(f));
  stats.unreferencedImages = orphans.length;
  if (orphans.length > 0) warnings.push(`${orphans.length} image file${orphans.length === 1 ? ' is' : 's are'} not used by any word or reading item: ${describeList(orphans)}`);

  // ---- Settle deferred problems ------------------------------------------------------------
  for (const [key, list] of Object.entries(unfinished)) {
    stats[key === 'image' ? 'missingImageFiles' : 'missingCredits'] = list.length;
    if (!lenient) errors.push(...list);
    else {
      const what = key === 'image' ? 'have no image file yet' : 'have no credits entry yet';
      warnings.push(`${list.length} item${list.length === 1 ? '' : 's'} ${what}: ${describeList(list.map((m) => m.split(':')[0]))}`);
    }
  }
  stats.missingImageFiles ??= 0;
  stats.missingCredits ??= 0;
  stats.errors = errors.length;
  stats.warnings = warnings.length;

  return { errors, warnings, stats };
}
