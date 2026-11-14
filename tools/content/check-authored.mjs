// Checks one authored vocabulary file. Usage: node check-authored.mjs <file> <count>
import { readFileSync } from 'node:fs';

const [file, countArg] = process.argv.slice(2);
const errors = [];
let data;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error('INVALID JSON: ' + e.message);
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error('Top level must be an array');
  process.exit(1);
}
const want = Number(countArg);
if (want && data.length !== want) errors.push(`Expected ${want} records, found ${data.length}`);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function forms(word) {
  const parts = word.split(/[\s-]+/).filter((p) => p.length >= 3);
  const all = new Set([word, ...parts]);
  const out = new Set();
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

const seen = new Set();
const subCounts = new Map();
const str = (v) => typeof v === 'string' && v.trim().length > 0;

data.forEach((r, i) => {
  const tag = `#${i + 1} "${r?.word}"`;
  if (!r || typeof r !== 'object') {
    errors.push(`${tag}: not an object`);
    return;
  }
  if (!str(r.word)) {
    errors.push(`${tag}: missing word`);
    return;
  }
  if (r.word !== r.word.toLowerCase()) errors.push(`${tag}: word must be lower case`);
  if (seen.has(r.word)) errors.push(`${tag}: duplicate word`);
  seen.add(r.word);
  if (!str(r.subgroup)) errors.push(`${tag}: missing subgroup`);
  else subCounts.set(r.subgroup, (subCounts.get(r.subgroup) || 0) + 1);
  if (!Number.isInteger(r.syllables) || r.syllables < 1 || r.syllables > 7) errors.push(`${tag}: bad syllables`);
  if (![1, 2, 3].includes(r.frequencyBand)) errors.push(`${tag}: bad frequencyBand`);
  if (typeof r.childFriendly !== 'boolean') errors.push(`${tag}: childFriendly must be boolean`);
  for (const k of ['imagePrompt', 'searchQuery']) if (!str(r[k])) errors.push(`${tag}: missing ${k}`);
  const c = r.cues || {};
  const s = r.semantic || {};
  const p = r.phonological || {};
  for (const k of ['definition', 'sentenceCompletion', 'firstSoundSpoken'])
    if (!str(c[k])) errors.push(`${tag}: missing cues.${k}`);
  if (str(c.sentenceCompletion)) {
    if ((c.sentenceCompletion.match(/_+/g) || []).length !== 1 || !/(^|[^_])___([^_]|$)/.test(c.sentenceCompletion))
      errors.push(`${tag}: sentenceCompletion needs exactly one ___ (three underscores)`);
  }
  if (r.syllables >= 2 && !str(c.firstSyllable)) errors.push(`${tag}: missing cues.firstSyllable`);
  if (r.syllables === 1 && 'firstSyllable' in c) errors.push(`${tag}: omit firstSyllable for one-syllable words`);
  for (const k of ['category', 'use', 'action', 'properties', 'location', 'association'])
    if (!str(s[k])) errors.push(`${tag}: missing semantic.${k}`);
  for (const k of ['firstSound', 'lastSound', 'sameFirstSound'])
    if (!str(p[k])) errors.push(`${tag}: missing phonological.${k}`);
  if (!(p.rhyme === null || str(p.rhyme))) errors.push(`${tag}: rhyme must be a string or null`);
  const texts = [c.definition, c.sentenceCompletion, ...Object.values(s), p.rhyme, p.sameFirstSound].filter(str);
  const re = new RegExp(`\\b(${forms(r.word).map(esc).join('|')})\\b`, 'i');
  for (const t of texts) if (re.test(t)) errors.push(`${tag}: text contains the target word: "${t}"`);
});

for (const [sub, n] of subCounts) if (n < 6) errors.push(`Subgroup "${sub}" has only ${n} words (minimum 6)`);
if (subCounts.size < 5 || subCounts.size > 12) errors.push(`Use 6 to 9 subgroups (found ${subCounts.size})`);
const multi = data.filter((r) => /\s/.test(r.word || '')).length;
if (multi > 6) errors.push(`Too many multi-word items (${multi})`);

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`FAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`OK ${data.length} records, ${subCounts.size} subgroups, ${multi} multi-word`);
